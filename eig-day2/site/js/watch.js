/* EIG Day 2 On-Demand — watch / library page */
(function () {
  var root = document.getElementById('eigod');
  if (!root) return;
  root.classList.add('eo-js');
  var cfg = window.EIGOD_CONFIG || {};
  var talks = window.EIG_TALKS || [];
  var people = window.EIG_SPEAKERS || {};
  var blocks = window.EIG_BLOCKS || [];
  var base = cfg.assetBase || '';
  // Local QA only: ?devvideos=1 plays the dummy stream in _dev/videos (not deployed).
  if (/[?&]devvideos=1/.test(location.search)) {
    cfg.videoBase = '_dev/videos';
    if (talks[0]) talks[0].chapters = [{ t: 0, title: 'Welcome' }, { t: 6, title: 'The problem and the gap' }, { t: 13, title: 'How EIG closes it' }];
  }
  var $ = function (s) { return root.querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var photo = function (id) { return (window.EIGOD_INLINE && EIGOD_INLINE[id]) || base + 'assets/speakers/' + id + '.webp'; };
  var mmss = function (sec) { sec = Math.round(sec); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; };
  var store = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

  root.querySelectorAll('[data-sales]').forEach(function (a) { a.href = cfg.salesUrl || 'index.html'; });
  if (!cfg.gated) $('[data-testbadge]').hidden = false;

  EIGAccess.requireAccess().then(function (ok) { if (ok) start(); });

  function start() {
    $('[data-watch]').hidden = false;
    var total = talks.reduce(function (a, t) { return a + t.durationSec; }, 0), m = Math.round(total / 60);
    $('[data-list-meta]').textContent = talks.length + ' sessions · ' + Math.floor(m / 60) + ' h ' + (m % 60) + ' m';

    var player = EIGPlayer.create($('[data-player]'), {
      getNext: function (t) { var i = talks.indexOf(t); return talks[i + 1] || null; },
      onNext: function (n) { open(n, true); },
      onProgress: function (t, p) { var bar = root.querySelector('[data-bar="' + t.id + '"]'); if (bar) bar.style.width = (p * 100) + '%'; },
      onTime: function (t, sec) { markChapter(t, sec); }
    });

    /* playlist */
    $('[data-list]').innerHTML = blocks.map(function (b) {
      var list = talks.filter(function (t) { return t.block === b.id; });
      return '<div class="eo-list-group">' + esc(b.title) + '</div>' + list.map(function (t) {
        var n = talks.indexOf(t) + 1, prog = Math.min(1, +store('eigod:prog:' + t.id) || 0);
        var who = t.speakers.map(function (s) { return (people[s.id] || {}).name || s.id; }).join(', ');
        return '<button class="eo-item" data-item="' + t.id + '"><span class="eo-item-n">' + (n < 10 ? '0' : '') + n + '</span><span>' +
          '<span class="eo-item-t">' + esc(t.title) + '</span><span class="eo-item-s">' + esc(who) + ' · ' + mmss(t.durationSec) + (t.partial ? ' · partial' : '') + '</span>' +
          '<span class="eo-item-bar"><i data-bar="' + t.id + '" style="width:' + (prog * 100) + '%"></i></span></span></button>';
      }).join('');
    }).join('');
    $('[data-list]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-item]'); if (!b) return;
      var t = talks.filter(function (x) { return x.id === b.getAttribute('data-item'); })[0];
      if (t) { open(t, true); if (window.innerWidth < 980) $('[data-player]').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });

    function open(t, autoplay) {
      root.querySelectorAll('[data-item]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-item') === t.id); });
      var n = talks.indexOf(t) + 1;
      $('[data-now-meta]').innerHTML = '<span class="eo-tag">' + esc(t.track) + '</span>' + (t.partial ? '<span class="eo-tag is-quiet">Partial recording</span>' : '') +
        '<span>Session ' + n + ' of ' + talks.length + '</span><span>·</span><span>' + esc(t.time) + ' CT</span><span>·</span><span>' + mmss(t.durationSec) + '</span>';
      $('[data-now-title]').textContent = t.title;
      $('[data-now-people]').innerHTML = '<span class="eo-avs">' + t.speakers.map(function (s) { return '<img src="' + photo(s.id) + '" alt="" width="32" height="32">'; }).join('') + '</span>' +
        '<span class="eo-people-names">' + t.speakers.map(function (s) { var p = people[s.id] || {}; return esc(p.name || s.id) + (s.note ? ' <em>(' + esc(s.note.toLowerCase()) + ')</em>' : ''); }).join(', ') + '</span>';
      $('[data-now-summary]').textContent = t.summary;
      var tk = $('[data-now-takeaways]');
      tk.hidden = !(t.takeaways && t.takeaways.length);
      tk.innerHTML = (t.takeaways || []).map(function (x) { return '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.5l4.5 4.5L19.5 7"/></svg>' + esc(x) + '</li>'; }).join('');
      $('[data-now-speakers]').innerHTML = t.speakers.map(function (s) { var p = people[s.id] || {}; return '<li><img src="' + photo(s.id) + '" alt="" width="40" height="40"><span><b>' + esc(p.name || s.id) + '</b><span>' + esc(p.role || '') + '</span></span></li>'; }).join('');
      var ch = $('[data-now-chapters]');
      ch.innerHTML = (t.chapters && t.chapters.length)
        ? t.chapters.map(function (c, i) { return '<button data-t="' + c.t + '" data-ci="' + i + '"><span>' + EIGPlayer.fmt(c.t) + '</span>' + esc(c.title) + '</button>'; }).join('')
        : '<p class="eo-empty">Chapters arrive with the final edit.</p>';
      ch.onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) player.seekTo(+b.getAttribute('data-t')); };
      document.title = t.title + ' · Day 2 On Demand · EIG';
      var url = new URL(location.href); url.searchParams.set('talk', t.slug); history.replaceState(null, '', url);
      store('eigod:last', t.id);
      player.load(t, { autoplay: !!autoplay });
    }
    function markChapter(t, sec) {
      var btns = root.querySelectorAll('[data-now-chapters] [data-t]'), on = -1;
      btns.forEach(function (b, i) { if (+b.getAttribute('data-t') <= sec) on = i; });
      btns.forEach(function (b, i) { b.classList.toggle('is-on', i === on); });
    }

    var want = new URLSearchParams(location.search).get('talk'), last = store('eigod:last');
    var first = talks.filter(function (t) { return t.slug === want; })[0] || talks.filter(function (t) { return t.id === last; })[0] || talks[0];
    open(first, false);
  }
})();
