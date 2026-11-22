// 贴图生成脚本：node src/art/gen.mjs [--sheet 输出.html]
// 动画帧、各等级建筑、场景点缀和特效贴图都由这里的参数化图形生成，保证描边、配色和比例一致。
// 原点 (0,0) 为脚底中心，按 120px 地块宽度设计。生成结果提交在 src/art/svg/ 下。
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'svg');
const INK = '#5a3118';

const DEFS = {
  antBody: '<linearGradient id="antBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f08a4b"/><stop offset="1" stop-color="#c9532a"/></linearGradient>',
  beeBody: '<linearGradient id="beeBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffdc5e"/><stop offset="1" stop-color="#f5a623"/></linearGradient>',
  bugBody: '<linearGradient id="bugBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6cf5a"/><stop offset="1" stop-color="#5f9a3a"/></linearGradient>',
  hive: '<linearGradient id="hive" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd978"/><stop offset=".6" stop-color="#f4b23f"/><stop offset="1" stop-color="#d98a22"/></linearGradient>',
  nut: '<linearGradient id="nut" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f6d9a4"/><stop offset=".65" stop-color="#e3b672"/><stop offset="1" stop-color="#c48f4c"/></linearGradient>',
  cap: '<linearGradient id="cap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a8703f"/><stop offset="1" stop-color="#6f4423"/></linearGradient>',
  glow: '<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6b0"/><stop offset="1" stop-color="#ffc24a"/></radialGradient>',
  sand: '<linearGradient id="sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dca6"/><stop offset="1" stop-color="#dcb878"/></linearGradient>',
  lion: '<linearGradient id="lion" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9a48f"/><stop offset="1" stop-color="#8f6a5c"/></linearGradient>',
  jaw: '<linearGradient id="jaw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8493c"/><stop offset="1" stop-color="#7c2a26"/></linearGradient>',
  bush: '<linearGradient id="bush" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ad35c"/><stop offset="1" stop-color="#5fa23c"/></linearGradient>',
  leaf: '<linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#93cf58"/><stop offset="1" stop-color="#4f9a3a"/></linearGradient>',
  beeClip: '<clipPath id="beeClip"><ellipse cx="-14" cy="-52" rx="34" ry="27"/></clipPath>',
  bark: '<linearGradient id="bark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c2905c"/><stop offset=".6" stop-color="#a06d3e"/><stop offset="1" stop-color="#77492a"/></linearGradient>',
  water: '<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe9fb"/><stop offset="1" stop-color="#7cc8f0"/></linearGradient>',
  gold: '<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#e9a41c"/></linearGradient>',
  rock: '<linearGradient id="rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dde2e5"/><stop offset="1" stop-color="#a9b1b8"/></linearGradient>',
};

const n = (v) => String(Math.round(v * 10) / 10);
const files = {};

function emit(name, vb, body) {
  const used = Object.keys(DEFS).filter((id) => body.includes(`url(#${id})`));
  const defs = used.length ? `<defs>${used.map((id) => DEFS[id]).join('')}</defs>` : '';
  files[name] = { vb, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}">${defs}${body}</svg>\n` };
}

const ink = (inner, sw = 3.5) => `<g stroke="${INK}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
const g = (attrs, inner) => `<g ${attrs}>${inner}</g>`;
/** 等比缩放路径数据（只含 M/L/Q/C 及其相对形式），描边粗细不受影响 */
const sc = (d, k) => d.replace(/-?\d*\.?\d+/g, (m) => n(parseFloat(m) * k));

// ---------------------------------------------------------------- 蚂蚁

const ANT_VB = [-80, -128, 172, 140];
const ANT_FAR = [{ h: [-8, -30], f: [-28, -2] }, { h: [0, -28], f: [-2, 0] }, { h: [10, -30], f: [26, -2] }];
const ANT_NEAR = [{ h: [-4, -34], f: [-30, -2] }, { h: [4, -32], f: [8, 0] }, { h: [12, -36], f: [34, -6] }];

function leg(L, p = {}, bob = 0) {
  const hx = L.h[0];
  const hy = L.h[1] + bob;
  const fx = p.to ? p.to[0] : L.f[0] + (p.dx ?? 0);
  const fy = p.to ? p.to[1] : L.f[1] - (p.lift ?? 0);
  const cx = hx + (fx - hx) * 0.72 + (p.kx ?? 0);
  const cy = hy + (fy - hy) * 0.42 - (p.lift ?? 0) * 0.4 + (p.ky ?? 0);
  return `<path d="M${n(hx)} ${n(hy)} Q${n(cx)} ${n(cy)} ${n(fx)} ${n(fy)}"/>`;
}

function antFace(eyes, mouth) {
  let e;
  if (eyes === 'blink') {
    e = '<path d="M13 -62 q7 5 14 0 M34 -62 q7 5 14 0" fill="none" stroke-width="3"/>';
  } else if (eyes === 'shut') {
    e = '<path d="M13 -69 l11 5 l-11 5 M49 -69 l-11 5 l11 5" fill="none" stroke-width="3"/>';
  } else if (eyes === 'down') {
    e = '<ellipse cx="20" cy="-64" rx="8" ry="10" fill="#fff"/><ellipse cx="41" cy="-64" rx="8" ry="10" fill="#fff"/>' +
      '<circle cx="23" cy="-59" r="4.5" fill="#2b1a10" stroke="none"/><circle cx="44" cy="-59" r="4.5" fill="#2b1a10" stroke="none"/>' +
      '<circle cx="24.5" cy="-61" r="1.6" fill="#fff" stroke="none"/><circle cx="45.5" cy="-61" r="1.6" fill="#fff" stroke="none"/>';
  } else {
    e = '<ellipse cx="20" cy="-64" rx="8" ry="10" fill="#fff"/><ellipse cx="41" cy="-64" rx="8" ry="10" fill="#fff"/>' +
      '<circle cx="22" cy="-62" r="4.5" fill="#2b1a10" stroke="none"/><circle cx="43" cy="-62" r="4.5" fill="#2b1a10" stroke="none"/>' +
      '<circle cx="23.5" cy="-64" r="1.6" fill="#fff" stroke="none"/><circle cx="44.5" cy="-64" r="1.6" fill="#fff" stroke="none"/>';
  }
  const m = mouth === 'open'
    ? '<ellipse cx="32" cy="-45" rx="5.5" ry="6" fill="#7a2e1e" stroke-width="3"/>'
    : mouth === 'effort'
      ? '<path d="M25 -45 q7 -5 14 0" fill="none" stroke-width="3"/>'
      : '<path d="M24 -48 q8 7 16 0" fill="none" stroke-width="3"/>';
  return e + m +
    '<ellipse cx="10" cy="-52" rx="5" ry="3" fill="#ff9d8a" stroke="none" opacity=".8"/><ellipse cx="50" cy="-52" rx="5" ry="3" fill="#ff9d8a" stroke="none" opacity=".8"/>';
}

function ant(o = {}) {
  const far = o.far ?? [{}, {}, {}];
  const near = o.near ?? [{}, {}, {}];
  const bob = o.bob ?? 0;
  const s = o.sway ?? 0;
  const s2 = o.sway2 ?? s;
  const h = { dx: 0, dy: 0, rot: 0, ...(o.head ?? {}) };
  const head = g(`transform="translate(${n(h.dx)} ${n(h.dy + bob)}) rotate(${n(h.rot)} 28 -62)"`,
    `<path d="M22 -84 Q${n(16 + s * 0.4)} -106 ${n(-2 + s)} ${n(-108 + Math.abs(s) * 0.25)}" fill="none" stroke-width="4"/>` +
    `<path d="M38 -84 Q${n(48 + s2 * 0.4)} -104 ${n(66 + s2)} ${n(-100 + Math.abs(s2) * 0.25)}" fill="none" stroke-width="4"/>` +
    `<circle cx="${n(-3 + s)}" cy="${n(-108 + Math.abs(s) * 0.25)}" r="5" fill="#ffd166"/><circle cx="${n(67 + s2)}" cy="${n(-100 + Math.abs(s2) * 0.25)}" r="5" fill="#ffd166"/>` +
    '<circle cx="28" cy="-62" r="27" fill="url(#antBody)"/>' +
    '<path d="M10 -78 q8 -9 20 -9" fill="none" stroke="#ffc59a" stroke-width="5" opacity=".8"/>' +
    antFace(o.eyes ?? 'open', o.mouth ?? 'smile'));
  const body =
    g('fill="none" stroke-width="5"', ANT_FAR.map((L, i) => leg(L, far[i], bob)).join('')) +
    `<ellipse cx="-34" cy="${n(-40 - bob * 0.6)}" rx="28" ry="23" fill="url(#antBody)"/>` +
    `<path d="M-52 ${n(-50 - bob * 0.6)} q10 -12 26 -10" fill="none" stroke="#ffc59a" stroke-width="5" opacity=".8"/>` +
    `<ellipse cx="0" cy="${n(-40 + bob)}" rx="15" ry="14" fill="url(#antBody)"/>` +
    g('fill="none" stroke-width="5"', ANT_NEAR.map((L, i) => leg(L, near[i], bob)).join('')) +
    head;
  return ink((o.pre ?? '') + (o.bodyT ? g(`transform="${o.bodyT}"`, body) : body) + (o.post ?? ''));
}

const dirt = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#c99a62" stroke-width="2"/>`).join('');
const drop = (x, y, rot) => `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 -7 q6 8 0 11 q-6 -3 0 -11z" fill="#9ad8f5" stroke-width="2"/>`;

