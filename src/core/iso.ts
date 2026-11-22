export const GRID = 12;
export const TW = 96;
export const TH = 48;
/** 美术按 120px 地块宽度设计 */
export const ART_SCALE = TW / 120;

export function gridToWorld(gx: number, gy: number): { x: number; y: number } {
  return { x: ((gx - gy) * TW) / 2, y: ((gx + gy) * TH) / 2 };
}

export function worldToGrid(wx: number, wy: number): { x: number; y: number } {
  const a = wx / (TW / 2);
  const b = wy / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  const g = worldToGrid(wx, wy);
  return { x: Math.round(g.x), y: Math.round(g.y) };
}
