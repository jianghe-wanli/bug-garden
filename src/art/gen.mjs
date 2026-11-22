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

genAnt();
genBee();
genStink();
genAntlion();
genAnthouse();
genBeehive();
genIcons();
genEnv();

mkdirSync(OUT, { recursive: true });
for (const [name, f] of Object.entries(files)) writeFileSync(join(OUT, `${name}.svg`), f.svg.replace(/(\d)\.(\d)00\b/g, '$1.$2').replace(/(\d)\.0\b/g, '$1'));
console.log(`生成 ${Object.keys(files).length} 张贴图`);

// 总览图：把 svg/ 下所有贴图按组排在一页里，用来检查风格是否统一
const sheetAt = process.argv.indexOf('--sheet');
if (sheetAt > 0) {
  const GROUPS = [
    ['蚂蚁', /^ant(_|$)/], ['蜜蜂', /^bee(_|$)/], ['臭虫', /^stink/], ['蚁狮', /^antlion/],
    ['蚁窝 1~3 级', /^anthouse/], ['蜂房 1~3 级', /^beehive/],
    ['工作点与装饰', /^(junk|daisy|tulip|bell|pebble|clover|fence|mushroom)$/],
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
