import type { GameState } from './types';

const SAVE_KEY = 'bug-garden-save-v1';

export function newGame(): GameState {
  return {
    version: 2,
    coins: 150,
    xp: 0,
    level: 1,
    food: { sugar: 3 },
    buildings: [],
    bugs: [],
    pests: [],
    nextUid: 1,
    quest: { index: 0, base: 0 },
    stats: {},
    pestTimer: 60,
    lastSeen: Date.now(),
    settings: { muted: false },
  };
}

export function saveGame(state: GameState, storage?: Storage): void {
  state.lastSeen = Date.now();
  try {
    (storage ?? localStorage).setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // 存储已满或被禁用时忽略
  }
}

export function loadGame(storage?: Storage): GameState | null {
  // 隐私模式下访问 localStorage 本身就可能抛错，所以放在 try 里取
  try {
    const raw = (storage ?? localStorage).getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    const v = (s as { version?: number } | null)?.version;
    if ((v !== 1 && v !== 2) || !Array.isArray(s.buildings) || !Array.isArray(s.bugs)) return null;
    // 第 1 版存档的任务链已被替换：花园原样保留，任务从头对一遍（已达成的会自动跳过）
    if (v === 1) return { ...newGame(), ...s, version: 2, quest: { index: 0, base: 0 } };
    return { ...newGame(), ...s };
  } catch {
    return null;
  }
}

export function clearSave(storage?: Storage): void {
  try {
    (storage ?? localStorage).removeItem(SAVE_KEY);
  } catch {
    // 存储被禁用时没有存档可清
  }
}
