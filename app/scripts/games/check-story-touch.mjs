import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:5193,strictPort:true,hmr:false}});await server.listen();let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();
 await page.goto('http://127.0.0.1:5193/scripts/games/storybook.html?game=feedmonster');await page.getByRole('button',{name:'게임 시작',exact:false}).tap();
 const a=await page.locator('[data-choice="apple"]').boundingBox(),b=await page.locator('.sb-mouth-target').boundingBox();
 const cdp=await context.newCDPSession(page),scroll=await page.evaluate(()=>scrollY);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
 for(let i=1;i<=15;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2+(b.x+b.width/2-a.x-a.width/2)*i/15,y:a.y+a.height/2+(b.y+b.height/2-a.y-a.height/2)*i/15}]});await page.waitForTimeout(18);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.locator('.sb-feedback.correct').waitFor();assert.equal(await page.evaluate(()=>scrollY),scroll);console.log('PASS mobile touch drag without scroll');
 await page.waitForTimeout(1550);const progress=await page.locator('.sb-progress').getAttribute('aria-label');
 await page.evaluate(()=>Object.defineProperty(Element.prototype,'requestFullscreen',{value:undefined,configurable:true}));
 await page.getByRole('button',{name:'전체 화면',exact:true}).tap();await page.locator('.sb-pseudo-full').waitFor();
 assert.ok(await page.locator('.sb-game').evaluate(el=>el.parentElement===document.body));
 assert.equal(await page.locator('.sb-progress').getAttribute('aria-label'),progress);
 await page.getByRole('button',{name:'전체 화면 종료',exact:true}).tap();assert.equal(await page.locator('.sb-pseudo-full').count(),0);
 assert.equal(await page.locator('.sb-progress').getAttribute('aria-label'),progress);
 console.log('PASS fullscreen fallback enters/exits without losing game progress');
}finally{await browser?.close();await server.close();}
