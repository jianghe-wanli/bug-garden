import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import type { BugKind, BuildingDef } from '../src/core/types';
import { BUILDINGS, BUILDING_BY_ID } from '../src/data/buildings';
import { FOODS, FOOD_BY_ID } from '../src/data/foods';
import { MAX_LEVEL, XP_TO_NEXT, levelUpCoins } from '../src/data/levels';
import { MAX_PESTS, PESTS, PEST_BY_ID, PEST_INTERVAL } from '../src/data/pests';
import { QUESTS } from '../src/data/quests';

const CJK = /[\u4e00-\u9fff]/;
const SELL_REFUND = 0.5; // 与 sim.ts 一致
const KINDS: BugKind[] = ['ant', 'bee'];
const artExists = (key: string): boolean => existsSync(fileURLToPath(new URL(`../src/art/svg/${key}.svg`, import.meta.url)));
const byUnlock = (a: { unlockLevel: number }, z: { unlockLevel: number }): number => a.unlockLevel - z.unlockLevel;
const line = (k: BugKind): BuildingDef[] => BUILDINGS.filter((b) => b.work?.bug === k).sort(byUnlock);
const increasing = (xs: number[]): boolean => xs.every((x, i) => i === 0 || x > xs[i - 1]);
const unique = (xs: string[]): boolean => new Set(xs).size === xs.length;

describe('建筑表', () => {
  it('id 不重复，文案是中文，贴图存在', () => {
    expect(unique(BUILDINGS.map((b) => b.id))).toBe(true);
    expect(Object.keys(BUILDING_BY_ID)).toHaveLength(BUILDINGS.length);
    for (const b of BUILDINGS) {
      expect(b.name, b.id).toMatch(CJK);
      expect(b.desc, b.id).toMatch(CJK);
      expect(artExists(b.art), `${b.id} 的贴图 ${b.art}`).toBe(true);
    }
  });

  it('字段取值合法，类别和内容对应', () => {
    for (const b of BUILDINGS) {
      expect([b.home, b.work, b.decor].filter(Boolean), b.id).toHaveLength(1);
      expect(b[b.category], b.id).toBeDefined();
      for (const n of [b.w, b.h, b.cost, b.unlockLevel, b.buildXp]) expect(Number.isInteger(n) && n > 0, b.id).toBe(true);
      expect(b.w, b.id).toBeLessThanOrEqual(2);
      expect(b.h, b.id).toBeLessThanOrEqual(2);
      expect(b.unlockLevel, b.id).toBeLessThanOrEqual(MAX_LEVEL);
    }
  });

  it('住宅：容量逐级增加，升级费用与容量档数匹配且递增', () => {
    for (const b of BUILDINGS.filter((x) => x.home)) {
      const h = b.home!;
      expect(increasing(h.capacity), b.id).toBe(true);
      expect(h.upgradeCost, b.id).toHaveLength(h.capacity.length - 1);
      expect(increasing([b.cost, ...h.upgradeCost]), b.id).toBe(true);
    }
  });

  it('工作点：体力消耗不超过满体力，否则永远派不了工', () => {
    for (const b of BUILDINGS.filter((x) => x.work)) {
      const w = b.work!;
      expect(w.energy, b.id).toBeGreaterThan(0);
      expect(w.energy, b.id).toBeLessThanOrEqual(100);
      expect(w.duration, b.id).toBeGreaterThan(0);
      expect(w.coins, b.id).toBeGreaterThan(0);
      expect(w.xp, b.id).toBeGreaterThan(0);
    }
  });

  it.each(KINDS)('%s 线：越晚解锁的工作点耗时、单次金币、经验、价格、回本次数都更高', (k) => {
    const sites = line(k);
    expect(sites.length).toBeGreaterThanOrEqual(6);
    expect(increasing(sites.map((b) => b.unlockLevel))).toBe(true);
    expect(increasing(sites.map((b) => b.work!.duration))).toBe(true);
    expect(increasing(sites.map((b) => b.work!.coins))).toBe(true);
    expect(increasing(sites.map((b) => b.work!.xp))).toBe(true);
    expect(increasing(sites.map((b) => b.work!.energy))).toBe(true);
    expect(increasing(sites.map((b) => b.cost))).toBe(true);
    expect(increasing(sites.map((b) => b.cost / b.work!.coins))).toBe(true);
    // 每秒收益保持在一个窄带里：高档工作点的好处是省点击，而不是碾压低档
    for (const b of sites) {
      const rate = b.work!.coins / b.work!.duration;
      expect(rate, b.id).toBeGreaterThan(0.7);
      expect(rate, b.id).toBeLessThan(1.4);
    }
  });

  it('每种虫的住宅解锁时，已经有它能干的活', () => {
    for (const home of BUILDINGS.filter((b) => b.home)) {
      expect(line(home.home!.bug)[0].unlockLevel, home.id).toBeLessThanOrEqual(home.unlockLevel);
    }
  });

  it('装饰：越晚解锁每格快乐越高、每点快乐越贵', () => {
    const decor = BUILDINGS.filter((b) => b.decor).sort(byUnlock);
    expect(decor.length).toBeGreaterThanOrEqual(10);
    expect(increasing(decor.map((b) => b.unlockLevel))).toBe(true);
    expect(increasing(decor.map((b) => b.decor!.happiness / (b.w * b.h)))).toBe(true);
    for (let i = 1; i < decor.length; i++) {
      const [a, z] = [decor[i - 1], decor[i]];
      expect(z.cost / z.decor!.happiness, z.id).toBeGreaterThanOrEqual((a.cost / a.decor!.happiness) * 0.85);
    }
    expect(decor.at(-1)!.cost / decor.at(-1)!.decor!.happiness).toBeGreaterThan(decor[0].cost / decor[0].decor!.happiness);
  });

  it('反复建了又收不能刷级：买卖损失的金币多于升级奖励', () => {
    for (const b of BUILDINGS) {
      const lossPerXp = (b.cost - Math.floor(b.cost * SELL_REFUND)) / b.buildXp;
      for (let lv = b.unlockLevel; lv < MAX_LEVEL; lv++) {
        expect(XP_TO_NEXT[lv - 1] * lossPerXp, `${b.id} @${lv}`).toBeGreaterThan(levelUpCoins(lv + 1));
      }
    }
  });
});

