// SCIA 2026 winners film (60 s, 30 fps). Same kit and look as film.js; a pure function of time: window.seek(t) paints frame t.
// Every cut sits on the 120 BPM grid (one beat = 0.5 s) so the music can be fitted to it.
(() => {
const FPS = (window.TL && window.TL.fps) || 30, DUR = 61.5; // DUR is film time (see WARP)

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: t => t,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const P = (t, a, b, e = E.outExpo) => e(clamp((t - a) / (b - a)));
// the picture is authored in film time on a 120 BPM grid; window.WARP (written by fit_winners.py) is a list of
// [output seconds, film seconds] knots that puts every film beat on the music track's own beat
const WARP = window.WARP || [[0, 0], [DUR, DUR]];
function knot(x, from, to) {
  let i = 0; while (i < WARP.length - 2 && WARP[i + 1][from] <= x) i++;
  const [a, b] = [WARP[i], WARP[i + 1]];
  return a[to] + (x - a[from]) * (b[to] - a[to]) / (b[from] - a[from]);
}
const toFilm = t => knot(t, 0, 1), toOut = f => knot(f, 1, 0);
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (n) => mulberry32(n * 9301 + 49297)();

// ---------- registries ----------
const SFX = []; const sfx = (t, type, gain = 1, p = 0) => SFX.push({ t: +t.toFixed(3), type, gain, p });
const HITS = []; const hit = (t, amt = 1) => HITS.push({ t, amt });
const WIPES = []; const FLASHES = [];
let pending = [];

// ---------- DOM helpers ----------
const $ = id => document.getElementById(id);
const world = $('world');
function div(parent, cls = '', css = {}, html = '') {
  const d = document.createElement('div'); if (cls) d.className = cls; Object.assign(d.style, css);
  if (html) d.innerHTML = html; parent.appendChild(d); return d;
}
function S(el, css) { for (const k in css) el.style[k] = css[k]; }
function words(parent, text, cls, css = {}) {
  const d = div(parent, cls + ' abs', css);
  const parts = text.split(' ');
  const inner = [];
  parts.forEach((p, i) => {
    const w = document.createElement('span'); w.className = 'w';
    const wi = document.createElement('span'); wi.className = 'wi';
    wi.innerHTML = p; w.appendChild(wi); d.appendChild(w); inner.push(wi);
    if (i < parts.length - 1) d.appendChild(document.createTextNode(' '));
  });
  d.ws = inner; return d;
}
function reveal(el, t, t0, st = .06, dur = .55, from = 105) {
  el.ws.forEach((w, i) => { const p = P(t, t0 + i * st, t0 + i * st + dur); w.style.transform = `translateY(${(1 - p) * from}%)`; });
}
function conceal(el, t, t0, dur = .3) {
  const p = P(t, t0, t0 + dur, E.inExpo); el.ws.forEach(w => { if (p > 0) w.style.transform = `translateY(${-p * 105}%)`; });
}
const fade = (el, lt, a, b, dy = 24) => S(el, { opacity: P(lt, a, b), transform: `translateY(${(1 - P(lt, a, b + .2)) * dy}px)` });

const LOGO = { intel: 'assets/logo_intel.jpg', gofo: 'assets/logo_gofo.jpg', gp: 'assets/logo_gp.jpg', rel: 'assets/logo_reliance.png',
  cscmp: 'assets/cscmp.png', scbw: 'assets/scb_white.png', edgew: 'assets/edge_white.png', edge: 'assets/edge.png', scb: 'assets/scb.png' };
// event photos (CSCMP EDGE 2026): [url, natural size]
const PH = {
  screen: ['assets/winners/gofo-screen.jpg', [1536, 1024]], room: ['assets/winners/room.jpg', [2000, 1333]],
  panel: ['assets/winners/panel.jpg', [2000, 1124]], award: ['assets/winners/gofo-award.jpg', [2000, 1333]],
  wide: ['assets/winners/award-wide.jpg', [2000, 1333]],
  rel: ['assets/winners/reliance-stage.jpg', [1600, 900]],
};
const PRELOAD = [...Object.values(LOGO), ...Object.values(PH).map(p => p[0])].map(u => { const i = new Image(); i.src = u; return i.decode().catch(() => {}); });

// a photo plate: shows a crop of an image inside a box, with camera push
function plate(parent, z = 0) {
  const d = div(parent, 'plate', { zIndex: z }); const img = document.createElement('img'); d.appendChild(img);
  let cur = '';
  return {
    el: d,
    set(o) {
      const { ph, crop, x = 960, y = 540, w = 1920, h = 1080, zoom = 1, px = 0, py = 0,
        op = 1, rx = 0, ry = 0, rz = 0, s = 1, blur = 0, br = 1, sat = 1, radius = 0, tx = 0, ty = 0 } = o;
      const [url, nat] = PH[ph];
      if (url !== cur) { cur = url; img.src = url; pending.push(img.decode().catch(() => {})); }
      const cw = crop[2] / zoom, ch = crop[3] / zoom;
      const cx = crop[0] + crop[2] / 2 + px * crop[2] / 2 * (1 - 1 / zoom), cy = crop[1] + crop[3] / 2 + py * crop[3] / 2 * (1 - 1 / zoom);
      const k = Math.max(w / cw, h / ch);
      S(img, { width: nat[0] * k + 'px', height: nat[1] * k + 'px', left: (w / 2 - cx * k) + 'px', top: (h / 2 - cy * k) + 'px' });
      S(d, {
        left: x - w / 2 + 'px', top: y - h / 2 + 'px', width: w + 'px', height: h + 'px', opacity: op, borderRadius: radius + 'px',
        transform: `translate(${tx}px,${ty}px) perspective(1800px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`,
        filter: `blur(${blur}px) brightness(${br}) saturate(${sat})`,
      });
    },
  };
}
const NS = 'http://www.w3.org/2000/svg';
function svg(parent, w, h, css = {}) {
  const s = document.createElementNS(NS, 'svg'); s.setAttribute('width', w); s.setAttribute('height', h);
  s.setAttribute('viewBox', `0 0 ${w} ${h}`); Object.assign(s.style, css); parent.appendChild(s); return s;
}
function sv(parent, tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; }
function strokeDraw(el, p) { const L = el.getTotalLength ? el.getTotalLength() : 1000; el.style.strokeDasharray = L; el.style.strokeDashoffset = L * (1 - p); }

// white logo tile (logos are on white, multiplied so their white backgrounds vanish)
const TILE = { background: '#fff', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,.45)' };
function logoTile(parent, f, w, h, css = {}) {
  const d = div(parent, 'abs', Object.assign({ width: w + 'px', height: h + 'px' }, TILE, css));
  const [px, py] = f.logoPad || [.17, .2];
  div(d, 'abs', { left: w * px + 'px', right: w * px + 'px', top: h * py + 'px', bottom: h * (f.with ? py + .16 : py) + 'px',
    background: `url(${LOGO[f.logo]}) center/contain no-repeat`, mixBlendMode: 'multiply' });
  if (f.with) div(d, 'abs U', { left: '0', right: '0', bottom: h * .1 + 'px', textAlign: 'center', fontWeight: 700, fontSize: Math.round(h * .12) + 'px', color: '#0b2a5c' }, f.with);
  return d;
}
// past winners without a logo file: set as a plain wordmark (no imitation of their brand marks)
function nameTile(parent, name, w, h, css = {}) {
  const d = div(parent, 'abs', Object.assign({ width: w + 'px', height: h + 'px' }, TILE, css));
  div(d, 'D abs', { left: '0', top: '0', width: w + 'px', height: h + 'px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#0b2a5c', fontSize: Math.round(h * .34) + 'px', letterSpacing: '.06em', lineHeight: '1' }, name);
  return d;
}
// light sweep across a tile
function glint(tile) {
  return div(tile, 'abs', { top: '-20%', bottom: '-20%', width: '38%', left: '0', mixBlendMode: 'screen', pointerEvents: 'none',
    background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(160,200,255,.55) 50%, rgba(255,255,255,0) 100%)', transform: 'translateX(-200%) skewX(-18deg)' });
}
const sweepGlint = (g, lt, a, b) => S(g, { transform: `translateX(${lerp(-150, 380, P(lt, a, b, E.inOutCubic))}%) skewX(-18deg)` });
// broadcast lower third: white name box + red role box
function lower(parent, name, role, css = {}, k = 1) {
  const d = div(parent, 'abs', Object.assign({ whiteSpace: 'nowrap', display: 'flex', alignItems: 'stretch', opacity: 0 }, css));
  div(d, '', { background: '#f5f7fb', color: '#0b1d3d', padding: `${14 * k}px ${24 * k}px ${10 * k}px`, fontFamily: "'Barlow Condensed'", fontWeight: 800,
    fontSize: 48 * k + 'px', textTransform: 'uppercase', lineHeight: '1' }, name);
  if (role) div(d, '', { background: 'var(--red)', color: '#fff', padding: `0 ${20 * k}px`, display: 'flex', alignItems: 'center', fontFamily: 'Inter',
    fontWeight: 600, fontSize: 21 * k + 'px', letterSpacing: '.18em', textTransform: 'uppercase' }, role);
  return d;
}
const wipeIn = (el, lt, a, out = 1e9) => {
  const k = P(lt, a, a + .5, E.outCubic), o = P(lt, out, out + .3, E.inExpo);
  S(el, { opacity: k > 0 && o < 1 ? 1 : 0, clipPath: `inset(-10px ${(1 - k) * 100}% -10px ${o * 100}%)` });
};

// ---------- shots ----------
const SHOTS = [];
function shot(a, b, build, opts = {}) {
  const root = div(world, 'shot'); root.style.zIndex = opts.z || 1;
  const up = build(root, a, b);
  SHOTS.push({ a, b, root, up, punch: opts.punch !== false });
}

const FIN = [
  { name: 'Intel', logo: 'intel', tag: 'Market Intelligence', logoPad: [.22, .2] },
  { name: 'GOFO', logo: 'gofo', tag: 'National Parcel Network', logoPad: [.12, .3] },
  { name: 'Intel', logo: 'intel', tag: 'Chem & Gas Control Tower', logoPad: [.22, .2] },
  { name: 'Georgia-Pacific', with: '× project44', logo: 'gp', tag: 'Yard Operations', logoPad: [.26, .05] },
  { name: 'Reliance Industries', logo: 'rel', tag: 'Emergency Response Network', logoPad: [.2, .05] },
];
const NOTE = [0, 4, 7, 9, 12]; // tuned taps, D major

// ---------------- COLD OPEN: five finalists, one winner ----------------
shot(0, 4, (r) => {
  const pl = plate(r);
  div(r, 'abs', { inset: '0', background: 'radial-gradient(ellipse at 50% 48%, rgba(5,13,29,.55) 0%, rgba(5,13,29,.85) 65%, rgba(5,13,29,.96) 100%)' });
  const line = div(r, 'abs', { left: '0', top: '539px', width: '1920px', height: '3px', background: 'var(--white)', transformOrigin: '50% 50%' });
  const kick = words(r, 'CSCMP EDGE 2026 · Nashville', 'lbl', { left: '0', width: '1920px', textAlign: 'center', top: '330px', color: 'var(--white)' });
  const l1 = words(r, 'Five finalists.', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '400px', fontSize: '250px' });
  const l2 = words(r, 'One winner.', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '400px', fontSize: '250px' });
  l2.ws[1].classList.add('red');
  sfx(0, 'pulse', .45); sfx(.45, 'tap', .35, 0); sfx(1.0, 'pulse', .5); sfx(1.0, 'tap', .35, 7);
  sfx(2.5, 'swipe', .4); sfx(3.0, 'pulse', .55); sfx(3.5, 'accent', .55); sfx(3.5, 'tap', .35, 12); sfx(4.0, 'riser', .7);
  return (t) => {
    const lp = P(t, .02, .45, E.inOutExpo), out = P(t, .45, .8, E.inOutExpo);
    S(line, { transform: `scaleX(${lp}) scaleY(${1 - out})`, opacity: 1 - out });
    pl.set({ ph: 'room', crop: [0, 104, 2000, 1125], zoom: 1.12 + t * .025, py: -.2, op: P(t, .4, 1.4), blur: 5, br: .6, sat: .7 });
    reveal(kick, t, .5, .05); S(kick, { opacity: 1 - P(t, 3.6, 3.95) });
    reveal(l1, t, 1.0, .1, .6); conceal(l1, t, 2.5, .3);
    l2.ws.forEach((w, i) => { const p = P(t, 3.0 + i * .5, 3.5 + i * .5); w.style.transform = `translateY(${(1 - p) * 105}%)`; });
    S(l2, { transform: `scale(${lerp(1, 1.06, P(t, 3.5, 4, E.inExpo))})` });
  };
});

// ---------------- TITLE ----------------
shot(4, 8, (r, a) => {
  const pl = plate(r);
  div(r, 'abs', { inset: '0', background: 'radial-gradient(ellipse at 50% 42%, rgba(5,13,29,.62) 0%, rgba(5,13,29,.45) 55%, rgba(5,13,29,.8) 100%)' });
  const pre = div(r, 'abs', { left: '0', width: '1920px', top: '150px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px' });
  div(pre, '', { width: '124px', height: '124px', borderRadius: '50%', background: `#fff url(${LOGO.cscmp}) center/112px no-repeat`, boxShadow: '0 0 0 3px rgba(255,255,255,.15)' });
  div(pre, '', { width: '2px', height: '84px', background: 'rgba(245,247,251,.35)' });
  div(pre, '', { width: '360px', height: '62px', background: `url(${LOGO.scbw}) center/contain no-repeat` });
  const pres = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '292px', color: 'var(--white)' }, 'present');
  const t1 = words(r, 'Supply Chain', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '350px', fontSize: '200px' });
  const t2 = words(r, 'Innovation Award', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '520px', fontSize: '200px' });
  t2.lastChild.querySelector('.wi').innerHTML += '<sup style="font-size:.25em;vertical-align:top;line-height:1.2">™</sup>';
  const bar = div(r, 'abs', { left: '810px', width: '300px', height: '8px', top: '722px', background: 'var(--red)', transformOrigin: '50% 50%' });
  const yr = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '770px', fontSize: '84px', letterSpacing: '.2em', color: 'var(--sky)' }, '2026 Winners');
  const all = [pre, pres, t1, t2, bar, yr];
  sfx(a, 'boom', 1); hit(a, 1.2); FLASHES.push(a); sfx(a + .3, 'shimmer', .45, 0);
  sfx(a + 1.5, 'tap', .35, 7); sfx(7.5, 'whoosh', .55);
  return (t) => {
    const lt = t - a;
    pl.set({ ph: 'panel', crop: [0, 0, 2000, 1124], zoom: 1.15 + lt * .02, op: 1, blur: 16, br: .55, sat: .8 });
    S(pre, { opacity: P(lt, .1, .6), transform: `translateY(${(1 - P(lt, .1, .8)) * 20}px)` });
    S(pres, { opacity: P(lt, .3, .8), letterSpacing: lerp(.6, .32, P(lt, .3, 1.4)) + 'em' });
    reveal(t1, lt, .1, .08, .6); reveal(t2, lt, .3, .08, .6);
    S(bar, { transform: `scaleX(${P(lt, .7, 1.3, E.inOutExpo)})` });
    S(yr, { opacity: P(lt, 1.5, 1.9), letterSpacing: lerp(.5, .2, P(lt, 1.5, 2.6)) + 'em' });
    const out = P(lt, 3.5, 4, E.inExpo);
    all.forEach(e => { e.style.opacity = Math.min(+e.style.opacity || 1, 1 - out); });
    S(r, { filter: `blur(${out * 10}px)` });
  };
});

