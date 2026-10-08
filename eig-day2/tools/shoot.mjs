// Screenshot pages at several widths: node tools/shoot.mjs <url-path> <name> [widths...]
import { chromium } from '/home/user/scia26/motion/node_modules/playwright-core/index.mjs';
const [, , pathArg = 'index.html', name = 'sales', ...ws] = process.argv;
const widths = ws.length ? ws.map(Number) : [1440, 768, 390];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const w of widths) {
  const ctx = await b.newContext({ viewport: { width: w, height: w > 800 ? 900 : 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8765/' + pathArg, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    document.querySelectorAll('img[loading=lazy]').forEach(i => i.loading = 'eager');
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    await document.fonts.ready;
  });
  await p.waitForTimeout(400);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  await p.screenshot({ path: `/home/user/scia26/eig-day2/site/_screens/${name}-${w}.png`, fullPage: true });
  console.log(name, w, 'scrollWidth', sw, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'ok');
  await ctx.close();
}
await b.close();
