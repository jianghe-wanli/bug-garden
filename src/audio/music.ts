import { type Ctx, midi, noise, tone } from './synth';

/**
 * 背景音乐《花园小步舞》：C 大调，每分钟 100 拍，16 小节一循环（约 38 秒），带一点摇摆。
 * 四个声部：拇指琴旋律、尤克里里式的“嘭-恰”伴奏、柔和的低音、很轻的沙锤和木鱼。
 * 奇数遍旋律换成低八度的笛子，听久了不腻。全部按拍调度，随时可以停。
 */

export const BPM = 100;
export const BEAT = 60 / BPM;
export const BEATS_PER_BAR = 4;
export const LOOP_BARS = 16;
export const LOOP_BEATS = LOOP_BARS * BEATS_PER_BAR;
export const LOOP_SECONDS = LOOP_BEATS * BEAT;

/** 八分音符的后半拍往后拖一点 */
const SWING = 0.08;

interface Chord {
  bass: number;
  tones: [number, number, number];
}

const C: Chord = { bass: 48, tones: [60, 64, 67] };
const Am: Chord = { bass: 45, tones: [57, 60, 64] };
const F: Chord = { bass: 41, tones: [57, 60, 65] };
const G: Chord = { bass: 43, tones: [59, 62, 67] };

/** 每半小节一个和弦 */
const CHORDS: Chord[] = [
  C, C, Am, Am, F, F, G, G,
  C, C, Am, Am, F, F, G, G,
  F, F, C, C, F, F, G, G,
  C, C, Am, Am, F, G, C, C,
];

/** 旋律：每小节一组 [拍, 音高, 时值（拍）] */
const MELODY: [number, number, number][][] = [
  [[0, 76, 1], [1, 79, 0.5], [1.5, 76, 0.5], [2, 72, 1], [3, 74, 0.5], [3.5, 76, 0.5]],
  [[0, 84, 1], [1, 81, 1], [2, 79, 1], [3, 76, 1]],
  [[0, 77, 0.5], [0.5, 81, 0.5], [1, 84, 1], [2, 81, 1], [3, 77, 1]],
  [[0, 79, 1.5], [1.5, 74, 0.5], [2, 74, 0.5], [2.5, 76, 0.5], [3, 74, 1]],
  [[0, 76, 1], [1, 79, 0.5], [1.5, 76, 0.5], [2, 72, 1], [3, 76, 0.5], [3.5, 79, 0.5]],
  [[0, 81, 1], [1, 84, 1], [2, 81, 0.5], [2.5, 79, 0.5], [3, 76, 1]],
  [[0, 77, 1], [1, 81, 0.5], [1.5, 79, 0.5], [2, 77, 1], [3, 76, 0.5], [3.5, 74, 0.5]],
  [[0, 74, 1], [1, 79, 1], [2, 67, 0.5], [2.5, 69, 0.5], [3, 71, 0.5], [3.5, 74, 0.5]],
  [[0, 84, 1.5], [1.5, 81, 0.5], [2, 77, 1], [3, 81, 1]],
  [[0, 79, 1.5], [1.5, 76, 0.5], [2, 72, 1], [3, 76, 1]],
  [[0, 81, 0.5], [0.5, 81, 0.5], [1, 84, 0.5], [1.5, 81, 0.5], [2, 77, 1], [3, 81, 1]],
  [[0, 79, 2], [2, 83, 0.5], [2.5, 81, 0.5], [3, 79, 1]],
  [[0, 76, 1], [1, 79, 0.5], [1.5, 76, 0.5], [2, 72, 1], [3, 74, 0.5], [3.5, 76, 0.5]],
  [[0, 84, 1], [1, 81, 1], [2, 76, 1], [3, 81, 1]],
  [[0, 77, 0.5], [0.5, 81, 0.5], [1, 84, 1], [2, 83, 0.5], [2.5, 79, 0.5], [3, 74, 1]],
  [[0, 72, 1.5], [2, 76, 0.5], [2.5, 79, 0.5], [3, 84, 1]],
];

function swung(beat: number): number {
  return beat % 1 === 0.5 ? beat + SWING : beat;
}

function kalimba(ctx: Ctx, dest: AudioNode, note: number, t: number, dur: number, gain: number): void {
  const f = midi(note);
  tone(ctx, dest, { f, t, dur: Math.max(0.45, dur), gain, attack: 0.008 });
  tone(ctx, dest, { f: f * 2, t, dur: 0.14, gain: gain * 0.12, attack: 0.004 });
}