// ---------------- THE FINALISTS → AND THE AWARD GOES TO ----------------
shot(8, 12, (r, a) => {
  const pl = plate(r);
  div(r, 'abs', { inset: '0', background: 'rgba(5,13,29,.72)' });
  const lab = words(r, 'The 2026 finalists', 'lbl', { left: '0', width: '1920px', textAlign: 'center', top: '250px', color: 'var(--white)' });
  const TW = 300, TH = 170, GAP = 40, X0 = 960 - (5 * TW + 4 * GAP) / 2;
  const tiles = FIN.map((f, i) => {
    const c = div(r, 'abs', { left: (X0 + i * (TW + GAP)) + 'px', top: '330px', width: TW + 'px', height: '250px', transformOrigin: '150px 85px' });
    const tl = logoTile(c, f, TW, TH);
    const tg = div(c, 'abs U', { left: '0', width: TW + 'px', top: (TH + 18) + 'px', textAlign: 'center', fontWeight: 600, fontSize: '22px', lineHeight: 1.25, color: 'var(--white)' }, f.tag);
    return { c, tl, tg };
  });
  const g1 = words(r, 'And the award', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '660px', fontSize: '130px', color: 'rgba(245,247,251,.7)' });
  const g2 = words(r, 'goes to…', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '790px', fontSize: '130px' });
  sfx(a, 'card', .6, 0); FIN.forEach((f, i) => sfx(a + .2 + i * .1, 'tap', .35, NOTE[i]));
  sfx(10.0, 'pulse', .5); sfx(10.5, 'pulse', .55); sfx(11.0, 'pulse', .6); sfx(11.0, 'tape', .3); sfx(12.0, 'riser', .9);
  return (t) => {
    const lt = t - a;
    pl.set({ ph: 'screen', crop: [0, 0, 1536, 864], zoom: 1.1 + lt * .02, op: 1, blur: 14, br: .45, sat: .7 });
    reveal(lab, lt, .05, .05);
    const pick = P(lt, 3.0, 3.4, E.outCubic), push = P(lt, 3.45, 4.0, E.inExpo);
    tiles.forEach(({ c, tl, tg }, i) => {
      const p = P(lt, .15 + i * .1, .8 + i * .1, E.outCubic);
      const fl = Math.sin((lt + i) * 1.3) * 4;
      const me = i === 1;
      const sc = me ? lerp(1, 1.14, pick) * (1 + push * 5) : lerp(1, .94, pick);
      const tx = me ? (960 - (X0 + 1 * (TW + GAP) + 150)) * push : 0;
      S(c, { opacity: clamp(p * 1.5) * (me ? 1 : lerp(1, .28, pick) * (1 - push)),
        transform: `translate(${tx}px, ${(1 - p) * 140 + fl + (me ? -24 * pick + (540 - 415) * push : 14 * pick)}px) rotate(${(1 - p) * (i - 2) * 3}deg) scale(${sc})` });
      if (me) S(tl, { boxShadow: `0 30px 70px rgba(0,0,0,.45), 0 0 0 ${pick * 5}px var(--red), 0 0 ${pick * 80}px rgba(227,36,59,${.55 * pick})` });
      S(tg, { opacity: 1 - push });
    });
    reveal(g1, lt, 2.0, .08); reveal(g2, lt, 2.5, .08);
    S(g1, { opacity: 1 - push }); S(g2, { opacity: 1 - push }); S(lab, { opacity: 1 - push });
  };
}, { punch: false });

