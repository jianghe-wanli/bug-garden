import type { PestDef, PestKind } from '../core/types';

export const PESTS: PestDef[] = [
  { id: 'stink', name: '臭虫', art: 'stink', taps: 3, unlockLevel: 2, rewardXp: 5, rewardCoins: 5 },
  { id: 'antlion', name: '蚁狮', art: 'antlion', taps: 5, unlockLevel: 4, rewardXp: 10, rewardCoins: 12 },
];

export const PEST_BY_ID = Object.fromEntries(PESTS.map((p) => [p.id, p])) as Record<PestKind, PestDef>;

/** 两次害虫出现之间的间隔（秒） */
export const PEST_INTERVAL: [number, number] = [50, 110];
export const MAX_PESTS = 2;
