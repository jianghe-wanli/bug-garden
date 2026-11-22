import type { BuildingDef } from '../core/types';

/**
 * 数值思路（验证见 tests/balance.test.ts）：
 * - 蚂蚁线干得快、单次少，适合一直点；蜜蜂线干得久、单次多。两条线隔级交替解锁。
 * - 每高一档，耗时约翻倍、单次金币略多于翻倍，所以新工作点的好处是“点一下赚得更多”。
 * - 工作点的回本次数随档次拉长（杂物堆约 3 次，野餐篮约 18 次）：前期买得痛快，后期总有东西要攒钱。
 * - 装饰越高级越省地方，但每点快乐更贵；地块有限，虫多了就得换高级装饰。
 */
export const BUILDINGS: BuildingDef[] = [
  // ---------- 住宅 ----------
  {
    id: 'anthouse', name: '橡果蚁窝', desc: '蚂蚁的家，建成后有蚂蚁入住。', category: 'home', art: 'anthouse',
    w: 2, h: 2, cost: 60, unlockLevel: 1, buildXp: 10,
    home: { bug: 'ant', capacity: [2, 3, 4], upgradeCost: [150, 420] },
  },
  {
    id: 'beehive', name: '草编蜂房', desc: '蜜蜂的家，建成后有蜜蜂入住。', category: 'home', art: 'beehive',
    w: 2, h: 2, cost: 120, unlockLevel: 2, buildXp: 16,
    home: { bug: 'bee', capacity: [2, 3, 4], upgradeCost: [240, 600] },
  },
  {
    id: 'stumpfort', name: '树桩蚁堡', desc: '老树桩里的大蚁窝，住得下一大家子蚂蚁。', category: 'home', art: 'stumpfort',
    w: 2, h: 2, cost: 2500, unlockLevel: 7, buildXp: 80,
    home: { bug: 'ant', capacity: [4, 5, 6], upgradeCost: [3000, 5000] },
  },
  {
    id: 'gourdhive', name: '葫芦蜂巢', desc: '挂在藤上的大葫芦，住得下一大群蜜蜂。', category: 'home', art: 'gourdhive',
    w: 2, h: 2, cost: 4500, unlockLevel: 9, buildXp: 120,
    home: { bug: 'bee', capacity: [4, 5, 6], upgradeCost: [5000, 8000] },
  },

  // ---------- 蚂蚁的工作点 ----------
  {
    id: 'junk', name: '杂物堆', desc: '蚂蚁在这里翻找宝贝，换成金币。', category: 'work', art: 'junk',
    w: 1, h: 1, cost: 30, unlockLevel: 1, buildXp: 6,
    work: { bug: 'ant', duration: 15, coins: 12, xp: 3, energy: 12 },
  },
  {
    id: 'crumbs', name: '饼干屑', desc: '野餐掉下来的饼干屑，蚂蚁一趟趟往回搬。', category: 'work', art: 'crumbs',
    w: 1, h: 1, cost: 110, unlockLevel: 3, buildXp: 10,
    work: { bug: 'ant', duration: 30, coins: 26, xp: 6, energy: 15 },
  },
  {
    id: 'leafpile', name: '落叶堆', desc: '落叶底下藏着不少好东西，要多翻一会儿。', category: 'work', art: 'leafpile',
    w: 1, h: 1, cost: 600, unlockLevel: 5, buildXp: 18,
    work: { bug: 'ant', duration: 60, coins: 56, xp: 11, energy: 20 },
  },
  {
    id: 'berry', name: '野莓丛', desc: '熟透的野莓，蚂蚁合力扛回家。', category: 'work', art: 'berry',
    w: 1, h: 1, cost: 1600, unlockLevel: 7, buildXp: 32,
    work: { bug: 'ant', duration: 120, coins: 120, xp: 20, energy: 25 },
  },
  {
    id: 'pinecone', name: '松果堆', desc: '掰开松果取松子，费工夫但很值钱。', category: 'work', art: 'pinecone',
    w: 1, h: 1, cost: 3600, unlockLevel: 9, buildXp: 55,
    work: { bug: 'ant', duration: 240, coins: 255, xp: 36, energy: 32 },
  },
  {
    id: 'tincan', name: '旧铁罐', desc: '谁丢下的铁罐头，里面全是宝贝。', category: 'work', art: 'tincan',
    w: 1, h: 1, cost: 8600, unlockLevel: 11, buildXp: 90,
    work: { bug: 'ant', duration: 480, coins: 540, xp: 64, energy: 40 },
  },
  {
    id: 'picnic', name: '野餐篮', desc: '一整篮好吃的，够蚂蚁忙上大半天。', category: 'work', art: 'picnic',
    w: 1, h: 1, cost: 20000, unlockLevel: 13, buildXp: 140,
    work: { bug: 'ant', duration: 900, coins: 1100, xp: 110, energy: 50 },
  },

  // ---------- 蜜蜂的工作点 ----------
  {
    id: 'daisy', name: '雏菊', desc: '蜜蜂在这里采蜜。', category: 'work', art: 'daisy',
    w: 1, h: 1, cost: 60, unlockLevel: 2, buildXp: 8,
    work: { bug: 'bee', duration: 25, coins: 22, xp: 5, energy: 14 },
  },
  {
    id: 'tulip', name: '郁金香', desc: '花蜜更多，采得也更久。', category: 'work', art: 'tulip',
    w: 1, h: 1, cost: 300, unlockLevel: 4, buildXp: 14,
    work: { bug: 'bee', duration: 45, coins: 42, xp: 9, energy: 17 },
  },
  {
    id: 'bell', name: '风铃草', desc: '稀有的小花，蜜又香又浓。', category: 'work', art: 'bell',
    w: 1, h: 1, cost: 1100, unlockLevel: 6, buildXp: 24,
    work: { bug: 'bee', duration: 90, coins: 88, xp: 15, energy: 22 },
  },
  {
    id: 'sunflower', name: '向日葵', desc: '大大的花盘，够蜜蜂采上好一阵。', category: 'work', art: 'sunflower',
    w: 1, h: 1, cost: 2500, unlockLevel: 8, buildXp: 42,
    work: { bug: 'bee', duration: 180, coins: 185, xp: 28, energy: 28 },
  },
  {
    id: 'lavender', name: '薰衣草', desc: '一串串紫色小花，酿出的蜜特别值钱。', category: 'work', art: 'lavender',
    w: 1, h: 1, cost: 5800, unlockLevel: 10, buildXp: 70,
    work: { bug: 'bee', duration: 360, coins: 390, xp: 50, energy: 36 },
  },
  {
    id: 'rose', name: '玫瑰', desc: '花园里最娇贵的花，蜜也最金贵。', category: 'work', art: 'rose',
    w: 1, h: 1, cost: 14000, unlockLevel: 12, buildXp: 115,
    work: { bug: 'bee', duration: 720, coins: 820, xp: 88, energy: 45 },
  },

  // ---------- 装饰 ----------
  {
    id: 'pebble', name: '小石子', desc: '装饰，让虫虫更开心。', category: 'decor', art: 'pebble',
    w: 1, h: 1, cost: 15, unlockLevel: 1, buildXp: 2, decor: { happiness: 1 },
  },
  {
    id: 'clover', name: '三叶草', desc: '装饰，让虫虫更开心。', category: 'decor', art: 'clover',
    w: 1, h: 1, cost: 40, unlockLevel: 2, buildXp: 4, decor: { happiness: 3 },
  },
  {
    id: 'fence', name: '小树枝篱笆', desc: '装饰，让虫虫更开心。', category: 'decor', art: 'fence',
    w: 1, h: 1, cost: 80, unlockLevel: 3, buildXp: 6, decor: { happiness: 5 },
  },
  {
    id: 'dandelion', name: '蒲公英', desc: '毛茸茸的小绒球，风一吹就想跟着飞。', category: 'decor', art: 'dandelion',
    w: 1, h: 1, cost: 160, unlockLevel: 4, buildXp: 9, decor: { happiness: 8 },
  },
  {
    id: 'mushroom', name: '红蘑菇', desc: '下雨天可以躲在伞盖下面。', category: 'decor', art: 'mushroom',
    w: 1, h: 1, cost: 300, unlockLevel: 5, buildXp: 12, decor: { happiness: 12 },
  },
  {
    id: 'shell', name: '蜗牛壳', desc: '蜗牛搬家留下的空壳，摆着很气派。', category: 'decor', art: 'shell',
    w: 1, h: 1, cost: 520, unlockLevel: 6, buildXp: 16, decor: { happiness: 17 },
  },
  {
    id: 'lantern', name: '萤火灯', desc: '装着萤火虫的小灯笼，晚上亮晶晶。', category: 'decor', art: 'lantern',
    w: 1, h: 1, cost: 900, unlockLevel: 7, buildXp: 22, decor: { happiness: 24 },
  },
  {
    id: 'pond', name: '露珠池塘', desc: '一汪清亮的小水洼，虫虫爱来这儿喝水。', category: 'decor', art: 'pond',
    w: 2, h: 2, cost: 5000, unlockLevel: 8, buildXp: 60, decor: { happiness: 120 },
  },
  {
    id: 'swing', name: '草叶秋千', desc: '两根草茎拴一片叶子，荡起来可高了。', category: 'decor', art: 'swing',
    w: 1, h: 1, cost: 2000, unlockLevel: 9, buildXp: 36, decor: { happiness: 40 },
  },
  {
    id: 'fountain', name: '花瓣喷泉', desc: '水珠从花瓣上一层层淌下来。', category: 'decor', art: 'fountain',
    w: 2, h: 2, cost: 12000, unlockLevel: 10, buildXp: 110, decor: { happiness: 200 },
  },
  {
    id: 'windmill', name: '纸风车', desc: '呼啦啦转个不停，老远就能看见。', category: 'decor', art: 'windmill',
    w: 1, h: 1, cost: 4500, unlockLevel: 11, buildXp: 60, decor: { happiness: 64 },
  },
  {
    id: 'rainbow', name: '彩虹拱门', desc: '七种花瓣搭成的拱门，花园的门面。', category: 'decor', art: 'rainbow',
    w: 2, h: 2, cost: 28000, unlockLevel: 12, buildXp: 200, decor: { happiness: 340 },
  },
  {
    id: 'statue', name: '金蚂蚁像', desc: '纪念花园里最勤快的那只蚂蚁。', category: 'decor', art: 'statue',
    w: 1, h: 1, cost: 12000, unlockLevel: 13, buildXp: 130, decor: { happiness: 120 },
  },
];

export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
