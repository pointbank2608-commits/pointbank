import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createLessonUxServer} from './ux-server.mjs';

// Real app routes with fixture API/auth only; no production learning records.
const server=await createLessonUxServer(5587), results=[],output=process.env.BALLOON_OUTPUT;
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:3440,height:1300},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.addInitScript(()=>{localStorage.setItem('classbank.startCheck.skip','1');localStorage.setItem('classbank.selectedClassId','a');});
 const goto=async path=>{
  if(!page.url().startsWith('http://127.0.0.1:5587'))return page.goto('http://127.0.0.1:5587'+path);
  await page.evaluate(path=>{history.pushState({usr:null,key:crypto.randomUUID(),idx:100},'',path);dispatchEvent(new PopStateEvent('popstate'));},path);
 };
 await goto('/games/balloonpop');await page.getByRole('button',{name:'게임 시작',exact:true}).click();await page.locator('.ad-balloon').first().waitFor();
 await page.clock.install();if(output)await mkdir(output,{recursive:true});
 const settle=()=>page.clock.runFor(120);
 const shot=async name=>{if(output)await page.screenshot({path:output+'/'+name+'.jpg'});};
 async function config({count=2,picture=false,long=false}={}){
  await page.evaluate(async ({count,picture,long})=>{
   const {readActivityDraft,writeActivityDraft,draftId}=await import('/src/lib/quickActivity.ts');
   const {sampleAdventure}=await import('/src/lib/adventureGames.ts');
   const draft=readActivityDraft(draftId('teacher','academy','balloonpop')),a=sampleAdventure('balloonpop');
   a.count=count;a.choices=4;a.sound=false;
   a.words=Array.from({length:100},(_,i)=>({id:'word-'+i,word:long?'extraordinary-supercalifragilistic-word-'+i:'word'+i,meaning:'뜻 '+i,tags:[]}));
   writeActivityDraft({...draft,config:{...draft.config,adventure:a,pictureWordMode:picture,pictureWords:a.words.slice(0,8).map((w,i)=>({...w,imageUrl:'/phonics-images/'+['apple','ant','axe','bag','bat','bus','cat','cup'][i]+'.webp'}))}});
  },{count,picture,long});
  await goto('/games');await goto('/games/balloonpop');
  const start=page.getByRole('button',{name:'게임 시작',exact:true});if(await start.isVisible())await start.click();
  await page.locator('.ad-balloon[data-word="'+(long?'extraordinary-supercalifragilistic-word-0':'word0')+'"]').waitFor();
 }
 async function apply(count){
  await page.getByRole('button',{name:'게임설정',exact:true}).click();await page.locator('[data-native-game-options]:visible').getByLabel('보기 개수').selectOption(String(count));
  await page.getByRole('button',{name:'적용',exact:true}).click();await page.locator(`.ad-sky[data-choices="${count}"]`).waitFor();
 }
 async function choices(count,mode){
  await settle();const data=await page.evaluate(()=>{
   const s=document.querySelector('[data-game-stage]').getBoundingClientRect(),p=document.querySelector('.ad-prompt').getBoundingClientRect();
   return {viewport:innerWidth+'x'+innerHeight,prompt:p.height,options:[...document.querySelectorAll('.ad-balloon')].map(e=>{
    const r=e.getBoundingClientRect(),label=e.querySelector('.game-fit-inner').getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height*.35);
    const body=e.querySelector('[data-balloon-body]').getBBox(),svg=e.querySelector('svg'),matrix=svg.getScreenCTM();
    return {text:e.dataset.word,w:r.width,h:r.height,labelHeight:label.height,bodyRatio:body.width/body.height,uniformScale:Math.abs(Math.hypot(matrix.a,matrix.b)-Math.hypot(matrix.c,matrix.d))<.001,inside:r.left>=s.left-2&&r.right<=s.right+2&&r.top>=s.top-2&&r.bottom<=s.bottom+2,uncovered:!!top&&e.contains(top),labelFits:label.left>=r.left-2&&label.right<=r.right+2};
   })};
  });
  assert.equal(data.options.length,count);
  for(const o of data.options){assert(o.inside,'Clipped '+JSON.stringify(o));assert(o.uncovered,'Covered '+o.text);assert(o.labelFits,'Clipped label '+o.text);assert(o.bodyRatio>.80&&o.bodyRatio<.83&&o.uniformScale,'Original balloon shape must not stretch');}
  if(count===4&&!mode.startsWith('picture')&&data.viewport==='3440x1300')assert(data.options[0].h>data.prompt*2,'Balloons too small');
  if(count===4&&mode.startsWith('picture')&&data.viewport==='3440x1300'){
   assert(data.options.every(o=>o.w>400),'Picture balloons too narrow for classroom display');
   assert(data.options.every(o=>o.labelHeight>55),'Picture choice words too small for classroom display');
  }
  results.push({count,mode,...data});console.log('PASS choices',data.viewport,mode,count);
 }
 async function outcome(selector){
  await page.locator(selector).waitFor();await settle();
  const state=await page.locator(selector).evaluate(card=>{
   const v=card.querySelector('.ad-outcome-viewport').getBoundingClientRect(),box=card.getBoundingClientRect();
   return {count:card.querySelectorAll('li').length,inside:box.left>=0&&box.right<=innerWidth+2&&box.top>=0&&box.bottom<=innerHeight+2,
    clipped:[...card.querySelectorAll('h2,p,li,button')].filter(e=>{const r=e.getBoundingClientRect();return r.left<v.left-2||r.right>v.right+2||r.top<v.top-2||r.bottom>v.bottom+2;}).map(e=>e.textContent),
    scrollers:[card,...card.querySelectorAll('*')].filter(e=>/auto|scroll/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+1).map(e=>e.className)};
  });
  assert(state.inside,'Outcome outside screen');assert.deepEqual(state.clipped,[],'Outcome content clipped');assert.deepEqual(state.scrollers,[],'Outcome needs scroll');return state;
 }
 for(const size of [{width:3440,height:1300},{width:1920,height:1080},{width:1366,height:768},{width:1024,height:768},{width:390,height:844}]){
  await page.setViewportSize(size);await config();
  for(const count of [3,4,5,6]){
   await apply(count);await choices(count,'normal');if(count===4)await shot('balloons-'+size.width);
   await page.getByRole('button',{name:'전체화면',exact:true}).click();await page.waitForFunction(()=>!!document.fullscreenElement);await choices(count,'fullscreen');
   await page.evaluate(()=>document.exitFullscreen());await settle();
  }
  for(let i=0;i<2;i++){
   await page.locator('.ad-balloon[data-word="word'+i+'"]').click();await page.clock.runFor(1550);await outcome('.ad-review');
   if(!i)await shot('review-'+size.width);await page.locator('.ad-review button.ad-primary').click();
  }
  assert.equal((await outcome('.ad-results')).count,2);console.log('PASS feedback and results',size.width);
 }
 for(const size of [{width:3440,height:1300},{width:1920,height:1080},{width:1366,height:768},{width:1024,height:768},{width:390,height:844}]){
  await page.setViewportSize(size);await config({picture:true});
  for(const count of [3,4,5,6]){
   await apply(count);await choices(count,'picture');
   const picture=await page.evaluate(()=>{
    const scene=document.querySelector('.ad-balloonpop').getBoundingClientRect(),header=document.querySelector('.ad-header').getBoundingClientRect(),image=document.querySelector('[data-picture-word]').getBoundingClientRect(),prompt=document.querySelector('.ad-prompt').getBoundingClientRect();
    const balloons=[...document.querySelectorAll('.ad-balloon')].map(e=>e.getBoundingClientRect());
    return {height:image.height,sceneHeight:scene.height,sceneWidth:scene.width,headerHeight:header.height,inside:image.left>=scene.left&&image.right<=scene.right&&image.top>=scene.top&&image.bottom<=scene.bottom,
     leftOfChoices:balloons.every(r=>prompt.right<r.left),oneRow:balloons.every(r=>Math.abs(r.top-balloons[0].top)<30),rows:Math.abs(balloons[0].top-balloons[1].top)<30&&balloons[2].top>balloons[0].bottom&&Math.abs(balloons[2].top-balloons[3]?.top)<30,
     overlaps:[...document.querySelectorAll('.ad-balloon')].some(e=>{const r=e.getBoundingClientRect();return r.left<prompt.right&&r.right>prompt.left&&r.top<prompt.bottom&&r.bottom>prompt.top;})};
   });
   assert(picture.inside,'Picture outside scene');assert(!picture.overlaps,'Picture overlaps balloon');
   if(picture.sceneWidth>=600&&picture.sceneWidth/picture.sceneHeight>=1.5){assert(picture.leftOfChoices,'Picture must be left of balloon choices');if(count===4)assert(picture.sceneWidth/picture.sceneHeight>=2.2?picture.oneRow:picture.rows,'Balloon rows must fit the scene proportions');}
   if(size.width===3440){assert(picture.height>picture.sceneHeight*.4,'Picture too small for classroom display');assert(picture.headerHeight<picture.sceneHeight*.09,'Title takes too much height');}
   if(count===4)await shot('picture-'+size.width);
   await page.getByRole('button',{name:'전체화면',exact:true}).click();await page.waitForFunction(()=>!!document.fullscreenElement);await choices(count,'picture-fullscreen');
   await page.evaluate(()=>document.exitFullscreen());await settle();
  }
 }
 await page.setViewportSize({width:3440,height:1300});
 await config({count:50,long:true});
 for(let i=0;i<50;i++){
  await page.locator('.ad-balloon[data-word="extraordinary-supercalifragilistic-word-'+i+'"]').click();await page.clock.runFor(1550);
  await page.locator('.ad-review').waitFor();await page.locator('.ad-review button.ad-primary').click();
 }
 for(const size of [{width:3440,height:1300},{width:1366,height:768},{width:390,height:844}]){
  await page.setViewportSize(size);assert.equal((await outcome('.ad-results')).count,50);await shot('results-50-'+size.width);
 }
 console.log('PASS all 50 result rows and final button on one screen');assert.deepEqual(errors,[]);
 if(output)await writeFile(output+'/results.json',JSON.stringify(results,null,2));
}finally{await browser?.close();await server.close();}
