import type { FoodDef } from '../core/types';

export const FOODS: FoodDef[] = [
  { id: 'sugar', name: '方糖', art: 'sugar', cost: 8, energy: 30, unlockLevel: 1 },
  { id: 'cookie', name: '曲奇', art: 'cookie', cost: 18, energy: 70, unlockLevel: 3 },
  { id: 'cake', name: '糕饼', art: 'cake', cost: 24, energy: 100, unlockLevel: 5 },
];

export const FOOD_BY_ID: Record<string, FoodDef> = Object.fromEntries(FOODS.map((f) => [f.id, f]));
