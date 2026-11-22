import type { PestDef, PestKind } from '../core/types';

export const PESTS: PestDef[] = [
  { id: 'stink', name: '臭虫', art: 'stink', taps: 3, unlockLevel: 3, rewardXp: 4, rewardCoins: 8 },
  { id: 'antlion', name: '蚁狮', art: 'antlion', taps: 5, unlockLevel: 5, rewardXp: 8, rewardCoins: 20 },
];

export const PEST_BY_ID = Object.fromEntries(PESTS.map((p) => [p.id, p])) as Record<PestKind, PestDef>;

/** 两次害虫出现之间的间隔（秒）：平均两分钟来一只 */
export const PEST_INTERVAL: [number, number] = [80, 160];
export const MAX_PESTS = 2;
