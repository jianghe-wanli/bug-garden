/**
 * 美术清单。每个 key 对应 src/art/svg/<key>.svg。
 * 原点（脚底中心）在 SVG 坐标 (0,0)，由 viewBox 推出锚点；美术按 120px 地块宽度设计。
 * frames：可选的行走/动作帧，文件名为 <key>_<frame>.svg，例如 ant_walk_0.svg。
 */
export interface ArtDef {
  /** viewBox: [minX, minY, width, height] */
  vb: [number, number, number, number];
  /** 额外缩放 */
  scale?: number;
  frames?: Record<string, number>;
}

export const ART: Record<string, ArtDef> = {
  ant: { vb: [-72, -118, 150, 126], scale: 0.62 },
  bee: { vb: [-66, -124, 136, 118], scale: 0.6 },
  stink: { vb: [-48, -136, 96, 142], scale: 0.66 },
  antlion: { vb: [-48, -64, 96, 78], scale: 1 },
  anthouse: { vb: [-76, -170, 152, 176], scale: 1.25 },
  beehive: { vb: [-64, -158, 128, 162], scale: 1.3 },
  daisy: { vb: [-32, -106, 68, 110], scale: 0.85 },
  tulip: { vb: [-30, -92, 60, 96], scale: 0.9 },
  bell: { vb: [-32, -76, 76, 90], scale: 0.95 },
  junk: { vb: [-56, -70, 112, 82], scale: 0.95 },
  pebble: { vb: [-31, -20, 58, 26], scale: 1.2 },
  clover: { vb: [-28, -58, 56, 62], scale: 1.1 },
  fence: { vb: [-44, -50, 88, 54], scale: 1 },
  mushroom: { vb: [-40, -78, 80, 82], scale: 1 },
  sugar: { vb: [-30, -66, 78, 78], scale: 0.6 },
  cookie: { vb: [-28, -40, 56, 44], scale: 0.7 },
  cake: { vb: [-30, -68, 60, 72], scale: 0.7 },
  coin: { vb: [-19, -19, 38, 38], scale: 1 },
  shadow: { vb: [-48, -16, 96, 32] },
  tile_grass0: { vb: [-60, -30, 120, 60] },
  tile_grass1: { vb: [-60, -30, 120, 60] },
  icon_star: { vb: [-18, -18, 36, 36] },
  icon_heart: { vb: [-19, -14, 38, 30] },
  icon_smile: { vb: [-18, -18, 36, 36] },
};

const urls = import.meta.glob('./svg/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** 贴图加载倍率，保证缩放后仍清晰 */
export const TEX_SCALE = 3;

export function artUrl(key: string): string {
  const u = urls[`./svg/${key}.svg`];
  if (!u) throw new Error(`缺少美术资源: ${key}`);
  return u;
}

export function allArtFiles(): { key: string; url: string }[] {
  return Object.entries(urls).map(([path, url]) => ({ key: path.slice('./svg/'.length, -'.svg'.length), url }));
}

export function artOrigin(key: string): { x: number; y: number } {
  const [x, y, w, h] = ART[key].vb;
  return { x: -x / w, y: -y / h };
}
