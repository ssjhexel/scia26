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
}).filter(Boolean);
const C = CUES;
// word timing: distributed by character weight inside the cue
CUES.forEach(c => {
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
const SFX = []; const sfx = (t, type, gain = 1) => SFX.push({ t: +t.toFixed(3), type, gain });
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
const frameUrl = s => 'assets/frames/' + String(clamp(Math.floor(s * SRC_FPS) + 1, 1, NFRAMES)).padStart(5, '0') + '.jpg';

// a footage plate: shows a crop of a source frame inside a box, with camera push
function plate(parent, z = 0) {
  const d = div(parent, 'plate', { zIndex: z }); const img = document.createElement('img'); d.appendChild(img);
  let cur = '';
  return {
    el: d,
    set(o) {
      const { src, crop = [0, 68, 1672, 944], x = 960, y = 540, w = 1600, h = 900, zoom = 1, px = 0, py = 0,
        op = 1, rx = 0, ry = 0, rz = 0, s = 1, blur = 0, br = 1, sat = 1, radius = 18, tx = 0, ty = 0 } = o;
      const url = frameUrl(src);
      if (url !== cur) { cur = url; img.src = url; pending.push(img.decode().catch(() => {})); }
      const cw = crop[2] / zoom, ch = crop[3] / zoom;
      const cx = crop[0] + crop[2] / 2 + px * crop[2] / 2 * (1 - 1 / zoom), cy = crop[1] + crop[3] / 2 + py * crop[3] / 2 * (1 - 1 / zoom);
      const k = Math.max(w / cw, h / ch);
      S(img, { width: 1920 * k + 'px', height: 1080 * k + 'px', left: (w / 2 - cx * k) + 'px', top: (h / 2 - cy * k) + 'px' });
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
  { n: '01', name: 'Intel', sub: 'AI-Driven Market Intelligence for Proactive Supply Chain Defense', p: { src: 12.2, crop: [0, 68, 1672, 944] }, th: { src: 12.2, crop: [930, 170, 620, 620] } },
  { n: '02', name: 'GOFO', sub: 'Building a National Parcel Network from Zero with Atlas', p: { src: 36.5, crop: [0, 60, 1680, 900] }, th: { src: 28.5, crop: [80, 380, 820, 480] } },
  { n: '03', name: 'Intel', sub: 'From Reactive to Predictive: An Intelligent Control Tower for Chemical & Gas Supply', p: { src: 52.5, crop: [0, 60, 1680, 900] }, th: { src: 57.5, crop: [1100, 230, 600, 330] } },
  { n: '04', name: 'Georgia-Pacific', with: '× project44', sub: 'From 5 Minutes to Under 2: Transforming Yard Operations with project44 YMS', p: { src: 66.5, crop: [0, 60, 1680, 900] }, th: { src: 66.5, crop: [560, 580, 420, 220] } },
  { n: '05', name: 'Reliance Industries', sub: 'From Reactive to Resilient: An Emergency Response Network', p: { src: 83.5, crop: [0, 60, 1680, 900] }, th: { src: 89, crop: [92, 255, 460, 320] } },
];
const CARD_T = [17.5, 35.5, 54.5, 72.5, 92.5];

// ---------------- COLD OPEN A: 20 years / never seen ----------------
shot(0, C[2].a, (r) => {
  const line = div(r, 'abs', { left: '0px', top: '539px', width: '1920px', height: '3px', background: 'var(--red)', transformOrigin: '50% 50%' });
  const pl = plate(r);
  const num = div(r, 'D abs', { left: '150px', top: '250px', fontSize: '330px' });
  const plus = div(r, 'D abs red', { top: '250px', fontSize: '330px' }, '+');
  const yl = words(r, 'YEARS IN SUPPLY CHAIN', 'lbl', { left: '160px', top: '560px', fontSize: '30px', color: 'var(--white)' });
  const l1 = words(r, "I've never seen", 'D', { left: '150px', top: '330px', fontSize: '170px' });
  const l2 = words(r, 'conditions like this.', 'D', { left: '150px', top: '480px', fontSize: '170px' });
  l2.ws.forEach((w, i) => { if (i > 0) w.classList.add('red'); });
  const tag = div(r, 'lbl abs', { left: '154px', top: '700px' }, 'Intel · Supply Chain Leadership');
  sfx(0, 'riser', .7); sfx(.55, 'hit', .8); hit(.55, .6);
  const tY = W(0, 'twenty'); sfx(tY - .1, 'ticks', .5);
  sfx(C[1].a - .05, 'whoosh', .7);
  return (t) => {
    const lp = P(t, .05, .6, E.inOutExpo);
    const out = P(t, .55, 1.0, E.inOutExpo);
    S(line, { transform: `scaleX(${lp}) scaleY(${1 - out})`, opacity: 1 - out });
    const op = P(t, .6, 1.4);
    pl.set({ src: 1.0, crop: [40, 470, 1600, 220], x: 1300, y: 760 + (1 - op) * 30, w: 1100, h: 180 * 1300 / 1600 * 1.5, zoom: lerp(1.05, 1.25, t / 5), op: op * .55 * (1 - P(t, C[1].a, C[1].a + .4)) + .18 * P(t, C[1].a, C[1].a + .4), br: .6, sat: .3, ry: -18, blur: 1 });
    const n = lerp(0, 20, P(t, tY - .45, tY + .35, E.outCubic));
    const gone = P(t, C[1].a - .1, C[1].a + .25, E.inExpo);
    num.textContent = Math.round(n);
    S(num, { opacity: P(t, .55, .8) * (1 - gone), transform: `translateY(${-gone * 120}px)` });
    S(plus, { left: (150 + (n >= 10 ? 330 : 165)) + 'px', opacity: P(t, tY + .2, tY + .5) * (1 - gone), transform: `translateY(${-gone * 120}px)` });
    reveal(yl, t, .9, .05); yl.style.opacity = 1 - gone;
    reveal(l1, t, C[1].a, .07); reveal(l2, t, W(1, 'conditions'), .08);
    S(tag, { opacity: P(t, C[1].a + .5, C[1].a + 1) });
  };
});

// ---------------- COLD OPEN B: weapon ----------------
shot(C[2].a, 10.5, (r) => {
  const tW = W(2, 'weapon'), tS = W(2, 'state'), tC = W(3, 'corporate');
  const pl = plate(r);
  const a1 = words(r, 'Supply chains', 'D', { left: '150px', top: '190px', fontSize: '190px' });
  const a2 = words(r, 'are being used', 'D out', { left: '150px', top: '360px', fontSize: '190px' });
  const a3 = words(r, 'as a', 'D', { left: '150px', top: '530px', fontSize: '190px' });
  const wp = div(r, 'D abs red', { left: '420px', top: '530px', fontSize: '190px' }, 'WEAPON');
  const chips = ['State level', 'Corporate level'].map((s, i) => div(r, 'abs U', {
    left: (150 + i * 330) + 'px', top: '760px', padding: '14px 26px', border: '2px solid rgba(255,255,255,.35)', borderRadius: '40px',
    fontWeight: 600, fontSize: '30px', letterSpacing: '.04em', whiteSpace: 'nowrap' }, s));
  sfx(tW - .05, 'glitch', 1); sfx(tW, 'hit', 1); hit(tW, 1.2);
  sfx(tS, 'pop', .6); sfx(tC, 'pop', .6);
  return (t) => {
    pl.set({ src: 2.0, crop: [0, 68, 1672, 944], x: 1420, y: 520, w: 900, h: 508, zoom: lerp(1, 1.15, (t - C[2].a) / 6), ry: -24, op: .35, br: .5, sat: 0, blur: 2 });
    reveal(a1, t, C[2].a, .07); reveal(a2, t, W(2, 'literally'), .07); reveal(a3, t, W(2, 'as'), .07);
    wp.style.left = (150 + a3.offsetWidth + 46) + 'px';
    const g = P(t, tW, tW + .35, E.lin); const on = t >= tW - .02;
    const j = on && g < 1 ? (hash(Math.floor(t * 30)) - .5) * 30 * (1 - g) : 0;
    S(wp, { opacity: on ? 1 : 0, transform: `translateX(${j}px) scale(${lerp(1.25, 1, P(t, tW, tW + .4))})`,
      textShadow: on && g < 1 ? `${j * .6}px 0 #2a63c9, ${-j * .6}px 0 #fff` : 'none' });
    chips.forEach((c, i) => { const p = P(t, i ? tC : tS, (i ? tC : tS) + .5, E.outBack); S(c, { opacity: clamp(p * 2), transform: `translateY(${(1 - p) * 40}px)` }); });
  };
});

// ---------------- TITLE ----------------
shot(10.5, 17.5, (r) => {
  const big = div(r, 'D abs out', { left: '0', width: '1920px', textAlign: 'center', top: '160px', fontSize: '640px', WebkitTextStroke: '2px rgba(143,182,255,.16)' }, '2026');
  const pre = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '268px' }, 'CSCMP &nbsp;&amp;&nbsp; SupplyChainBrain present');
  const t1 = words(r, 'Supply Chain', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '330px', fontSize: '200px' });
  const t2 = words(r, 'Innovation Award', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '500px', fontSize: '200px' });
  t2.lastChild.querySelector('.wi').innerHTML += '<sup style="font-size:.25em;vertical-align:top;line-height:1.2">™</sup>';
  const bar = div(r, 'abs', { left: '810px', width: '300px', height: '8px', top: '700px', background: 'var(--red)', transformOrigin: '50% 50%' });
  const fin = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '740px', fontSize: '64px', letterSpacing: '.18em', color: 'var(--sky)' }, 'The 2026 Finalists');
  const group = [pre, t1, t2, bar, fin];
  // finalist cards
  const cards = FIN.map((f, i) => {
    const c = div(r, 'abs', { left: (110 + i * 348) + 'px', top: '420px', width: '320px', height: '470px' });
    const pl = plate(c); const g = div(c, 'abs', { inset: '0', borderRadius: '18px', background: 'linear-gradient(to top, rgba(5,13,29,.95) 15%, rgba(5,13,29,.1) 70%)' });
    const n = div(c, 'D abs red', { left: '24px', top: '24px', fontSize: '56px' }, f.n);
    const nm = div(c, 'D abs', { left: '24px', bottom: '28px', fontSize: f.name.length > 12 ? '50px' : '64px', whiteSpace: 'normal', width: '280px' }, f.name + (f.with ? `<br><span style="font-size:.6em;color:var(--sky)">${f.with}</span>` : ''));
    return { c, pl, f };
  });
  sfx(10.0, 'riser', .8); sfx(10.5, 'boom', 1); hit(10.5, 1.4); FLASHES.push(10.5);
  sfx(13.45, 'whoosh', .7); FIN.forEach((f, i) => sfx(13.55 + i * .11, 'pop', .45));
  sfx(17.1, 'whoosh', .8);
  return (t) => {
    const lt = t - 10.5;
    S(big, { opacity: P(lt, 0, .8) * .9, transform: `scale(${lerp(1.25, 1, P(lt, 0, 3, E.outCubic)) + lt * .01})` });
    S(pre, { opacity: P(lt, .2, .7), letterSpacing: lerp(.6, .32, P(lt, .2, 1.4)) + 'em' });
    reveal(t1, lt, .15, .08, .6); reveal(t2, lt, .35, .08, .6);
    S(bar, { transform: `scaleX(${P(lt, .7, 1.3, E.inOutExpo)})` });
    S(fin, { opacity: P(lt, 1.6, 2.1), transform: `translateY(${(1 - P(lt, 1.6, 2.2)) * 20}px)` });
    // lockup moves up for the cards
    const up = P(lt, 2.9, 3.5, E.inOutExpo);
    const tgt = [[268, 60, .8], [330, 95, .6], [500, 200, .6], [700, 320, .6], [740, 740, 1]];
    group.forEach((g, i) => S(g, { transform: `translateY(${-up * (tgt[i][0] - tgt[i][1])}px) scale(${lerp(1, tgt[i][2], up)})`, transformOrigin: '50% 0%' }));
    S(fin, { opacity: P(lt, 1.6, 2.1) * (1 - up) });
    S(big, { top: (160 - up * 200) + 'px' });
    const push = P(lt, 6.3, 7.0, E.inExpo);
    cards.forEach(({ c, pl, f }, i) => {
      const p = P(lt, 3.05 + i * .11, 3.75 + i * .11, E.outCubic);
      const fl = Math.sin((lt + i) * 1.3) * 6;
      S(c, { opacity: clamp(p * 1.5) * (i === 0 ? 1 : 1 - push), transform: `translateY(${(1 - p) * 160 + fl}px) rotate(${(1 - p) * (i - 2) * 3}deg)` });
      pl.set({ src: f.th.src, crop: f.th.crop, x: 160, y: 235, w: 320, h: 470, zoom: 1 + lt * .02, op: 1, br: .9 });
    });
    cards[0].c.style.transform += ` scale(${1 + push * 2.5})`; cards[0].c.style.transformOrigin = '50% 50%';
  };
});

