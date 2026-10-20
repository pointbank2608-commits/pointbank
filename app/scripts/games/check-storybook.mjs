import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(root,'../output/storybook');mkdirSync(out,{recursive:true});
const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:5196,strictPort:true,hmr:false}});await server.listen();
const results=[];const pass=s=>{results.push(s);console.log('PASS',s);};
let browser;
try{
 const lib=await server.ssrLoadModule('/src/lib/storybook.ts');
 const preparation=await server.ssrLoadModule('/src/lib/gamePreparation.ts');
 const adapter=await server.ssrLoadModule('/src/lib/gameFromWords.ts');
 const games=['feedmonster','sentencebridge','sentencetower'];
 for(const game of games){const c=lib.storySample(game);assert.deepEqual(lib.storyErrors(game,c),[]);assert.ok(preparation.isNativeGameReady({game_type:game,config:{storybook:c},items:[]}));assert.deepEqual(lib.storyErrors(game,JSON.parse(JSON.stringify(c))),[]);}
 pass('Three sample configs validate and survive saved-template JSON round trips');
 assert.equal(lib.insertPhrase('I play soccer after school.','with my friends',14),'I play soccer with my friends after school.');
 assert.equal(lib.insertPhrase('I play.','Today',0),'Today I play.');
 const bad=lib.storySample('sentencetower');bad.steps[2].position=0;assert.ok(lib.storyErrors('sentencetower',bad).length);
 const wrong=lib.storySample('feedmonster');wrong.questions[0].wrong=['apple','banana'];assert.ok(lib.storyErrors('feedmonster',wrong).length);
 assert.equal(adapter.buildGameContent('sentencebridge',[{id:'a',word:'She goes to school.',meaning:'',imageUrl:null}]),null);
 const words=['apple','banana','milk'].map((word,i)=>({id:String(i),word,meaning:['사과','바나나','우유'][i],imageUrl:null}));
 assert.equal(adapter.buildGameContent('feedmonster',words).config.storybook.questions[0].prompt,'사과');
 pass('Middle/front insertion, invalid answers, and safe vocabulary/source conversion');
 browser=await chromium.launch({channel:'chrome',headless:true});
 const browserErrors=[];
 const answers={feedmonster:['apple','pencil','banana','book','milk'],sentencebridge:['goes','plays','reading','are','like'],sentencetower:['soccer','after school','with my friends']};
 async function open(game,viewport={width:1280,height:1000},touch=false,query=''){
   const context=await browser.newContext({viewport,hasTouch:touch,isMobile:touch});
   const page=await context.newPage();page.on('pageerror',e=>browserErrors.push(e.message));
   if(query.includes('timed'))await page.clock.install();
   await page.goto(`http://127.0.0.1:5196/scripts/games/storybook.html?game=${game}${query}`);
   await page.getByRole('button',{name:'게임 시작',exact:false}).click();
   return {page,context};
 }
 async function answer(page,game,word,touch=false){
   const card=page.locator(`[data-choice="${word}"]`);
   if(touch)await card.tap();else await card.click();
   if(game==='feedmonster'){if(touch)await page.getByRole('button',{name:'몬스터에게 먹이 주기',exact:true}).tap();else await page.getByRole('button',{name:'몬스터에게 먹이 주기',exact:true}).click();}
 }
 for(const game of games){
   const {page,context}=await open(game);
   const wrongWord=game==='feedmonster'?'banana':game==='sentencebridge'?'go':'a book';
   await answer(page,game,wrongWord);
   await page.locator('.sb-feedback.wrong').waitFor();
   assert.equal(await page.locator('.sb-progress').getAttribute('aria-label'),`진행 0 / ${answers[game].length}`);
   if(game==='sentencebridge')assert.ok((await page.locator('.sb-explorer').getAttribute('style')).includes('5.5%'));
   await page.waitForTimeout(950);
   for(const [i,word] of answers[game].entries()){
     if(i===0&&game==='feedmonster'){
       const a=await page.locator('[data-choice="apple"]').boundingBox();const b=await page.locator('.sb-mouth-target').boundingBox();
       await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});
       await page.locator('.sb-mouth-art.is-hungry').waitFor();await page.mouse.up();
     }else await answer(page,game,word);
     await page.locator('.sb-feedback.correct').waitFor();
     // Duplicate input during an animation cannot advance another round.
     assert.ok(await page.locator('[data-choice]').first().isDisabled());
     if(i===0){await page.waitForTimeout(1100);await page.locator('.sb-game').screenshot({path:resolve(out,`${game}-desktop.png`)});}
     if(game==='sentencetower'&&i===2){assert.equal(await page.locator('.sb-tower-task mark').textContent(),'with my friends');await page.locator('.sb-game').screenshot({path:resolve(out,'sentencetower-insertion.png')});}
     await page.waitForTimeout(i===0 ? 500 : 1550);
   }
   await page.locator('.sb-result-stats').waitFor();assert.match(await page.locator('.sb-result-stats').innerText(),/1/);
   if(game==='sentencetower'){
     const roof=await page.locator('.sb-roof').boundingBox();const floor=await page.locator('.sb-floor').last().boundingBox();
     assert.ok(roof.y < floor.y,'The completed roof belongs above the sentence floors');
   }
   await page.getByRole('button',{name:'다시 놀기'}).click();await page.getByRole('button',{name:'게임 시작',exact:false}).click();
   assert.equal(await page.locator('.sb-progress').getAttribute('aria-label'),`진행 0 / ${answers[game].length}`);
   await page.getByRole('button',{name:'전체 화면',exact:true}).click();assert.ok(await page.evaluate(()=>!!document.fullscreenElement));
   await page.getByRole('button',{name:'전체 화면 종료',exact:true}).click();assert.ok(await page.evaluate(()=>!document.fullscreenElement));
   await page.getByRole('button',{name:'게임 준비로 돌아가기'}).click();await page.getByRole('button',{name:'게임 시작',exact:false}).waitFor();
   await context.close();pass(`${game}: wrong/retry, full play, animation input lock, restart, fullscreen, back`);
 }
 for(const [label,viewport] of [['tablet',{width:820,height:1180}],['mobile',{width:390,height:844}]])for(const game of games){
   const {page,context}=await open(game,viewport,true);
   await page.locator('.sb-game').screenshot({path:resolve(out,`${game}-${label}.png`)});
   await answer(page,game,answers[game][0],true);await page.locator('.sb-feedback.correct').waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await context.close();pass(`${game}: ${label} touch play, no horizontal overflow`);
 }
 const {page:dragPage,context:dc}=await open('feedmonster',{width:390,height:844},true);
 const dragCard=await dragPage.locator('[data-choice="apple"]').boundingBox();const mouth=await dragPage.locator('.sb-mouth-target').boundingBox();
 const cdp=await dc.newCDPSession(dragPage);const initialScroll=await dragPage.evaluate(()=>scrollY);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:dragCard.x+dragCard.width/2,y:dragCard.y+dragCard.height/2}]});
 for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:dragCard.x+dragCard.width/2+(mouth.x+mouth.width/2-dragCard.x-dragCard.width/2)*i/12,y:dragCard.y+dragCard.height/2+(mouth.y+mouth.height/2-dragCard.y-dragCard.height/2)*i/12}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await dragPage.locator('.sb-feedback.correct').waitFor();
 assert.equal(await dragPage.evaluate(()=>scrollY),initialScroll);await dc.close();pass('Mobile touch drag feeds the monster without scrolling the page');
 const {page:timed,context:tc}=await open('feedmonster',{width:900,height:950},false,'&timed');
 await timed.clock.runFor(31000);
 await timed.getByRole('button',{name:'계속 도전하기'}).waitFor();await timed.getByRole('button',{name:'계속 도전하기'}).click();assert.match(await timed.locator('.sb-progress').innerText(),/30s/);await tc.close();pass('Timed round expires gently and retries the same question');
 for(const game of games){const {page,context}=await open(game,{width:390,height:844},true,'&long');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.sb-game').screenshot({path:resolve(out,`${game}-long-mobile.png`)});await context.close();}
 pass('Long sentences remain within mobile screen bounds');
 assert.deepEqual(browserErrors,[]);pass('No uncaught browser errors');
 writeFileSync(resolve(out,'test-results.json'),JSON.stringify({results,browserErrors},null,2));
 console.log(`Completed ${results.length} checks; screenshots: ${out}`);
}finally{await browser?.close();await server.close();}
