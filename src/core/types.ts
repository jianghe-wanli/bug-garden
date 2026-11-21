export type BugKind = 'ant' | 'bee';
export type PestKind = 'stink' | 'antlion';
export type BuildingCategory = 'home' | 'work' | 'decor';

export interface BuildingDef {
  id: string;
  name: string;
  desc: string;
  category: BuildingCategory;
  /** 美术资源 key，见 src/art/manifest.ts */
  art: string;
  w: number;
  h: number;
  cost: number;
  unlockLevel: number;
  buildXp: number;
  /** 住宅：capacity[i] 为 i+1 级的容量，upgradeCost[i] 为升到 i+2 级的花费 */
  home?: { bug: BugKind; capacity: number[]; upgradeCost: number[] };
  /** 工作点：duration 秒，energy 为每次工作消耗的体力 */
  work?: { bug: BugKind; duration: number; coins: number; xp: number; energy: number };
  decor?: { happiness: number };
}

export interface FoodDef {
  id: string;
  name: string;
  art: string;
  cost: number;
  energy: number;
  unlockLevel: number;
}

export interface PestDef {
  id: PestKind;
  name: string;
  art: string;
  taps: number;
  unlockLevel: number;
  rewardXp: number;
  rewardCoins: number;
}

export type QuestGoal =
  /** 自任务开始后，某项统计累计增加 count（统计项见 sim.ts 的 bumpStat） */
  | { kind: 'stat'; stat: string; count: number }
  /** 达到等级 */
  | { kind: 'level'; level: number }
  /** 当前拥有某建筑 count 个 */
  | { kind: 'own'; def: string; count: number };

export interface QuestDef {
  id: string;
  title: string;
  desc: string;
  goal: QuestGoal;
  reward: { coins?: number; xp?: number; food?: Record<string, number> };
}

export interface Job {
  bugUid: number;
  remaining: number;
  total: number;
}

export interface PlacedBuilding {
  uid: number;
  def: string;
  x: number;
  y: number;
  level: number;
  job: Job | null;
  ready: { coins: number; xp: number } | null;
}

export type BugState = 'idle' | 'toWork' | 'working' | 'toHome' | 'trapped';

export interface Bug {
  uid: number;
  kind: BugKind;
  homeUid: number;
  /** 网格坐标（浮点） */
  x: number;
  y: number;
  tx: number;
  ty: number;
  energy: number;
  state: BugState;
  targetUid: number | null;
  /** 被哪只蚁狮困住 */
  trapUid: number | null;
  wait: number;
}

export interface Pest {
  uid: number;
  kind: PestKind;
  x: number;
  y: number;
  tx: number;
  ty: number;
  hp: number;
  state: 'approach' | 'pester' | 'flee';
  targetUid: number | null;
  timer: number;
}

export interface GameState {
  version: 1;
  coins: number;
  xp: number;
  level: number;
  food: Record<string, number>;
  buildings: PlacedBuilding[];
  bugs: Bug[];
  pests: Pest[];
  nextUid: number;
  quest: { index: number; base: number };
  stats: Record<string, number>;
  pestTimer: number;
  lastSeen: number;
  settings: { muted: boolean };
}

export type GameEvent =
  | { type: 'coins'; amount: number; x: number; y: number }
  | { type: 'xp'; amount: number }
  | { type: 'levelup'; level: number }
  | { type: 'quest'; quest: QuestDef }
  | { type: 'toast'; text: string }
  | { type: 'sfx'; name: SfxName }
  | { type: 'pest'; kind: PestKind }
  | { type: 'changed' };

export type SfxName =
  | 'tap' | 'build' | 'coin' | 'feed' | 'levelup' | 'quest' | 'shoo' | 'pest' | 'error' | 'assign' | 'upgrade';
