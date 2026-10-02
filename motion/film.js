// SCIA 2026 highlight film. Pure function of time: window.seek(t) paints frame t.
// Data (timeline + audio envelope) is injected by render.mjs as window.TL / window.ENV.
(() => {
const TL = window.TL, ENV = window.ENV || [];
const FPS = TL.fps, SRC_FPS = TL.srcFps, NFRAMES = 1633;

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
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (n) => mulberry32(n * 9301 + 49297)();

// ---------- time mapping ----------
const CUES = TL.cues.map(([s, e, txt]) => {
  const c = TL.clips.find(c => s >= c.src[0] - .06 && s < c.src[1]);
  if (!c) return null;
  const off = c.dst - c.src[0];
  return { a: Math.max(c.dst, s + off), b: Math.min(e, c.src[1]) + off, txt };
});
const C = CUES;
// word timing: distributed by character weight inside the cue
CUES.forEach(c => {
  if (!c) return;
  const ws = c.txt.split(/\s+/); const wts = ws.map(w => w.length + 2); const tot = wts.reduce((a, b) => a + b, 0);
  let acc = 0; c.words = ws.map((w, i) => { const s = c.a + (c.b - c.a) * acc / tot; acc += wts[i]; return { w, t: s }; });
});
const W = (ci, word) => {
  const c = C[ci]; const k = c.words.find(x => x.w.toLowerCase().replace(/[^a-z0-9,$%-]/g, '').startsWith(word.toLowerCase()));
  if (!k) throw new Error('word not found ' + ci + ' ' + word);
  return k.t;
};
const env = t => ENV[clamp(Math.floor(t * FPS), 0, ENV.length - 1)] || 0;

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
const fmt = n => Math.round(n).toLocaleString('en-US');
const srcAt = t => { const c = TL.clips.find(c => t >= c.dst && t < c.dst + (c.src[1] - c.src[0])); return c ? c.src[0] + (t - c.dst) : 0; };
const FACES = { ron: [428, 696, 630, 354], wad: [697, 827, 540, 276], tom: [1026, 1314, 612, 348] };
const faceSrc = (id, s) => { const [a, b, w, h] = FACES[id]; return { url: `assets/faces/${id}/${String(clamp(Math.floor(s * SRC_FPS) + 1, a, b)).padStart(5, '0')}.jpg`, crop: [0, 0, w, h], nat: [w, h] }; };
const CLIPN = { A: 207, B: 151 };
const clipUrl = (k, t) => `assets/clip${k}/${String(clamp(Math.floor(t * 30) + 1, 1, CLIPN[k])).padStart(4, '0')}.jpg`;
const LOGO = { intel: 'assets/logo_intel.jpg', gofo: 'assets/logo_gofo.jpg', gp: 'assets/logo_gp.jpg', rel: 'assets/logo_reliance.png',
  cscmp: 'assets/cscmp.png', scbw: 'assets/scb_white.png', edgew: 'assets/edge_white.png', edge: 'assets/edge.png', scb: 'assets/scb.png' };
const PRELOAD = Object.values(LOGO).map(u => { const i = new Image(); i.src = u; return i.decode().catch(() => {}); });
const frameUrl = s => 'assets/frames/' + String(clamp(Math.floor(s * SRC_FPS) + 1, 1, NFRAMES)).padStart(5, '0') + '.jpg';

// a footage plate: shows a crop of a source frame inside a box, with camera push
function plate(parent, z = 0) {
  const d = div(parent, 'plate', { zIndex: z }); const img = document.createElement('img'); d.appendChild(img);
  let cur = '';
  return {
    el: d,
    set(o) {
      const { src, crop = [0, 68, 1672, 944], x = 960, y = 540, w = 1600, h = 900, zoom = 1, px = 0, py = 0,
        op = 1, rx = 0, ry = 0, rz = 0, s = 1, blur = 0, br = 1, sat = 1, radius = 18, tx = 0, ty = 0, nat = [1920, 1080] } = o;
      const url = o.url || frameUrl(src);
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
function logoTile(parent, f, w, h, css = {}) {
  const d = div(parent, 'abs', Object.assign({ width: w + 'px', height: h + 'px', background: '#fff', borderRadius: '14px', overflow: 'hidden',
    boxShadow: '0 30px 70px rgba(0,0,0,.45)' }, css));
  const [px, py] = f.logoPad || [.17, .2];
  div(d, 'abs', { left: w * px + 'px', right: w * px + 'px', top: h * py + 'px', bottom: h * (f.with ? py + .16 : py) + 'px',
    background: `url(${LOGO[f.logo]}) center/contain no-repeat`, mixBlendMode: 'multiply' });
  if (f.with) div(d, 'abs U', { left: '0', right: '0', bottom: h * .1 + 'px', textAlign: 'center', fontWeight: 700, fontSize: Math.round(h * .12) + 'px', color: '#0b2a5c' }, f.with);
  return d;
}
// speaker panel: webcam footage + broadcast lower third
function speaker(r, name, org, get) {
  const pl = plate(r);
  const l3 = div(r, 'abs', { whiteSpace: 'nowrap', display: 'flex', alignItems: 'stretch', zIndex: 2, opacity: 0 });
  const nm = div(l3, '', { background: '#f5f7fb', color: '#0b1d3d', padding: '12px 22px 9px', fontFamily: "'Barlow Condensed'", fontWeight: 800,
    fontSize: '40px', textTransform: 'uppercase', lineHeight: '1' }, name);
  const og = div(l3, '', { background: 'var(--red)', color: '#fff', padding: '0 18px', display: 'flex', alignItems: 'center', fontFamily: 'Inter',
    fontWeight: 600, fontSize: '20px', letterSpacing: '.18em', textTransform: 'uppercase' }, org);
  return (t, lt, o) => {
    const g = get(t, lt); const e = P(lt, 0, .6);
    pl.set(Object.assign({ x: o.x, y: o.y, w: o.w, h: o.h, zoom: 1.02 + lt * .015, op: e, tx: (1 - e) * (o.from || -140), ry: o.ry || 0, radius: 16 }, g));
    const k = P(lt, .35, .8, E.outCubic);
    S(l3, { left: (o.x - o.w / 2 + 34) + 'px', top: (o.y + o.h / 2 - 34) + 'px', opacity: k, clipPath: `inset(0 ${(1 - k) * 100}% 0 0)` });
  };
}

// smooth rolling-digit counter: layout is locked to the final string (no width jitter), digits roll
// continuously with a touch of motion blur, rightmost digits spin fastest like a real counter
function odometer(parent, text, css, opts = {}) {
  const fs = parseFloat(css.fontSize), RH = Math.round(fs * 1.0);
  const d = div(parent, 'D abs', Object.assign({ height: RH + 'px', lineHeight: RH + 'px' }, css));
  const chars = [...text], dig = chars.map((c, i) => /\d/.test(c) ? i : -1).filter(i => i >= 0), nd = dig.length;
  const cols = chars.map((ch, i) => {
    const sp = document.createElement('span');
    Object.assign(sp.style, { display: 'inline-block', verticalAlign: 'top', height: RH + 'px', overflow: 'hidden', lineHeight: RH + 'px' });
    if (/\d/.test(ch)) sp.style.webkitMaskImage = sp.style.maskImage = 'linear-gradient(to bottom, transparent 0%, #000 11%, #000 89%, transparent 100%)';
    if (opts.red && opts.red.includes(ch)) sp.classList.add('red');
    d.appendChild(sp);
    if (!/\d/.test(ch)) { sp.textContent = ch; return null; }
    const k = dig.indexOf(i), cycles = opts.cycles ?? (1 + Math.floor((nd - 1 - k) * .34));
    const travel = cycles * 10 + +ch;
    const strip = document.createElement('div');
    strip.innerHTML = Array.from({ length: travel + 1 }, (_, j) => `<div style="height:${RH}px">${j % 10}</div>`).join('');
    sp.appendChild(strip); return { strip, travel };
  });
  d.roll = (p, pPrev = p) => cols.forEach(c => {
    if (!c) return;
    const v = Math.abs(c.travel * (p - pPrev));
    c.strip.style.transform = `translateY(${-c.travel * p * RH}px)`;
    c.strip.style.filter = v > .04 ? `blur(${Math.min(4, v * 1.6).toFixed(2)}px)` : 'none';
  });
  return d;
}
const roll = (el, t, a, b, e = E.inOutCubic) => el.roll(P(t, a, b, e), P(t - 1 / FPS, a, b, e));

// ---------- shots ----------
const SHOTS = [];
function shot(a, b, build, opts = {}) {
  const root = div(world, 'shot'); root.style.zIndex = opts.z || 1;
  const up = build(root, a, b);
  SHOTS.push({ a, b, root, up, punch: opts.punch !== false });
}

// ======================================================================
// FINALISTS
// ======================================================================
const FIN = [
  { n: '01', name: 'Intel', logo: 'intel', tag: 'Market Intelligence', logoPad: [.22, .2], sub: 'AI-Driven Market Intelligence for Proactive Supply Chain Defense', p: { src: 12.2, crop: [0, 68, 1672, 944] }, th: { src: 12.2, crop: [930, 170, 620, 620] } },
  { n: '02', name: 'GOFO', logo: 'gofo', tag: 'National Parcel Network', logoPad: [.12, .3], sub: 'Building a National Parcel Network from Zero with Atlas', p: { src: 36.5, crop: [0, 60, 1680, 900] }, th: { src: 28.5, crop: [80, 380, 820, 480] } },
  { n: '03', name: 'Intel', logo: 'intel', tag: 'Chem & Gas Control Tower', logoPad: [.22, .2], sub: 'From Reactive to Predictive: An Intelligent Control Tower for Chemical & Gas Supply', p: { src: 52.5, crop: [0, 60, 1680, 900] }, th: { src: 57.5, crop: [1100, 230, 600, 330] } },
  { n: '04', name: 'Georgia-Pacific', with: '× project44', logo: 'gp', tag: 'Yard Operations', logoPad: [.26, .05], sub: 'From 5 Minutes to Under 2: Transforming Yard Operations with project44 YMS', p: { src: 66.5, crop: [0, 60, 1680, 900] }, th: { src: 66.5, crop: [560, 580, 420, 220] } },
  { n: '05', name: 'Reliance Industries', logo: 'rel', tag: 'Emergency Response Network', logoPad: [.2, .05], sub: 'From Reactive to Resilient: An Emergency Response Network', p: { src: 83.5, crop: [0, 60, 1680, 900] }, th: { src: 89, crop: [92, 255, 460, 320] } },
];
const CARD_T = [17.5, 35.5, 54.5, 72.5, 92.5];

// ---------------- HOOK: "from firefighting to foresight" ----------------
shot(0, 3.5, (r) => {
  const line = div(r, 'abs', { left: '0px', top: '539px', width: '1920px', height: '3px', background: 'var(--white)', transformOrigin: '50% 50%' });
  const pl = plate(r);
  const lab = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '190px' }, 'Intel · Market Intelligence');
  const f1 = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '240px', fontSize: '250px' }, 'Firefighting');
  const strike = div(r, 'abs', { left: '330px', top: '340px', width: '1260px', height: '14px', background: 'var(--red)', transformOrigin: '0 50%' });
  const f2 = words(r, '→ Foresight', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '490px', fontSize: '290px' });
  f2.ws[1].classList.add('red');
  const tTo = W(5, 'to'), tF = W(5, 'foresight');
  sfx(0, 'riser', .35); sfx(.45, 'pulse', .55); sfx(tTo - .05, 'swipe', .7); sfx(tF - .02, 'accent', .7); sfx(tF + .05, 'shimmer', .45, 0); hit(tF, .35);
  return (t) => {
    const lp = P(t, .02, .45, E.inOutExpo), out = P(t, .45, .8, E.inOutExpo);
    S(line, { transform: `scaleX(${lp}) scaleY(${1 - out})`, opacity: 1 - out });
    pl.set({ src: 13, crop: [0, 68, 1672, 944], w: 1920, h: 1080, zoom: 1.15 + t * .02, op: P(t, .5, 1.2) * .5, blur: 10, br: .3, radius: 0 });
    S(lab, { opacity: P(t, .55, .9) });
    S(f1, { opacity: P(t, .55, .7) * lerp(1, .35, P(t, tTo, tTo + .3)), transform: `scale(${lerp(1.08, 1, P(t, .55, 1.1))})` });
    S(strike, { transform: `scaleX(${P(t, tTo, tTo + .35, E.inOutExpo)})` });
    reveal(f2, t, tF - .1, .06, .6);
    S(f2, { transform: `scale(${1 + P(t, tF, 3.5, E.lin) * .03})` });
  };
});

