/** 总线和音量。游戏里和离线渲染（tests/tools/audition.html）共用，保证试听到的就是游戏里的。 */

export const MASTER_VOLUME = 1.5;
export const SFX_VOLUME = 0.9;
export const MUSIC_VOLUME = 0.4;

export interface Mix {
  sfx: GainNode;
  music: GainNode;
}

export function createMix(ctx: BaseAudioContext): Mix {
  // 压限器只做兜底：平时不动作，很多声音叠在一起时不破音
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.15;
  limiter.connect(ctx.destination);
  const master = ctx.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(limiter);
  const sfx = ctx.createGain();
  sfx.gain.value = SFX_VOLUME;
  sfx.connect(master);
  const music = ctx.createGain();
  music.gain.value = MUSIC_VOLUME;
  music.connect(master);
  return { sfx, music };
}
