import Phaser from 'phaser';
import type { App } from '../app';
import { ART, TEX_SCALE, artOrigin } from '../art/manifest';
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
}
interface ActorView {
  box: Phaser.GameObjects.Container;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Image | null;
  lastX: number;
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
      if (e.type === 'coins') this.floatText(`+${e.amount}`, e.x, e.y);
    });
    this.setupInput();
  }

  // ---------- 地面 ----------

  private drawGround(): void {
    const g = this.add.graphics().setDepth(-2000);
    const top = gridToWorld(-0.5, -0.5);
    const right = gridToWorld(GRID - 0.5, -0.5);
    const bottom = gridToWorld(GRID - 0.5, GRID - 0.5);
    const left = gridToWorld(-0.5, GRID - 0.5);
    const D = 26;
    g.fillStyle(0xa9713f).fillPoints([left, bottom, { x: bottom.x, y: bottom.y + D }, { x: left.x, y: left.y + D }], true);
    g.fillStyle(0x8c5a30).fillPoints([right, bottom, { x: bottom.x, y: bottom.y + D }, { x: right.x, y: right.y + D }], true);
    g.fillStyle(0x8ecb52).fillPoints([top, right, bottom, left], true);
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        const p = gridToWorld(x, y);
        this.add.image(p.x, p.y, `tile_grass${(x + y) % 2}`).setScale((ART_SCALE / TEX_SCALE) * 1.01).setDepth(-1000);
      }
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
      game.shoo(pest);
      const v = this.pests.get(pest);
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
      if (v && b.ready && v.coin.getBounds().contains(wx, wy)) return b;
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
  }

  private artScale(key: string): number {
    return (ART_SCALE * (ART[key].scale ?? 1)) / TEX_SCALE;
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
      let v = this.buildings.get(b.uid);
      if (!v) {
        const o = artOrigin(d.art);
        const img = this.add.image(0, 0, d.art).setOrigin(o.x, o.y).setScale(this.artScale(d.art));
        const coin = this.add.image(0, 0, 'coin').setScale(1.1 / TEX_SCALE).setVisible(false);
        const bar = this.add.graphics();
        v = { img, coin, bar, def: b.def, level: b.level };
        this.buildings.set(b.uid, v);
        this.tweens.add({ targets: img, scaleY: { from: img.scaleY * 0.6, to: img.scaleY }, duration: 260, ease: 'Back.Out' });
      }
      if (v.level !== b.level) {
        v.level = b.level;
        this.tweens.add({ targets: v.img, scaleX: v.img.scaleX * 1.15, scaleY: v.img.scaleY * 1.15, duration: 140, yoyo: true });
      }
      const c = centerOf(b);
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

  private syncActors<T extends Bug | Pest>(views: Map<number, ActorView>, list: T[], artOf: (a: T) => string): void {
    const seen = new Set<number>();
    const now = this.time.now;
    for (const a of list) {
      seen.add(a.uid);
      const art = artOf(a);
      let v = views.get(a.uid);
      if (!v) {
        const o = artOrigin(art);
        const shadow = this.add.image(0, 0, 'shadow').setScale((ART_SCALE * 0.55) / TEX_SCALE);
        const img = this.add.image(0, 0, art).setOrigin(o.x, o.y).setScale(this.artScale(art));
        const box = this.add.container(0, 0, [shadow, img]);
        v = { box, img, shadow, badge: null, lastX: 0 };
        views.set(a.uid, v);
      }
      const p = gridToWorld(a.x, a.y);
      const dx = p.x - v.lastX;
      if (Math.abs(dx) > 0.05) v.img.setFlipX(dx < 0);
      v.lastX = p.x;
      v.box.setPosition(p.x, p.y).setDepth(p.y + 1);
      const moving = a.x !== a.tx || a.y !== a.ty;
      const flying = art === 'bee';
      const working = 'energy' in a && a.state === 'working';
      const trapped = 'energy' in a && a.state === 'trapped';
      let lift = flying ? 20 + Math.sin(now / 160 + a.uid) * 4 : 0;
      if (!flying && moving) lift = Math.abs(Math.sin(now / 90 + a.uid)) * 3;
      v.img.y = -lift;
      v.img.setAngle(working ? Math.sin(now / 110 + a.uid) * 7 : trapped ? Math.sin(now / 50) * 10 : 0);
      v.shadow.setVisible(art !== 'antlion');
      if ('energy' in a) {
        const hungry = a.energy < 20;
        if (hungry && !v.badge) {
          v.badge = this.add.image(0, 0, 'sugar').setScale(0.42 / TEX_SCALE);
          v.box.add(v.badge);
        }
        if (v.badge) {
          v.badge.setVisible(hungry);
          v.badge.setPosition(0, -lift - v.img.displayHeight - 6 + Math.sin(now / 200) * 2);
        }
      }
    }
    for (const [uid, v] of views) {
      if (seen.has(uid)) continue;
      v.box.destroy();
      views.delete(uid);
    }
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
