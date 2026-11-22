import { Game, defOf } from '../../src/core/sim';
import { GRID } from '../../src/core/iso';
import { newGame } from '../../src/core/state';
import type { BugKind, BuildingDef, PlacedBuilding } from '../../src/core/types';
import { BUILDINGS, BUILDING_BY_ID } from '../../src/data/buildings';
import { FOODS } from '../../src/data/foods';
import { QUESTS } from '../../src/data/quests';

/**
 * 模拟一个“普通认真玩家”：一次只做一个操作，每个操作要花时间（点一下约 0.8 秒，逛商店摆建筑约 2.5 秒），
 * 看到害虫要反应几秒才去点。用真实的 Game 模拟层推进，不改任何规则。
 */

export function seeded(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export interface BotOptions {
  seed?: number;
  /** 模拟时长上限（秒） */
  maxSeconds: number;
  /** 到达该等级且任务链完成后提前结束 */
  stopLevel?: number;
  /** 任务链完成即结束 */
  stopWhenQuestsDone?: boolean;
  /** 操作耗时倍率：1 为认真玩家，1.6 左右为边玩边看别的休闲玩家 */
  pace?: number;
  /** 忙碌度超过它就不再添新住户 */
  busyLimit?: number;
  /** 每隔多少秒采样一次 */
  sampleEvery?: number;
}

export interface Sample {
  t: number;
  coins: number;
  level: number;
  bugs: number;
  happiness: number;
  quest: number;
}

export interface BotResult {
  game: Game;
  seconds: number;
  /** levelTimes[n] 为到达 n 级的时刻（秒），1 级为 0 */
  levelTimes: number[];
  /** 到达各级时手上的金币 */
  levelCoins: number[];
  questTimes: number[];
  samples: Sample[];
  /** 无事可做的空档：[开始时刻, 时长] */
  gaps: [number, number][];
  /** 想买东西但钱不够的等待：[开始时刻, 时长] */
  starved: [number, number][];
  pestTimes: number[];
  actions: Record<string, number>;
  /** 各时刻的操作耗时，用于统计忙碌程度：[时刻, 耗时] */
  busy: [number, number][];
  earned: number;
  foodSpent: number;
}

const DT = 0.25;
const TAP = 0.8;
const SHOO_TAP = 0.35;
const FEED = 1.4;
const BUY_FOOD = 0.5;
const SHOP = 2.5;
const PEST_REACTION = 4;
const BUSY_WINDOW = 60;
const BUSY_LIMIT = 0.55;

export function runBot(opts: BotOptions): BotResult {
  const game = new Game(newGame(), seeded(opts.seed ?? 1));
  const s = game.state;
  const res: BotResult = {
    game, seconds: 0, levelTimes: [0, 0], levelCoins: [0, s.coins], questTimes: [], samples: [], gaps: [], starved: [],
    pestTimes: [], actions: {}, busy: [], earned: 0, foodSpent: 0,
  };
  let t = 0;
  let cooldown = 1;
  let idleSince: number | null = null;
  let starvedSince: number | null = null;
  const pestSeen = new Map<number, number>();
  const sampleEvery = opts.sampleEvery ?? 30;
  let nextSample = 0;
  const pace = opts.pace ?? 1;
  const busyLimit = opts.busyLimit ?? BUSY_LIMIT;
  const earnLog: [number, number][] = [];

  game.bus.on((e) => {
    if (e.type === 'levelup') {
      res.levelTimes[e.level] = t;
      res.levelCoins[e.level] = s.coins;
    }
    if (e.type === 'quest') res.questTimes.push(t);
    if (e.type === 'pest') res.pestTimes.push(t);
    if (e.type === 'coins') {
      res.earned += e.amount;
      earnLog.push([t, e.amount]);
    }
  });

  const act = (name: string, cost: number): void => {
    res.actions[name] = (res.actions[name] ?? 0) + 1;
    res.busy.push([t, cost * pace]);
    cooldown = cost * pace;
    if (idleSince != null) {
      if (t - idleSince > 0) res.gaps.push([idleSince, t - idleSince]);
      idleSince = null;
    }
  };
  const busyFraction = (): number => {
    let sum = 0;
    for (let i = res.busy.length - 1; i >= 0 && res.busy[i][0] >= t - BUSY_WINDOW; i--) sum += res.busy[i][1];
    return sum / BUSY_WINDOW;
  };

  const count = (id: string): number => s.buildings.filter((b) => b.def === id).length;
  const bugsOf = (k: BugKind): number => s.bugs.filter((b) => b.kind === k).length;
  const sitesOf = (k: BugKind): PlacedBuilding[] => s.buildings.filter((b) => defOf(b).work?.bug === k);
  const unlocked = (d: BuildingDef): boolean => d.unlockLevel <= s.level;

  const freeTile = (d: BuildingDef): { x: number; y: number } | null => {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    const c = (GRID - 1) / 2;
    for (let x = 0; x <= GRID - d.w; x++) {
      for (let y = 0; y <= GRID - d.h; y++) {
        if (!game.canPlace(d.id, x, y)) continue;
        const dd = Math.hypot(x + (d.w - 1) / 2 - c, y + (d.h - 1) / 2 - c);
        if (dd < bestD) {
          bestD = dd;
          best = { x, y };
        }
      }
    }
    return best;
  };

  /** 地方不够时，找一块只压着装饰或闲置小工作点的地方，把它们收起来腾位置（挑损失最小的一块） */
  const makeRoom = (d: BuildingDef): boolean => {
    let best: PlacedBuilding[] | null = null;
    let bestCost = Infinity;
    for (let x = 0; x <= GRID - d.w; x++) {
      for (let y = 0; y <= GRID - d.h; y++) {
        const hit = s.buildings.filter((b) => {
          const o = defOf(b);
          return x < b.x + o.w && b.x < x + d.w && y < b.y + o.h && b.y < y + d.h;
        });
        if (hit.some((b) => defOf(b).home || b.job || b.ready || defOf(b).cost >= d.cost)) continue;
        const cost = hit.reduce((n, b) => n + defOf(b).cost + (defOf(b).work ? 1e6 : 0), 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = hit;
        }
      }
    }
    if (!best) return false;
    for (const b of best) game.remove(b.uid);
    act('sell', TAP * 2 * best.length);
    return true;
  };

  let wanted = false;
  const buy = (id: string): boolean => {
    const d = BUILDING_BY_ID[id];
    if (!unlocked(d)) return false;
    if (s.coins < d.cost) {
      wanted = true;
      return false;
    }
    const tile = freeTile(d);
    if (!tile) return makeRoom(d);
    if (!game.place(id, tile.x, tile.y)) return false;
    act(`build:${d.category}`, SHOP);
    return true;
  };

  const bestSite = (k: BugKind, budget = Infinity): BuildingDef | undefined =>
    BUILDINGS.filter((d) => d.work?.bug === k && unlocked(d) && d.cost <= budget).sort((a, z) => z.work!.coins - a.work!.coins)[0];
  const bestDecor = (budget: number): BuildingDef | undefined =>
    BUILDINGS.filter((d) => d.decor && unlocked(d) && d.cost <= budget)
      .sort((a, z) => z.decor!.happiness / (z.w * z.h) - a.decor!.happiness / (a.w * a.h))[0];

  const buyFoodAction = (): boolean => {
    const f = FOODS.filter((x) => x.unlockLevel <= s.level && x.cost <= s.coins).sort((a, z) => a.cost / a.energy - z.cost / z.energy)[0];
    if (!f) {
      wanted = true;
      return false;
    }
    if (!game.buyFood(f.id)) return false;
    res.foodSpent += f.cost;
    act('buyFood', BUY_FOOD);
    return true;
  };

  const feedBug = (uid: number): boolean => {
    const bug = game.bug(uid)!;
    const owned = FOODS.filter((f) => (s.food[f.id] ?? 0) > 0);
    if (owned.length === 0) return buyFoodAction();
    // 能吃饱又不太浪费的最大份；都嫌大就吃最小的
    const room = 100 - bug.energy + 8;
    const pick = owned.filter((f) => f.energy <= room).sort((a, z) => z.energy - a.energy)[0] ?? owned.sort((a, z) => a.energy - z.energy)[0];
    if (!game.feed(uid, pick.id)) return false;
    act('feed', FEED);
    return true;
  };

  const tryQuest = (): boolean => {
    const q = game.currentQuest();
    if (!q) return false;
    const g = q.goal;
    if (g.kind === 'own') return buy(g.def);
    if (g.kind !== 'stat') return false;
    if (g.stat.startsWith('build:')) return buy(g.stat.slice(6));
    if (g.stat === 'buildDecor') {
      const d = bestDecor(s.coins) ?? BUILDINGS.filter((x) => x.decor && unlocked(x)).sort((a, z) => a.cost - z.cost)[0];
      return buy(d.id);
    }
    if (g.stat === 'build') {
      const d = BUILDINGS.filter(unlocked).sort((a, z) => a.cost - z.cost)[0];
      return buy(d.id);
    }
    if (g.stat === 'upgrade') {
      const home = s.buildings.filter((b) => game.upgradeCost(b) != null).sort((a, z) => game.upgradeCost(a)! - game.upgradeCost(z)!)[0];
      if (!home) {
        const h = BUILDINGS.filter((d) => d.home && unlocked(d)).sort((a, z) => a.cost - z.cost)[0];
        return buy(h.id);
      }
      if (s.coins < game.upgradeCost(home)!) {
        wanted = true;
        return false;
      }
      game.upgrade(home.uid);
      act('upgrade', SHOP);
      return true;
    }
    if (g.stat === 'move') {
      const b = s.buildings.find((x) => !x.job && defOf(x).w === 1);
      const tile = b && freeTile(defOf(b));
      if (!b || !tile) return false;
      game.move(b.uid, tile.x, tile.y);
      act('move', SHOP);
      return true;
    }
    if (g.stat === 'buyFood') return buyFoodAction();
    if (g.stat === 'feed') {
      const bug = s.bugs.filter((b) => b.state === 'idle' && b.energy < 100).sort((a, z) => a.energy - z.energy)[0];
      return bug ? feedBug(bug.uid) : false;
    }
    return false;
  };

  /** 最近两分钟的收入速度（金币/秒） */
  const incomeRate = (): number => {
    while (earnLog.length && earnLog[0][0] < t - 120) earnLog.shift();
    return earnLog.reduce((n, x) => n + x[1], 0) / 120;
  };
  /** 攒一会儿（horizon 秒）就买得起 */
  const within = (cost: number, horizon: number): boolean => cost <= s.coins + incomeRate() * horizon;
  /** 买得起就执行；攒得起就等；否则放弃这个目标看下一个 */
  const goal = (cost: number, horizon: number, run: () => boolean): 'done' | 'wait' | 'skip' => {
    if (s.coins >= cost) return run() ? 'done' : 'skip';
    if (!within(cost, horizon)) return 'skip';
    wanted = true;
    return 'wait';
  };

  const replaceTarget = (k: BugKind): { top: BuildingDef; worst: PlacedBuilding } | null => {
    const top = bestSite(k);
    const worst = sitesOf(k).sort((a, z) => defOf(a).work!.coins - defOf(z).work!.coins)[0];
    if (!top || !worst || defOf(worst).work!.coins >= top.work!.coins) return null;
    return { top, worst };
  };

  const tryExpand = (): boolean => {
    // 每只虫都要有活干：优先买攒得起的最好的，否则先买便宜的顶上
    for (const k of ['ant', 'bee'] as BugKind[]) {
      if (sitesOf(k).length >= bugsOf(k)) continue;
      const tiers = BUILDINGS.filter((d) => d.work?.bug === k && unlocked(d)).sort((a, z) => z.work!.coins - a.work!.coins);
      for (const d of tiers) {
        const r = goal(d.cost, 45, () => buy(d.id));
        if (r === 'done') return true;
        if (r === 'wait') return false;
      }
    }
    if (s.bugs.length > 0 && game.happiness() < 70) {
      const d = bestDecor(s.coins);
      if (d) return buy(d.id);
    }
    // 把最差的工作点换成新解锁的（原地替换，不额外占地）
    for (const k of ['ant', 'bee'] as BugKind[]) {
      const r0 = replaceTarget(k);
      if (!r0) continue;
      const { top, worst } = r0;
      const r = goal(top.cost - Math.floor(defOf(worst).cost / 2), 150, () => {
        if (worst.job || worst.ready) return false;
        const { x, y } = worst;
        game.remove(worst.uid);
        game.place(top.id, x, y);
        act('replace', SHOP + TAP);
        return true;
      });
      if (r === 'done') return true;
      if (r === 'wait') return false;
    }
    // 忙得过来才添新住户
    if (busyFraction() < busyLimit) {
      const options: { cost: number; per: number; run: () => boolean }[] = [];
      for (const b of s.buildings) {
        const cost = game.upgradeCost(b);
        if (cost == null) continue;
        const h = defOf(b).home!;
        options.push({ cost, per: cost / (h.capacity[b.level] - h.capacity[b.level - 1]), run: () => {
          game.upgrade(b.uid);
          act('upgrade', SHOP);
          return true;
        } });
      }
      const beeHomes = BUILDINGS.some((x) => x.home?.bug === 'bee' && unlocked(x));
      for (const d of BUILDINGS) {
        if (!d.home || !unlocked(d) || !freeTile(d)) continue;
        if (d.home.bug === 'bee' ? bugsOf('bee') > bugsOf('ant') : beeHomes && bugsOf('ant') > bugsOf('bee') + 2) continue;
        options.push({ cost: d.cost, per: d.cost / d.home.capacity[0], run: () => buy(d.id) });
      }
      options.sort((a, z) => a.per - z.per);
      for (const o of options) {
        const r = goal(o.cost, 90, o.run);
        if (r === 'done') return true;
        if (r === 'wait') return false;
      }
    }
    if (s.bugs.length > 0 && game.happiness() < 100) {
      const d = bestDecor(s.coins);
      if (d) return buy(d.id);
      wanted = true;
    }
    return false;
  };

  const think = (): void => {
    wanted = false;
    // 1. 害虫
    for (const p of s.pests) {
      if (p.state === 'flee') continue;
      if (!pestSeen.has(p.uid)) pestSeen.set(p.uid, t);
      if (t - pestSeen.get(p.uid)! >= PEST_REACTION) {
        game.shoo(p.uid);
        act('shoo', SHOO_TAP);
        return;
      }
    }
    // 2. 收金币
    const ready = s.buildings.find((b) => b.ready);
    if (ready) {
      game.collect(ready.uid);
      act('collect', TAP);
      return;
    }
    // 3. 任务让喂食就先喂
    const q0 = game.currentQuest();
    if (q0?.goal.kind === 'stat' && q0.goal.stat === 'feed' && tryQuest()) return;
    // 4. 派工 / 喂食
    const free = s.buildings.filter((b) => defOf(b).work && !b.job && !b.ready && !game.isPestered(b.uid))
      .sort((a, z) => defOf(z).work!.coins - defOf(a).work!.coins);
    // 钱够换新的了，就先别往要换掉的旧工作点派工
    const hold = (['ant', 'bee'] as BugKind[]).map((k) => replaceTarget(k))
      .filter((r) => r && s.coins >= r.top.cost - Math.floor(defOf(r.worst).cost / 2)).map((r) => r!.worst.uid);
    for (const site of free) {
      if (hold.includes(site.uid)) continue;
      const w = defOf(site).work!;
      const idle = s.bugs.filter((g) => g.kind === w.bug && g.state === 'idle');
      if (idle.length === 0) continue;
      if (idle.some((g) => g.energy >= w.energy)) {
        if (game.assign(site.uid)) {
          act('assign', TAP);
          return;
        }
        continue;
      }
      const hungry = idle.sort((a, z) => z.energy - a.energy)[0];
      if (feedBug(hungry.uid)) return;
    }
    // 4. 任务要求的建造等
    if (tryQuest()) return;
    const q = game.currentQuest();
    const savingForQuest = wanted && q != null;
    // 5. 自由发展
    if (!savingForQuest && tryExpand()) return;
  };

  while (t < opts.maxSeconds) {
    game.step(DT);
    t += DT;
    cooldown -= DT;
    if (cooldown <= 0) {
      const before = res.busy.length;
      think();
      if (res.busy.length === before) {
        if (idleSince == null) idleSince = t;
        if (wanted) {
          if (starvedSince == null) starvedSince = t;
        }
      }
      if ((res.busy.length !== before || !wanted) && starvedSince != null) {
        // 只有“干等钱”才算卡金币：期间做了别的事（收金币、派工）不打断计时，买到东西才结束
        const last = res.busy[res.busy.length - 1];
        const bought = res.busy.length !== before && last[1] >= SHOP * pace;
        if (bought || !wanted) {
          res.starved.push([starvedSince, t - starvedSince]);
          starvedSince = null;
        }
      }
    }
    if (t >= nextSample) {
      res.samples.push({ t, coins: s.coins, level: s.level, bugs: s.bugs.length, happiness: game.happiness(), quest: s.quest.index });
      nextSample += sampleEvery;
    }
    if (opts.stopWhenQuestsDone && s.quest.index >= QUESTS.length) break;
    if (opts.stopLevel && s.level >= opts.stopLevel && s.quest.index >= QUESTS.length) break;
  }
  if (idleSince != null) res.gaps.push([idleSince, t - idleSince]);
  if (starvedSince != null) res.starved.push([starvedSince, t - starvedSince]);
  res.seconds = t;
  return res;
}

export function fmt(sec: number | undefined): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
}

