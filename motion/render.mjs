// Renders index.html frame by frame with headless Chromium.
//   node render.mjs sheet [t1 t2 ...]   -> build/sheet.png contact sheet (or one per beat if no times)
//   node render.mjs frame <t>           -> build/frame.png
//   node render.mjs sfx                 -> build/sfx.json (sound cue list for synth_sfx.py)
//   node render.mjs full [workers]      -> build/video.mp4 (silent), then mux.sh adds audio
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
// PAGE=winners.html BUILD=build-winners node render.mjs ...  renders the winners film (60 s, no timeline.json)
const PAGE = process.env.PAGE || 'index.html';
const BUILD = path.join(ROOT, process.env.BUILD || 'build');
const TL = PAGE === 'index.html' ? JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8')) : { fps: 30, duration: +(process.env.DUR || 60) };
const ENV = fs.existsSync(path.join(BUILD, 'env.json')) ? JSON.parse(fs.readFileSync(path.join(BUILD, 'env.json'), 'utf8')) : [];
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const [, , mode = 'sheet', ...args] = process.argv;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.addInitScript(`window.TL=${JSON.stringify(TL)};window.ENV=${JSON.stringify(ENV)};`);
  await page.goto('file://' + path.join(ROOT, PAGE));
  await page.evaluate(() => document.fonts.ready);
  // load every face up front: a worker that starts mid-film must measure text with the real fonts
  await page.evaluate(() => Promise.all(['800 100px "Barlow Condensed"', '700 100px "Barlow Condensed"', '400 20px Inter', '500 20px Inter',
    '600 20px Inter', '700 20px Inter', 'italic 500 20px Inter'].map(f => document.fonts.load(f))));
  await page.waitForFunction(() => typeof window.seek === 'function');
  return page;
}
const shoot = async (page, t) => { await page.evaluate(t => window.seek(t), t); return page.locator('#stage').screenshot({ type: 'png' }); };

const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--disable-web-security'] });
fs.mkdirSync(BUILD, { recursive: true });

if (mode === 'sfx') {
  const page = await openPage(browser);
  const s = await page.evaluate(() => window.getSfx());
  fs.writeFileSync(path.join(BUILD, 'sfx.json'), JSON.stringify(s, null, 1));
  console.log('sfx cues', s.length);
} else if (mode === 'range') {
  // re-render a frame range [a, b) to build/range.mp4 (for patching a section of the master)
  const page = await openPage(browser);
  const [a, b] = args.map(Number);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(TL.fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', path.join(BUILD, 'range.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) { const buf = await shoot(page, f / TL.fps); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
} else if (mode === 'frame') {
  const page = await openPage(browser);
  fs.writeFileSync(path.join(BUILD, 'frame.png'), await shoot(page, +args[0]));
} else if (mode === 'sheet') {
  const page = await openPage(browser);
  const times = args.length ? args.map(Number) : [...Array(Math.floor(TL.duration / 2))].map((_, i) => i * 2 + 1);
  const dir = path.join(BUILD, 'sheet'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const [i, t] of times.entries()) fs.writeFileSync(path.join(dir, String(i).padStart(3, '0') + '.png'), await shoot(page, t));
  const cols = Math.min(4, times.length), rows = Math.ceil(times.length / cols);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(dir, '*.png'), '-vf', `scale=640:-1,tile=${cols}x${rows}`, '-frames:v', '1', path.join(BUILD, 'sheet.png')]);
  console.log('sheet', times.join(' '));
} else if (mode === 'full') {
  const workers = +(args[0] || 4);
  const N = Math.round(TL.duration * TL.fps);
  const per = Math.ceil(N / workers);
  const t0 = Date.now();
  await Promise.all([...Array(workers)].map(async (_, w) => {
    const br = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--disable-web-security'] });
    const page = await openPage(br);
    const a = w * per, b = Math.min(N, a + per);
    const out = path.join(BUILD, `chunk${w}.mp4`);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(TL.fps), '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const buf = await shoot(page, f / TL.fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (w === 0 && f % 60 === 0) console.log(`w0 ${f - a}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    await br.close();
  }));
  fs.writeFileSync(path.join(BUILD, 'chunks.txt'), [...Array(workers)].map((_, w) => `file 'chunk${w}.mp4'`).join('\n'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(BUILD, 'chunks.txt'), '-c', 'copy', path.join(BUILD, 'video.mp4')]);
  console.log('video done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await browser.close();