// ---------------- CHAPTER CARDS ----------------
FIN.forEach((f, i) => {
  const a = CARD_T[i];
  WIPES.push(a);
  sfx(a - .2, 'whoosh', .9); sfx(a, 'hit', .9); hit(a, .9);
  if (i === 3) sfx(a + 1.3, 'chime', .9); // yard PA chime before "Attention"
  shot(a, a + 2.0, (r) => {
    const pl = plate(r);
    const idx = div(r, 'D abs out', { left: '90px', top: '170px', fontSize: '560px', WebkitTextStroke: '3px rgba(245,247,251,.25)' }, f.n);
    const lab = div(r, 'lbl abs', { left: '760px', top: '330px' }, `Finalist ${f.n} / 05`);
    const bar = div(r, 'abs', { left: '760px', top: '372px', width: '120px', height: '8px', background: 'var(--red)', transformOrigin: '0 50%' });
    const nm = words(r, f.name, 'D', { left: '752px', top: '410px', fontSize: f.name.length > 12 ? '150px' : '190px' });
    const wi = f.with ? div(r, 'D abs', { left: '760px', top: f.name.length > 12 ? '545px' : '580px', fontSize: '70px', color: 'var(--sky)', textTransform: 'none' }, f.with) : null;
    const sub = div(r, 'U abs', { left: '760px', top: f.with ? '650px' : '600px', width: '1000px', fontSize: '36px', fontWeight: 500, lineHeight: 1.3, color: 'rgba(245,247,251,.85)' }, f.sub);
    return (t) => {
      const lt = t - a;
      pl.set({ src: f.p.src, crop: f.p.crop, x: 960, y: 540, w: 1920, h: 1080, zoom: 1.1 + lt * .06, op: 1, blur: 14, br: .32, sat: .6, radius: 0 });
      S(idx, { transform: `translateX(${(1 - P(lt, .05, .7)) * -220 + lt * 14}px)`, opacity: P(lt, .05, .4) });
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
shot(19.5, C[5].a - .05, (r, a) => {
  const pl = plate(r);
  const lab = div(r, 'lbl abs', { left: '120px', top: '250px' }, 'Intel · Finalist 01');
  const h = words(r, 'Platform MI', 'D', { left: '114px', top: '310px', fontSize: '124px' });
  const tags = ['Agentic AI', 'Live market signals', 'Part-level intelligence'].map((s, i) => div(r, 'U abs', {
    left: '124px', top: (480 + i * 70) + 'px', fontSize: '34px', fontWeight: 600, whiteSpace: 'nowrap' },
    `<span style="display:inline-block;width:14px;height:14px;background:var(--red);margin-right:18px;vertical-align:middle"></span>${s}`));
  const tp = [W(4, 'platform'), W(4, 'place'), W(4, 'move')];
  tp.forEach(x => sfx(x, 'pop', .4));
  return (t) => {
    const lt = t - a;
    const e = P(lt, 0, .8);
    pl.set({ src: 12.2, crop: [0, 68, 1672, 944], x: 1310 + (1 - e) * 400, y: 470, w: 1060, h: 598, zoom: 1 + lt * .02, ry: -14, op: e });
    S(lab, { opacity: P(lt, .1, .4) }); reveal(h, lt, .15, .08);
    tags.forEach((g, i) => { const p = P(t, tp[i], tp[i] + .5); S(g, { opacity: p, transform: `translateX(${(1 - p) * -30}px)` }); });
  };
});
shot(C[5].a - .05, C[6].a, (r, a) => {
  const pl = plate(r);
  const f1 = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '230px', fontSize: '250px' }, 'Firefighting');
  const strike = div(r, 'abs', { left: '330px', top: '330px', width: '1260px', height: '14px', background: 'var(--red)', transformOrigin: '0 50%' });
  const f2 = words(r, '→ Foresight', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '480px', fontSize: '290px' });
  f2.ws[1].classList.add('red');
  const tTo = W(5, 'to'), tF = W(5, 'foresight');
  sfx(tTo, 'swipe', .8); sfx(tF, 'hit', .8); hit(tF, .8);
  return (t) => {
    pl.set({ src: 13, crop: [0, 68, 1672, 944], w: 1920, h: 1080, zoom: 1.2, op: .5, blur: 10, br: .3, radius: 0 });
    S(f1, { opacity: lerp(1, .35, P(t, tTo, tTo + .3)), transform: `scale(${lerp(1.08, 1, P(t, a, a + .5))})` });
    S(strike, { transform: `scaleX(${P(t, tTo, tTo + .35, E.inOutExpo)})` });
    reveal(f2, t, tF - .1, .06, .6);
  };
});
shot(C[6].a, C[7].a, (r, a) => {
  const pl = plate(r);
  const n = div(r, 'D abs', { left: '1140px', top: '250px', fontSize: '280px' });
  const lbl = words(r, 'Active part numbers protected', 'U', { left: '1150px', top: '510px', fontSize: '38px', fontWeight: 600, width: '700px', whiteSpace: 'normal' });
  const t5 = W(6, '5,000');
  sfx(t5 - .1, 'ticks', .6); sfx(t5 + .9, 'hit', .6);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 20.5, crop: [0, 300, 1680, 580], x: 590, y: 450, w: 960, h: 331, zoom: 1 + lt * .02, ry: 14, op: P(lt, 0, .5), tx: (1 - P(lt, 0, .6)) * -200 });
    n.textContent = fmt(lerp(0, 5000, P(t, t5 - .15, t5 + .9, E.outCubic)));
    S(n, { opacity: P(t, t5 - .3, t5) });
    reveal(lbl, t, t5 + .3, .05);
  };
});
shot(C[7].a, 35.5, (r, a) => {
  const pl = plate(r);
  const s = svg(r, 240, 280, { left: '330px', top: '330px' });
  const sh = sv(s, 'path', { d: 'M120 10 L225 50 V140 C225 205 175 250 120 270 C65 250 15 205 15 140 V50 Z', fill: 'none', stroke: '#e3243b', 'stroke-width': 10, 'stroke-linejoin': 'round' });
  const ck = sv(s, 'path', { d: 'M70 140 L108 178 L175 105', fill: 'none', stroke: '#f5f7fb', 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const n = div(r, 'D abs', { left: '660px', top: '300px', fontSize: '300px' });
  const lbl = div(r, 'lbl abs', { left: '670px', top: '590px', fontSize: '30px', color: 'var(--white)' }, 'In revenue shielded');
  const t2 = W(7, '2');
  sfx(t2 - .1, 'ticks', .5); sfx(W(7, 'shielded'), 'hit', .8); hit(W(7, 'shielded'), .7);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 21, crop: [0, 68, 1672, 944], w: 1920, h: 1080, zoom: 1.1 + lt * .03, op: .5, blur: 12, br: .28, radius: 0 });
    strokeDraw(sh, P(lt, .1, 1.2, E.inOutCubic)); strokeDraw(ck, P(t, W(7, 'shielded'), W(7, 'shielded') + .4));
    const v = lerp(0, 2, P(t, t2 - .2, t2 + .6, E.outCubic));
    n.innerHTML = `<span style="color:var(--sky);font-size:.55em;vertical-align:.55em">≈</span>$${v.toFixed(v < 1.95 ? 1 : 0)}B`;
    S(n, { opacity: P(t, t2 - .4, t2 - .1) });
    S(lbl, { opacity: P(t, t2 + .3, t2 + .7) });
  };
});