function genAnt() {
  // 行走：三角步态，A 组（近侧前后腿 + 远侧中腿）与 B 组反相
  const N = 6;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const A = { dx: 9 * Math.cos(a), lift: 6 * Math.max(0, -Math.sin(a)) };
    const B = { dx: -9 * Math.cos(a), lift: 6 * Math.max(0, Math.sin(a)) };
    emit(`ant_walk_${i}`, ANT_VB, ant({
      near: [A, B, A], far: [B, A, B],
      bob: -1.5 * Math.abs(Math.sin(a)), sway: 5 * Math.sin(a), sway2: 5 * Math.sin(a - 0.9),
      head: { rot: 2.5 * Math.sin(a) },
    }));
  }
  // 待机：触角轻摆 + 眨眼
  emit('ant_idle_0', ANT_VB, ant({}));
  emit('ant_idle_1', ANT_VB, ant({ sway: 4, sway2: -3, bob: 1 }));
  emit('ant_idle_2', ANT_VB, ant({ eyes: 'blink', sway: 2, bob: 1 }));
  emit('ant_idle_3', ANT_VB, ant({ sway: -4, sway2: 4, head: { rot: -3 } }));
  // 干活：低头，前腿轮流刨，土粒飞溅
  const dig = [
    { near: { to: [44, -30], ky: -8 }, far: { dx: 4 }, head: 4, dust: [[52, -14, 3], [60, -22, 2.2]] },
    { near: { to: [40, -8] }, far: { to: [36, -26], ky: -8 }, head: 8, dust: [[56, -26, 3], [66, -18, 2.2], [48, -4, 2.5]] },
    { near: { to: [30, -4] }, far: { to: [46, -14] }, head: 5, dust: [[62, -32, 2.6], [70, -10, 2]] },
    { near: { to: [40, -24], ky: -6 }, far: { to: [34, -4] }, head: 2, dust: [[66, -36, 2], [56, -6, 2.5]] },
  ];
  dig.forEach((d, i) => emit(`ant_work_${i}`, ANT_VB, ant({
    near: [{}, {}, d.near], far: [{}, {}, d.far],
    head: { dx: 2, dy: d.head, rot: 10 + d.head * 0.8 }, bob: d.head * 0.25, sway: 4 - d.head, sway2: d.head - 3,
    eyes: 'down', mouth: i % 2 ? 'effort' : 'smile', post: dirt(d.dust),
  })));
  // 被困：半陷在沙里，仰头挥舞前腿，甩汗
  const sand = '<path d="M-50 -2 q4 -20 28 -18 q10 -8 24 -2 q16 -6 26 4 q18 0 22 16 q-50 14 -100 0z" fill="url(#sand)"/>' +
    '<path d="M-30 -10 q8 -4 14 0 M8 -12 q8 -4 14 0" fill="none" stroke="#fff3cf" stroke-width="3" opacity=".8"/>';
  const wave = [
    { a: [34, -74], b: [-34, -62], rot: -6, drops: [[-18, -98, -30], [62, -52, 60]] },
    { a: [42, -62], b: [-28, -76], rot: 0, drops: [[-28, -108, -30], [70, -60, 60], [-46, -46, -80]] },
    { a: [36, -78], b: [-36, -60], rot: 6, drops: [[66, -40, 70], [-54, -52, -80]] },
    { a: [44, -64], b: [-26, -74], rot: 0, drops: [[-10, -104, -20], [-58, -62, -80]] },
  ];
  wave.forEach((w, i) => emit(`ant_trapped_${i}`, ANT_VB, ant({
    bodyT: `translate(-6 6) rotate(${-20 + w.rot * 0.6} -10 -30)`,
    near: [{ to: [-34, -14] }, { to: [-4, -8] }, { to: [w.a[0], w.a[1]], kx: -6 }],
    far: [{ to: [-26, -14] }, { to: w.b, kx: 4 }, { to: [30, -14] }],
    head: { rot: w.rot }, sway: w.rot * 1.2, sway2: -w.rot,
    eyes: 'shut', mouth: 'open',
    post: sand + w.drops.map(([x, y, r]) => drop(x, y, r)).join(''),
  })));
}

// ---------------------------------------------------------------- 蜜蜂

const BEE_VB = [-82, -136, 168, 142];

function beeFace(eyes) {
  const e = eyes === 'happy'
    ? '<path d="M17 -57 q6 -7 12 0 M35 -57 q6 -7 12 0" fill="none" stroke-width="3"/>'
    : '<ellipse cx="23" cy="-60" rx="7" ry="9" fill="#fff"/><ellipse cx="41" cy="-60" rx="7" ry="9" fill="#fff"/>' +
      '<circle cx="25" cy="-58" r="4" fill="#2b1a10" stroke="none"/><circle cx="43" cy="-58" r="4" fill="#2b1a10" stroke="none"/>' +
      '<circle cx="26.3" cy="-60" r="1.4" fill="#fff" stroke="none"/><circle cx="44.3" cy="-60" r="1.4" fill="#fff" stroke="none"/>';
  return e + '<path d="M27 -46 q7 6 13 0" fill="none" stroke-width="3"/>' +
    '<ellipse cx="14" cy="-49" rx="4.5" ry="2.8" fill="#ff9d8a" stroke="none" opacity=".85"/><ellipse cx="49" cy="-49" rx="4.5" ry="2.8" fill="#ff9d8a" stroke="none" opacity=".85"/>';
}

function bee(o = {}) {
  const w = o.wing ?? 0; // 0 = 抬起，1 = 压下
  const ls = o.legs ?? 0;
  const rot1 = -28 - 62 * w;
  const rot2 = 12 - 78 * w;
  const ry = 1 - 0.28 * Math.sin(w * Math.PI);
  const wings =
    `<ellipse cx="-12" cy="-90" rx="14" ry="${n(24 * ry)}" fill="#dff4ff" opacity=".9" transform="rotate(${n(rot1)} -12 -68)"/>` +
    `<ellipse cx="-6" cy="-92" rx="14" ry="${n(26 * ry)}" fill="#eefaff" opacity=".95" transform="rotate(${n(rot2)} -6 -68)"/>`;
  const body =
    '<path d="M-48 -52 l-12 0" stroke-width="5"/>' + wings +
    '<ellipse cx="-14" cy="-52" rx="34" ry="27" fill="url(#beeBody)"/>' +
    '<g clip-path="url(#beeClip)" stroke="none" fill="#5a3a1c"><path d="M-40 -90 q10 38 0 76 l12 0 q10 -38 0 -76z"/><path d="M-18 -90 q10 38 0 76 l12 0 q10 -38 0 -76z"/></g>' +
    '<ellipse cx="-14" cy="-52" rx="34" ry="27" fill="none"/>' +
    '<path d="M-36 -68 q10 -9 24 -9" fill="none" stroke="#fff3b8" stroke-width="5" opacity=".8"/>' +
    g('fill="none" stroke-width="4"',
      `<path d="M-20 -28 q-2 8 ${n(-6 + ls)} 12"/><path d="M-4 -27 q2 8 ${n(ls)} 13"/><path d="M10 -30 q6 6 ${n(6 + ls)} 13"/>`) +
    `<path d="M24 -80 Q22 -98 ${n(10 + (o.sway ?? 0))} -102" fill="none" stroke-width="4"/><path d="M38 -80 Q46 -96 ${n(58 + (o.sway ?? 0))} -94" fill="none" stroke-width="4"/>` +
    `<circle cx="${n(9 + (o.sway ?? 0))}" cy="-103" r="4.500" fill="${INK}"/><circle cx="${n(59 + (o.sway ?? 0))}" cy="-95" r="4.500" fill="${INK}"/>` +
    '<circle cx="30" cy="-58" r="24" fill="url(#beeBody)"/>' +
    '<path d="M14 -72 q7 -8 17 -8" fill="none" stroke="#fff3b8" stroke-width="4.500" opacity=".8"/>' +
    beeFace(o.eyes ?? 'open');
  return ink((o.rot ? g(`transform="translate(${o.tx ?? 0} ${o.ty ?? 0}) rotate(${o.rot} 0 -52)"`, body) : body) + (o.post ?? ''));
}

const pollen = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffd34d" stroke-width="2"/>`).join('');

function genBee() {
  const flap = [0, 0.5, 1, 0.5];
  flap.forEach((w, i) => emit(`bee_fly_${i}`, BEE_VB, bee({ wing: w, legs: [0, 1.5, 0, -1.500][i], sway: [0, 1, 0, -1][i] })));
  // 采蜜：俯身埋头，花粉飘起
  const dots = [
    [[56, -22, 3], [66, -40, 2.200]],
    [[60, -30, 3], [68, -50, 2], [50, -12, 2.500]],
    [[64, -38, 2.600], [54, -18, 3]],
    [[68, -46, 2], [58, -24, 3], [48, -8, 2.200]],
  ];
  flap.forEach((w, i) => emit(`bee_work_${i}`, BEE_VB, bee({
    wing: w, rot: 20 + (i % 2 ? 6 : 0), tx: -2, ty: i % 2 ? 3 : 0, legs: i % 2 ? 4 : -2, sway: i % 2 ? 3 : -2, eyes: 'happy', post: pollen(dots[i]),
  })));
}

// ---------------------------------------------------------------- 臭虫

const STINK_VB = [-56, -140, 112, 146];

function stench(phase, big) {
  const base = big ? [[-36, -94], [-16, -100], [6, -98], [26, -100], [42, -92]] : [[-30, -92], [4, -98], [34, -90]];
  return g(`fill="none" stroke="#9b7fd1" stroke-width="4" opacity=".85"`, base.map(([x, y], i) => {
    const flip = (phase + i) % 2 ? 1 : -1;
    const rise = [0, -3, -6, -3][(phase + i) % 4];
    const h = big && i % 2 ? 10 : 8;
    return `<path d="M${x} ${y + rise} q${-8 * flip} ${-h} 0 ${-2 * h} q${8 * flip} ${-h} 0 ${-2 * h}"/>`;
  }).join(''));
}