// ---------------- WINNER: GOFO ----------------
shot(12, 16, (r, a) => {
  const s = svg(r, 1920, 1080, { left: '0', top: '0' });
  const rays = sv(s, 'g', {});
  for (let i = 0; i < 40; i++) {
    const a0 = i / 40 * Math.PI * 2, a1 = a0 + Math.PI / 40 * .55;
    sv(rays, 'polygon', { points: `960,440 ${960 + Math.cos(a0) * 1500},${440 + Math.sin(a0) * 1500} ${960 + Math.cos(a1) * 1500},${440 + Math.sin(a1) * 1500}`,
      fill: i % 5 === 0 ? 'rgba(227,36,59,.10)' : 'rgba(143,182,255,.05)' });
  }
  const ring = sv(s, 'circle', { cx: 960, cy: 440, r: 200, fill: 'none', stroke: '#e3243b', 'stroke-width': 6 });
  const ring2 = sv(s, 'circle', { cx: 960, cy: 440, r: 200, fill: 'none', stroke: '#f5f7fb', 'stroke-width': 2 });
  const lab = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '178px', color: 'var(--white)' }, '2026 Supply Chain Innovation Award™');
  const tile = logoTile(r, { logo: 'gofo', logoPad: [.13, .26] }, 820, 300, { left: '550px', top: '290px', transformOrigin: '50% 50%' });
  const gl = glint(tile);
  const win = div(r, 'D abs red', { left: '0', width: '1920px', textAlign: 'center', top: '640px', fontSize: '250px', textShadow: '0 12px 60px rgba(227,36,59,.35)' }, 'Winner');
  const sub = div(r, 'U abs', { left: '0', width: '1920px', textAlign: 'center', top: '880px', fontSize: '38px', fontWeight: 500, color: 'rgba(245,247,251,.88)' },
    '<span style="font-family:\'Barlow Condensed\';font-weight:800;text-transform:uppercase;color:var(--sky);margin-right:18px;font-size:44px;letter-spacing:.04em">GOFO</span>Breaking the Linear Constraint');
  sfx(a, 'boom', 1.1); hit(a, 1.5); FLASHES.push(a); sfx(a + .25, 'shimmer', .6, 0); sfx(a + .3, 'shimmer', .35, 7);
  sfx(a + 1.0, 'tap', .35, 12); sfx(15.5, 'whoosh', .6);
  return (t) => {
    const lt = t - a;
    rays.setAttribute('transform', `rotate(${lt * 6} 960 440)`); S(s, { opacity: P(lt, 0, .4) * (1 - P(lt, 3.6, 4)) });
    const sp = P(lt, 0, .35);
    S(tile, { transform: `scale(${lerp(1.7, 1, sp) * (1 + lt * .012)})`, opacity: clamp(lt / .05) });
    const rp = P(lt, .05, 1.1, E.outCubic), rp2 = P(lt, .2, 1.4, E.outCubic);
    ring.setAttribute('r', 200 + rp * 700); S(ring, { opacity: 1 - rp });
    ring2.setAttribute('r', 200 + rp2 * 900); S(ring2, { opacity: (1 - rp2) * .6 });
    sweepGlint(gl, lt, .5, 1.3);
    S(lab, { opacity: P(lt, .3, .7), letterSpacing: lerp(.5, .32, P(lt, .3, 1.5)) + 'em' });
    S(win, { opacity: P(lt, .2, .35), letterSpacing: lerp(.45, .06, P(lt, .2, 1.2)) + 'em', transform: `scale(${lerp(1.3, 1, P(lt, .2, .7))})` });
    fade(sub, lt, 1.0, 1.4);
    const out = P(lt, 3.6, 4, E.inExpo);
    [lab, sub].forEach(e => { e.style.opacity = Math.min(+e.style.opacity, 1 - out); });
  };
});

