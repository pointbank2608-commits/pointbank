import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createServer} from 'vite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const out='../output/phonics-lessons',pdfOut='../tmp/pdfs/worksheet-studio';await mkdir(out,{recursive:true});await mkdir(pdfOut,{recursive:true});
const env=await readFile('.env.local','utf8'),ref=env.match(/VITE_SUPABASE_URL=https:\/\/([^.]+)/)[1];
const uid='00000000-0000-4000-8000-000000000001',aid='00000000-0000-4000-8000-0000000000aa';
const exp=Math.floor(Date.now()/1000)+86400,b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const user={id:uid,aud:'authenticated',role:'authenticated',email:'worksheet-qa@example.test',app_metadata:{},user_metadata:{}};
const session={access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,role:'authenticated',exp,aud:'authenticated'})}.test-only`,refresh_token:'test-only',expires_at:exp,expires_in:86400,token_type:'bearer',user};
const profile={id:uid,academy_id:aid,role:'owner',display_name:'Worksheet QA'},academy={id:aid,name:'Worksheet QA',point_unit:'별',plan:'paid',plan_status:'active',deletion_requested_at:null,features:{group:true,solo:true,homework:true}};
const server=await createServer({server:{host:'127.0.0.1',port:Number(process.env.PHONICS_QA_PORT||5250),strictPort:true},logLevel:'error'});await server.listen();
const {WORKSHEET_ACTIVITIES,WORKSHEET_BASIC_ACTIVITIES}=await server.ssrLoadModule('/src/lib/worksheetActivityCatalog.ts');
const {exampleWorksheet}=await server.ssrLoadModule('/src/lib/worksheetActivitySamples.ts');
const {studioKey}=await server.ssrLoadModule('/src/lib/worksheetStudio.ts');
const {curriculumEntries}=await server.ssrLoadModule('/src/data/phonicsCurriculum.ts');
const common=curriculumEntries();
const getWord=word=>common.find(e=>e.word===word&&e.step>=2)||common.find(e=>e.word===word);
const list={id:'worksheet-word-list',name:'우리 반 동물 단어',kind:'word',class_id:null,academy_id:aid,updated_at:'2026-10-25',items:['frog','duck','fish','pig'].map((word,i)=>{const e=getWord(word);return {id:'source-'+i,word,meaning:e.meaning,image_url:e.image_url,category:i<2?'A':'B',patternMarked:e.pattern_marked};})};
const sentenceList={...list,id:'worksheet-sentence-list',name:'우리 반 문장',kind:'sentence',items:[{id:'line1',word:'Our class can help.',meaning:'우리 반은 도울 수 있어요.',image_url:null,category:null}]};
let mediaRows=[];const writes=[];
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
await context.addInitScript(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('classbank.lang','ko');localStorage.setItem('classbank.printWatermark','off');},{key:`sb-${ref}-auth-token`,session});
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});if(!['GET','HEAD'].includes(req.method())&&!path.includes('/auth/')&&!path.includes('/rpc/'))writes.push(path);
 const single=(req.headers().accept||'').includes('vnd.pgrst.object');let data=single?{}:[];
 if(path.includes('/auth/v1/user'))data=user;else if(path.includes('/auth/v1/'))data=session;
 else if(path.endsWith('/profiles'))data=single?profile:[profile];else if(path.endsWith('/academies'))data=single?academy:[academy];
 else if(path.endsWith('/classes'))data=[{id:'class-qa',academy_id:aid,name:'검증 반'}];
 else if(path.endsWith('/word_lists'))data=[list,sentenceList];
 else if(path.endsWith('/phonics_bank'))data=mediaRows;
 else if(path.endsWith('/word_bank'))data=list.items.map((w,i)=>({...w,example_sentence:`I can see a ${w.word}.`,part_of_speech:'명사',sense_number:1,sort_order:i}));
 else if(path.endsWith('/rpc/my_deletion_request'))data=null;
 return route.fulfill({status:200,headers,json:data});
});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const root=process.env.PHONICS_QA_URL||('http://127.0.0.1:'+(process.env.PHONICS_QA_PORT||5250));
const {courseUnits,lessonSlides,builderParts,pictureContext}=await server.ssrLoadModule('/src/data/phonicsLessons.ts');
const {unitsForStep}=await server.ssrLoadModule('/src/data/phonicsCurriculum.ts');
const {stat}=await import('node:fs/promises');
const {createHash}=await import('node:crypto');
const {execFileSync}=await import('node:child_process');
const result={passed:false,errors,units:[],missingImages:[],recordings:0,browserSpeech:0,slides:0};
const production=process.argv.includes('--production');
try{
 const units=courseUnits(common);assert.equal(units.length,42);assert.equal(new Set(units.map(u=>u.id)).size,42);
 assert.deepEqual([1,2,3,4,5].map(n=>units.filter(u=>u.step===n).length),[9,8,8,8,9]);
 for(const step of [1,2,3,4,5])assert.deepEqual(units.filter(u=>u.step===step).flatMap(u=>u.entries.map(e=>e.id)),unitsForStep(step).flatMap(u=>u.entries.map(e=>e.id)),'exact print rule/word order '+step);
 assert.deepEqual(units.find(u=>u.id==='course-4-1').entries.map(e=>e.word),['black','block','blank','blink','clap','clip','club','clam','clock','flag','flat','flap','flip']);
 assert.deepEqual(units.find(u=>u.id==='course-5-1').entries.map(e=>e.word),['bee','tree','seed','feet','sea','tea','meat','leaf']);
 assert.deepEqual(builderParts(common.find(e=>e.step===2&&e.word==='ox'),2),['ox']);
 const learnedWords=new Set(),learnedSight=new Set(['i','see','a']);
 for(const u of units){const slides=lessonSlides(u);result.slides+=slides.length;
  u.entries.forEach(e=>learnedWords.add(e.word.toLowerCase()));u.reading.newSightWords.forEach(w=>learnedSight.add(w.toLowerCase()));
  if(u.reading.status==='draft')assert.equal(u.reading.newSightWords.length,1,'one new sight word '+u.id);
  for(const sentence of u.reading.sentences)for(const token of sentence.toLowerCase().replace(/[^a-z -]/g,'').split(/\s+/))assert(learnedWords.has(token)||learnedSight.has(token),'unlearned reader token '+u.id+': '+token);
  assert(u.reading.entries.every(e=>learnedWords.has(e.word.toLowerCase())));
  if(u.reading.status==='draft')assert(slides.filter(s=>s.kind==='read').every(s=>s.draft),'draft reading label '+u.id);for(const s of slides.filter(s=>s.kind==='readChoose')){assert(!s.hint.includes(' or '),'choice questions need their pointed-scene context');if(s.hint.includes(' and '))assert.equal(s.answerIds.length,2);}
  assert(slides.length>0);assert.equal(slides.at(-1).title,'The end of slide');assert(!slides.some(s=>/Your Turn|It’s|It's/i.test(s.title)));if(u.step>=4)assert(!slides.some(s=>/missing|shadow/i.test(s.title)));
  for(const s of slides){for(const id of s.entryIds)assert([...u.entries,...u.reading.entries].some(e=>e.id===id));for(const id of s.answerIds)assert([...u.entries,...u.reading.entries].some(e=>e.id===id));}
  for(const [lesson,kind] of [[1,'group'],[2,'group'],[2,'write']])assert.deepEqual([...new Set(slides.filter(s=>s.lesson===lesson&&s.kind===kind).flatMap(s=>s.entryIds))],u.entries.map(e=>e.id),'all words covered '+u.id+kind);
  for(const s of slides.filter(s=>s.kind==='puzzle'))assert(!s.entryIds.some(id=>pictureContext(u.entries.find(e=>e.id===id))),'context word must not be a picture-only guessing puzzle');
  for(const e of u.entries){assert.equal(builderParts(e,u.step).join(''),e.word);if(!e.image_url)result.missingImages.push(e.word);else if(e.image_url.startsWith('/'))assert((await stat('public'+e.image_url)).isFile());if(e.audio?.recordingUrl)result.recordings++;else result.browserSpeech++;}
  const ee=u.entries.find(e=>e.soundId==='ee');if(ee)assert(builderParts(ee,u.step).includes('ee'));
  result.units.push({id:u.id,level:u.step,number:u.number,groups:u.groups.map(g=>({ruleId:g.ruleId,label:g.label,words:g.entries.map(e=>e.word)})),wordCount:u.entries.length,slides:slides.length,lessons:[1,2,'extra'].map(n=>slides.filter(s=>s.lesson===n).length),reader:u.reading.status});
 }
 for(const file of ['src/data/phonics/curriculum.json','src/data/cvcWorkbook.ts','src/data/phonicsStage1.ts','src/data/phonicsStage1Workbook.ts'])assert.equal(createHash('sha256').update((await readFile(file,'utf8')).replace(/\r\n/g,'\n')).digest('hex'),createHash('sha256').update(execFileSync('git',['show','HEAD:app/'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n')).digest('hex'),'existing workbook configuration unchanged');
 assert.deepEqual(result.missingImages,[]);
 if(process.argv.includes('--data-only')){result.passed=true;console.log(JSON.stringify({passed:true,units:units.length,slides:result.slides}));}else if(production){await page.goto(root+'/phonics?tab=course');await page.locator('#phonics-words-panel').waitFor();assert.equal(await page.getByRole('tab',{name:'슬라이드 수업·교재',exact:true}).count(),0);await page.goto(root+'/phonics/lesson?unit=course-4-1');await page.getByText('수업 자료는 아직 운영 공개 전입니다.').waitFor();assert.equal(await page.locator('[data-course-player]').count(),0);}
 else{
  await context.addInitScript(()=>{window.__spoken=[];if(window.speechSynthesis){window.speechSynthesis.speak=u=>window.__spoken.push(u.text);window.speechSynthesis.cancel=()=>{};}});
  await page.goto(root+'/phonics?tab=course&level=4&unit=course-4-1');await page.getByRole('link',{name:'1차시 수업 시작',exact:true}).waitFor();assert((await page.locator('[data-teaching-words]').innerText()).includes('black · block · blank · blink · clap · clip · club · clam · clock · flag · flat · flap · flip'));
  await page.screenshot({path:out+'/catalog-desktop.png'});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/catalog-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
  const visit=async(u,s)=>{const current=new URL(page.url());if(current.pathname==='/phonics/lesson'&&current.searchParams.get('unit')===u.id&&current.searchParams.get('lesson')===String(s.lesson)){await page.locator('.pc-player-controls select').selectOption(s.id);}else await page.goto(root+`/phonics/lesson?unit=${u.id}&lesson=${s.lesson}&slide=${encodeURIComponent(s.id)}`);await page.locator(`[data-course-slide="${s.id}"]`).waitFor();await page.locator('.s1-slide img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));assert.equal(await page.locator('[data-course-kind]').getAttribute('data-course-kind'),s.kind);};
  // Every unit renders a real study slide, and both lessons contain all core entries.
  for(const u of units){await visit(u,lessonSlides(u).find(s=>s.kind==='group'));assert.equal(await page.locator('.s1-media-error').count(),0);}
  const u=units.find(u=>u.id==='course-4-1'),slides=lessonSlides(u);
  const match=slides.find(s=>s.kind==='match'&&s.phase===0);await visit(u,match);const order=await page.locator('[data-match-order]').getAttribute('data-match-order');const imgs=await page.locator('.pc-match-pictures img').evaluateAll(es=>es.map(e=>({src:e.getAttribute('src'),x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));await page.locator('[data-course-next]').click();await page.waitForFunction(()=>document.querySelector('.pc-match small'));assert.equal(await page.locator('[data-match-order]').getAttribute('data-match-order'),order);assert.deepEqual(await page.locator('.pc-match-pictures img').evaluateAll(es=>es.map(e=>({src:e.getAttribute('src'),x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}))),imgs);await page.screenshot({path:out+'/matching-answer.png'});
  const puzzle=slides.find(s=>s.kind==='puzzle'&&s.phase===0);await visit(u,puzzle);assert.equal(await page.locator('.pc-game .s1-word').count(),0);await page.locator('[data-course-next]').click();await page.waitForFunction(()=>document.querySelector('.pc-game')?.dataset.gamePhase==='1');assert.equal(await page.locator('.pc-game').getAttribute('data-game-phase'),'1');assert.equal(await page.locator('.pc-game .s1-word').count(),0);await page.screenshot({path:out+'/puzzle.png'});await page.locator('[data-course-next]').click();await page.waitForFunction(()=>document.querySelector('.pc-game')?.dataset.gamePhase==='2');assert.equal(await page.locator('.pc-game .s1-word').textContent(),'black');await page.getByRole('button',{name:'이 활동 다시 보기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.pc-game')?.dataset.gamePhase==='0');assert.equal(await page.locator('.pc-game').getAttribute('data-game-phase'),'0');
  const memory=slides.find(s=>s.kind==='memory'&&s.phase===0);await visit(u,memory);await page.locator('[data-course-next]').click();await page.waitForFunction(()=>document.querySelector('.pc-memory')?.dataset.gamePhase==='1');assert.equal(await page.locator('.pc-memory .s1-word').count(),0);await page.locator('[data-course-next]').click();await page.waitForFunction(()=>document.querySelector('.pc-memory')?.dataset.gamePhase==='2');assert(await page.locator('.pc-memory .s1-word').isVisible());
  await visit(u,slides.find(s=>s.kind==='write'));await page.screenshot({path:out+'/writing.png'});assert(await page.locator('[data-writing=trace]').count());
  const read=slides.filter(s=>s.kind==='read');await visit(u,read[0]);const scene=await page.locator('.pc-reader-scene>img').getAttribute('src');const sceneRect=await page.locator('.pc-reader-scene').boundingBox();await page.screenshot({path:out+'/reading.png'});await page.locator('[data-course-next]').click();assert.equal(await page.locator('.pc-reader-scene>img').getAttribute('src'),scene);assert.deepEqual(await page.locator('.pc-reader-scene').boundingBox(),sceneRect);
  const five=units.find(u=>u.id==='course-5-1');await visit(five,lessonSlides(five).find(s=>s.kind==='builder'));assert.deepEqual(await page.locator('[data-builder-part]').allTextContents(),['b','ee']);await page.screenshot({path:out+'/level5-builder.png'});
  await page.locator('.pc-word-card .s1-speaker').click();assert((await page.evaluate(()=>window.__spoken)).includes('bee'));
  await page.setViewportSize({width:1366,height:768});for(const step of [1,2,3,4,5]){const u=units.find(u=>u.step===step);await visit(u,lessonSlides(u).find(s=>s.kind=== (step===1?'introduce':'group')));await page.getByRole('button',{name:'화면 크게 보기',exact:true}).click();assert.equal(await page.locator('.pc-lesson-slide').evaluate(e=>getComputedStyle(e).backgroundColor),['rgb(229, 243, 255)','rgb(251, 224, 233)','rgb(220, 238, 224)','rgb(236, 229, 248)','rgb(255, 241, 188)'][step-1]);await page.screenshot({path:out+`/level-${step}-large.png`});assert(await page.evaluate(()=>{const e=document.querySelector('.pc-lesson-slide'),r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}));await page.keyboard.press('Escape');assert.equal(await page.locator('.pc-player-full').count(),0);}
 }
 // Review representative variants, including draft reading, with child bounds inside the slide.
  if(!production&&!process.argv.includes('--data-only')){
   for(const id of ['course-1-1','course-1-2','course-3-8','course-4-1','course-4-7','course-5-1']){
    const u=units.find(x=>x.id===id),seen=new Set();
    for(const s of lessonSlides(u)){
     const key=s.kind+':'+s.phase;if(seen.has(key))continue;seen.add(key);
     await page.goto(root+`/phonics/lesson?unit=${u.id}&lesson=${s.lesson}&slide=${encodeURIComponent(s.id)}`);await page.locator(`[data-course-slide="${s.id}"]`).waitFor();
     await page.locator('.s1-slide img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));
     const overflow=await page.locator('.s1-slide-body').evaluate(body=>{const r=body.getBoundingClientRect();return [...body.querySelectorAll('img,.s1-word,.pc-big-title,.s1-writing-lines')].filter(e=>{const q=e.getBoundingClientRect();return q.width>0&&q.height>0&&(q.left<r.left-2||q.right>r.right+2||q.top<r.top-2||q.bottom>r.bottom+2);}).map(e=>e.className);});
     assert.deepEqual(overflow,[],'slide body overflow '+u.id+' '+key);
     if(s.draft){assert(await page.locator('.pc-draft-badge').isVisible());assert((await page.locator('.pc-draft-badge').innerText()).includes('검토'));}
     if(s.kind==='read'&&s.draft)await page.screenshot({path:out+'/draft-'+u.id+'.png'});
    }
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);result.passed=true;console.log(JSON.stringify({passed:true,units:result.units.length,slides:result.slides,missing:result.missingImages,production}));
}finally{await writeFile(out+`/${production?'production':'development'}-checks.json`,JSON.stringify(result,null,2));await browser.close();await server.close();}
