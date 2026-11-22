import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createLessonUxServer} from '../lessons/ux-server.mjs';

// Synthetic teacher/API fixtures only; do not generate production learning evidence.
process.env.VITE_SUPABASE_URL='http://127.0.0.1:5590';
process.env.VITE_SUPABASE_ANON_KEY='local-fixture-key';
process.env.VITE_LEARNING_SENSORS_ENABLED='false';
const server=await createLessonUxServer(5590),output=process.env.SHUFFLE_OUTPUT;
let browser;
try{
 await server.listen();
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
 await page.addInitScript(()=>localStorage.setItem('classbank.startCheck.skip','1'));
 await page.goto('http://127.0.0.1:5590/games/shufflefind');
 async function start(){
  await page.locator('[data-game="shufflefind"] [data-game-canvas]').waitFor();
  const workspace=page.locator('[data-game-start-card]').getByRole('button',{name:'게임 시작',exact:true});
  if(await workspace.isVisible())await workspace.click();
  const native=page.locator('[data-initial-game-start]');if(await native.isVisible())await native.click();
  await page.locator('[data-testid="shuffle-find"]').waitFor();
 }
 await start();
 await page.evaluate(async()=>{
  const {readActivityDraft,writeActivityDraft,draftId}=await import('/src/lib/quickActivity.ts');
  const draft=readActivityDraft(draftId('teacher','academy','shufflefind'));
  writeActivityDraft({...draft,config:{...draft.config,shuffleRounds:2,shuffleSpeed:'slow',pictureWordMode:false}});
  window.__lessonQA.students={a:[{id:'s1',name:'민지'},{id:'s2',name:'준호'},{id:'s3',name:'서연'}]};window.__saveLessonQA();
 });
 await page.reload();await start();
 async function settings(mode,classId=''){
  await page.getByRole('button',{name:'반 설정',exact:true}).click();
  const fields=page.locator('[data-class-settings-fields]');
  await fields.getByRole('button',{name:mode,exact:true}).click();
  await fields.getByRole('combobox').selectOption(classId);
  if(classId)await fields.getByText('학생 3명:',{exact:false}).waitFor();
  if(mode==='팀')while(await fields.getByRole('button',{name:'팀 하나 줄이기',exact:true}).isEnabled())await fields.getByRole('button',{name:'팀 하나 줄이기',exact:true}).click();
  await page.getByRole('button',{name:'적용',exact:true}).click();await fields.waitFor({state:'hidden'});
 }
 async function hit(){
  await start();
  await page.waitForFunction(()=>document.querySelector('[data-testid="shuffle-find"] button[aria-label="1번 컵"]:not(:disabled)'));
  const answer=await page.locator('[data-testid="shuffle-find"] img[src*="/a-"]').evaluate(el=>[20,50,80].indexOf(parseFloat(el.style.left)));
  assert(answer>=0);await page.getByRole('button',{name:`${answer+1}번 컵`,exact:true}).click();
  await page.locator('[data-testid="shuffle-find"] [role="status"]').getByText(/찾았어요/).waitFor();
 }
 const scoreText=()=>page.locator('[data-shuffle-score]').allTextContents();
 const current=()=>page.locator('[data-turn-current]').innerText();
 await settings('개인');await page.reload();await start();
 assert.match((await scoreText())[0],/^나/);assert.equal(await current(),'나');
 await hit();await page.getByRole('button',{name:'다음 판',exact:true}).click();await hit();
 await page.getByRole('button',{name:'결과 보기',exact:true}).click();
 assert.match(await page.locator('[data-shuffle-result]').innerText(),/^나.*2번 찾았어요/);
 assert(!/\d팀/.test(await page.locator('[data-testid="shuffle-find"]').innerText()));
 console.log('PASS no-class solo persists after reload, native turn and score/result use Me');

 await settings('개인','a');await start();
 assert.equal((await scoreText()).length,3);assert.equal(await current(),'민지');
 await hit();assert.equal(await current(),'준호');
 assert.match((await scoreText())[0],/민지1점/);
 await page.getByRole('button',{name:'반 설정',exact:true}).click();
 await page.getByRole('button',{name:'결석 학생 제외',exact:true}).click();
 await page.getByRole('checkbox',{name:'준호',exact:true}).check();
 await page.getByRole('button',{name:'적용',exact:true}).click();await start();
 assert.equal((await scoreText()).length,2);assert.equal(await current(),'민지');
 await hit();assert.equal(await current(),'서연');
 await page.getByRole('button',{name:'다음 판',exact:true}).click();await hit();assert.equal(await current(),'민지');
 await page.getByRole('button',{name:'결과 보기',exact:true}).click();
 assert.equal(await page.locator('[data-shuffle-result]').count(),2);
 assert(!/준호|\d팀/.test(await page.locator('[data-testid="shuffle-find"]').innerText()));
 console.log('PASS attending names, native next person and awarded scores stay aligned; absent student excluded from result');

 await page.evaluate(async()=>{
  const {readActivityDraft,draftId}=await import('/src/lib/quickActivity.ts');
  const draft=readActivityDraft(draftId('teacher','academy','shufflefind'));
  const db=window.__lessonQA,template={...draft,id:'shuffle-saved',name:'개인 컵 찾기'};
  db.templates=[template];db.lessons.find(l=>l.id==='lesson-a').playlist=[{id:'shuffle-slide',kind:'game',gameType:'shufflefind',templateId:template.id}];window.__saveLessonQA();
 });
 await page.goto('http://127.0.0.1:5590/curriculum');
 await page.locator('#lesson-card-lesson-a').getByRole('button',{name:'수업 시작',exact:true}).click();
 await page.waitForURL(/\/games\/shufflefind/);await start();
 assert.equal(await current(),'민지');assert.equal((await scoreText()).length,2);
 await hit();assert.equal(await current(),'서연');
 await page.getByRole('button',{name:'다음 판',exact:true}).click();await hit();
 await page.getByRole('button',{name:'결과 보기',exact:true}).click();
 assert.equal(await page.locator('[data-shuffle-result]').count(),2);
 if(output){await mkdir(output,{recursive:true});await page.screenshot({path:output+'/personal-presentation-result.jpg'});}
 console.log('PASS saved/reopened lesson presentation retains personal mode, attending names and individual results');

 await page.evaluate(async()=>{
  sessionStorage.removeItem('classbank.lessonRunner');
  const {saveTeamOrder}=await import('/src/lib/teamOrder.ts');
  saveTeamOrder([{id:'s1',label:'민지'},{id:'s3',label:'서연'}],{mode:'team',teamCount:2,teamOf:{s1:0,s3:1},order:['team-1','team-0'],turn:0,teamNames:{'team-0':'해님','team-1':'달님'}},'teacher:academy');
 });
 await page.goto('http://127.0.0.1:5590/games/shufflefind');await start();await settings('팀','a');await start();
 assert.equal(await current(),'달님');assert.match((await scoreText())[0],/달님/);
 await hit();assert.equal(await current(),'해님');assert.match((await scoreText())[0],/달님1점/);
 await settings('없음','a');await start();assert.equal((await scoreText()).length,0);
 assert.equal(await page.locator('[data-turn-display]').count(),0);
 await hit();assert(!/\+1점/.test(await page.locator('[data-testid="shuffle-find"]').innerText()));
 await page.getByRole('button',{name:'게임설정',exact:true}).click();
 await page.getByRole('button',{name:'그림 보고 영어 단어 고르기',exact:true}).waitFor();
 console.log('PASS custom team names/order, no-score mode and retained picture-word option');
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