// ---------------- ON STAGE: the award ----------------
const L3SHADE = 'linear-gradient(to top, rgba(3,8,20,.88) 0%, rgba(3,8,20,.35) 34%, rgba(3,8,20,0) 55%), linear-gradient(to bottom, rgba(3,8,20,.55) 0%, rgba(3,8,20,0) 22%)';
WIPES.push(16);
shot(16, 18, (r, a) => {
  const pl = plate(r);
  div(r, 'abs', { inset: '0', background: L3SHADE });
  const kick = div(r, 'lbl abs', { left: '120px', top: '80px', color: 'var(--white)' }, 'CSCMP EDGE 2026 · Nashville');
  const n1 = lower(r, 'GOFO', '2026 Supply Chain Innovation Award™ Winner', { left: '120px', top: '880px' }, 1.15);
  sfx(a + .2, 'shimmer', .4, 4); sfx(a + .4, 'swipe', .35);
  return (t) => {
    const lt = t - a;
    // the camera pushes in from the room toward the group on stage
    pl.set({ ph: 'wide', crop: [0, 120, 2000, 1125], zoom: 1.0 + P(lt, 0, 2.2, E.inOutCubic) * .3, px: .7, py: .95, op: 1, br: 1.04 });
    S(kick, { opacity: P(lt, .2, .6) });
    wipeIn(n1, lt, .4);
  };
});
shot(18, 22, (r, a) => {
  const pl = plate(r);
  div(r, 'abs', { inset: '0', background: L3SHADE });
  const kick = div(r, 'lbl abs', { left: '120px', top: '80px', color: 'var(--white)' }, 'CSCMP EDGE 2026 · Nashville');
  const by = div(r, 'lbl abs', { left: '124px', top: '762px', color: 'var(--white)', opacity: 0 }, 'Award presented by');
  const c1 = lower(r, 'Jim de Vries', 'SCIA Chairperson', { left: '120px', top: '808px' });
  const c2 = lower(r, 'Brad Berger', 'President, SupplyChainBrain', { left: '120px', top: '888px' });
  sfx(a + .25, 'swipe', .35); sfx(a + .5, 'tap', .35, 7); sfx(a + .75, 'tap', .35, 12);
  return (t) => {
    const lt = t - a;
    pl.set({ ph: 'award', crop: [160, 150, 1680, 945], zoom: 1.04 + lt * .03, px: -.02, py: .05, op: 1, br: 1.02 });
    S(kick, { opacity: 1 - P(lt, 3.5, 3.9) });
    S(by, { opacity: P(lt, .3, .6) * (1 - P(lt, 3.5, 3.9)) });
    wipeIn(c1, lt, .45, 3.6); wipeIn(c2, lt, .7, 3.6);
  };
});

// ---------------- GOFO ATLAS ----------------
WIPES.push(22);
shot(22, 26, (r, a) => {
  const pl = plate(r, 2);
  const lab = div(r, 'lbl abs', { left: '154px', top: '270px' }, 'The winning innovation');
  const n1 = words(r, 'GOFO', 'D', { left: '146px', top: '320px', fontSize: '250px' });
  const n2 = words(r, 'ATLAS', 'D red', { left: '146px', top: '530px', fontSize: '250px' });
  const bar = div(r, 'abs', { left: '154px', top: '760px', width: '140px', height: '8px', background: 'var(--red)', transformOrigin: '0 50%' });
  const sub = div(r, 'U abs', { left: '154px', top: '800px', width: '820px', fontSize: '42px', fontWeight: 500, lineHeight: 1.3, color: 'rgba(245,247,251,.9)' },
    'An AI-native IT system, <b style="color:var(--white)">designed and built in-house.</b>');
  sfx(a, 'card', .75, 0); sfx(a + .3, 'shimmer', .35, 7); hit(a, .45); sfx(a + 1.5, 'tap', .35, 4); sfx(25.5, 'whoosh', .55);
  return (t) => {
    const lt = t - a;
    const e = P(lt, .1, .9, E.outCubic);
    pl.set({ ph: 'screen', crop: [505, 110, 800, 740], x: 1400, y: 540, w: 720, h: 666, zoom: 1.04 + lt * .03, op: e, ry: lerp(-30, -14, e), tx: (1 - e) * 200, radius: 16, br: 1.05 });
    S(lab, { opacity: P(lt, .1, .4) });
    reveal(n1, lt, .05, .08, .6); reveal(n2, lt, .25, .08, .6);
    S(bar, { transform: `scaleX(${P(lt, .5, 1.0, E.inOutExpo)})` });
    fade(sub, lt, 1.0, 1.4);
  };
});

