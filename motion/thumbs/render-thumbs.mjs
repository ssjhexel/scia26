// Renders thumbs.html to ../../output/thumbnails/*.png and *.jpg (1280x720, YouTube's recommended size, under 2 MB)
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname), OUT = path.join(HERE, '../../output/thumbnails');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1500 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(HERE, 'thumbs.html'));
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
for (const [id, name] of [['finalists', 'SCIA2026_Finalists_thumbnail'], ['winners', 'SCIA2026_Winners_thumbnail']]) {
  const png = path.join(OUT, name + '.png');
  await page.locator('#' + id).screenshot({ path: png });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', path.join(OUT, name + '.jpg')]);
}
await browser.close();
