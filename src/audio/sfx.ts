import type { SfxName } from '../core/types';

/** 音效接口。目前是空实现，后续用 WebAudio 合成。 */
export interface Sfx {
  play(name: SfxName): void;
  setMuted(muted: boolean): void;
  /** 首次用户交互后调用，用于解锁浏览器音频 */
  unlock(): void;
}

class SilentSfx implements Sfx {
  play(_name: SfxName): void {}
  setMuted(_muted: boolean): void {}
  unlock(): void {}
}

export const sfx: Sfx = new SilentSfx();
