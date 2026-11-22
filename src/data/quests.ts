import type { QuestDef } from '../core/types';

/**
 * 任务链，按顺序逐个完成。可用统计项（stat）：
 * build:<建筑id>、build、buildDecor、assign、collect、coinsEarned、feed、shoo、buyFood、upgrade、move
 *
 * 编排约定（tests/data.test.ts 会校验）：
 * - 每一段以“升到 N 级”收尾；任务用到的建筑、食物、害虫必须在此前的等级任务里已经解锁。
 * - stat 类目标从任务开始时起算，所以不会因为玩家提前做过而直接跳过，也不会要求做不到的事。
 */
export const QUESTS: QuestDef[] = [
  // ---------- 1 级：蚂蚁和基本循环 ----------
  { id: 'q1', title: '安个家', desc: '在商店里建一座橡果蚁窝。', goal: { kind: 'own', def: 'anthouse', count: 1 }, reward: { coins: 20, xp: 4 } },
  { id: 'q2', title: '找点活干', desc: '建一个杂物堆。', goal: { kind: 'own', def: 'junk', count: 1 }, reward: { coins: 15, xp: 4 } },
  { id: 'q3', title: '开工', desc: '点击杂物堆，派一只蚂蚁去干活。', goal: { kind: 'stat', stat: 'assign', count: 1 }, reward: { coins: 10, xp: 4 } },
  { id: 'q4', title: '第一桶金', desc: '点击金币，收取 2 次工作成果。', goal: { kind: 'stat', stat: 'collect', count: 2 }, reward: { coins: 20, xp: 5, food: { sugar: 2 } } },
  { id: 'q5', title: '吃饱才有力气', desc: '点击一只虫虫，喂它吃方糖。', goal: { kind: 'stat', stat: 'feed', count: 1 }, reward: { coins: 15, xp: 5 } },
  { id: 'q6', title: '人手一份活', desc: '把杂物堆增加到 2 个，让两只蚂蚁都有活干。', goal: { kind: 'own', def: 'junk', count: 2 }, reward: { coins: 20, xp: 5 } },
  { id: 'q7', title: '小有名气', desc: '升到 2 级。', goal: { kind: 'level', level: 2 }, reward: { coins: 40 } },

  // ---------- 2 级：蜜蜂、装饰 ----------
  { id: 'q8', title: '嗡嗡嗡', desc: '建一座草编蜂房。', goal: { kind: 'own', def: 'beehive', count: 1 }, reward: { coins: 40, xp: 8 } },
  { id: 'q9', title: '花香', desc: '种一朵雏菊，让蜜蜂采蜜。', goal: { kind: 'own', def: 'daisy', count: 1 }, reward: { coins: 30, xp: 8 } },
  { id: 'q10', title: '甜蜜的收成', desc: '收取 6 次工作成果。', goal: { kind: 'stat', stat: 'collect', count: 6 }, reward: { coins: 40, xp: 10, food: { sugar: 3 } } },
  { id: 'q11', title: '添点绿意', desc: '摆放 2 个装饰，虫虫开心了赚得更多。', goal: { kind: 'stat', stat: 'buildDecor', count: 2 }, reward: { coins: 40, xp: 10 } },
  { id: 'q12', title: '挪个地方', desc: '长按一座建筑，把它移动到别处。', goal: { kind: 'stat', stat: 'move', count: 1 }, reward: { coins: 20, xp: 8 } },
  { id: 'q13', title: '渐入佳境', desc: '升到 3 级。', goal: { kind: 'level', level: 3 }, reward: { coins: 60 } },

  // ---------- 3 级：新工作点、臭虫、曲奇、升级房子 ----------
  { id: 'q14', title: '掉在地上的点心', desc: '建一处饼干屑，蚂蚁搬一趟赚得更多。', goal: { kind: 'own', def: 'crumbs', count: 1 }, reward: { coins: 50, xp: 12 } },
  { id: 'q15', title: '走开！', desc: '点击捣乱的臭虫，赶走 1 只。', goal: { kind: 'stat', stat: 'shoo', count: 1 }, reward: { coins: 50, xp: 12 } },
  { id: 'q16', title: '备点干粮', desc: '在商店买 3 份食物，曲奇更顶饱。', goal: { kind: 'stat', stat: 'buyFood', count: 3 }, reward: { coins: 40, xp: 10, food: { cookie: 2 } } },
  { id: 'q17', title: '扩建', desc: '升级一座房子，多住一只虫虫。', goal: { kind: 'stat', stat: 'upgrade', count: 1 }, reward: { coins: 80, xp: 15 } },
  { id: 'q18', title: '花园新秀', desc: '升到 4 级。', goal: { kind: 'level', level: 4 }, reward: { coins: 80 } },

  // ---------- 4 级：郁金香、蒲公英 ----------
  { id: 'q19', title: '春天的颜色', desc: '种一朵郁金香。', goal: { kind: 'own', def: 'tulip', count: 1 }, reward: { coins: 70, xp: 18 } },
  { id: 'q20', title: '美化花园', desc: '再摆放 3 个装饰。', goal: { kind: 'stat', stat: 'buildDecor', count: 3 }, reward: { coins: 90, xp: 20 } },
  { id: 'q21', title: '勤劳致富', desc: '累计赚到 600 金币。', goal: { kind: 'stat', stat: 'coinsEarned', count: 600 }, reward: { coins: 120, xp: 25, food: { cookie: 3 } } },
  { id: 'q22', title: '远近闻名', desc: '升到 5 级。', goal: { kind: 'level', level: 5 }, reward: { coins: 100 } },

  // ---------- 5 级：落叶堆、蚁狮、红蘑菇 ----------
  { id: 'q23', title: '翻翻落叶', desc: '建一处落叶堆。', goal: { kind: 'own', def: 'leafpile', count: 1 }, reward: { coins: 120, xp: 25 } },
  { id: 'q24', title: '小心沙坑', desc: '蚁狮会抓走蚂蚁。赶走 3 只害虫。', goal: { kind: 'stat', stat: 'shoo', count: 3 }, reward: { coins: 120, xp: 30 } },
  { id: 'q25', title: '大家都吃饱', desc: '喂食 8 次。', goal: { kind: 'stat', stat: 'feed', count: 8 }, reward: { coins: 100, xp: 30, food: { cookie: 4 } } },
  { id: 'q26', title: '蘑菇伞', desc: '摆一朵红蘑菇。', goal: { kind: 'own', def: 'mushroom', count: 1 }, reward: { coins: 90, xp: 25 } },
  { id: 'q27', title: '花园达人', desc: '升到 6 级。', goal: { kind: 'level', level: 6 }, reward: { coins: 150 } },

  // ---------- 6 级：风铃草、糕饼、蜗牛壳 ----------
  { id: 'q28', title: '叮铃铃', desc: '种一株风铃草。', goal: { kind: 'own', def: 'bell', count: 1 }, reward: { coins: 220, xp: 35 } },
  { id: 'q29', title: '人丁兴旺', desc: '再升级 2 次房子。', goal: { kind: 'stat', stat: 'upgrade', count: 2 }, reward: { coins: 250, xp: 45, food: { cake: 3 } } },
  { id: 'q30', title: '攒下家底', desc: '累计赚到 2000 金币。', goal: { kind: 'stat', stat: 'coinsEarned', count: 2000 }, reward: { coins: 300, xp: 50 } },
  { id: 'q31', title: '一方乐土', desc: '升到 7 级。', goal: { kind: 'level', level: 7 }, reward: { coins: 250 } },

  // ---------- 7 级：树桩蚁堡、野莓丛、萤火灯 ----------
  { id: 'q32', title: '老树桩', desc: '建一座树桩蚁堡，一次住进 4 只蚂蚁。', goal: { kind: 'own', def: 'stumpfort', count: 1 }, reward: { coins: 600, xp: 60 } },
  { id: 'q33', title: '摘野莓', desc: '种 2 丛野莓。', goal: { kind: 'own', def: 'berry', count: 2 }, reward: { coins: 600, xp: 60 } },
  { id: 'q34', title: '点亮夜晚', desc: '摆 2 盏萤火灯。', goal: { kind: 'own', def: 'lantern', count: 2 }, reward: { coins: 400, xp: 55 } },
  { id: 'q35', title: '热闹的花园', desc: '升到 8 级。', goal: { kind: 'level', level: 8 }, reward: { coins: 400 } },

  // ---------- 8 级：向日葵、露珠池塘 ----------
  { id: 'q36', title: '追着太阳', desc: '种 2 株向日葵。', goal: { kind: 'own', def: 'sunflower', count: 2 }, reward: { coins: 1000, xp: 80 } },
  { id: 'q37', title: '一汪清水', desc: '挖一个露珠池塘。', goal: { kind: 'own', def: 'pond', count: 1 }, reward: { coins: 900, xp: 80 } },
  { id: 'q38', title: '忙碌的一天', desc: '派工 40 次。', goal: { kind: 'stat', stat: 'assign', count: 40 }, reward: { coins: 600, xp: 90, food: { cake: 5 } } },
  { id: 'q39', title: '声名远扬', desc: '升到 9 级。', goal: { kind: 'level', level: 9 }, reward: { coins: 600 } },

  // ---------- 9 级：葫芦蜂巢、松果堆、草叶秋千 ----------
  { id: 'q40', title: '藤上的葫芦', desc: '建一座葫芦蜂巢。', goal: { kind: 'own', def: 'gourdhive', count: 1 }, reward: { coins: 1000, xp: 110 } },
  { id: 'q41', title: '掰松果', desc: '堆 2 处松果堆。', goal: { kind: 'own', def: 'pinecone', count: 2 }, reward: { coins: 1500, xp: 120 } },
  { id: 'q42', title: '荡秋千', desc: '搭一架草叶秋千。', goal: { kind: 'own', def: 'swing', count: 1 }, reward: { coins: 500, xp: 90 } },
  { id: 'q43', title: '花园卫士', desc: '赶走 8 只害虫。', goal: { kind: 'stat', stat: 'shoo', count: 8 }, reward: { coins: 800, xp: 120 } },
  { id: 'q44', title: '虫丁兴旺', desc: '升到 10 级。', goal: { kind: 'level', level: 10 }, reward: { coins: 900 } },

  // ---------- 10 级：薰衣草、花瓣喷泉 ----------
  { id: 'q45', title: '紫色的香气', desc: '种 2 株薰衣草。', goal: { kind: 'own', def: 'lavender', count: 2 }, reward: { coins: 2400, xp: 160 } },
  { id: 'q46', title: '叮咚泉水', desc: '建一座花瓣喷泉。', goal: { kind: 'own', def: 'fountain', count: 1 }, reward: { coins: 2000, xp: 160 } },
  { id: 'q47', title: '住得宽敞', desc: '再升级 3 次房子。', goal: { kind: 'stat', stat: 'upgrade', count: 3 }, reward: { coins: 1500, xp: 180, food: { cake: 8 } } },
  { id: 'q48', title: '花园名家', desc: '升到 11 级。', goal: { kind: 'level', level: 11 }, reward: { coins: 1300 } },

  // ---------- 11 级：旧铁罐、纸风车 ----------
  { id: 'q49', title: '罐头里的宝贝', desc: '摆 2 个旧铁罐。', goal: { kind: 'own', def: 'tincan', count: 2 }, reward: { coins: 3500, xp: 220 } },
  { id: 'q50', title: '呼啦啦', desc: '插 2 个纸风车。', goal: { kind: 'own', def: 'windmill', count: 2 }, reward: { coins: 2000, xp: 200 } },
  { id: 'q51', title: '日进斗金', desc: '累计赚到 20000 金币。', goal: { kind: 'stat', stat: 'coinsEarned', count: 20000 }, reward: { coins: 3000, xp: 260 } },
  { id: 'q52', title: '花园大师', desc: '升到 12 级。', goal: { kind: 'level', level: 12 }, reward: { coins: 1800 } },

  // ---------- 12 级：玫瑰、彩虹拱门 ----------
  { id: 'q53', title: '带刺的美人', desc: '种 2 株玫瑰。', goal: { kind: 'own', def: 'rose', count: 2 }, reward: { coins: 5000, xp: 300 } },
  { id: 'q54', title: '雨后彩虹', desc: '搭一座彩虹拱门。', goal: { kind: 'own', def: 'rainbow', count: 1 }, reward: { coins: 4500, xp: 300 } },
  { id: 'q55', title: '满载而归', desc: '收取 60 次工作成果。', goal: { kind: 'stat', stat: 'collect', count: 60 }, reward: { coins: 3000, xp: 320, food: { cake: 10 } } },
  { id: 'q56', title: '登峰造极', desc: '升到 13 级。', goal: { kind: 'level', level: 13 }, reward: { coins: 2500 } },

  // ---------- 13 级：野餐篮、金蚂蚁像 ----------
  { id: 'q57', title: '丰盛的野餐', desc: '摆一个野餐篮。', goal: { kind: 'own', def: 'picnic', count: 1 }, reward: { coins: 4000 } },
  { id: 'q58', title: '最勤快的蚂蚁', desc: '立一座金蚂蚁像。', goal: { kind: 'own', def: 'statue', count: 1 }, reward: { coins: 3000 } },
  { id: 'q59', title: '虫虫花园', desc: '累计赚到 50000 金币，把花园打理成传奇。', goal: { kind: 'stat', stat: 'coinsEarned', count: 50000 }, reward: { coins: 10000, food: { cake: 20 } } },
];