// ---------------- PEAK SEASON → A PLANNED OPERATION ----------------
WIPES.push(26);
shot(26, 32, (r, a) => {
  const lab = div(r, 'lbl abs', { left: '154px', top: '120px', color: 'var(--white)' }, 'In most networks, peak season brings');
  const row = div(r, 'abs', { left: '150px', top: '172px', display: 'flex', gap: '18px' });
  const chips = ['More volume', 'Higher costs', 'Heavier labor demands', 'More operational risk'].map(c =>
    div(row, 'D', { background: 'rgba(227,36,59,.16)', border: '2px solid var(--red)', borderRadius: '8px', padding: '10px 22px 8px', fontSize: '46px', lineHeight: '1' }, c));
  const X0 = 150, X1 = 1770, BY = 650, N = 160;
  const s = svg(r, 1920, 1080, { left: '0', top: '0' });
  const defs = sv(s, 'defs', {});
  const lg = sv(defs, 'linearGradient', { id: 'pk', x1: 0, y1: 0, x2: 0, y2: 1 });
  sv(lg, 'stop', { offset: '0', 'stop-color': '#8fb6ff', 'stop-opacity': .45 }); sv(lg, 'stop', { offset: '1', 'stop-color': '#8fb6ff', 'stop-opacity': 0 });
  sv(s, 'line', { x1: X0, y1: BY, x2: X1, y2: BY, stroke: 'rgba(245,247,251,.35)', 'stroke-width': 2 });
  [[.18, 'Pre-peak'], [.6, 'Peak season'], [.9, 'Post-peak']].forEach(([u, txt]) => {
    const tx = sv(s, 'text', { x: X0 + u * (X1 - X0), y: BY + 42, 'text-anchor': 'middle', fill: 'rgba(245,247,251,.5)', 'font-family': 'Inter', 'font-weight': 600, 'font-size': 20, 'letter-spacing': '5' });
    tx.textContent = txt.toUpperCase();
  });
  const area = sv(s, 'path', { fill: 'url(#pk)' });
  const curve = sv(s, 'path', { fill: 'none', 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  const dot = sv(s, 'circle', { r: 12, fill: '#f5f7fb' });
  const pkl = sv(s, 'text', { 'text-anchor': 'middle', 'font-family': 'Barlow Condensed', 'font-weight': 800, 'font-size': 44, 'letter-spacing': '2' });
  const jag = u => { const b = Math.exp(-(((u - .6) / .075) ** 2)); return 60 * u + 280 * b; };
  const noi = i => (hash(i * 13 + 5) * 2 - 1);
  const smooth = u => 40 + 230 * Math.exp(-(((u - .6) / .2) ** 2));
  const pts = m => [...Array(N + 1)].map((_, i) => {
    const u = i / N, b = Math.exp(-(((u - .6) / .1) ** 2));
    const yj = jag(u) + noi(i) * (16 + 50 * b) * (i % 2 ? 1 : .4);
    return [X0 + u * (X1 - X0), BY - 20 - lerp(yj, smooth(u), m)];
  });
  const h1 = div(r, 'lbl abs', { left: '154px', top: '748px', color: 'var(--sky)' }, 'GOFO ATLAS + automated infrastructure');
  const h2 = words(r, 'Peak demand, planned.', 'D', { left: '146px', top: '790px', fontSize: '130px' });
  h2.ws[2].classList.add('red');
  const h3 = div(r, 'D abs', { left: '154px', top: '920px', fontSize: '72px', color: 'var(--sky)' }, 'Delivered on schedule.');
  const CHIP = [.25, .75, 1.5, 2.0]; // on the track's dotted accents
  chips.forEach((c, i) => { sfx(a + CHIP[i], 'stab', .45, [0, 2, 4, 5][i]); hit(a + CHIP[i], .25); });
  sfx(26.2, 'ticks', .4); sfx(29.0, 'tape', .4); sfx(28.6, 'sweep', .55, 0); sfx(30.0, 'boom', .7); hit(30.0, .8);
  sfx(30.1, 'shimmer', .45, 7); sfx(31.0, 'tap', .35, 12); sfx(31.5, 'whoosh', .55);
  return (t) => {
    const lt = t - a;
    S(lab, { opacity: P(lt, .05, .35) * (1 - P(lt, 3.0, 3.4)) });
    chips.forEach((c, i) => {
      const p = P(lt, CHIP[i], CHIP[i] + .35, E.outBack), o = P(lt, 3.0 + i * .05, 3.4 + i * .05, E.inExpo);
      S(c, { opacity: clamp(p * 3) * (1 - o), transform: `translateY(${(1 - p) * 30 - o * 40}px) scale(${lerp(.85, 1, clamp(p))})` });
    });
    const m = P(lt, 3.4, 4.0, E.inOutCubic);
    const p = pts(m);
    const d = 'M' + p.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' L');
    curve.setAttribute('d', d);
    area.setAttribute('d', d + ` L${X1},${BY} L${X0},${BY} Z`); S(area, { opacity: m });
    const red = 1 - m;
    curve.setAttribute('stroke', `rgb(${Math.round(lerp(143, 227, red))},${Math.round(lerp(182, 36, red))},${Math.round(lerp(255, 59, red))})`);
    strokeDraw(curve, P(lt, .2, 2.6, E.inOutCubic));
    // peak label rides the top of the curve
    const top = p.reduce((q, c) => c[1] < q[1] ? c : q, p[0]);
    // the surge label sits beside the spike (clear of the chips); the planned label sits above the curve
    pkl.setAttribute('text-anchor', m > .5 ? 'middle' : 'start');
    pkl.setAttribute('x', X0 + .6 * (X1 - X0) + (m > .5 ? 0 : 90)); pkl.setAttribute('y', m > .5 ? BY - 20 - smooth(.6) - 30 : top[1] + 60);
    pkl.textContent = m > .5 ? 'PLANNED OPERATION' : 'PEAK SURGE';
    pkl.setAttribute('fill', m > .5 ? '#8fb6ff' : '#e3243b');
    S(pkl, { opacity: m > .5 ? P(lt, 3.9, 4.2) : P(lt, 1.7, 2.0) * (1 - P(lt, 3.2, 3.4)) });
    // progress marker travels the planned curve
    const dp = P(lt, 4.0, 5.8, E.inOutCubic), k = Math.round(dp * N);
    dot.setAttribute('cx', p[k][0]); dot.setAttribute('cy', p[k][1]); S(dot, { opacity: P(lt, 4.0, 4.2) });
    S(h1, { opacity: P(lt, 3.8, 4.1) });
    reveal(h2, lt, 3.9, .08, .6);
    fade(h3, lt, 4.9, 5.3, 20);
  };
});

// ---------------- LEGACY: alongside past winners ----------------
WIPES.push(32);
shot(32, 37.5, (r, a) => {
  const lab = words(r, 'Supply Chain Innovation Award™ · past winners include', 'lbl', { left: '0', width: '1920px', textAlign: 'center', top: '230px', color: 'var(--white)' });
  const TW = 340, TH = 190, GAP = 40, X3 = 960 - (3 * TW + 2 * GAP) / 2, X4 = 960 - (4 * TW + 3 * GAP) / 2;
  const items = [
    { el: c => nameTile(c, 'Dell', TW, TH), tag: 'Past winner' },
    { el: c => nameTile(c, 'Staples', TW, TH), tag: 'Past winner' },
    { el: c => logoTile(c, { logo: 'intel', logoPad: [.22, .2] }, TW, TH), tag: 'Multi-year winner' },
    { el: c => logoTile(c, { logo: 'gofo', logoPad: [.12, .3] }, TW, TH), tag: '2026 Winner', red: true },
  ].map((it, i) => {
    const c = div(r, 'abs', { left: '0', top: '330px', width: TW + 'px', height: '290px' });
    const tl = it.el(c);
    const tg = div(c, 'abs D', { left: '0', width: TW + 'px', top: (TH + 22) + 'px', textAlign: 'center', fontSize: '40px', color: it.red ? 'var(--red)' : 'var(--sky)', letterSpacing: '.04em' }, it.tag);
    return { c, tl, tg };
  });
  const gl = glint(items[3].tl);
  const slot = div(r, 'abs', { left: (X4 + 3 * (TW + GAP)) + 'px', top: '330px', width: TW + 'px', height: TH + 'px', borderRadius: '14px',
    border: '3px dashed rgba(227,36,59,.8)', boxSizing: 'border-box', opacity: 0 });
  const h = words(r, 'GOFO now stands alongside them.', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '700px', fontSize: '150px' });
  h.ws[0].classList.add('red');
  [0, 1, 2].forEach(i => sfx(a + .5 + i * .5, 'card', .5, NOTE[i + 1]));
  sfx(34.0, 'swipe', .4); sfx(34.75, 'tap', .4, 12); sfx(35.5, 'riser_short', .45); sfx(35.5, 'boom', .65); hit(35.5, .8);
  sfx(35.6, 'shimmer', .5, 12); sfx(37.0, 'whoosh', .55);
  return (t) => {
    const lt = t - a;
    reveal(lab, lt, .05, .03);
    const slide = P(lt, 2.0, 2.6, E.inOutCubic);
    S(slot, { opacity: P(lt, 2.75, 2.9) * (1 - P(lt, 3.45, 3.5, E.lin)), transform: `scale(${lerp(.9, 1, P(lt, 2.75, 3.1))})` });
    items.forEach(({ c, tl, tg }, i) => {
      const x = i < 3 ? lerp(X3 + i * (TW + GAP), X4 + i * (TW + GAP), slide) : X4 + 3 * (TW + GAP);
      const p = i < 3 ? P(lt, .5 + i * .5, 1.1 + i * .5, E.outCubic) : P(lt, 3.25, 3.5, x => x * x * x);
      const y = i < 3 ? (1 - p) * 120 : (1 - p) * -260;
      S(c, { left: x + 'px', opacity: clamp(p * 2), transform: `translateY(${y}px) scale(${i === 3 ? lerp(1.25, 1, p) : 1})` });
      S(tg, { opacity: P(lt, (i < 3 ? .8 + i * .5 : 3.6), (i < 3 ? 1.2 + i * .5 : 4.0)) });
      if (i === 3) S(tl, { boxShadow: `0 30px 70px rgba(0,0,0,.45), 0 0 0 ${4 * P(lt, 3.5, 3.8)}px var(--red), 0 0 ${60 * P(lt, 3.5, 3.6) * (1 - P(lt, 3.6, 4.4))}px rgba(227,36,59,.8)` });
    });
    sweepGlint(gl, lt, 3.7, 4.4);
    reveal(h, lt, 3.7, .07, .6);
  };
});

