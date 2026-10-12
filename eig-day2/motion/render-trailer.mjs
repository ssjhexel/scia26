// Renders trailer.html frame by frame with headless Chromium.
//   node render-trailer.mjs sheet [t ...]   -> work/trailer/sheet.png (review)
//   node render-trailer.mjs full [workers]  -> work/trailer/video.mp4 (silent, 1080p25)
import { chromium } from '/home/user/scia26/motion/node_modules/playwright-core/index.mjs';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, '../work/trailer');
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FPS = 25, DUR = 30;
const [, , mode = 'sheet', ...args] = process.argv;

async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto('file://' + path.join(ROOT, 'trailer.html'));
  await page.evaluate(() => Promise.all(['400 40px "Instrument Serif"', 'italic 400 40px "Instrument Serif"', '400 20px "Inter Tight"', '500 20px "Inter Tight"', '600 20px "Inter Tight"'].map(f => document.fonts.load(f))));
  await page.evaluate(() => window.setup());
  return page;
}
const shot = (page, t) => page.evaluate(t => window.seek(t), t).then(() => page.locator('#stage').screenshot({ type: 'png' }));
const launch = () => chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });

if (mode === 'sheet') {
  const b = await launch(); const page = await open(b);
  const times = args.length ? args.map(Number) : [1, 2.6, 3.6, 4.4, 5.6, 7.0, 9.5, 11.0, 12.0, 13.5, 15.9, 16.7, 17.7, 18.7, 19.8, 21.0, 22.6, 24.1, 25.2, 27.5];
  const dir = path.join(OUT, '_sheet'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const [i, t] of times.entries()) fs.writeFileSync(path.join(dir, String(i).padStart(3, '0') + '.png'), await shot(page, t));
  const cols = 4, rows = Math.ceil(times.length / cols);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(dir, '*.png'), '-vf', `scale=640:-1,tile=${cols}x${rows}`, '-frames:v', '1', path.join(OUT, 'sheet.png')]);
  console.log('sheet', times.join(' '));
  await b.close();
} else if (mode === 'full') {
  const workers = +(args[0] || 3), N = DUR * FPS, per = Math.ceil(N / workers), t0 = Date.now();
  await Promise.all([...Array(workers)].map(async (_, w) => {
    const b = await launch(); const page = await open(b);
    const a = w * per, z = Math.min(N, a + per);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', path.join(OUT, `chunk${w}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < z; f++) {
      const buf = await shot(page, f / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (w === 0 && f % 50 === 0) console.log(`w0 ${f - a}/${z - a} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
  }));
  fs.writeFileSync(path.join(OUT, 'chunks.txt'), [...Array(workers)].map((_, w) => `file 'chunk${w}.mp4'`).join('\n'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'chunks.txt'), '-c', 'copy', path.join(OUT, 'video.mp4')]);
  console.log('video done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