/** 每级一行的汇总，供 BALANCE_REPORT=1 时打印 */
export function report(r: BotResult): string {
  const lines = ['| 等级 | 到达时间 | 本级用时 | 到达时任务 | 虫数 | 金币(到达/峰值) | 忙碌度 | 害虫/10分钟 | 最长空档 | 最长等钱 |', '|---|---|---|---|---|---|---|---|---|---|'];
  const maxLv = r.game.state.level;
  for (let lv = 1; lv <= maxLv; lv++) {
    const a = r.levelTimes[lv];
    const b = lv < maxLv ? r.levelTimes[lv + 1] : r.seconds;
    const len = Math.max(1, b - a);
    const inLv = (xs: [number, number][]): [number, number][] => xs.filter(([s0]) => s0 >= a && s0 < b);
    const longest = (xs: [number, number][]): number => Math.max(0, ...inLv(xs).map((x) => x[1]));
    const pests = r.pestTimes.filter((x) => x >= a && x < b).length;
    const smp = r.samples.filter((x) => x.t >= a && x.t < b);
    const busy = inLv(r.busy).reduce((n, x) => n + x[1], 0) / len;
    const quest = r.questTimes.filter((x) => x <= a).length;
    lines.push(`| ${lv} | ${fmt(a)} | ${fmt(b - a)} | ${quest} | ${smp.at(-1)?.bugs ?? 0} | ${r.levelCoins[lv]} / ${Math.max(0, ...smp.map((x) => x.coins))} | ${Math.round(busy * 100)}% | ${((pests / len) * 600).toFixed(1)} | ${longest(r.gaps).toFixed(0)}s | ${longest(r.starved).toFixed(0)}s |`);
  }
  return lines.join('\n');
}
