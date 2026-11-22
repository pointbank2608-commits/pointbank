import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createLessonUxServer} from '../lessons/ux-server.mjs';

// Isolated auth/API and disabled sensors: no synthetic classroom results in production.
process.env.VITE_SUPABASE_URL='http://127.0.0.1:5589';
process.env.VITE_SUPABASE_ANON_KEY='local-fixture-key';
process.env.VITE_LEARNING_SENSORS_ENABLED='false';
const server=await createLessonUxServer(5589),output=process.env.TELEPATHY_OUTPUT;
let browser;
try{
 await server.listen();
 const {telepathyPlayers}=await server.ssrLoadModule('/src/lib/telepathy.ts');
 const {pictureWordModeKind}=await server.ssrLoadModule('/src/lib/pictureWordQuestions.ts');
 assert.equal(pictureWordModeKind('telepathy'),null);
 for(const type of ['balloonpop','wordfishing','wordclaw'])assert.equal(pictureWordModeKind(type),'native');
 assert.equal(pictureWordModeKind('wheel'),'turn');
 const roster=[{id:'s1',label:'민지'},{id:'s2',label:'준호'},{id:'s3',label:'서연'}];
 const order={mode:'individual',order:['s3','s1','s2'],teamCount:2,teamNames:{'team-0':'해님','team-1':'달님'}};
 const label=n=>n+'팀';
 assert.deepEqual(telepathyPlayers('solo',[],null,3,label,'나'),[{id:'solo',label:'나'}]);
 assert.deepEqual(telepathyPlayers('solo',[],null,3,label,''),[]);
 assert.deepEqual(telepathyPlayers('solo',roster,order,3,label,'나').map(p=>p.label),['서연','민지','준호']);
 assert.deepEqual(telepathyPlayers('solo',roster.filter(p=>p.id!=='s2'),order,3,label,'나').map(p=>p.label),['서연','민지']);
 assert.deepEqual(telepathyPlayers('team',roster,{...order,mode:'team',order:['team-1','team-0']},2,label,'나').map(p=>p.label),['달님','해님']);
 assert.deepEqual(telepathyPlayers('none',roster,order,3,label,'나'),[]);
 console.log('PASS personal, absent, custom team order and names, and no-score participant resolution');

 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.addInitScript(()=>localStorage.setItem('classbank.startCheck.skip','1'));
 await page.goto('http://127.0.0.1:5589/games/telepathy');
 assert(await page.evaluate(async()=>{
  const {isNativeGameReady}=await import('/src/lib/gamePreparation.ts');
  return isNativeGameReady({game_type:'telepathy',items:[{id:'a',label:'cat'},{id:'b',label:'dog'},{id:'c',label:'bird'}],config:{pictureWordMode:true,pictureWords:[]}});
 }));
 async function start(){
  await page.locator('[data-game="telepathy"] [data-game-canvas]').waitFor();
  const workspace=page.locator('[data-game-start-card]').getByRole('button',{name:'게임 시작',exact:true});
  if(await workspace.isVisible())await workspace.click();
  const native=page.locator('[data-initial-game-start]');
  if(await native.isVisible())await native.click();
  await page.getByRole('button',{name:'알 열기!',exact:true}).waitFor();
 }
 await start();
 await page.evaluate(async()=>{
  const {readActivityDraft,writeActivityDraft,draftId}=await import('/src/lib/quickActivity.ts');
  const draft=readActivityDraft(draftId('teacher','academy','telepathy'));
  writeActivityDraft({...draft,config:{...draft.config,telepathyRounds:1,telepathySeconds:0,pictureWordMode:true,pictureWords:[
   {id:'apple',word:'apple',imageUrl:'/phonics-images/apple.webp'},
   {id:'ant',word:'ant',imageUrl:'/phonics-images/ant.webp'},
  ]}});
  window.__lessonQA.students={a:[{id:'s1',name:'민지'},{id:'s2',name:'준호'},{id:'s3',name:'서연'}]};window.__saveLessonQA();
 });
 await page.reload();await start();
 await page.getByRole('button',{name:'알 열기!',exact:true}).click();
 await page.getByRole('button',{name:'결과 보기',exact:true}).waitFor();
 assert.equal(await page.locator('[data-picture-turn]').count(),0);
 await page.reload();await start();
 await page.getByRole('button',{name:'게임설정',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'그림 보고 영어 단어 고르기',exact:true}).count(),0);
 await page.getByRole('button',{name:'적용',exact:true}).click();
 await page.getByRole('button',{name:'알 열기!',exact:true}).waitFor();
 console.log('PASS legacy picture-mode telepathy starts normally, picture option removed, settings still apply');
 async function classSettings(mode,classId=''){
  await page.getByRole('button',{name:'반 설정',exact:true}).click();
  const fields=page.locator('[data-class-settings-fields]');
  await fields.getByRole('button',{name:mode,exact:true}).click();
  await fields.getByRole('combobox').selectOption(classId);
  if(classId)await fields.getByText('학생 3명:',{exact:false}).waitFor();
  if(mode==='팀')while(await fields.getByRole('button',{name:'팀 하나 줄이기',exact:true}).isEnabled())await fields.getByRole('button',{name:'팀 하나 줄이기',exact:true}).click();
  await page.getByRole('button',{name:'적용',exact:true}).click();
  await fields.waitFor({state:'hidden'});
 }
 async function reveal(){
  await start();
  await page.getByRole('button',{name:'알 열기!',exact:true}).click();
  assert.equal(await page.locator('[data-picture-turn]').count(),0);
  await page.getByRole('button',{name:'결과 보기',exact:true}).waitFor();
 }
 async function labels(){return page.locator('[data-telepathy-score]').allTextContents();}
 await classSettings('개인');
 assert.deepEqual(await labels(),['나0점']);
 await page.reload();await start();assert.deepEqual(await labels(),['나0점']);
 const contrast=await page.locator('[data-telepathy-instructions]').evaluate(el=>{
  const s=getComputedStyle(el),rgb=v=>v.match(/[\d.]+/g).slice(0,3).map(Number);
  const luminance=v=>rgb(v).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
  return {ratio:(luminance(s.backgroundColor)+.05)/(luminance(s.color)+.05),background:s.backgroundColor};
 });
 assert(contrast.ratio>7,JSON.stringify(contrast));assert(!contrast.background.includes('rgba'));
 await reveal();
 const correct=page.getByRole('group',{name:'맞힌 사람',exact:true});
 await correct.getByRole('button',{name:'나',exact:true}).click();
 assert.deepEqual(await labels(),['나1점']);
 await page.getByRole('button',{name:'결과 보기',exact:true}).click();
 assert.match(await page.locator('[data-telepathy-result]').innerText(),/나 · 1점/);
 assert(!/\d팀|맞힌 팀/.test(await page.locator('[data-testid="telepathy"]').innerText()));
 console.log('PASS no-class personal mode persists after reload, readable instructions, personal correct/result score');

 await classSettings('개인','a');
 assert.deepEqual((await labels()).sort(),['민지0점','서연0점','준호0점'].sort());
 await page.getByRole('button',{name:'반 설정',exact:true}).click();
 await page.getByRole('button',{name:'결석 학생 제외',exact:true}).click();
 await page.getByRole('checkbox',{name:'준호',exact:true}).check();
 await page.getByRole('button',{name:'적용',exact:true}).click();
 assert.equal((await labels()).length,2);assert(!(await labels()).some(s=>s.includes('준호')));
 await reveal();await page.getByRole('group',{name:'맞힌 사람',exact:true}).getByRole('button',{name:'민지',exact:true}).click();
 await page.getByRole('button',{name:'결과 보기',exact:true}).click();
 assert.equal(await page.locator('[data-telepathy-result]').count(),2);
 assert.match(await page.locator('[data-telepathy-result]').first().innerText(),/민지 · 1점/);
 console.log('PASS class students and absence determine personal scoreboard, correct-person controls and ranking');

 // Reopen the saved lesson and launch its real presentation route.
 await page.evaluate(async()=>{
  const {readActivityDraft,draftId}=await import('/src/lib/quickActivity.ts');
  const draft=readActivityDraft(draftId('teacher','academy','telepathy'));
  const db=window.__lessonQA,template={...draft,id:'telepathy-saved',name:'개인 텔레파시'};
  db.templates=[template];db.lessons.find(l=>l.id==='lesson-a').playlist=[{id:'telepathy-slide',kind:'game',gameType:'telepathy',templateId:template.id}];window.__saveLessonQA();
 });
 await page.goto('http://127.0.0.1:5589/curriculum');
 await page.locator('#lesson-card-lesson-a').getByRole('button',{name:'수업 시작',exact:true}).click();
 await page.waitForURL(/\/games\/telepathy/);await start();
 assert.equal((await labels()).length,2);assert(!(await labels()).some(s=>s.includes('팀')||s.includes('준호')));
 await reveal();await page.getByRole('group',{name:'맞힌 사람',exact:true}).getByRole('button',{name:'민지',exact:true}).click();
 await page.getByRole('button',{name:'결과 보기',exact:true}).click();
 assert.match(await page.locator('[data-telepathy-result]').first().innerText(),/민지 · 1점/);
 if(output){await mkdir(output,{recursive:true});await page.screenshot({path:output+'/personal-presentation-result.jpg'});}
 console.log('PASS saved/reopened lesson presentation retains personal mode, attendance, names and individual ranking');

 await page.evaluate(async()=>{
  sessionStorage.removeItem('classbank.lessonRunner');
  const {saveTeamOrder}=await import('/src/lib/teamOrder.ts');
  saveTeamOrder([{id:'s1',label:'민지'},{id:'s3',label:'서연'}],{mode:'team',teamCount:2,teamOf:{s1:0,s3:1},order:['team-1','team-0'],turn:0,teamNames:{'team-0':'해님','team-1':'달님'}},'teacher:academy');
 });
 await page.goto('http://127.0.0.1:5589/games/telepathy');await start();
 await classSettings('팀','a');
 assert.deepEqual(await labels(),['달님0점','해님0점']);
 await reveal();await page.getByRole('group',{name:'맞힌 팀',exact:true}).getByRole('button',{name:'해님',exact:true}).click();
 await page.getByRole('button',{name:'결과 보기',exact:true}).click();
 assert.match(await page.locator('[data-telepathy-result]').first().innerText(),/해님 · 1점/);
 await classSettings('없음','a');assert.deepEqual(await labels(),[]);
 await reveal();assert.equal(await page.getByRole('group',{name:/맞힌/}).count(),0);
 assert(!/\d팀|맞힌 팀/.test(await page.locator('[data-testid="telepathy"]').innerText()));
 console.log('PASS custom team names/order and points retained, switching to no-score mode hides team controls without errors');
 await page.goto('http://127.0.0.1:5589/games/balloonpop');
 await page.locator('[data-game="balloonpop"] [data-game-canvas]').waitFor();
 await page.getByRole('button',{name:'게임설정',exact:true}).click();
 await page.getByRole('button',{name:'그림 보고 영어 단어 고르기',exact:true}).waitFor();
 console.log('PASS other games keep the picture-word option');
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
