/*
 * EIG Day 2 On-Demand — video player.
 * Providers:
 *   hls  — self-hosted HLS (master.m3u8). Native on Safari/iOS; elsewhere hls.js is loaded on demand
 *          from js/vendor/hls.light.min.js (bundled, no third-party CDN).
 *   file — a plain MP4.
 * When a talk's video isn't uploaded yet (manifest missing), the player shows a branded
 * "arriving soon" frame instead of an error.
 */
(function () {
  var cfg = window.EIGOD_CONFIG || {};
  var base = cfg.assetBase || '';
  var hlsLoading = null;

  function joinUrl(dir, p) {
    if (!p) return '';
    if (/^(https?:)?\/\//.test(p) || p.charAt(0) === '/') return p;
    return (dir ? dir.replace(/\/$/, '') + '/' : '') + p;
  }
  function videoUrl(p) {
    var vb = cfg.videoBase || 'videos';
    if (!/^(https?:)?\/\//.test(vb) && vb.charAt(0) !== '/') vb = base + vb;
    return joinUrl(vb, p);
  }
  function fmt(t) {
    t = Math.max(0, Math.floor(t || 0));
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function loadHlsJs() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsLoading) return hlsLoading;
    hlsLoading = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = base + 'js/vendor/hls.light.min.js';
      s.onload = function () { res(window.Hls); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return hlsLoading;
  }
  function probe(url) {
    if (!url) return Promise.resolve(false);
    return fetch(url, { method: 'HEAD', credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; });
  }
  var I = {
    play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4"/><text x="12" y="15.5" font-size="7" font-family="Inter Tight, sans-serif" font-weight="700" text-anchor="middle" fill="currentColor">10</text></svg>',
    fwd: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4"/><text x="12" y="15.5" font-size="7" font-family="Inter Tight, sans-serif" font-weight="700" text-anchor="middle" fill="currentColor">10</text></svg>',
    vol: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
    cc: '<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M10.5 10.3a2.2 2.2 0 1 0 0 3.4M16.5 10.3a2.2 2.2 0 1 0 0 3.4"/></svg>',
    fs: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>',
    fsx: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>'
  };

  function img(file, key) { return (window.EIGOD_INLINE && EIGOD_INLINE[key]) || base + 'assets/img/' + file; }

  function create(el, opts) {
    opts = opts || {};
    el.classList.add('eo-player');
    el.setAttribute('tabindex', '0');
    el.innerHTML =
      '<video playsinline preload="metadata" crossorigin="anonymous"></video>' +
      '<div class="eo-poster is-soon" data-soon hidden><img src="' + img('glass-1200.webp', '__glass') + '" alt=""><div class="eo-poster-in">' +
        '<img class="eo-poster-mark" src="' + img('eig-mark.webp', '__mark') + '" alt="" width="86" height="94">' +
        '<span class="eo-poster-title" data-soon-title></span><span class="eo-poster-sub" data-soon-sub>Video arriving soon</span></div></div>' +
      '<button class="eo-p-big" data-big aria-label="Play"><span class="eo-play">' + I.play + '</span></button>' +
      '<div class="eo-p-next" data-next><div><small>Up next</small><b data-next-title></b></div><button class="eo-btn eo-btn-primary" data-next-go>Play <span data-next-count></span></button></div>' +
      '<div class="eo-p-chrome" data-chrome>' +
        '<div class="eo-p-scrub" data-scrub role="slider" aria-label="Seek" tabindex="0" aria-valuemin="0">' +
          '<div class="eo-p-track"><div class="eo-p-buf" data-buf></div><div class="eo-p-fill" data-fill></div><div data-ticks></div><div class="eo-p-knob" data-knob></div></div>' +
          '<div class="eo-p-tip" data-tip></div></div>' +
        '<div class="eo-p-bar">' +
          '<button class="eo-p-btn" data-play aria-label="Play">' + I.play + '</button>' +
          '<button class="eo-p-btn" data-back aria-label="Back 10 seconds">' + I.back + '</button>' +
          '<button class="eo-p-btn" data-fwd aria-label="Forward 10 seconds">' + I.fwd + '</button>' +
          '<span class="eo-p-volwrap"><button class="eo-p-btn" data-mute aria-label="Mute">' + I.vol + '</button>' +
            '<span class="eo-p-vol"><input type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume" data-vol></span></span>' +
          '<span class="eo-p-time" data-time>0:00 / 0:00</span>' +
          '<span class="eo-p-sp"></span>' +
          '<span class="eo-p-menuwrap"><button class="eo-p-pill" data-speed-btn aria-haspopup="true">1×</button><div class="eo-p-menu" data-speed-menu></div></span>' +
          '<span class="eo-p-menuwrap" data-q-wrap hidden><button class="eo-p-pill" data-q-btn aria-haspopup="true">Auto</button><div class="eo-p-menu" data-q-menu></div></span>' +
          '<button class="eo-p-btn" data-cc aria-label="Captions" hidden>' + I.cc + '</button>' +
          '<button class="eo-p-btn" data-fs aria-label="Full screen">' + I.fs + '</button>' +
        '</div></div>';

    var q = function (s) { return el.querySelector(s); };
    var v = q('video'), scrub = q('[data-scrub]'), fill = q('[data-fill]'), buf = q('[data-buf]'), knob = q('[data-knob]'), tip = q('[data-tip]');
    var playBtn = q('[data-play]'), timeEl = q('[data-time]'), soon = q('[data-soon]'), ticks = q('[data-ticks]');
    var hls = null, talk = null, dur = 0, idleT = null, saveT = 0, nextT = null, ready = false;

    /* speed menu */
    var speeds = [0.75, 1, 1.25, 1.5, 1.75, 2], sm = q('[data-speed-menu]'), sb = q('[data-speed-btn]');
    sm.innerHTML = speeds.map(function (s) { return '<button data-s="' + s + '"' + (s === 1 ? ' class="is-on"' : '') + '>' + s + '×</button>'; }).join('');
    sm.addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; setSpeed(+b.getAttribute('data-s')); sm.classList.remove('is-open'); });
    sb.addEventListener('click', function (e) { e.stopPropagation(); sm.classList.toggle('is-open'); q('[data-q-menu]').classList.remove('is-open'); });
    function setSpeed(s) { v.playbackRate = s; sb.textContent = s + '×'; [].forEach.call(sm.children, function (b) { b.classList.toggle('is-on', +b.getAttribute('data-s') === s); }); store('eigod:speed', s); }

    /* quality menu (hls.js only) */
    var qm = q('[data-q-menu]'), qb = q('[data-q-btn]'), qw = q('[data-q-wrap]');
    qb.addEventListener('click', function (e) { e.stopPropagation(); qm.classList.toggle('is-open'); sm.classList.remove('is-open'); });
    qm.addEventListener('click', function (e) {
      var b = e.target.closest('[data-l]'); if (!b || !hls) return;
      var l = +b.getAttribute('data-l'); hls.currentLevel = l; qb.textContent = l < 0 ? 'Auto' : b.textContent;
      [].forEach.call(qm.children, function (x) { x.classList.toggle('is-on', x === b); }); qm.classList.remove('is-open');
    });
    document.addEventListener('click', function () { sm.classList.remove('is-open'); qm.classList.remove('is-open'); });

    /* transport */
    function toggle() { if (!ready) return; if (v.paused) v.play(); else v.pause(); }
    playBtn.addEventListener('click', toggle);
    q('[data-big]').addEventListener('click', toggle);
    v.addEventListener('click', toggle);
    q('[data-back]').addEventListener('click', function () { seek(v.currentTime - 10); });
    q('[data-fwd]').addEventListener('click', function () { seek(v.currentTime + 10); });
    function seek(t) { if (!ready) return; v.currentTime = Math.max(0, Math.min((dur || v.duration || 0) - 0.2, t)); }
    var muteBtn = q('[data-mute]'), vol = q('[data-vol]');
    muteBtn.addEventListener('click', function () { v.muted = !v.muted; });
    vol.addEventListener('input', function () { v.volume = +vol.value; v.muted = v.volume === 0; });
    v.addEventListener('volumechange', function () { muteBtn.innerHTML = v.muted || v.volume === 0 ? I.mute : I.vol; vol.value = v.muted ? 0 : v.volume; });
    v.addEventListener('play', function () { el.classList.add('is-playing'); playBtn.innerHTML = I.pause; playBtn.setAttribute('aria-label', 'Pause'); hideNext(); poke(); });
    v.addEventListener('pause', function () { el.classList.remove('is-playing'); playBtn.innerHTML = I.play; playBtn.setAttribute('aria-label', 'Play'); save(true); });
    v.addEventListener('loadedmetadata', function () {
      dur = v.duration || (talk && talk.durationSec) || 0; scrub.setAttribute('aria-valuemax', Math.round(dur)); drawTicks(); paint();
      var saved = +store('eigod:pos:' + talk.id) || 0;
      if (saved > 10 && saved < dur - 15) v.currentTime = saved;
      var sp = +store('eigod:speed'); if (sp) setSpeed(sp);
    });
    v.addEventListener('timeupdate', function () { paint(); save(false); });
    v.addEventListener('progress', paint);
    v.addEventListener('ended', function () { store('eigod:prog:' + talk.id, '1'); store('eigod:pos:' + talk.id, '0'); if (opts.onProgress) opts.onProgress(talk, 1); showNext(); });

    function paint() {
      var d = dur || v.duration || 0, t = v.currentTime || 0, p = d ? t / d : 0;
      fill.style.width = (p * 100) + '%'; knob.style.left = (p * 100) + '%';
      try { if (v.buffered.length) buf.style.width = (v.buffered.end(v.buffered.length - 1) / d * 100) + '%'; } catch (e) {}
      timeEl.textContent = fmt(t) + ' / ' + fmt(d);
      scrub.setAttribute('aria-valuenow', Math.round(t)); scrub.setAttribute('aria-valuetext', fmt(t));
      if (opts.onTime) opts.onTime(talk, t);
    }
    function save(force) {
      var now = Date.now(); if (!force && now - saveT < 4000) return; saveT = now;
      if (!talk || !dur) return;
      store('eigod:pos:' + talk.id, v.currentTime.toFixed(1));
      var prev = +store('eigod:prog:' + talk.id) || 0, p = Math.min(1, v.currentTime / dur);
      if (p > prev) { store('eigod:prog:' + talk.id, p.toFixed(3)); if (opts.onProgress) opts.onProgress(talk, p); }
    }
    function drawTicks() {
      var d = dur || (talk && talk.durationSec) || 0;
      ticks.innerHTML = (talk && talk.chapters || []).filter(function (c) { return c.t > 0 && c.t < d; })
        .map(function (c) { return '<i class="eo-p-tick" style="left:' + (c.t / d * 100) + '%"></i>'; }).join('');
    }
    function chapterAt(t) { var c = null; (talk && talk.chapters || []).forEach(function (x) { if (x.t <= t) c = x; }); return c; }

    /* scrubbing */
    function posFrom(e) { var r = scrub.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); }
    scrub.addEventListener('pointerdown', function (e) {
      if (!ready) return; scrub.classList.add('is-drag'); scrub.setPointerCapture(e.pointerId); seek(posFrom(e) * dur);
      var mv = function (ev) { seek(posFrom(ev) * dur); };
      var up = function () { scrub.classList.remove('is-drag'); scrub.removeEventListener('pointermove', mv); scrub.removeEventListener('pointerup', up); };
      scrub.addEventListener('pointermove', mv); scrub.addEventListener('pointerup', up);
    });
    scrub.addEventListener('mousemove', function (e) {
      var p = posFrom(e), t = p * (dur || 0), c = chapterAt(t);
      tip.style.left = (p * 100) + '%'; tip.innerHTML = '<b>' + fmt(t) + '</b>' + (c ? c.title : '');
    });
    scrub.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { seek(v.currentTime - 5); e.preventDefault(); }
      if (e.key === 'ArrowRight') { seek(v.currentTime + 5); e.preventDefault(); }
    });

    /* captions */
    var ccBtn = q('[data-cc]');
    ccBtn.addEventListener('click', function () {
      var tr = v.textTracks[0]; if (!tr) return;
      tr.mode = tr.mode === 'showing' ? 'hidden' : 'showing'; ccBtn.style.color = tr.mode === 'showing' ? 'var(--copper-hi)' : ''; store('eigod:cc', tr.mode);
    });

    /* fullscreen */
    var fsBtn = q('[data-fs]');
    fsBtn.addEventListener('click', function () {
      if (document.fullscreenElement) return document.exitFullscreen();
      if (el.requestFullscreen) el.requestFullscreen(); else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    });
    document.addEventListener('fullscreenchange', function () { fsBtn.innerHTML = document.fullscreenElement ? I.fsx : I.fs; });

    /* idle chrome */
    function poke() { el.classList.remove('is-idle'); clearTimeout(idleT); idleT = setTimeout(function () { el.classList.add('is-idle'); }, 2600); }
    el.addEventListener('pointermove', poke); el.addEventListener('focusin', poke);

    /* keyboard */
    el.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key.toLowerCase(), handled = true;
      if (k === ' ' || k === 'k') toggle();
      else if (k === 'j') seek(v.currentTime - 10);
      else if (k === 'l') seek(v.currentTime + 10);
      else if (k === 'arrowleft' && e.target !== scrub) seek(v.currentTime - 5);
      else if (k === 'arrowright' && e.target !== scrub) seek(v.currentTime + 5);
      else if (k === 'f') fsBtn.click();
      else if (k === 'm') v.muted = !v.muted;
      else if (k === 'c') ccBtn.click();
      else handled = false;
      if (handled) { e.preventDefault(); poke(); }
    });

    /* up next */
    var nextBox = q('[data-next]');
    function showNext() {
      var n = opts.getNext && opts.getNext(talk); if (!n) return;
      q('[data-next-title]').textContent = n.title; nextBox.classList.add('is-on');
      var c = 6, cnt = q('[data-next-count]'); cnt.textContent = 'in ' + c;
      clearInterval(nextT); nextT = setInterval(function () { c--; cnt.textContent = 'in ' + c; if (c <= 0) { clearInterval(nextT); opts.onNext && opts.onNext(n); } }, 1000);
    }
    function hideNext() { clearInterval(nextT); nextBox.classList.remove('is-on'); }
    q('[data-next-go]').addEventListener('click', function () { var n = opts.getNext && opts.getNext(talk); hideNext(); if (n && opts.onNext) opts.onNext(n); });

    /* load a talk */
    function teardown() {
      hideNext(); ready = false; el.classList.remove('is-ready', 'is-playing');
      if (hls) { hls.destroy(); hls = null; }
      v.pause(); v.removeAttribute('src'); while (v.firstChild) v.removeChild(v.firstChild); v.load();
      qw.hidden = true; ccBtn.hidden = true; fill.style.width = buf.style.width = '0%'; knob.style.left = '0%';
    }
    function showSoon(t) {
      soon.hidden = false; q('[data-soon-title]').textContent = t.title;
      q('[data-big]').hidden = true; q('[data-chrome]').hidden = true;
      q('[data-soon-sub]').textContent = 'Video arriving soon';
    }
    function unplayable(t) {
      showSoon(t);
      q('[data-soon-sub]').textContent = 'This browser can’t play this video. Try Chrome, Edge, Safari or Firefox.';
    }
    function load(t, o) {
      o = o || {}; teardown(); talk = t; dur = t.durationSec || 0; drawTicks(); paint();
      var vid = t.video || {}, src = videoUrl(vid.src), poster = vid.poster ? videoUrl(vid.poster) : '';
      return probe(src).then(function (ok) {
        if (talk !== t) return;
        if (!ok) { showSoon(t); return; }
        soon.hidden = true; q('[data-big]').hidden = false; q('[data-chrome]').hidden = false;
        if (poster) v.poster = poster; else v.removeAttribute('poster');
        if (vid.captions) {
          var tr = document.createElement('track'); tr.kind = 'captions'; tr.srclang = 'en'; tr.label = 'English'; tr.src = videoUrl(vid.captions);
          v.appendChild(tr); ccBtn.hidden = false;
          setTimeout(function () { if (v.textTracks[0]) v.textTracks[0].mode = store('eigod:cc') === 'showing' ? 'showing' : 'hidden'; }, 0);
        }
        var go = function () { ready = true; el.classList.add('is-ready'); if (o.autoplay) v.play().catch(function () {}); };
        var isHls = (vid.provider || 'hls') === 'hls';
        if (!isHls || v.canPlayType('application/vnd.apple.mpegurl')) { v.src = src; go(); return; }
        return loadHlsJs().then(function (Hls) {
          if (talk !== t) return;
          if (!Hls.isSupported()) { v.src = src; go(); return; }
          hls = new Hls({ capLevelToPlayerSize: true, startLevel: -1, maxBufferLength: 30, xhrSetup: function (x) { x.withCredentials = true; } });
          hls.on(Hls.Events.MANIFEST_PARSED, function (e, data) {
            var lv = data.levels.map(function (l, i) { return { i: i, h: l.height }; }).sort(function (a, b) { return b.h - a.h; });
            if (lv.length > 1) {
              qm.innerHTML = '<button data-l="-1" class="is-on">Auto</button>' + lv.map(function (l) { return '<button data-l="' + l.i + '">' + l.h + 'p</button>'; }).join('');
              qw.hidden = false; qb.textContent = 'Auto';
            }
            go();
          });
          var netRetries = 0;
          hls.on(Hls.Events.ERROR, function (e, d) {
            if (!d.fatal) return;
            if (d.details === 'manifestIncompatibleCodecsError') return unplayable(t);
            if (d.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries++ < 3) hls.startLoad();
            else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else unplayable(t);
          });
          hls.loadSource(src); hls.attachMedia(v);
        }).catch(function () { showSoon(t); });
      });
    }
    function seekTo(t) { if (ready) { v.currentTime = t; v.play().catch(function () {}); el.focus({ preventScroll: true }); } }

    return { load: load, seekTo: seekTo, video: v, fmt: fmt, el: el };
  }

  window.EIGPlayer = { create: create, fmt: fmt, videoUrl: videoUrl };
})();