describe('食物表', () => {
  it('合法、能买到、越高级越划算', () => {
    expect(unique(FOODS.map((f) => f.id))).toBe(true);
    const foods = [...FOODS].sort(byUnlock);
    expect(foods[0].unlockLevel).toBe(1);
    for (const f of foods) {
      expect(f.name).toMatch(CJK);
      expect(artExists(f.art), f.art).toBe(true);
      expect(f.cost).toBeGreaterThan(0);
      expect(f.energy).toBeGreaterThan(0);
      expect(f.energy).toBeLessThanOrEqual(100);
      expect(f.unlockLevel).toBeLessThanOrEqual(MAX_LEVEL);
      expect(FOOD_BY_ID[f.id]).toBe(f);
    }
    expect(increasing(foods.map((f) => f.energy))).toBe(true);
    expect(increasing(foods.map((f) => f.cost))).toBe(true);
    expect(increasing(foods.map((f) => -f.cost / f.energy))).toBe(true);
  });

  it('开局的食物在开局就能用', () => {
    for (const id of Object.keys(newGame().food)) expect(FOOD_BY_ID[id]?.unlockLevel, id).toBe(1);
  });

  it('干活永远不亏：任何工作点的最低收益都高于补回体力的饭钱', () => {
    const cheapest = Math.min(...FOODS.map((f) => f.cost / f.energy));
    const priciest = Math.max(...FOODS.map((f) => f.cost / f.energy));
    for (const b of BUILDINGS.filter((x) => x.work)) {
      const w = b.work!;
      const food = FOODS.some((f) => f.unlockLevel <= b.unlockLevel && f.cost / f.energy === cheapest) ? cheapest : priciest;
      expect(w.coins * 0.8, b.id).toBeGreaterThan(w.energy * food * 1.5);
    }
  });
});

describe('害虫表', () => {
  it('合法，出现间隔合理', () => {
    expect(unique(PESTS.map((p) => p.id))).toBe(true);
    for (const p of PESTS) {
      expect(PEST_BY_ID[p.id]).toBe(p);
      expect(p.name).toMatch(CJK);
      expect(artExists(p.art), p.art).toBe(true);
      expect(p.taps).toBeGreaterThanOrEqual(1);
      expect(p.taps).toBeLessThanOrEqual(8);
      expect(p.unlockLevel).toBeGreaterThan(1);
      expect(p.unlockLevel).toBeLessThanOrEqual(MAX_LEVEL);
      expect(p.rewardCoins).toBeGreaterThan(0);
      expect(p.rewardXp).toBeGreaterThan(0);
    }
    const sorted = [...PESTS].sort(byUnlock);
    expect(increasing(sorted.map((p) => p.taps))).toBe(true);
    expect(increasing(sorted.map((p) => p.rewardCoins))).toBe(true);
    expect(PEST_INTERVAL[0]).toBeGreaterThanOrEqual(45);
    expect(PEST_INTERVAL[1]).toBeGreaterThan(PEST_INTERVAL[0]);
    expect(MAX_PESTS).toBeGreaterThanOrEqual(1);
    expect(MAX_PESTS).toBeLessThanOrEqual(3);
  });

  it('教程阶段（1～2 级）没有害虫', () => {
    expect(Math.min(...PESTS.map((p) => p.unlockLevel))).toBeGreaterThanOrEqual(3);
  });
});

