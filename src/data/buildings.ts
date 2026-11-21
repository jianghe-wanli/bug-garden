import type { BuildingDef } from '../core/types';

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'anthouse', name: '橡果蚁窝', desc: '蚂蚁的家，建成后有蚂蚁入住。', category: 'home', art: 'anthouse',
    w: 2, h: 2, cost: 60, unlockLevel: 1, buildXp: 10,
    home: { bug: 'ant', capacity: [2, 3, 4], upgradeCost: [150, 400] },
  },
  {
    id: 'beehive', name: '草编蜂房', desc: '蜜蜂的家，建成后有蜜蜂入住。', category: 'home', art: 'beehive',
    w: 2, h: 2, cost: 140, unlockLevel: 2, buildXp: 16,
    home: { bug: 'bee', capacity: [2, 3, 4], upgradeCost: [260, 600] },
  },
  {
    id: 'junk', name: '杂物堆', desc: '蚂蚁在这里翻找宝贝，换成金币。', category: 'work', art: 'junk',
    w: 1, h: 1, cost: 30, unlockLevel: 1, buildXp: 6,
    work: { bug: 'ant', duration: 20, coins: 14, xp: 4, energy: 18 },
  },
  {
    id: 'daisy', name: '雏菊', desc: '蜜蜂在这里采蜜。', category: 'work', art: 'daisy',
    w: 1, h: 1, cost: 60, unlockLevel: 2, buildXp: 8,
    work: { bug: 'bee', duration: 35, coins: 30, xp: 7, energy: 20 },
  },
  {
    id: 'tulip', name: '郁金香', desc: '花蜜更多，采得也更久。', category: 'work', art: 'tulip',
    w: 1, h: 1, cost: 160, unlockLevel: 4, buildXp: 14,
    work: { bug: 'bee', duration: 60, coins: 62, xp: 13, energy: 24 },
  },
  {
    id: 'bell', name: '风铃草', desc: '稀有的花，收益最高。', category: 'work', art: 'bell',
    w: 1, h: 1, cost: 380, unlockLevel: 6, buildXp: 24,
    work: { bug: 'bee', duration: 120, coins: 150, xp: 28, energy: 30 },
  },
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
    w: 1, h: 1, cost: 70, unlockLevel: 3, buildXp: 5, decor: { happiness: 5 },
  },
  {
    id: 'mushroom', name: '红蘑菇', desc: '装饰，让虫虫更开心。', category: 'decor', art: 'mushroom',
    w: 1, h: 1, cost: 180, unlockLevel: 5, buildXp: 10, decor: { happiness: 12 },
  },
];

export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
