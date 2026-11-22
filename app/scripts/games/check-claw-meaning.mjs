import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createLessonUxServer} from '../lessons/ux-server.mjs';

// Isolated teacher/auth/API fixtures; never write synthetic learning evidence to production.
process.env.VITE_SUPABASE_URL='http://127.0.0.1:5588';
process.env.VITE_SUPABASE_ANON_KEY='local-fixture-key';
process.env.VITE_LEARNING_SENSORS_ENABLED='false';
const server=await createLessonUxServer(5588),output=process.env.CLAW_OUTPUT;
let browser;
try{
 await server.listen();
 const lib=await server.ssrLoadModule('/src/lib/adventureGames.ts');
 const config=lib.sampleAdventure('wordclaw');
 config.count=50;config.missions=[{id:'legacy',tag:'verb',text:'Old saved classification'}];
 config.words=Array.from({length:16},(_,i)=>({id:'word-'+i,word:'word'+i,meaning:'뜻 '+i,tags:[]}));
 const rounds=lib.adventureRounds('wordclaw',JSON.parse(JSON.stringify(config)));
 assert.equal(rounds.length,16);
 for(const round of rounds){assert.equal(round.kind,'draw');assert(round.word.meaning);assert(round.choices.some(w=>w.id===round.word.id));assert.equal(round.choices.length,12);}
 config.words[0].meaning='';
 assert(lib.adventureErrors('wordclaw',config).some(e=>e.includes('뜻')));
 assert.deepEqual(lib.adventureErrors('wordclaw',config,{pictureMode:true}),[]);
 console.log('PASS saved configs, target always included beyond 12 words, meaning required only in normal mode');

 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.addInitScript(()=>localStorage.setItem('classbank.startCheck.skip','1'));
 await page.goto('http://127.0.0.1:5588/games/wordclaw');await page.getByRole('button',{name:/게임 시작/}).click();await page.locator('.claw-capsule').first().waitFor();
 await page.clock.install();if(output)await mkdir(output,{recursive:true});
 async function startGame(){
  await page.waitForFunction(()=>document.querySelector('.claw-capsule')||document.querySelector('[data-game-start-card] button'));
  const start=page.locator('[data-game-start-card]').getByRole('button',{name:/게임 시작/});if(await start.isVisible())await start.click();
  await page.locator('.claw-capsule').first().waitFor();
 }
 async function setup({count=2,easy=false,picture=false,many=false,blank=false}={}){
  await page.evaluate(async options=>{
   const {sampleAdventure}=await import('/src/lib/adventureGames.ts');
   const {readActivityDraft,writeActivityDraft,draftId}=await import('/src/lib/quickActivity.ts');
   const id=draftId('teacher','academy','wordclaw'),draft=readActivityDraft(id),c=sampleAdventure('wordclaw');
   c.count=options.count;c.sound=false;c.simpleClaw=options.easy;
   c.words=options.many?Array.from({length:16},(_,i)=>({id:'word-'+i,word:'word'+i,meaning:'뜻 '+i,tags:[]})):[
    {id:'eat',word:'eat',meaning:'먹다',tags:[]},{id:'apple',word:'apple',meaning:'사과',tags:[]},
    {id:'consume',word:'consume',meaning:'먹다',tags:[]},{id:'run',word:'run',meaning:'달리다',tags:[]},
   ];
   if(options.blank)c.words.forEach(w=>w.meaning='');
   writeActivityDraft({...draft,config:{...draft.config,adventure:c,pictureWordMode:options.picture,pictureWords:options.picture?[
    {id:'apple',word:'apple',meaning:'',imageUrl:'/phonics-images/apple.webp'},
    {id:'ant',word:'ant',meaning:'',imageUrl:'/phonics-images/ant.webp'},
    {id:'cat',word:'cat',meaning:'',imageUrl:'/phonics-images/cat.webp'},
   ]:undefined}});
   history.pushState({usr:null,key:crypto.randomUUID(),idx:100},'','/games');dispatchEvent(new PopStateEvent('popstate'));
  },{count,easy,picture,many,blank});
  await page.locator('a[href="/games/wordclaw"]').first().click();
  await page.clock.runFor(200);
  if(!blank||picture)await startGame();
 }
 async function pick(word,easy=false){
  await page.locator('.claw-capsule[data-word="'+word+'"]').click();
  if(!easy)await page.getByRole('button',{name:'집게 내리기',exact:true}).click();
 }
 async function settle(){await page.clock.runFor(1000);}
 await setup();await page.getByText('먹다',{exact:true}).waitFor();
 await pick('apple');await page.locator('[data-pick="miss"]').waitFor();await settle();
 assert.equal(await page.locator('.ad-review').count(),0);assert.match(await page.locator('.claw-meaning-prompt').innerText(),/먹다/);
 assert(!await page.locator('.claw-outlet').innerText().then(t=>t.includes('apple')));
 await pick('eat');await page.locator('[data-pick="catch"]').waitFor();await settle();
 await page.locator('.ad-review').waitFor();assert.match(await page.locator('.ad-review').innerText(),/eat · 먹다/);
 await page.locator('.ad-review .ad-primary').click();await page.getByText('사과',{exact:true}).waitFor();
 await pick('apple');await settle();await page.locator('.ad-review .ad-primary').click();
 assert.equal(await page.locator('.ad-results li').count(),2);assert.match(await page.locator('.ad-results').innerText(),/eat · 먹다/);
 console.log('PASS wrong word slips and retries same meaning, correct word advances, results retain matching answers');

 await setup({count:1,easy:true});await pick('apple',true);await settle();assert.equal(await page.locator('.ad-review').count(),0);
 await pick('consume',true);await settle();assert.match(await page.locator('.ad-review').innerText(),/consume · 먹다/);
 console.log('PASS direct-tap mode rejects wrong word and accepts registered same-meaning word');

 await setup({count:16,many:true});
 // Reopen persisted source before playing all 16 targets, including targets beyond the 12 visible choices.
 await page.reload();await startGame();
 for(let i=0;i<16;i++){
  assert.match(await page.locator('.claw-meaning-prompt').innerText(),new RegExp('뜻 '+i+'(?:\\s|$)'));
  assert.equal(await page.locator('.claw-capsule').count(),12);
  await pick('word'+i);await settle();await page.locator('.ad-review .ad-primary').click();
 }
 assert.equal(await page.locator('.ad-results li').count(),16);
 console.log('PASS saved/reopened game and all 16 rounds keep their target in the 12 choices');

 await setup({count:1,blank:true});await page.getByText('영어 단어와 뜻을 빠짐없이 입력해 주세요.',{exact:true}).first().waitFor();
 assert.equal(await page.locator('.claw-capsule').count(),0);
 await setup({count:1,picture:true,blank:true});await page.locator('[data-picture-word]').waitFor();
 const wrong=await page.locator('.claw-capsule:not([data-word="apple"])').first().getAttribute('data-word');
 await pick(wrong);await settle();assert.equal(await page.locator('.ad-review').count(),0);
 await pick('apple');await settle();assert.match(await page.locator('.ad-review').innerText(),/apple/);
 console.log('PASS missing-meaning guidance and picture mode without meanings, including wrong/right grading');

 await setup({count:1});await page.getByText('먹다',{exact:true}).waitFor();
 if(output)await page.screenshot({path:output+'/meaning-question.jpg'});
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