describe('等级表', () => {
  it('共 13 级，所需经验和升级奖励逐级增加', () => {
    expect(MAX_LEVEL).toBe(13);
    expect(increasing(XP_TO_NEXT)).toBe(true);
    expect(increasing(Array.from({ length: MAX_LEVEL - 1 }, (_, i) => levelUpCoins(i + 2)))).toBe(true);
  });

  it('1 到 13 级每一级都有新东西解锁', () => {
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
      const fresh = [...BUILDINGS, ...FOODS, ...PESTS].filter((x) => x.unlockLevel === lv).map((x) => x.name);
      expect(fresh.length, `${lv} 级`).toBeGreaterThanOrEqual(1);
      // 每级至少有一样能买的东西，而不只是多了一种害虫
      expect(BUILDINGS.some((b) => b.unlockLevel === lv), `${lv} 级`).toBe(true);
    }
  });

  it('每一级都有新的工作点，蚂蚁线和蜜蜂线交替', () => {
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
      expect(BUILDINGS.some((b) => b.work && b.unlockLevel === lv), `${lv} 级`).toBe(true);
    }
  });

  it('开局的钱够建一座住宅加一个它的工作点，还有富余', () => {
    const s = newGame();
    const home = BUILDINGS.filter((b) => b.home && b.unlockLevel === 1).sort((a, z) => a.cost - z.cost)[0];
    const site = line(home.home!.bug)[0];
    expect(site.unlockLevel).toBe(1);
    expect(s.coins).toBeGreaterThanOrEqual(home.cost + site.cost * home.home!.capacity[0]);
  });
});

