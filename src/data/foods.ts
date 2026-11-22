import type { FoodDef } from '../core/types';

/** 每点体力的价格：方糖 0.27、曲奇 0.24、糕饼 0.22，越高级越划算，也越省点击 */
export const FOODS: FoodDef[] = [
  { id: 'sugar', name: '方糖', art: 'sugar', cost: 8, energy: 30, unlockLevel: 1 },
  { id: 'cookie', name: '曲奇', art: 'cookie', cost: 16, energy: 66, unlockLevel: 3 },
  { id: 'cake', name: '糕饼', art: 'cake', cost: 22, energy: 100, unlockLevel: 6 },
];

export const FOOD_BY_ID: Record<string, FoodDef> = Object.fromEntries(FOODS.map((f) => [f.id, f]));
