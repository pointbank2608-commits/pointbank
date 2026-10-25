import {createServer} from 'vite';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:5258,strictPort:true,hmr:false}});let browser;
try{await server.listen();const {ELEMENTARY800_VERB_CONTINUATION:words}=await server.ssrLoadModule('/src/data/elementary800VerbContinuation.ts');assert.equal(words.length,71);
 const {buildElementaryBooklets}=await server.ssrLoadModule('/src/lib/elementary800Workbook.ts');const books=buildElementaryBooklets(words);assert.deepEqual(books.map(b=>b.entries.length),[25,25,21]);
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1000,height:1100}});
 for(const level of ['',5,6,7]){await page.goto('http://127.0.0.1:5258/scripts/materials/elementary800-static.html'+(level?'?level='+level:''));await page.locator('.e800-sheet').first().waitFor();await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.e800-pages img')].map(i=>i.decode()));});
 assert.equal(await page.locator('.e800-sheet').count(),level===7?9:level?10:29);assert.equal(await page.locator('[data-image-failed]').count(),0);
 assert.equal(await page.locator('.e800-sheet').evaluateAll(nodes=>nodes.filter(x=>x.scrollHeight>x.clientHeight+2).length),0);
 await page.pdf({path:resolve(root,'public/workbooks/elementary800/verbs-level'+(level||'5-7')+'.pdf'),preferCSSPageSize:true,printBackground:true});console.log('created verbs '+(level||'5-7'));
 if(level===5)await page.screenshot({path:resolve(root,'../output/elementary800-verbs-level5.png'),fullPage:true});
 }
}finally{await browser?.close();await server.close();}
