import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { mkdir } from 'node:fs/promises';
await mkdir('../output/pdf', {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage();
for (const book of ['cvc','long']) {
 await page.goto(`http://127.0.0.1:5174/scripts/workbooks/index.html?book=${book}`);
 await page.locator('.print-board').first().waitFor();
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
 await page.pdf({path:`../output/pdf/${book}-baseline.pdf`,format:'A4',preferCSSPageSize:true,printBackground:true});
 console.log(book,await page.evaluate(()=>[...document.fonts].filter(f=>['Fredoka','Andika'].some(n=>f.family.includes(n))).map(f=>({family:f.family,status:f.status}))));
}
await browser.close();
