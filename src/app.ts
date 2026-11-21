import { sfx } from './audio/sfx';
import { Game } from './core/sim';
import { loadGame, newGame, saveGame, clearSave } from './core/state';

/** 场景与 DOM 界面之间共享的状态 */
export type Selection =
  | { kind: 'building'; uid: number }
  | { kind: 'bug'; uid: number }
  | null;

export interface Placing {
  defId: string;
  /** 移动已有建筑时为其 uid */
  moveUid: number | null;
  x: number;
  y: number;
  ok: boolean;
}

type Listener = () => void;

export class App {
  game: Game;
  selection: Selection = null;
  placing: Placing | null = null;
  offline: { seconds: number; finished: number } | null = null;
  private uiListeners: Listener[] = [];
  /** 由场景注入：开始摆放时挑一个初始位置 */
  pickStartTile: (defId: string, moveUid: number | null) => { x: number; y: number } = () => ({ x: 0, y: 0 });

  constructor() {
    const saved = loadGame();
    this.game = new Game(saved ?? newGame());
    if (saved) this.offline = this.game.applyOffline((Date.now() - saved.lastSeen) / 1000);
    sfx.setMuted(this.game.state.settings.muted);
    this.game.bus.on((e) => {
      if (e.type === 'sfx') sfx.play(e.name);
      if (e.type === 'changed') this.refresh();
    });
    setInterval(() => this.save(), 5000);
    addEventListener('pagehide', () => this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
  }

  onUi(fn: Listener): void {
    this.uiListeners.push(fn);
  }

  refresh(): void {
    for (const l of this.uiListeners) l();
  }

  save(): void {
    saveGame(this.game.state);
  }

  select(sel: Selection): void {
    this.selection = sel;
    this.refresh();
  }

  startPlacing(defId: string, moveUid: number | null = null): void {
    const t = this.pickStartTile(defId, moveUid);
    this.selection = null;
    this.placing = { defId, moveUid, x: t.x, y: t.y, ok: this.game.canPlace(defId, t.x, t.y, moveUid ?? undefined) };
    this.refresh();
  }

  setPlacingTile(x: number, y: number): void {
    const p = this.placing;
    if (!p) return;
    p.x = x;
    p.y = y;
    p.ok = this.game.canPlace(p.defId, x, y, p.moveUid ?? undefined);
    this.refresh();
  }

  confirmPlacing(): void {
    const p = this.placing;
    if (!p) return;
    const done = p.moveUid != null ? this.game.move(p.moveUid, p.x, p.y) : !!this.game.place(p.defId, p.x, p.y);
    if (done) this.placing = null;
    this.refresh();
  }

  cancelPlacing(): void {
    this.placing = null;
    this.refresh();
  }

  toggleMute(): void {
    const s = this.game.state.settings;
    s.muted = !s.muted;
    sfx.setMuted(s.muted);
    this.refresh();
  }

  resetGame(): void {
    clearSave();
    location.reload();
  }
}