// ---------------- PROOF MONTAGE: one headline number per finalist ----------------
shot(3.5, 10.5, (r, a) => {
  const bgp = plate(r);
  const shade = div(r, 'abs', { inset: '0', background: 'radial-gradient(ellipse at 50% 45%, rgba(5,13,29,.72) 0%, rgba(5,13,29,.55) 55%, rgba(5,13,29,.85) 100%)' });
  const C0 = { left: '0', width: '1920px', textAlign: 'center', top: '240px', fontSize: '300px' };
  const STATS = [
    { t: 3.6, f: FIN[1], el: odometer(r, '3,000,000', C0), label: 'Parcels a day, built from zero', p: 0 },
    { t: 4.85, f: FIN[0], el: odometer(r, '5,000', C0), label: 'Active parts protected by AI', p: 3 },
    { t: 6.1, f: FIN[3], el: div(r, 'D abs', C0, '5:00 <span class="red">→</span> 2:00'), label: 'Minutes to check in a truck', p: 5 },
    { t: 7.35, f: FIN[2], el: odometer(r, '88%', C0, { red: ['%'], cycles: 1 }), label: 'Fewer high-risk parts', p: 7 },
    { t: 8.6, f: FIN[4], el: div(r, 'D abs', C0, '0'), label: 'Fatalities on the road', p: 10 },
  ];
  const lb = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '550px', fontSize: '32px', color: 'var(--white)' });
  const tiles = STATS.map(st => { const c = div(r, 'abs', { left: (960 - 130) + 'px', top: '640px', width: '260px', height: '200px' }); logoTile(c, st.f, 260, 147); return c; });
  STATS.forEach((st, i) => { sfx(st.t, 'stab', .75, st.p); if (st.el.roll) sfx(st.t + .02, 'ticks', .35); sfx(st.t + .2, 'tap', .3, i * 2); hit(st.t, .25); });
  sfx(9.75, 'whoosh', .55);
  return (t) => {
    const lt = t - a;
    bgp.set({ url: clipUrl('B', lt * .75), crop: [0, 0, 1920, 1080], w: 1920, h: 1080, zoom: 1.06 + lt * .015, op: P(lt, 0, .3), radius: 0, sat: .7 });
    let k = -1; STATS.forEach((st, i) => { if (t >= st.t) k = i; });
    const end = t >= 9.85;
    STATS.forEach((st, i) => {
      const on = i === k && !end;
      S(st.el, { display: on ? 'block' : 'none', opacity: P(t, st.t, st.t + .08), transform: `scale(${lerp(1.06, 1, P(t, st.t, st.t + .5, E.outCubic))})` });
      if (on && st.el.roll) roll(st.el, t, st.t, st.t + 1.0, E.outCubic);
      const p = on ? P(t, st.t + .05, st.t + .4, E.outCubic) : 0;
      S(tiles[i], { opacity: p, transform: `translateY(${(1 - p) * 30}px)` });
    });
    if (k < 0 || end) { lb.textContent = ''; return; }
    lb.textContent = STATS[k].label; S(lb, { opacity: P(t, STATS[k].t + .15, STATS[k].t + .35) });
  };
});

// ---------------- TITLE ----------------
shot(10.5, 17.5, (r) => {
  const pl = plate(r);
  const shade = div(r, 'abs', { inset: '0', background: 'radial-gradient(ellipse at 50% 38%, rgba(5,13,29,.72) 0%, rgba(5,13,29,.35) 55%, rgba(5,13,29,.6) 100%)' });
  const pre = div(r, 'abs', { left: '0', width: '1920px', top: '130px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px' });
  div(pre, '', { width: '124px', height: '124px', borderRadius: '50%', background: `#fff url(${LOGO.cscmp}) center/112px no-repeat`, boxShadow: '0 0 0 3px rgba(255,255,255,.15)' });
  div(pre, '', { width: '2px', height: '84px', background: 'rgba(245,247,251,.35)' });
  div(pre, '', { width: '360px', height: '62px', background: `url(${LOGO.scbw}) center/contain no-repeat` });
  const pres = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '268px', color: 'var(--white)' }, 'present');
  const t1 = words(r, 'Supply Chain', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '330px', fontSize: '200px' });
  const t2 = words(r, 'Innovation Award', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '500px', fontSize: '200px' });
  t2.lastChild.querySelector('.wi').innerHTML += '<sup style="font-size:.25em;vertical-align:top;line-height:1.2">™</sup>';
  const bar = div(r, 'abs', { left: '810px', width: '300px', height: '8px', top: '700px', background: 'var(--red)', transformOrigin: '50% 50%' });
  const fin = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '740px', fontSize: '64px', letterSpacing: '.18em', color: 'var(--sky)' }, 'The 2026 Finalists');
  const group = [pre, pres, t1, t2, bar];
  const TW = 300, TH = 170, GAP = 40, X0 = 960 - (5 * TW + 4 * GAP) / 2;
  const cards = FIN.map((f, i) => {
    const c = div(r, 'abs', { left: (X0 + i * (TW + GAP)) + 'px', top: '520px', width: TW + 'px', height: '260px' });
    logoTile(c, f, TW, TH);
    const tg = div(c, 'abs U', { left: '0', width: TW + 'px', top: (TH + 20) + 'px', textAlign: 'center', fontWeight: 600, fontSize: '22px', lineHeight: 1.25, color: 'var(--white)' },
      `<span style="color:var(--red);font-family:'Barlow Condensed';font-weight:800;font-size:26px;margin-right:8px">${f.n}</span>${f.tag}`);
    return { c, f };
  });
  sfx(10.0, 'riser', .8); sfx(10.5, 'boom', 1); hit(10.5, 1.2); FLASHES.push(10.5);
  sfx(13.45, 'whoosh', .55); FIN.forEach((f, i) => sfx(13.55 + i * .11, 'tap', .4, [0, 3, 5, 7, 10][i]));
  sfx(17.0, 'riser_short', .4);
  return (t) => {
    const lt = t - 10.5;
    pl.set({ url: clipUrl('A', lt), crop: [0, 0, 1920, 1080], w: 1920, h: 1080, zoom: 1.02 + lt * .01, op: 1, br: .95, radius: 0 });
    S(pre, { opacity: P(lt, .1, .6), transform: `translateY(${(1 - P(lt, .1, .8)) * 20}px)` });
    S(pres, { opacity: P(lt, .3, .8), letterSpacing: lerp(.6, .32, P(lt, .3, 1.4)) + 'em' });
    reveal(t1, lt, .15, .08, .6); reveal(t2, lt, .35, .08, .6);
    S(bar, { transform: `scaleX(${P(lt, .7, 1.3, E.inOutExpo)})` });
    const up = P(lt, 2.9, 3.5, E.inOutExpo);
    S(fin, { opacity: P(lt, 1.6, 2.1) * (1 - P(lt, 2.7, 3.0)), transform: `translateY(${(1 - P(lt, 1.6, 2.2)) * 20}px)` });
    const tgt = [[130, 34, .62], [268, 112, .8], [330, 150, .72], [500, 275, .72], [700, 418, .7]];
    group.forEach((g, i) => S(g, { transform: `translateY(${-up * (tgt[i][0] - tgt[i][1])}px) scale(${lerp(1, tgt[i][2], up)})`, transformOrigin: '50% 0%' }));
    const push = P(lt, 6.3, 7.0, E.inExpo);
    cards.forEach(({ c }, i) => {
      const p = P(lt, 3.05 + i * .11, 3.75 + i * .11, E.outCubic);
      const fl = Math.sin((lt + i) * 1.3) * 4;
      S(c, { opacity: clamp(p * 1.5) * (i === 0 ? 1 : 1 - push), transformOrigin: '150px 85px',
        transform: `translateY(${(1 - p) * 140 + fl}px) rotate(${(1 - p) * (i - 2) * 3}deg) scale(${i === 0 ? 1 + push * 3 : 1})` });
    });
  };
});

