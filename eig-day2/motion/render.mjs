// Renders gfx.html pieces frame by frame with headless Chromium.
//   node render.mjs sheet <piece> <spec.json> [t ...]    -> <out dir>/sheet-<piece>.png (review)
//   node render.mjs piece <piece> <spec.json> <out>      -> opaque pieces: H.264 mp4; overlays: QuickTime RLE (alpha) .mov
//   node render.mjs talk <spec.json> <outdir>            -> every piece a talk needs (intro, outro, lt-N, ch-N)
import { chromium } from '/home/user/scia26/motion/node_modules/playwright-core/index.mjs';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const FPS = 25;
const OVERLAY = { lt: true, chapter: true };
const CLIP = { x: 0, y: 680, width: 1400, height: 400 };   // overlays live bottom-left

async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto('file://' + path.join(ROOT, 'gfx.html'));
  await page.evaluate(() => Promise.all(['400 40px "Instrument Serif"', 'italic 400 40px "Instrument Serif"', '400 20px "Inter Tight"', '600 20px "Inter Tight"'].map(f => document.fonts.load(f))));
  return page;
}
const shot = (page, piece, t) => page.evaluate(t => window.seek(t), t).then(() =>
  OVERLAY[piece] ? page.screenshot({ type: 'png', omitBackground: true, clip: CLIP }) : page.locator('#stage').screenshot({ type: 'png' }));

async function renderPiece(page, piece, spec, out) {
  const dur = await page.evaluate(([p, s]) => window.setup(p, s), [piece, spec]);
  const N = Math.round(dur * FPS);
  const enc = OVERLAY[piece]
    ? ['-c:v', 'qtrle', '-pix_fmt', 'argb']
    : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv420p', '-tune', 'animation'];
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', ...enc, out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < N; f++) { const b = await shot(page, piece, f / FPS); if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  return dur;
}

const [, , mode, ...args] = process.argv;
if (mode) {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  const page = await open(browser);
  if (mode === 'sheet') {
    const [piece, specFile, ...ts] = args;
    const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
    const s = piece === 'lt' ? spec.lts[0] : piece === 'chapter' ? spec.chapters[0] : spec;
    const dur = await page.evaluate(([p, s]) => window.setup(p, s), [piece, s]);
    const times = ts.length ? ts.map(Number) : [...Array(8)].map((_, i) => +(dur * (i + .5) / 8).toFixed(2));
    const dir = path.join(path.dirname(specFile), '_sheet'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    for (const [i, t] of times.entries()) fs.writeFileSync(path.join(dir, String(i).padStart(3, '0') + '.png'), await shot(page, piece, t));
    const cols = Math.min(4, times.length), rows = Math.ceil(times.length / cols);
    const bgArgs = OVERLAY[piece] ? ['-f', 'lavfi', '-i', `color=c=0x3a4a5e:s=${CLIP.width}x${CLIP.height}`, '-filter_complex', `[0][1]overlay=shortest=1,scale=700:-1,tile=${cols}x${rows}`] : ['-vf', `scale=960:-1,tile=${cols}x${rows}`];
    const ins = OVERLAY[piece] ? ['-loop', '1', '-pattern_type', 'glob', '-i', path.join(dir, '*.png')] : ['-pattern_type', 'glob', '-i', path.join(dir, '*.png')];
    const outPng = path.join(path.dirname(specFile), `sheet-${piece}.png`);
    if (OVERLAY[piece]) execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x3a4a5e:s=${CLIP.width}x${CLIP.height}`, '-pattern_type', 'glob', '-i', path.join(dir, '*.png'),
      '-filter_complex', `[1]format=rgba[f];[0][f]overlay=shortest=1:format=auto,scale=700:-1,tile=${cols}x${rows}`, '-frames:v', '1', outPng]);
    else execFileSync('ffmpeg', ['-v', 'error', '-y', ...ins, '-vf', `scale=960:-1,tile=${cols}x${rows}`, '-frames:v', '1', outPng]);
    console.log(outPng, times.join(' '));
  } else if (mode === 'piece') {
    const [piece, specFile, out] = args;
    await renderPiece(page, piece, JSON.parse(fs.readFileSync(specFile, 'utf8')), out);
  } else if (mode === 'talk') {
    const [specFile, outdir] = args;
    const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
    fs.mkdirSync(outdir, { recursive: true });
    const t0 = Date.now();
    await renderPiece(page, 'intro', spec, path.join(outdir, 'intro.mp4'));
    await renderPiece(page, 'outro', spec, path.join(outdir, 'outro.mp4'));
    for (const [i, l] of (spec.lts || []).entries()) await renderPiece(page, 'lt', l, path.join(outdir, `lt-${i}.mov`));
    for (const [i, c] of (spec.chapters || []).entries()) await renderPiece(page, 'chapter', c, path.join(outdir, `ch-${i}.mov`));
    console.log(spec.id, 'gfx done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await browser.close();
}
