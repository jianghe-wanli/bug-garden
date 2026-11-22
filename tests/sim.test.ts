import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/sim';
import { loadGame, newGame, saveGame } from '../src/core/state';
import { BUILDING_BY_ID } from '../src/data/buildings';
import { XP_TO_NEXT } from '../src/data/levels';

function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function run(game: Game, seconds: number, dt = 0.1): void {
  for (let t = 0; t < seconds; t += dt) game.step(dt);
}

function setup(): Game {
  const game = new Game(newGame(), seeded());
  game.state.pestTimer = 1e9;
  return game;
}

describe('建造', () => {
  it('扣金币、入住虫虫、拒绝重叠和越界', () => {
    const game = setup();
    expect(game.place('anthouse', 2, 2)).not.toBeNull();
    expect(game.state.bugs.filter((b) => b.kind === 'ant')).toHaveLength(2);
    expect(game.canPlace('junk', 3, 3)).toBe(false);
    expect(game.canPlace('anthouse', 11, 11)).toBe(false);
    expect(game.place('junk', 3, 3)).toBeNull();
  });

  it('未解锁或金币不足时不能建', () => {
    const game = setup();
    expect(game.place('beehive', 0, 0)).toBeNull();
    game.state.coins = 0;
    expect(game.place('anthouse', 0, 0)).toBeNull();
  });

  it('移动和收起', () => {
    const game = setup();
    const home = game.place('anthouse', 2, 2)!;
    expect(game.move(home.uid, 6, 6)).toBe(true);
    expect(game.building(home.uid)).toMatchObject({ x: 6, y: 6 });
    const coins = game.state.coins;
    expect(game.remove(home.uid)).toBe(true);
    expect(game.state.coins).toBeGreaterThan(coins);
    expect(game.state.bugs).toHaveLength(0);
  });
});

describe('工作循环', () => {
  it('派工、完成、收取金币，并消耗体力', () => {
    const game = setup();
    game.place('anthouse', 2, 2);
    const junk = game.place('junk', 6, 3)!;
    expect(game.assign(junk.uid)).toBe(true);
    const worker = game.bug(junk.job!.bugUid)!;
    run(game, 60);
    expect(junk.ready).not.toBeNull();
    expect(worker.energy).toBeLessThan(100);
    const coins = game.state.coins;
    expect(game.collect(junk.uid)).toBe(true);
    expect(game.state.coins).toBeGreaterThan(coins);
    expect(junk.ready).toBeNull();
  });

  it('体力不够不能派工，喂食后可以', () => {
    const game = setup();
    game.place('anthouse', 2, 2);
    const junk = game.place('junk', 6, 3)!;
    for (const b of game.state.bugs) b.energy = 5;
    expect(game.assign(junk.uid)).toBe(false);
    const bug = game.state.bugs[0];
    expect(game.feed(bug.uid, 'sugar')).toBe(true);
    expect(bug.energy).toBe(35);
    expect(game.assign(junk.uid)).toBe(true);
  });
});

describe('害虫', () => {
  it('臭虫打断工作，点够次数后被赶走并给奖励', () => {
    const game = setup();
    game.state.level = 4;
    game.place('anthouse', 2, 2);
    const junk = game.place('junk', 6, 3)!;
    const pest = game.spawnPest('stink')!;
    expect(pest).not.toBeNull();
    run(game, 40);
    expect(game.isPestered(junk.uid)).toBe(true);
    expect(game.assign(junk.uid)).toBe(false);
    const coins = game.state.coins;
    for (let i = 0; i < 3; i++) game.shoo(pest.uid);
    expect(game.state.coins).toBeGreaterThan(coins);
    expect(game.isPestered(junk.uid)).toBe(false);
    run(game, 30);
    expect(game.state.pests).toHaveLength(0);
  });
});

describe('蚁狮', () => {
  it('在蚂蚁附近挖坑并困住蚂蚁，赶走后蚂蚁脱困', () => {
    const game = setup();
    game.state.level = 4;
    game.place('anthouse', 4, 4);
    game.place('junk', 7, 5);
    const lion = game.spawnPest('antlion')!;
    expect(lion).not.toBeNull();
    const home = game.state.buildings[0];
    expect(Math.hypot(lion.x - (home.x + 0.5), lion.y - (home.y + 0.5))).toBeLessThan(6);
    for (const b of game.state.bugs) {
      b.x = b.tx = lion.x + 0.3;
      b.y = b.ty = lion.y;
      b.wait = 1e9;
    }
    run(game, 8);
    const trapped = game.state.bugs.filter((b) => b.state === 'trapped');
    expect(trapped.length).toBeGreaterThan(0);
    const energy = trapped[0].energy;
    run(game, 2);
    expect(trapped[0].energy).toBeLessThan(energy);
    for (let i = 0; i < 5; i++) game.shoo(lion.uid);
    expect(game.state.pests).toHaveLength(0);
    expect(game.state.bugs.some((b) => b.state === 'trapped')).toBe(false);
  });
});

