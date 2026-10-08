// EIG Day 2 On-Demand: broadcast graphics. Each piece is a pure function of time.
//   await setup(piece, spec) builds the DOM and resolves when images are decoded; seek(t) paints time t.
// Pieces: intro (opaque, 8 s), outro (opaque, 7 s), lt (lower third, alpha), chapter (chapter card, alpha).
(() => {
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: t => t,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outBack: t => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const P = (t, a, b, e = E.outExpo) => e(clamp((t - a) / (b - a)));
const IMG = '../site/assets/img/', SPK = '../site/assets/speakers/';
const stage = document.getElementById('stage');

function el(parent, cls = '', css = {}, html = '', tag = 'div') {
  const d = document.createElement(tag); if (cls) d.className = cls; Object.assign(d.style, css);
  if (html) d.innerHTML = html; parent.appendChild(d); return d;
}
function img(parent, src, cls = '', css = {}) { const i = el(parent, cls, css, '', 'img'); i.src = src; return i; }
const S = (e, css) => { for (const k in css) e.style[k] = css[k]; };
function words(parent, text, cls = '', css = {}) {
  const d = el(parent, cls, css); d.ws = [];
  String(text).split(' ').forEach((p, i, a) => {
    const w = el(d, 'w', {}, '', 'span'), wi = el(w, 'wi', {}, '', 'span');
    wi.textContent = p; d.ws.push(wi); if (i < a.length - 1) d.appendChild(document.createTextNode(' '));
  });
  return d;
}
function rise(e, t, t0, st = .055, dur = .7, from = 108) {
  e.ws.forEach((w, i) => { const p = P(t, t0 + i * st, t0 + i * st + dur, E.outQuint); w.style.transform = `translateY(${(1 - p) * from}%)`; });
}
function fadeUp(e, t, t0, dur = .7, dy = 18) { const p = P(t, t0, t0 + dur, E.outCubic); S(e, { opacity: p, transform: `translateY(${(1 - p) * dy}px)` }); }
const splitTitle = s => { const i = String(s).indexOf(': '); return i > 0 ? [s.slice(0, i), s.slice(i + 2)] : [s, '']; };
const nameList = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' & ' + a[a.length - 1];

function speakerRow(parent, list, size = 80) {
  const cols = list.length === 4 ? 2 : Math.min(list.length, 3);
  const colW = list.length === 1 ? 'auto' : list.length === 2 ? '620px' : list.length === 3 ? '520px' : '600px';
  const row = el(parent, '', { display: 'grid', gridTemplateColumns: `repeat(${cols}, ${colW})`, gap: '28px 40px' });
  return list.map(s => {
    const it = el(row, '', { display: 'flex', alignItems: 'center', gap: '20px' });
    const av = el(it, 'av', { width: size + 'px', height: size + 'px', flex: 'none' }); img(av, SPK + s.id + '.webp');
    const tx = el(it, '', { minWidth: 0 });
    const nm = el(tx, 'sans', { font: '600 30px/1.1 var(--sans)', whiteSpace: 'nowrap' });
    nm.textContent = s.name; if (s.note) el(nm, 'chip', {}, '', 'span').textContent = s.note;
    el(tx, 'sans', { font: '400 20px/1.3 var(--sans)', color: 'var(--dim)', marginTop: '7px', maxWidth: list.length === 1 ? '900px' : '420px' }).textContent = s.role || '';
    return { it, av };
  });
}

/* ------------------------------------------------------------------ intro */
function intro(spec) {
  stage.className = 'opaque';
  const [main, sub] = splitTitle(spec.title);
  const bgw = el(stage, 'full'), bg = img(bgw, IMG + 'glass-2000.webp', 'cover');
  el(stage, 'full', { background: 'linear-gradient(90deg, rgba(5,10,21,.94) 0%, rgba(5,10,21,.84) 42%, rgba(5,10,21,.5) 100%)' });
  el(stage, 'full', { background: 'radial-gradient(ellipse 80% 70% at 78% 30%, rgba(5,10,21,0) 0%, rgba(5,10,21,.55) 80%)' });
  const sweep = el(stage, 'abs', { left: '0', top: '-30%', width: '34%', height: '160%', mixBlendMode: 'screen',
    background: 'linear-gradient(90deg, rgba(232,179,138,0), rgba(232,179,138,.10) 40%, rgba(255,226,200,.22) 50%, rgba(232,179,138,.10) 60%, rgba(232,179,138,0))' });
  const blackout = el(stage, 'full', { background: '#000' });

  // brand lockup: starts centred and large, settles top-left
  const lock = el(stage, 'abs', { left: 0, top: 0, transformOrigin: '0 0', display: 'flex', alignItems: 'center', gap: '22px' });
  const markW = el(lock, '', { flex: 'none' }); const mark = img(markW, IMG + 'eig-mark.png', '', { height: '80px', width: 'auto', display: 'block' });
  const lt = el(lock, '');
  const l1 = words(lt, 'EIG Innovation Conference', 'serif', { fontSize: '42px', lineHeight: '1' });
  const l2 = words(lt, 'Austin 2026 · Day 2', 'kick', { fontSize: '15px', marginTop: '12px', color: 'var(--dim)', letterSpacing: '.36em' });

  // session block
  const blk = el(stage, 'abs', { left: '120px', right: '120px', top: '150px', bottom: '170px', display: 'flex', flexDirection: 'column', justifyContent: 'center' });
  const kick = words(blk, `Session ${spec.num} of ${spec.of}  ·  ${spec.track}`, 'kick', { marginBottom: '30px' });
  const ttl = words(blk, main, 'serif', { fontSize: main.length > 34 ? '112px' : '132px', lineHeight: '.98', maxWidth: '1560px' });
  const stl = sub ? words(blk, sub, 'serif', { fontSize: '58px', lineHeight: '1.08', fontStyle: 'italic', color: 'var(--copper-hi)', marginTop: '18px', maxWidth: '1500px' }) : null;
  const rule = el(blk, 'rule', { width: '520px', marginTop: '44px', marginBottom: '40px' });
  const spk = speakerRow(blk, spec.speakers);
  const meta = el(stage, 'abs', { left: '120px', right: '120px', bottom: '84px', display: 'flex', justifyContent: 'space-between' });
  const m1 = el(meta, 'kick', { fontSize: '15px', color: 'var(--faint)', letterSpacing: '.3em' }, 'Thursday, September 10, 2026  ·  Austin, Texas');
  const m2 = el(meta, 'kick', { fontSize: '15px', color: 'var(--faint)', letterSpacing: '.3em' }, 'consultingeig.com');

  let geo = null;
  return t => {
    if (!geo) { const w = lock.offsetWidth, h = lock.offsetHeight, s = 1.9; geo = { s, x0: (1920 - w * s) / 2, y0: (1080 - h * s) / 2 - 10, x1: 120, y1: 92 }; }
    const out = P(t, 6.85, 7.5, E.inCubic);
    // background
    S(blackout, { opacity: 1 - P(t, 0, .9, E.outCubic) });
    S(bg, { transform: `scale(${lerp(1.12, 1.0, P(t, 0, 8, E.outCubic))}) translateX(${lerp(-1.5, 1.5, t / 8)}%)`, filter: `brightness(${lerp(.95, .7, out)})` });
    S(sweep, { transform: `translateX(${lerp(-110, 420, P(t, .25, 2.6, E.inOutCubic))}%) rotate(16deg)`, opacity: 1 - P(t, 2.2, 2.6) });
    // lockup
    const mv = P(t, 2.25, 3.15, E.inOutCubic);
    S(lock, { transform: `translate(${lerp(geo.x0, geo.x1, mv)}px, ${lerp(geo.y0, geo.y1, mv)}px) scale(${lerp(geo.s, 1, mv)})`, opacity: 1 - out });
    const mk = P(t, .35, 1.35, E.outCubic);
    S(mark, { opacity: mk, transform: `scale(${lerp(.86, 1, mk)}) rotate(${lerp(-8, 0, mk)}deg)`, filter: `blur(${(1 - mk) * 10}px) brightness(${1 + .5 * Math.sin(Math.PI * P(t, .9, 1.7, E.lin))})` });
    S(markW, { transform: `translateX(${(lt.offsetWidth + 22) / 2 * (1 - P(t, .5, 1.15, E.inOutCubic))}px)` });
    rise(l1, t, 1.0, .07, .8); rise(l2, t, 1.3, .05, .7);
    // session
    const o = 1 - out, dy = -out * 26;
    S(blk, { opacity: o, transform: `translateY(${dy}px)` });
    rise(kick, t, 2.7, .045, .7); rise(ttl, t, 2.85, .07, .85); if (stl) rise(stl, t, 3.2, .05, .8);
    S(rule, { transform: `scaleX(${P(t, 3.4, 4.25, E.outQuint)})` });
    spk.forEach((s, i) => { const p = P(t, 3.6 + i * .12, 4.3 + i * .12, E.outCubic); S(s.it, { opacity: p, transform: `translateY(${(1 - p) * 20}px)` }); S(s.av, { transform: `scale(${lerp(.82, 1, E.outBack(clamp((t - 3.6 - i * .12) / .7)))})` }); });
    S(meta, { opacity: P(t, 3.95, 4.75, E.outCubic) * o });
  };
}

/* ------------------------------------------------------------------ outro */
function outro(spec) {
  stage.className = 'opaque';
  const [main] = splitTitle(spec.title);
  const bgw = el(stage, 'full'), bg = img(bgw, IMG + 'skyline-2000.webp', 'cover', { objectPosition: '50% 14%' });
  el(stage, 'full', { background: 'linear-gradient(180deg, rgba(5,10,21,.9) 0%, rgba(5,10,21,.72) 45%, rgba(5,10,21,.9) 100%)' });
  el(stage, 'full', { background: 'radial-gradient(ellipse 70% 60% at 50% 46%, rgba(5,10,21,0) 0%, rgba(5,10,21,.6) 100%)' });
  const blk = el(stage, 'full', { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingBottom: '40px' });
  const mark = img(blk, IMG + 'eig-mark.png', '', { height: '92px', width: 'auto', marginBottom: '38px' });
  const last = !spec.next;
  const kick = words(blk, last ? 'Thank you for joining us' : 'Thank you for watching', 'kick', { marginBottom: '24px' });
  const ttl = words(blk, last ? 'EIG Innovation Conference 2026' : main, 'serif', { fontSize: '96px', lineHeight: '1', maxWidth: '1500px' });
  const rule = el(blk, 'rule', { width: '360px', margin: '44px 0 40px', transformOrigin: '50% 50%' });
  let k2, n1, n2;
  if (!last) {
    k2 = words(blk, `Up next  ·  Session ${spec.next.num}`, 'kick', { fontSize: '17px', color: 'var(--dim)', marginBottom: '18px' });
    n1 = words(blk, spec.next.title, 'serif', { fontSize: '54px', lineHeight: '1.1', fontStyle: 'italic', color: 'var(--copper-hi)', maxWidth: '1500px' });
    n2 = words(blk, nameList(spec.next.speakers), 'sans', { font: '400 24px/1.3 var(--sans)', color: 'var(--dim)', marginTop: '16px' });
  } else {
    k2 = words(blk, 'Austin  ·  September 10, 2026', 'kick', { fontSize: '17px', color: 'var(--dim)' });
  }
  const foot = el(stage, 'abs', { left: 0, right: 0, bottom: '76px', textAlign: 'center' });
  el(foot, 'kick', { fontSize: '16px', color: 'var(--faint)', letterSpacing: '.34em' }, 'consultingeig.com');
  const black = el(stage, 'full', { background: '#000' });
  return t => {
    S(bg, { transform: `scale(${lerp(1.0, 1.08, t / 7)})` });
    const mk = P(t, .35, 1.3, E.outCubic);
    S(mark, { opacity: mk, transform: `scale(${lerp(.88, 1, mk)})`, filter: `blur(${(1 - mk) * 8}px)` });
    rise(kick, t, .7, .045, .7); rise(ttl, t, .85, .06, .85);
    S(rule, { transform: `scaleX(${P(t, 1.3, 2.1, E.outQuint)})` });
    if (k2) rise(k2, t, 1.75, .045, .7); if (n1) rise(n1, t, 1.9, .05, .8); if (n2) rise(n2, t, 2.15, .03, .7);
    S(foot, { opacity: P(t, 2.3, 3.1, E.outCubic) });
    S(black, { opacity: P(t, 6.1, 7.0, E.inOutCubic) });
  };
}

/* ------------------------------------------------------- overlays (alpha) */
// Both sit bottom-left. Renderer captures the region y >= 680 only.
function plateIn(t, plate, bar, D) {
  const pin = P(t, .1, .85, E.outExpo), pout = P(t, D - .6, D - .05, E.inExpo);
  S(bar, { transform: `scaleY(${P(t, 0, .4, E.outExpo) * (1 - P(t, D - .3, D, E.inExpo))})` });
  S(plate, { clipPath: `inset(0 ${(1 - pin) * 100}% 0 ${pout * 100}% round 16px)` });
}
function lt(spec) {
  stage.className = '';
  const D = spec.dur || 6;
  const plate = el(stage, 'plate', { left: '96px', bottom: '84px', display: 'flex', alignItems: 'center', gap: '24px', padding: '22px 40px 22px 26px' });
  const bar = el(plate, 'bar');
  const av = el(plate, 'av', { width: '82px', height: '82px', flex: 'none', marginLeft: '8px' }); img(av, SPK + spec.id + '.webp');
  const tx = el(plate, '');
  const nm = words(tx, spec.name, 'sans', { font: '600 40px/1.08 var(--sans)', whiteSpace: 'nowrap' });
  let chip = null; if (spec.note) { chip = el(nm, 'chip', {}, '', 'span'); chip.textContent = spec.note; }
  const rl = words(tx, spec.role || '', 'sans', { font: '400 24px/1.3 var(--sans)', color: 'var(--dim)', marginTop: '6px', whiteSpace: 'nowrap' });
  return t => {
    plateIn(t, plate, bar, D);
    const a = P(t, .3, .95, E.outBack) ; S(av, { transform: `scale(${lerp(.6, 1, a)})`, opacity: P(t, .3, .7) });
    rise(nm, t, .38, .05, .75); rise(rl, t, .52, .03, .75);
    if (chip) S(chip, { opacity: P(t, .8, 1.3) });
  };
}
function chapter(spec) {
  stage.className = '';
  const D = spec.dur || 4.6;
  const plate = el(stage, 'plate', { left: '96px', bottom: '84px', display: 'flex', alignItems: 'center', gap: '28px', padding: '20px 44px 22px 34px' });
  const bar = el(plate, 'bar');
  const num = el(plate, 'serif', { fontSize: '76px', lineHeight: '1', paddingBottom: '4px', background: 'var(--grad)', webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });
  num.textContent = String(spec.n).padStart(2, '0');
  const hair = el(plate, '', { width: '1px', alignSelf: 'stretch', background: 'rgba(232,179,138,.3)', transformOrigin: '50% 0' });
  const tx = el(plate, '');
  const k = words(tx, `Chapter ${spec.n} of ${spec.of}`, 'kick', { fontSize: '15px', marginBottom: '12px' });
  const ti = words(tx, spec.title, 'serif', { fontSize: '46px', lineHeight: '1.04', whiteSpace: 'nowrap' });
  return t => {
    plateIn(t, plate, bar, D);
    const p = P(t, .25, 1.0, E.outQuint); S(num, { opacity: p, transform: `translateY(${(1 - p) * 30}px)` });
    S(hair, { transform: `scaleY(${P(t, .35, 1.0, E.outExpo)})` });
    rise(k, t, .4, .04, .7); rise(ti, t, .5, .06, .8);
  };
}

const BUILD = { intro, outro, lt, chapter };
const DUR = { intro: 8, outro: 7, lt: 6, chapter: 4.6 };
let paint = () => {};
window.setup = async (piece, spec) => {
  stage.innerHTML = ''; paint = BUILD[piece](spec);
  await document.fonts.ready;
  await Promise.all([...stage.querySelectorAll('img')].map(i => i.decode().catch(() => console.error('img failed ' + i.src))));
  paint(0); return spec.dur || DUR[piece];
};
window.seek = t => paint(t);
})();
