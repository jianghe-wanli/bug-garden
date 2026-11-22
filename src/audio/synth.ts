import type { SfxName } from '../core/types';

/**
 * 全部音效的合成配方。只依赖 BaseAudioContext，所以既能实时播放，
 * 也能用 OfflineAudioContext 渲染成文件试听（见 tests/tools/audition.html）。
 *
 * 取舍：手机喇叭低于 250Hz 基本出不来、高频又容易刺耳，所以音色集中在 300～2500Hz，
 * 以正弦和三角波为主，起音留几毫秒避免爆音。
 */

export type Ctx = BaseAudioContext;

interface ToneOpts {
  type?: OscillatorType;
  /** 起始频率 */
  f: number;
  /** 滑到的频率 */
  f1?: number;
  /** 滑音用时，默认等于 dur */
  glide?: number;
  t: number;
  dur: number;
  gain: number;
  attack?: number;
  /** 保持满音量的时长，之后才衰减 */
  hold?: number;
  vibrato?: { rate: number; depth: number };
}

const SILENT = 0.0001;

export function tone(ctx: Ctx, dest: AudioNode, o: ToneOpts): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, o.t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, o.t + (o.glide ?? o.dur));
  const attack = o.attack ?? 0.006;
  // 先把初值压到零：否则起播的那一个采样会按默认增益 1 漏出来，听着是一声“啪”
  g.gain.value = 0;
  g.gain.setValueAtTime(SILENT, o.t);
  g.gain.linearRampToValueAtTime(o.gain, o.t + attack);
  if (o.hold) g.gain.setValueAtTime(o.gain, o.t + attack + o.hold);
  g.gain.exponentialRampToValueAtTime(SILENT, o.t + o.dur);
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.setValueAtTime(o.vibrato.rate, o.t);
    depth.gain.setValueAtTime(o.vibrato.depth, o.t);
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(o.t);
    lfo.stop(o.t + o.dur + 0.03);
  }
  osc.connect(g);
  g.connect(dest);
  osc.start(o.t);
  osc.stop(o.t + o.dur + 0.03);
}

/** 小铃铛／钟琴：基音加两个很快消失的泛音 */
export function bell(ctx: Ctx, dest: AudioNode, f: number, t: number, dur: number, gain: number): void {
  tone(ctx, dest, { f, t, dur, gain, attack: 0.004 });
  tone(ctx, dest, { f: f * 2, t, dur: dur * 0.45, gain: gain * 0.28, attack: 0.004 });
  tone(ctx, dest, { f: f * 3.01, t, dur: dur * 0.2, gain: gain * 0.1, attack: 0.003 });
}

const noiseCache = new WeakMap<Ctx, AudioBuffer>();

function noiseBuffer(ctx: Ctx): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // 固定种子，保证每次渲染结果一致
    let s = 22222;
    for (let i = 0; i < data.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      data[i] = s / 2147483648 - 1;
    }
    noiseCache.set(ctx, buf);
  }
  return buf;
}

interface NoiseOpts {
  t: number;
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  f: number;
  f1?: number;
  q?: number;
  attack?: number;
}