function stink(o = {}) {
  const dy = o.dy ?? 0;
  const rot = o.rot ?? 0;
  const L = o.legs ?? [0, 0, 0];
  const legs = g('fill="none" stroke-width="5"',
    `<path d="M-26 ${-22 + dy} L${-42 + (o.spread ?? 0) * -1} ${-2 - L[0]}"/><path d="M-4 ${-16 + dy} l-4 ${16 - dy - L[1]}"/><path d="M22 ${-22 + dy} L${36 + (o.spread ?? 0)} ${-2 - L[2]}"/>`);
  const mouth = o.mouth === 'grin'
    ? '<path d="M-10 -46 q10 10 20 0z" fill="#3c5f22" stroke-width="3"/><path d="M-4 -45 l3 4 l3 -4" fill="#fff" stroke-width="1.500"/>'
    : o.mouth === 'scared'
      ? '<ellipse cx="0" cy="-42" rx="5" ry="6" fill="#3c5f22" stroke-width="3"/>'
      : '<path d="M-7 -44 q7 -5 14 0" fill="none" stroke-width="3"/>';
  const brows = o.mouth === 'scared'
    ? '<path d="M-24 -66 l16 -4" stroke-width="4"/><path d="M24 -66 l-16 -4" stroke-width="4"/>'
    : '<path d="M-24 -70 l16 6" stroke-width="4"/><path d="M24 -70 l-16 6" stroke-width="4"/>';
  const body = g(`transform="translate(0 ${dy}) rotate(${rot} 0 -20) scale(${o.sx ?? 1} ${o.sy ?? 1})"`,
    '<path d="M-40 -44 q2 -34 40 -36 q38 2 40 36 q-6 30 -40 34 q-34 -4 -40 -34z" fill="url(#bugBody)"/>' +
    '<path d="M0 -80 l0 68" fill="none" stroke-width="2.500" opacity=".6"/><path d="M-28 -50 q28 -16 56 0" fill="none" stroke-width="2.500" opacity=".6"/>' +
    '<circle cx="-18" cy="-34" r="5" fill="#4f8330" stroke="none"/><circle cx="18" cy="-34" r="5" fill="#4f8330" stroke="none"/>' +
    '<path d="M-26 -68 q10 -8 22 -8" fill="none" stroke="#dff2a8" stroke-width="5" opacity=".8"/>' +
    '<ellipse cx="-13" cy="-58" rx="8" ry="8" fill="#fff"/><ellipse cx="13" cy="-58" rx="8" ry="8" fill="#fff"/>' +
    `<circle cx="${-11 + (o.look ?? 0)}" cy="-56" r="4" fill="#2b1a10" stroke="none"/><circle cx="${11 + (o.look ?? 0)}" cy="-56" r="4" fill="#2b1a10" stroke="none"/>` +
    brows + mouth);
  return ink(legs + body + stench(o.phase ?? 0, o.big) + (o.post ?? ''));
}

function genStink() {
  [
    { legs: [7, 0, 0], rot: -5, dy: -2 }, { legs: [0, 0, 0], rot: 0, dy: 1 },
    { legs: [0, 0, 7], rot: 5, dy: -2 }, { legs: [0, 0, 0], rot: 0, dy: 1 },
  ].forEach((f, i) => emit(`stink_walk_${i}`, STINK_VB, stink({ ...f, phase: i })));
  // 捣乱：原地跺脚坏笑，臭气变浓
  [
    { sy: 1, legs: [0, 0, 0] }, { sy: 0.92, sx: 1.05, legs: [0, 0, 0], spread: 3 },
    { sy: 1, legs: [0, 0, 0] }, { sy: 1.06, sx: 0.97, dy: -5, legs: [5, 4, 5] },
  ].forEach((f, i) => emit(`stink_pester_${i}`, STINK_VB, stink({ ...f, phase: i, big: true, mouth: 'grin' })));
  // 逃跑：慌张
  [
    { legs: [9, 0, 0], rot: -8, dy: -3 }, { legs: [0, 0, 9], rot: 8, dy: -3 },
  ].forEach((f, i) => emit(`stink_flee_${i}`, STINK_VB, stink({ ...f, phase: i, mouth: 'scared', post: drop(i ? -44 : 44, -74, i ? -60 : 60) })));
}

// ---------------------------------------------------------------- 蚁狮

const LION_VB = [-66, -92, 132, 112];

function antlion(open, rise, grains) {
  // open: 0 张开 … 1 咬合
  const a = 30 - 44 * open;
  const jaw = (side) => g(`transform="translate(${side * 13} ${-40 - rise}) scale(${side} 1) rotate(${n(a)})"`,
    '<path d="M-3 4 q-4 -22 6 -36 q8 -8 12 -6 q-8 8 -7 18 q5 -3 6 2 q-5 2 -5 8 q5 0 5 5 q-6 0 -8 9z" fill="url(#jaw)"/>' +
    '<path d="M4 -24 q2 -8 7 -12" fill="none" stroke="#e98d7c" stroke-width="2.500" opacity=".8"/>');
  const pit =
    '<ellipse cx="0" cy="-8" rx="60" ry="24" fill="url(#sand)"/>' +
    '<path d="M-44 -16 q10 -8 26 -9 M26 -24 q12 2 20 8" fill="none" stroke="#fff6d8" stroke-width="3.500" opacity=".9"/>' +
    '<ellipse cx="0" cy="-7" rx="42" ry="15.500" fill="#c9995c" stroke-width="3"/>' +
    '<ellipse cx="0" cy="-5" rx="26" ry="9" fill="#8a5a30" stroke-width="3"/>';
  const head = g(`transform="translate(0 ${-rise})"`,
    '<path d="M-22 -6 q-3 -36 22 -38 q25 2 22 38 q-22 8 -44 0z" fill="url(#lion)"/>' +
    '<path d="M-14 -30 q5 -8 14 -9" fill="none" stroke="#f0d6c4" stroke-width="4" opacity=".8"/>' +
    '<ellipse cx="-8" cy="-22" rx="6" ry="7" fill="#fff"/><ellipse cx="8" cy="-22" rx="6" ry="7" fill="#fff"/>' +
    '<circle cx="-7" cy="-21" r="3.200" fill="#2b1a10" stroke="none"/><circle cx="9" cy="-21" r="3.200" fill="#2b1a10" stroke="none"/>' +
    '<path d="M-17 -32 l12 5 M17 -32 l-12 5" stroke-width="3.500"/>' +
    `<path d="M-6 -11 q6 ${n(4 - 6 * open)} 12 0" fill="none" stroke-width="3"/>`);
  const lip = '<path d="M-26 -5 q26 14 52 0 q-6 12 -26 12 q-20 0 -26 -12z" fill="#b98a52" stroke-width="3"/>';
  const dots = grains.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e8c88a" stroke-width="2"/>`).join('');
  return ink(pit + jaw(-1) + jaw(1) + head + lip + dots);
}

function genAntlion() {
  const fr = [
    [0, 0, [[-50, -30, 2.500], [48, -34, 2]]],
    [0.45, 3, [[-54, -40, 2.500], [52, -44, 2], [40, -30, 2.500]]],
    [1, 7, [[-56, -48, 2], [46, -40, 2.500], [-40, -34, 2.500]]],
    [0.45, 3, [[-44, -42, 2], [54, -36, 2.500]]],
  ];
  fr.forEach(([o, r, gr], i) => emit(`antlion_bite_${i}`, LION_VB, antlion(o, r, gr)));
  emit('antlion', LION_VB, antlion(0.2, 2, fr[0][2]));
}

// ---------------------------------------------------------------- 蚁窝（3 级）

const windowAt = (x, y, r) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#glow)"/><path d="M${x} ${y - r} l0 ${2 * r} M${x - r} ${y} l${2 * r} 0" stroke-width="2.500"/>`;

function acorn(k = 1, o = {}) {
  const s = (d) => sc(d, k);
  const tall = o.tall ?? 0; // 加高的墙体
  const capY = -tall;
  let out =
    `<path d="${s('M-52 -78')} m0 ${-tall} l0 ${tall} ${s('q-8 52 14 74 q38 14 76 0 q22 -22 14 -74')} l0 ${-tall}z" fill="url(#nut)"/>` +
    `<path d="${s('M-40 -66')} m0 ${-tall} l0 ${tall} ${s('q-4 34 8 52')}" fill="none" stroke="#fff1cf" stroke-width="${n(6 * Math.sqrt(k))}" opacity=".7"/>`;
  out += g(`transform="translate(0 ${capY})"`,
    `<path d="${s('M-70 -78 q-4 -50 70 -56 q74 6 70 56 q-70 22 -140 0z')}" fill="url(#cap)"/>` +
    g('fill="none" stroke="#c98f58" stroke-width="3" opacity=".7"',
      `<path d="${s('M-50 -92 q14 8 28 0 q14 8 28 0 q14 8 28 0 q10 6 18 0')}"/><path d="${s('M-40 -112 q12 8 26 0 q14 8 28 0 q12 8 26 0')}"/>`) +
    (o.band ? `<path d="${s('M-69 -82 q69 22 138 0')}" fill="none" stroke="#ffd34d" stroke-width="5"/><path d="${s('M-69 -82 q69 22 138 0')}" fill="none" stroke-width="1.500" transform="translate(0 4)" opacity=".5"/>` : '') +
    `<path d="${s('M0 -134 q-2 -16 10 -24')}" fill="none" stroke-width="${n(7 * Math.sqrt(k))}"/>` +
    `<path d="${s('M10 -158 q22 -14 34 4 q-18 14 -34 -4z')}" fill="#7cc04a"/>` +
    (o.leaf2 ? `<path d="${s('M8 -156 q-20 -16 -34 0 q18 14 34 0z')}" fill="#93cf58"/>` : '') +
    (o.attic ? `<path d="${s('M-14 -96 q0 -18 14 -18 q14 0 14 18z')}" fill="url(#glow)"/><path d="${s('M0 -114 l0 18 M-14 -96 l28 0')}" stroke-width="2.500"/>` : ''));
  out += `<path d="${s('M-16 -4 l0 -30 q16 -20 32 0 l0 30z')}" fill="#7a4a26"/><circle cx="${n(9 * k)}" cy="${n(-20 * k)}" r="${n(2.5 * Math.sqrt(k))}" fill="#ffd166" stroke="none"/>`;
  if (o.arch) out += `<path d="${s('M-21 -4 l0 -31 q21 -26 42 0 l0 31')}" fill="none" stroke="#ffd34d" stroke-width="4"/><path d="${s('M-24 -3 l0 -33 q24 -30 48 0 l0 33')}" fill="none" stroke-width="2.500"/>`;
  if (o.windows !== false) out += windowAt(n(-34 * k), n(-46 * k), n(12 * k)) + windowAt(n(36 * k), n(-46 * k), n(12 * k));
  return out;
}