// ---------------- CHAPTER CARDS ----------------
FIN.forEach((f, i) => {
  const a = CARD_T[i];
  WIPES.push(a);
  sfx(a - .25, 'whoosh', .7); sfx(a, 'card', .75, [0, 2, 3, 5, 7][i]); sfx(a + .3, 'shimmer', .3, [0, 2, 3, 5, 7][i]); hit(a, .45);
  if (i === 3) sfx(a + 1.3, 'chime', .9); // yard PA chime before "Attention"
  shot(a, a + 2.0, (r) => {
    const pl = plate(r);
    const idx = div(r, 'D abs out', { left: '90px', top: '170px', fontSize: '560px', WebkitTextStroke: '3px rgba(245,247,251,.25)' }, f.n);
    const tile = logoTile(r, f, 340, 192, { left: '760px', top: '170px' });
    const lab = div(r, 'lbl abs', { left: '760px', top: '410px' }, `Finalist ${f.n} / 05`);
    const bar = div(r, 'abs', { left: '760px', top: '452px', width: '120px', height: '8px', background: 'var(--red)', transformOrigin: '0 50%' });
    const nm = words(r, f.name, 'D', { left: '752px', top: '485px', fontSize: '150px' });
    const wi = f.with ? div(r, 'D abs', { left: '760px', top: '622px', fontSize: '64px', color: 'var(--sky)', textTransform: 'none' }, f.with) : null;
    const sub = div(r, 'U abs', { left: '760px', top: f.with ? '700px' : '640px', width: '1000px', fontSize: '34px', fontWeight: 500, lineHeight: 1.3, color: 'rgba(245,247,251,.85)' }, f.sub);
    return (t) => {
      const lt = t - a;
      pl.set({ src: f.p.src, crop: f.p.crop, x: 960, y: 540, w: 1920, h: 1080, zoom: 1.1 + lt * .06, op: 1, blur: 14, br: .32, sat: .6, radius: 0 });
      S(idx, { transform: `translateX(${(1 - P(lt, .05, .7)) * -220 + lt * 14}px)`, opacity: P(lt, .05, .4) });
      const tp = P(lt, .08, .55, E.outCubic);
      S(tile, { opacity: tp, transform: `translateY(${(1 - tp) * 40}px) scale(${lerp(.92, 1, tp)})`, transformOrigin: '0 50%' });
      S(lab, { opacity: P(lt, .2, .5) }); S(bar, { transform: `scaleX(${P(lt, .2, .7, E.inOutExpo)})` });
      reveal(nm, lt, .22, .07, .6);
      if (wi) S(wi, { opacity: P(lt, .5, .8), transform: `translateY(${(1 - P(lt, .5, .9)) * 20}px)` });
      S(sub, { opacity: P(lt, .55, .95), transform: `translateY(${(1 - P(lt, .55, 1.1)) * 24}px)` });
    };
  }, { punch: false });
  WIPES.push(a + 2.0);
});

