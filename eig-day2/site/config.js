/*
 * EIG Day 2 On-Demand — site configuration.
 * Everything a non-developer should need to change lives here.
 */
window.EIGOD_CONFIG = {
  // Pricing (shown on the page; the real charge is whatever the Stripe Payment Link is set to)
  price: 149,
  currency: 'USD',
  priceNote: 'One-time payment',
  accessTerm: '12 months',

  // Stripe Payment Link (Dashboard → Payment Links). Set its "After payment" redirect to:
  //   https://consultingeig.com/<watch-page>/?session_id={CHECKOUT_SESSION_ID}
  stripePaymentLink: 'https://buy.stripe.com/test_XXXXXXXXXXXX',

  // Gating. false = test mode: everything is viewable, no purchase needed.
  // true  = the watch page and video files require access (see wordpress/README.md).
  gated: false,
  // Optional endpoint that verifies a Stripe Checkout Session and sets the access cookie
  // (example mu-plugin: wordpress/eigod-access.php.example). Used only when gated: true.
  verifyEndpoint: '/wp-json/eigod/v1/verify',

  // Where assets live. '' = relative to this page (local preview).
  // On WordPress, e.g. '/wp-content/uploads/eig-ondemand/'
  assetBase: '',
  // Where the encoded HLS videos live: <videoBase>/<talk id>/master.m3u8
  videoBase: 'videos',

  // Optional trailer (HLS or MP4). null = branded "coming soon" frame.
  trailer: null,

  // Pages
  salesUrl: 'index.html',
  watchUrl: 'watch.html',

  contactEmail: 'jdevries@consultingeig.com',
  conferenceUrl: 'https://consultingeig.com/austinsummit2026/'
};

// WordPress (or any host) can override any of the above without editing this file: define
// window.EIGOD_OVERRIDES = { assetBase: '/wp-content/uploads/eig-ondemand/', ... } in a script that runs
// before this one. The WordPress page templates in wordpress/templates/ do exactly that.
if (window.EIGOD_OVERRIDES) Object.assign(window.EIGOD_CONFIG, window.EIGOD_OVERRIDES);
