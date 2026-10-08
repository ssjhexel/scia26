/*
 * EIG Day 2 On-Demand — access control (front-end side).
 *
 * gated: false (test mode)  -> everyone has access.
 * gated: true               -> access requires the `eigod_ok` marker cookie, which the server sets
 *                              alongside the HttpOnly `eigod_access` cookie after verifying a Stripe
 *                              Checkout Session (see wordpress/eigod-access.php.example).
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

  /* Called on the watch page. Resolves true when the viewer may watch. */
  function requireAccess() {
    if (hasAccess()) return Promise.resolve(true);
    var params = new URLSearchParams(location.search);
    var sessionId = params.get('session_id');
    if (sessionId && cfg.verifyEndpoint) {
      // Returning from Stripe: ask the server to verify the Checkout Session and set the cookies.
      return fetch(cfg.verifyEndpoint + '?session_id=' + encodeURIComponent(sessionId), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { ok: false }; })
        .then(function (res) {
          if (res && res.ok) {
            params.delete('session_id');
            history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
            return true;
          }
          return deny();
        })
        .catch(deny);
    }
    return Promise.resolve(deny());
  }

  function deny() {
    location.href = (cfg.salesUrl || 'index.html') + '#eo-pricing';
    return false;
  }

  function buyUrl() { return cfg.stripePaymentLink || '#eo-pricing'; }

  window.EIGAccess = { hasAccess: hasAccess, requireAccess: requireAccess, buyUrl: buyUrl, testMode: !cfg.gated };
})();