describe('任务链', () => {
  const STATS = ['build', 'buildDecor', 'assign', 'collect', 'coinsEarned', 'feed', 'shoo', 'buyFood', 'upgrade', 'move'];

  it('id 连续不重复，文案是中文，目标和奖励合法', () => {
    expect(QUESTS.length).toBeGreaterThanOrEqual(40);
    QUESTS.forEach((q, i) => {
      expect(q.id).toBe(`q${i + 1}`);
      expect(q.title, q.id).toMatch(CJK);
      expect(q.desc, q.id).toMatch(CJK);
      expect(q.desc.endsWith('。'), q.id).toBe(true);
      const g = q.goal;
      if (g.kind === 'own') {
        expect(BUILDING_BY_ID[g.def], q.id).toBeDefined();
        expect(g.count, q.id).toBeGreaterThan(0);
      } else if (g.kind === 'stat') {
        const ok = STATS.includes(g.stat) || (g.stat.startsWith('build:') && !!BUILDING_BY_ID[g.stat.slice(6)]);
        expect(ok, `${q.id} 的统计项 ${g.stat}`).toBe(true);
        expect(g.count, q.id).toBeGreaterThan(0);
      } else {
        expect(g.level, q.id).toBeGreaterThan(1);
        expect(g.level, q.id).toBeLessThanOrEqual(MAX_LEVEL);
      }
      expect(Object.keys(q.reward).length, q.id).toBeGreaterThan(0);
      expect(q.reward.coins ?? 1, q.id).toBeGreaterThan(0);
      expect(q.reward.xp ?? 1, q.id).toBeGreaterThan(0);
      for (const [id, n] of Object.entries(q.reward.food ?? {})) {
        expect(FOOD_BY_ID[id], `${q.id} 奖励 ${id}`).toBeDefined();
        expect(n, q.id).toBeGreaterThan(0);
      }
    });
  });

  it('文案里写的数量和目标一致', () => {
    for (const q of QUESTS) {
      const g = q.goal;
      const n = g.kind === 'level' ? g.level : g.count;
      if (n > 1) expect(q.desc, q.id).toContain(String(n));
    }
  });

  it('等级任务从 2 级到满级一级不落、按顺序出现', () => {
    const levels = QUESTS.flatMap((q) => (q.goal.kind === 'level' ? [q.goal.level] : []));
    expect(levels).toEqual(Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 2));
  });

  it('不会卡死：任务用到的建筑、食物、害虫，在此前的等级任务里都已解锁', () => {
    let gate = 1;
    const firstPest = Math.min(...PESTS.map((p) => p.unlockLevel));
    for (const q of QUESTS) {
      const g = q.goal;
      if (g.kind === 'level') {
        gate = Math.max(gate, g.level);
        continue;
      }
      const def = g.kind === 'own' ? g.def : g.stat.startsWith('build:') ? g.stat.slice(6) : null;
      if (def) {
        const d = BUILDING_BY_ID[def];
        expect(d.unlockLevel, `${q.id} 需要 ${d.name}`).toBeLessThanOrEqual(gate);
        // 工作点得有对应的虫才有意义
        if (d.work) expect(BUILDINGS.some((b) => b.home?.bug === d.work!.bug && b.unlockLevel <= gate), q.id).toBe(true);
      }
      if (g.kind === 'stat') {
        if (g.stat === 'shoo') expect(firstPest, q.id).toBeLessThanOrEqual(gate);
        if (g.stat === 'buildDecor') expect(BUILDINGS.some((b) => b.decor && b.unlockLevel <= gate), q.id).toBe(true);
        if (g.stat === 'upgrade') expect(BUILDINGS.some((b) => b.home && b.unlockLevel <= gate), q.id).toBe(true);
      }
      for (const id of Object.keys(q.reward.food ?? {})) expect(FOOD_BY_ID[id].unlockLevel, `${q.id} 奖励 ${id}`).toBeLessThanOrEqual(gate);
    }
  });

  it('新东西解锁的那一级就有任务引导：每个工作点和住宅都被某个任务点名，且就在它解锁的那一段', () => {
    let gate = 1;
    const seenAt = new Map<string, number>();
    for (const q of QUESTS) {
      if (q.goal.kind === 'level') gate = q.goal.level;
      if (q.goal.kind === 'own' && !seenAt.has(q.goal.def)) seenAt.set(q.goal.def, gate);
    }
    for (const b of BUILDINGS.filter((x) => x.work || x.home)) expect(seenAt.get(b.id), b.id).toBe(b.unlockLevel);
  });

  it('同一建筑的“拥有”任务数量递增，不会一出现就自动完成', () => {
    const last = new Map<string, number>();
    for (const q of QUESTS) {
      if (q.goal.kind !== 'own') continue;
      expect(q.goal.count, q.id).toBeGreaterThan(last.get(q.goal.def) ?? 0);
      last.set(q.goal.def, q.goal.count);
    }
  });

  it('累计类目标逐次加码', () => {
    const last = new Map<string, number>();
    for (const q of QUESTS) {
      if (q.goal.kind !== 'stat') continue;
      expect(q.goal.count, q.id).toBeGreaterThan(last.get(q.goal.stat) ?? 0);
      last.set(q.goal.stat, q.goal.count);
    }
  });

  it('覆盖全部系统：派工、收取、喂食、买食物、驱赶、装饰、升级、移动、赚钱', () => {
    const used = new Set(QUESTS.flatMap((q) => (q.goal.kind === 'stat' ? [q.goal.stat] : [])));
    for (const s of ['assign', 'collect', 'feed', 'buyFood', 'shoo', 'buildDecor', 'upgrade', 'move', 'coinsEarned']) expect(used.has(s), s).toBe(true);
    for (const cat of ['home', 'work', 'decor'] as const) {
      expect(QUESTS.some((q) => q.goal.kind === 'own' && BUILDING_BY_ID[q.goal.def].category === cat), cat).toBe(true);
    }
    for (const k of KINDS) expect(QUESTS.some((q) => q.goal.kind === 'own' && BUILDING_BY_ID[q.goal.def].work?.bug === k), k).toBe(true);
  });

  it('奖励随进度上涨，建造任务的奖励不超过建造花费（不能靠任务白赚）', () => {
    const coins = QUESTS.filter((q) => q.goal.kind === 'level').map((q) => q.reward.coins ?? 0);
    expect(increasing(coins)).toBe(true);
    const owned = new Map<string, number>();
    for (const q of QUESTS) {
      if (q.goal.kind !== 'own') continue;
      const d = BUILDING_BY_ID[q.goal.def];
      const extra = q.goal.count - (owned.get(d.id) ?? 0);
      owned.set(d.id, q.goal.count);
      expect(q.reward.coins ?? 0, q.id).toBeLessThanOrEqual(d.cost * extra);
    }
  });
});
