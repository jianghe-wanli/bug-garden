import { BUILDING_BY_ID } from '../data/buildings';
import { FOOD_BY_ID } from '../data/foods';
import { MAX_LEVEL, XP_TO_NEXT, levelUpCoins } from '../data/levels';
import { MAX_PESTS, PESTS, PEST_BY_ID, PEST_INTERVAL } from '../data/pests';
import { QUESTS } from '../data/quests';
import { EventBus } from './events';
import { GRID } from './iso';
import type { Bug, BuildingDef, GameState, Pest, PestKind, PlacedBuilding, QuestDef } from './types';

const BUG_SPEED = { ant: 1.6, bee: 2.4 } as const;
const PEST_SPEED = 1.3;
const IDLE_REGEN = 0.05;
const TRAP_DRAIN = 1.5;
const PEST_STAY = { stink: 90, antlion: 120 } as const;
const ANTLION_GRAB_EVERY = 8;
const ANTLION_RANGE = 3;
const MAX_OFFLINE = 8 * 3600;
const SELL_REFUND = 0.5;
const HUNGRY = 20;

export function defOf(b: PlacedBuilding): BuildingDef {
  return BUILDING_BY_ID[b.def];
}

export function centerOf(b: PlacedBuilding): { x: number; y: number } {
  const d = defOf(b);
  return { x: b.x + (d.w - 1) / 2, y: b.y + (d.h - 1) / 2 };
}

