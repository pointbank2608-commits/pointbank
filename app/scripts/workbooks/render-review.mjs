import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('../output/pdf', {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1100,height:900}});
const results=[];
for (const book of ['cvc','long','stage4','grammar']) {
 await page.goto(`http://127.0.0.1:5174/scripts/workbooks/index.html?book=${book}`);
 await page.locator('.print-board').first().waitFor();
 if(book==='grammar') await page.getByLabel('교사용 정답·풀이',{exact:true}).check();
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
 const data=await page.evaluate(()=>({
   pages:document.querySelectorAll('.print-board').length,
   images:[...document.images].every(i=>i.naturalWidth>0),
   fonts:['Fredoka','Andika'].map(name=>({name,loaded:[...document.fonts].some(f=>f.family.includes(name)&&f.status==='loaded')})),
   overflow:[...document.querySelectorAll('.print-board, .print-board section')].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.tagName),
   sizes:[...document.querySelectorAll('.print-board')].map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})),
 }));
 assert.equal(data.pages,book==='grammar'?4:2);
 assert(data.images); assert(data.fonts.every(f=>f.loaded)); assert.equal(data.overflow.length,0);
 if(book==='stage4') {
   const complete=page.locator('section').nth(4);
   assert.equal(await complete.locator('[data-target-blank]').count(),3);
   assert.equal((await complete.innerText()).replace(/\s/g,''),'5CompletetheWordipellfi');
 }
 if(book==='grammar') {
   assert.equal(await page.locator('[data-audience="student"]').count(),2);
   const student=await page.locator('[data-audience="student"]').allTextContents();
   assert(!student.join('').includes('He likes soccer.'));
   assert(!student.join('').includes('The owner is TOBI.'));
   await page.emulateMedia({media:'print'});
   assert.equal(await page.locator('.no-print').isVisible(),false);
 }
 await page.emulateMedia({media:'print'});
 assert((await page.locator('.print-board').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height))).every(height=>height<1032));
 await page.pdf({path:`../output/pdf/${book==='stage4'?'stage4-sh':book==='grammar'?'grammar-third-person':book+'-after'}.pdf`,format:'A4',preferCSSPageSize:true,printBackground:true});
 await page.emulateMedia({media:'screen'});
 await page.screenshot({path:`../output/pdf/${book}-preview.png`,fullPage:true});
 results.push({book,...data});
}
await writeFile('../output/pdf/render-checks.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
await browser.close();