// ---------------- RUNNER-UP: RELIANCE ----------------
WIPES.push(37.5);
shot(37.5, 41.5, (r, a) => {
  const pl = plate(r);
  div(r, 'abs', { inset: '0', background: 'linear-gradient(90deg, rgba(5,13,29,.82) 0%, rgba(5,13,29,.7) 100%)' });
  const big = div(r, 'D abs out', { left: '90px', top: '120px', fontSize: '470px', WebkitTextStroke: '3px rgba(245,247,251,.14)' }, '02');
  const tile = logoTile(r, { logo: 'rel', logoPad: [.16, .06] }, 460, 325, { left: '150px', top: '360px' });
  const lab = div(r, 'lbl abs', { left: '700px', top: '330px' }, '2026 Supply Chain Innovation Award™');
  const ru = words(r, 'Runner-up', 'D red', { left: '692px', top: '372px', fontSize: '120px' });
  const n1 = words(r, 'Reliance Industries', 'D', { left: '692px', top: '492px', fontSize: '120px' });
  const n2 = words(r, 'Limited', 'D', { left: '692px', top: '600px', fontSize: '120px', color: 'rgba(245,247,251,.6)' });
  const bar = div(r, 'abs', { left: '700px', top: '742px', width: '120px', height: '8px', background: 'var(--red)', transformOrigin: '0 50%' });
  const sub = div(r, 'U abs', { left: '700px', top: '778px', width: '1060px', fontSize: '40px', fontWeight: 500, lineHeight: 1.3, color: 'rgba(245,247,251,.88)' },
    'From Reactive to Resilient: <b style="color:var(--white)">Emergency Response Network</b>');
  sfx(a, 'card', .8, 4); sfx(a + .3, 'shimmer', .4, 4); hit(a, .5); sfx(a + 1.2, 'tap', .35, 9); sfx(41.0, 'whoosh', .55);
  return (t) => {
    const lt = t - a;
    pl.set({ ph: 'rel', crop: [0, 0, 1600, 900], zoom: 1.1 + lt * .03, op: 1, blur: 14, br: .5, sat: .7 });
    S(big, { transform: `translateX(${(1 - P(lt, .05, .7)) * -220 + lt * 14}px)`, opacity: P(lt, .05, .4) });
    const tp = P(lt, .08, .55, E.outCubic);
    S(tile, { opacity: tp, transform: `translateY(${(1 - tp) * 40}px) scale(${lerp(.92, 1, tp)})` });
    S(lab, { opacity: P(lt, .2, .5) });
    reveal(ru, lt, .15, .07, .6); reveal(n1, lt, .3, .07, .6); reveal(n2, lt, .45, .07, .6);
    S(bar, { transform: `scaleX(${P(lt, .5, 1.0, E.inOutExpo)})` });
    fade(sub, lt, .9, 1.3);
  };
}, { punch: false });
shot(41.5, 46, (r, a) => {
  const pl = plate(r);
  div(r, 'abs', { inset: '0', background: 'linear-gradient(to top, rgba(3,8,20,.88) 0%, rgba(3,8,20,.35) 34%, rgba(3,8,20,0) 55%)' });
  const n1 = lower(r, 'Reliance Industries Limited', 'Runner-up', { left: '120px', top: '836px' }, 1.15);
  const n2 = div(r, 'U abs', { left: '120px', top: '920px', background: 'rgba(11,29,61,.92)', padding: '12px 24px', fontSize: '28px', fontWeight: 600, whiteSpace: 'nowrap', opacity: 0 },
    'From Reactive to Resilient: Emergency Response Network');
  sfx(a + .4, 'swipe', .35); sfx(a + .8, 'tap', .35, 7); sfx(45.5, 'whoosh', .55);
  return (t) => {
    const lt = t - a;
    pl.set({ ph: 'rel', crop: [80, 30, 1440, 810], zoom: 1.02 + lt * .03, px: -.15, py: -.1, op: 1, br: 1.04, sat: 1.02 });
    wipeIn(n1, lt, .4); wipeIn(n2, lt, .75);
  };
});