// ======================================================================
// 01 INTEL — MARKET INTELLIGENCE
// ======================================================================
shot(19.5, C[2].a, (r, a) => {
  const pl = plate(r);
  const lab = div(r, 'lbl abs', { left: '154px', top: '250px' }, 'Intel · Finalist 01');
  const l1 = words(r, "I've never seen", 'D', { left: '150px', top: '300px', fontSize: '150px' });
  const l2 = words(r, 'conditions like this.', 'D', { left: '150px', top: '440px', fontSize: '150px' });
  sfx(W(1, 'conditions'), 'pulse', .45);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 1.0, crop: [0, 68, 1672, 944], x: 1540, y: 745, w: 580, h: 327, zoom: 1 + lt * .03, ry: -16, op: P(lt, .2, .7) * .8, br: .7 });
    S(lab, { opacity: P(lt, .1, .4) });
    reveal(l1, t, C[1].a - .1, .07); reveal(l2, t, W(1, 'conditions') - .1, .07);
  };
});
shot(C[2].a, C[4].a, (r, a) => {
  const lab = div(r, 'lbl abs', { left: '154px', top: '200px' }, 'The operating environment');
  const a1 = words(r, 'Supply chains', 'D', { left: '150px', top: '250px', fontSize: '170px' });
  const a2 = words(r, 'are being used', 'D', { left: '150px', top: '400px', fontSize: '170px', color: 'rgba(245,247,251,.6)' });
  const a3 = words(r, 'as a weapon', 'D', { left: '150px', top: '550px', fontSize: '170px' });
  const bar = div(r, 'abs', { left: '154px', top: '720px', width: '220px', height: '8px', background: 'var(--sky)', transformOrigin: '0 50%' });
  const tW = W(2, 'weapon');
  sfx(tW - .3, 'accent', .4);
  return (t) => {
    const lt = t - a;
    S(lab, { opacity: P(lt, 0, .3) });
    reveal(a1, t, a, .07); reveal(a2, t, W(2, 'literally'), .07); reveal(a3, t, W(2, 'as'), .07);
    S(bar, { transform: `scaleX(${P(t, tW, tW + .5, E.inOutExpo)})` });
  };
});
shot(C[4].a, C[6].a, (r, a) => {
  const pl = plate(r);
  const lab = div(r, 'lbl abs', { left: '120px', top: '250px' }, 'Intel · Finalist 01');
  const h = words(r, 'Platform MI', 'D', { left: '114px', top: '310px', fontSize: '124px' });
  const tags = ['Agentic AI', 'Live market signals', 'Part-level intelligence'].map((s, i) => div(r, 'U abs', {
    left: '124px', top: (480 + i * 70) + 'px', fontSize: '34px', fontWeight: 600, whiteSpace: 'nowrap' },
    `<span style="display:inline-block;width:14px;height:14px;background:var(--red);margin-right:18px;vertical-align:middle"></span>${s}`));
  const tp = [W(4, 'with'), W(4, 'platform'), W(4, 'place')];
  tp.forEach((x, i) => sfx(x, 'tap', .35, i * 2));
  return (t) => {
    const lt = t - a;
    const e = P(lt, 0, .8);
    pl.set({ src: 12.2, crop: [0, 68, 1672, 944], x: 1310 + (1 - e) * 400, y: 470, w: 1060, h: 598, zoom: 1 + lt * .02, ry: -14, op: e });
    S(lab, { opacity: P(lt, .1, .4) }); reveal(h, lt, .15, .08);
    tags.forEach((g, i) => { const p = P(t, tp[i], tp[i] + .5); S(g, { opacity: p, transform: `translateX(${(1 - p) * -30}px)` }); });
  };
});
shot(C[6].a, CARD_T[1], (r, a) => {
  const pl = plate(r);
  const n = odometer(r, '5,000', { left: '1140px', top: '250px', fontSize: '280px' });
  const lbl = words(r, 'Active part numbers protected', 'U', { left: '1150px', top: '510px', fontSize: '38px', fontWeight: 600, width: '700px', whiteSpace: 'normal' });
  const t5 = W(6, '5,000');
  sfx(t5 - .1, 'ticks', .5); sfx(t5 + .9, 'lock', .6);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 20.5, crop: [0, 300, 1680, 580], x: 590, y: 450, w: 960, h: 331, zoom: 1 + lt * .02, ry: 14, op: P(lt, 0, .5), tx: (1 - P(lt, 0, .6)) * -200 });
    roll(n, t, t5 - .15, t5 + .9);
    S(n, { opacity: P(t, t5 - .3, t5) });
    reveal(lbl, t, t5 + .3, .05);
  };
});
// ======================================================================
// 02 GOFO
// ======================================================================
shot(CARD_T[1] + 2, C[9].a, (r, a) => {
  const sp = speaker(r, 'Ron Jansen', 'GOFO', t => faceSrc('ron', srcAt(t)));
  const lab = div(r, 'lbl abs', { left: '1160px', top: '300px' }, 'GOFO · Finalist 02');
  const q = words(r, '“Imagine you’re sitting there…”', 'U', { left: '1160px', top: '345px', fontSize: '40px', fontWeight: 500, color: 'rgba(245,247,251,.85)', fontStyle: 'italic' });
  const n = div(r, 'D abs', { left: '1150px', top: '420px', fontSize: '230px' }, '500K');
  const nl = div(r, 'lbl abs', { left: '1160px', top: '640px', color: 'var(--white)', fontSize: '26px' }, 'Parcels a day · 2024');
  const tA = W(8, '500,000');
  sfx(tA, 'lock', .55);
  return (t) => {
    const lt = t - a;
    sp(t, lt, { x: 560, y: 450, w: 900, h: 506 });
    S(lab, { opacity: P(lt, .2, .5) }); reveal(q, lt, .3, .05);
    S(n, { opacity: P(t, tA - .1, tA + .1), transform: `scale(${lerp(1.2, 1, P(t, tA - .1, tA + .4))})`, transformOrigin: '0 50%' });
    S(nl, { opacity: P(t, tA + .2, tA + .5) });
  };
});
shot(C[9].a, C[10].a, (r, a) => {
  const pl = plate(r);
  const s = svg(r, 760, 560, { left: '1080px', top: '170px' });
  for (let i = 0; i < 4; i++) sv(s, 'line', { x1: 0, x2: 740, y1: 500 - i * 150, y2: 500 - i * 150, stroke: 'rgba(143,182,255,.18)', 'stroke-width': 2 });
  const act = sv(s, 'path', { d: 'M0 480 C120 470 200 460 260 440', fill: 'none', stroke: '#f5f7fb', 'stroke-width': 8, 'stroke-linecap': 'round' });
  const fc = sv(s, 'path', { d: 'M260 440 C420 380 560 200 700 40', fill: 'none', stroke: '#e3243b', 'stroke-width': 8, 'stroke-dasharray': '18 16', 'stroke-linecap': 'round' });
  const d1 = sv(s, 'circle', { cx: 260, cy: 440, r: 14, fill: '#f5f7fb' });
  const d2 = sv(s, 'circle', { cx: 700, cy: 40, r: 16, fill: '#e3243b' });
  const n1 = div(r, 'D abs', { left: '1250px', top: '540px', fontSize: '110px' }, '500K');
  const n1l = div(r, 'lbl abs', { left: '1256px', top: '650px', color: 'var(--white)' }, 'Parcels / day · now');
  const n2 = div(r, 'D abs red', { left: '1560px', top: '200px', fontSize: '130px' }, '3M?');
  const n2l = div(r, 'lbl abs', { left: '1564px', top: '320px' }, 'Next peak');
  const tA = a + .1, tB = W(9, '3');
  sfx(tB - .3, 'riser_short', .5); sfx(tB + .2, 'accent', .5); hit(tB + .2, .25);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 28.5, crop: [0, 70, 1680, 850], x: 560, y: 450, w: 920, h: 466, zoom: 1 + lt * .03, px: -.4, ry: 14, op: P(lt, 0, .5) });
    strokeDraw(act, P(lt, .2, 1.4, E.inOutCubic));
    const pd = P(t, tA, tA + .4, E.outBack); S(d1, { transform: `scale(${pd})`, transformOrigin: '260px 440px', transformBox: 'view-box' });
    S(n1, { opacity: P(t, tA, tA + .3), transform: `translateY(${(1 - P(t, tA, tA + .5)) * 30}px)` }); S(n1l, { opacity: P(t, tA + .2, tA + .5) });
    const f = P(t, tB - .4, tB + .3, E.inOutCubic);
    fc.style.strokeDashoffset = 0; fc.style.clipPath = `inset(${(1 - f) * 100}% 0 0 0)`;
    S(fc, { opacity: f > 0 ? 1 : 0 }); fc.setAttribute('stroke-dashoffset', -lt * 40);
    S(d2, { opacity: P(t, tB + .1, tB + .3) });
    const pulse = 1 + .08 * Math.sin(lt * 9) * P(t, tB + .4, tB + .8);
    S(n2, { opacity: P(t, tB + .15, tB + .4), transform: `scale(${lerp(1.4, 1, P(t, tB + .15, tB + .6)) * pulse})`, transformOrigin: '0 50%' });
    S(n2l, { opacity: P(t, tB + .4, tB + .8) });
  };
});
shot(C[10].a, C[12].a, (r, a) => {
  const q1 = words(r, 'What am I', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '250px', fontSize: '230px' });
  const q2 = words(r, 'gonna do?', 'D red', { left: '0', width: '1920px', textAlign: 'center', top: '450px', fontSize: '230px' });
  const r1 = words(r, 'Are my systems', 'D out', { left: '0', width: '1920px', textAlign: 'center', top: '250px', fontSize: '230px' });
  const r2 = words(r, 'ready?', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '450px', fontSize: '230px' });
  const tR = C[11].a;
  sfx(a, 'pulse', .5); sfx(tR - .05, 'tape', .55); hit(tR, .2);
  return (t) => {
    const on1 = t < tR, j = (hash(Math.floor(t * 30) + 7) - .5) * 14 * P(t, tR, tR + .3, E.lin) * (t < tR + .3 ? 1 : 0);
    [q1, q2].forEach(e => S(e, { display: on1 ? 'block' : 'none' }));
    [r1, r2].forEach(e => S(e, { display: on1 ? 'none' : 'block', transform: `translateX(${j}px)` }));
    reveal(q1, t, a, .06, .4); reveal(q2, t, a + .2, .06, .4);
    reveal(r1, t, tR, .05, .35); reveal(r2, t, W(11, 'ready'), .05, .4);
    S(r2, { transform: `translateX(${j}px) scale(${lerp(1.15, 1, P(t, W(11, 'ready'), W(11, 'ready') + .5))})` });
  };
});
shot(C[12].a, C[13].a, (r, a) => {
  const pl = plate(r);
  const od = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '170px', fontSize: '290px', height: '260px', overflow: 'hidden' });
  const target = '3,000,000';
  const cols = [...target].map((ch, i) => {
    const c = document.createElement('span'); c.style.display = 'inline-block'; c.style.verticalAlign = 'top'; c.style.height = '250px'; c.style.overflow = 'hidden';
    const strip = document.createElement('span'); strip.style.display = 'inline-block';
    strip.innerHTML = ch === ',' ? ',' : [...Array(10).keys()].map(k => `<div style="height:250px;line-height:250px">${k}</div>`).join('') + `<div style="height:250px;line-height:250px">${ch}</div>`;
    c.appendChild(strip); od.appendChild(c); return { strip, ch };
  });
  const lbl = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '460px', fontSize: '34px', color: 'var(--white)' }, 'Packages · per day');
  const t3 = W(12, 'three');
  sfx(t3 - .2, 'ticks', .6); sfx(t3 + .9, 'lock', .8); sfx(t3 + 1.0, 'shimmer', .35, 7); hit(t3 + .9, .5);
  return (t) => {
    const lt = t - a;
    cols.forEach(({ strip, ch }, i) => {
      if (ch === ',') return;
      const p = P(t, t3 - .2 + i * .05, t3 + .7 + i * .06, E.outCubic);
      strip.style.transform = `translateY(${-p * 10 * 250}px)`;
    });
    S(od, { opacity: P(t, a, a + .2) });
    S(lbl, { opacity: P(t, t3 + .6, t3 + 1) });
    pl.set({ src: 36.6, crop: [100, 225, 1480, 210], x: 960, y: 700, w: 1500, h: 213, zoom: 1, op: P(lt, .3, .8), ty: (1 - P(lt, .3, .9)) * 80, rx: 18, radius: 12 });
  };
});
shot(C[13].a, CARD_T[2], (r, a) => {
  const pl = plate(r);
  const h1 = words(r, 'Built from', 'D', { left: '150px', top: '220px', fontSize: '180px' });
  const h2 = div(r, 'D abs red', { left: '150px', top: '390px', fontSize: '330px' }, 'Zero');
  const yrs = div(r, 'D abs', { left: '1000px', top: '230px', fontSize: '180px' }, 'in 3 years');
  const bars = [0, 1, 2].map(i => {
    const bg = div(r, 'abs', { left: (1008 + i * 270) + 'px', top: '420px', width: '250px', height: '16px', background: 'rgba(143,182,255,.18)' });
    const fg = div(bg, 'abs', { inset: '0', background: i === 2 ? 'var(--red)' : 'var(--white)', transformOrigin: '0 50%' });
    const yl = div(r, 'lbl abs', { left: (1008 + i * 270) + 'px', top: '450px' }, 'Year ' + (i + 1)); return { fg, yl };
  });
  const at = div(r, 'abs U', { left: '1004px', top: '560px', padding: '16px 30px', borderRadius: '44px', background: 'var(--white)', color: 'var(--bg)', fontWeight: 700, fontSize: '36px', letterSpacing: '.08em', whiteSpace: 'nowrap' }, 'POWERED BY ATLAS');
  const tZ = W(13, 'zero'), tY = W(13, 'three'), tA = W(14, 'Atlas');
  sfx(tZ, 'pulse', .6); [0, 1, 2].forEach(i => sfx(tY + i * .22, 'tap', .4, i * 4)); sfx(tA, 'shimmer', .5, 12);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 40.5, crop: [0, 60, 1680, 900], w: 1920, h: 1080, zoom: 1.05 + lt * .03, op: .55, blur: 8, br: .32, radius: 0 });
    reveal(h1, lt, 0, .07);
    S(h2, { opacity: P(t, tZ - .05, tZ + .1), transform: `scale(${lerp(1.5, 1, P(t, tZ - .05, tZ + .4))})`, transformOrigin: '0 50%' });
    S(yrs, { opacity: P(t, tY - .2, tY + .1), transform: `translateY(${(1 - P(t, tY - .2, tY + .3)) * 30}px)` });
    bars.forEach(({ fg, yl }, i) => { fg.style.transform = `scaleX(${P(t, tY + i * .22, tY + i * .22 + .35, E.inOutCubic)})`; S(yl, { opacity: P(t, tY + i * .22, tY + i * .22 + .3) }); });
    S(at, { opacity: P(t, tA - .1, tA + .15), transform: `scale(${lerp(.7, 1, P(t, tA - .1, tA + .35, E.outBack))})`, transformOrigin: '0 50%' });
  };
});

