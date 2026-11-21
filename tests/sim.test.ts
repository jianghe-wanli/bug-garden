import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/sim';
import { loadGame, newGame, saveGame } from '../src/core/state';

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
    for (let i = 0; i < 6; i++) game.place('anthouse', (i % 3) * 3, Math.floor(i / 3) * 3);
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
