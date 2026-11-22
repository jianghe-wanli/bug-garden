/** XP_TO_NEXT[i]：从 i+1 级升到 i+2 级需要的经验 */
export const XP_TO_NEXT: number[] = [120, 250, 520, 920, 1550, 2800, 4400, 6800, 11500, 16500, 22000, 27000];

export const MAX_LEVEL = XP_TO_NEXT.length + 1;

/** 升级奖励金币：够买一件刚解锁的小东西，但不够把新东西买齐 */
export function levelUpCoins(level: number): number {
  return 30 * level + 5 * level * level;
}
