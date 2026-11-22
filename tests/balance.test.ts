import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { MAX_LEVEL } from '../src/data/levels';
import { QUESTS } from '../src/data/quests';
import { type BotResult, fmt, report, runBot } from './helpers/bot';

/**
 * 用模拟玩家把整条成长线跑一遍，守住节奏。
 * 想看完整曲线：BALANCE_REPORT=1 npx vitest run tests/balance.test.ts
 */

/** 认真玩家到达 2～13 级的目标时间（分钟） */
const TARGET_MIN = [1.5, 4, 8, 14, 22, 33, 47, 65, 90, 120, 160, 210];
const SEEDS = [1, 2, 3];
const HOURS = 3600;

const keen = SEEDS.map((seed) => runBot({ seed, maxSeconds: 8 * HOURS, stopLevel: MAX_LEVEL }));
const casual = runBot({ seed: 7, maxSeconds: 12 * HOURS, stopLevel: MAX_LEVEL, pace: 1.6, busyLimit: 0.4 });

if (process.env.BALANCE_REPORT) {
  console.log(`认真玩家（seed 1）\n${report(keen[0])}\n\n休闲玩家（操作慢 1.6 倍，更早停止扩张）\n${report(casual)}`);
  const first = keen[0].samples.filter((x) => x.t <= 600);
  console.log(`\n前 10 分钟每 30 秒：金币/等级/已完成任务/虫数\n${first.map((x) => `${fmt(x.t)} ${x.coins}/L${x.level}/q${x.quest}/${x.bugs}`).join(' · ')}`);
}

const maxOf = (xs: [number, number][], from = 0, to = Infinity): number =>
  Math.max(0, ...xs.filter(([t]) => t >= from && t < to).map((x) => x[1]));
const purchases = (r: BotResult): number =>
  Object.entries(r.actions).filter(([k]) => k.startsWith('build:') || k === 'upgrade' || k === 'replace').reduce((n, [, v]) => n + v, 0);

describe('任务链能走通', () => {
  it.each([...keen.map((r, i) => [`认真玩家 seed ${SEEDS[i]}`, r] as const), ['休闲玩家', casual] as const])('%s 做完全部任务并升到满级', (_name, r) => {
    expect(r.game.state.quest.index).toBe(QUESTS.length);
    expect(r.game.state.level).toBe(MAX_LEVEL);
    expect(r.questTimes).toHaveLength(QUESTS.length);
  });

  it('任务完成时间分布均匀：相邻两个任务之间最多隔一个等级的时长', () => {
    for (const r of keen) {
      for (let i = 1; i < r.questTimes.length; i++) {
        const gap = r.questTimes[i] - r.questTimes[i - 1];
        expect(gap, `${QUESTS[i].id} 等了 ${fmt(gap)}`).toBeLessThan(55 * 60);
      }
    }
  });
});

describe('升级节奏', () => {
  it('认真玩家到达各级的时间落在目标的 0.6～1.5 倍内', () => {
    for (const r of keen) {
      for (let lv = 2; lv <= MAX_LEVEL; lv++) {
        const target = TARGET_MIN[lv - 2] * 60;
        expect(r.levelTimes[lv], `${lv} 级 ${fmt(r.levelTimes[lv])}`).toBeGreaterThan(target * 0.6);
        expect(r.levelTimes[lv], `${lv} 级 ${fmt(r.levelTimes[lv])}`).toBeLessThan(target * 1.5);
      }
    }
  });

  it('休闲玩家慢一些，但 8 小时内也能满级', () => {
    expect(casual.levelTimes[MAX_LEVEL]).toBeGreaterThan(keen[0].levelTimes[MAX_LEVEL]);
    expect(casual.levelTimes[MAX_LEVEL]).toBeLessThan(8 * HOURS);
  });
});

describe('前 10 分钟', () => {
  it('一直有事做：没有超过 20 秒的空档，至少升到 4 级、做完 16 个任务', () => {
    for (const r of keen) {
      expect(maxOf(r.gaps, 0, 600)).toBeLessThanOrEqual(20);
      const at10 = r.samples.filter((x) => x.t <= 600).at(-1)!;
      expect(at10.level).toBeGreaterThanOrEqual(4);
      expect(at10.quest).toBeGreaterThanOrEqual(16);
    }
  });

  it('不卡金币：想买东西时最多等 20 秒；也不会攒到花不掉', () => {
    for (const r of keen) {
      expect(maxOf(r.starved, 0, 600)).toBeLessThanOrEqual(20);
      const coins = r.samples.filter((x) => x.t <= 600).map((x) => x.coins);
      expect(Math.max(...coins)).toBeLessThan(1500);
      // 平均每分钟至少买两样东西
      const bought = r.busy.filter(([t, d]) => t < 600 && d >= 2.5).length;
      expect(bought).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('全程', () => {
  it('每一级都不会长时间无事可做或干等金币', () => {
    for (const r of [...keen, casual]) {
      expect(maxOf(r.gaps)).toBeLessThanOrEqual(75);
      expect(maxOf(r.starved)).toBeLessThanOrEqual(75);
    }
  });

  it('金币不会堆积：手上的钱不超过下一级最贵建筑的 4 倍', () => {
    for (const r of keen) {
      for (const x of r.samples) {
        const priciest = Math.max(...BUILDINGS.filter((b) => b.unlockLevel <= x.level + 1).map((b) => b.cost));
        expect(x.coins, `${fmt(x.t)} ${x.level} 级`).toBeLessThanOrEqual(Math.max(1500, priciest * 4));
      }
    }
  });

  it('一路都在花钱：整局购买次数不少于 150 次', () => {
    for (const r of keen) expect(purchases(r)).toBeGreaterThanOrEqual(150);
  });

  it('害虫有存在感但不烦人：每 10 分钟 3～7 只，驱赶占操作的 8% 以内', () => {
    for (const r of [...keen, casual]) {
      const span = r.seconds - r.pestTimes[0];
      const per10 = (r.pestTimes.length / span) * 600;
      expect(per10).toBeGreaterThan(3);
      expect(per10).toBeLessThan(7);
      const total = Object.values(r.actions).reduce((a, b) => a + b, 0);
      expect(r.actions.shoo / total).toBeLessThan(0.08);
    }
  });

  it('食物是前期的开销、后期的零头', () => {
    for (const r of keen) {
      expect(r.foodSpent / r.earned).toBeGreaterThan(0.01);
      expect(r.foodSpent / r.earned).toBeLessThan(0.15);
    }
  });
});