function flute(ctx: Ctx, dest: AudioNode, note: number, t: number, dur: number, gain: number): void {
  const f = midi(note);
  tone(ctx, dest, { f, t, dur: dur + 0.12, gain, attack: 0.04, hold: dur * 0.6, vibrato: { rate: 5, depth: f * 0.004 } });
  tone(ctx, dest, { type: 'triangle', f, t, dur: dur + 0.08, gain: gain * 0.25, attack: 0.05, hold: dur * 0.5 });
}

function pluck(ctx: Ctx, dest: AudioNode, note: number, t: number, gain: number): void {
  tone(ctx, dest, { type: 'triangle', f: midi(note), t, dur: 0.28, gain, attack: 0.004 });
}

function bass(ctx: Ctx, dest: AudioNode, note: number, t: number, dur: number, gain: number): void {
  const f = midi(note);
  // 基音给耳机，高八度给手机喇叭
  tone(ctx, dest, { type: 'triangle', f, t, dur, gain, attack: 0.01 });
  tone(ctx, dest, { f: f * 2, t, dur: dur * 0.8, gain: gain * 0.7, attack: 0.01 });
}

/** 调度从曲首算起第 beat 拍（从 0 开始，可以无限增长）上的所有音符，t 为这一拍的时刻 */
export function scheduleBeat(ctx: Ctx, dest: AudioNode, beat: number, t: number): void {
  const pass = Math.floor(beat / LOOP_BEATS);
  const inLoop = beat % LOOP_BEATS;
  const bar = Math.floor(inLoop / BEATS_PER_BAR);
  const b = inLoop % BEATS_PER_BAR;
  const chord = CHORDS[bar * 2 + (b >= 2 ? 1 : 0)];
  const at = (x: number): number => t + (swung(x) - b) * BEAT;

  // 低音：一、三拍
  if (b === 0) bass(ctx, dest, chord.bass, t, BEAT * 1.6, 0.13);
  if (b === 2) bass(ctx, dest, chord.bass + (chord === CHORDS[bar * 2] ? 7 : 0), t, BEAT * 1.2, 0.1);

  // 伴奏：正拍一个根音，后半拍两个音轻轻扫一下
  pluck(ctx, dest, chord.tones[0], t, 0.05);
  pluck(ctx, dest, chord.tones[1], at(b + 0.5), 0.04);
  pluck(ctx, dest, chord.tones[2], at(b + 0.5) + 0.018, 0.04);

  // 打击：后半拍沙锤，二、四拍木鱼
  noise(ctx, dest, { t: at(b + 0.5), dur: 0.05, gain: 0.018, filter: 'highpass', f: 6500, attack: 0.004 });
  if (b === 1 || b === 3) tone(ctx, dest, { f: 880, f1: 700, t, dur: 0.05, gain: 0.035, attack: 0.002 });

  // 旋律
  for (const [mb, note, len] of MELODY[bar]) {
    if (Math.floor(mb) !== b) continue;
    if (pass % 2 === 0) kalimba(ctx, dest, note, at(mb), len * BEAT, 0.09);
    else flute(ctx, dest, note - 12, at(mb), len * BEAT * 0.9, 0.085);
  }
}

/** 一次性调度若干拍，离线渲染用 */
export function scheduleBeats(ctx: Ctx, dest: AudioNode, t0: number, beats: number): void {
  for (let i = 0; i < beats; i++) scheduleBeat(ctx, dest, i, t0 + i * BEAT);
}

const LOOKAHEAD = 0.35;
const TICK_MS = 100;

/** 实时播放：用定时器提前一小段把接下来的拍子排进去 */
export class MusicPlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private beat = 0;
  private nextTime = 0;
  private out: GainNode;

  constructor(private ctx: Ctx, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
  }

  get playing(): boolean {
    return this.timer != null;
  }

  start(): void {
    if (this.timer != null) return;
    const now = this.ctx.currentTime;
    this.nextTime = now + 0.12;
    // 从当前小节的开头接着放，而不是从半拍中间
    this.beat -= this.beat % BEATS_PER_BAR;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(1, now + 0.6);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop(): void {
    if (this.timer == null) return;
    clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + 0.08);
  }

  private tick(): void {
    const now = this.ctx.currentTime;
    // 定时器被系统拖慢后不补放落下的拍子
    if (this.nextTime < now) this.nextTime = now + 0.05;
    while (this.nextTime < now + LOOKAHEAD) {
      scheduleBeat(this.ctx, this.out, this.beat, this.nextTime);
      this.beat += 1;
      this.nextTime += BEAT;
    }
  }
}
