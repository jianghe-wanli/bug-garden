import type { QuestDef } from '../core/types';

/**
 * 任务链，按顺序逐个完成。可用统计项（stat）：
 * build:<建筑id>、build、assign、collect、coinsEarned、feed、shoo、buyFood、upgrade、move
 */
export const QUESTS: QuestDef[] = [
  { id: 'q1', title: '安个家', desc: '在商店里建一座橡果蚁窝。', goal: { kind: 'own', def: 'anthouse', count: 1 }, reward: { coins: 30, xp: 5 } },
  { id: 'q2', title: '找点活干', desc: '建一个杂物堆。', goal: { kind: 'own', def: 'junk', count: 1 }, reward: { coins: 20, xp: 5 } },
  { id: 'q3', title: '开工', desc: '点击杂物堆，派一只蚂蚁去干活。', goal: { kind: 'stat', stat: 'assign', count: 1 }, reward: { coins: 20, xp: 5 } },
  { id: 'q4', title: '第一桶金', desc: '点击金币，收取 2 次工作成果。', goal: { kind: 'stat', stat: 'collect', count: 2 }, reward: { coins: 30, xp: 8, food: { sugar: 2 } } },
  { id: 'q5', title: '吃饱才有力气', desc: '点击一只虫虫，喂它吃方糖。', goal: { kind: 'stat', stat: 'feed', count: 1 }, reward: { coins: 30, xp: 8 } },
  { id: 'q6', title: '小有名气', desc: '升到 2 级。', goal: { kind: 'level', level: 2 }, reward: { coins: 60 } },
  { id: 'q7', title: '嗡嗡嗡', desc: '建一座草编蜂房。', goal: { kind: 'own', def: 'beehive', count: 1 }, reward: { coins: 40, xp: 10 } },
  { id: 'q8', title: '花香', desc: '种一朵雏菊，让蜜蜂采蜜。', goal: { kind: 'own', def: 'daisy', count: 1 }, reward: { coins: 40, xp: 10 } },
  { id: 'q9', title: '走开！', desc: '点击捣乱的害虫，赶走 1 只。', goal: { kind: 'stat', stat: 'shoo', count: 1 }, reward: { coins: 50, xp: 12 } },
  { id: 'q10', title: '美化花园', desc: '摆放 3 个装饰。', goal: { kind: 'stat', stat: 'buildDecor', count: 3 }, reward: { coins: 80, xp: 15 } },
  { id: 'q11', title: '扩建', desc: '升级一座房子。', goal: { kind: 'stat', stat: 'upgrade', count: 1 }, reward: { coins: 100, xp: 20 } },
  { id: 'q12', title: '勤劳致富', desc: '累计赚到 500 金币。', goal: { kind: 'stat', stat: 'coinsEarned', count: 500 }, reward: { coins: 150, xp: 30, food: { cookie: 3 } } },
];