describe('成长与存档', () => {
  it('经验够了会升级', () => {
    const game = setup();
    game.state.coins = 10000;
    const houses = Math.ceil(XP_TO_NEXT[0] / BUILDING_BY_ID.anthouse.buildXp);
    for (let i = 0; i < houses; i++) game.place('anthouse', (i % 6) * 2, Math.floor(i / 6) * 2);
    expect(game.state.level).toBeGreaterThanOrEqual(2);
  });

  it('离线结算完成进行中的工作', () => {
    const game = setup();
    game.place('anthouse', 2, 2);
    const junk = game.place('junk', 6, 3)!;
    game.assign(junk.uid);
    const r = game.applyOffline(3600);
    expect(r.finished).toBe(1);
    expect(junk.ready).not.toBeNull();
  });

  it('离线时回家路上的虫虫也恢复体力，被臭虫堵住的工作不推进', () => {
    const game = setup();
    game.state.level = 4;
    game.place('anthouse', 2, 2);
    const junk = game.place('junk', 6, 3)!;
    game.assign(junk.uid);
    run(game, 60);
    const worker = game.state.bugs.find((b) => b.energy < 100)!;
    worker.state = 'toHome';
    const energy = worker.energy;
    game.applyOffline(120);
    expect(worker.state).toBe('idle');
    expect(worker.energy).toBeGreaterThan(energy);

    game.collect(junk.uid);
    const pest = game.spawnPest('stink')!;
    run(game, 40);
    expect(game.isPestered(junk.uid)).toBe(true);
    for (const b of game.state.bugs) b.energy = 100;
    for (let i = 0; i < 3; i++) game.shoo(pest.uid);
    run(game, 30);
    game.assign(junk.uid);
    run(game, 10);
    const again = game.spawnPest('stink')!;
    again.x = again.tx;
    again.y = again.ty;
    run(game, 1);
    expect(game.isPestered(junk.uid)).toBe(true);
    const remaining = junk.job!.remaining;
    game.applyOffline(20);
    expect(junk.job!.remaining).toBe(remaining);
  });

  it('第 1 版存档保留花园，任务链从头开始', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } as unknown as Storage;
    const game = setup();
    game.place('anthouse', 2, 2);
    saveGame(game.state, storage);
    const key = [...mem.keys()][0];
    const old = JSON.parse(mem.get(key)!);
    old.version = 1;
    old.quest = { index: 7, base: 3 };
    mem.set(key, JSON.stringify(old));
    const loaded = loadGame(storage)!;
    expect(loaded.version).toBe(2);
    expect(loaded.buildings).toHaveLength(1);
    expect(loaded.quest).toEqual({ index: 0, base: 0 });
  });

  it('反复建了又收、乱买食物都不会把花园带进死局', () => {
    const game = setup();
    const need = BUILDING_BY_ID.anthouse.cost + BUILDING_BY_ID.junk.cost;
    for (let i = 0; i < 40; i++) {
      const b = game.place('anthouse', 2, 2) ?? game.state.buildings[0];
      game.remove(b.uid);
      game.buyFood('sugar');
    }
    const homes = game.state.buildings.length;
    expect(game.state.coins).toBeGreaterThanOrEqual(homes ? BUILDING_BY_ID.junk.cost : need);
    if (!homes) expect(game.place('anthouse', 2, 2)).not.toBeNull();
    expect(game.place('junk', 6, 3)).not.toBeNull();
    // 有了收入来源之后花钱不再受限
    const coins = game.state.coins;
    expect(game.buyFood('sugar')).toBe(true);
    expect(game.state.coins).toBeLessThan(coins);
  });

  it('已有工作点时只需留够盖住宅的钱', () => {
    const game = setup();
    game.place('junk', 6, 3);
    game.state.coins = BUILDING_BY_ID.anthouse.cost + 8;
    expect(game.buyFood('sugar')).toBe(true);
    expect(game.buyFood('sugar')).toBe(false);
    expect(game.place('anthouse', 2, 2)).not.toBeNull();
  });

  it('原地“移动”不算移动', () => {
    const game = setup();
    const b = game.place('anthouse', 2, 2)!;
    expect(game.move(b.uid, 2, 2)).toBe(true);
    expect(game.state.stats.move ?? 0).toBe(0);
    expect(game.move(b.uid, 5, 5)).toBe(true);
    expect(game.state.stats.move).toBe(1);
  });

  it('旧存档读档后先结掉已达成的任务，第一次派工才算数', () => {
    const game = setup();
    game.place('anthouse', 2, 2);
    game.place('junk', 6, 3);
    game.state.quest = { index: 0, base: 0 };
    game.syncQuests();
    const q = game.currentQuest()!;
    expect(q.goal).toMatchObject({ kind: 'stat', stat: 'assign' });
    const site = game.state.buildings.find((b) => b.def === 'junk')!;
    game.assign(site.uid);
    expect(game.currentQuest()!.id).not.toBe(q.id);
  });

  it('花园摆满时改来臭虫', () => {
    const game = new Game(newGame(), () => 0.99);
    game.state.level = 13;
    game.state.coins = 1e9;
    game.place('anthouse', 0, 0);
    game.place('junk', 2, 0);
    for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) game.place('pebble', x, y);
    expect(game.spawnPest('antlion')).toBeNull();
    game.state.pestTimer = 0.05;
    run(game, 0.2);
    expect(game.state.pests.map((p) => p.kind)).toEqual(['stink']);
  });

  it('存档读档往返一致', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    } as unknown as Storage;
    const game = setup();
    game.place('anthouse', 2, 2);
    saveGame(game.state, storage);
    const loaded = loadGame(storage)!;
    expect(loaded.buildings).toHaveLength(1);
    expect(loaded.bugs).toHaveLength(2);
    expect(loaded.coins).toBe(game.state.coins);
  });
});
