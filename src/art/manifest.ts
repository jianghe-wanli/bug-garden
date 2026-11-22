/**
 * 美术清单。每个 key 对应 src/art/svg/<key>.svg。
 * 原点（脚底中心）在 SVG 坐标 (0,0)，由 viewBox 推出锚点；美术按 120px 地块宽度设计。
 * 动画帧见下方 ANIMS，文件名为 <key>_<clip>_<帧号>.svg，例如 ant_walk_0.svg。
 * 贴图由 gen.mjs 生成（node src/art/gen.mjs），改画请改生成脚本。
 */
export interface ArtDef {
  /** viewBox: [minX, minY, width, height] */
  vb: [number, number, number, number];
  /** 额外缩放 */
  scale?: number;
}

export const ART: Record<string, ArtDef> = {
  ant: { vb: [-72, -118, 150, 126], scale: 0.62 },
  bee: { vb: [-66, -124, 136, 118], scale: 0.6 },
  stink: { vb: [-48, -136, 96, 142], scale: 0.66 },
  antlion: { vb: [-66, -92, 132, 112], scale: 1 },
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
  sugar: { vb: [-34, -68, 84, 82], scale: 0.6 },
  cookie: { vb: [-28, -40, 56, 44], scale: 0.7 },
  cake: { vb: [-30, -68, 60, 72], scale: 0.7 },
  coin: { vb: [-19, -19, 38, 38], scale: 1 },
  shadow: { vb: [-48, -16, 96, 32] },
  tile_grass0: { vb: [-60, -30, 120, 60] },
  tile_grass1: { vb: [-60, -30, 120, 60] },
  icon_star: { vb: [-18, -18, 36, 36] },
  icon_heart: { vb: [-19, -14, 38, 30] },
  icon_smile: { vb: [-18, -18, 36, 36] },
  // 建筑等级外观：<key>_<level>，1 级沿用 <key>
  anthouse_2: { vb: [-90, -172, 202, 182], scale: 1.25 },
  anthouse_3: { vb: [-102, -204, 216, 216], scale: 1.25 },
  beehive_2: { vb: [-70, -186, 152, 198], scale: 1.3 },
  beehive_3: { vb: [-96, -206, 188, 220], scale: 1.3 },
  // 特效
  fx_spark: { vb: [-14, -14, 28, 28] },
  fx_star: { vb: [-16, -16, 32, 32] },
  fx_puff: { vb: [-20, -16, 40, 30] },
  fx_heart: { vb: [-14, -13, 28, 26] },
  fx_leaf: { vb: [-12, -10, 24, 20] },
  fx_stink: { vb: [-12, -16, 24, 32] },
  fx_alert: { vb: [-14, -22, 28, 40] },
  // 花园边缘
  env_tuft: { vb: [-26, -40, 52, 44] },
  env_bush: { vb: [-58, -70, 116, 76] },
  env_leaf: { vb: [-64, -84, 128, 90] },
  env_reed: { vb: [-30, -112, 60, 116] },
  env_rock: { vb: [-42, -44, 84, 50] },
  env_bloom: { vb: [-22, -44, 44, 48] },
};

/** 动画：同一角色的所有帧共用一个 viewBox，切帧只换贴图。clips 的值是 [帧数, 每秒帧数]。 */
export interface AnimDef {
  vb: [number, number, number, number];
  scale: number;
  clips: Record<string, [number, number]>;
}

export const ANIMS: Record<string, AnimDef> = {
  ant: { vb: [-80, -128, 172, 140], scale: 0.62, clips: { walk: [6, 14], idle: [4, 3], work: [4, 8], trapped: [4, 10] } },
  bee: { vb: [-82, -136, 168, 142], scale: 0.6, clips: { fly: [4, 18], work: [4, 9] } },
  stink: { vb: [-56, -140, 112, 146], scale: 0.66, clips: { walk: [4, 8], pester: [4, 5], flee: [2, 12] } },
  antlion: { vb: [-66, -92, 132, 112], scale: 1, clips: { bite: [4, 5] } },
};

export function frameKey(key: string, clip: string, frame: number): string {
  return `${key}_${clip}_${frame}`;
}

/** 建筑在某等级下使用的贴图键，没有专门画的等级回退到基础键 */
export function levelArt(key: string, level: number): string {
  const k = `${key}_${level}`;
  return ART[k] ? k : key;
}

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
  const [x, y, w, h] = (ART[key] ?? ANIMS[key]).vb;
  return { x: -x / w, y: -y / h };
}