const flowerBox = (x, y) => g(`transform="translate(${x} ${y})"`,
  '<path d="M-15 0 l30 0 l-3 9 l-24 0z" fill="#b9793f" stroke-width="3"/>' +
  '<circle cx="-8" cy="-4" r="4.500" fill="#ff8fa3" stroke-width="2.500"/><circle cx="1" cy="-6" r="4.500" fill="#fff" stroke-width="2.500"/><circle cx="9" cy="-4" r="4.500" fill="#ffd34d" stroke-width="2.500"/>');
const lantern = (x, y) => g(`transform="translate(${x} ${y})"`,
  '<path d="M0 0 l0 -34 q0 -10 10 -10" fill="none" stroke-width="5"/><path d="M4 -42 q6 -8 12 0 l2 14 q-8 6 -16 0z" fill="url(#glow)" stroke-width="3"/><path d="M5 -43 l10 0" stroke-width="4"/>');
const pennant = (x, y, c) => g(`transform="translate(${x} ${y})"`,
  `<path d="M0 0 l0 -30" stroke-width="4"/><path d="M0 -30 l24 7 l-24 8z" fill="${c}" stroke-width="3"/>`);
const step = (x, y, w) => `<path d="M${x - w} ${y} q${w} 8 ${2 * w} 0 l3 6 q${-w - 3} 9 ${-2 * w - 6} 0z" fill="#d9c3a0" stroke-width="3"/>`;

function genAnthouse() {
  // 2 级：阁楼窗、窗台花箱、门前石阶和一间小橡果偏屋
  emit('anthouse_2', [-90, -172, 202, 182], ink(
    g('transform="translate(-14 0)"', acorn(1, { attic: true }) + flowerBox(-34, -30) + step(0, -3, 20)) +
    g('transform="translate(72 2)"', acorn(0.5, { windows: false }) + windowAt(0, -52, 8)), 4));
  // 3 级：加高成两层、金色帽檐与拱门、两侧偏屋、路灯和小旗
  emit('anthouse_3', [-102, -204, 216, 216], ink(
    g('transform="translate(-20 0)"',
      acorn(1.04, { tall: 28, attic: true, band: true, arch: true, leaf2: true }) +
      windowAt(-36, -92, 10) + windowAt(0, -96, 10) + windowAt(36, -92, 10) +
      '<path d="M-54 -74 q54 16 108 0" fill="none" stroke="#b9793f" stroke-width="6"/><path d="M-54 -74 q54 16 108 0" fill="none" stroke-width="2" transform="translate(0 -4)" opacity=".6"/>' +
      flowerBox(-35, -30) + flowerBox(37, -30) + step(0, -3, 24) + pennant(46, -160, '#ff8a5c')) +
    g('transform="translate(70 4)"', acorn(0.52, { windows: false }) + windowAt(0, -54, 8)) +
    lantern(-90, 6), 4));
}

// ---------------------------------------------------------------- 蜂房（3 级）

function skep(k = 1, o = {}) {
  const s = (d) => sc(d, k);
  const rings = o.rings ?? ['M-52 -40 q52 14 104 0', 'M-50 -64 q50 14 100 0', 'M-40 -88 q40 12 80 0', 'M-26 -110 q26 8 52 0'];
  return `<path d="${s('M-58 -6 l116 0 l-8 -12 l-100 0z')}" fill="#9a6a3c"/>` +
    `<path d="${s(o.shape ?? 'M-48 -18 q-10 -24 -2 -44 q-4 -24 12 -40 q4 -22 38 -26 q34 4 38 26 q16 16 12 40 q8 20 -2 44z')}" fill="url(#hive)"/>` +
    g('fill="none" stroke-width="3" opacity=".55"', rings.map((d) => `<path d="${s(d)}"/>`).join('')) +
    `<path d="${s(o.shine ?? 'M-38 -84 q-8 22 -4 50')}" fill="none" stroke="#fff3c4" stroke-width="${n(6 * Math.sqrt(k))}" opacity=".75"/>` +
    `<ellipse cx="0" cy="${n(-30 * k)}" rx="${n(15 * k)}" ry="${n(13 * k)}" fill="#5b3414"/>`;
}
const knob = (x, y, c = '#ff8fa3') => `<path d="M${x} ${y + 18} l0 -14" stroke-width="6"/><circle cx="${x}" cy="${y}" r="7" fill="${c}"/>`;
const honeyDrop = (x, y) => `<path transform="translate(${x} ${y})" d="M0 0 q6 14 0 26 q-10 4 -8 -10 q2 -10 8 -16z" fill="#ffb300" stroke-width="3"/>`;
const honeyPot = (x, y) => g(`transform="translate(${x} ${y})"`,
  '<path d="M-13 -22 q-6 12 0 22 q13 6 26 0 q6 -10 0 -22z" fill="#e8955a" stroke-width="3"/><path d="M-15 -22 l30 0 l0 -6 l-30 0z" fill="#f6c58f" stroke-width="3"/>' +
  '<path d="M-10 -22 q2 8 6 4 q2 8 7 2 q3 4 7 -6z" fill="#ffb300" stroke-width="2.500"/>');
const TALL = 'M-48 -18 q-10 -24 -2 -44 q-6 -22 2 -42 q-2 -22 14 -36 q4 -20 34 -24 q30 4 34 24 q16 14 14 36 q8 20 2 42 q8 20 -2 44z';
const TALL_RINGS = ['M-52 -40 q52 14 104 0', 'M-52 -64 q52 14 104 0', 'M-50 -88 q50 14 100 0', 'M-44 -112 q44 12 88 0', 'M-30 -134 q30 9 60 0'];

