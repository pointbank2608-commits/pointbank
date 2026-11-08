import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:5423,strictPort:true,hmr:false},plugins:[{name:'offline-fixture',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return 'export const supabase={};'}}]});
let browser;
try {
 await server.listen();
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.route('https://**/*',route=>route.abort());
 const {CHECK_TYPES}=await server.ssrLoadModule('/src/lib/homework/guided.ts');
 for(const type of Object.keys(CHECK_TYPES)){
  for(const preview of [true,false]){
   await page.goto(`http://127.0.0.1:5423/scripts/homework/final-studio.html?type=${type}${preview?'&preview':''}`);
   await page.locator('[data-studio-shell] [data-studio-top-bar] [role="progressbar"]').waitFor();
   const area=page.locator('[data-studio-shell] main > section');await area.waitFor();
   if(['choice','listen','sentenceBlank'].includes(type)){
    const choice=area.locator('[data-choice]').first();
    assert.equal(await choice.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 253, 248)');
    if(type==='listen'){
     assert.equal(await area.locator('[data-studio-prompt]').innerText(),'');
     await area.locator('button').filter({hasText:'volume_up'}).click();
    }
    await choice.click();
    await page.getByRole('button',{name:'다음',exact:true}).waitFor();
   } else if (['lettersOrder','sentenceOrder'].includes(type)) {
    await area.locator('[data-tile]').first().click();
   } else if(type==='speak') {
    await area.getByRole('button',{name:'녹음 시작',exact:true}).waitFor();
    assert.equal(await area.getByRole('button',{name:'제출하고 다음으로',exact:true}).isEnabled(),false);
   } else {
    const device=area.getByRole('button',{name:'기기 자판으로 쓰기',exact:true});
    if(await device.isVisible())await device.click();
    const input=area.locator('input');await input.fill('x');await input.press('Enter');
    await page.getByRole('button',{name:'다음',exact:true}).waitFor();
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  console.log('PASS',type,'preview and student renderer');
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
