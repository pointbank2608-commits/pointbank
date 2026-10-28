import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({ root, server: { port: 5197, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
for (const s of [1, 3]) {
  await page.goto(`http://localhost:5197/scripts/grammar-sheets/harness.html?topic=${process.argv[2] ?? 'third-s'}&support=${s}&set=B`);
  await page.waitForSelector('#ready');
  await page.evaluate(() => document.fonts.ready);
  const r = await page.$$eval('.print-board', (els) => els.map((e) => [...e.children].map((c) => Math.round(c.getBoundingClientRect().height * 25.4 / 96)).join(',')));
  console.log('support', s, r.join(' | '));
}
await browser.close(); await server.close();