// ======================================================================
// 03 INTEL — CONTROL TOWER
// ======================================================================
shot(CARD_T[2] + 2, C[16].a, (r, a) => {
  const sp = speaker(r, 'Andrew Wadolny', 'Intel', t => faceSrc('wad', srcAt(t)));
  const lab = div(r, 'lbl abs', { left: '1010px', top: '260px' }, 'Intel · Chemical & gas supply');
  const h1 = words(r, 'The last line', 'D', { left: '990px', top: '310px', fontSize: '150px' });
  const h2 = words(r, 'of defense', 'D red', { left: '990px', top: '455px', fontSize: '150px' });
  const sub = div(r, 'U abs', { left: '1008px', top: '650px', fontSize: '36px', fontWeight: 500, color: 'rgba(245,247,251,.85)' }, "for Intel's manufacturing flow");
  const wall = div(r, 'abs', { left: '960px', top: '250px', width: '8px', height: '480px', background: 'var(--red)', transformOrigin: '50% 100%' });
  const tL = W(15, 'last'), tD = W(15, 'defense');
  sfx(tD - .35, 'accent', .6); sfx(tD, 'pulse', .5); hit(tD, .3);
  return (t) => {
    const lt = t - a;
    sp(t, lt, { x: 490, y: 470, w: 820, h: 462, ry: 8 });
    S(lab, { opacity: P(lt, .1, .4) }); reveal(h1, t, tL - .2, .07); reveal(h2, t, tD - .15, .07);
    S(wall, { transform: `scaleY(${P(t, tD - .2, tD + .3, E.inOutExpo)})` });
    S(sub, { opacity: P(t, tD + .3, tD + .7) });
  };
});
shot(C[16].a, W(17, '88%') - .1, (r, a) => {
  const pl = plate(r);
  const s = svg(r, 520, 520, { left: '170px', top: '150px' });
  sv(s, 'circle', { cx: 260, cy: 260, r: 230, fill: 'none', stroke: 'rgba(143,182,255,.18)', 'stroke-width': 14 });
  const arc = sv(s, 'circle', { cx: 260, cy: 260, r: 230, fill: 'none', stroke: '#e3243b', 'stroke-width': 14, transform: 'rotate(-90 260 260)', 'stroke-linecap': 'round' });
  const hand = sv(s, 'line', { x1: 260, y1: 260, x2: 260, y2: 70, stroke: '#f5f7fb', 'stroke-width': 10, 'stroke-linecap': 'round' });
  sv(s, 'circle', { cx: 260, cy: 260, r: 16, fill: '#f5f7fb' });
  const n = odometer(r, '$1M', { left: '800px', top: '200px', fontSize: '330px' }, { cycles: 2 });
  const l1 = div(r, 'D abs', { left: '806px', top: '480px', fontSize: '100px', color: 'var(--sky)' }, 'per site · per day');
  const l2 = div(r, 'lbl abs', { left: '810px', top: '600px', color: 'var(--white)' }, 'Revenue impact of a line-down');
  const tM = W(16, 'million');
  sfx(tM - .3, 'ticks', .5); sfx(tM + .5, 'lock', .75); hit(tM + .5, .35);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 49, crop: [0, 60, 1680, 880], w: 1920, h: 1080, zoom: 1.1 + lt * .03, op: .5, blur: 12, br: .28, radius: 0 });
    roll(n, t, tM - .4, tM + .5);
    S(n, { opacity: P(t, tM - .5, tM - .3) });
    strokeDraw(arc, (lt * .5) % 1); hand.setAttribute('transform', `rotate(${lt * 180} 260 260)`);
    S(s, { opacity: P(lt, 0, .4) });
    S(l1, { opacity: P(t, W(16, 'per'), W(16, 'per') + .3) }); S(l2, { opacity: P(t, W(16, 'revenue'), W(16, 'revenue') + .3) });
  };
});
shot(W(17, '88%') - .1, W(17, 'worst'), (r, a) => {
  const pl = plate(r);
  const s = svg(r, 560, 560, { left: '140px', top: '130px' });
  sv(s, 'circle', { cx: 280, cy: 280, r: 240, fill: 'none', stroke: 'rgba(143,182,255,.16)', 'stroke-width': 30 });
  const ring = sv(s, 'circle', { cx: 280, cy: 280, r: 240, fill: 'none', stroke: '#e3243b', 'stroke-width': 30, transform: 'rotate(-90 280 280)', 'stroke-linecap': 'butt' });
  const n = odometer(r, '88%', { left: '140px', width: '560px', textAlign: 'center', top: '310px', fontSize: '230px' }, { cycles: 1 });
  const lbl = words(r, 'Reduction in high-risk IPNs', 'U', { left: '160px', top: '740px', width: '560px', textAlign: 'center', fontSize: '34px', fontWeight: 600, whiteSpace: 'normal' });
  sfx(a + .05, 'ticks', .5); sfx(a + 1.2, 'lock', .7); sfx(a + 1.25, 'shimmer', .3, 3); hit(a + 1.2, .3);
  return (t) => {
    const lt = t - a;
    const p = P(lt, .05, 1.2, E.outCubic);
    strokeDraw(ring, p * .88); n.roll(p, P(lt - 1 / FPS, .05, 1.2, E.outCubic));
    reveal(lbl, lt, .8, .05);
    pl.set({ src: 57.5, crop: [0, 60, 1680, 880], x: 1290, y: 450, w: 1000, h: 524, zoom: lerp(1, 1.9, P(lt, 1.5, 4.5, E.inOutCubic)), px: .7, py: -.4, ry: -14, op: P(lt, .2, .7), tx: (1 - P(lt, .2, .8)) * 200 });
  };
});
shot(W(17, 'worst'), CARD_T[3], (r, a) => {
  const pl = plate(r);
  const N = 6, rows = [];
  for (let i = 0; i < N; i++) rows.push(div(r, 'abs', { left: '200px', top: (210 + i * 90) + 'px', height: '58px', width: (620 - i * 60) + 'px', background: 'rgba(143,182,255,.16)', borderRadius: '6px', transformOrigin: '0 50%' }));
  const mk = div(r, 'abs', { left: '200px', height: '58px', borderRadius: '6px', background: 'var(--red)', transformOrigin: '0 50%' });
  const wl = div(r, 'lbl abs', { left: '200px', top: '770px', color: 'var(--dim)' }, 'Worst in class');
  const h1 = div(r, 'D abs', { left: '930px', top: '270px', fontSize: '96px', color: 'var(--dim)' }, 'From worst in class');
  const ar = div(r, 'abs', { left: '934px', top: '378px', width: '90px', height: '6px', background: 'var(--red)', transformOrigin: '0 50%' });
  const h2 = words(r, 'Best in class', 'D', { left: '924px', top: '410px', fontSize: '200px' });
  const tB = W(18, 'best');
  sfx(tB - .6, 'riser_short', .5); sfx(tB, 'card', .7, 12); sfx(tB + .1, 'shimmer', .4, 12); hit(tB, .5);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 61.5, crop: [60, 180, 1380, 720], w: 1920, h: 1080, zoom: 1.05 + lt * .03, op: .55, blur: 7, br: .3, radius: 0 });
    rows.forEach((rw, i) => S(rw, { transform: `scaleX(${P(lt, i * .04, .4 + i * .04)})` }));
    const climb = P(t, a + .3, tB + .1, E.inOutCubic);
    const idx = lerp(N - 1, 0, climb);
    S(mk, { top: (210 + idx * 90) + 'px', width: (620 - idx * 60) + 'px', opacity: P(lt, .2, .4) });
    S(h1, { opacity: P(lt, 0, .3) * lerp(1, .5, P(t, tB - .2, tB + .2)) });
    S(ar, { transform: `scaleX(${P(t, tB - .3, tB + .1, E.inOutExpo)})` });
    reveal(h2, t, tB - .1, .07);
    S(wl, { opacity: P(lt, .3, .6) });
  };
});

