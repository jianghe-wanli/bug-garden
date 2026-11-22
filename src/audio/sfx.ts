import type { SfxName } from '../core/types';
import { createMix } from './mix';
import { MusicPlayer } from './music';
import { COIN_COMBO_MAX, playSfx } from './synth';

/** 音效接口。实现用 WebAudio 实时合成，不加载任何音频文件。 */
export interface Sfx {
  play(name: SfxName): void;
  /** 静音同时管住音效和背景音乐 */
  setMuted(muted: boolean): void;
  /** 首次用户交互后调用，用于解锁浏览器音频 */
  unlock(): void;
}

/** 运行环境，测试时可以替换 */
export interface AudioEnv {
  createContext(): AudioContext | null;
  doc: Pick<Document, 'hidden' | 'addEventListener'> | null;
  win: Pick<Window, 'addEventListener'> | null;
}

/** 同一个音效在这么短的时间内重复触发就丢掉，免得叠成一声巨响 */
const MIN_GAP = 0.04;
const COIN_COMBO_WINDOW = 1.6;
/** 浏览器只认这些事件里的操作为“用户手势”；iOS Safari 不认 pointerdown/touchstart */
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;

function browserEnv(): AudioEnv {
  const w = typeof window === 'undefined' ? null : window;
  return {
    createContext: () => {
      const AC = w?.AudioContext ?? (w as unknown as { webkitAudioContext?: typeof AudioContext } | null)?.webkitAudioContext;
      if (!AC) return null;
      try {
        return new AC({ latencyHint: 'interactive' });
      } catch {
        return null;
      }
    },
    doc: typeof document === 'undefined' ? null : document,
    win: w,
  };
}

export class WebAudioSfx implements Sfx {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private music: MusicPlayer | null = null;
  private muted = false;
  private unlocked = false;
  private failed = false;
  private last = new Map<SfxName, number>();
  private coinCombo = 0;

  constructor(private env: AudioEnv = browserEnv()) {
    const { doc, win } = env;
    // 切到后台、锁屏、切标签页时停；回来再接着放
    doc?.addEventListener('visibilitychange', () => this.sync());
    win?.addEventListener('pagehide', () => this.sync(true));
    win?.addEventListener('pageshow', () => this.sync());
    // 手势监听一直留着：iOS 上来电、切应用后上下文会被系统打断，下一次触摸时把它拉起来
    for (const type of GESTURES) win?.addEventListener(type, () => this.unlock(), { capture: true, passive: true });
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted || this.hidden() || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (this.last.get(name) ?? -1) < MIN_GAP) return;
    let variant = 0;
    if (name === 'coin') {
      const prev = this.last.get('coin') ?? -Infinity;
      this.coinCombo = now - prev < COIN_COMBO_WINDOW ? Math.min(COIN_COMBO_MAX, this.coinCombo + 1) : 0;
      variant = this.coinCombo;
    }
    this.last.set(name, now);
    playSfx(ctx, this.sfxBus, name, now + 0.005, variant);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.sync();
  }

  unlock(): void {
    this.unlocked = true;
    this.sync();
  }

  private hidden(): boolean {
    return this.env.doc?.hidden ?? false;
  }

  /** 让音频上下文和音乐的状态跟上“已解锁、没静音、在前台”这三个条件 */
  private sync(leaving = false): void {
    const want = this.unlocked && !this.muted && !this.hidden() && !leaving;
    if (!want) {
      this.music?.stop();
      // 挂起上下文：彻底无声，也不耗电
      if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {});
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'running') {
      this.music?.start();
      return;
    }
    // suspended，或 iOS 特有的 interrupted
    void ctx.resume().then(() => {
      if (ctx.state === 'running' && this.unlocked && !this.muted && !this.hidden()) this.music?.start();
    }).catch(() => {});
  }

  /** 第一次需要出声时才创建，保证创建发生在用户手势里 */
  private ensureContext(): AudioContext | null {
    if (this.ctx || this.failed) return this.ctx;
    const ctx = this.env.createContext();
    if (!ctx) {
      this.failed = true;
      return null;
    }
    const mix = createMix(ctx);
    // 老版本 iOS 要在手势里真的播一段东西才算解锁
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    blip.connect(ctx.destination);
    blip.start(0);
    ctx.addEventListener?.('statechange', () => {
      if (ctx.state !== 'running') this.music?.stop();
    });
    this.ctx = ctx;
    this.sfxBus = mix.sfx;
    this.music = new MusicPlayer(ctx, mix.music);
    return ctx;
  }
}

export const sfx: Sfx = new WebAudioSfx();
