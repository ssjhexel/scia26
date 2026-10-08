# Deploying Day 2 On-Demand on consultingeig.com (WordPress on KnownHost)

The site is plain HTML/CSS/JS with no build step and no plugins required. Videos are self-hosted on the same server as HLS adaptive streams.

## 1. Upload the files

Upload the contents of `site/`, except `_dev/`, `_screens/` and `wordpress/`, to:

```
/wp-content/uploads/eig-ondemand/
  config.js   data/   css/   js/   assets/
  videos/            ← the encoded talks go here (step 4)
```

Use cPanel File Manager, SFTP, or a plugin like WP File Manager. Uploading through the Media Library won't keep the folder structure.

## 2. Create the two pages

| Page | Suggested URL | Template | Content |
|---|---|---|---|
| Sales page | `/day-2-on-demand/` | Full width or "blank / canvas" (no sidebar, no title) | Custom HTML block containing `sales-embed.html` |
| Watch library | `/day-2-on-demand/watch/` | Same | Custom HTML block containing `watch-embed.html` |

- **Content:** paste the whole file into a single **Custom HTML** block. In Elementor, use an HTML widget in a full-width section.
- **Different URLs or folder?** Regenerate the embeds:
  `python3 tools/make-embeds.py /wp-content/uploads/eig-ondemand/ /day-2-on-demand/ /day-2-on-demand/watch/`
- **Indexing:** set the watch page to *noindex* in your SEO plugin.
- **Theme safety:** everything is scoped under `.eigod`, so the page won't change your theme and the theme won't change the page. We tested it against an aggressively styled mock theme.

## 3. Connect Stripe

1. In the Stripe Dashboard, create a **Product**, "Day 2 On-Demand Pass", with a one-time price.
2. Create a **Payment Link** for it. Under *After payment*, choose **Don't show confirmation page** and redirect to:
   `https://consultingeig.com/day-2-on-demand/watch/?session_id={CHECKOUT_SESSION_ID}`
3. Paste the link into `config.js` → `stripePaymentLink`, and set `price` to match. The page displays the price; Stripe charges whatever the Payment Link says.

Every "Get access" button now goes to Stripe Checkout. Stripe emails the receipt.

## 4. Videos

Each talk lives in its own folder:

```
videos/09/master.m3u8        ← adaptive playlist (1080p / 720p / 480p)
videos/09/1080p/…  720p/…  480p/…
videos/09/poster.jpg
videos/09/captions.vtt       ← optional
```

- **How it plays:** the player streams adaptively. Safari and iOS play HLS natively; other browsers use the bundled `js/vendor/hls.light.min.js`. Talks whose files aren't uploaded yet show a branded "Video arriving soon" frame instead of an error.
- **Storage:** about 10–12 GB for all 11 talks (3 h 20 m) at three qualities.
- **Bandwidth:** about 2 GB per viewer-hour at 1080p, less on smaller screens thanks to adaptive streaming. A buyer who watches everything uses roughly 3–7 GB. Check the bandwidth allowance on your KnownHost plan; it's the only cost that grows with sales.
- **Overflow option:** Cloudflare R2's free tier (10 GB storage, no egress fees) can hold the same folder. Point `videoBase` at the R2 URL; nothing else changes.

## 5. Turn on gating (when you're ready to sell)

The test build has `gated: false`, so everything is open. To lock it down:

1. **Install the access plugin.** Copy `eigod-access.php.example` to `wp-content/mu-plugins/eigod-access.php` and follow the setup comment at the top. That covers the Stripe secret key in `wp-config.php` and a shared secret file kept above the web root.
2. **Install the video gate.** In `wp-content/uploads/eig-ondemand/videos/`, add `gate.php` (from `videos-gate.php.example`) and `.htaccess` (from `videos.htaccess.example`).
3. **Switch it on.** Set `gated: true` in `config.js`.

**How it works:**
- **Checkout to library:** Stripe sends the buyer back with a `session_id`. The plugin verifies it server-side with Stripe's API, then sets an HttpOnly signed cookie valid for 12 months.
- **The cookie:** the watch page and every video file check it. A copied video link doesn't work without it.
- **Per-browser access:** access belongs to the browser that bought. A buyer on a new device can email you for access.

**If you want accounts instead:** use a membership plugin with Stripe built in (Paid Memberships Pro, MemberPress or WP Simple Pay) to protect the watch page, and set the same cookie on login.

**Limits of the protection:** like any non-DRM streaming, this stops casual link-sharing, but not screen recording.

## 6. Test checklist

- [ ] Sales page renders full-width, with no theme header or title overlapping the hero.
- [ ] "Get access" opens Stripe Checkout (use test mode and card `4242 4242 4242 4242`).
- [ ] After payment you land on the watch page, the first talk loads, and the playlist works.
- [ ] Videos play on an iPhone (Safari) and in Chrome on desktop. The quality menu shows on desktop.
- [ ] With gating on: in a private window, a video URL returns 403.
