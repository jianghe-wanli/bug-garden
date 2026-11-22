import Phaser from 'phaser';
import type { App } from '../app';
import { ANIMS, ART, TEX_SCALE, artOrigin, frameKey, levelArt } from '../art/manifest';
import { ART_SCALE, GRID, TH, TW, gridToWorld, worldToGrid } from '../core/iso';
import { centerOf, defOf } from '../core/sim';
import type { Bug, Pest, PlacedBuilding } from '../core/types';
import { BUILDING_BY_ID } from '../data/buildings';
import { PEST_BY_ID } from '../data/pests';

const TAP_SLOP = 12;
const LONG_PRESS_MS = 450;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.8;

interface BuildingView {
  img: Phaser.GameObjects.Image;
  coin: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  def: string;
  level: number;
  /** 当前贴图的基准缩放，弹跳补间以它为终点 */
  scale: number;
}
interface ActorView {
  box: Phaser.GameObjects.Container;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Image | null;
  lastX: number;
  tex: string;
  /** 上一帧的状态与体力，用来在渲染层识别“被赶走”“被喂食”这些时刻 */
  state: string;
  energy: number;
  fxAt: number;
}

interface FxOpts {
  n: number;
  /** 水平散开半径 */
  spread: number;
  /** 上升高度 */
  rise: number;
  scale?: number;
  duration?: number;
  /** 先上后落（金币、叶子）还是一直上飘（星星、爱心） */
  fall?: boolean;
  spin?: boolean;
}

