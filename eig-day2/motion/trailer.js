// EIG Day 2 On-Demand: 30-second trailer. Pure function of time: await setup(); seek(t) paints time t.
// 120 BPM grid (one beat = 0.5 s). Soundbite timings match work/trailer/bites/*.wav (see tools/trailer.py).
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
  outBack: t => { const c1 = 1.3, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const P = (t, a, b, e = E.outExpo) => e(clamp((t - a) / (b - a)));
const IMG = '../site/assets/img/', SPK = '../site/assets/speakers/', STILL = '../work/trailer/stills/';
const stage = document.getElementById('stage');
const PEOPLE = window.EIG_SPEAKERS || {}, TALKS = window.EIG_TALKS || [];

function el(parent, cls = '', css = {}, html = '', tag = 'div') {
  const d = document.createElement(tag); if (cls) d.className = cls; Object.assign(d.style, css);
  if (html) d.innerHTML = html; parent.appendChild(d); return d;
}
function img(parent, src, cls = '', css = {}) { const i = el(parent, cls, css, '', 'img'); i.src = src; return i; }
const S = (e, css) => { for (const k in css) e.style[k] = css[k]; };
function scene() { return el(stage, 'scene'); }
// words: copperFrom = index of the first word set in copper italic (-1 = none)
function words(parent, text, cls, css = {}, copperFrom = -1) {
  const d = el(parent, cls + ' abs', css); d.ws = [];
  text.split(' ').forEach((p, i, a) => {
    const w = el(d, 'w' + (copperFrom >= 0 && i >= copperFrom ? ' cop' : ''), {}, '', 'span'); w.textContent = p; d.ws.push(w);
    if (i < a.length - 1) d.appendChild(document.createTextNode(' '));
  });
  return d;
}
// kinetic reveal: each word lands at its own time (spoken timing)
function reveal(e, t, times, dur = .4) {
  e.ws.forEach((w, i) => {
    const p = P(t, times[i], times[i] + dur, E.outQuint);
    S(w, { opacity: p, transform: `translateY(${(1 - p) * 34}%)`, filter: `blur(${(1 - p) * 8}px)` });
  });
}
function rise(e, t, t0, st = .06, dur = .6) { reveal(e, t, e.ws.map((_, i) => t0 + i * st), dur); }
function nameTag(parent, id) {
  const p = PEOPLE[id] || { name: id, role: '' };
  const tg = el(parent, 'tag'); el(tg, 'bar');
  const av = el(tg, 'av'); img(av, SPK + id + '.webp');
  const tx = el(tg, ''); el(tx, '', {}, '', 'b').textContent = p.name; el(tx, '', {}, '', 'span').textContent = p.role;
  return tg;
}
function tagPaint(tg, t, a, b) {
  const p = P(t, a, a + .5, E.outQuint) * (1 - P(t, b - .3, b, E.inCubic));
  S(tg, { opacity: p, transform: `translateX(${(1 - p) * -40}px)` });
}
function lemniscate(w, h) {
  let d = '';
  for (let i = 0; i <= 160; i++) {
    const a = i / 160 * Math.PI * 2, s = Math.sin(a), c = Math.cos(a), k = 1 + s * s;
    d += (i ? 'L' : 'M') + (w / 2 + w / 2 * .92 * c / k).toFixed(1) + ' ' + (h / 2 + h * .9 * s * c / k).toFixed(1);
  }
  return d + 'Z';
}

/* ------------------------------------------------------------------ A · cold open (0–4) */
function sceneA() {
  const root = scene();
  const glow = el(root, 'full', { background: 'radial-gradient(55% 50% at 50% 48%, rgba(201,133,82,.18), rgba(5,10,21,0) 70%)' });
  const l1 = words(root, 'You know how strategies fail?', 'serif', { left: 0, right: 0, top: '400px', textAlign: 'center', fontSize: '118px' });
  const l2 = words(root, 'They die a slow death.', 'serif', { left: 0, right: 0, top: '520px', textAlign: 'center', fontSize: '168px' }, 3);
  const tag = nameTag(root, 'jose-pires');
  const T = 0.35, t1 = [0.05, 0.22, 0.49, 0.62, 0.92].map(x => x + T), t2 = [1.66, 1.9, 2.2, 2.59, 3.12].map(x => x + T);
  return t => {
    if (t > 4.1) return S(root, { opacity: 0 });
    const out = P(t, 3.74, 4.02, E.inExpo);
    S(root, { opacity: 1 - out, transform: `scale(${1 + out * .1})`, filter: `blur(${out * 12}px)` });
    S(glow, { opacity: P(t, 0, 2.6, E.outCubic) });
    reveal(l1, t, t1, .38);
    const up = P(t, 1.78, 2.2, E.inOutCubic);
    S(l1, { transform: `translateY(${-up * 150}px) scale(${1 - up * .25})`, opacity: 1 - up * .55 });
    reveal(l2, t, t2, .42);
    tagPaint(tag, t, .7, 3.7);
  };
}

/* ------------------------------------------------------------------ B · brand hit (4–6.5) */
function sceneB() {
  const root = scene();
  const bgw = el(root, 'full', { overflow: 'hidden' }); const bg = img(bgw, IMG + 'glass-2000.webp', 'cover');
  el(root, 'full', { background: 'radial-gradient(70% 70% at 50% 45%, rgba(5,10,21,.3), rgba(5,10,21,.93) 82%)' });
  const sweep = el(root, 'abs', { left: 0, top: '-30%', width: '26%', height: '160%', mixBlendMode: 'screen',
    background: 'linear-gradient(90deg, rgba(232,179,138,0), rgba(255,228,204,.42) 50%, rgba(232,179,138,0))' });
  const flash = el(root, 'full', { mixBlendMode: 'screen', background: 'radial-gradient(45% 45% at 50% 40%, rgba(255,236,218,.95), rgba(232,179,138,.35) 45%, rgba(5,10,21,0) 75%)' });
  const box = el(root, 'abs', { left: 0, right: 0, top: '235px', textAlign: 'center' });
  const markW = el(box, '', { display: 'inline-block' }); const mark = img(markW, IMG + 'eig-mark.png', '', { height: '200px', width: 'auto', display: 'block' });
  const t1 = words(box, 'EIG Innovation Conference 2026', 'serif', { position: 'relative', fontSize: '88px', marginTop: '36px' });
  const k1 = words(box, 'Austin · Day 2', 'kick', { position: 'relative', marginTop: '28px', color: 'var(--dim)' });
  const k2 = words(box, 'Now on demand', 'kick', { position: 'relative', marginTop: '30px', fontSize: '36px', letterSpacing: '.44em' });
  return t => {
    if (t < 3.95 || t > 6.6) return S(root, { opacity: 0 });
    const out = P(t, 6.22, 6.5, E.inExpo);
    S(root, { opacity: P(t, 3.95, 4.05) * (1 - out * .9), transform: `translateX(${-out * 22}%)`, filter: `blur(${out * 16}px)` });
    S(bg, { transform: `scale(${lerp(1.2, 1.06, P(t, 4, 6.5, E.outCubic))})`, filter: `brightness(${.5 + .4 * (1 - P(t, 4, 4.9))})` });
    S(sweep, { transform: `translateX(${lerp(-130, 460, P(t, 4.0, 5.4, E.inOutCubic))}%) rotate(14deg)` });
    S(flash, { opacity: 1 - P(t, 4.0, 4.75, E.outCubic) });
    const m = P(t, 4.02, 4.75, E.outBack);
    S(mark, { transform: `scale(${lerp(.5, 1, m)}) rotate(${lerp(-14, 0, P(t, 4.02, 4.9, E.outCubic))}deg)`, opacity: P(t, 4.02, 4.25),
      filter: `drop-shadow(0 0 ${36 * (1 - P(t, 4.2, 5.4))}px rgba(232,179,138,.85))` });
    rise(t1, t, 4.35, .06, .7); rise(k1, t, 4.8, .05, .6); rise(k2, t, 5.4, .07, .7);
  };
}

/* ------------------------------------------------------------------ C · montage + Aaron (6.5–11.5) */
function sceneC() {
  const root = scene();
  el(root, 'full', { background: 'radial-gradient(85% 75% at 50% 40%, #0e1c34, #050a15 76%)' });
  const persp = el(root, 'full', { perspective: '1700px', perspectiveOrigin: '50% 42%' });
  const row = el(persp, 'abs', { left: 0, top: 0, width: '1920px', height: '1080px', transformStyle: 'preserve-3d' });
  const items = [['s10', 'Market intelligence'], ['s11', 'Supply chain trust'], ['s17', 'Industry 5.0'], ['s12', 'Lightning talks'], ['s14', 'Navigating change'], ['s09', 'Plug-in services']];
  const pos = [[-60, 110], [700, 50], [1460, 130], [320, 560], [1080, 600], [1840, 520]];
  const cards = items.map(([k, label], i) => { const c = el(row, 'card', { left: pos[i][0] + 'px', top: pos[i][1] + 'px' }); img(c, STILL + k + '.jpg'); el(c, 'chip', {}, label); return c; });
  const dim = el(root, 'full', { background: 'linear-gradient(180deg, rgba(5,10,21,.55), rgba(5,10,21,.82))' });
  const q = words(root, 'Every process runs at the speed of its slowest step.', 'serif', { left: '120px', right: '160px', top: '300px', fontSize: '132px', lineHeight: '1.04' }, 8);
  const tag = nameTag(root, 'aaron-parr');
  const tw = [7.70, 8.35, 8.75, 9.40, 9.55, 9.66, 9.95, 10.12, 10.39, 11.12];   // bite starts 7.64 s, 'Every' lands at 7.70
  return t => {
    if (t < 6.4 || t > 11.6) return S(root, { opacity: 0 });
    const out = P(t, 11.22, 11.5, E.inExpo);
    S(root, { opacity: P(t, 6.4, 6.7, E.outCubic) * (1 - out) });
    S(row, { transform: `translateX(${lerp(80, -460, P(t, 6.5, 11.5, E.lin))}px) translateZ(${-out * 400}px) rotateY(-13deg) rotateX(7deg)` });
    cards.forEach((c, i) => {
      const a = 6.5 + i * .25, p = P(t, a, a + .65, E.outExpo);
      S(c, { opacity: p, transform: `translateY(${(1 - p) * 180}px) translateZ(${(1 - p) * -500 + Math.sin(t * .9 + i * 1.7) * 26}px) rotateY(${(1 - p) * -28}deg)` });
    });
    const d = P(t, 7.3, 7.7, E.outCubic);
    S(dim, { opacity: d }); S(persp, { filter: `blur(${d * 4}px)` });
    reveal(q, t, tw, .36);
    tagPaint(tag, t, 7.95, 11.25);
  };
}

/* ------------------------------------------------------------------ D · trust + Greg (11.5–16.5) */
function panel(parent, x, label, dir, word) {
  const p = el(parent, 'abs', { left: x + 'px', top: '470px', width: '660px', height: '420px' });
  el(p, 'kick', { position: 'absolute', left: 0, top: 0 }, label);
  const W = 660, H = 230, pts = [];
  for (let i = 0; i <= 24; i++) {
    const f = i / 24, base = dir === 'down' ? lerp(.12, .9, E.inOutCubic(f)) : lerp(.9, .1, E.inOutCubic(f));
    pts.push([f * W, (base + Math.sin(i * 1.9) * .035 * (1 - Math.abs(f - .5))) * H]);
  }
  const d = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.style.left = 0; svg.style.top = '56px';
  svg.innerHTML = `<defs><linearGradient id="g${x}" x1="0" x2="1"><stop offset="0" stop-color="#8a4f2b"/><stop offset=".6" stop-color="#e8b38a"/><stop offset="1" stop-color="#ffe2c8"/></linearGradient></defs>` +
    [0, .33, .66, 1].map(f => `<line x1="0" x2="${W}" y1="${f * H}" y2="${f * H}" stroke="rgba(244,239,232,.08)" stroke-width="1"/>`).join('') +
    `<path d="${d}" fill="none" stroke="url(#g${x})" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 12px rgba(232,179,138,.55))"/>` +
    `<circle r="11" fill="#ffe2c8" style="filter:drop-shadow(0 0 16px rgba(255,226,200,.9))"/>`;
  p.appendChild(svg);
  const path = svg.querySelector('path'), dot = svg.querySelector('circle');
  const wd = words(p, word, 'serif cop', { left: 0, top: '310px', fontSize: '96px' });
  return { p, path, dot, wd, len: () => path.getTotalLength() };
}
function sceneD() {
  const root = scene();
  const bgw = el(root, 'full', { overflow: 'hidden' }); const bg = img(bgw, STILL + 's11.jpg', 'cover');
  el(root, 'full', { background: 'linear-gradient(180deg, rgba(5,10,21,.86), rgba(5,10,21,.93))' });
  const head = words(root, 'If trust is present…', 'serif', { left: 0, right: 0, top: '170px', textAlign: 'center', fontSize: '124px' });
  head.ws[1].classList.add('cop');
  const A = panel(root, 220, 'Costs', 'down', 'decrease'), B = panel(root, 1040, 'Speed', 'up', 'accelerates');
  const tag = nameTag(root, 'greg-schlegel');
  const T = 12.1;
  function draw(pn, t, a, b, wt) {
    const L = pn.len(), f = P(t, a, b, E.inOutCubic);
    pn.path.style.strokeDasharray = L; pn.path.style.strokeDashoffset = (1 - f) * L;
    const pt = pn.path.getPointAtLength(Math.max(.01, f * L)); pn.dot.setAttribute('cx', pt.x); pn.dot.setAttribute('cy', pt.y);
    pn.dot.style.opacity = f > 0 ? 1 : 0;
    S(pn.p, { opacity: P(t, a - .25, a + .1) });
    reveal(pn.wd, t, [wt], .45);
  }
  return t => {
    if (t < 11.45 || t > 16.6) return S(root, { opacity: 0 });
    S(root, { opacity: P(t, 11.45, 11.6) * (1 - P(t, 16.3, 16.5, E.inExpo)) });
    S(bg, { transform: `scale(${lerp(1.06, 1.2, P(t, 11.5, 16.5, E.lin))})`, filter: 'blur(12px) brightness(.6) saturate(.8)' });
    reveal(head, t, [11.55, 11.7, 11.84, 12.0], .45);
    draw(A, t, T + .0, T + 1.65, T + 1.0);
    draw(B, t, T + 2.5, T + 4.3, T + 3.66);
    tagPaint(tag, t, 12.4, 16.3);
  };
}

/* ------------------------------------------------------------------ E · stats (16.5–20.5) */
function sceneE() {
  const root = scene();
  el(root, 'full', { background: 'radial-gradient(70% 70% at 50% 50%, #0f1d36, #050a15 75%)' });
  const lines = [...Array(9)].map((_, i) => el(root, 'abs', { left: (i * 240 - 60) + 'px', top: 0, width: '1px', height: '1080px', background: 'linear-gradient(180deg, rgba(232,179,138,0), rgba(232,179,138,.16), rgba(232,179,138,0))' }));
  const streak = el(root, 'abs', { left: 0, top: '536px', width: '1920px', height: '2px', background: 'linear-gradient(90deg, rgba(232,179,138,0), #ffe2c8, rgba(232,179,138,0))', transformOrigin: '50% 50%' });
  const total = TALKS.reduce((a, x) => a + (x.durationSec || 0), 0), m = Math.round(total / 60);
  const nPeople = Object.keys(PEOPLE).length;
  const stats = [[String(TALKS.length), 'Sessions'], [`${Math.floor(m / 60)}<small>h</small> ${m % 60}<small>m</small>`, 'Of recorded sessions'], [String(nPeople), 'Speakers & partners'], ['inf', 'Lifetime access']];
  const items = stats.map(([n, l]) => {
    const g = el(root, 'abs', { left: 0, right: 0, top: '250px', textAlign: 'center' });
    if (n === 'inf') {
      const svgNS = 'http://www.w3.org/2000/svg', s = document.createElementNS(svgNS, 'svg');
      s.setAttribute('width', 520); s.setAttribute('height', 300); s.style.position = 'relative'; s.style.display = 'block'; s.style.margin = '30px auto 26px';
      s.innerHTML = `<defs><linearGradient id="gi" x1="0" x2="1"><stop offset="0" stop-color="#9a5a32"/><stop offset=".45" stop-color="#e8b38a"/><stop offset=".7" stop-color="#c98552"/><stop offset="1" stop-color="#7a4424"/></linearGradient></defs><path d="${lemniscate(500, 240)}" transform="translate(10 30)" fill="none" stroke="url(#gi)" stroke-width="30" stroke-linejoin="round"/>`;
      g.appendChild(s);
    } else {
      el(g, 'serif gradtext', { position: 'relative', fontSize: '330px', lineHeight: '1', display: 'inline-block', padding: '0 20px' }, n.replace(/<small>/g, '<small style="font-size:.42em">'));
    }
    el(g, 'kick', { position: 'relative', fontSize: '34px', marginTop: '18px', letterSpacing: '.36em', color: 'var(--ink)' }, l);
    return g;
  });
  return t => {
    if (t < 16.45 || t > 20.6) return S(root, { opacity: 0 });
    S(root, { opacity: P(t, 16.45, 16.55) * (1 - P(t, 20.3, 20.5, E.inExpo)) });
    lines.forEach((ln, i) => S(ln, { transform: `translateX(${((t - 16.5) * 90 + i * 0) % 240}px)` }));
    items.forEach((g, i) => {
      const a = 16.5 + i, inn = P(t, a, a + .24, E.outQuint), out = i < 3 ? P(t, a + .9, a + 1.0, E.inCubic) : 0;
      S(g, { opacity: inn * (1 - out), transform: `scale(${lerp(1.32, 1, inn) * (1 - out * .12)})`, filter: `blur(${(1 - inn) * 14 + out * 8}px)` });
    });
    const k = ((t - 16.5) % 1 + 1) % 1; S(streak, { opacity: (1 - P(k, 0, .45, E.outCubic)) * (t >= 16.5 ? 1 : 0), transform: `scaleX(${lerp(.2, 1.4, P(k, 0, .45, E.outCubic))})` });
  };
}

/* ------------------------------------------------------------------ F · faces + Hosni (20.5–24.5) */
function sceneF() {
  const root = scene();
  const grid = el(root, 'full', { transformOrigin: '50% 50%' });
  const stageIds = []; TALKS.forEach(x => x.speakers.forEach(s => { if (!stageIds.includes(s.id)) stageIds.push(s.id); }));
  const ids = stageIds.concat((window.EIG_PARTNERS || []).filter(i => !stageIds.includes(i)));
  const C = 7, R = 5, SZ = 196, G = 18, W0 = C * SZ + (C - 1) * G, H0 = R * SZ + (R - 1) * G, x0 = (1920 - W0) / 2, y0 = (1080 - H0) / 2;
  // photo-less partners go to scattered slots; everyone else fills from the centre out
  const monoSlots = [6, 15, 26, 28], mono = ids.filter(i => (PEOPLE[i] || {}).photo === false);
  const centre = [...Array(C * R).keys()].filter(k => !monoSlots.slice(0, mono.length).includes(k))
    .sort((a, b) => Math.hypot(a % C - 3, (Math.floor(a / C) - 2) * 1.2) - Math.hypot(b % C - 3, (Math.floor(b / C) - 2) * 1.2));
  const slotOf = {}; let mi = 0, ci = 0;
  ids.forEach(i => { slotOf[i] = (PEOPLE[i] || {}).photo === false ? monoSlots[mi++] : centre[ci++]; });
  const tiles = ids.slice(0, C * R).map((id, k) => {
    const slot = slotOf[id], cx = slot % C, cy = Math.floor(slot / C);
    const p = PEOPLE[id] || {};
    const tl = el(grid, 'tile' + (p.photo === false ? ' mono' : ''), { left: (x0 + cx * (SZ + G)) + 'px', top: (y0 + cy * (SZ + G)) + 'px' });
    if (p.photo === false) el(tl, '', {}, '', 'span').textContent = p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('');
    else img(tl, SPK + id + '.webp');
    tl.d = Math.hypot(cx - 3, (cy - 2) * 1.2);
    return tl;
  });
  const dim = el(root, 'full', { background: 'radial-gradient(75% 62% at 50% 50%, rgba(5,10,21,.92), rgba(5,10,21,.72))' });
  const q = words(root, 'We have everything we need to be successful.', 'serif', { left: '150px', right: '150px', top: '330px', textAlign: 'center', fontSize: '146px', lineHeight: '1.04' }, 5);
  const tag = nameTag(root, 'hosni-adra');
  const T = 21.2, tw = [0.04, 0.16, 0.78, 1.15, 1.3, 1.48, 1.58, 1.7].map(x => x + T);
  return t => {
    if (t < 20.45 || t > 24.6) return S(root, { opacity: 0 });
    S(root, { opacity: P(t, 20.45, 20.55) * (1 - P(t, 24.3, 24.5, E.inExpo)) });
    S(grid, { transform: `scale(${lerp(1.0, 1.12, P(t, 20.5, 24.5, E.lin))})` });
    const col = P(t, 23.85, 24.45, E.inOutCubic);
    tiles.forEach(tl => {
      const a = 20.5 + tl.d * .11, p = P(t, a, a + .5, E.outBack);
      S(tl, { opacity: P(t, a, a + .2), transform: `scale(${lerp(.55, 1, p)})`, filter: `grayscale(${1 - col}) brightness(${lerp(.82, 1.05, col)}) contrast(1.05)` });
    });
    S(dim, { opacity: P(t, 20.95, 21.3, E.outCubic) * (1 - col * .85) });
    reveal(q, t, tw, .36);
    S(q, { opacity: 1 - P(t, 23.55, 23.9, E.inCubic) });
    tagPaint(tag, t, 21.45, 23.75);
  };
}

/* ------------------------------------------------------------------ G · end card (24.5–30) */
function sceneG() {
  const root = scene();
  const bgw = el(root, 'full', { overflow: 'hidden' }); const bg = img(bgw, IMG + 'skyline-2000.webp', 'cover', { objectPosition: '50% 18%' });
  el(root, 'full', { background: 'linear-gradient(180deg, rgba(5,10,21,.9) 0%, rgba(5,10,21,.7) 50%, rgba(5,10,21,.92) 100%)' });
  const flash = el(root, 'full', { mixBlendMode: 'screen', background: 'radial-gradient(50% 45% at 50% 42%, rgba(255,236,218,.85), rgba(232,179,138,.3) 45%, rgba(5,10,21,0) 75%)' });
  const box = el(root, 'abs', { left: 0, right: 0, top: '120px', textAlign: 'center' });
  const markW = el(box, '', { display: 'inline-block' }); const mark = img(markW, IMG + 'eig-mark.png', '', { height: '92px', width: 'auto', display: 'block' });
  const l1 = words(box, 'Day 2.', 'serif', { position: 'relative', fontSize: '196px', marginTop: '26px' });
  const l2 = words(box, 'On demand.', 'serif cop', { position: 'relative', fontSize: '196px', marginTop: '-6px' });
  const k = words(box, 'EIG Innovation Conference 2026 · Austin', 'kick', { position: 'relative', marginTop: '34px', color: 'var(--dim)' });
  const chips = el(box, '', { position: 'relative', marginTop: '34px', display: 'flex', gap: '16px', justifyContent: 'center' });
  const total = TALKS.reduce((a, x) => a + (x.durationSec || 0), 0), m = Math.round(total / 60);
  const ch = [`${TALKS.length} sessions`, `${Math.floor(m / 60)} h ${m % 60} m`, 'Lifetime access'].map(s => el(chips, 'stchip', {}, s));
  const cta = el(box, '', { position: 'relative', marginTop: '40px', display: 'flex', gap: '30px', justifyContent: 'center', alignItems: 'center' });
  const pill = el(cta, 'pill', {}, 'Get instant access <span style="font-size:.9em">→</span>');
  const url = el(cta, 'sans', { font: '500 30px/1 var(--sans)', color: 'var(--ink)', letterSpacing: '.01em' }, 'consultingeig.com/austinondemand');
  const black = el(root, 'full', { background: '#000' });
  return t => {
    if (t < 24.45) return S(root, { opacity: 0 });
    S(root, { opacity: P(t, 24.45, 24.55) });
    S(bg, { transform: `scale(${lerp(1.12, 1.02, P(t, 24.5, 30, E.outCubic))})` });
    S(flash, { opacity: 1 - P(t, 24.5, 25.3, E.outCubic) });
    const mk = P(t, 24.55, 25.2, E.outBack); S(mark, { opacity: P(t, 24.55, 24.8), transform: `scale(${lerp(.6, 1, mk)})` });
    rise(l1, t, 24.65, .1, .6); rise(l2, t, 24.95, .1, .65); rise(k, t, 25.45, .03, .6);
    ch.forEach((c, i) => { const p = P(t, 25.8 + i * .14, 26.3 + i * .14, E.outBack); S(c, { opacity: P(t, 25.8 + i * .14, 26 + i * .14), transform: `translateY(${(1 - p) * 26}px) scale(${lerp(.9, 1, p)})` }); });
    const pp = P(t, 26.4, 27.0, E.outBack); S(pill, { opacity: P(t, 26.4, 26.6), transform: `scale(${lerp(.8, 1, pp)})` });
    S(url, { opacity: P(t, 26.75, 27.2), transform: `translateX(${(1 - P(t, 26.75, 27.3, E.outQuint)) * 24}px)` });
    S(black, { opacity: P(t, 29.35, 30, E.inOutCubic) });
  };
}

function dust() {
  const layer = el(stage, 'full', { pointerEvents: 'none', zIndex: 5 });
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ps = [...Array(70)].map(() => {
    const z = rnd(), sz = 2 + z * 6;
    const d = el(layer, 'abs', { width: sz + 'px', height: sz + 'px', borderRadius: '50%', background: rnd() > .35 ? '#e8b38a' : '#fff3e6',
      filter: `blur(${(1 - z) * 2.5 + (z > .85 ? 2 : 0)}px)` });
    return { d, x: rnd() * 1920, y: rnd() * 1080, z, ph: rnd() * 6.28, sp: 14 + z * 46, op: .12 + z * .38 };
  });
  return t => ps.forEach(p => {
    const y = ((p.y - t * p.sp) % 1180 + 1180) % 1180 - 50, x = p.x + Math.sin(t * .6 + p.ph) * 18 * p.z;
    const fade = Math.min(1, t / 1.2) * (1 - P(t, 29.3, 30));
    S(p.d, { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, opacity: (p.op * fade * (.75 + .25 * Math.sin(t * 2 + p.ph))).toFixed(3) });
  });
}

let painters = [];
window.setup = async () => {
  stage.innerHTML = '';
  painters = [sceneA(), sceneB(), sceneC(), sceneD(), sceneE(), sceneF(), sceneG(), dust()];
  await document.fonts.ready;
  await Promise.all([...stage.querySelectorAll('img')].map(i => i.decode().catch(() => console.error('img failed ' + i.src))));
  painters.forEach(p => p(0));
  return 30;
};
window.seek = t => painters.forEach(p => p(t));
})();