// ---------------- CONGRATULATIONS ----------------
WIPES.push(46);
shot(46, 52, (r, a) => {
  const p1 = plate(r, 1), p2 = plate(r, 1), p3 = plate(r, 2);
  const shade = div(r, 'abs', { inset: '0', zIndex: 3, background: 'linear-gradient(to top, rgba(5,13,29,.94) 0%, rgba(5,13,29,.6) 34%, rgba(5,13,29,0) 58%)' });
  const h1 = words(r, 'Congratulations', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '640px', fontSize: '170px', zIndex: 4 });
  const h2 = words(r, 'to all five finalists', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '790px', fontSize: '80px', color: 'var(--sky)', zIndex: 4 });
  const TW = 190, TH = 108, GAP = 24, X0 = 960 - (5 * TW + 4 * GAP) / 2;
  const mini = FIN.map((f, i) => logoTile(r, f, TW, TH, { left: (X0 + i * (TW + GAP)) + 'px', top: '920px', zIndex: 4, borderRadius: '10px' }));
  sfx(a + .3, 'shimmer', .4, 0); sfx(a + .5, 'swipe', .35); sfx(a + .9, 'pulse', .45); FIN.forEach((f, i) => sfx(49.5 + i * .1, 'tap', .3, NOTE[i])); sfx(51.5, 'whoosh', .55);
  return (t) => {
    const lt = t - a;
    const e1 = P(lt, 0, .8, E.outCubic), e2 = P(lt, .25, 1.05, E.outCubic), e3 = P(lt, .5, 1.2, E.outCubic);
    p1.set({ ph: 'panel', crop: [0, 200, 2000, 924], x: 470 - lt * 6, y: 300, w: 820, h: 379, zoom: 1.05 + lt * .02, op: e1, rz: -4, tx: (1 - e1) * -260, radius: 16, br: .9 });
    p2.set({ ph: 'room', crop: [0, 250, 2000, 900], x: 1450 + lt * 6, y: 300, w: 820, h: 369, zoom: 1.05 + lt * .02, op: e2, rz: 4, tx: (1 - e2) * 260, radius: 16, br: .9 });
    p3.set({ ph: 'wide', crop: [0, 150, 2000, 1125], x: 960, y: 330, w: 820, h: 461, zoom: 1.08 + lt * .025, py: .3, op: e3, ty: (1 - e3) * -120, s: lerp(1.1, 1, e3), radius: 16 });
    reveal(h1, lt, .9, .08, .6); reveal(h2, lt, 1.3, .05);
    mini.forEach((m, i) => { const p = P(lt, 3.5 + i * .1, 4.0 + i * .1, E.outCubic); S(m, { opacity: p, transform: `translateY(${(1 - p) * 40}px)` }); });
  };
});

// ---------------- RESULTS LOCKUP ----------------
WIPES.push(52);
shot(52, 56, (r, a) => {
  const lab = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '200px', color: 'var(--white)' }, 'CSCMP EDGE 2026');
  const ti = words(r, 'Supply Chain Innovation Award™', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '250px', fontSize: '110px' });
  const cols = [
    { x: 300, rank: 'Winner', red: true, logo: { logo: 'gofo', logoPad: [.12, .3] }, name: 'GOFO', sub: 'GOFO ATLAS · AI-native IT system' },
    { x: 1020, rank: 'Runner-up', logo: { logo: 'rel', logoPad: [.3, .08] }, name: 'Reliance Industries Limited', sub: 'Emergency Response Network' },
  ].map(c => {
    const g = div(r, 'abs', { left: c.x + 'px', top: '440px', width: '600px', height: '520px' });
    const rk = div(g, 'D abs', { left: '0', top: '0', width: '600px', textAlign: 'center', fontSize: '60px', letterSpacing: '.14em', color: c.red ? 'var(--red)' : 'var(--sky)' }, c.rank);
    const tl = logoTile(g, c.logo, 600, 260, { left: '0', top: '80px' });
    if (c.red) S(tl, { boxShadow: '0 30px 70px rgba(0,0,0,.45), 0 0 0 4px var(--red)' });
    div(g, 'U abs', { left: '0', top: '370px', width: '600px', textAlign: 'center', fontSize: '34px', fontWeight: 700 }, c.name);
    div(g, 'U abs', { left: '0', top: '418px', width: '600px', textAlign: 'center', fontSize: '26px', fontWeight: 500, color: 'rgba(245,247,251,.7)' }, c.sub);
    return { g, tl };
  });
  const gl = glint(cols[0].tl);
  const dv = div(r, 'abs', { left: '959px', top: '480px', width: '2px', height: '440px', background: 'rgba(245,247,251,.25)', transformOrigin: '50% 0' });
  sfx(a, 'card', .7, 0); sfx(a + .5, 'tap', .35, 7); sfx(a + .75, 'tap', .35, 12); sfx(a + 1.0, 'shimmer', .45, 7); sfx(55.5, 'whoosh', .7); sfx(56, 'riser', .5);
  return (t) => {
    const lt = t - a;
    S(lab, { opacity: P(lt, .05, .35) }); reveal(ti, lt, .05, .07, .6);
    cols.forEach(({ g }, i) => { const p = P(lt, .45 + i * .25, 1.1 + i * .25, E.outCubic); S(g, { opacity: p, transform: `translateY(${(1 - p) * 80}px)` }); });
    S(dv, { transform: `scaleY(${P(lt, .5, 1.2, E.inOutExpo)})` });
    sweepGlint(gl, lt, 1.2, 1.9);
  };
});

// ---------------- END CARD ----------------
shot(56, DUR + .01, (r, a) => {
  const panel = div(r, 'abs', { inset: '0', background: '#f6f7fa' });
  const ti = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '200px', fontSize: '110px', color: '#0b2a5c' }, 'Supply Chain Innovation Award<sup style="font-size:.3em;vertical-align:top">™</sup>');
  const by = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '325px', color: '#5a6b86' }, 'by CSCMP &amp; SupplyChainBrain');
  const l1 = div(r, 'abs', { left: '330px', top: '420px', width: '600px', height: '208px', background: `url(${LOGO.edge}) center/contain no-repeat` });
  const dv = div(r, 'abs', { left: '959px', top: '425px', width: '2px', height: '200px', background: '#c8cfdb' });
  const l2 = div(r, 'abs', { left: '1010px', top: '465px', width: '640px', height: '108px', background: `url(${LOGO.scb}) center/contain no-repeat` });
  const bar = div(r, 'abs', { left: '860px', top: '700px', width: '200px', height: '8px', background: 'var(--red)', transformOrigin: '50% 50%' });
  const cr = div(r, 'U abs', { left: '0', width: '1920px', textAlign: 'center', top: '760px', fontSize: '28px', fontWeight: 500, color: '#3a4a66', lineHeight: 1.6 },
    'Awards presented by <b style="color:#0b2a5c">Jim de Vries</b>, SCIA Chairperson<br>and <b style="color:#0b2a5c">Brad Berger</b>, President, SupplyChainBrain');
  sfx(a, 'boom', .7); hit(a, .6); sfx(a + .25, 'chime_end', .8);
  return (t) => {
    const lt = t - a;
    const w = P(lt, 0, .45, E.inOutExpo);
    S(panel, { clipPath: `inset(${(1 - w) * 100}% 0 0 0)` });
    S(ti, { opacity: P(lt, .35, .7), transform: `translateY(${(1 - P(lt, .35, .9)) * 30}px)` });
    S(by, { opacity: P(lt, .55, .9) });
    [l1, l2].forEach((l, i) => S(l, { opacity: P(lt, .5 + i * .15, .9 + i * .15), transform: `translateY(${(1 - P(lt, .5 + i * .15, 1.1 + i * .15)) * 30}px)` }));
    S(dv, { transform: `scaleY(${P(lt, .6, 1.1)})` });
    S(bar, { transform: `scaleX(${P(lt, .9, 1.4, E.inOutExpo)})` });
    fade(cr, lt, 1.3, 1.8, 16);
  };
}, { punch: false });

