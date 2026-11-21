/** XP_TO_NEXT[i]：从 i+1 级升到 i+2 级需要的经验 */
export const XP_TO_NEXT: number[] = [45, 80, 130, 220, 340, 500, 720, 1000, 1400, 1900, 2600, 3500];

export const MAX_LEVEL = XP_TO_NEXT.length + 1;

/** 升级奖励金币 */
export function levelUpCoins(level: number): number {
  return 40 + level * 20;
}