export function noise(ctx: Ctx, dest: AudioNode, o: NoiseOpts): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter;
  filter.frequency.setValueAtTime(o.f, o.t);
  if (o.f1) filter.frequency.exponentialRampToValueAtTime(o.f1, o.t + o.dur);
  filter.Q.setValueAtTime(o.q ?? 0.8, o.t);
  const g = ctx.createGain();
  // 先把初值压到零：否则起播的那一个采样会按默认增益 1 漏出来，听着是一声“啪”
  g.gain.value = 0;
  g.gain.setValueAtTime(SILENT, o.t);
  g.gain.linearRampToValueAtTime(o.gain, o.t + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(SILENT, o.t + o.dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  // 从缓冲区的不同位置起播，连续两声不至于一模一样
  src.start(o.t, (o.t * 7.3) % 0.9);
  src.stop(o.t + o.dur + 0.03);
}

export function midi(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** 连续收金币时音高沿五声音阶往上爬 */
const COIN_STEPS = [0, 2, 4, 7, 9, 12];
export const COIN_COMBO_MAX = COIN_STEPS.length - 1;

type Recipe = (ctx: Ctx, dest: AudioNode, t: number, variant: number) => void;

const RECIPES: Record<SfxName, Recipe> = {
  // 轻轻一声“啵”
  tap: (c, d, t) => {
    tone(c, d, { f: 660, f1: 440, t, dur: 0.07, gain: 0.3 });
  },
  // “嘿咻”：两声上扬的短音，出发干活
  assign: (c, d, t) => {
    tone(c, d, { type: 'triangle', f: 520, f1: 780, t, dur: 0.09, gain: 0.2 });
    tone(c, d, { type: 'triangle', f: 700, f1: 1040, t: t + 0.09, dur: 0.11, gain: 0.2 });
  },
  // 落地的闷响加两声木琴
  build: (c, d, t) => {
    noise(c, d, { t, dur: 0.09, gain: 0.22, filter: 'lowpass', f: 500 });
    tone(c, d, { type: 'triangle', f: 330, f1: 165, t, dur: 0.13, gain: 0.3 });
    bell(c, d, midi(79), t + 0.07, 0.25, 0.14);
    bell(c, d, midi(84), t + 0.15, 0.32, 0.14);
  },
  // “叮铃”，连收时一声比一声高
  coin: (c, d, t, v) => {
    const r = Math.pow(2, COIN_STEPS[Math.max(0, Math.min(COIN_COMBO_MAX, v))] / 12);
    bell(c, d, 988 * r, t, 0.12, 0.2);
    bell(c, d, 1319 * r, t + 0.07, 0.36, 0.22);
  },
  // “啊呜啊呜啊呜”三口，再满足地“嗯～”一声
  feed: (c, d, t) => {
    for (let i = 0; i < 3; i++) {
      tone(c, d, { f: 540, f1: 330, t: t + i * 0.11, dur: 0.075, gain: 0.2 });
      noise(c, d, { t: t + i * 0.11, dur: 0.045, gain: 0.07, filter: 'bandpass', f: 1800, q: 2 });
    }
    tone(c, d, { f: 600, f1: 900, t: t + 0.36, dur: 0.16, gain: 0.16, attack: 0.02 });
  },
  // 一串上行琶音，落在一个亮亮的大三和弦上
  levelup: (c, d, t) => {
    [72, 76, 79, 84, 88].forEach((n, i) => bell(c, d, midi(n), t + i * 0.09, 0.5, 0.16));
    [84, 88, 91].forEach((n) => bell(c, d, midi(n), t + 0.5, 1.1, 0.1));
    tone(c, d, { type: 'triangle', f: midi(60), t: t + 0.5, dur: 1.0, gain: 0.12, attack: 0.02 });
    noise(c, d, { t: t + 0.45, dur: 0.7, gain: 0.025, filter: 'highpass', f: 5000, attack: 0.05 });
  },
  // 三连音小号角
  quest: (c, d, t) => {
    [79, 84, 88].forEach((n, i) => bell(c, d, midi(n), t + i * 0.1, 0.4, 0.17));
    bell(c, d, midi(91), t + 0.32, 0.65, 0.17);
    tone(c, d, { type: 'triangle', f: midi(72), t, dur: 0.5, gain: 0.1, attack: 0.02, hold: 0.25 });
  },
  // “唰”地挥一下
  shoo: (c, d, t) => {
    noise(c, d, { t, dur: 0.13, gain: 0.6, filter: 'bandpass', f: 900, f1: 2600, q: 1.2, attack: 0.02 });
    tone(c, d, { f: 1200, f1: 700, t: t + 0.03, dur: 0.07, gain: 0.1 });
  },
  // “呃哦”：两个下行的圆润的音，提醒但不吓人
  pest: (c, d, t) => {
    tone(c, d, { f: midi(67), t, dur: 0.17, gain: 0.2, attack: 0.012, hold: 0.07 });
    tone(c, d, { f: midi(63), f1: midi(62), t: t + 0.19, dur: 0.34, gain: 0.2, attack: 0.012, hold: 0.1, vibrato: { rate: 6, depth: 4 } });
  },
  // 软软的“嘟嘟”
  error: (c, d, t) => {
    tone(c, d, { f: 392, t, dur: 0.08, gain: 0.17, attack: 0.01 });
    tone(c, d, { f: 330, t: t + 0.1, dur: 0.13, gain: 0.17, attack: 0.01 });
  },
  // 滑上去，再撒一把亮晶晶
  upgrade: (c, d, t) => {
    tone(c, d, { type: 'triangle', f: 392, f1: 1568, t, dur: 0.32, gain: 0.1, attack: 0.02, hold: 0.12 });
    [84, 88, 91, 96].forEach((n, i) => bell(c, d, midi(n), t + 0.3 + i * 0.07, 0.4, 0.11));
    noise(c, d, { t: t + 0.28, dur: 0.45, gain: 0.02, filter: 'highpass', f: 5500, attack: 0.04 });
  },
  // 活干完了：远远的一声“叮”，比收金币轻
  ready: (c, d, t) => {
    bell(c, d, midi(86), t, 0.3, 0.13);
    bell(c, d, midi(91), t + 0.06, 0.3, 0.06);
  },
  // 蚂蚁被抓：“咿！咿！”再往下掉
  trapped: (c, d, t) => {
    tone(c, d, { f: 940, f1: 720, t, dur: 0.1, gain: 0.13, attack: 0.01 });
    tone(c, d, { f: 940, f1: 720, t: t + 0.13, dur: 0.1, gain: 0.13, attack: 0.01 });
    tone(c, d, { f: 640, f1: 380, t: t + 0.27, dur: 0.24, gain: 0.14, attack: 0.01, vibrato: { rate: 12, depth: 14 } });
  },
  // 害虫灰溜溜跑掉：滑哨往下，末尾弹一下
  flee: (c, d, t) => {
    tone(c, d, { f: 1100, f1: 320, t, dur: 0.34, gain: 0.18, attack: 0.02, hold: 0.2 });
    tone(c, d, { type: 'triangle', f: 320, f1: 520, t: t + 0.36, dur: 0.1, gain: 0.14 });
  },
  // 买东西：两下硬币碰撞加一声“叮”
  buy: (c, d, t) => {
    noise(c, d, { t, dur: 0.025, gain: 0.1, filter: 'highpass', f: 4000, attack: 0.002 });
    noise(c, d, { t: t + 0.06, dur: 0.025, gain: 0.1, filter: 'highpass', f: 4000, attack: 0.002 });
    bell(c, d, 1319, t + 0.1, 0.28, 0.15);
  },
  // 收起建筑：“噗噜”一声缩回去
  sell: (c, d, t) => {
    tone(c, d, { f: 620, f1: 300, t, dur: 0.13, gain: 0.26 });
    bell(c, d, 660, t + 0.11, 0.22, 0.09);
  },
};

export const SFX_NAMES = Object.keys(RECIPES) as SfxName[];

/** 各音效的大致时长（秒），用于离线渲染 */
export const SFX_LENGTH: Record<SfxName, number> = {
  tap: 0.15, assign: 0.3, build: 0.6, coin: 0.55, feed: 0.65, levelup: 1.8, quest: 1.1, shoo: 0.25,
  pest: 0.65, error: 0.35, upgrade: 1.0, ready: 0.45, trapped: 0.6, flee: 0.55, buy: 0.5, sell: 0.45,
};

export function playSfx(ctx: Ctx, dest: AudioNode, name: SfxName, t: number, variant = 0): void {
  RECIPES[name]?.(ctx, dest, t, variant);
}