function clampGrid(v: number): number {
  return Math.max(-0.3, Math.min(GRID - 0.7, v));
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export class Game {
  readonly bus = new EventBus();

  constructor(public state: GameState, private rng: () => number = Math.random) {}

  // ---------- 查询 ----------

  building(uid: number): PlacedBuilding | undefined {
    return this.state.buildings.find((b) => b.uid === uid);
  }

  bug(uid: number): Bug | undefined {
    return this.state.bugs.find((b) => b.uid === uid);
  }

  canPlace(defId: string, x: number, y: number, ignoreUid?: number): boolean {
    const d = BUILDING_BY_ID[defId];
    if (!d) return false;
    if (x < 0 || y < 0 || x + d.w > GRID || y + d.h > GRID) return false;
    for (const b of this.state.buildings) {
      if (b.uid === ignoreUid) continue;
      const o = defOf(b);
      if (x < b.x + o.w && b.x < x + d.w && y < b.y + o.h && b.y < y + d.h) return false;
    }
    return true;
  }

  capacity(b: PlacedBuilding): number {
    return defOf(b).home?.capacity[b.level - 1] ?? 0;
  }

  upgradeCost(b: PlacedBuilding): number | null {
    return defOf(b).home?.upgradeCost[b.level - 1] ?? null;
  }

  isPestered(buildingUid: number): boolean {
    return this.state.pests.some((p) => p.state === 'pester' && p.targetUid === buildingUid);
  }

  /** 0-100 */
  happiness(): number {
    const bugs = this.state.bugs.length;
    if (bugs === 0) return 100;
    let decor = 0;
    for (const b of this.state.buildings) decor += defOf(b).decor?.happiness ?? 0;
    const hungry = this.state.bugs.filter((b) => b.energy < HUNGRY).length;
    const v = 40 + (decor * 60) / (bugs * 6) - hungry * 5;
    return Math.round(Math.max(0, Math.min(100, v)));
  }

  yieldMultiplier(): number {
    return 0.8 + (this.happiness() / 100) * 0.5;
  }

  xpToNext(): number | null {
    return this.state.level >= MAX_LEVEL ? null : XP_TO_NEXT[this.state.level - 1];
  }

  currentQuest(): QuestDef | null {
    return QUESTS[this.state.quest.index] ?? null;
  }

  questProgress(): { value: number; target: number } | null {
    const q = this.currentQuest();
    if (!q) return null;
    const g = q.goal;
    if (g.kind === 'level') return { value: Math.min(this.state.level, g.level), target: g.level };
    if (g.kind === 'own') {
      const n = this.state.buildings.filter((b) => b.def === g.def).length;
      return { value: Math.min(n, g.count), target: g.count };
    }
    const v = (this.state.stats[g.stat] ?? 0) - this.state.quest.base;
    return { value: Math.min(v, g.count), target: g.count };
  }

  // ---------- 操作 ----------

  place(defId: string, x: number, y: number): PlacedBuilding | null {
    const d = BUILDING_BY_ID[defId];
    if (!d || d.unlockLevel > this.state.level) return null;
    if (this.state.coins < d.cost) return this.fail('金币不够');
    if (!this.canPlace(defId, x, y)) return this.fail('这里放不下');
    this.state.coins -= d.cost;
    const b: PlacedBuilding = { uid: this.state.nextUid++, def: defId, x, y, level: 1, job: null, ready: null };
    this.state.buildings.push(b);
    if (d.home) for (let i = 0; i < d.home.capacity[0]; i++) this.spawnBug(b);
    this.bump('build');
    this.bump(`build:${defId}`);
    if (d.decor) this.bump('buildDecor');
    this.sfx('build');
    this.addXp(d.buildXp);
    this.afterAction();
    return b;
  }

  move(uid: number, x: number, y: number): boolean {
    const b = this.building(uid);
    if (!b) return false;
    if (!this.canPlace(b.def, x, y, uid)) return !!this.fail('这里放不下');
    b.x = x;
    b.y = y;
    if (b.job) {
      const bug = this.bug(b.job.bugUid);
      if (bug) this.setWorkTarget(bug, b);
    }
    for (const p of this.state.pests) if (p.targetUid === uid) this.setPestTarget(p, b);
    this.bump('move');
    this.sfx('build');
    this.afterAction();
    return true;
  }

  remove(uid: number): boolean {
    const b = this.building(uid);
    if (!b) return false;
    const d = defOf(b);
    if (b.job) this.releaseBug(this.bug(b.job.bugUid));
    if (d.home) {
      for (const bug of this.state.bugs.filter((g) => g.homeUid === uid)) {
        const site = this.state.buildings.find((s) => s.job?.bugUid === bug.uid);
        if (site) site.job = null;
      }
      this.state.bugs = this.state.bugs.filter((g) => g.homeUid !== uid);
    }
    for (const p of this.state.pests) if (p.targetUid === uid) this.pestFlee(p);
    this.state.buildings = this.state.buildings.filter((s) => s.uid !== uid);
    this.state.coins += Math.floor(d.cost * SELL_REFUND);
    this.sfx('tap');
    this.afterAction();
    return true;
  }

  upgrade(uid: number): boolean {
    const b = this.building(uid);
    if (!b) return false;
    const cost = this.upgradeCost(b);
    if (cost == null) return false;
    if (this.state.coins < cost) return !!this.fail('金币不够');
    const before = this.capacity(b);
    this.state.coins -= cost;
    b.level += 1;
    for (let i = before; i < this.capacity(b); i++) this.spawnBug(b);
    this.bump('upgrade');
    this.sfx('upgrade');
    this.addXp(Math.round(cost / 10));
    this.afterAction();
    return true;
  }

  assign(buildingUid: number): boolean {
    const b = this.building(buildingUid);
    const w = b && defOf(b).work;
    if (!b || !w || b.job || b.ready) return false;
    if (this.isPestered(b.uid)) return !!this.fail('先把害虫赶走');
    const c = centerOf(b);
    const idle = this.state.bugs.filter((g) => g.kind === w.bug && g.state === 'idle');
    if (idle.length === 0) {
      const owned = this.state.bugs.some((g) => g.kind === w.bug);
      return !!this.fail(owned ? `没有空闲的${w.bug === 'ant' ? '蚂蚁' : '蜜蜂'}` : `还没有${w.bug === 'ant' ? '蚂蚁，先建蚁窝' : '蜜蜂，先建蜂房'}`);
    }
    const fit = idle.filter((g) => g.energy >= w.energy);
    if (fit.length === 0) return !!this.fail('虫虫饿了，先喂点吃的');
    fit.sort((a, z) => dist(a.x, a.y, c.x, c.y) - dist(z.x, z.y, c.x, c.y));
    const bug = fit[0];
    b.job = { bugUid: bug.uid, remaining: w.duration, total: w.duration };
    bug.state = 'toWork';
    bug.targetUid = b.uid;
    this.setWorkTarget(bug, b);
    this.bump('assign');
    this.sfx('assign');
    this.afterAction();
    return true;
  }

  collect(buildingUid: number): boolean {
    const b = this.building(buildingUid);
    if (!b || !b.ready) return false;
    const { coins, xp } = b.ready;
    b.ready = null;
    this.state.coins += coins;
    const c = centerOf(b);
    this.bus.emit({ type: 'coins', amount: coins, x: c.x, y: c.y });
    this.bump('collect');
    this.bump('coinsEarned', coins);
    this.sfx('coin');
    this.addXp(xp);
    this.afterAction();
    return true;
  }

  buyFood(id: string): boolean {
    const f = FOOD_BY_ID[id];
    if (!f || f.unlockLevel > this.state.level) return false;
    if (this.state.coins < f.cost) return !!this.fail('金币不够');
    this.state.coins -= f.cost;
    this.state.food[id] = (this.state.food[id] ?? 0) + 1;
    this.bump('buyFood');
    this.sfx('tap');
    this.afterAction();
    return true;
  }

  feed(bugUid: number, foodId: string): boolean {
    const bug = this.bug(bugUid);
    const f = FOOD_BY_ID[foodId];
    if (!bug || !f) return false;
    if ((this.state.food[foodId] ?? 0) <= 0) return !!this.fail(`没有${f.name}了，去商店买一些`);
    if (bug.energy >= 100) return !!this.fail('它已经吃饱了');
    this.state.food[foodId] -= 1;
    bug.energy = Math.min(100, bug.energy + f.energy);
    this.bump('feed');
    this.sfx('feed');
    this.afterAction();
    return true;
  }

  shoo(pestUid: number): boolean {
    const p = this.state.pests.find((q) => q.uid === pestUid);
    if (!p || p.state === 'flee') return false;
    p.hp -= 1;
    this.sfx('shoo');
    if (p.hp > 0) {
      this.bus.emit({ type: 'changed' });
      return true;
    }
    const d = PEST_BY_ID[p.kind];
    this.state.coins += d.rewardCoins;
    this.bus.emit({ type: 'coins', amount: d.rewardCoins, x: p.x, y: p.y });
    this.bump('shoo');
    this.bump('coinsEarned', d.rewardCoins);
    this.pestFlee(p);
    this.addXp(d.rewardXp);
    this.afterAction();
    return true;
  }

  // ---------- 推进 ----------

  step(dt: number): void {
    const s = this.state;
    for (const bug of s.bugs) this.stepBug(bug, dt);
    for (const b of s.buildings) {
      if (!b.job) continue;
      const bug = this.bug(b.job.bugUid);
      if (!bug) {
        b.job = null;
        continue;
      }
      if (bug.state !== 'working' || this.isPestered(b.uid)) continue;
      b.job.remaining -= dt;
      if (b.job.remaining <= 0) this.finishJob(b, bug);
    }
    this.stepPests(dt);
  }

  /** 读档后结算离线时间 */
  applyOffline(seconds: number): { seconds: number; finished: number } {
    const sec = Math.max(0, Math.min(MAX_OFFLINE, seconds));
    const s = this.state;
    let finished = 0;
    if (sec < 1) return { seconds: 0, finished };
    if (sec > 30) {
      for (const bug of s.bugs) {
        if (bug.state === 'trapped') {
          bug.state = bug.targetUid != null ? 'toWork' : 'idle';
          bug.trapUid = null;
        }
      }
      s.pests = [];
    }
    for (const b of s.buildings) {
      if (!b.job) continue;
      const bug = this.bug(b.job.bugUid);
      if (!bug) {
        b.job = null;
        continue;
      }
      if (bug.state === 'toWork') {
        bug.x = bug.tx;
        bug.y = bug.ty;
        bug.state = 'working';
      }
      if (bug.state !== 'working' || this.isPestered(b.uid)) continue;
      b.job.remaining -= sec;
      if (b.job.remaining <= 0) {
        this.finishJob(b, bug);
        bug.x = bug.tx;
        bug.y = bug.ty;
        bug.state = 'idle';
        finished++;
      }
    }
    for (const bug of s.bugs) {
      if (bug.state === 'toHome') {
        bug.x = bug.tx;
        bug.y = bug.ty;
        bug.state = 'idle';
      }
      if (bug.state === 'idle') bug.energy = Math.min(100, bug.energy + IDLE_REGEN * sec);
    }
    return { seconds: sec, finished };
  }

  // ---------- 内部 ----------

  private fail(text: string): null {
    this.bus.emit({ type: 'toast', text });
    this.sfx('error');
    return null;
  }

  private sfx(name: Parameters<typeof sfxEvent>[0]): void {
    this.bus.emit(sfxEvent(name));
  }

  private bump(stat: string, n = 1): void {
    this.state.stats[stat] = (this.state.stats[stat] ?? 0) + n;
  }

  private afterAction(): void {
    this.checkQuest();
    this.bus.emit({ type: 'changed' });
  }

  private addXp(n: number): void {
    const s = this.state;
    s.xp += n;
    this.bus.emit({ type: 'xp', amount: n });
    for (let need = this.xpToNext(); need != null && s.xp >= need; need = this.xpToNext()) {
      s.xp -= need;
      s.level += 1;
      s.coins += levelUpCoins(s.level);
      this.bus.emit({ type: 'levelup', level: s.level });
      this.sfx('levelup');
    }
  }

  private checkQuest(): void {
    const s = this.state;
    for (let q = this.currentQuest(); q; q = this.currentQuest()) {
      const p = this.questProgress()!;
      if (p.value < p.target) break;
      s.quest.index += 1;
      const next = this.currentQuest();
      s.quest.base = next?.goal.kind === 'stat' ? s.stats[next.goal.stat] ?? 0 : 0;
      s.coins += q.reward.coins ?? 0;
      for (const [id, n] of Object.entries(q.reward.food ?? {})) s.food[id] = (s.food[id] ?? 0) + n;
      this.bus.emit({ type: 'quest', quest: q });
      this.sfx('quest');
      if (q.reward.xp) this.addXp(q.reward.xp);
    }
  }

  private spawnBug(home: PlacedBuilding): void {
    const kind = defOf(home).home!.bug;
    const p = this.homeSpot(home);
    this.state.bugs.push({
      uid: this.state.nextUid++, kind, homeUid: home.uid,
      x: p.x, y: p.y, tx: p.x, ty: p.y,
      energy: 100, state: 'idle', targetUid: null, trapUid: null, wait: this.rng() * 2,
    });
  }

  /** 家门口（朝向屏幕前方）的一处空地，避免虫虫站在建筑里 */
  private homeSpot(home: PlacedBuilding): { x: number; y: number } {
    const d = defOf(home);
    let p = { x: home.x, y: home.y };
    for (let i = 0; i < 8; i++) {
      const out = 0.75 + this.rng() * 1.1;
      const along = -0.6 + this.rng() * 2.4;
      p = this.rng() < 0.5
        ? { x: clampGrid(home.x + d.w - 0.5 + out), y: clampGrid(home.y - 0.5 + along * (d.h / 2 + 0.5)) }
        : { x: clampGrid(home.x - 0.5 + along * (d.w / 2 + 0.5)), y: clampGrid(home.y + d.h - 0.5 + out) };
      if (!this.tileOccupied(p.x, p.y)) break;
    }
    return p;
  }

  private tileOccupied(x: number, y: number): boolean {
    const tx = Math.round(x);
    const ty = Math.round(y);
    return this.state.buildings.some((b) => {
      const d = defOf(b);
      return tx >= b.x && tx < b.x + d.w && ty >= b.y && ty < b.y + d.h;
    });
  }

  private setWorkTarget(bug: Bug, site: PlacedBuilding): void {
    const c = centerOf(site);
    bug.tx = clampGrid(c.x + 0.25);
    bug.ty = clampGrid(c.y + 0.45);
  }

  private releaseBug(bug: Bug | undefined): void {
    if (!bug) return;
    bug.targetUid = null;
    if (bug.state === 'trapped') return;
    this.sendHome(bug);
  }

  private sendHome(bug: Bug): void {
    const home = this.building(bug.homeUid);
    const p = home ? this.homeSpot(home) : { x: bug.x, y: bug.y };
    bug.tx = p.x;
    bug.ty = p.y;
    bug.state = 'toHome';
  }

  private finishJob(site: PlacedBuilding, bug: Bug): void {
    const w = defOf(site).work!;
    site.job = null;
    site.ready = { coins: Math.round(w.coins * this.yieldMultiplier()), xp: w.xp };
    bug.energy = Math.max(0, bug.energy - w.energy);
    bug.targetUid = null;
    this.sendHome(bug);
    this.bus.emit({ type: 'changed' });
  }

  private stepBug(bug: Bug, dt: number): void {
    switch (bug.state) {
      case 'idle':
        bug.energy = Math.min(100, bug.energy + IDLE_REGEN * dt);
        if (this.moveToward(bug, BUG_SPEED[bug.kind] * 0.45 * dt)) {
          bug.wait -= dt;
          if (bug.wait <= 0) {
            const home = this.building(bug.homeUid);
            if (home) {
              const p = this.homeSpot(home);
              bug.tx = p.x;
              bug.ty = p.y;
            }
            bug.wait = 1.5 + this.rng() * 3;
          }
        }
        break;
      case 'toWork':
        if (this.moveToward(bug, BUG_SPEED[bug.kind] * dt)) bug.state = 'working';
        break;
      case 'toHome':
        if (this.moveToward(bug, BUG_SPEED[bug.kind] * dt)) {
          bug.state = 'idle';
          bug.wait = 1 + this.rng() * 2;
        }
        break;
      case 'trapped':
        bug.energy = Math.max(0, bug.energy - TRAP_DRAIN * dt);
        break;
      case 'working':
        break;
    }
  }

  private moveToward(e: { x: number; y: number; tx: number; ty: number }, stepLen: number): boolean {
    const dx = e.tx - e.x;
    const dy = e.ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= stepLen || d < 1e-6) {
      e.x = e.tx;
      e.y = e.ty;
      return true;
    }
    e.x += (dx / d) * stepLen;
    e.y += (dy / d) * stepLen;
    return false;
  }

  // ---------- 害虫 ----------

  private stepPests(dt: number): void {
    const s = this.state;
    const unlocked = PESTS.filter((p) => p.unlockLevel <= s.level);
    const sites = s.buildings.filter((b) => defOf(b).work);
    if (unlocked.length > 0 && sites.length > 0 && s.bugs.length > 0) {
      s.pestTimer -= dt;
      if (s.pestTimer <= 0) {
        s.pestTimer = PEST_INTERVAL[0] + this.rng() * (PEST_INTERVAL[1] - PEST_INTERVAL[0]);
        if (s.pests.length < MAX_PESTS) this.spawnPest(unlocked[Math.floor(this.rng() * unlocked.length)].id);
      }
    }
    for (const p of [...s.pests]) {
      if (p.state === 'approach') {
        if (this.moveToward(p, PEST_SPEED * dt)) {
          p.state = 'pester';
          p.timer = PEST_STAY[p.kind];
        }
      } else if (p.state === 'pester') {
        p.timer -= dt;
        if (p.timer <= 0) {
          this.pestFlee(p);
          continue;
        }
        if (p.kind === 'antlion') this.antlionGrab(p, dt);
      } else if (this.moveToward(p, PEST_SPEED * 2.2 * dt)) {
        s.pests = s.pests.filter((q) => q !== p);
      }
    }
  }

  spawnPest(kind: PestKind): Pest | null {
    const s = this.state;
    const def = PEST_BY_ID[kind];
    const p: Pest = { uid: s.nextUid++, kind, x: 0, y: 0, tx: 0, ty: 0, hp: def.taps, state: 'approach', targetUid: null, timer: 0 };
    if (kind === 'stink') {
      const sites = s.buildings.filter((b) => defOf(b).work && !this.isPestered(b.uid));
      if (sites.length === 0) return null;
      const site = sites[Math.floor(this.rng() * sites.length)];
      const edge = this.edgePoint();
      p.x = edge.x;
      p.y = edge.y;
      p.targetUid = site.uid;
      this.setPestTarget(p, site);
    } else {
      const free: { x: number; y: number }[] = [];
      for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) if (this.canPlace('pebble', x, y)) free.push({ x, y });
      if (free.length === 0) return null;
      // 蚁狮优先在蚂蚁常走的地方（蚁窝和蚂蚁工作点附近）挖坑
      const hot = s.buildings.filter((b) => (defOf(b).home ?? defOf(b).work)?.bug === 'ant').map(centerOf);
      const near = free.filter((f) => hot.some((h) => dist(f.x, f.y, h.x, h.y) <= 2.6));
      const pool = near.length > 0 ? near : free;
      const t = pool[Math.floor(this.rng() * pool.length)];
      p.x = p.tx = t.x;
      p.y = p.ty = t.y;
      p.state = 'pester';
      p.timer = PEST_STAY.antlion;
      p.hp = def.taps;
    }
    s.pests.push(p);
    this.bus.emit({ type: 'pest', kind });
    this.sfx('pest');
    return p;
  }

  private setPestTarget(p: Pest, site: PlacedBuilding): void {
    const c = centerOf(site);
    p.tx = clampGrid(c.x - 0.35);
    p.ty = clampGrid(c.y + 0.4);
    if (p.state === 'pester') p.state = 'approach';
  }

  private edgePoint(): { x: number; y: number } {
    const t = this.rng() * (GRID - 1);
    const side = Math.floor(this.rng() * 4);
    if (side === 0) return { x: t, y: -0.3 };
    if (side === 1) return { x: t, y: GRID - 0.7 };
    if (side === 2) return { x: -0.3, y: t };
    return { x: GRID - 0.7, y: t };
  }

  private pestFlee(p: Pest): void {
    for (const bug of this.state.bugs) {
      if (bug.trapUid !== p.uid) continue;
      bug.trapUid = null;
      if (bug.targetUid != null && this.building(bug.targetUid)) bug.state = 'toWork';
      else this.sendHome(bug);
    }
    if (p.kind === 'antlion') {
      this.state.pests = this.state.pests.filter((q) => q !== p);
      return;
    }
    const e = this.edgePoint();
    p.tx = e.x;
    p.ty = e.y;
    p.state = 'flee';
    p.targetUid = null;
  }

  private antlionGrab(p: Pest, dt: number): void {
    const before = Math.floor(p.timer / ANTLION_GRAB_EVERY);
    const after = Math.floor((p.timer + dt) / ANTLION_GRAB_EVERY);
    if (before === after) return;
    const near = this.state.bugs
      .filter((b) => b.kind === 'ant' && b.state !== 'trapped' && b.state !== 'working' && dist(b.x, b.y, p.x, p.y) <= ANTLION_RANGE)
      .sort((a, z) => dist(a.x, a.y, p.x, p.y) - dist(z.x, z.y, p.x, p.y))[0];
    if (!near) return;
    near.state = 'trapped';
    near.trapUid = p.uid;
    near.x = p.x + 0.05;
    near.y = p.y + 0.1;
    this.bus.emit({ type: 'toast', text: '蚂蚁被蚁狮抓住了，快点它！' });
    this.bus.emit({ type: 'changed' });
  }
}

function sfxEvent(name: import('./types').SfxName): { type: 'sfx'; name: import('./types').SfxName } {
  return { type: 'sfx', name };
}
