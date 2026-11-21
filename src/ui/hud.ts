import type { App } from '../app';
import { artUrl } from '../art/manifest';
import { defOf } from '../core/sim';
import type { BuildingCategory, BuildingDef } from '../core/types';
import { BUILDINGS, BUILDING_BY_ID } from '../data/buildings';
import { FOODS } from '../data/foods';

type Tab = BuildingCategory | 'food';
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: '住宅' },
  { id: 'work', label: '工作' },
  { id: 'decor', label: '装饰' },
  { id: 'food', label: '食物' },
];
const BUG_NAME = { ant: '蚂蚁', bee: '蜜蜂' } as const;
const STATE_NAME = { idle: '闲逛中', toWork: '去干活的路上', working: '干活中', toHome: '回家路上', trapped: '被蚁狮困住了' } as const;

function icon(key: string, cls = 'ico'): string {
  return `<img class="${cls}" src="${artUrl(key)}" alt="" draggable="false" />`;
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return s >= 60 ? `${Math.floor(s / 60)}分${s % 60}秒` : `${s}秒`;
}

export function mountUi(app: App, root: HTMLElement): void {
  let shopOpen = false;
  let menuOpen = false;
  let tab: Tab = 'home';
  let toastTimer = 0;
  let lastHtml = '';

  root.innerHTML = '<div id="hud"></div><div id="toast"></div>';
  const hud = root.querySelector<HTMLElement>('#hud')!;
  const toastEl = root.querySelector<HTMLElement>('#toast')!;

  function toast(text: string): void {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function shopItem(d: BuildingDef): string {
    const s = app.game.state;
    const locked = d.unlockLevel > s.level;
    const info = d.home
      ? `住 ${d.home.capacity[0]} 只${BUG_NAME[d.home.bug]}`
      : d.work
        ? `${BUG_NAME[d.work.bug]} · ${fmtTime(d.work.duration)} · +${d.work.coins}`
        : `快乐 +${d.decor!.happiness}`;
    return `<button class="item${locked ? ' locked' : ''}" data-act="place" data-id="${d.id}" ${locked || s.coins < d.cost ? 'disabled' : ''}>
      ${icon(d.art, 'pic')}<b>${d.name}</b><small>${locked ? `${d.unlockLevel} 级解锁` : info}</small>
      <span class="price">${icon('coin')}${d.cost}</span></button>`;
  }

  function foodItem(id: string, mode: 'buy' | 'feed'): string {
    const s = app.game.state;
    const f = FOODS.find((x) => x.id === id)!;
    const n = s.food[id] ?? 0;
    const locked = f.unlockLevel > s.level;
    if (mode === 'feed') {
      return `<button class="item" data-act="feed" data-id="${id}" ${n <= 0 ? 'disabled' : ''}>${icon(f.art, 'pic')}<b>${f.name}</b><small>体力 +${f.energy}</small><span class="price">剩 ${n}</span></button>`;
    }
    return `<button class="item${locked ? ' locked' : ''}" data-act="buy" data-id="${id}" ${locked || s.coins < f.cost ? 'disabled' : ''}>
      ${icon(f.art, 'pic')}<b>${f.name}</b><small>${locked ? `${f.unlockLevel} 级解锁` : `体力 +${f.energy} · 已有 ${n}`}</small>
      <span class="price">${icon('coin')}${f.cost}</span></button>`;
  }

  function panelHtml(): string {
    const game = app.game;
    const s = game.state;
    const p = app.placing;
    if (p) {
      const d = BUILDING_BY_ID[p.defId];
      return `<div class="sheet placing"><div class="row"><b>${p.moveUid != null ? '移动' : '建造'}：${d.name}</b><small>点击或拖动到想放的位置</small></div>
        <div class="row"><button class="btn ghost" data-act="cancel">取消</button><button class="btn" data-act="confirm" ${p.ok ? '' : 'disabled'}>放这里</button></div></div>`;
    }
    const sel = app.selection;
    if (sel?.kind === 'bug') {
      const bug = game.bug(sel.uid);
      if (bug) {
        const foods = FOODS.filter((f) => f.unlockLevel <= s.level).map((f) => foodItem(f.id, 'feed')).join('');
        return `<div class="sheet"><div class="row head">${icon(bug.kind, 'pic')}<div class="grow"><b>${BUG_NAME[bug.kind]}</b><small>${STATE_NAME[bug.state]}</small>
          <div class="bar"><i style="width:${Math.round(bug.energy)}%"></i><span>体力 ${Math.round(bug.energy)}/100</span></div></div>
          <button class="x" data-act="close">✕</button></div><div class="items">${foods}</div></div>`;
      }
    }
    if (sel?.kind === 'building') {
      const b = game.building(sel.uid);
      if (b) {
        const d = defOf(b);
        let info = d.desc;
        let extra = '';
        if (d.home) {
          const cost = game.upgradeCost(b);
          info = `${b.level} 级 · 住着 ${game.capacity(b)} 只${BUG_NAME[d.home.bug]}`;
          extra = cost != null
            ? `<button class="btn" data-act="upgrade" ${s.coins < cost ? 'disabled' : ''}>升级 ${icon('coin')}${cost}</button>`
            : '<button class="btn" disabled>已满级</button>';
        } else if (d.work) {
          info = b.job
            ? (game.bug(b.job.bugUid)?.state === 'working' ? `干活中，还要 ${fmtTime(b.job.remaining)}` : `${BUG_NAME[d.work.bug]}正在赶来`)
            : `${BUG_NAME[d.work.bug]}干 ${fmtTime(d.work.duration)}，得 ${Math.round(d.work.coins * game.yieldMultiplier())} 金币`;
          if (game.isPestered(b.uid)) info = '被害虫捣乱了，点害虫把它赶走';
        } else if (d.decor) info = `快乐 +${d.decor.happiness}`;
        return `<div class="sheet"><div class="row head">${icon(d.art, 'pic')}<div class="grow"><b>${d.name}</b><small>${info}</small></div><button class="x" data-act="close">✕</button></div>
          <div class="row">${extra}<button class="btn ghost" data-act="move">移动</button><button class="btn ghost" data-act="remove">收起 +${Math.floor(d.cost / 2)}</button></div></div>`;
      }
    }
    if (shopOpen) {
      const items = tab === 'food' ? FOODS.map((f) => foodItem(f.id, 'buy')).join('') : BUILDINGS.filter((d) => d.category === tab).map(shopItem).join('');
      return `<div class="sheet shop"><div class="row tabs">${TABS.map((t) => `<button class="tab${t.id === tab ? ' on' : ''}" data-act="tab" data-id="${t.id}">${t.label}</button>`).join('')}
        <button class="x" data-act="close">✕</button></div><div class="items">${items}</div></div>`;
    }
    if (menuOpen) {
      return `<div class="sheet"><div class="row head"><div class="grow"><b>设置</b><small>进度自动保存在本机</small></div><button class="x" data-act="close">✕</button></div>
        <div class="row"><button class="btn ghost" data-act="mute">声音：${s.settings.muted ? '关' : '开'}</button><button class="btn danger" data-act="reset">重新开始</button></div>
        <small class="tip">点工作点派工，点金币收钱，点虫虫喂食，点害虫驱赶，长按建筑可移动或收起。</small></div>`;
    }
    return `<div class="dock"><button class="btn big" data-act="shop">${icon('anthouse')}商店</button><button class="btn ghost big" data-act="menu">设置</button></div>`;
  }

  function render(): void {
    const game = app.game;
    const s = game.state;
    const need = game.xpToNext();
    const q = game.currentQuest();
    const qp = game.questProgress();
    const html = `
      <div class="top">
        <div class="pill">${icon('coin')}<b id="coins">${s.coins}</b></div>
        <div class="pill">${icon('icon_smile')}<b>${game.happiness()}</b></div>
        <div class="pill lvl">${icon('icon_star')}<b>${s.level} 级</b><div class="bar"><i style="width:${need ? Math.min(100, (s.xp / need) * 100) : 100}%"></i></div></div>
      </div>
      ${q && qp ? `<div class="quest"><b>任务：${q.title}</b><span>${q.desc}</span><em>${qp.value}/${qp.target}</em></div>` : '<div class="quest"><b>任务全部完成</b><span>继续打理你的花园吧。</span></div>'}
      <div class="bottom">${panelHtml()}</div>`;
    if (html === lastHtml) return;
    lastHtml = html;
    hud.innerHTML = html;
  }

  hud.addEventListener('click', (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const id = el.dataset.id ?? '';
    const game = app.game;
    const sel = app.selection;
    switch (el.dataset.act) {
      case 'shop': shopOpen = true; menuOpen = false; break;
      case 'menu': menuOpen = true; shopOpen = false; break;
      case 'tab': tab = id as Tab; break;
      case 'close': shopOpen = false; menuOpen = false; app.selection = null; break;
      case 'place': shopOpen = false; app.startPlacing(id); break;
      case 'buy': game.buyFood(id); break;
      case 'confirm': app.confirmPlacing(); break;
      case 'cancel': app.cancelPlacing(); break;
      case 'feed': if (sel?.kind === 'bug') game.feed(sel.uid, id); break;
      case 'upgrade': if (sel?.kind === 'building') game.upgrade(sel.uid); break;
      case 'move': if (sel?.kind === 'building') { const b = game.building(sel.uid); if (b) app.startPlacing(b.def, b.uid); } break;
      case 'remove': if (sel?.kind === 'building') { game.remove(sel.uid); app.selection = null; } break;
      case 'mute': app.toggleMute(); break;
      case 'reset': if (confirm('确定清空进度，重新开始吗？')) app.resetGame(); break;
    }
    render();
  });

  app.onUi(render);
  app.game.bus.on((e) => {
    if (e.type === 'toast') toast(e.text);
    else if (e.type === 'levelup') toast(`升到 ${e.level} 级了！`);
    else if (e.type === 'quest') toast(`任务完成：${e.quest.title}`);
    else if (e.type === 'pest') toast(e.kind === 'stink' ? '臭虫来捣乱了，点它赶走！' : '蚁狮挖了个坑，点它赶走！');
  });
  setInterval(render, 500);
  render();

  const off = app.offline;
  if (off && off.seconds > 60) {
    toast(`你离开了 ${Math.round(off.seconds / 60)} 分钟${off.finished ? `，虫虫完成了 ${off.finished} 项工作` : ''}`);
  }
}