// ======================================================================
// 02 GOFO
// ======================================================================
shot(37.5, C[10].a, (r, a) => {
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
  const tA = W(8, '500,000'), tB = W(9, '3');
  sfx(tA, 'pop', .6); sfx(tB - .3, 'riser_short', .6); sfx(tB + .2, 'hit', .7); hit(tB + .2, .5);
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
  sfx(a, 'hit', .6); sfx(tR, 'glitch', .7); hit(tR, .6);
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
  sfx(t3 - .2, 'ticks', .7); sfx(t3 + .9, 'hit', .9); hit(t3 + .9, 1);
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
shot(C[13].a, 54.5, (r, a) => {
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
  sfx(tZ, 'hit', .7); hit(tZ, .5); [0, 1, 2].forEach(i => sfx(tY + i * .22, 'pop', .5)); sfx(tA, 'hit', .7);
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
shot(56.5, C[16].a, (r, a) => {
  const pl = plate(r);
  const lab = div(r, 'lbl abs', { left: '1010px', top: '260px' }, 'Intel · Chemical & gas supply');
  const h1 = words(r, 'The last line', 'D', { left: '1000px', top: '310px', fontSize: '170px' });
  const h2 = words(r, 'of defense', 'D red', { left: '1000px', top: '470px', fontSize: '170px' });
  const sub = div(r, 'U abs', { left: '1008px', top: '650px', fontSize: '36px', fontWeight: 500, color: 'rgba(245,247,251,.85)' }, "for Intel's manufacturing flow");
  const wall = div(r, 'abs', { left: '960px', top: '250px', width: '8px', height: '480px', background: 'var(--red)', transformOrigin: '50% 100%' });
  const tL = W(15, 'last'), tD = W(15, 'defense');
  sfx(tD, 'hit', .8); hit(tD, .7);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 46.5, crop: [0, 60, 1680, 880], x: 470, y: 470, w: 820, h: 430, zoom: 1 + lt * .02, ry: 16, op: P(lt, 0, .5), tx: (1 - P(lt, 0, .6)) * -150 });
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
  const n = div(r, 'D abs', { left: '800px', top: '200px', fontSize: '330px' });
  const l1 = div(r, 'D abs', { left: '806px', top: '480px', fontSize: '100px', color: 'var(--sky)' }, 'per site · per day');
  const l2 = div(r, 'lbl abs', { left: '810px', top: '600px', color: 'var(--white)' }, 'Revenue impact of a line-down');
  const tM = W(16, 'million');
  sfx(tM - .3, 'ticks', .6); sfx(tM + .5, 'hit', .9); hit(tM + .5, .9);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 49, crop: [0, 60, 1680, 880], w: 1920, h: 1080, zoom: 1.1 + lt * .03, op: .5, blur: 12, br: .28, radius: 0 });
    const v = P(t, tM - .4, tM + .5, E.outCubic);
    n.textContent = v >= .999 ? '$1M' : '$' + v.toFixed(2) + 'M';
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
  const n = div(r, 'D abs', { left: '140px', width: '560px', textAlign: 'center', top: '310px', fontSize: '230px' });
  const lbl = words(r, 'Reduction in high-risk IPNs', 'U', { left: '160px', top: '740px', width: '560px', textAlign: 'center', fontSize: '34px', fontWeight: 600, whiteSpace: 'normal' });
  sfx(a + .05, 'ticks', .6); sfx(a + 1.2, 'hit', .9); hit(a + 1.2, .8);
  return (t) => {
    const lt = t - a;
    const p = P(lt, .05, 1.2, E.outCubic);
    strokeDraw(ring, p * .88); n.textContent = Math.round(p * 88) + '%';
    reveal(lbl, lt, .8, .05);
    pl.set({ src: 57.5, crop: [0, 60, 1680, 880], x: 1290, y: 450, w: 1000, h: 524, zoom: lerp(1, 1.9, P(lt, 1.5, 4.5, E.inOutCubic)), px: .7, py: -.4, ry: -14, op: P(lt, .2, .7), tx: (1 - P(lt, .2, .8)) * 200 });
  };
});
shot(W(17, 'worst'), 72.5, (r, a) => {
  const pl = plate(r);
  const N = 6, rows = [];
  for (let i = 0; i < N; i++) rows.push(div(r, 'abs', { left: '200px', top: (210 + i * 90) + 'px', height: '58px', width: (620 - i * 60) + 'px', background: 'rgba(143,182,255,.16)', borderRadius: '6px', transformOrigin: '0 50%' }));
  const mk = div(r, 'abs', { left: '200px', height: '58px', borderRadius: '6px', background: 'var(--red)', transformOrigin: '0 50%' });
  const wl = div(r, 'lbl abs', { left: '200px', top: '770px', color: 'var(--dim)' }, 'Worst in class');
  const h1 = div(r, 'D abs', { left: '960px', top: '250px', fontSize: '120px', color: 'var(--dim)' }, 'Worst in class');
  const ar = div(r, 'D abs red', { left: '960px', top: '370px', fontSize: '120px' }, '↓');
  const h2 = words(r, 'Best in class', 'D', { left: '960px', top: '480px', fontSize: '210px' });
  const tB = W(18, 'best');
  sfx(a + .4, 'riser_short', .6); sfx(tB, 'hit', 1); hit(tB, 1);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 61.5, crop: [60, 180, 1380, 720], w: 1920, h: 1080, zoom: 1.05 + lt * .03, op: .55, blur: 7, br: .3, radius: 0 });
    rows.forEach((rw, i) => S(rw, { transform: `scaleX(${P(lt, i * .04, .4 + i * .04)})` }));
    const climb = P(t, a + .3, tB + .1, E.inOutCubic);
    const idx = lerp(N - 1, 0, climb);
    S(mk, { top: (210 + idx * 90) + 'px', width: (620 - idx * 60) + 'px', opacity: P(lt, .2, .4) });
    S(h1, { opacity: P(lt, 0, .3) * lerp(1, .5, P(t, tB - .2, tB + .2)) });
    S(ar, { opacity: P(t, a + .5, a + .8), transform: `translateY(${Math.sin(lt * 6) * 8}px)` });
    reveal(h2, t, tB - .1, .07);
    S(wl, { opacity: P(lt, .3, .6) });
  };
});

