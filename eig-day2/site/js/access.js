/*
 * EIG Day 2 On-Demand — access control (front-end side).
 *
 * gated: false (test mode)  -> everyone has access.
 * gated: true               -> access requires the `eigod_ok` marker cookie, which the server sets
 *                              alongside the HttpOnly `eigod_access` cookie after verifying a Stripe
 *                              Checkout Session, or after a "Restore access" email link
 *                              (see wordpress/eigod-access.php.example). Access is lifetime.
 *
 * The real protection is server-side: the .htaccess on the videos folder refuses any request without
 * the HttpOnly cookie, so copying a video URL out of the page doesn't help anyone.
 * This module only decides what to SHOW. Never put Stripe secret keys in front-end code.
 */
(function () {
  var cfg = window.EIGOD_CONFIG || {};

  function readCookie(name) {
    try {
      var m = document.cookie.match('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)');
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }

  function hasAccess() {
    if (!cfg.gated) return true;
    return readCookie('eigod_ok') === '1';
  }

  var api = (cfg.verifyEndpoint || '/wp-json/eigod/v1/verify').replace(/\/verify$/, '');
  function call(url, opts) {
    return fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}))
      .then(function (r) { return r.ok ? r.json() : { ok: false }; })
      .catch(function () { return { ok: false }; });
  }
  function dropParam(params, name) {
    params.delete(name);
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  }

  /* Called on the watch page. Resolves true when the viewer may watch. */
  function requireAccess() {
    var params = new URLSearchParams(location.search);
    if (hasAccess()) {
      // lifetime access: keep the cookie fresh on every visit (browsers cap cookies at ~400 days)
      if (cfg.gated) call(api + '/refresh');
      return Promise.resolve(true);
    }
    var sessionId = params.get('session_id'), restore = params.get('restore');
    if (sessionId) {
      // Returning from Stripe: ask the server to verify the Checkout Session and set the cookies.
      return call(api + '/verify?session_id=' + encodeURIComponent(sessionId)).then(function (res) {
        if (res.ok) { dropParam(params, 'session_id'); return true; }
        return deny();
      });
    }
    if (restore) {
      // One-time sign-in link from a "Restore access" email.
      return call(api + '/redeem?token=' + encodeURIComponent(restore)).then(function (res) {
        if (res.ok) { dropParam(params, 'restore'); return true; }
        return deny('#eo-restore-expired');
      });
    }
    return Promise.resolve(deny());
  }

  /* "Restore access": emails a sign-in link to a buyer. Always resolves the same way. */
  function restoreAccess(email) {
    var back = cfg.watchUrl && /^https?:/.test(cfg.watchUrl) ? cfg.watchUrl : new URL(cfg.watchUrl || 'watch.html', location.href).href;
    return call(api + '/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, back: back }) });
  }

  function deny(hash) {
    location.href = (cfg.salesUrl || 'index.html') + (hash || '#eo-pricing');
    return false;
  }

  function buyUrl() { return cfg.stripePaymentLink || '#eo-pricing'; }

  window.EIGAccess = { hasAccess: hasAccess, requireAccess: requireAccess, restoreAccess: restoreAccess, buyUrl: buyUrl, testMode: !cfg.gated };
})();