/** 固定种子的伪随机，保证花园边缘每次打开都长一个样 */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GardenScene extends Phaser.Scene {
  private zoom = 0.8;
  private buildings = new Map<number, BuildingView>();
  private bugs = new Map<number, ActorView>();
  private pests = new Map<number, ActorView>();
  private ghost!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Graphics;
  private down: { x: number; y: number; t: number; sx: number; sy: number; moved: boolean; onGhost: boolean } | null = null;
  private pinch: { d: number; zoom: number } | null = null;
  private longTimer: Phaser.Time.TimerEvent | null = null;
  /** 首帧同步的是存档里已有的建筑，不放落成特效 */
  private synced = false;

  constructor(private app: App, private dpr: number) {
    super('garden');
  }

  create(): void {
    this.drawGround();
    this.overlay = this.add.graphics().setDepth(-500);
    this.ghost = this.add.image(0, 0, 'pebble').setVisible(false).setAlpha(0.85);

    const cam = this.cameras.main;
    this.zoom = Phaser.Math.Clamp(innerWidth / 760, 0.6, 1);
    cam.setZoom(this.zoom * this.dpr);
    const mid = gridToWorld((GRID - 1) / 2, (GRID - 1) / 2);
    cam.centerOn(mid.x, mid.y);

    this.app.pickStartTile = (defId, moveUid) => this.pickStartTile(defId, moveUid);
    this.app.game.bus.on((e) => {
      if (e.type !== 'coins') return;
      this.floatText(`+${e.amount}`, e.x, e.y);
      const w = gridToWorld(e.x, e.y);
      this.burst('coin', w.x, w.y - 30, { n: Phaser.Math.Clamp(Math.round(e.amount / 8), 3, 7), spread: 46, rise: 54, scale: 0.7, fall: true, duration: 620 });
      this.burst('fx_spark', w.x, w.y - 34, { n: 4, spread: 34, rise: 40, spin: true, duration: 480 });
    });
    this.setupInput();
  }

  // ---------- 地面 ----------

  private drawGround(): void {
    this.cameras.main.setBackgroundColor(0x86c456);
    const top = gridToWorld(-0.5, -0.5);
    const right = gridToWorld(GRID - 0.5, -0.5);
    const bottom = gridToWorld(GRID - 0.5, GRID - 0.5);
    const left = gridToWorld(-0.5, GRID - 0.5);
    this.drawSurroundings(bottom.y);

    const g = this.add.graphics().setDepth(-2000);
    const D = 26;
    // 可建区是一块垫高的苗床：先落一圈影子，再画土壁和草面，和外面的草地拉开层次
    g.fillStyle(0x4f8a34, 0.35).fillPoints([{ x: left.x - 10, y: left.y + D + 4 }, { x: bottom.x, y: bottom.y + D + 14 }, { x: right.x + 10, y: right.y + D + 4 }, bottom], true);
    g.fillStyle(0xa9713f).fillPoints([left, bottom, { x: bottom.x, y: bottom.y + D }, { x: left.x, y: left.y + D }], true);
    g.fillStyle(0x8c5a30).fillPoints([right, bottom, { x: bottom.x, y: bottom.y + D }, { x: right.x, y: right.y + D }], true);
    g.fillStyle(0x8ecb52).fillPoints([top, right, bottom, left], true);
    g.lineStyle(3, 0x5a3118, 0.55).strokePoints([top, right, { x: right.x, y: right.y + D }, { x: bottom.x, y: bottom.y + D }, { x: left.x, y: left.y + D }, left], true);
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        const p = gridToWorld(x, y);
        this.add.image(p.x, p.y, `tile_grass${(x + y) % 2}`).setScale((ART_SCALE / TEX_SCALE) * 1.01).setDepth(-1000);
      }
    }
  }

  /** 地块之外的“花园一角”：深浅草斑 + 草丛、石子、小花，越往外越高越密；全部静态，只画一次 */
  private drawSurroundings(bottomY: number): void {
    const rnd = seeded(20110);
    const X = GRID * TW * 0.5 + 520;
    const Y0 = -TH - 560;
    const Y1 = bottomY + 620;
    const g = this.add.graphics().setDepth(-3000);
    for (let i = 0; i < 70; i++) {
      const x = (rnd() * 2 - 1) * X;
      const y = Y0 + rnd() * (Y1 - Y0);
      const w = 90 + rnd() * 200;
      g.fillStyle(rnd() < 0.5 ? 0x7ab94b : 0x93cf62, 0.55).fillEllipse(x, y, w, w * 0.45);
    }
    const near = ['env_tuft', 'env_tuft', 'env_tuft', 'env_bloom', 'env_rock'];
    const far = ['env_bush', 'env_leaf', 'env_reed', 'env_tuft', 'env_rock', 'env_bush'];
    let placed = 0;
    for (let i = 0; i < 900 && placed < 150; i++) {
      const x = (rnd() * 2 - 1) * X;
      const y = Y0 + rnd() * (Y1 - Y0);
      const c = worldToGrid(x, y);
      // 到可建区边缘的格数；下侧的东西会朝上挡住地块，所以留得更远
      const out = Math.max(-c.x, -c.y, c.x - (GRID - 1), c.y - (GRID - 1));
      const south = c.x > GRID - 1 || c.y > GRID - 1;
      if (out < (south ? 1.9 : 1.1)) continue;
      const deep = out > (south ? 3.4 : 2.6);
      if (!deep && rnd() < 0.45) continue;
      const pool = deep ? far : near;
      const key = pool[Math.floor(rnd() * pool.length)];
      const o = artOrigin(key);
      const sc = (ART_SCALE / TEX_SCALE) * (deep ? 1 + rnd() * 0.5 : 0.75 + rnd() * 0.3);
      this.add.image(x, y, key).setOrigin(o.x, o.y).setScale(rnd() < 0.5 ? -sc : sc, sc).setDepth(-2500 + y * 0.1);
      placed++;
    }
  }

  // ---------- 输入 ----------

  private setupInput(): void {
    const input = this.input;
    input.addPointer(2);
    input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (input.pointer1.isDown && input.pointer2.isDown) {
        this.pinch = { d: this.pointerDist(), zoom: this.zoom };
        this.down = null;
        this.cancelLong();
        return;
      }
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.down = { x: p.x, y: p.y, t: this.time.now, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY, moved: false, onGhost: this.hitsGhost(w.x, w.y) };
      this.cancelLong();
      this.longTimer = this.time.delayedCall(LONG_PRESS_MS, () => this.onLongPress(w.x, w.y));
    });
    input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.pinch && input.pointer1.isDown && input.pointer2.isDown) {
        this.setZoom((this.pinch.zoom * this.pointerDist()) / this.pinch.d);
        return;
      }
      const d = this.down;
      if (!d || !p.isDown) return;
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) > TAP_SLOP * this.dpr) {
        d.moved = true;
        this.cancelLong();
      }
      if (!d.moved) return;
      const cam = this.cameras.main;
      if (d.onGhost && this.app.placing) {
        const w = cam.getWorldPoint(p.x, p.y);
        this.movePlacingTo(w.x, w.y);
      } else {
        cam.scrollX = d.sx - (p.x - d.x) / cam.zoom;
        cam.scrollY = d.sy - (p.y - d.y) / cam.zoom;
        this.clampCamera();
      }
    });
    input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.cancelLong();
      if (this.pinch) {
        if (!input.pointer1.isDown && !input.pointer2.isDown) this.pinch = null;
        this.down = null;
        return;
      }
      const d = this.down;
      this.down = null;
      if (!d || d.moved) return;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.onTap(w.x, w.y);
    });
    input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.setZoom(this.zoom * (dy > 0 ? 0.9 : 1.1)));
  }

  private pointerDist(): number {
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
  }

  private cancelLong(): void {
    this.longTimer?.remove();
    this.longTimer = null;
  }

  private setZoom(z: number): void {
    this.zoom = Phaser.Math.Clamp(z, MIN_ZOOM, MAX_ZOOM);
    this.cameras.main.setZoom(this.zoom * this.dpr);
    this.clampCamera();
  }

  private clampCamera(): void {
    const cam = this.cameras.main;
    const cx = Phaser.Math.Clamp(cam.scrollX + cam.width / 2, (-GRID * TW) / 2, (GRID * TW) / 2);
    const cy = Phaser.Math.Clamp(cam.scrollY + cam.height / 2, -TH, GRID * TH);
    cam.centerOn(cx, cy);
  }

  private onTap(wx: number, wy: number): void {
    const app = this.app;
    const game = app.game;
    if (app.placing) {
      this.movePlacingTo(wx, wy);
      return;
    }
    const pest = this.pickActor(this.pests, wx, wy, 26);
    if (pest != null) {
      const v = this.pests.get(pest);
      if (game.shoo(pest) && v) this.burst('fx_spark', v.box.x, v.box.y - v.img.displayHeight * 0.5, { n: 4, spread: 30, rise: 26, spin: true, duration: 360 });
      if (v) this.tweens.add({ targets: v.img, angle: { from: -14, to: 14 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => v.img.setAngle(0) });
      return;
    }
    const b = this.pickBuilding(wx, wy);
    if (b?.ready) {
      game.collect(b.uid);
      return;
    }
    const bug = this.pickActor(this.bugs, wx, wy, 20);
    if (bug != null) {
      app.select({ kind: 'bug', uid: bug });
      return;
    }
    if (!b) {
      app.select(null);
      return;
    }
    if (defOf(b).work && !b.job && game.assign(b.uid)) return;
    app.select({ kind: 'building', uid: b.uid });
  }

  private onLongPress(wx: number, wy: number): void {
    if (this.app.placing || !this.down || this.down.moved) return;
    const b = this.pickBuilding(wx, wy);
    if (!b) return;
    this.down = null;
    this.app.select({ kind: 'building', uid: b.uid });
  }

  private pickActor(views: Map<number, ActorView>, wx: number, wy: number, pad: number): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const [uid, v] of views) {
      const cy = v.box.y + v.img.y - v.img.displayHeight / 2;
      const d = Math.hypot(wx - v.box.x, wy - cy);
      if (d < Math.max(v.img.displayWidth, v.img.displayHeight) / 2 + pad && d < bestD) {
        best = uid;
        bestD = d;
      }
    }
    return best;
  }

  private pickBuilding(wx: number, wy: number): PlacedBuilding | null {
    const list = [...this.app.game.state.buildings].sort((a, z) => this.depthOf(z) - this.depthOf(a));
    // 金币画在所有建筑之上，所以先判金币
    for (const b of list) {
      const v = this.buildings.get(b.uid);
      if (!v || !b.ready) continue;
      // 金币是圆的，按圆形判定，避免透明的四角抢走后面建筑的点击
      const c = v.coin.getBounds();
      if (Phaser.Math.Distance.Between(wx, wy, c.centerX, c.centerY) <= Math.max(c.width, c.height) / 2) return b;
    }
    for (const b of list) {
      const v = this.buildings.get(b.uid);
      if (v && v.img.getBounds().contains(wx, wy)) return b;
    }
    const g = worldToGrid(wx, wy);
    const tx = Math.round(g.x);
    const ty = Math.round(g.y);
    return list.find((b) => tx >= b.x && tx < b.x + defOf(b).w && ty >= b.y && ty < b.y + defOf(b).h) ?? null;
  }

  private depthOf(b: PlacedBuilding): number {
    const c = centerOf(b);
    return c.x + c.y;
  }

  // ---------- 摆放 ----------

  private pickStartTile(defId: string, moveUid: number | null): { x: number; y: number } {
    const game = this.app.game;
    if (moveUid != null) {
      const b = game.building(moveUid);
      if (b) return { x: b.x, y: b.y };
    }
    const mid = this.cameras.main.midPoint;
    const g = worldToGrid(mid.x, mid.y);
    const d = BUILDING_BY_ID[defId];
    let best = { x: 0, y: 0 };
    let bestD = Infinity;
    for (let x = 0; x <= GRID - d.w; x++) {
      for (let y = 0; y <= GRID - d.h; y++) {
        if (!game.canPlace(defId, x, y)) continue;
        const dd = Math.hypot(x + (d.w - 1) / 2 - g.x, y + (d.h - 1) / 2 - g.y);
        if (dd < bestD) {
          bestD = dd;
          best = { x, y };
        }
      }
    }
    return best;
  }

  private movePlacingTo(wx: number, wy: number): void {
    const p = this.app.placing;
    if (!p) return;
    const d = BUILDING_BY_ID[p.defId];
    const g = worldToGrid(wx, wy);
    const x = Phaser.Math.Clamp(Math.round(g.x - (d.w - 1) / 2), 0, GRID - d.w);
    const y = Phaser.Math.Clamp(Math.round(g.y - (d.h - 1) / 2), 0, GRID - d.h);
    if (x !== p.x || y !== p.y) this.app.setPlacingTile(x, y);
  }

  private hitsGhost(wx: number, wy: number): boolean {
    const p = this.app.placing;
    if (!p) return false;
    const d = BUILDING_BY_ID[p.defId];
    const g = worldToGrid(wx, wy);
    return (g.x > p.x - 0.8 && g.x < p.x + d.w - 0.2 && g.y > p.y - 0.8 && g.y < p.y + d.h - 0.2) || this.ghost.getBounds().contains(wx, wy);
  }

  // ---------- 渲染 ----------

  update(_time: number, deltaMs: number): void {
    const game = this.app.game;
    game.step(Math.min(deltaMs, 250) / 1000);
    const s = game.state;
    this.syncBuildings(s.buildings);
    this.syncActors(this.bugs, s.bugs, (b) => b.kind);
    this.syncActors(this.pests, s.pests, (p) => PEST_BY_ID[p.kind].art);
    this.drawOverlay();
    this.synced = true;
  }

  private artScale(key: string): number {
    return (ART_SCALE * ((ART[key] ?? ANIMS[key]).scale ?? 1)) / TEX_SCALE;
  }

  /** 一小撮贴图粒子：从 (x,y) 散开，补间结束即销毁。数量都是个位数，手机上没有压力 */
  private burst(key: string, x: number, y: number, o: FxOpts): void {
    const base = (o.scale ?? 1) / TEX_SCALE;
    const dur = o.duration ?? 600;
    for (let i = 0; i < o.n; i++) {
      const dx = (o.n === 1 ? 0 : (i / (o.n - 1)) * 2 - 1) * o.spread + (Math.random() - 0.5) * o.spread * 0.4;
      const up = o.rise * (0.7 + Math.random() * 0.6);
      const img = this.add.image(x, y, key).setDepth(1.5e6).setScale(base * 0.3);
      const life = dur * (0.85 + Math.random() * 0.3);
      this.tweens.add({ targets: img, x: x + dx, duration: life, ease: 'Sine.Out' });
      this.tweens.add({ targets: img, scale: base, duration: life * 0.35, ease: 'Back.Out' });
      if (o.spin) this.tweens.add({ targets: img, angle: dx > 0 ? 160 : -160, duration: life });
      if (o.fall) {
        this.tweens.add({ targets: img, y: y - up, duration: life * 0.45, ease: 'Quad.Out', yoyo: true });
      } else {
        this.tweens.add({ targets: img, y: y - up, duration: life, ease: 'Cubic.Out' });
      }
      this.tweens.add({ targets: img, alpha: 0, delay: life * 0.6, duration: life * 0.4, onComplete: () => img.destroy() });
    }
  }

  /** 建筑压扁再弹回，落成和升级共用 */
  private bounce(v: BuildingView, from: number): void {
    this.tweens.killTweensOf(v.img);
    v.img.setScale(v.scale);
    this.tweens.add({ targets: v.img, scaleY: { from: v.scale * from, to: v.scale }, scaleX: { from: v.scale * (2 - from), to: v.scale }, duration: 420, ease: 'Elastic.Out', easeParams: [1.1, 0.5] });
  }

  private placeOnGrid(obj: { setPosition(x: number, y: number): unknown; setDepth(d: number): unknown }, cx: number, cy: number, size: number): void {
    const p = gridToWorld(cx, cy);
    obj.setPosition(p.x, p.y + TH * 0.22 * size);
    obj.setDepth(p.y);
  }

  private syncBuildings(list: PlacedBuilding[]): void {
    const seen = new Set<number>();
    const moving = this.app.placing?.moveUid;
    for (const b of list) {
      seen.add(b.uid);
      const d = defOf(b);
      const c = centerOf(b);
      let v = this.buildings.get(b.uid);
      if (!v) {
        const art = levelArt(d.art, b.level);
        const o = artOrigin(art);
        const img = this.add.image(0, 0, art).setOrigin(o.x, o.y).setScale(this.artScale(art));
        const coin = this.add.image(0, 0, 'coin').setScale(1.1 / TEX_SCALE).setVisible(false);
        const bar = this.add.graphics();
        v = { img, coin, bar, def: b.def, level: b.level, scale: img.scaleX };
        this.buildings.set(b.uid, v);
        if (this.synced) {
          this.bounce(v, 0.55);
          const w = gridToWorld(c.x, c.y);
          this.burst('fx_puff', w.x, w.y + 4, { n: 5, spread: 34 * d.w, rise: 16, scale: 0.9, duration: 520 });
          this.burst('fx_leaf', w.x, w.y - 10, { n: 4, spread: 40 * d.w, rise: 44, fall: true, spin: true, duration: 700 });
        }
      }
      if (v.level !== b.level) {
        v.level = b.level;
        const art = levelArt(d.art, b.level);
        const o = artOrigin(art);
        v.scale = this.artScale(art);
        v.img.setTexture(art).setOrigin(o.x, o.y);
        this.bounce(v, 0.7);
        const w = gridToWorld(c.x, c.y);
        this.burst('fx_star', w.x, w.y - v.img.displayHeight * 0.45, { n: 7, spread: 48, rise: 70, spin: true, duration: 900 });
        this.burst('fx_spark', w.x, w.y - v.img.displayHeight * 0.3, { n: 5, spread: 56, rise: 40, duration: 700 });
      }
      this.placeOnGrid(v.img, c.x, c.y, d.w);
      v.img.setAlpha(moving === b.uid ? 0.35 : 1);
      v.img.setTint(this.app.game.isPestered(b.uid) ? 0xd9c8ff : 0xffffff);
      const topY = v.img.y - v.img.displayHeight * v.img.originY - 14;
      v.coin.setVisible(!!b.ready);
      if (b.ready) v.coin.setPosition(v.img.x, topY - 6 + Math.sin(this.time.now / 220 + b.uid) * 4).setDepth(v.img.depth + 2000);
      v.bar.clear();
      if (b.job) {
        const w = 44;
        const k = 1 - b.job.remaining / b.job.total;
        v.bar.setDepth(v.img.depth + 2000);
        v.bar.fillStyle(0x5a3118, 0.85).fillRoundedRect(v.img.x - w / 2 - 2, topY - 2, w + 4, 10, 5);
        v.bar.fillStyle(0xfffaf0).fillRoundedRect(v.img.x - w / 2, topY, w, 6, 3);
        if (k > 0.02) v.bar.fillStyle(0x7cc04a).fillRoundedRect(v.img.x - w / 2, topY, w * k, 6, 3);
      }
    }
    for (const [uid, v] of this.buildings) {
      if (seen.has(uid)) continue;
      v.img.destroy();
      v.coin.destroy();
      v.bar.destroy();
      this.buildings.delete(uid);
    }
  }

  /** 按模拟状态挑动画片段 */
  private clipOf(art: string, a: Bug | Pest, moving: boolean): string {
    if ('energy' in a) {
      if (a.state === 'working') return 'work';
      if (art === 'bee') return 'fly';
      if (a.state === 'trapped') return 'trapped';
      return moving ? 'walk' : 'idle';
    }
    if (art === 'antlion') return 'bite';
    return a.state === 'approach' ? 'walk' : a.state;
  }

  private syncActors<T extends Bug | Pest>(views: Map<number, ActorView>, list: T[], artOf: (a: T) => string): void {
    const seen = new Set<number>();
    const now = this.time.now;
    for (const a of list) {
      seen.add(a.uid);
      const art = artOf(a);
      const anim = ANIMS[art];
      const isBug = 'energy' in a;
      let v = views.get(a.uid);
      if (!v) {
        const o = artOrigin(art);
        const shadow = this.add.image(0, 0, 'shadow').setScale((ART_SCALE * 0.55) / TEX_SCALE).setVisible(art !== 'antlion');
        const img = this.add.image(0, 0, art).setOrigin(o.x, o.y).setScale(this.artScale(art));
        const box = this.add.container(0, 0, [shadow, img]);
        v = { box, img, shadow, badge: null, lastX: gridToWorld(a.x, a.y).x, tex: art, state: a.state, energy: isBug ? a.energy : 0, fxAt: 0 };
        views.set(a.uid, v);
        if (!isBug && this.synced) this.tweens.add({ targets: img, scale: { from: 0, to: img.scaleX }, duration: 320, ease: 'Back.Out' });
      }
      const p = gridToWorld(a.x, a.y);
      const dx = p.x - v.lastX;
      if (Math.abs(dx) > 0.05) v.img.setFlipX(dx < 0);
      v.lastX = p.x;
      const moving = a.x !== a.tx || a.y !== a.ty;
      const flying = art === 'bee';
      const working = isBug && a.state === 'working';
      const trapped = isBug && a.state === 'trapped';
      // 被困的蚂蚁和蚁狮在同一格：往两侧错开并排到蚁狮身后，否则会把它整个盖住
      const side = trapped ? (a.uid % 2 ? 22 : -22) : 0;
      v.box.setPosition(p.x + side, p.y - (trapped ? 6 : 0)).setDepth(p.y + (trapped ? 0.5 : 1));
      if (trapped) v.img.setFlipX(side > 0);

      // 换帧只换贴图，不新建对象；同类虫子用 uid 错开相位，免得齐步走
      if (anim) {
        const clip = this.clipOf(art, a, moving);
        const [n, fps] = anim.clips[clip] ?? [1, 1];
        const tex = frameKey(art, clip, Math.floor((now * fps) / 1000 + a.uid * 1.7) % n);
        if (tex !== v.tex) {
          v.tex = tex;
          v.img.setTexture(tex);
        }
      }
      let lift = flying ? (working ? 9 : 20) + Math.sin(now / 160 + a.uid) * (working ? 2 : 4) : 0;
      if (!flying && moving) lift = Math.abs(Math.sin(now / 90 + a.uid)) * 2;
      v.img.y = -lift;
      v.img.x = trapped ? Math.sin(now / 38 + a.uid) * 2.2 : 0;
      v.img.setAngle(trapped ? Math.sin(now / 60 + a.uid) * 6 : working && !flying ? Math.sin(now / 130 + a.uid) * 3 : 0);
      v.shadow.setScale(((ART_SCALE * 0.55) / TEX_SCALE) * (flying ? 0.8 : 1));

      if (isBug) {
        // 体力自然恢复很慢，一帧里涨了一截就是刚被喂过
        if (a.energy - v.energy > 3) {
          this.burst('fx_heart', p.x, p.y - lift - v.img.displayHeight * 0.7, { n: 4, spread: 22, rise: 46, duration: 900 });
          this.tweens.add({ targets: v.box, scale: { from: 1.25, to: 1 }, duration: 380, ease: 'Back.Out' });
        }
        v.energy = a.energy;
        const hungry = a.energy < 20;
        if (hungry && !v.badge) {
          v.badge = this.add.image(0, 0, 'sugar').setScale(0.42 / TEX_SCALE);
          v.box.add(v.badge);
        }
        if (v.badge) {
          v.badge.setVisible(hungry);
          v.badge.setPosition(0, -lift - v.img.displayHeight - 6 + Math.sin(now / 200) * 2);
        }
      } else {
        if (a.state === 'flee' && v.state !== 'flee') this.shooFx(v);
        if (art === 'stink' && a.state === 'pester' && now > v.fxAt) {
          v.fxAt = now + 700 + Math.random() * 500;
          this.burst('fx_stink', p.x + (Math.random() - 0.5) * 30, p.y - v.img.displayHeight * 0.8, { n: 1, spread: 0, rise: 34, scale: 0.8, duration: 1300 });
        }
      }
      v.state = a.state;
    }
    for (const [uid, v] of views) {
      if (seen.has(uid)) continue;
      // 蚁狮被赶走时模拟层直接把它移除，没有逃跑状态，在这里补上特效
      if (views === this.pests && v.state !== 'flee') this.shooFx(v);
      v.box.destroy();
      views.delete(uid);
    }
  }

  private shooFx(v: ActorView): void {
    const y = v.box.y - v.img.displayHeight * 0.4;
    this.burst('fx_puff', v.box.x, y, { n: 4, spread: 30, rise: 22, duration: 520 });
    this.burst('fx_star', v.box.x, y, { n: 5, spread: 44, rise: 56, spin: true, duration: 760 });
  }

  private drawOverlay(): void {
    const g = this.overlay;
    g.clear();
    const app = this.app;
    const p = app.placing;
    this.ghost.setVisible(!!p);
    if (p) {
      const d = BUILDING_BY_ID[p.defId];
      const color = p.ok ? 0x4cd964 : 0xff4d4f;
      for (let x = 0; x < GRID; x++) {
        for (let y = 0; y < GRID; y++) {
          if (!app.game.canPlace('pebble', x, y, p.moveUid ?? undefined)) this.fillTile(g, x, y, 0x000000, 0.12);
        }
      }
      for (let i = 0; i < d.w; i++) for (let j = 0; j < d.h; j++) this.fillTile(g, p.x + i, p.y + j, color, 0.55);
      const o = artOrigin(d.art);
      this.ghost.setTexture(d.art).setOrigin(o.x, o.y).setScale(this.artScale(d.art)).setTint(p.ok ? 0xffffff : 0xff9a9a);
      this.placeOnGrid(this.ghost, p.x + (d.w - 1) / 2, p.y + (d.h - 1) / 2, d.w);
      this.ghost.setDepth(1e6);
      return;
    }
    const sel = app.selection;
    if (sel?.kind === 'building') {
      const b = app.game.building(sel.uid);
      if (b) for (let i = 0; i < defOf(b).w; i++) for (let j = 0; j < defOf(b).h; j++) this.fillTile(g, b.x + i, b.y + j, 0xffffff, 0.45);
    } else if (sel?.kind === 'bug') {
      const bug = app.game.bug(sel.uid);
      if (bug) {
        const w = gridToWorld(bug.x, bug.y);
        g.lineStyle(3, 0xffffff, 0.9).strokeEllipse(w.x, w.y, 44, 20);
      }
    }
  }

  private fillTile(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number): void {
    const c = gridToWorld(x, y);
    g.fillStyle(color, alpha).fillPoints(
      [{ x: c.x, y: c.y - TH / 2 }, { x: c.x + TW / 2, y: c.y }, { x: c.x, y: c.y + TH / 2 }, { x: c.x - TW / 2, y: c.y }],
      true,
    );
  }

  private floatText(text: string, gx: number, gy: number): void {
    const w = gridToWorld(gx, gy);
    const t = this.add
      .text(w.x, w.y - 50, text, { fontFamily: 'system-ui, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#8a5a00', stroke: '#ffffff', strokeThickness: 5, resolution: this.dpr })
      .setOrigin(0.5)
      .setDepth(2e6);
    this.tweens.add({ targets: t, y: t.y - 46, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }
}