// ======================================================================
// 04 GEORGIA-PACIFIC × project44
// ======================================================================
shot(74.5, C[22].a, (r, a) => {
  const pl = plate(r);
  const lab = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '120px', color: 'var(--white)' },
    '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--red);margin-right:16px;vertical-align:middle"></span>Live yard call · Georgia-Pacific');
  const NB = 72, bars = [];
  for (let i = 0; i < NB; i++) bars.push(div(r, 'abs', { left: (960 - NB * 11 + i * 22) + 'px', top: '330px', width: '12px', height: '240px', borderRadius: '6px', background: 'var(--white)', transformOrigin: '50% 50%' }));
  const board = (y, label, val, t0, t1) => {
    const row = div(r, 'abs', { left: '450px', top: y + 'px', height: '120px' });
    div(row, 'lbl abs', { left: '0', top: '44px', color: 'var(--sky)', fontSize: '28px' }, label);
    const cells = [...val].map((ch, i) => {
      const c = div(row, 'D abs', { left: (300 + i * 112) + 'px', top: '0', width: '100px', height: '120px', lineHeight: '120px', textAlign: 'center', fontSize: '104px', background: '#0d2147', borderRadius: '8px', boxShadow: 'inset 0 -60px 0 rgba(0,0,0,.18)' });
      return { c, ch, ts: lerp(t0, t1, val.length > 1 ? i / (val.length - 1) : 0) };
    });
    return cells;
  };
  const tS = W(20, '2-5-7-8-0-8'), tE = C[20].b, tD = W(21, 'five');
  const cells = [...board(560, 'Truck', '257808', tS, tE - .1), ...board(710, 'Proceed to dock', '5', tD, tD)];
  cells.forEach(c => sfx(c.ts, 'flip', .5));
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
  const s = svg(r, 520, 520, { left: '700px', top: '130px' });
  sv(s, 'circle', { cx: 260, cy: 260, r: 230, fill: 'none', stroke: 'rgba(143,182,255,.16)', 'stroke-width': 18 });
  const ring = sv(s, 'circle', { cx: 260, cy: 260, r: 230, fill: 'none', stroke: '#f5f7fb', 'stroke-width': 18, transform: 'rotate(-90 260 260)' });
  const clk = div(r, 'D abs', { left: '700px', width: '520px', textAlign: 'center', top: '300px', fontSize: '190px' });
  const cl = div(r, 'lbl abs', { left: '700px', width: '520px', textAlign: 'center', top: '480px', color: 'var(--white)' }, 'Driver check-in');
  const tF = W(22, 'five'), tT = W(22, 'two');
  sfx(tF, 'pop', .6); sfx(tF + .2, 'ticks', .6); sfx(tT + .3, 'hit', .9); hit(tT + .3, .8);
  return (t) => {
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
  const n = div(r, 'D abs', { left: '130px', top: '180px', fontSize: '420px' });
  const l = words(r, 'Less check-in time', 'D', { left: '140px', top: '560px', fontSize: '96px', color: 'var(--sky)' });
  const t6 = W(23, '66%');
  sfx(t6 - .2, 'ticks', .6); sfx(t6 + .5, 'hit', 1); hit(t6 + .5, 1);
  return (t) => {
    const lt = t - a;
    n.innerHTML = `${Math.round(lerp(0, 66, P(t, t6 - .3, t6 + .5, E.outCubic)))}<span class="red">%</span>`;
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
shot(C[25].a, 92.5, (r, a) => {
  const pre = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '290px', color: 'var(--white)' }, 'Georgia-Pacific × project44');
  const h = words(r, 'Shipper of choice', 'D', { left: '0', width: '1920px', textAlign: 'center', top: '340px', fontSize: '230px' });
  const bar = div(r, 'abs', { left: '760px', top: '580px', width: '400px', height: '10px', background: 'var(--red)', transformOrigin: '50% 50%' });
  sfx(W(25, 'shipper'), 'hit', .8); hit(W(25, 'shipper'), .6);
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
shot(94.5, C[27].a, (r, a) => {
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
  sfx(a, 'sub', 1); sfx(a + .1, 'clock', .8); sfx(t3, 'hit', .9); hit(t3, .9);
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
  const pl = plate(r);
  const nm = div(r, 'lbl abs', { left: '180px', top: '790px', color: 'var(--white)', fontSize: '20px' }, 'Arush Kishore · VP, Reliance Industries Limited');
  const h1 = words(r, 'Safety', 'D', { left: '960px', top: '220px', fontSize: '200px' });
  const h2 = div(r, 'D abs', { left: '960px', top: '400px', fontSize: '200px' }, 'is not a');
  const cost = div(r, 'D abs', { left: '960px', top: '580px', fontSize: '200px' }, 'cost');
  const strike = div(r, 'abs', { left: '950px', top: '660px', width: '360px', height: '14px', background: 'var(--red)', transformOrigin: '0 50%' });
  const eff = words(r, 'it drives efficiency', 'D red', { left: '960px', top: '580px', fontSize: '200px' });
  const tE = C[28].a;
  sfx(W(27, 'cost'), 'hit', .7); sfx(tE, 'swipe', .8); sfx(W(28, 'efficiency'), 'hit', .8); hit(W(28, 'efficiency'), .6);
  return (t) => {
    const lt = t - a;
    pl.set({ src: clamp(88.7 + lt * .9, 88.7, 92.3), crop: [92, 255, 460, 320], x: 500, y: 520, w: 640, h: 445, zoom: 1.0 + lt * .02, op: P(lt, 0, .4), tx: (1 - P(lt, 0, .5)) * -120, ry: 10 });
    S(nm, { opacity: P(lt, .4, .8) });
    reveal(h1, t, a, .07);
    S(h2, { opacity: P(t, W(27, 'is'), W(27, 'is') + .2) });
    const sw = P(t, tE, tE + .3, E.inOutExpo);
    S(cost, { opacity: P(t, W(27, 'cost'), W(27, 'cost') + .15) * (1 - P(t, tE + .25, tE + .45)) });
    S(strike, { transform: `scaleX(${sw})`, opacity: 1 - P(t, tE + .25, tE + .45) });
    S(h2, { opacity: P(t, W(27, 'is'), W(27, 'is') + .2) * (1 - P(t, tE + .25, tE + .45)) });
    S(eff, { top: '400px', fontSize: '170px', whiteSpace: 'normal', width: '900px', lineHeight: '.9' });
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
  const n = div(r, 'D abs', { left: '150px', top: '190px', fontSize: '300px' });
  const nl = div(r, 'lbl abs', { left: '160px', top: '470px', fontSize: '30px', color: 'var(--white)' }, 'Smaller fleet');
  const s = svg(r, 260, 260, { left: '1000px', top: '210px' });
  const loop = sv(s, 'path', { d: 'M130 20 A110 110 0 1 1 30 85', fill: 'none', stroke: '#e3243b', 'stroke-width': 14, 'stroke-linecap': 'round' });
  const head = sv(s, 'path', { d: 'M8 60 L30 95 L62 70', fill: 'none', stroke: '#e3243b', 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const p1 = words(r, 'Pays for', 'D', { left: '1310px', top: '210px', fontSize: '150px' });
  const p2 = words(r, 'itself', 'D red', { left: '1310px', top: '350px', fontSize: '150px' });
  const fin = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '620px', fontSize: '84px', color: 'var(--sky)' }, 'From reactive to resilient');
  const tS = Math.max(a + .25, W(30, 'smaller') - .5), tP = W(30, 'pays');
  sfx(tS - .1, 'ticks', .6); sfx(tS + .6, 'hit', .8); hit(tS + .6, .6); sfx(tP, 'swipe', .6); sfx(W(30, 'itself'), 'hit', .8);
  return (t) => {
    const lt = t - a;
    pl.set({ src: 86, crop: [40, 200, 1640, 700], w: 1920, h: 1080, zoom: 1.2 + lt * .02, px: .2, op: .35, blur: 10, br: .28, radius: 0 });
    const v = P(t, tS - .1, tS + .6, E.outCubic);
    n.innerHTML = `−${Math.round(v * 46)}<span class="red">%</span>`; S(n, { opacity: P(t, tS - .2, tS) });
    S(nl, { opacity: P(t, tS + .4, tS + .7) });
    strokeDraw(loop, P(t, tP - .1, tP + .7, E.inOutCubic)); S(head, { opacity: P(t, tP + .6, tP + .75) });
    reveal(p1, t, tP, .07); reveal(p2, t, W(30, 'itself') - .1, .07);
    S(fin, { opacity: P(t, W(30, 'itself') + .5, W(30, 'itself') + 1.1) });
  };
});

// ======================================================================
// END: 5 finalists, 1 winner → EDGE Nashville → logo lockup
// ======================================================================
WIPES.push(110);
shot(110, 113.6, (r, a) => {
  const cards = FIN.map((f, i) => ({ pl: plate(r), f, i }));
  const h1 = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '330px', fontSize: '250px', textShadow: '0 10px 60px rgba(0,0,0,.6)' });
  sfx(110, 'hit', .9); FIN.forEach((f, i) => sfx(110.1 + i * .09, 'pop', .4));
  sfx(111.6, 'hit', .8); sfx(112.6, 'boom', 1); hit(112.6, 1.2);
  return (t) => {
    const lt = t - a;
    cards.forEach(({ pl, f, i }) => {
      const p = P(lt, .05 + i * .09, .6 + i * .09, E.outCubic);
      pl.set({ src: f.th.src + (i === 4 ? lt * .4 : 0), crop: f.th.crop, x: 192 + i * 384, y: 540, w: 372, h: 1040, zoom: 1.1 - lt * .02, op: p, ty: (1 - p) * (i % 2 ? -200 : 200), br: lerp(.9, .35, P(lt, 1.2, 1.6)), radius: 10 });
    });
    const one = lt >= 2.1;
    h1.innerHTML = one ? '1 <span class="red">winner.</span>' : '5 finalists.';
    S(h1, { opacity: P(lt, 1.15, 1.3), transform: `scale(${one ? lerp(1.25, 1, P(lt, 2.1, 2.5)) : lerp(1.15, 1, P(lt, 1.15, 1.5))})` });
  };
});
shot(113.6, 117.2, (r, a) => {
  const pre = words(r, 'See them live at', 'lbl', { left: '0', width: '1920px', textAlign: 'center', top: '180px', fontSize: '30px', color: 'var(--white)' });
  const logo = div(r, 'abs', { left: '660px', top: '240px', width: '600px', height: '208px', background: 'url(assets/edge_white.png) center/contain no-repeat' });
  const yr = div(r, 'D abs', { left: '0', width: '1920px', textAlign: 'center', top: '470px', fontSize: '120px' }, 'Nashville <span class="red">·</span> Oct 4–7, 2026');
  const rows = [['Mon · Oct 5', 'Finalists present live'], ['Tue · Oct 6', 'Winner revealed on the main stage']].map(([d, s], i) =>
    div(r, 'abs U', { left: '0', width: '1920px', textAlign: 'center', top: (650 + i * 70) + 'px', fontSize: '38px', fontWeight: 500, whiteSpace: 'nowrap' },
      `<span style="font-family:'Barlow Condensed';font-weight:800;text-transform:uppercase;color:var(--sky);margin-right:22px;font-size:44px">${d}</span>${s}`));
  const venue = div(r, 'lbl abs', { left: '0', width: '1920px', textAlign: 'center', top: '820px', color: 'var(--dim)' }, 'Gaylord Opryland Resort & Convention Center');
  sfx(a, 'whoosh', .7); sfx(a + .3, 'hit', .8); sfx(a + 1.2, 'pop', .5); sfx(a + 1.5, 'pop', .5);
  return (t) => {
    const lt = t - a;
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
const redAmt = t => Math.max(P(t, W(2, 'weapon'), W(2, 'weapon') + .2) * (1 - P(t, 10.3, 10.6)), P(t, 94.5, 94.8) * (1 - P(t, C[27].a, C[27].a + .4)));
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
  const c = CUES.find(c => t >= c.a - .05 && t < c.b + .2);
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

window.seek = async (t) => {
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
  drawCaps(t); drawWipe(t); camera(t); drawGrain(t);
  await Promise.all(pending);
};
window.getSfx = () => SFX.sort((a, b) => a.t - b.t);
window.getCues = () => CUES.map(c => ({ a: c.a, b: c.b, txt: c.txt }));
})();
