// 문법 워크북 시트가 모든 주제·도움 수준에서 A4 한 쪽(내용 높이 273mm 이내)에 들어가는지 잰다.
//   node scripts/grammar-sheets/check-layout.mjs      (app 폴더에서, 인터넷 필요 — 글꼴)
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { GRAMMAR_POINTS_IDS } from './ids.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({ root, server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
const mmPerPx = 25.4 / 96;
const over = [];
let maxH = 0;
const supports = [1, 3];
const EXPECTED = 8; // 학생용 7쪽(1+1+2+1+1+1) + 교사용 1쪽
const only = process.env.IDS?.split(',');
let progress = 0;
for (const id of GRAMMAR_POINTS_IDS.filter((x) => !only || only.includes(x))) {
  progress++;
  if (progress % 10 === 0) console.log(`progress ${progress}/${GRAMMAR_POINTS_IDS.length} 최대 ${maxH.toFixed(0)}mm 문제 ${over.length}건`);
  for (const set of ['A', 'B']) for (const s of supports) {
    const url = `http://localhost:5199/scripts/grammar-sheets/harness.html?topic=${id}&support=${s}&set=${set}`;
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
    await page.waitForSelector('#ready, #missing');
    if (await page.$('#missing')) { if (!only) over.push(`${id} ${set}: 자료 없음`); continue; }
    await page.evaluate(() => document.fonts.ready);
    const hs = await page.$$eval('.print-board', (els) => els.map((e) => e.getBoundingClientRect().height));
    hs.forEach((h, i) => { const mm = h * mmPerPx; maxH = Math.max(maxH, mm); if (mm > 273.4) over.push(`${id} ${set} s${s} #${i + 1}: ${mm.toFixed(0)}mm`); });
    if (hs.length !== EXPECTED) over.push(`${id} ${set} s${s}: 시트 ${hs.length}개`);
  }
}
await browser.close();
await server.close();
console.log(`최대 ${maxH.toFixed(0)}mm`);
if (over.length) { console.log(over.join('\n')); console.log(`\n실패: ${over.length}건`); process.exit(1); }
console.log('통과');
