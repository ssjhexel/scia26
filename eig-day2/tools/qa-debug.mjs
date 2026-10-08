import { chromium } from '/home/user/scia26/motion/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); const errs = [];
p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => errs.push(m.type() + ' ' + m.text()));
p.on('requestfailed', r => errs.push('RF ' + r.url() + ' ' + r.failure()?.errorText));
await p.goto('http://127.0.0.1:8765/watch.html?devvideos=1', { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
console.log(JSON.stringify(await p.evaluate(() => ({ cls: document.querySelector('[data-player]').className, soonHidden: document.querySelector('[data-soon]').hidden, hls: !!window.Hls, sup: window.Hls && Hls.isSupported(), mse: window.MediaSource && MediaSource.isTypeSupported('video/mp4; codecs="avc1.640028,mp4a.40.2"'), canMp4: document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"'), src: document.querySelector('.eo-player video').currentSrc, watchHidden: document.querySelector('[data-watch]').hidden }))), errs.slice(0, 15));
await b.close();
