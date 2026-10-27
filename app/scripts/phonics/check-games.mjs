import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const out='../output/phonics-games-v2';await mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5264,strictPort:true},logLevel:'error'});await server.listen();
let browser;
try {
 const model=await server.ssrLoadModule('/src/lib/phonicsGames.ts');
 const {PHONICS_GAMES:games,phonicsGameUnits,gameAvailability,gamePool,makeRound,patternKey,shuffled,targetText,pictureEligible,alphabetGlyph}=model;
 const units=phonicsGameUnits();assert.equal(games.length,40);assert.equal(new Set(games.map(g=>g.id)).size,40);assert.equal(units.length,42);
 const visuals=await server.ssrLoadModule('/src/lib/phonicsGameVisuals.ts');
 assert.deepEqual(Object.keys(visuals.PHONICS_VISUALS).sort(),games.map(g=>g.id).sort());
 for(const world of Object.keys(visuals.PHONICS_WORLDS))assert((await readFile(`public${visuals.worldBackground(world)}`)).length>1000);
 let checked=0;const cases=[];
 for(const g of games){
  const eligible=units.filter(u=>!gameAvailability(g,u));assert(eligible.length,`${g.id}: no eligible unit`);cases.push({game:g.id,unit:eligible[0].id,eligibleUnits:eligible.length});
  for(const u of eligible)for(let i=0;i<10;i++){
   const r=makeRound(g,u,i,123);assert(r.entry,`${g.id}/${u.id}`);assert(r.options.length>=2||!['choice','read','puzzle'].includes(g.mechanic));
   assert.equal(new Set(r.options.map(e=>e.word)).size,r.options.length);
   if(g.mechanic==='build')assert.equal(r.tokens.join(''),r.entry.word);
   if(g.mechanic==='fill')assert(r.answer.length&&r.masked.includes('_'));
   if(g.mechanic==='change')assert(r.source&&r.source.word!==r.entry.word&&patternKey(u,r.source)===patternKey(u,r.entry));
   if(['read-and-move','sentence-bridge','our-storybook'].includes(g.id))assert.equal(u.reading.status,'approved');
   if(['sound-fishing','monster-diner','word-treasure','picture-puzzle'].includes(g.id))assert(r.options.every(pictureEligible));
   checked++;
  }
 }
 assert(gameAvailability(games.find(g=>g.id==='sentence-bridge'),units.find(u=>u.id==='course-1-2')));
 const oo=games.find(g=>g.id==='two-oo'),oou=units.find(u=>u.id==='course-5-4');assert.deepEqual([...new Set(gamePool(oo,oou).map(e=>e.ruleId))].sort(),['oo-long','oo-short']);
 const ow=games.find(g=>g.id==='ow-crossroads');assert(gameAvailability(ow,units.find(u=>u.id==='course-5-3')));assert.equal(gamePool(ow,units.find(u=>u.id==='course-5-6')).length,8);
 const blend=games.find(g=>g.id==='blend-launch');assert(makeRound(blend,units.find(u=>u.id==='course-4-1'),0,123).tokens.every(t=>t.length===1));
 assert.equal(alphabetGlyph(units.find(u=>u.id==='course-1-6').entries.find(e=>e.word==='queen')),'q');
 assert.equal(targetText(units.find(u=>u.id==='course-1-8').entries.find(e=>e.word==='box')),'x');
 console.log(`PASS ${checked} game/unit/round combinations; 40 games, approved readers, OO/OW, target tiles`);
 if(process.argv.includes('--data-only'))process.exitCode=0;
 else {
  const env=await readFile('.env.local','utf8'),ref=env.match(/VITE_SUPABASE_URL=https:\/\/([^.]+)/)[1];
  const uid='00000000-0000-4000-8000-000000000001',aid='00000000-0000-4000-8000-0000000000aa',exp=Math.floor(Date.now()/1000)+86400;
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const user={id:uid,aud:'authenticated',role:'authenticated',email:'phonics-qa@example.test',app_metadata:{},user_metadata:{}};
  const session={access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,role:'authenticated',exp,aud:'authenticated'})}.test-only`,refresh_token:'test-only',expires_at:exp,expires_in:86400,token_type:'bearer',user};
  const profile={id:uid,academy_id:aid,role:'owner',display_name:'Phonics QA'},academy={id:aid,name:'Phonics QA',point_unit:'별',plan:'paid',plan_status:'active',deletion_requested_at:null,features:{group:true,solo:true,homework:true}};
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100}});
  await context.addInitScript(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));if(!localStorage.getItem('classbank.lang'))localStorage.setItem('classbank.lang','ko');crypto.getRandomValues=a=>{a.fill(123);return a;};window.__spoken=[];speechSynthesis.speak=u=>window.__spoken.push(u.text);},{key:`sb-${ref}-auth-token`,session});
  const writes=[],errors=[];
  await context.route('**/*.supabase.co/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});if(!['GET','HEAD'].includes(req.method())&&!path.includes('/auth/')&&!path.includes('/rpc/'))writes.push(path);const single=(req.headers().accept||'').includes('vnd.pgrst.object');let data=single?{}:[];if(path.includes('/auth/v1/user'))data=user;else if(path.includes('/auth/v1/'))data=session;else if(path.endsWith('/profiles'))data=single?profile:[profile];else if(path.endsWith('/academies'))data=single?academy:[academy];else if(path.endsWith('/classes'))data=[{id:'class-qa',academy_id:aid,name:'검증 반'}];else if(path.endsWith('/rpc/my_deletion_request'))data=null;return route.fulfill({status:200,headers,json:data});});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);const root='http://127.0.0.1:5264';
  await page.goto(root+'/phonics-games');await page.locator('[data-game-card]').first().waitFor();await page.screenshot({path:out+'/catalog-desktop.png',fullPage:true});
  const solve=async(g,u,index)=>{
   const r=makeRound(g,u,index,123),area=page.locator('[data-activity]');
   await area.waitFor();
   if(g.mechanic==='pairs'||g.mechanic==='memory'){
    let cards;
    if(g.mechanic==='pairs'){const letters=[...new Set(u.groups.map(g=>g.label[0]))].slice(0,3);cards=shuffled(letters.flatMap((letter,p)=>[{id:p,kind:0},{id:p,kind:1}]),123+index);}
    else{const pool=[...new Map(gamePool(g,u).map(e=>[e.word,e])).values()],pics=pool.filter(pictureEligible),entries=shuffled(pics.length>=2?pics:pool,123+index).slice(0,3);cards=shuffled(entries.flatMap((e,p)=>[{id:p,kind:0},{id:p,kind:1}]),123+index);}
    for(const id of new Set(cards.map(c=>c.id)))for(const i of cards.flatMap((c,i)=>c.id===id?[i]:[]))await area.locator('.pg-memory-card').nth(i).click();
   }else if(g.mechanic==='sort'){
    const groups=[...new Map(gamePool(g,u).map(e=>[patternKey(u,e),e])).values()];await area.locator('.pg-options>button').nth(groups.findIndex(e=>patternKey(u,e)===patternKey(u,r.entry))).click();
   }else if(g.mechanic==='hunt'){
    const target=alphabetGlyph(r.entry).toLowerCase(),letters=shuffled([...u.groups.map(g=>g.label[0]),...u.groups.map(g=>g.label[0].toLowerCase()),...u.groups.map(g=>g.label[0])],123+index);
    for(let i=0;i<letters.length;i++)if(letters[i].toLowerCase()===target)await area.locator('.pg-letter-field button').nth(i).click();
   }else if(g.mechanic==='trace'){
    const box=await area.locator('svg').boundingBox();await page.mouse.move(box.x+40,box.y+60);await page.mouse.down();await page.mouse.move(box.x+120,box.y+140,{steps:5});await page.mouse.up();await area.getByRole('button',{name:'선생님 확인 · 완료'}).click();
   }else if(g.mechanic==='build'||g.mechanic==='sentence'){
    if(g.mechanic==='sentence')await area.getByRole('button',{name:'문장 가리고 시작'}).click();
    const tokens=shuffled(r.tokens.map((text,id)=>({text,id})),123+index+24);for(let i=0;i<r.tokens.length;i++)await area.locator('.pg-token-bank>button').nth(tokens.findIndex(c=>c.id===i)).click();
   }else if(g.mechanic==='fill'||g.mechanic==='change'){
    const answer=g.mechanic==='change'?r.entry.word[0]:r.answer;await area.locator('.pg-token-bank').getByRole('button',{name:answer,exact:true}).click();
   }else if(g.mechanic==='bridge'||g.mechanic==='lab'){
    for(const i of g.mechanic==='lab'?[r.entry.word.length-1]:r.entry.targets)await area.locator('.pg-magic-word button').nth(i).click();
   }else if(g.mechanic==='position'){
    const p=r.entry.targets;await area.locator('.pg-options button').nth(p[0]===0?0:p.at(-1)===r.entry.word.length-1?1:2).click();
   }else if(g.mechanic==='odd'){
    const pool=[...new Map(gamePool(g,u).map(e=>[e.word,e])).values()],a=pool.find(e=>pool.filter(x=>patternKey(u,x)===patternKey(u,e)).length>=2),same=pool.filter(e=>patternKey(u,e)===patternKey(u,a)).slice(0,2),other=pool.find(e=>patternKey(u,e)!==patternKey(u,a)),opts=shuffled([...same,other],123+index);await area.locator('.pg-options button').nth(opts.findIndex(e=>e.id===other.id)).click();
   }else if(g.mechanic==='missing'){
    const pool=[...new Map(gamePool(g,u).map(e=>[e.word,e])).values()],list=shuffled(pool,123+index).slice(0,4);await area.getByRole('button',{name:'카드 가리기'}).click();await area.locator('.pg-options').getByRole('button',{name:list[index%list.length].word,exact:true}).click();
   }else if(g.mechanic==='bingo'){
    for(let n=0;n<9&&!await page.locator('.pg-next').count();n++){await area.getByRole('button',{name:'단어·문장 듣기',exact:true}).first().click();const word=await page.evaluate(()=>window.__spoken.at(-1));await area.locator('.pg-bingo').getByRole('button',{name:word,exact:true}).click();}
   }else{
    if(g.id==='sound-balloons'){const groups=shuffled([...new Map(gamePool(g,u).map(e=>[targetText(e).toLowerCase(),e])).values()],123+index);await area.locator('.pg-balloons>button').nth(groups.findIndex(e=>targetText(e).toLowerCase()===targetText(r.entry).toLowerCase())).click();}
    else {if(g.mechanic==='puzzle')for(let i=0;i<4;i++)await area.getByRole('button',{name:`${i+1}번 조각 열기`}).click();if(g.id==='word-treasure')await area.getByRole('button',{name:'읽었어요 · 상자 열기'}).click();await area.locator('.pg-options>button').nth(r.options.findIndex(e=>e.id===r.entry.id)).click();}
   }
   await page.locator('.pg-next').waitFor();
  };
  for(const c of process.argv.includes('--edges-only')?[]:cases){
   const g=games.find(g=>g.id===c.game),u=units.find(u=>u.id===c.unit);
   await page.goto(`${root}/phonics-games/${g.id}?unit=${u.id}`);await page.getByRole('button',{name:'게임 시작',exact:true}).waitFor();await page.getByLabel('문제 수',{exact:true}).selectOption('3');await page.getByRole('button',{name:'게임 시작',exact:true}).click();
   assert.equal(await page.locator('[data-play-world]').getAttribute('data-play-world'),visuals.gameVisual(g).world);
   if(g.id==='letter-partners')assert(Number.parseFloat(await page.locator('.pg-memory-card').first().evaluate(el=>getComputedStyle(el).fontSize))>=38);
   await page.screenshot({path:out+`/${g.id}-desktop.png`,fullPage:true});
   await page.setViewportSize({width:390,height:844});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${g.id}: mobile overflow`);
   await page.screenshot({path:out+`/${g.id}-mobile.png`,fullPage:true});
   await page.setViewportSize({width:1440,height:1100});
   for(let i=0;i<3;i++){
    let activity=g;
    if(g.mechanic==='adventure'){
     const ids=g.theme==='book'?['read-and-move','sentence-bridge','read-and-move']:u.step===1?['sound-balloons','sound-baskets','memory-cards']:['sound-fishing',u.step===2?'sound-train':u.step===3?'magic-builder':u.step===4?'consonant-repair':'vowel-chef','word-treasure'];activity=games.find(g=>g.id===ids[i%ids.length]);if(gameAvailability(activity,u))activity=games.find(g=>g.id==='sound-fishing');
    }
    await solve(activity,u,i);
    assert.equal(await page.locator('[data-reaction]').getAttribute('data-reaction'),'success');
    if(g.id==='sound-train'&&i===0){await page.getByRole('button',{name:'잠시 멈춤',exact:true}).click();assert.equal(await page.locator('.pg-next').isVisible(),false);await page.getByRole('button',{name:'이어서 하기',exact:true}).click();await page.locator('.pg-next').waitFor();}
    if(['sound-train','two-oo','magic-bridge'].includes(g.id)&&i===0)await page.screenshot({path:out+`/${g.id}.png`,fullPage:true});
    await page.locator('.pg-next').click();
   }
   await page.getByRole('heading',{name:'오늘도 잘했어요!'}).waitFor();console.log('PASS browser',g.id);
   assert(await page.evaluate(id=>JSON.parse(sessionStorage.getItem('classbank.phonics.village.v2')||'[]').some(r=>r.gameId===id),g.id));
  }
  // Themed adventures retain their own mascot, but still show assembled word pieces.
  for(const id of ['phonics-farm','dino-expedition','space-rescue','phonics-island']){
   const u=units.find(u=>u.id==='course-2-1');await page.goto(`${root}/phonics-games/${id}?unit=${u.id}`);await page.getByRole('button',{name:'게임 시작',exact:true}).click();
   await solve(games.find(g=>g.id==='sound-fishing'),u,0);await page.locator('.pg-next').click();
   assert.equal(await page.locator('.pg-build-track').evaluate(el=>getComputedStyle(el).position),'static');
   await solve(games.find(g=>g.id==='sound-train'),u,1);
   assert.equal(await page.locator('.pg-filled').count(),makeRound(games.find(g=>g.id==='sound-train'),u,1,123).tokens.length);
  }
  await page.goto(root+'/phonics-games/sentence-bridge?unit=course-1-2');await page.getByText('이 유닛의 읽기 문장은 검토 중이에요.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'게임 시작',exact:true}).count(),0);
  await page.goto(root+'/phonics-games/missing?unit=bad');await page.getByRole('alert').waitFor();
  await page.goto(root+'/phonics-games?unit=course-4-1');await page.locator('[data-game-card]').first().waitFor();await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/catalog-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto(root+'/phonics-games/sound-train?unit=course-2-1');await page.getByRole('button',{name:'게임 시작',exact:true}).click();await solve(games.find(g=>g.id==='sound-train'),units.find(u=>u.id==='course-2-1'),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:out+'/play-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'크게 보기',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'이어서 하기',exact:true}).click();await page.locator('.pg-next').waitFor();
  // Retry + help must not become a first-attempt success. Pause must preserve a partly built word.
  const train=games.find(g=>g.id==='sound-train'),trainUnit=units.find(u=>u.id==='course-2-1');
  await page.goto(root+'/phonics-games/sound-train?unit=course-2-1');await page.getByLabel('문제 수',{exact:true}).selectOption('3');await page.getByRole('button',{name:'게임 시작',exact:true}).click();
  const first=makeRound(train,trainUnit,0,123),tokens=shuffled(first.tokens.map((text,id)=>({text,id})),147);
  await page.locator('.pg-token-bank button').nth(tokens.findIndex(t=>t.id===1)).click();await page.getByText('다시 살펴볼까요?',{exact:false}).waitFor();
  await page.locator('.pg-token-bank button').nth(tokens.findIndex(t=>t.id===0)).click();assert.equal(await page.locator('.pg-filled').count(),1);
  assert.equal(await page.locator('.pg-word-carriage b').first().textContent(),first.tokens[0]);
  await page.getByRole('button',{name:'잠시 멈춤',exact:true}).click();await page.getByRole('button',{name:'이어서 하기',exact:true}).click();assert.equal(await page.locator('.pg-filled').count(),1);
  await page.locator('.pg-hint summary').click();await page.locator('.pg-hint[open]').waitFor();
  await page.locator('.pg-token-bank button').nth(tokens.findIndex(t=>t.id===1)).click();await page.locator('.pg-next').click();
  for(let i=1;i<3;i++){await solve(train,trainUnit,i);await page.locator('.pg-next').click();}
  await page.getByText('첫 시도에 혼자 맞힘: 2',{exact:false}).waitFor();
  const rewardCount=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('classbank.phonics.village.v2')||'[]').length);
  const beforeReplay=await rewardCount();await page.getByRole('button',{name:'다시 하기',exact:true}).click();
  for(let i=0;i<3;i++){await solve(train,trainUnit,i);await page.locator('.pg-next').click();}
  await page.getByRole('heading',{name:'오늘도 잘했어요!'}).waitFor();assert.equal(await rewardCount(),beforeReplay);
  await page.goto(root+'/phonics-games?unit=course-2-1');await page.getByRole('button',{name:'바닷가 놀이터',exact:true}).click();
  assert((await page.locator('[data-game-card]').count())>0);assert((await page.locator('[data-game-card] [data-cover-world]').evaluateAll(els=>els.every(el=>el.dataset.coverWorld==='coast'))));
  await page.getByRole('button',{name:'새 마을 시작',exact:true}).click();assert.equal(await rewardCount(),0);
  for(const id of ['course-1-6','course-1-8']){
   const unit=units.find(u=>u.id===id),hunt=games.find(g=>g.id==='letter-explorers');
   await page.goto(root+`/phonics-games/letter-explorers?unit=${id}`);await page.getByLabel('문제 수',{exact:true}).selectOption('10');await page.getByRole('button',{name:'게임 시작',exact:true}).click();
   for(let i=0;i<9;i++){await solve(hunt,unit,i);await page.locator('.pg-next').click();}
  }
  await page.goto(root+'/phonics-games/sound-fishing?unit=course-2-1');await page.getByRole('button',{name:'게임 시작',exact:true}).click();
  await page.evaluate(()=>{speechSynthesis.speak=u=>u.onerror?.({error:'synthesis-failed'});});await page.locator('[data-activity]').getByRole('button',{name:'단어·문장 듣기',exact:true}).first().click();await page.getByText('이 기기에서 음성을 재생할 수 없어요. 선생님이 읽어 주세요.',{exact:true}).waitFor();
  await page.evaluate(()=>{localStorage.setItem('classbank.lang','en');});await page.goto(root+'/phonics-games?unit=course-5-4');await page.getByRole('heading',{name:'Phonics Games',exact:true}).waitFor();await page.getByRole('heading',{name:'Two OO Sounds',exact:true}).waitFor();
  await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:out+'/catalog-english.png',fullPage:true});
  // Broken images fall back to readable text instead of an empty answer card.
  await page.route('**/*.webp',route=>route.abort());await page.goto(root+'/phonics-games/monster-diner?unit=course-2-1');await page.getByRole('button',{name:'Start game',exact:true}).click();await page.locator('.pg-picture-fallback').filter({hasText:'Read the word instead'}).first().waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  await writeFile(out+(process.argv.includes('--edges-only')?'/edge-checks.json':'/checks.json'),JSON.stringify({passed:true,checked,cases,browserGames:process.argv.includes('--edges-only')?0:40,errors,writes,mobile:true,pausePreservesState:true,retryScoring:true,qAndX:true,speechFailure:true,brokenImages:true,english:true,worldFilters:true,villageReplayDedupAndReset:true,actualCarriageLetters:true},null,2));
  console.log('PASS edge cases: retry/help scoring, pause state, Q/X, speech errors, broken images, English and mobile');
 }
} finally {await browser?.close();await server.close();}