function genBeehive() {
  // 2 级：多编一圈、亮灯的小窗、门口踏板和一罐蜂蜜
  emit('beehive_2', [-70, -186, 152, 198], ink(
    skep(1, { shape: TALL, rings: TALL_RINGS, shine: 'M-40 -108 q-10 30 -4 72' }) + knob(0, -168) +
    windowAt(-24, -76, 9) + honeyDrop(30, -92) +
    '<path d="M-22 -16 l44 0 l5 8 l-54 0z" fill="#c98f58" stroke-width="3"/>' +
    honeyPot(60, 2), 4));
  // 3 级：再加高、花环顶冠、侧边小蜂房、彩旗和蜂蜜罐
  const garland = [[-34, -134, '#ff8fa3'], [-17, -129, '#fff'], [0, -127, '#ffd34d'], [17, -129, '#fff'], [34, -134, '#ff8fa3']]
    .map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke-width="2.500"/><circle cx="${x}" cy="${y}" r="1.800" fill="#f2a900" stroke="none"/>`).join('');
  emit('beehive_3', [-96, -206, 188, 220], ink(
    g('transform="translate(-64 0)"', skep(0.5) + knob(0, -80, '#ffd34d')) +
    g('transform="translate(4 0)"',
      skep(1.08, { shape: TALL, rings: TALL_RINGS, shine: 'M-40 -108 q-10 30 -4 72' }) +
      '<path d="M-36 -136 q36 12 72 0" fill="none" stroke="#5fa23c" stroke-width="5"/>' + garland +
      '<path d="M-12 -176 l-4 -16 l10 8 l6 -12 l6 12 l10 -8 l-4 16z" fill="#ffd34d" stroke-width="3"/>' +
      windowAt(-28, -84, 9) + windowAt(28, -84, 9) + honeyDrop(34, -112) + honeyDrop(-44, -58) +
      '<path d="M-26 -16 l52 0 l6 9 l-64 0z" fill="#c98f58" stroke-width="3"/>') +
    honeyPot(68, 4), 4));
}

// ---------------------------------------------------------------- 图标与特效

function genIcons() {
  // 方糖：加深侧面与描边，白底面板上也看得清
  emit('sugar', [-34, -68, 84, 82], ink(
    '<path d="M0 -46 l28 14 l0 28 l-28 14 l-28 -14 l0 -28z" fill="#fff"/>' +
    '<path d="M0 -18 l28 -14 l0 28 l-28 14z" fill="#a9c6ea"/><path d="M0 -18 l-28 -14 l0 28 l28 14z" fill="#d3e3f6"/>' +
    '<path d="M-28 -32 l28 14 l28 -14" fill="none"/><path d="M0 -18 l0 28" fill="none"/>' +
    '<path d="M-19 -33 l19 -9.500" fill="none" stroke="#dbe8f8" stroke-width="3"/>' +
    '<g fill="#fff" stroke="none" opacity=".9"><circle cx="-18" cy="-12" r="2"/><circle cx="-9" cy="0" r="2"/><circle cx="-17" cy="2" r="1.600"/><circle cx="12" cy="-4" r="2"/><circle cx="20" cy="-14" r="1.600"/></g>' +
    '<path d="M36 -56 l3.500 9 l9 3.500 l-9 3.500 l-3.500 9 l-3.500 -9 l-9 -3.500 l9 -3.500z" fill="#ffe27a" stroke-width="2.500"/>', 4));
  emit('fx_spark', [-14, -14, 28, 28], ink('<path d="M0 -11 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" fill="#fff6b0"/>', 2.5));
  emit('fx_star', [-16, -16, 32, 32], ink('<path d="M0 -12.500 l3.800 8.300 l9.200 1 l-7 6.200 l2.200 9.200 l-8.200 -5 l-8.200 5 l2.200 -9.200 l-7 -6.200 l9.200 -1z" fill="#ffd34d"/>', 2.5));
  emit('fx_puff', [-20, -16, 40, 30], ink('<path d="M-12 8 q-8 -2 -5 -10 q-1 -9 8 -8 q5 -7 12 -1 q9 -2 9 7 q5 6 -3 11 q-10 4 -21 1z" fill="#fff8e6"/>', 2.5));
  emit('fx_heart', [-14, -13, 28, 26], ink('<path d="M0 10 q-16 -10 -10 -18 q5 -6 10 1 q5 -7 10 -1 q6 8 -10 18z" fill="#ff7f8f"/>', 2.5));
  emit('fx_leaf', [-12, -10, 24, 20], ink('<path d="M-9 4 q2 -14 18 -10 q-2 14 -18 10z" fill="#8ecb52"/><path d="M-6 3 q6 -2 11 -7" fill="none" stroke-width="1.500"/>', 2.5));
  emit('fx_stink', [-12, -16, 24, 32], `<path d="M0 12 q-8 -6 0 -12 q8 -6 0 -12" fill="none" stroke="#9b7fd1" stroke-width="4" stroke-linecap="round"/>`);
  emit('fx_alert', [-14, -22, 28, 40], ink('<path d="M-5 -18 l10 0 l-2.500 20 l-5 0z" fill="#ff6b5c"/><circle cx="0" cy="11" r="4" fill="#ff6b5c"/>', 2.5));
}

// ---------------------------------------------------------------- 场景点缀

function genEnv() {
  emit('env_tuft', [-26, -40, 52, 44], ink(
    '<path d="M-20 0 q-2 -14 -4 -22 q8 6 9 14 q0 -18 5 -30 q5 12 4 28 q4 -12 12 -18 q-2 12 -4 20 q6 -4 12 -4 q-6 6 -8 12z" fill="url(#bush)"/>' +
    '<path d="M-9 -6 q0 -12 0 -18" fill="none" stroke="#c6eb8d" stroke-width="2.500" opacity=".8"/>', 3));
  emit('env_bush', [-58, -70, 116, 76], ink(
    '<path d="M-48 0 q-12 -14 2 -26 q-4 -20 16 -22 q8 -18 28 -8 q18 -10 28 8 q20 2 14 24 q12 12 -2 24z" fill="url(#bush)"/>' +
    '<path d="M-34 -30 q4 -12 16 -12 M6 -50 q10 -4 18 4" fill="none" stroke="#c6eb8d" stroke-width="4" opacity=".8"/>' +
    '<path d="M-22 -8 q6 -6 12 0 M10 -16 q6 -6 12 0 M26 -2 q5 -5 10 0" fill="none" stroke-width="2.500" opacity=".45"/>' +
    '<g stroke-width="2.500"><circle cx="-14" cy="-30" r="4.500" fill="#ffd34d"/><circle cx="24" cy="-32" r="4.500" fill="#ff8fa3"/><circle cx="36" cy="-14" r="4" fill="#ffd34d"/></g>'));
  emit('env_leaf', [-64, -84, 128, 90], ink(
    '<path d="M0 0 q-4 -14 -2 -24" fill="none" stroke="#3f8f3a" stroke-width="6"/>' +
    '<path d="M-2 -22 q-52 6 -58 -34 q34 -22 58 34z" fill="url(#leaf)"/><path d="M-2 -22 q-22 -22 -48 -30" fill="none" stroke-width="2.500" opacity=".5"/>' +
    '<path d="M-2 -24 q50 4 60 -38 q-40 -16 -60 38z" fill="url(#leaf)"/><path d="M-2 -24 q22 -22 50 -34" fill="none" stroke-width="2.500" opacity=".5"/>' +
    '<path d="M-2 -24 q-22 -30 4 -58 q24 28 -4 58z" fill="#9ad35c"/><path d="M-2 -24 q0 -28 6 -52" fill="none" stroke-width="2.500" opacity=".5"/>' +
    '<path d="M-44 -50 q10 -6 18 -2" fill="none" stroke="#c6eb8d" stroke-width="4" opacity=".8"/>'));
  emit('env_reed', [-30, -112, 60, 116], ink(
    '<path d="M-14 0 q-6 -40 -10 -62 q14 18 16 60z" fill="#7cc04a"/><path d="M-2 0 q-4 -60 6 -104 q12 44 6 104z" fill="url(#bush)"/>' +
    '<path d="M10 0 q4 -44 16 -70 q0 30 -6 70z" fill="#6fb23e"/><path d="M4 -30 q0 -30 3 -52" fill="none" stroke="#c6eb8d" stroke-width="3" opacity=".8"/>', 3));
  emit('env_rock', [-42, -44, 84, 50], ink(
    '<path d="M-36 0 q-6 -22 12 -32 q16 -10 34 -2 q22 6 24 34z" fill="url(#rock)"/>' +
    '<path d="M-24 -18 q8 -10 20 -10" fill="none" stroke="#fff" stroke-width="4" opacity=".8"/>' +
    '<path d="M2 -34 q14 -4 22 6 q-12 4 -22 -6z" fill="#8ecb52" stroke-width="2.500"/><path d="M6 -6 l10 -8 l6 6" fill="none" stroke-width="2.500" opacity=".4"/>'));
  emit('env_bloom', [-22, -44, 44, 48], ink(
    '<path d="M0 0 q-2 -14 0 -24" fill="none" stroke="#3f8f3a" stroke-width="4.500"/><path d="M0 -8 q-12 -6 -16 2 q8 8 16 -2z" fill="#7cc04a" stroke-width="2.500"/>' +
    '<g fill="#ffd34d" stroke-width="2.500"><circle cx="0" cy="-37" r="6"/><circle cx="-9" cy="-30" r="6"/><circle cx="9" cy="-30" r="6"/><circle cx="-6" cy="-21" r="6"/><circle cx="6" cy="-21" r="6"/></g><circle cx="0" cy="-28" r="5" fill="#f2903c" stroke-width="2.500"/>', 3));
}

// ---------------------------------------------------------------- 第二批：新住宅、工作点与装饰

const el = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const ci = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const at = (x, y, inner, rot = 0, k = 1) => g(`transform="translate(${x} ${y}) rotate(${rot}) scale(${k})"`, inner);
const hi = (d, w = 4, o = 0.75) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" opacity="${o}"/>`;
const stemP = (d, w = 6) => `<path d="${d}" fill="none" stroke="#3f8f3a" stroke-width="${w}"/>`;
const leafP = (x, y, rot, k = 1, fill = '#7cc04a') => at(x, y, `<path d="M0 0 q-24 -14 -32 2 q16 14 32 -2z" fill="${fill}"/><path d="M-6 0 q-10 -2 -18 2" fill="none" stroke-width="2" opacity=".45"/>`, rot, k);
const shroom = (x, y, k = 1) => at(x, y, '<path d="M-5 0 q-2 -10 0 -14 l10 0 q2 4 0 14z" fill="#fff4dc" stroke-width="2.500"/><path d="M-15 -12 q0 -18 15 -18 q15 0 15 18 q-15 5 -30 0z" fill="#ef5a4c" stroke-width="3"/><circle cx="-6" cy="-19" r="2.500" fill="#fff" stroke="none"/><circle cx="5" cy="-23" r="2" fill="#fff" stroke="none"/><circle cx="8" cy="-15" r="2" fill="#fff" stroke="none"/>', 0, k);
const roundDoor = (x, y, r, gold = false) => ci(x, y, r, '#5b3414') + `<path d="M${x - r * 0.5} ${y + r * 0.2} q${r * 0.5} ${-r * 0.9} ${r} 0" fill="none" stroke="#8a5a30" stroke-width="2.500"/>` + (gold ? `<circle cx="${x}" cy="${y}" r="${r + 4}" fill="none" stroke="#ffd34d" stroke-width="4"/>` : '');

function stump(o = {}) {
  const h = o.h ?? 0;
  const top = -84 - h;
  return '<path d="M-66 -10 q-18 0 -30 12 q20 6 40 -2z M66 -10 q18 0 30 12 q-20 6 -40 -2z M-14 0 q-6 8 -20 10 q20 6 36 -4z" fill="url(#bark)"/>' +
    `<path d="M-72 -6 q-8 -36 -4 ${top + 6} q76 -24 152 0 q4 ${-top - 42} -4 ${-top - 6} q-72 18 -144 0z" fill="url(#bark)"/>` +
    g('fill="none" stroke-width="2.500" opacity=".4"', `<path d="M-52 -14 q-4 -24 0 ${top + 34} M-26 -8 q-2 -10 0 -22 M30 -6 q2 -16 0 -30 M56 -16 q4 -22 0 ${top + 40}"/>`) +
    `<path d="M-62 ${top + 16} q-4 30 0 ${-top - 40}" fill="none" stroke="#e3b98a" stroke-width="5" opacity=".6"/>` +
    el(0, top, 76, 21, '#f3dcae') + g('fill="none" stroke="#c99a62" stroke-width="2.500"', el(0, top, 52, 14, 'none') + el(-2, top, 28, 7.5, 'none') + `<path d="M40 ${top + 2} l30 4"/>`) +
    roundDoor(0, -26, 17, o.gold) + step(0, -5, 20);
}

function genStumpfort() {
  const VB1 = [-104, -132, 208, 148];
  // 1 级：矮树桩、三个小圆门窗、顶上一簇蘑菇
  emit('stumpfort', VB1, ink(stump() + windowAt(-42, -46, 10) + windowAt(42, -50, 10) + shroom(34, -88, 1) + shroom(52, -84, 0.7) + shroom(18, -84, 0.6), 4));
  // 2 级：顶上长出带门的小树节、梯子、窗台花箱
  const knot = (x, y, k) => at(x, y, '<path d="M-26 0 q-6 -30 0 -44 q26 -10 52 0 q6 14 0 44 q-26 8 -52 0z" fill="url(#bark)"/>' + el(0, -44, 27, 8, '#f3dcae') + el(0, -44, 14, 4, 'none', 'stroke="#c99a62" stroke-width="2"') + windowAt(0, -20, 9), 0, k);
  const ladder = (x, y, hh) => `<path d="M${x - 6} ${y} l0 ${-hh} M${x + 6} ${y} l0 ${-hh}" stroke-width="3.500"/><path d="${Array.from({ length: Math.floor(hh / 10) }, (_, i) => `M${x - 6} ${y - 6 - i * 10} l12 0`).join(' ')}" stroke-width="2.500"/>`;
  emit('stumpfort_2', [-104, -166, 208, 182], ink(
    stump({ h: 8 }) + knot(-26, -94, 1) + windowAt(-42, -50, 10) + windowAt(42, -54, 10) + windowAt(30, -24, 8) + flowerBox(-42, -34) +
    ladder(52, -22, 62) + shroom(36, -96, 1.1) + shroom(56, -92, 0.75) + shroom(14, -90, 0.6), 4));
  // 3 级：再加高，双层树节、金边大门、小旗和路灯，蘑菇成片
  emit('stumpfort_3', [-112, -206, 224, 222], ink(
    stump({ h: 26, gold: true }) + knot(-28, -112, 1.15) + knot(-28, -160, 0.72) + pennant(-28, -192, '#ff8a5c') +
    windowAt(-44, -62, 10) + windowAt(0, -70, 10) + windowAt(44, -66, 10) + windowAt(-40, -26, 8) + windowAt(40, -26, 8) +
    flowerBox(-44, -46) + flowerBox(44, -50) + '<path d="M-74 -52 q74 20 148 0" fill="none" stroke="#ffd34d" stroke-width="5"/>' +
    ladder(40, -112, 0) + shroom(38, -114, 1.25) + shroom(62, -110, 0.85) + shroom(16, -108, 0.7) + shroom(-70, 2, 0.8) + lantern(92, 8), 4));
}

function gourd(o = {}) {
  return '<path d="M0 -138 q-30 0 -28 28 q2 14 -8 22 q-22 18 -14 50 q10 32 50 32 q40 0 50 -32 q8 -32 -14 -50 q-10 -8 -8 -22 q2 -28 -28 -28z" fill="url(#hive)"/>' +
    '<path d="M-36 -64 q-10 22 4 44 M-18 -124 q-6 12 -2 24" fill="none" stroke="#fff3c4" stroke-width="6" opacity=".75"/>' +
    '<path d="M-30 -88 q30 10 60 0" fill="none" stroke-width="3" opacity=".4"/>' +
    '<path d="M0 -138 l0 -14" stroke="#3f8f3a" stroke-width="6"/>' +
    ci(0, -50, 15, '#5b3414') + (o.rim ? '<circle cx="0" cy="-50" r="19" fill="none" stroke="#ffd34d" stroke-width="4"/>' : '') +
    '<path d="M-14 -30 l28 0 l4 7 l-36 0z" fill="#c98f58" stroke-width="3"/>';
}
const trellis = (w, hh) => `<path d="M${-w} 4 l0 ${-hh} M${w} 4 l0 ${-hh}" stroke="#8a5a30" stroke-width="9"/><path d="M${-w} 4 l0 ${-hh} M${w} 4 l0 ${-hh}" stroke="#c98f58" stroke-width="3" opacity=".7"/>` +
  `<path d="M${-w - 12} ${-hh + 6} l${2 * w + 24} 0" stroke="#8a5a30" stroke-width="9"/>` +
  `<path d="M${-w - 8} ${-hh + 4} q${w * 0.5} -12 ${w} 0 q${w * 0.5} 12 ${w + 8} -2" fill="none" stroke="#3f8f3a" stroke-width="5"/>`;

function genGourdhive() {
  // 1 级：藤架上挂一只黄葫芦，腰上一个圆洞，两片藤叶
  emit('gourdhive', [-92, -176, 184, 190], ink(trellis(70, 160) + at(0, -2, gourd()) + leafP(-30, -158, 20, 1.1) + leafP(34, -156, 160, 1.1), 4));
  // 2 级：旁边多挂一只小葫芦，亮灯小窗和蜂蜜罐
  emit('gourdhive_2', [-98, -176, 200, 192], ink(trellis(76, 160) + at(-10, -2, gourd() + windowAt(0, -106, 9)) + at(52, -62, gourd(), 0, 0.5) +
    '<path d="M52 -138 l0 -18" stroke="#3f8f3a" stroke-width="5"/>' + leafP(-40, -158, 20, 1.1) + leafP(28, -156, 160, 1.1) + leafP(78, -150, 200, 0.9) + honeyDrop(22, -70) + honeyPot(-70, 6), 4));
  // 3 级：三只葫芦、金边洞口、藤上开花、蜜滴和两罐蜂蜜
  const bloom = (x, y, c) => ci(x, y, 7, c, 'stroke-width="2.500"') + ci(x, y, 2.2, '#f2a900', 'stroke="none"');
  emit('gourdhive_3', [-108, -196, 216, 212], ink(trellis(84, 180) + '<path d="M-52 -176 l0 30 M58 -176 l0 24" stroke="#3f8f3a" stroke-width="5"/>' +
    at(-52, -66, gourd(), 0, 0.56) + at(58, -74, gourd(), 0, 0.5) + at(2, -2, gourd({ rim: true }) + windowAt(0, -106, 9), 0, 1.12) +
    leafP(-74, -178, 10, 1.1) + leafP(30, -178, 165, 1.1) + leafP(90, -172, 200, 0.9) + bloom(-30, -180, '#ff8fa3') + bloom(-8, -184, '#fff') + bloom(70, -180, '#ffd34d') + bloom(48, -184, '#ff8fa3') +
    honeyDrop(26, -80) + honeyDrop(-36, -40) + honeyPot(-84, 8) + honeyPot(86, 8), 4));
}

function genWorkSites() {
  const chip = (x, y, r = 3) => ci(x, y, r, '#6b3a1e', 'stroke="none"');
  emit('crumbs', [-50, -50, 100, 60], ink(
    '<path d="M-40 -6 l6 -22 l22 -8 l14 12 l-4 18 l-24 6z" fill="#e8b46a"/>' + chip(-24, -20) + chip(-12, -12, 2.5) + chip(-30, -10, 2.5) + hi('M-30 -26 l14 -5', 3, 0.6) +
    '<path d="M2 -14 l12 -20 l22 4 l6 18 l-16 10z" fill="#dba25a"/>' + chip(18, -22, 2.5) + chip(28, -14, 2) + hi('M16 -30 l14 3', 3, 0.5) +
    '<path d="M-8 2 l8 -10 l14 2 l2 10 l-14 4z" fill="#e8b46a" stroke-width="3"/>' + chip(2, -1, 2) +
    g('fill="#e8b46a" stroke-width="2"', ci(-44, 2, 3, '#e8b46a') + ci(30, 4, 3.5, '#dba25a') + ci(42, -2, 2.5, '#e8b46a') + ci(-18, 6, 2.5, '#dba25a') + ci(-2, -40, 2.5, '#e8b46a'))));
  const lf = (x, y, rot, c, k = 1) => at(x, y, `<path d="M0 0 q-20 -18 -2 -44 q22 22 2 44z" fill="${c}"/><path d="M0 -4 q-2 -18 -1 -34 M-1 -18 l-8 -8 M0 -26 l8 -7" fill="none" stroke-width="2" opacity=".45"/>`, rot, k);
  emit('leafpile', [-82, -66, 164, 84], ink(
    el(0, -4, 44, 11, '#b9793f') + lf(-30, -2, -62, '#f2903c') + lf(32, -2, 64, '#e2553d') + lf(-14, -8, -24, '#ffd34d', 1.1) + lf(18, -8, 28, '#f2903c', 1.1) +
    lf(0, -14, 0, '#e2553d', 1.15) + lf(-34, 4, -98, '#ffd34d', 0.8) + lf(36, 4, 100, '#c9792f', 0.8) + lf(4, 2, 80, '#ffd34d', 0.75)));
  const berryB = (x, y, c, r = 8) => ci(x, y, r, c, 'stroke-width="3"') + ci(x - r * 0.3, y - r * 0.35, r * 0.28, '#fff', 'stroke="none" opacity=".85"');
  emit('berry', [-54, -78, 108, 86], ink(
    '<path d="M-42 0 q-12 -14 0 -26 q-6 -20 14 -24 q6 -18 28 -12 q20 -8 28 10 q20 4 14 26 q10 12 -4 26z" fill="url(#bush)"/>' +
    '<path d="M-28 -34 q4 -12 16 -12 M8 -56 q10 -4 18 4" fill="none" stroke="#c6eb8d" stroke-width="4" opacity=".8"/>' +
    berryB(-22, -18, '#e2483d') + berryB(-8, -30, '#8b5fc7', 7) + berryB(10, -16, '#e2483d', 9) + berryB(26, -30, '#8b5fc7') + berryB(30, -10, '#e2483d', 7) + berryB(-34, -4, '#8b5fc7', 6.5) + berryB(2, -44, '#e2483d', 6.5)));
  const cone = (x, y, rot, k = 1) => at(x, y, '<path d="M0 0 q-22 -6 -20 -30 q4 -22 20 -28 q16 6 20 28 q2 24 -20 30z" fill="url(#bark)"/>' +
    g('fill="none" stroke-width="2.500" opacity=".55"', '<path d="M-18 -18 q9 8 18 0 q9 8 18 0 M-19 -32 q9 8 19 0 q10 8 19 0 M-13 -45 q7 6 13 0 q6 6 13 0"/>') + hi('M-12 -44 q-4 10 -4 20', 3.5, 0.45), rot, k);
  const seed = (x, y, rot) => at(x, y, '<path d="M0 0 q-6 -8 0 -14 q6 6 0 14z" fill="#e3b672" stroke-width="2"/>', rot);
  emit('pinecone', [-56, -88, 112, 104], ink(cone(-20, -2, -12) + cone(22, -2, 14) + cone(0, -22, 0, 1.05) + seed(-42, 6, -70) + seed(42, 6, 60) + seed(4, 8, 90) + seed(-30, 8, 20)));
  emit('tincan', [-56, -64, 112, 74], ink(
    '<path d="M-42 -46 l56 0 q10 20 0 40 l-56 0 q-10 -20 0 -40z" fill="url(#rock)"/>' + '<path d="M-36 -46 q-8 20 0 40 l34 0 q-8 -20 0 -40z" fill="#e9a48e"/>' +
    '<path d="M-28 -34 q-3 8 0 16 M-14 -36 l8 0 M-14 -26 l10 0 M-14 -16 l8 0" fill="none" stroke-width="2.500" opacity=".4"/>' + hi('M-38 -42 l48 0', 3, 0.7) +
    '<path d="M4 -46 q-8 20 0 40 M-42 -46 q-8 20 0 40" fill="none" stroke-width="2.500" opacity=".5"/>' +
    el(14, -26, 9, 20, '#5b4a44') +
    '<path d="M18 -44 q26 -6 30 12 q-4 16 -26 16 q10 -14 -4 -28z" fill="url(#rock)"/>' + hi('M30 -38 q8 4 10 10', 3, 0.7) +
    ci(20, -12, 7, '#6fb2e8', 'stroke-width="2.500"') + ci(18, -13, 1.3, '#5a3118', 'stroke="none"') + ci(22, -11, 1.3, '#5a3118', 'stroke="none"') +
    ci(32, -4, 7, '#ffd34d', 'stroke-width="2.500"') + '<path d="M12 -26 l14 -10 l4 6z" fill="#ef5a4c" stroke-width="2.500"/>' + ci(46, 2, 3, '#c9792f', 'stroke-width="2"') + ci(-48, 4, 2.5, '#a9b1b8', 'stroke-width="2"')));
  emit('picnic', [-56, -86, 112, 94], ink(
    '<path d="M-34 -40 q34 -62 68 0" fill="none" stroke="#8a5a30" stroke-width="8"/><path d="M-34 -40 q34 -62 68 0" fill="none" stroke="#d9a55c" stroke-width="3"/>' +
    '<path d="M-22 -42 q-2 -18 14 -20 q14 0 14 14 l0 8z" fill="#e8b46a"/><path d="M-14 -52 l8 -4 M-6 -50 l8 -4" stroke-width="2" opacity=".5"/>' +
    ci(20, -48, 12, '#ef5a4c') + '<path d="M20 -60 q2 -6 8 -8" fill="none" stroke-width="3"/>' + hi('M13 -52 q1 -5 5 -7', 3, 0.7) + ci(34, -42, 8, '#8b5fc7', 'stroke-width="3"') +
    '<path d="M-40 -4 l-6 -36 l92 0 l-6 36 q-40 10 -80 0z" fill="#d9a55c"/>' +
    g('fill="none" stroke-width="2.500" opacity=".4"', '<path d="M-42 -28 q42 8 84 0 M-41 -16 q41 8 82 0 M-24 -38 l4 34 M0 -38 l0 38 M24 -38 l-4 34"/>') +
    '<path d="M-48 -42 l96 0 l-4 14 l-14 -6 l-12 8 l-14 -8 l-12 8 l-14 -8 l-12 8 l-10 -6z" fill="#fff"/>' +
    g('fill="#ef5a4c" stroke="none"', '<path d="M-44 -41 l14 0 l0 7 l-12 0z M-16 -41 l14 0 l0 7 l-14 0z M12 -41 l14 0 l0 7 l-14 0z M38 -41 l8 0 l-2 7 l-6 0z"/>')));
}

function genFlowers() {
  const petals = (cx, cy, n0, rx, ry, dist, fill) => Array.from({ length: n0 }, (_, i) => `<ellipse cx="${cx}" cy="${cy - dist}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${n((360 / n0) * i)} ${cx} ${cy})"/>`).join('');
  emit('sunflower', [-46, -138, 92, 144], ink(
    stemP('M0 0 q-5 -44 2 -92', 7) + leafP(0, -26, 0, 1.15) + leafP(0, -44, 180, 1.15) + leafP(0, -62, 14, 0.8) +
    petals(2, -100, 14, 7.5, 14, 22, '#ffc93c') + ci(2, -100, 19, '#7a4a26') +
    g('fill="#4f2c14" stroke="none"', ci(-5, -104, 2, '#4f2c14') + ci(4, -108, 2, '#4f2c14') + ci(9, -98, 2, '#4f2c14') + ci(-2, -94, 2, '#4f2c14') + ci(2, -101, 2, '#4f2c14')) +
    '<path d="M-10 -108 q4 -8 12 -9" fill="none" stroke="#b9793f" stroke-width="3" opacity=".8"/>'));
  const spike = (x, y, rot, k = 1) => at(x, y, stemP('M0 0 q-2 -30 0 -52', 4) +
    [[0, -54, 5.5], [-5, -60, 5], [5, -63, 5], [-4, -69, 5], [4, -73, 4.5], [-2, -79, 4.5], [2, -85, 4], [0, -91, 3.5]].map(([x1, y1, r], i) => ci(x1, y1, r, i % 2 ? '#a98be0' : '#8b6fd0', 'stroke-width="2.500"')).join(''), rot, k);
  emit('lavender', [-48, -104, 96, 110], ink(
    '<path d="M-6 0 q-18 -10 -26 -30 q16 8 26 30z M6 0 q18 -10 26 -30 q-16 8 -26 30z M0 0 q-4 -16 0 -34 q4 18 0 34z" fill="#8fbf6a" stroke-width="3"/>' +
    spike(-8, -2, -24, 0.92) + spike(8, -2, 24, 0.92) + spike(-3, -2, -8) + spike(4, -2, 9, 1.05)));
  emit('rose', [-42, -112, 84, 118], ink(
    stemP('M0 0 q-4 -36 2 -70', 6) + '<path d="M-2 -20 l-8 -4 M1 -36 l8 -5 M-2 -50 l-7 -4" stroke="#3f8f3a" stroke-width="3.500"/>' + leafP(-1, -28, 8, 1.05, '#5fa23c') + leafP(1, -44, 172, 1.05, '#5fa23c') +
    '<path d="M-14 -66 q-10 -8 -22 -4 q10 14 22 4z M16 -66 q10 -8 22 -4 q-10 14 -22 4z" fill="#7cc04a" stroke-width="3"/>' +
    '<path d="M-26 -84 q-4 -24 26 -24 q30 0 26 24 q-4 22 -26 22 q-22 0 -26 -22z" fill="#ff8fa3"/>' +
    '<path d="M-26 -84 q8 14 26 10 q18 4 26 -10 q-2 22 -26 22 q-24 0 -26 -22z" fill="#ff6f8e"/>' +
    '<path d="M-14 -90 q2 -14 14 -14 q14 0 14 12 q0 10 -12 10 q-8 0 -8 -7 q0 -5 6 -5" fill="#ffb3c1"/>' + hi('M-20 -92 q2 -10 10 -13', 3.5, 0.7)));
}

function genDecor() {
  const fluff = (x, y, rot) => at(x, y, '<path d="M0 0 l0 -8" fill="none" stroke-width="2"/><path d="M-7 -9 q7 -9 14 0 q-7 3 -14 0z" fill="#fffdf5" stroke-width="2"/><circle cx="0" cy="1" r="2" fill="#c99a62" stroke-width="1.500"/>', rot);
  emit('dandelion', [-46, -116, 108, 122], ink(
    '<path d="M0 0 q-10 -6 -14 -16 l-6 2 q-2 -8 -10 -10 q6 14 30 24z M0 0 q10 -6 14 -16 l6 2 q2 -8 10 -10 q-6 14 -30 24z" fill="#7cc04a" stroke-width="3"/>' +
    stemP('M0 0 q-4 -30 2 -56', 4.5) + ci(2, -72, 22, '#fffdf5') +
    g('fill="none" stroke-width="2" opacity=".4"', Array.from({ length: 12 }, (_, i) => `<path d="M2 -72 l0 -17" transform="rotate(${i * 30} 2 -72)"/>`).join('')) +
    ci(2, -72, 5, '#e9dcb8', 'stroke-width="2.500"') + fluff(32, -84, 24) + fluff(40, -60, 40) + fluff(26, -98, 10)));
  emit('shell', [-46, -66, 92, 74], ink(
    el(18, -2, 22, 6, '#b9793f', 'opacity=".35" stroke="none"') +
    '<path d="M-30 -6 q-14 -22 6 -42 q22 -18 44 -2 q20 18 6 40 q-10 12 -28 10 q-18 4 -28 -6z" fill="url(#nut)"/>' +
    '<path d="M-30 -6 q-10 -4 -8 -16 q10 -10 22 -2 q8 10 -4 18z" fill="#7a4a26"/>' +
    '<path d="M4 -8 q22 -2 22 -22 q-2 -18 -20 -18 q-16 2 -16 16 q2 12 14 11 q9 -2 8 -10 q-2 -6 -8 -5" fill="none" stroke="#b9793f" stroke-width="5"/>' + hi('M-14 -44 q8 -8 18 -8', 4, 0.7)));
  emit('lantern', [-40, -112, 84, 118], ink(
    '<path d="M-14 0 q-6 -50 0 -84 q4 -18 26 -16" fill="none" stroke="#8a5a30" stroke-width="8"/><path d="M-15 -8 q-4 -40 1 -70" fill="none" stroke="#c98f58" stroke-width="2.500" opacity=".7"/>' +
    leafP(-14, -60, 10, 0.8) + '<path d="M-22 0 q8 -6 18 0" fill="none" stroke-width="3"/>' +
    '<path d="M12 -100 l0 12" stroke-width="3"/><path d="M2 -88 l20 0 l-3 -6 l-14 0z" fill="#8a5a30" stroke-width="3"/>' +
    '<path d="M0 -88 q-8 22 0 40 l24 0 q8 -18 0 -40z" fill="url(#glow)"/>' + ci(12, -66, 16, '#fff6b0', 'stroke="none" opacity=".45"') +
    '<path d="M0 -48 l24 0 l-3 6 l-18 0z" fill="#8a5a30" stroke-width="3"/>' + ci(12, -66, 4.5, '#fffbe0', 'stroke="#f2a900" stroke-width="2"') + hi('M4 -82 q-3 10 -1 20', 3, 0.8)));
  emit('swing', [-50, -110, 100, 116], ink(
    '<path d="M-38 0 q8 -60 34 -100 q-10 50 -22 100z" fill="url(#bush)"/><path d="M38 0 q-8 -60 -34 -100 q10 50 22 100z" fill="#7cc04a"/>' +
    '<path d="M-10 -94 l20 0" stroke="#8a5a30" stroke-width="6"/><path d="M-12 -80 l0 52 M12 -80 l0 52" stroke="#c99a62" stroke-width="3"/>' +
    '<path d="M-24 -26 q24 -12 48 0 q-24 14 -48 0z" fill="#93cf58"/><path d="M-18 -26 l36 0" fill="none" stroke-width="2" opacity=".45"/>' + hi('M-26 -40 q6 -24 14 -40', 3, 0.5)));
  const blade = (rot, c, c2) => `<g transform="rotate(${rot} 0 -78)"><path d="M0 -78 l-3 -38 q28 4 27 24z" fill="${c}"/><path d="M0 -78 l24 -14 l-5 17z" fill="${c2}" stroke-width="2.500"/></g>`;
  emit('windmill', [-44, -122, 88, 128], ink(
    '<path d="M0 0 l0 -78" stroke="#c98f58" stroke-width="6"/><path d="M-12 0 q12 -8 24 0" fill="none" stroke-width="3"/>' +
    g('transform="rotate(12 0 -78)"', blade(0, '#ff7f6a', '#ffb3a6') + blade(90, '#ffd34d', '#ffe9a0') + blade(180, '#7cc8f0', '#bfe6fa') + blade(270, '#8ecb52', '#c6eb8d')) + ci(0, -78, 6, '#fff', 'stroke-width="3"')));
  emit('statue', [-44, -112, 88, 120], ink(
    '<path d="M-30 4 l4 -30 l52 0 l4 30z" fill="url(#rock)"/><path d="M-34 -26 l68 0 l-4 -10 l-60 0z" fill="#e6eaec"/>' + hi('M-22 -20 l-2 16', 3.5, 0.7) + '<path d="M-10 -12 l20 0" stroke-width="2.500" opacity=".4"/>' +
    at(-2, -34, ant({ sway: 3 }).replaceAll('url(#antBody)', 'url(#gold)'), 0, 0.52) +
    '<path d="M22 -70 q10 -12 8 -24" fill="none" stroke-width="3.500"/>' +
    at(30, -96, '<path d="M0 -12 l10 5 l0 11 l-10 5 l-10 -5 l0 -11z" fill="#fff" stroke-width="2.500"/><path d="M0 -2 l10 -5 l0 11 l-10 5z" fill="#a9c6ea" stroke-width="2.500"/><path d="M0 -2 l-10 -5" stroke-width="2.500"/>') +
    at(-30, -70, '<path d="M0 -8 l2.500 5.500 l5.500 2.500 l-5.500 2.500 l-2.500 5.500 l-2.500 -5.500 l-5.500 -2.500 l5.500 -2.500z" fill="#fff6b0" stroke-width="2"/>')));

  // ---- 2×2：按两格见方的菱形占地来画，原点在占地中心偏下（与蚁窝、蜂房同一套摆放规则）
  const stones = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const r = 8 + (i % 3) * 2;
    return el(n(Math.cos(a) * 98), n(-30 + Math.sin(a) * 47), r, n(r * 0.72), 'url(#rock)', 'stroke-width="3"');
  });
  emit('pond', [-114, -88, 228, 116], ink(
    el(0, -30, 98, 47, 'url(#water)') + stones.slice(9).concat(stones.slice(0, 9)).join('') +
    g('fill="none" stroke="#fff" stroke-width="3" opacity=".8"', '<path d="M-60 -44 q14 -8 30 -6 M-50 -34 q8 -4 16 -3 M20 -8 q14 4 28 0 M34 -52 q8 -3 16 0"/>') +
    '<path d="M-10 -22 q-2 -16 22 -18 q26 2 24 18 q-4 14 -24 14 l2 -12 l-14 10 q-8 -4 -10 -12z" fill="#7cc04a"/><path d="M14 -24 l14 -8 M14 -24 l16 4" fill="none" stroke-width="2" opacity=".4"/>' +
    at(-44, -24, ci(0, 0, 6, '#ff8fa3', 'stroke-width="2.500"') + ci(-7, 3, 5, '#ffb3c1', 'stroke-width="2.500"') + ci(7, 3, 5, '#ffb3c1', 'stroke-width="2.500"') + ci(0, 2, 2.5, '#ffd34d', 'stroke="none"')) +
    at(-84, 2, '<path d="M0 0 q-2 -16 -4 -24 q8 6 9 14 q0 -18 5 -30 q5 12 4 28 q6 -8 10 -10 q-2 12 -6 22z" fill="url(#bush)" stroke-width="3"/>', 0, 0.9)));
  const bowl = (y, k, c, c2) => at(0, y, '<path d="M-60 0 q60 40 120 0 q-8 -18 -30 -8 q-12 -16 -30 -4 q-18 -12 -30 4 q-22 -10 -30 8z" fill="' + c + '"/><path d="M-60 0 q60 40 120 0 q-60 20 -120 0z" fill="' + c2 + '" stroke-width="2.500"/>', 0, k);
  const dropW = (x, y, k = 1) => at(x, y, '<path d="M0 -8 q7 9 0 13 q-7 -4 0 -13z" fill="#bfe6fa" stroke-width="2"/>', 0, k);
  emit('fountain', [-104, -166, 208, 186], ink(
    el(0, -22, 96, 40, 'url(#rock)') + el(0, -28, 80, 30, 'url(#water)') + hi('M-84 -14 q20 22 60 26', 4, 0.7) +
    g('fill="none" stroke="#fff" stroke-width="3" opacity=".8"', '<path d="M-56 -30 q10 -5 22 -3 M34 -18 q12 3 24 -1"/>') +
    '<path d="M-10 -24 q-4 -60 0 -110 l20 0 q4 50 0 110z" fill="#e6eaec"/>' +
    g('fill="none" stroke="#9fd6f2" stroke-width="5" opacity=".9"', '<path d="M-48 -52 q-8 14 -6 26 M48 -52 q8 14 6 26 M-30 -92 q-8 12 -8 24 M30 -92 q8 12 8 24"/>') +
    bowl(-58, 1, '#ff9fb5', '#ff7f9c') + bowl(-98, 0.66, '#ffb9c8', '#ff9fb5') + bowl(-130, 0.38, '#ffd3dc', '#ffb9c8') +
    dropW(0, -150, 1.5) + dropW(-16, -142) + dropW(16, -142) + dropW(-28, -124, 0.8) + dropW(28, -124, 0.8)));
  const BANDS = ['#ef5a4c', '#f2903c', '#ffd34d', '#8ecb52', '#6cc5e8', '#6f8fe0', '#a98be0'];
  const arc = (r, extra) => `<path d="M${-r} -8 A${r} ${n(r * 1.12)} 0 0 1 ${r} -8" fill="none" ${extra}/>`;
  const tuftB = (x) => at(x, 0, '<path d="M-22 0 q-10 -12 2 -20 q2 -14 18 -10 q14 -6 20 8 q10 10 -2 22z" fill="url(#bush)" stroke-width="3"/>' +
    ci(-8, -12, 5, '#ff8fa3', 'stroke-width="2.500"') + ci(6, -18, 5, '#fff', 'stroke-width="2.500"') + ci(14, -6, 5, '#ffd34d', 'stroke-width="2.500"') + ci(-2, -2, 4, '#a98be0', 'stroke-width="2.500"'));
  emit('rainbow', [-116, -128, 232, 138],
    `<g stroke-linecap="butt">${arc(78, `stroke="${INK}" stroke-width="63"`)}${BANDS.map((c, i) => arc(102 - i * 8, `stroke="${c}" stroke-width="8.500"`)).join('')}` +
    BANDS.map((_, i) => arc(102 - i * 8, 'stroke="#fff" stroke-width="5.500" stroke-dasharray="0.1 11" stroke-linecap="round" opacity=".38"')).join('') + '</g>' +
    ink(tuftB(-80) + tuftB(80)));
}

