import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {createServer} from 'vite';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:5192,strictPort:true,hmr:false}});await server.listen();let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [size,viewport] of [['desktop',{width:1280,height:1000}],['tablet',{width:820,height:1180}],['mobile',{width:390,height:844}]]){
  for(const game of ['feedmonster','sentencebridge','sentencetower']){
   const page=await browser.newPage({viewport,hasTouch:size!=='desktop',isMobile:size!=='desktop'});
   await page.goto(`http://127.0.0.1:5192/scripts/games/storybook.html?game=${game}`);
   await page.getByRole('button',{name:'게임 시작',exact:false}).click();
   if(game==='sentencebridge'){await page.locator('[data-choice="goes"]').click();await page.waitForTimeout(1550);}
   if(game==='sentencetower')for(const word of ['soccer','after school']){await page.locator(`[data-choice="${word}"]`).click();await page.waitForTimeout(1550);}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('.sb-game').screenshot({path:resolve('../output/storybook',`${game}-${size}.png`)});
   if(game==='sentencetower' && size==='desktop'){
    await page.locator('[data-choice="with my friends"]').click();await page.waitForTimeout(1100);
    await page.locator('.sb-game').screenshot({path:resolve('../output/storybook','sentencetower-insertion.png')});
    await page.locator('.sb-result-overlay').waitFor();
    await page.locator('.sb-result-overlay').evaluate(el=>el.style.visibility='hidden');
    await page.locator('.sb-game').screenshot({path:resolve('../output/storybook','sentencetower-completed.png')});
   }
   console.log('CAPTURE',game,size);await page.close();
  }
 }
}finally{await browser?.close();await server.close();}
