# Deploying Day 2 On-Demand on consultingeig.com (WordPress on KnownHost)

Two standalone page templates, with no plugins and no page builder. Videos are self-hosted on the same server as HLS adaptive streams.

## 1. Install the two page templates

`templates/` holds two **standalone page templates**:

| File | Template name | Suggested page |
|---|---|---|
| `eig-day2-on-demand.php` | EIG Day 2 On-Demand Sales | `/day-2-on-demand/` |
| `eig-day2-on-demand-watch.php` | EIG Day 2 On-Demand Watch | `/day-2-on-demand/watch/` (a child page of the sales page) |

1. **Upload both files** to your active theme's folder, `wp-content/themes/<your-theme>/`, using cPanel File Manager or SFTP. If your theme gets updates, use a child theme so the files aren't wiped.
2. **Create each page:** go to *Pages → Add New*, add a title, choose the template under *Page Attributes → Template*, and publish. Leave the content empty; the template doesn't use the editor.
3. **That's it.** Each template prints its own complete page, so your theme's header, footer and stylesheet never load and can't interfere. Fonts, images and scripts are all inside the file. The two pages find each other's addresses automatically.

**Settings** sit at the top of each file: video folder, gating on/off, and price, currency and Stripe link (sales template only). Keep `gated` the same in both files.

- **Analytics or pixel plugins:** these need WordPress's hooks. Set `$eigod_wp_hooks = true` and the page runs `wp_head()`/`wp_footer()`. That also loads your theme's CSS; the page is built to withstand it, but off is cleanest.
- **SEO:** set the watch page to *noindex* (it already sends a noindex tag).
- **Changing copy, speakers or sessions:** edit `site/` and rebuild with `python3 tools/make-wp-templates.py`, then re-upload.

## 2. Upload the videos

The encoded talks go in `wp-content/uploads/eig-ondemand/videos/`, one folder per talk; the layout is in step 4. There are two ways to get them there:

- **One-time receiver (recommended):**
  1. Upload `eigod-receive.php` (supplied separately; it holds a private key) to `wp-content/uploads/eig-ondemand/`.
  2. The files are pushed over HTTPS with `deploy/push.py`. The receiver only accepts the talk video files, only with its key, and stops working after 48 hours.
  3. **Delete it when the upload is done.**

  It also writes a small `videos/.htaccess` that sets the correct streaming file types and turns off folder listing.
- **By hand:** zip each talk folder, upload the zip with cPanel File Manager, and extract it in place.

Optionally, add a 1200×630 sharing image at `wp-content/uploads/eig-ondemand/og-image.jpg`.

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