function genBatch2() {
  genStumpfort();
  genGourdhive();
  genWorkSites();
  genFlowers();
  genDecor();
}

genAnt();
genBee();
genStink();
genAntlion();
genAnthouse();
genBeehive();
genIcons();
genEnv();
genBatch2();

mkdirSync(OUT, { recursive: true });
for (const [name, f] of Object.entries(files)) writeFileSync(join(OUT, `${name}.svg`), f.svg.replace(/(\d)\.(\d)00\b/g, '$1.$2').replace(/(\d)\.0\b/g, '$1'));
console.log(`生成 ${Object.keys(files).length} 张贴图`);

// 总览图：把 svg/ 下所有贴图按组排在一页里，用来检查风格是否统一
const sheetAt = process.argv.indexOf('--sheet');
if (sheetAt > 0) {
  const GROUPS = [
    ['蚂蚁', /^ant(_|$)/], ['蜜蜂', /^bee(_|$)/], ['臭虫', /^stink/], ['蚁狮', /^antlion/],
    ['蚁窝 1~3 级', /^anthouse/], ['蜂房 1~3 级', /^beehive/],
    ['树桩蚁堡 1~3 级', /^stumpfort/], ['葫芦蜂巢 1~3 级', /^gourdhive/],
    ['蚂蚁工作点', /^(junk|crumbs|leafpile|berry|pinecone|tincan|picnic)$/], ['蜜蜂工作点', /^(daisy|tulip|bell|sunflower|lavender|rose)$/],
    ['装饰', /^(pebble|clover|fence|dandelion|mushroom|shell|lantern|swing|windmill|statue)$/], ['2×2 装饰', /^(pond|fountain|rainbow)$/],
    ['食物与图标', /^(sugar|cookie|cake|coin|icon_)/], ['特效', /^fx_/], ['场景', /^(env_|tile_|shadow)/],
  ];
  const all = readdirSync(OUT).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const cell = (k) => {
    const src = readFileSync(join(OUT, `${k}.svg`), 'utf8');
    const h = Number(/height="([\d.]+)"/.exec(src)[1]);
    return `<figure><div><img style="height:${Math.round(h * 0.8)}px" src="data:image/svg+xml;base64,${Buffer.from(src).toString('base64')}"></div><figcaption>${k}</figcaption></figure>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;width:1500px;font-family:system-ui,"Noto Sans CJK SC",sans-serif;color:#5a3118;background:linear-gradient(#cdeffd,#eaf8d8)}
h1{font-size:26px;margin:0 0 6px}h2{font-size:18px;margin:18px 0 8px}
section{display:flex;flex-wrap:wrap;gap:10px;align-items:stretch}
figure{margin:0;background:#fffdf5;border:2px solid #dccfae;border-radius:14px;padding:8px 10px 4px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
figure div{flex:1;display:flex;align-items:flex-end}figcaption{font-size:11px;margin-top:4px;opacity:.75}
section.dark figure{background:#8ecb52}</style><h1>虫虫花园 · 贴图总览</h1>
${GROUPS.map(([title, re]) => `<h2>${title}</h2><section class="${title === '特效' || title === '场景' ? 'dark' : ''}">${all.filter((k) => re.test(k)).map(cell).join('')}</section>`).join('')}`;
  writeFileSync(process.argv[sheetAt + 1], html);
}
