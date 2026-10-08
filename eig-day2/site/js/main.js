/* EIG Day 2 On-Demand — sales page */
(function () {
  var root = document.getElementById('eigod');
  if (!root) return;
  root.classList.add('eo-js');

  var cfg = window.EIGOD_CONFIG || {};
  var talks = window.EIG_TALKS || [];
  var people = window.EIG_SPEAKERS || {};
  var blocks = window.EIG_BLOCKS || [];
  var base = cfg.assetBase || '';
  var $ = function (s, el) { return (el || root).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- helpers ---------- */
  function photo(id) { return (window.EIGOD_INLINE && EIGOD_INLINE[id]) || base + 'assets/speakers/' + id + '.webp'; }
  function mmss(sec) { sec = Math.round(sec); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function hm(sec) { var m = Math.round(sec / 60); return Math.floor(m / 60) + ' h ' + (m % 60) + ' m'; }
  var symbols = { USD: '$', EUR: '€', GBP: '£', CAD: '$', AUD: '$' };
  var total = talks.reduce(function (a, t) { return a + t.durationSec; }, 0);

  /* ---------- config-driven text ---------- */
  var sym = symbols[cfg.currency] || '';
  var termParts = String(cfg.accessTerm || '12 months').split(' ');
  var fills = {
    priceLabel: sym + cfg.price, priceNum: String(cfg.price), currencySymbol: sym, currency: cfg.currency,
    priceNote: cfg.priceNote, accessTerm: cfg.accessTerm, accessNum: termParts[0],
    accessUnit: (termParts.slice(1).join(' ') || 'months').replace(/^\w/, function (c) { return c.toUpperCase(); }) + ' of access'
  };
  $$('[data-cfg]').forEach(function (el) { var v = fills[el.getAttribute('data-cfg')]; if (v != null) el.textContent = v; });
  $$('[data-runtime]').forEach(function (el) { el.textContent = hm(total); });
  var rb = $('[data-runtime-big]');
  if (rb) { var m = Math.round(total / 60); rb.innerHTML = Math.floor(m / 60) + '<small>h</small> ' + (m % 60) + '<small>m</small>'; }
  $$('[data-buy]').forEach(function (el) {
    el.href = window.EIGAccess ? EIGAccess.buyUrl() : cfg.stripePaymentLink;
    if (/^https?:/.test(el.href) && el.href.indexOf(location.host) === -1) el.rel = 'noopener';
  });
  $$('[data-mail]').forEach(function (el) { el.href = 'mailto:' + cfg.contactEmail; if (/@/.test(el.textContent)) el.textContent = cfg.contactEmail; });
  $$('[data-conf]').forEach(function (el) { if (cfg.conferenceUrl) el.href = cfg.conferenceUrl; });

  /* ---------- hero floating speakers ---------- */
  var fav = $('[data-float-avs]');
  if (fav) fav.innerHTML = ['jim-de-vries', 'jose-pires', 'leila-rao', 'greg-schlegel', 'hosni-adra']
    .map(function (id) { return '<img src="' + photo(id) + '" alt="" width="36" height="36">'; }).join('');

  /* ---------- trailer ---------- */
  var tr = $('[data-trailer]');
  if (tr && cfg.trailer) {
    $('[data-trailer-label]', tr).textContent = 'Watch the trailer';
    tr.href = (cfg.watchUrl || 'watch.html') + '?trailer=1';
  }

  /* ---------- programme ---------- */
  function names(t) {
    return t.speakers.map(function (s) {
      var p = people[s.id] || { name: s.id };
      return esc(p.name) + (s.note ? ' <em>(' + esc(s.note.toLowerCase()) + ')</em>' : '');
    }).join(', ').replace(/, ([^,]*)$/, ' &amp; $1');
  }
  function talkHtml(t) {
    var avs = t.speakers.map(function (s) { return '<img src="' + photo(s.id) + '" alt="" width="32" height="32" loading="lazy">'; }).join('');
    var roles = t.speakers.map(function (s) { var p = people[s.id] || {}; return '<b>' + esc(p.name || s.id) + '</b> · ' + esc(p.role || ''); }).join('<br>');
    var tk = (t.takeaways || []).length ? '<ul>' + t.takeaways.slice(0, 4).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
    var watch = (cfg.watchUrl || 'watch.html') + '?talk=' + encodeURIComponent(t.slug);
    var bid = 'eo-talk-' + t.id;
    return '<div class="eo-talk" data-reveal>' +
      '<button class="eo-talk-row" aria-expanded="false" aria-controls="' + bid + '">' +
        '<span class="eo-talk-time">' + esc(t.time) + '<span class="eo-talk-dur-m"> · ' + mmss(t.durationSec) + '</span></span>' +
        '<span class="eo-talk-main">' +
          '<span class="eo-talk-tags"><span class="eo-tag">' + esc(t.track) + '</span>' + (t.partial ? '<span class="eo-tag is-quiet">Partial recording</span>' : '') + '</span>' +
          '<span class="eo-talk-title">' + esc(t.title) + '</span>' +
          '<span class="eo-people"><span class="eo-avs">' + avs + '</span><span class="eo-people-names">' + names(t) + '</span></span>' +
        '</span>' +
        '<span class="eo-talk-dur">' + mmss(t.durationSec) + '</span>' +
        '<span class="eo-chev" aria-hidden="true"><svg><use href="#eo-i-plus"/></svg></span>' +
      '</button>' +
      '<div class="eo-talk-body" id="' + bid + '" role="region"><div><div class="eo-talk-detail">' +
        '<span></span>' +
        '<div><p>' + esc(t.summary) + '</p>' + (tk ? '<div style="margin-top:18px">' + tk + '</div>' : '') + '</div>' +
        '<div class="eo-talk-aside"><p class="eo-roles">' + roles + '</p>' +
          '<a class="eo-link" href="' + watch + '">Watch this session <svg aria-hidden="true"><use href="#eo-i-arrow"/></svg></a></div>' +
      '</div></div></div>' +
    '</div>';
  }
  var prog = $('[data-programme]');
  if (prog) {
    prog.innerHTML = blocks.map(function (b) {
      var list = talks.filter(function (t) { return t.block === b.id; });
      if (!list.length) return '';
      var dur = list.reduce(function (a, t) { return a + t.durationSec; }, 0);
      return '<div class="eo-block">' +
        '<div class="eo-block-head" data-reveal><h3 class="eo-h3"><small>' + esc(b.label) + '</small>' + esc(b.title) + '</h3>' +
        '<span>' + list.length + ' session' + (list.length > 1 ? 's' : '') + ' · ' + (dur >= 3600 ? hm(dur) : Math.round(dur / 60) + ' min') + '</span></div>' +
        list.map(talkHtml).join('') + '</div>';
    }).join('');
    $$('.eo-talk-row', prog).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.parentNode, open = !item.classList.contains('is-open');
        item.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  /* ---------- speakers ---------- */
  var spk = $('[data-speakers]');
  if (spk) {
    var order = [];
    talks.forEach(function (t) { t.speakers.forEach(function (s) { if (order.indexOf(s.id) < 0) order.push(s.id); }); });
    spk.innerHTML = order.map(function (id, i) {
      var p = people[id] || { name: id, role: '' };
      return '<figure class="eo-speaker" data-reveal style="--d:' + (i % 7) * 0.05 + 's">' +
        '<div class="eo-speaker-ph"><img src="' + photo(id) + '" alt="' + esc(p.name) + '" width="240" height="240" loading="lazy"></div>' +
        '<figcaption><b>' + esc(p.name) + '</b><span>' + esc(p.role) + '</span></figcaption></figure>';
    }).join('');
  }

  /* ---------- nav ---------- */
  var nav = $('[data-nav]');
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (nav) nav.classList.toggle('is-solid', y > 40);
    if (px && !reduce) px.style.setProperty('--py', Math.min(y * 0.18, 160).toFixed(1) + 'px');
  }
  var px = $('[data-parallax]');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- reveal ---------- */
  var items = $$('[data-reveal], [data-draw]');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('is-in'); });
  }
})();
