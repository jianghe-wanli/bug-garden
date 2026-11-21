import type { GameState } from './types';

const SAVE_KEY = 'bug-garden-save-v1';

export function newGame(): GameState {
  return {
    version: 1,
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

export function saveGame(state: GameState, storage: Storage = localStorage): void {
  state.lastSeen = Date.now();
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // 存储已满或被禁用时忽略
  }
}

export function loadGame(storage: Storage = localStorage): GameState | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s?.version !== 1 || !Array.isArray(s.buildings) || !Array.isArray(s.bugs)) return null;
    return { ...newGame(), ...s };
  } catch {
    return null;
  }
}

export function clearSave(storage: Storage = localStorage): void {
  storage.removeItem(SAVE_KEY);
}