// ======================================================================
// 04 GEORGIA-PACIFIC × project44
// ======================================================================
shot(CARD_T[3] + 2, C[22].a, (r, a) => {
  const pl = plate(r);
  const lab = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '120px', color: 'var(--white)' },
    '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--red);margin-right:16px;vertical-align:middle"></span>Live yard call · Georgia-Pacific');
  const NB = 72, bars = [];
  for (let i = 0; i < NB; i++) bars.push(div(r, 'abs', { left: (960 - NB * 11 + i * 22) + 'px', top: '330px', width: '12px', height: '240px', borderRadius: '6px', background: 'var(--white)', transformOrigin: '50% 50%' }));
  const board = (y, label, val, t0, t1) => {
    const row = div(r, 'abs', { left: '330px', top: y + 'px', height: '120px' });
    div(row, 'lbl abs', { left: '0', top: '44px', color: 'var(--sky)', fontSize: '28px' }, label);
    const cells = [...val].map((ch, i) => {
      const c = div(row, 'D abs', { left: (450 + i * 112) + 'px', top: '0', width: '100px', height: '120px', lineHeight: '120px', textAlign: 'center', fontSize: '104px', background: '#0d2147', borderRadius: '8px', boxShadow: 'inset 0 -60px 0 rgba(0,0,0,.18)' });
      return { c, ch, ts: lerp(t0, t1, val.length > 1 ? i / (val.length - 1) : 0) };
    });
    return cells;
  };
  const tS = W(20, '2-5-7-8-0-8'), tE = C[20].b, tD = W(21, 'five');
  const cells = [...board(560, 'Truck', '257808', tS, tE - .1), ...board(710, 'Proceed to dock', '5', tD, tD)];
  cells.forEach((c, i) => sfx(c.ts, 'flip', .45, i));
  return (t) => {
    const lt = t - a;
    pl.set({ src: 66.5, crop: [120, 570, 1380, 260], w: 1920, h: 1080, zoom: 1.0 + lt * .02, op: .45, blur: 6, br: .3, radius: 0 });
    S(lab, { opacity: P(lt, .1, .5) });
    const e = env(t);
    bars.forEach((b, i) => {
      const k = Math.abs(i - NB / 2) / (NB / 2);
      const v = .05 + Math.pow(e, .6) * (1 - k * .7) * (.5 + .5 * hash(i * 31 + Math.floor(t * 15)));
      S(b, { transform: `scaleY(${v})`, opacity: .35 + v * .65, background: v > .55 ? 'var(--red)' : 'var(--white)' });
    });
    cells.forEach(({ c, ch, ts }, i) => {
      if (t < ts - .5) { c.textContent = ''; c.style.opacity = P(lt, .3, .6) * .7; return; }
      c.style.opacity = 1;
      c.textContent = t < ts ? '0123456789ABCDEF'[Math.floor(hash(i * 13 + Math.floor(t * 24)) * 16)] : ch;
      c.style.color = t < ts ? 'var(--dim)' : 'var(--white)';
    });
  };
});
shot(C[22].a, C[23].a, (r, a) => {
  const sp = speaker(r, 'Tom Cahill', 'GP × project44', t => faceSrc('tom', srcAt(t)));
  const s = svg(r, 520, 520, { left: '1190px', top: '150px' });
  sv(s, 'circle', { cx: 260, cy: 260, r: 230, fill: 'none', stroke: 'rgba(143,182,255,.16)', 'stroke-width': 18 });
  const ring = sv(s, 'circle', { cx: 260, cy: 260, r: 230, fill: 'none', stroke: '#f5f7fb', 'stroke-width': 18, transform: 'rotate(-90 260 260)' });
  const clk = div(r, 'D abs', { left: '1190px', width: '520px', textAlign: 'center', top: '320px', fontSize: '190px' });
  const cl = div(r, 'lbl abs', { left: '1190px', width: '520px', textAlign: 'center', top: '500px', color: 'var(--white)' }, 'Driver check-in');
  const tF = W(22, 'five'), tT = W(22, 'two');
  sfx(tF, 'tap', .45, 0); sfx(tF + .2, 'ticks', .45); sfx(tT + .3, 'lock', .7); hit(tT + .3, .3);
  return (t) => {
    sp(t, t - a, { x: 580, y: 450, w: 880, h: 495 });
    const p = P(t, tF + .1, tT + .35, E.inOutCubic);
    const sec = lerp(300, 120, p);
    clk.textContent = `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    strokeDraw(ring, lerp(1, .4, p));
    ring.setAttribute('stroke', p >= 1 ? '#e3243b' : '#f5f7fb');
    S(clk, { color: p >= 1 ? 'var(--red)' : 'var(--white)', transform: `scale(${p >= 1 ? lerp(1.15, 1, P(t, tT + .35, tT + .7)) : 1})` });
    S(s, { opacity: P(t, a, a + .3) }); S(cl, { opacity: P(t, a + .2, a + .5) });
  };
});
shot(C[23].a, C[24].a, (r, a) => {
  const pl = plate(r);
  const n = odometer(r, '66%', { left: '130px', top: '180px', fontSize: '420px' }, { red: ['%'], cycles: 1 });
  const l = words(r, 'Less check-in time', 'D', { left: '140px', top: '560px', fontSize: '96px', color: 'var(--sky)' });
  const t6 = W(23, '66%');
  sfx(t6 - .2, 'ticks', .5); sfx(t6 + .5, 'lock', .8); sfx(t6 + .55, 'shimmer', .3, 5); hit(t6 + .5, .4);
  return (t) => {
    const lt = t - a;
    roll(n, t, t6 - .3, t6 + .5);
    S(n, { opacity: P(t, t6 - .4, t6 - .2) });
    reveal(l, t, t6 + .3, .06);
    pl.set({ src: 73.5, crop: [180, 130, 1320, 780], x: 1420, y: 460, w: 820, h: 485, zoom: 1 + lt * .03, ry: -16, op: P(lt, 0, .5), tx: (1 - P(lt, 0, .6)) * 200 });
  };
});
shot(C[24].a, C[25].a, (r, a) => {
  const pl = plate(r);
  const road = div(r, 'abs', { left: '0', top: '640px', width: '1920px', height: '4px', background: 'rgba(143,182,255,.3)' });
  const s = svg(r, 300, 160, { top: '480px' });
  sv(s, 'rect', { x: 0, y: 10, width: 190, height: 110, rx: 8, fill: '#f5f7fb' });
  sv(s, 'path', { d: 'M195 40 H250 L292 80 V120 H195 Z', fill: '#e3243b' });
  sv(s, 'rect', { x: 212, y: 50, width: 34, height: 26, rx: 4, fill: '#0b1d3d' });
  [45, 145, 245].forEach(cx => sv(s, 'circle', { cx, cy: 128, r: 22, fill: '#0b1d3d', stroke: '#f5f7fb', 'stroke-width': 6 }));
  const h1 = words(r, 'Drivers never', 'D', { left: '150px', top: '170px', fontSize: '150px' });
  const h2 = words(r, 'left the cab', 'D red', { left: '150px', top: '310px', fontSize: '150px' });
  const tN = W(24, 'never');
  sfx(a, 'truck', .7);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 66.5, crop: [1050, 590, 420, 215], w: 1920, h: 1080, zoom: 1.0 + lt * .04, op: .5, blur: 4, br: .35, radius: 0 });
    const x = lerp(-320, 1420, P(lt, 0, 1.6, E.outCubic));
    S(s, { left: x + 'px', transform: `translateY(${Math.sin(lt * 30) * (1 - P(lt, 1.2, 1.6)) * 2}px)` });
    reveal(h1, t, tN - .2, .07); reveal(h2, t, tN + .3, .07);
    S(road, { opacity: P(lt, 0, .3) });
  };
});
shot(C[25].a, CARD_T[4], (r, a) => {
  const pre = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '290px', color: 'var(--white)' }, 'Georgia-Pacific × project44');
  const h = words(r, 'Shipper of choice', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '340px', fontSize: '230px' });
  const bar = div(r, 'abs', { left: '760px', top: '580px', width: '400px', height: '10px', background: 'var(--red)', transformOrigin: '50% 50%' });
  sfx(W(25, 'shipper') - .35, 'accent', .6); sfx(W(25, 'choice'), 'shimmer', .4, 7); hit(W(25, 'shipper'), .25);
  return (t) => {
    const lt = t - a;
    S(pre, { opacity: P(lt, 0, .3) }); reveal(h, t, W(25, 'shipper') - .15, .08);
    S(bar, { transform: `scaleX(${P(t, W(25, 'choice'), W(25, 'choice') + .4, E.inOutExpo)})` });
    S(h, { transform: `scale(${1 + lt * .02})` });
  };
});

// ======================================================================
// 05 RELIANCE INDUSTRIES
// ======================================================================
shot(CARD_T[4] + 2, C[27].a, (r, a) => {
  const pl = plate(r);
  const lab = div(r, 'lbl abs', { left: '150px', top: '250px' }, "The stakes · India's roads");
  const h1 = words(r, 'A death every', 'D', { left: '140px', top: '300px', fontSize: '170px' });
  const h2 = div(r, 'D abs', { left: '140px', top: '460px', fontSize: '260px' }, '<span class="red">3</span> minutes');
  const s = svg(r, 480, 480, { left: '1290px', top: '220px' });
  sv(s, 'circle', { cx: 240, cy: 240, r: 210, fill: 'none', stroke: 'rgba(245,247,251,.2)', 'stroke-width': 4 });
  for (let i = 0; i < 60; i++) { const an = i / 60 * Math.PI * 2; const L = i % 5 ? 10 : 26; sv(s, 'line', { x1: 240 + Math.sin(an) * 200, y1: 240 - Math.cos(an) * 200, x2: 240 + Math.sin(an) * (200 - L), y2: 240 - Math.cos(an) * (200 - L), stroke: i % 5 ? 'rgba(245,247,251,.35)' : '#f5f7fb', 'stroke-width': i % 5 ? 3 : 6 }); }
  const sweep = sv(s, 'path', { fill: 'rgba(227,36,59,.35)' });
  const hand = sv(s, 'line', { x1: 240, y1: 240, x2: 240, y2: 50, stroke: '#e3243b', 'stroke-width': 8, 'stroke-linecap': 'round' });
  sv(s, 'circle', { cx: 240, cy: 240, r: 12, fill: '#e3243b' });
  const tD = W(26, 'death'), t3 = W(26, 'three');
  sfx(a, 'sub', .9); sfx(a + .1, 'clock', .7); sfx(t3, 'pulse', .8); hit(t3, .4);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 83.5, crop: [0, 330, 1680, 620], w: 1920, h: 1080, zoom: 1.05 + lt * .03, op: .4, blur: 6, br: .3, radius: 0 });
    S(lab, { opacity: P(lt, 0, .3) }); reveal(h1, t, tD - .4, .07);
    S(h2, { opacity: P(t, t3 - .1, t3 + .1), transform: `scale(${lerp(1.2, 1, P(t, t3 - .1, t3 + .4))})`, transformOrigin: '0 50%' });
    const ang = (lt * 1.0) * 360; // one sweep per second: "every three minutes", compressed
    hand.setAttribute('transform', `rotate(${ang} 240 240)`);
    const fr = (ang % 360) / 360, A = fr * Math.PI * 2;
    sweep.setAttribute('d', fr < .001 ? '' : `M240 240 L240 30 A210 210 0 ${fr > .5 ? 1 : 0} 1 ${240 + Math.sin(A) * 210} ${240 - Math.cos(A) * 210} Z`);
    S(s, { opacity: P(lt, 0, .4) });
  };
});
shot(C[27].a, C[29].a, (r, a) => {
  const sp = speaker(r, 'Arush Kishore', 'Reliance Industries', (t, lt) => ({ src: clamp(88.7 + lt * .9, 88.7, 92.3), crop: [92, 255, 460, 320] }));
  const h1 = words(r, 'Safety', 'D', { left: '960px', top: '220px', fontSize: '200px' });
  const h2 = div(r, 'D abs', { left: '960px', top: '400px', fontSize: '200px' }, 'is not a');
  const cost = div(r, 'D abs', { left: '960px', top: '580px', fontSize: '200px' }, 'cost');
  const strike = div(r, 'abs', { left: '950px', top: '660px', width: '360px', height: '14px', background: 'var(--red)', transformOrigin: '0 50%' });
  const eff = words(r, 'it drives efficiency', 'D red', { left: '960px', top: '400px', fontSize: '170px', whiteSpace: 'normal', width: '900px', lineHeight: '.9' });
  const tE = C[28].a, tC = W(27, 'cost');
  sfx(tC, 'pulse', .5); sfx(tE - .05, 'swipe', .7); sfx(W(28, 'efficiency') - .05, 'accent', .6); sfx(W(28, 'efficiency') + .1, 'shimmer', .35, 5);
  return (t) => {
    const lt = t - a;
    sp(t, lt, { x: 470, y: 470, w: 700, h: 487, ry: 8 });
    reveal(h1, t, a, .07);
    const fade = 1 - P(t, tE + .25, tE + .45);
    S(h2, { opacity: P(t, W(27, 'is'), W(27, 'is') + .2) * fade });
    S(cost, { opacity: P(t, tC, tC + .15) * fade });
    S(strike, { transform: `scaleX(${P(t, tE, tE + .3, E.inOutExpo)})`, opacity: fade });
    reveal(eff, t, tE + .3, .07);
  };
});
shot(C[29].a, C[30].a, (r, a) => {
  const pl = plate(r);
  const s = svg(r, 640, 640, { left: '640px', top: '60px' });
  const ring = sv(s, 'circle', { cx: 320, cy: 320, r: 290, fill: 'none', stroke: '#e3243b', 'stroke-width': 12, transform: 'rotate(-90 320 320)' });
  const z = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '150px', fontSize: '520px' }, '0');
  const lbl = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '720px', fontSize: '96px', color: 'var(--white)' }, 'Fatalities since deployment');
  const tZ = W(29, 'zero');
  const pre = words(r, 'The proof', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '380px', fontSize: '200px', color: 'var(--sky)' });
  sfx(tZ, 'boom', 1); hit(tZ, 1.2);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 86, crop: [40, 200, 1640, 700], w: 1920, h: 1080, zoom: 1.1 + lt * .03, op: .4, blur: 9, br: .3, radius: 0 });
    reveal(pre, lt, 0, .07); S(pre, { opacity: 1 - P(t, tZ - .25, tZ - .05) });
    strokeDraw(ring, P(t, tZ - .3, tZ + .6, E.inOutCubic));
    S(z, { opacity: P(t, tZ - .05, tZ + .05), transform: `scale(${lerp(1.3, 1, P(t, tZ - .05, tZ + .5))})` });
    S(lbl, { opacity: P(t, tZ + .3, tZ + .7), transform: `translateY(${(1 - P(t, tZ + .3, tZ + .8)) * 24}px)` });
  };
});
shot(C[30].a, 110, (r, a) => {
  const pl = plate(r);
  const n = odometer(r, '−46%', { left: '150px', top: '190px', fontSize: '300px' }, { red: ['%'], cycles: 1 });
  const nl = div(r, 'lbl abs', { left: '160px', top: '470px', fontSize: '30px', color: 'var(--white)' }, 'Smaller fleet');
  // payback curve: cumulative return dips (investment), crosses break-even, keeps climbing
  const s = svg(r, 820, 330, { left: '980px', top: '150px' });
  const Z = 170;
  sv(s, 'line', { x1: 0, x2: 820, y1: Z, y2: Z, stroke: 'rgba(245,247,251,.35)', 'stroke-width': 2, 'stroke-dasharray': '10 10' });
  const be = sv(s, 'text', { x: 820, y: Z - 14, 'text-anchor': 'end', fill: 'rgba(245,247,251,.6)', 'font-family': 'Inter', 'font-weight': 600, 'font-size': 18, 'letter-spacing': '4' }); be.textContent = 'BREAK-EVEN';
  const D = 'M0 170 C60 230 120 270 200 268 C280 266 320 210 360 170 C430 100 560 50 800 22';
  const area = sv(s, 'path', { d: 'M360 170 C430 100 560 50 800 22 L800 170 Z', fill: 'rgba(227,36,59,.22)' });
  const curve = sv(s, 'path', { d: D, fill: 'none', stroke: '#f5f7fb', 'stroke-width': 7, 'stroke-linecap': 'round' });
  const dot = sv(s, 'circle', { cx: 360, cy: Z, r: 13, fill: '#e3243b' });
  const ring = sv(s, 'circle', { cx: 360, cy: Z, r: 13, fill: 'none', stroke: '#e3243b', 'stroke-width': 4 });
  const inv = sv(s, 'text', { x: 200, y: 310, 'text-anchor': 'middle', fill: 'rgba(245,247,251,.6)', 'font-family': 'Inter', 'font-weight': 600, 'font-size': 18, 'letter-spacing': '4' }); inv.textContent = 'INVESTMENT';
  const roi = sv(s, 'text', { x: 470, y: 40, 'text-anchor': 'end', fill: '#e3243b', 'font-family': 'Barlow Condensed', 'font-weight': 800, 'font-size': 44, 'letter-spacing': '2' }); roi.textContent = 'RETURN';
  const p1 = words(r, 'Pays for itself', 'D', { left: '982px', top: '500px', fontSize: '130px' });
  p1.ws[2].classList.add('red');
  const fin = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '700px', fontSize: '84px', color: 'var(--sky)' }, 'From reactive to resilient');
  const tS = Math.max(a + .25, W(30, 'smaller') - .5), tP = W(30, 'pays');
  sfx(tS - .1, 'ticks', .5); sfx(tS + .6, 'lock', .65); sfx(tP - .6, 'sweep', .5); sfx(tP + .15, 'shimmer', .5, 7); sfx(W(30, 'itself'), 'pulse', .4);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 86, crop: [40, 200, 1640, 700], w: 1920, h: 1080, zoom: 1.2 + lt * .02, px: .2, op: .35, blur: 10, br: .28, radius: 0 });
    roll(n, t, tS - .1, tS + .6); S(n, { opacity: P(t, tS - .2, tS) });
    S(nl, { opacity: P(t, tS + .4, tS + .7) });
    const cp = P(t, tP - .6, tP + .9, E.inOutCubic);
    strokeDraw(curve, cp); S(s, { opacity: P(t, tP - .8, tP - .5) });
    const tX = tP - .6 + 1.5 * .5; // curve reaches break-even about halfway through the draw
    S(area, { opacity: P(t, tX, tX + .5) * .9, clipPath: `inset(0 ${(1 - P(t, tX, tP + .9)) * 100}% 0 0)` });
    S(dot, { opacity: P(t, tX - .05, tX + .05) });
    const rp = P(t, tX, tX + .7, E.outCubic); ring.setAttribute('r', 13 + rp * 46); S(ring, { opacity: (1 - rp) * (t > tX ? 1 : 0) });
    S(inv, { opacity: P(t, tP - .3, tP) }); S(roi, { opacity: P(t, tP + .7, tP + 1.0) }); S(be, { opacity: P(t, tP - .7, tP - .4) });
    reveal(p1, t, W(30, 'pays') + .1, .07);
    S(fin, { opacity: P(t, W(30, 'itself') + .5, W(30, 'itself') + 1.1) });
  };
});

// ======================================================================
// END: 5 finalists, 1 winner → EDGE Nashville → logo lockup
// ======================================================================
WIPES.push(110);
shot(110, 113.6, (r, a) => {
  const bgp = plate(r);
  const shade = div(r, 'abs', { inset: '0', background: 'rgba(5,13,29,.55)' });
  const TW = 300, TH = 170, GAP = 40, X0 = 960 - (5 * TW + 4 * GAP) / 2;
  const tiles = FIN.map((f, i) => {
    const c = div(r, 'abs', { left: (X0 + i * (TW + GAP)) + 'px', top: '190px', width: TW + 'px', height: '250px' });
    logoTile(c, f, TW, TH);
    div(c, 'abs U', { left: '0', width: TW + 'px', top: (TH + 18) + 'px', textAlign: 'center', fontWeight: 600, fontSize: '22px', lineHeight: 1.25, color: 'var(--white)' }, f.tag);
    return c;
  });
  const h1 = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '520px', fontSize: '230px', textShadow: '0 10px 60px rgba(0,0,0,.6)' });
  sfx(110, 'card', .7, 0); FIN.forEach((f, i) => sfx(110.1 + i * .09, 'tap', .35, [0, 3, 5, 7, 10][i]));
  sfx(111.15, 'pulse', .45); sfx(112.1, 'boom', .9); hit(112.1, 1.0);
  return (t) => {
    const lt = t - a;
    bgp.set({ url: clipUrl('A', 3.2 + lt * .95), crop: [0, 0, 1920, 1080], w: 1920, h: 1080, zoom: 1.08 - lt * .01, op: 1, radius: 0 });
    tiles.forEach((c, i) => {
      const p = P(lt, .05 + i * .09, .65 + i * .09, E.outCubic);
      const dim = i === 0 ? 0 : 0;
      S(c, { opacity: p, transform: `translateY(${(1 - p) * (i % 2 ? -120 : 120)}px) scale(${lerp(1, .96, P(lt, 2.1, 2.6))})` });
    });
    const one = lt >= 2.1;
    h1.innerHTML = one ? '1 <span class="red">winner.</span>' : '5 finalists.';
    S(h1, { opacity: P(lt, 1.15, 1.3), transform: `scale(${one ? lerp(1.25, 1, P(lt, 2.1, 2.5)) : lerp(1.15, 1, P(lt, 1.15, 1.5))})` });
  };
});
shot(113.6, 117.2, (r, a) => {
  const bgp = plate(r);
  const shade = div(r, 'abs', { inset: '0', background: 'radial-gradient(ellipse at 50% 50%, rgba(5,13,29,.78) 0%, rgba(5,13,29,.6) 60%, rgba(5,13,29,.8) 100%)' });
  const pre = words(r, 'See them live at', 'lbl', { left: '0', width: '1920px', textAlign: 'center', top: '180px', fontSize: '30px', color: 'var(--white)' });
  const logo = div(r, 'abs', { left: '660px', top: '240px', width: '600px', height: '208px', background: 'url(assets/edge_white.png) center/contain no-repeat' });
  const yr = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '470px', fontSize: '120px' }, 'Nashville <span class="red">·</span> Oct 4–7, 2026');
  const rows = [['Mon · Oct 5', 'Finalists present live'], ['Tue · Oct 6', 'Winner revealed on the main stage']].map(([d, s], i) =>
    div(r, 'abs U', { left: '0', width: '1920px', textAlign: 'center', top: (650 + i * 70) + 'px', fontSize: '38px', fontWeight: 500, whiteSpace: 'nowrap' },
      `<span style="font-family:'Barlow Condensed';font-weight:800;text-transform:uppercase;color:var(--sky);margin-right:22px;font-size:44px">${d}</span>${s}`));
  const venue = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '820px', color: 'var(--dim)' }, 'Gaylord Opryland Resort & Convention Center');
  sfx(a, 'whoosh', .6); sfx(a + .3, 'shimmer', .55, 0); sfx(a + 1.2, 'tap', .4, 3); sfx(a + 1.5, 'tap', .4, 7);
  return (t) => {
    const lt = t - a;
    bgp.set({ url: clipUrl('B', 1.3 + lt), crop: [0, 0, 1920, 1080], w: 1920, h: 1080, zoom: 1.12 + lt * .015, op: 1, radius: 0 });
    reveal(pre, lt, 0, .05);
    S(logo, { opacity: P(lt, .2, .5), transform: `scale(${lerp(1.3, 1, P(lt, .2, .8))})` });
    S(yr, { opacity: P(lt, .6, .9), transform: `translateY(${(1 - P(lt, .6, 1.1)) * 30}px)` });
    rows.forEach((rw, i) => S(rw, { opacity: P(lt, 1.2 + i * .3, 1.5 + i * .3), transform: `translateY(${(1 - P(lt, 1.2 + i * .3, 1.7 + i * .3)) * 24}px)` }));
    S(venue, { opacity: P(lt, 1.9, 2.3) });
  };
});
shot(117.2, 120.01, (r, a) => {
  const panel = div(r, 'abs', { inset: '0', background: '#f6f7fa' });
  const ti = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '250px', fontSize: '110px', color: '#0b2a5c' }, 'Supply Chain Innovation Award<sup style="font-size:.3em;vertical-align:top">™</sup>');
  const by = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '375px', color: '#5a6b86' }, 'by CSCMP &amp; SupplyChainBrain');
  const l1 = div(r, 'abs', { left: '330px', top: '500px', width: '600px', height: '208px', background: 'url(assets/edge.png) center/contain no-repeat' });
  const dv = div(r, 'abs', { left: '959px', top: '505px', width: '2px', height: '200px', background: '#c8cfdb' });
  const l2 = div(r, 'abs', { left: '1010px', top: '545px', width: '640px', height: '108px', background: 'url(assets/scb.png) center/contain no-repeat' });
  const bar = div(r, 'abs', { left: '860px', top: '800px', width: '200px', height: '8px', background: 'var(--red)', transformOrigin: '50% 50%' });
  sfx(a, 'whoosh', .8); sfx(a + .25, 'chime_end', .8);
  return (t) => {
    const lt = t - a;
    const w = P(lt, 0, .45, E.inOutExpo);
    S(panel, { clipPath: `inset(${(1 - w) * 100}% 0 0 0)` });
    S(ti, { opacity: P(lt, .35, .7), transform: `translateY(${(1 - P(lt, .35, .9)) * 30}px)` });
    S(by, { opacity: P(lt, .55, .9) });
    S(l1, { opacity: P(lt, .5, .9), transform: `translateX(${(1 - P(lt, .5, 1.1)) * -40}px)` });
    S(l2, { opacity: P(lt, .65, 1.05), transform: `translateX(${(1 - P(lt, .65, 1.25)) * 40}px)` });
    S(dv, { transform: `scaleY(${P(lt, .5, 1)})` });
    S(bar, { transform: `scaleX(${P(lt, .9, 1.4, E.inOutExpo)})` });
  };
}, { punch: false });

// ======================================================================
// background network, grain, captions, wipes, camera
// ======================================================================
const bg = $('bg').getContext('2d');
const rnd = mulberry32(7);
const NODES = [...Array(90)].map(() => ({ x: rnd() * 2600 - 340, y: rnd() * 1500 - 210, z: .4 + rnd() * .9 }));
const EDGES = [];
NODES.forEach((n, i) => {
  const d = NODES.map((m, j) => [j, (m.x - n.x) ** 2 + (m.y - n.y) ** 2]).filter(x => x[0] !== i).sort((a, b) => a[1] - b[1]);
  for (let k = 0; k < 2; k++) if (!EDGES.find(e => (e[0] === d[k][0] && e[1] === i))) EDGES.push([i, d[k][0], rnd()]);
});
const redAmt = t => 0;
function drawBg(t) {
  const g = bg; g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#050d1d'; g.fillRect(0, 0, 1920, 1080);
  const gr = g.createRadialGradient(960, 420, 50, 960, 540, 1100); gr.addColorStop(0, 'rgba(26,62,128,.55)'); gr.addColorStop(1, 'rgba(5,13,29,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
  const red = redAmt(t);
  const conv = P(t, 10.5, 12.5, E.outCubic) * (1 - P(t, 16, 17.5));
  const sc = 1 + conv * .25;
  g.translate(960, 540); g.scale(sc, sc); g.translate(-960 - Math.sin(t * .05) * 120, -540 - t * 1.5 % 1);
  const col = (a) => red > 0 ? `rgba(${Math.round(lerp(143, 227, red))},${Math.round(lerp(182, 36, red))},${Math.round(lerp(255, 59, red))},${a})` : `rgba(143,182,255,${a})`;
  g.lineWidth = 1.2;
  EDGES.forEach(([i, j, s]) => {
    const a = NODES[i], b = NODES[j];
    const fl = red > 0 && hash(i * 7 + j + Math.floor(t * 12)) < red * .3 ? 0 : 1;
    g.strokeStyle = col(.12 * fl * a.z); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    const ph = (t * (.08 + s * .12) + s) % 1;
    g.fillStyle = col(.55 * a.z); g.beginPath(); g.arc(lerp(a.x, b.x, ph), lerp(a.y, b.y, ph), 2.2, 0, 7); g.fill();
  });
  NODES.forEach((n, i) => { g.fillStyle = col(.35 * n.z); g.beginPath(); g.arc(n.x, n.y, 3 * n.z, 0, 7); g.fill(); });
}
const grain = $('grainc').getContext('2d');
const GT = [0, 1, 2, 3].map(s => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const id = x.createImageData(256, 256); const R = mulberry32(100 + s); for (let i = 0; i < id.data.length; i += 4) { const v = R() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return c; });
function drawGrain(t) { const f = Math.floor(t * FPS); const pat = grain.createPattern(GT[f % 4], 'repeat'); grain.setTransform(1, 0, 0, 1, (f * 37) % 256, (f * 91) % 256); grain.fillStyle = pat; grain.fillRect(-256, -256, 2432, 1592); }

const capline = $('capline');
function drawCaps(t) {
  const c = CUES.find(c => c && t >= c.a - .05 && t < c.b + .2);
  const end = t >= 117.2;
  if (!c || end) { capline.innerHTML = ''; $('capsband').style.opacity = end ? 0 : .6; return; }
  $('capsband').style.opacity = 1;
  capline.innerHTML = c.words.map(w => `<span style="color:${t >= w.t ? 'rgba(245,247,251,1)' : 'rgba(245,247,251,.4)'}">${w.w}</span>`).join(' ');
  const p = P(t, c.a - .05, c.a + .15);
  capline.style.opacity = p * (1 - P(t, c.b + .05, c.b + .2)); capline.style.transform = `translateY(${(1 - p) * 12}px)`;
}
const wipe = $('wipe');
function drawWipe(t) {
  const w = WIPES.find(w => t >= w - .22 && t < w + .22);
  if (!w) { wipe.style.display = 'none'; return; }
  const p = (t - (w - .22)) / .44; // 0..1, fully covering at .5
  wipe.style.display = 'block';
  S(wipe, { transform: `translateX(${lerp(-160, 170, E.inOutCubic(p))}%) skewX(-12deg)`, width: '75%' });
}
function camera(t) {
  let a = 0;
  HITS.forEach(h => { const d = t - h.t; if (d >= 0 && d < .45) a += h.amt * Math.pow(1 - d / .45, 2); });
  const f = Math.floor(t * FPS);
  const x = (hash(f * 3 + 1) - .5) * 18 * a, y = (hash(f * 5 + 2) - .5) * 18 * a;
  const drift = Math.sin(t * .4) * 4;
  world.style.transform = `translate(${x + drift}px,${y}px) scale(${1 + a * .012})`;
  const fl = FLASHES.find(x => t >= x && t < x + .35);
  $('flash').style.opacity = fl !== undefined ? .55 * (1 - (t - fl) / .35) : 0;
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
    } else if (el.offsetLeft + el.scrollWidth > 1840) {
      el.style.fontSize = fs * (1840 - el.offsetLeft) / el.scrollWidth + 'px';
    }
  });
}
let preloaded = false;
window.seek = async (t) => {
  if (!preloaded) { await Promise.all(PRELOAD); preloaded = true; }
  pending = [];
  drawBg(t);
  for (const s of SHOTS) {
    const on = t >= s.a && t < s.b;
    s.root.style.display = on ? 'block' : 'none';
    if (on) {
      if (!s.fitted) { fitAll(s.root); s.fitted = true; }
      s.up(t, s.a, s.b);
      if (s.punch) { const lt = t - s.a; S(s.root, { transform: `scale(${lerp(1.045, 1, P(lt, 0, .5))})`, opacity: P(lt, 0, .06, E.lin) }); }
    }
  }
  drawCaps(t); drawWipe(t); camera(t); drawGrain(t);
  await Promise.all(pending);
};
window.getSfx = () => SFX.sort((a, b) => a.t - b.t);
window.getCues = () => CUES.filter(Boolean).map(c => ({ a: c.a, b: c.b, txt: c.txt }));
})();