// ======================================================================
// background network, grain, wipes, camera
// ======================================================================
const bg = $('bg').getContext('2d');
const rnd = mulberry32(7);
const NODES = [...Array(90)].map(() => ({ x: rnd() * 2600 - 340, y: rnd() * 1500 - 210, z: .4 + rnd() * .9 }));
const EDGES = [];
NODES.forEach((n, i) => {
  const d = NODES.map((m, j) => [j, (m.x - n.x) ** 2 + (m.y - n.y) ** 2]).filter(x => x[0] !== i).sort((a, b) => a[1] - b[1]);
  for (let k = 0; k < 2; k++) if (!EDGES.find(e => (e[0] === d[k][0] && e[1] === i))) EDGES.push([i, d[k][0], rnd()]);
});
function drawBg(t) {
  const g = bg; g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#050d1d'; g.fillRect(0, 0, 1920, 1080);
  const gr = g.createRadialGradient(960, 420, 50, 960, 540, 1100); gr.addColorStop(0, 'rgba(26,62,128,.55)'); gr.addColorStop(1, 'rgba(5,13,29,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
  // the network rushes toward camera on the winner reveal
  const conv = P(t, 12, 13.5, E.outCubic) * (1 - P(t, 15, 16));
  const sc = 1 + conv * .3;
  g.translate(960, 540); g.scale(sc, sc); g.translate(-960 - Math.sin(t * .05) * 120, -540);
  g.lineWidth = 1.2;
  EDGES.forEach(([i, j, s]) => {
    const a = NODES[i], b = NODES[j];
    g.strokeStyle = `rgba(143,182,255,${.12 * a.z})`; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    const ph = (t * (.08 + s * .12) + s) % 1;
    g.fillStyle = `rgba(143,182,255,${.55 * a.z})`; g.beginPath(); g.arc(lerp(a.x, b.x, ph), lerp(a.y, b.y, ph), 2.2, 0, 7); g.fill();
  });
  NODES.forEach(n => { g.fillStyle = `rgba(143,182,255,${.35 * n.z})`; g.beginPath(); g.arc(n.x, n.y, 3 * n.z, 0, 7); g.fill(); });
}
const grain = $('grainc').getContext('2d');
const GT = [0, 1, 2, 3].map(s => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const id = x.createImageData(256, 256); const R = mulberry32(100 + s); for (let i = 0; i < id.data.length; i += 4) { const v = R() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return c; });
function drawGrain(t) { const f = Math.floor(t * FPS); const pat = grain.createPattern(GT[f % 4], 'repeat'); grain.setTransform(1, 0, 0, 1, (f * 37) % 256, (f * 91) % 256); grain.fillStyle = pat; grain.fillRect(-256, -256, 2432, 1592); }

const wipe = $('wipe');
function drawWipe(t) {
  const w = WIPES.find(w => t >= w - .22 && t < w + .22);
  if (!w) { wipe.style.display = 'none'; return; }
  const p = (t - (w - .22)) / .44; // 0..1, fully covering at .5
  wipe.style.display = 'block';
  S(wipe, { transform: `translateX(${lerp(-160, 170, E.inOutCubic(p))}%) skewX(-12deg)`, width: '75%' });
}
const fadeOut = div($('stage'), 'abs', { inset: '0', background: '#050d1d', opacity: 0, zIndex: 50 });
function camera(t) {
  let a = 0;
  HITS.forEach(h => { const d = t - h.t; if (d >= 0 && d < .45) a += h.amt * Math.pow(1 - d / .45, 2); });
  const f = Math.floor(t * FPS);
  const x = (hash(f * 3 + 1) - .5) * 18 * a, y = (hash(f * 5 + 2) - .5) * 18 * a;
  const drift = Math.sin(t * .4) * 4;
  world.style.transform = `translate(${x + drift}px,${y}px) scale(${1 + a * .012})`;
  const fl = FLASHES.find(x => t >= x && t < x + .35);
  $('flash').style.opacity = fl !== undefined ? .32 * (1 - (t - fl) / .35) : 0;
  fadeOut.style.opacity = P(t, DUR - .9, DUR - .05, E.inOutCubic);
}

// safety net: no display type may leave the frame (shrinks font once, layout-based so it's deterministic)
function fitAll(root) {
  root.querySelectorAll('.D').forEach(el => {
    if (el._fit) return; el._fit = 1;
    const fs = parseFloat(el.style.fontSize || getComputedStyle(el).fontSize);
    if (el.style.width === '1920px') {
      const rg = document.createRange(); rg.selectNodeContents(el);
      const k = el.getBoundingClientRect().width / el.offsetWidth || 1;
      const cw = rg.getBoundingClientRect().width / k;
      if (cw > 1780) el.style.fontSize = fs * 1780 / cw + 'px';
    } else if (el.offsetParent === root && el.offsetLeft + el.scrollWidth > 1840) {
      el.style.fontSize = fs * (1840 - el.offsetLeft) / el.scrollWidth + 'px';
    }
  });
}
$('caps').style.display = 'none'; $('capsband').style.display = 'none';
let preloaded = false;
window.seek = async (tOut) => {
  const t = toFilm(tOut);
  if (!preloaded) {
    await Promise.all(PRELOAD); await document.fonts.ready;
    for (const s of SHOTS) { s.root.style.display = 'block'; fitAll(s.root); s.root.style.display = 'none'; }
    preloaded = true;
  }
  pending = [];
  drawBg(t);
  for (const s of SHOTS) {
    const on = t >= s.a && t < s.b;
    s.root.style.display = on ? 'block' : 'none';
    if (on) {
      s.up(t, s.a, s.b);
      if (s.punch) { const lt = t - s.a; S(s.root, { transform: `scale(${lerp(1.045, 1, P(lt, 0, .5))})`, opacity: P(lt, 0, .06, E.lin) }); }
    }
  }
  drawWipe(t); camera(t); drawGrain(tOut);
  await Promise.all(pending);
};
window.getSfx = () => SFX.map(c => Object.assign({}, c, { t: +toOut(c.t).toFixed(3) })).sort((a, b) => a.t - b.t);
})();
