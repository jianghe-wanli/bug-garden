import { describe, expect, it } from 'vitest';
import { LOOP_BEATS, scheduleBeat } from '../src/audio/music';
import { type AudioEnv, WebAudioSfx } from '../src/audio/sfx';
import { SFX_LENGTH, SFX_NAMES, playSfx } from '../src/audio/synth';

/** 够用的假 AudioContext：记录创建了多少发声节点、状态怎么变 */
class FakeParam {
  value = 0;
  setValueAtTime(): void {}
  linearRampToValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
  cancelScheduledValues(): void {}
}
class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  type = '';
  buffer: unknown = null;
  loop = false;
  starts: number[] = [];
  connect(): void {}
  start(t = 0): void {
    this.starts.push(t);
  }
  stop(): void {}
}
class FakeContext {
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  sampleRate = 44100;
  destination = new FakeNode();
  sources: FakeNode[] = [];
  resumes = 0;
  private source(): FakeNode {
    const n = new FakeNode();
    this.sources.push(n);
    return n;
  }
  createOscillator = (): FakeNode => this.source();
  createBufferSource = (): FakeNode => this.source();
  createGain = (): FakeNode => new FakeNode();
  createBiquadFilter = (): FakeNode => new FakeNode();
  createDynamicsCompressor = (): FakeNode => new FakeNode();
  createBuffer = (_c: number, len: number): { getChannelData(): Float32Array } => ({ getChannelData: () => new Float32Array(len) });
  addEventListener(): void {}
  resume(): Promise<void> {
    this.resumes++;
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
}

function setup(): { sfx: WebAudioSfx; made: FakeContext[]; doc: { hidden: boolean }; fire(type: string): void } {
  const made: FakeContext[] = [];
  const handlers = new Map<string, (() => void)[]>();
  const on = (type: string, fn: () => void): void => void handlers.set(type, [...(handlers.get(type) ?? []), fn]);
  const doc = { hidden: false, addEventListener: on };
  const env = {
    createContext: () => {
      made.push(new FakeContext());
      return made.at(-1);
    },
    doc,
    win: { addEventListener: on },
  } as unknown as AudioEnv;
  const sfx = new WebAudioSfx(env);
  return { sfx, made, doc, fire: (type) => handlers.get(type)?.forEach((fn) => fn()) };
}
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('音效配方', () => {
  it('每个音效名都有配方和时长，且真的会发声', () => {
    expect(SFX_NAMES.length).toBeGreaterThanOrEqual(16);
    for (const name of SFX_NAMES) {
      const ctx = new FakeContext();
      playSfx(ctx as unknown as BaseAudioContext, ctx.destination as unknown as AudioNode, name, 0.1);
      expect(ctx.sources.length, name).toBeGreaterThan(0);
      expect(SFX_LENGTH[name], name).toBeGreaterThan(0);
      // 不会把声音排到过去，也不会超出标称时长
      for (const s of ctx.sources) for (const t of s.starts) {
        expect(t, name).toBeGreaterThanOrEqual(0.1);
        expect(t, name).toBeLessThan(0.1 + SFX_LENGTH[name]);
      }
    }
  });

  it('背景音乐整个循环每一拍都有音符', () => {
    for (let beat = 0; beat < LOOP_BEATS * 2; beat++) {
      const ctx = new FakeContext();
      scheduleBeat(ctx as unknown as BaseAudioContext, ctx.destination as unknown as AudioNode, beat, 1);
      expect(ctx.sources.length, `第 ${beat} 拍`).toBeGreaterThan(2);
    }
  });
});

describe('播放控制', () => {
  it('解锁前不创建音频上下文，也不出声', () => {
    const { sfx, made } = setup();
    sfx.play('coin');
    expect(made).toHaveLength(0);
  });

  it('解锁后恢复上下文、开始放音乐，音效能播', async () => {
    const { sfx, made } = setup();
    sfx.unlock();
    await flush();
    const ctx = made[0];
    expect(ctx.state).toBe('running');
    const before = ctx.sources.length;
    expect(before).toBeGreaterThan(1); // 音乐已经排了音符
    sfx.play('coin');
    expect(ctx.sources.length).toBeGreaterThan(before);
    sfx.setMuted(true);
  });

  it('静音时音效和音乐都停，取消静音后恢复', async () => {
    const { sfx, made } = setup();
    sfx.unlock();
    await flush();
    const ctx = made[0];
    sfx.setMuted(true);
    expect(ctx.state).toBe('suspended');
    const n = ctx.sources.length;
    sfx.play('coin');
    ctx.currentTime += 5;
    await new Promise((r) => setTimeout(r, 250));
    expect(ctx.sources.length).toBe(n);
    sfx.setMuted(false);
    await flush();
    expect(ctx.state).toBe('running');
    expect(ctx.sources.length).toBeGreaterThan(n);
    sfx.setMuted(true);
  });

  it('开局就是静音时，解锁也不创建上下文', () => {
    const { sfx, made } = setup();
    sfx.setMuted(true);
    sfx.unlock();
    expect(made).toHaveLength(0);
  });

  it('切到后台挂起，回到前台恢复', async () => {
    const { sfx, made, doc, fire } = setup();
    sfx.unlock();
    await flush();
    const ctx = made[0];
    doc.hidden = true;
    fire('visibilitychange');
    expect(ctx.state).toBe('suspended');
    sfx.play('coin');
    doc.hidden = false;
    fire('visibilitychange');
    await flush();
    expect(ctx.state).toBe('running');
    fire('pagehide');
    expect(ctx.state).toBe('suspended');
    sfx.setMuted(true);
  });

  it('iOS：pointerdown 时恢复不了，之后的 touchend 会再试一次', async () => {
    const { sfx, made, fire } = setup();
    sfx.unlock();
    await flush();
    const ctx = made[0];
    ctx.state = 'suspended'; // 模拟被系统打断
    fire('touchend');
    await flush();
    expect(ctx.state).toBe('running');
    expect(ctx.resumes).toBe(2);
    sfx.setMuted(true);
  });

  it('同一音效瞬间重复触发只响一次；连续收金币音高递增不报错', async () => {
    const { sfx, made } = setup();
    sfx.unlock();
    await flush();
    const ctx = made[0];
    sfx.setMuted(true);
    sfx.setMuted(false);
    await flush();
    const n0 = ctx.sources.length;
    sfx.play('tap');
    const n1 = ctx.sources.length;
    sfx.play('tap');
    expect(n1).toBeGreaterThan(n0);
    expect(ctx.sources.length).toBe(n1);
    for (let i = 0; i < 10; i++) {
      ctx.currentTime += 0.3;
      sfx.play('coin');
    }
    expect(ctx.sources.length).toBeGreaterThan(n1 + 10);
    sfx.setMuted(true);
  });

  it('浏览器不支持 WebAudio 时静默降级', () => {
    const sfx = new WebAudioSfx({ createContext: () => null, doc: null, win: null });
    sfx.unlock();
    expect(() => sfx.play('coin')).not.toThrow();
  });
});
