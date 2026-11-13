import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),out=resolve(root,'../output/ready-media');mkdirSync(out,{recursive:true});
const names=[...readFileSync(resolve(root,'src/lib/api.ts'),'utf8').matchAll(/export (?:async )?function (\w+)|export const (\w+)/g)].map(m=>m[1]||m[2]);
const syntheticClip={id:'synthetic-clip',series:'Synthetic classroom',title:'Synthetic fruit conversation',summary:'Test only',youtube_id:'abcdefghijk',channel:'Synthetic channel',start_sec:10,end_sec:40,level:2,tags:['fruit','asking politely'],script:'[0:10-0:16] Anna: I like apples. | 나는 사과를 좋아해요.\n[0:17-0:23] Ben: Do you like bananas? | 바나나를 좋아하니?\n[0:24-0:30] Anna: Yes, I do. | 응, 좋아해.',words:['apple','banana'],pack:{words:[{word:'apple',meaning:'사과',example:'I like apples.',time:10},{word:'banana',meaning:'바나나',example:'Do you like bananas?',time:17}],questions:[{q:'What fruit does Anna like?',a:'Apples.',time:10,end:16},{q:'What fruit does Ben ask about?',a:'Bananas.',time:17,end:23}]},sort_order:0,hidden:false};
const clip=process.env.READY_LIVE_VIDEO==='1'?JSON.parse(readFileSync(resolve(root,'../tmp/ready-media/public-clips.json'),'utf8').replace(/^\uFEFF/,''))[Number(process.env.READY_CLIP_INDEX??0)]:syntheticClip;
const worksheetClips = process.env.ANIMATION_PRINT_FIXTURE
  ? JSON.parse(readFileSync(process.env.ANIMATION_PRINT_FIXTURE,'utf8').replace(/^\uFEFF/, ''))
  : [];
const api=`import {curriculumEntries} from '/src/data/phonicsCurriculum';const funcs={fetchPhonicsBank:async()=>curriculumEntries(false),fetchWordBank:async()=>[]};${names.map(n=>`export const ${n}=(...args)=>(funcs.${n}|| (async()=>[]))(...args);`).join('\n')}`;
const db=`window.__db=window.__db||{rows:[${JSON.stringify(clip)},...${JSON.stringify(worksheetClips)}],writes:[],fail:false};export const supabase={rpc:async()=>({data:null,error:null}),channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}}),from(table){let mode='read',payload,filters=[];const q={select(){return q},order(){return q},eq(k,v){filters.push([k,v]);return q},maybeSingle(){return q},insert(p){mode='insert';payload=p;return q},update(p){mode='update';payload=p;return q},then(ok,bad){const db=window.__db;const rows=db.rows.filter(r=>filters.every(([k,v])=>r[k]===v));if(db.fail)return Promise.resolve({data:null,error:new Error('synthetic database failure')}).then(ok,bad);if(mode==='insert'){db.rows.push({id:crypto.randomUUID(),hidden:false,...payload});db.writes.push({mode,payload});}if(mode==='update'){rows.forEach(r=>Object.assign(r,payload));db.writes.push({mode,payload});}return Promise.resolve({data:table==='video_clips'?(filters.length?rows[0]??null:rows):[],error:null}).then(ok,bad)}};return q;}};`;
const server=await createServer({root,cacheDir:'node_modules/.vite/qa-ready-media',logLevel:'error',plugins:[{name:'isolated-ready-media',enforce:'pre',load(id){const p=id.replaceAll('\\','/');if(process.env.READY_LIVE_VIDEO==='1'&&p.endsWith('/src/components/ShadowBoard.tsx'))return readFileSync(id,'utf8').replace('setReady(true);','setReady(true);window.__livePlayer=playerRef.current;');if(process.env.READY_LIVE_VIDEO==='1'&&p.endsWith('/src/components/SceneOverlay.tsx'))return readFileSync(id,'utf8').replace('player?.seekTo(time, true);','window.__liveScene={player,start:time,end};player?.seekTo(time, true);');if(p.endsWith('/src/lib/api.ts'))return api;if(p.endsWith('/src/context/AuthContext.tsx'))return `export const useAuth=()=>({isAdmin:!location.search.includes('nonadmin'),isStaff:true,academy:{id:'qa-only',features:{}},profile:{id:'qa-only'}});`;if(p.endsWith('/src/lib/supabase.ts'))return db;if(p.endsWith('/src/context/ToastContext.tsx'))return `export const useToast=()=>({notify:()=>{},run:async f=>{await f();return true;}});`;}}],server:{host:'127.0.0.1',port:5371,strictPort:true,hmr:false}});
const result={units:[],checks:[],errors:[]};let browser,page;
const pass=x=>{result.checks.push(x);console.log('PASS',x);};
const go=async path=>{await page.goto(`http://127.0.0.1:5371/scripts/ready-media/fixture.html?go=${encodeURIComponent(path)}`);await page.waitForFunction(()=>!!window.__models);};
try{
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>result.errors.push(String(e)));
 if(process.env.READY_LIVE_VIDEO!=='1')await page.addInitScript(()=>{window.__yt={time:10,playing:false,speed:1,plays:0,instances:0};window.YT={PlayerState:{ENDED:0,PLAYING:1},Player:class{constructor(id,opts){window.__yt.instances++;this.opts=opts;const el=document.getElementById(id);if(el)el.textContent='Synthetic YouTube API';setTimeout(()=>opts.events?.onReady?.(),10);}getCurrentTime(){return window.__yt.time;}getPlayerState(){return window.__yt.playing?1:window.__yt.plays===0?-1:2;}loadVideoById({startSeconds}){window.__yt.time=startSeconds;window.__yt.loadedAt=startSeconds;this.playVideo();}getAvailablePlaybackRates(){return [.75,1,1.25];}setPlaybackRate(s){window.__yt.speed=s;}seekTo(t){window.__yt.time=t;}playVideo(){window.__yt.playing=true;window.__yt.plays++;this.opts.events?.onStateChange?.({data:1});}pauseVideo(){window.__yt.playing=false;this.opts.events?.onStateChange?.({data:2});}destroy(){} }};});
 if(process.env.READY_LIVE_VIDEO==='1'){
  const status={title:clip.title,checks:[]};
  for(const route of ['/lesson-memory','/start-runner']){
   await go(route);
   if(route==='/start-runner')await page.getByRole('button',{name:'Start actual lesson'}).click();
   const check={route,played:false,stopped:false};
   try{
    await page.waitForFunction(()=>!!window.__livePlayer,undefined,{timeout:16000});
    await page.locator('[data-video-controls]').getByRole('button',{name:'재생',exact:true}).click();
    await page.waitForFunction(()=>window.__livePlayer.getPlayerState()===1,undefined,{timeout:13000});
    check.played=true;
    await page.waitForFunction(()=>window.__livePlayer.getPlayerState()===2,undefined,{timeout:15000});
    check.stopped=true;
    const endPosition=await page.evaluate(()=>window.__livePlayer.getCurrentTime());
    await page.waitForTimeout(3000);
    check.stayedStopped=await page.evaluate(end=>window.__livePlayer.getPlayerState()===2&&Math.abs(window.__livePlayer.getCurrentTime()-end)<.25,endPosition);
   }catch(e){check.reason=String(e);check.ui=(await page.locator('[data-shadow-board]').innerText()).slice(0,600);}
   status.checks.push(check);
  }
  const nextSlide=()=>page.locator('[data-lesson-runner-bar]').getByRole('button',{name:/다음/}).click();
  async function liveScene(button){
   const check={route:button,played:false,stopped:false};
   try{
    await page.evaluate(()=>{delete window.__liveScene;});
    await page.getByRole('button',{name:new RegExp(button)}).click({timeout:5000});
    await page.waitForFunction(()=>window.__liveScene?.player.getPlayerState()===1,undefined,{timeout:12000});
    check.played=true;
    const segment=await page.evaluate(()=>({start:window.__liveScene.start,end:window.__liveScene.end}));
    check.segment=segment;
    const remaining=(segment.end-segment.start)*1000;
    if(remaining<=45000){
     await page.waitForFunction(()=>window.__liveScene.player.getPlayerState()!==1&&window.__liveScene.player.getCurrentTime()>=window.__liveScene.end-.4,undefined,{timeout:remaining+6500});
     check.stopped=true;
    }else check.reason='Segment exceeds 45 seconds; only the playback start was checked.';
    await page.getByRole('dialog',{name:'장면 보기'}).getByRole('button',{name:'닫기',exact:true}).click();
   }catch(e){check.reason=String(e);}
   status.checks.push(check);
  }
  await nextSlide();
  await liveScene('장면 보기');
  await nextSlide();
  await liveScene('이 부분 듣기');
  console.log(JSON.stringify(status));
  assert.ok(status.checks.every(check=>check.played&&check.stopped&&check.stayedStopped!==false), 'Live video did not complete every playback check');
  await browser.close();await server.close();process.exit(0);
 }
 if(process.argv.includes('--animation-print')){
  const bluey=worksheetClips.find(row=>row.title.includes('Washing Game'));
  assert.ok(bluey);
  for(const sample of worksheetClips.filter(row=>!row.title.includes('Challenge'))){
   await go('/materials/video-worksheet?clip='+sample.id);
   await page.locator('.animation-sheet h1').first().waitFor();
   assert.equal(await page.getByText('듣기 연습',{exact:true}).count(),0);
   await page.locator('[data-print-activity="letters"] input').first().check();
   await page.locator('[data-print-activity="wordTrace"] input').first().check();
   if(sample.id===bluey.id) {
    await page.locator('[data-print-activity="pictureMatch"] input').first().check();
    await page.locator('[data-print-activity="crossword"] input').first().check();
    await page.getByRole('checkbox',{name:'교사용 설명·정답',exact:true}).check();
    assert.ok(await page.locator('.animation-match-grid img').count());
    assert.ok(await page.locator('.animation-crossword').count());
    assert.ok(await page.locator('.animation-sheet[data-teacher=true]').count());
   }
   const printed=await page.pdf({preferCSSPageSize:true,printBackground:true});
   const sheetCount=await page.locator('.animation-sheet').count();
   assert.equal((printed.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,sheetCount);
   if(sample.id===bluey.id)writeFileSync(resolve(out,'animation-workbook.pdf'),printed);
   pass(sample.title+' workbook · '+sheetCount+' A4 pages');
   await go('/materials/videos');
   const plans=await page.evaluate(id=>{
    const {sceneLesson,buildAnimationLesson}=window.__models;
    const clip=window.__db.rows.find(row=>row.id===id);
    const cards=clip.pack.words.map((word,index)=>({id:String(index),word:word.word,meaning:word.meaning,imageUrl:null}));
    return {missing:sceneLesson(clip).missing,
      short:buildAnimationLesson(clip,cards,{minutes:30}),
      long:buildAnimationLesson(clip,cards,{minutes:40,gameLast:true}),
      incomplete:sceneLesson({...clip,pack:{}}).missing};
   },sample.id);
   assert.deepEqual(plans.missing,[]);
   assert.ok(plans.incomplete.length>=2);
   for(const [plan,duration] of [[plans.short,30],[plans.long,40]]){
    assert.equal(plan[0].elements[0].text,sample.title);
    assert.equal(plan.reduce((sum,slide)=>sum+(slide.animationGuide?.minutes??0),0),duration);
    assert.equal(plan.find(slide=>slide.kind==='video').clipId,sample.id);
    assert.ok(plan.find(slide=>slide.kind==='qna').questions.every(q=>q.a));
   }
   assert.ok(plans.long.length>plans.short.length);
   assert.equal(plans.short.at(-1).elements[0].text,'One last sentence');
   assert.match(plans.long.at(-1).elements[0].text,/Round/);
   await page.getByRole('button',{name:new RegExp(sample.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).first().click();
   await page.getByRole('button',{name:'학습 장면 재생',exact:true}).click();
   const player=page.locator('[data-teaching-video]');
   const start=sample.title.includes('Ball in the Tree')?.1:Number(sample.start_sec);
   const end=sample.title.includes('Ball in the Tree')?69.5:Number(sample.end_sec);
   await page.waitForFunction(start=>window.__yt.playing&&window.__yt.time===start,start);
   await page.evaluate(end=>{window.__yt.time=end;},end);
   await page.waitForFunction(()=>!window.__yt.playing);
   await player.getByRole('button',{name:'이 장면 다시 보기'}).click();
   assert.equal(await page.evaluate(()=>window.__yt.time),start);
   await player.getByRole('button',{name:'전체화면',exact:true}).first().click();
   const menu=player.getByRole('button',{name:/수업 메뉴/});
   await menu.click();
   const panel=player.locator('.tv-full-panel');
   assert.ok(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await page.mouse.click(30,160);
   await player.getByRole('button',{name:'전체화면 종료',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.__yt.playing),true);
   pass(sample.title+' scene start, end, replay and fullscreen controls');
  }
  assert.deepEqual(result.errors,[]);
  await browser.close();await server.close();process.exit(0);
 }
 if(process.argv.includes('--animation-update')){
  await go('/materials/videos');
  await page.getByRole('heading',{name:'애니메이션 영어'}).waitFor();
  await page.getByRole('button',{name:/Synthetic fruit conversation/}).click();
  await page.getByRole('button',{name:'듣고 따라 하기',exact:true}).first().waitFor();
  await page.getByRole('button',{name:'이 영상으로 수업 만들기',exact:true}).waitFor();
  await page.getByRole('button',{name:'듣고 따라 하기',exact:true}).first().click();
  const catalogue=page.locator('[data-teaching-video]');
  const embeddedSize=await catalogue.locator('.tv-video').boundingBox();
  await catalogue.getByRole('button',{name:'전체화면',exact:true}).first().click();
  await catalogue.locator('[data-video-full="true"]').or(page.locator('[data-teaching-video][data-video-full="true"]')).waitFor();
  const fullscreenSize=await catalogue.locator('.tv-video').boundingBox();
  assert.ok(fullscreenSize.width>embeddedSize.width&&fullscreenSize.height>embeddedSize.height);
  const fullMenu=catalogue.getByRole('button',{name:/수업 메뉴/});
  assert.equal(await fullMenu.getAttribute('aria-expanded'),'false');
  await catalogue.getByRole('button',{name:'5초 앞으로',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__yt.time),15);
  await catalogue.getByRole('button',{name:'5초 뒤로',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__yt.time),10);
  await fullMenu.click();
  assert.deepEqual(await catalogue.locator('.tv-video').boundingBox(),fullscreenSize);
  await catalogue.locator('.tv-video').click();
  assert.equal(await fullMenu.getAttribute('aria-expanded'),'false');
  assert.equal(await page.evaluate(()=>window.__yt.playing),false);
  await catalogue.locator('[data-video-controls]').getByRole('button',{name:'다시 듣기',exact:true}).click();
  await page.waitForFunction(()=>window.__yt.playing);
  await fullMenu.click();
  await catalogue.locator('.tv-video').click();
  assert.equal(await page.evaluate(()=>window.__yt.playing),true);
  await fullMenu.click();
  await catalogue.getByRole('button',{name:'전체화면 종료',exact:true}).click();
  await page.locator('[data-teaching-video][data-video-full="false"]').waitFor();
  await page.getByRole('button',{name:'수업 준비로 돌아가기',exact:true}).click();
  await page.getByRole('checkbox',{name:/빈칸 듣기/}).waitFor();
  const generated=await page.evaluate(async()=>{
   const {buildSelectedClipLesson,buildVideoLessonParts,parseReadingText,restoreReadingCues}=window.__models;
   const clip={...window.__db.rows[0],script:'[0:25.6–0:26.5] Anna: I like apples. | 사과를 좋아해요.'};
   const [shadow,reading]=await buildSelectedClipLesson({},clip,['shadow','cloze']);
   const [withoutVocabulary]=await buildSelectedClipLesson({}, {...clip,words:[]}, ['reading']);
   const saved='[0:25] I like **apples**. | 사과를 좋아해요.';
   return {flow:shadow.flow,repeat:shadow.repeat,reading:parseReadingText(reading.source)[0],withoutVocabulary:parseReadingText(withoutVocabulary.source)[0],cloze:parseReadingText(buildVideoLessonParts(clip.script,[]).clozeSource)[0],legacy:parseReadingText(restoreReadingCues(saved,clip.script))[0],unrelated:restoreReadingCues(saved,'[0:25.6-0:26.5] I like bananas.')};
  });
  assert.equal(generated.flow,'manual');
  assert.equal(generated.repeat,1);
  for(const line of [generated.reading,generated.withoutVocabulary,generated.cloze,generated.legacy]){
   assert.equal(line.start,25.6);
   assert.equal(line.end,26.5);
  }
  assert.match(generated.legacy.en,/\*\*apples\*\*/);
  assert.match(generated.unrelated,/^\[0:25\]/);
  pass('Generated animation lessons include cloze, repeat once by default and preserve exact cues including older matching slides');
  await page.getByRole('link',{name:'활동지 인쇄',exact:true}).click();
  await page.locator('.animation-worksheet').waitFor();
  const count=await page.locator('.rc-sheet').count();
  assert.ok(count>1);
  const printed=await page.pdf({preferCSSPageSize:true,printBackground:true});
  assert.equal((printed.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,count);
  pass('Animation catalogue, individual and group selection, teacher answers, A4 PDF page count');

  async function playOnce(){
   const video=page.locator('[data-teaching-video]');
   await video.locator('[data-video-controls]').getByRole('button',{name:'재생',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.__yt.plays),1);
   assert.equal(await page.evaluate(()=>window.__yt.loadedAt),9.95);
   await page.waitForTimeout(140);
   await page.evaluate(()=>{window.__yt.time=16;});
   await page.waitForFunction(()=>!window.__yt.playing);
   await page.waitForTimeout(8300);
   assert.equal(await page.evaluate(()=>window.__yt.plays),1);
   await video.locator('[data-video-controls]').getByRole('button',{name:'다시 듣기',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.__yt.plays),2);
  }
  await go('/lesson-memory');
  await page.getByRole('button',{name:'수업 설정',exact:true}).click();
  const settings=page.locator('[data-video-popup]');
  await settings.getByText('재생·따라하기 방식',{exact:true}).click();
  await settings.getByRole('button',{name:'이어서 영상 보기',exact:true}).click();
  const repeatOnce=settings.getByRole('button',{name:'반복 1회',exact:true});
  assert.equal(await repeatOnce.getAttribute('aria-pressed'),'false');
  await repeatOnce.click();
  assert.equal(await repeatOnce.getAttribute('aria-pressed'),'true');
  await settings.getByRole('button',{name:'닫기',exact:true}).click();
  await playOnce();
  await go('/start-runner');
  await page.getByRole('button',{name:'Start actual lesson'}).click();
  await page.locator('[data-teaching-video][data-video-presenting="true"]').waitFor();
  const picture=page.locator('.tv-video');
  const before=await picture.boundingBox();
  await page.getByRole('button',{name:'수업 설정',exact:true}).click();
  assert.deepEqual(await picture.boundingBox(),before);
  await page.locator('[data-video-popup]').getByRole('button',{name:'닫기',exact:true}).click();
  await playOnce();
  const controls=page.locator('[data-video-controls]');
  assert.equal(await controls.evaluate(node=>node.classList.contains('is-hidden')),false);
  await controls.getByRole('combobox').selectOption('0.75');
  assert.equal(await page.evaluate(()=>window.__yt.speed),.75);
  const playingAt=await page.evaluate(()=>window.__yt.time);
  const stageBefore=await picture.boundingBox();
  await controls.getByRole('button',{name:'전체화면',exact:true}).click();
  await page.locator('[data-video-full="true"]').waitFor();
  const stageFull=await picture.boundingBox();
  assert.ok(stageFull.height>=stageBefore.height);
  assert.equal(await page.evaluate(()=>window.__yt.time),playingAt);
  const lessonMenu=page.getByRole('button',{name:/수업 메뉴/});
  assert.equal(await lessonMenu.getAttribute('aria-expanded'),'false');
  await lessonMenu.click();
  await page.locator('[data-video-popup] select').first().waitFor();
  assert.deepEqual(await picture.boundingBox(),stageFull);
  await picture.click();
  assert.equal(await lessonMenu.getAttribute('aria-expanded'),'false');
  assert.equal(await page.evaluate(()=>window.__yt.playing),true);
  await controls.getByRole('button',{name:'숨기기',exact:true}).click();
  await page.locator('[data-video-controls].is-hidden').waitFor();
  await page.mouse.move(33,44);
  await lessonMenu.click();
  await page.getByRole('button',{name:'전체화면 종료',exact:true}).click();
  await page.locator('[data-video-full="false"]').waitFor();
  assert.equal(await page.evaluate(()=>window.__yt.speed),.75);
  await controls.getByRole('button',{name:/멈춤|일시정지/}).click();
  assert.equal(await page.evaluate(()=>window.__yt.playing),false);
  await page.locator('[data-lesson-runner-bar]').getByRole('button',{name:/다음/}).click();
  async function checkScene(button,start,end){
   await page.getByRole('button',{name:new RegExp(button)}).click();
   await page.waitForFunction(start=>window.__yt.playing&&window.__yt.time===start,start);
   await page.evaluate(end=>{window.__yt.time=end;},end);
   await page.waitForFunction(()=>!window.__yt.playing);
   await page.getByRole('dialog',{name:'장면 보기'}).getByRole('button',{name:'닫기',exact:true}).click();
  }
  await checkScene('장면 보기',10,16);
  await page.getByRole('button',{name:/다음 질문/}).click();
  await checkScene('장면 보기',17,23);
  await page.locator('[data-lesson-runner-bar]').getByRole('button',{name:/다음/}).click();
  assert.doesNotMatch(await page.locator('body').innerText(),/\[0:00\.0/);
  await checkScene('이 부분 듣기',0,23);
  await page.getByRole('button',{name:/다음 쪽/}).click();
  await checkScene('이 부분 듣기',24,47);
  pass('Question and reading page segment bounds, close, and one repetition in preview and presentation');
  assert.deepEqual(result.errors,[]);
  await browser.close();
  await server.close();
  process.exit(0);
 }
 await go('/phonics/workbook?unit=course-2-1');
 const models=await page.evaluate(()=>{const m=window.__models;return m.courseUnits().map(u=>({id:u.id,step:u.step,number:u.number,groups:u.groups.map(g=>({label:g.label,words:g.entries.map(e=>e.word)})),entries:u.entries.map(e=>({word:e.word,image:e.image_url,target:m.workbookTargets(u,e)})),pages:m.readyClassPages(u)}));});assert.equal(models.length,42);
 for(const unit of models){const all=new Set(unit.pages.flatMap(p=>p.entries.map(e=>e.word)));assert(unit.entries.every(e=>all.has(e.word)),unit.id);for(const e of unit.entries){assert(e.target.length&&e.target.every(n=>n>=0&&n<e.word.length),`${unit.id}:${e.word}:target`);}for(const p of unit.pages.filter(p=>p.pictureOrder))for(const order of p.pictureOrder)assert.equal(new Set(order).size,order.length);
  const missing=unit.entries.filter(e=>!e.image||e.image.startsWith('/')&&!existsSync(resolve(root,'public',e.image.slice(1).split('?')[0])));result.units.push({id:unit.id,level:unit.step,unit:unit.number,groups:unit.groups,words:unit.entries.length,pages:unit.pages.length,missing:missing.map(e=>e.word)});
 }
 pass('42 units, stable IDs, all words preserved; annotated target positions and Match permutations checked');
 writeFileSync(resolve(out,'workbook-manifest.json'),JSON.stringify(models,null,2));
 const l2=models.find(u=>u.id==='course-2-1');assert.deepEqual(l2.pages[0].entries.map(e=>e.word),['dad','bag','jam']);assert.deepEqual(l2.pages.find(p=>p.kind==='review').entries.map(e=>e.word),['bad','sad','tag','wag','ram','ham']);assert(l2.entries.every(e=>e.target.length===2));pass('L2 U1 three introductory words → nine words, six expanded memory words, whole ad/ag/am blanks');
 await page.getByRole('button',{name:'선택한 페이지 인쇄',exact:true}).waitFor();
 if(!process.env.READY_UI_ONLY)for(const unit of models){await go('/phonics/workbook?unit='+unit.id);await page.locator('.rc-sheet').first().waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.rc-sheet img')].every(i=>i.complete));
  const layout=await page.locator('.rc-sheet').evaluateAll(sheets=>sheets.flatMap(s=>{const b=s.getBoundingClientRect();const bad=[...s.querySelectorAll('*')].filter(el=>{const r=el.getBoundingClientRect();return r.width>1&&r.height>1&&(r.bottom>b.bottom+2||r.right>b.right+2||r.left<b.left-2);});const broken=[...s.querySelectorAll('img')].filter(i=>!i.naturalWidth);return bad.length||broken.length?[{id:s.dataset.rcPage,bad:bad.slice(0,5).map(e=>e.className),broken:broken.map(i=>i.dataset.rcPicture)}]:[];}));result.units.find(u=>u.id===unit.id).layout=layout;assert.deepEqual(layout,[],unit.id);
  await page.getByRole('checkbox',{name:'교사용 설명·정답',exact:true}).check();const teacherOverflow=await page.locator('[data-rc-teacher]').evaluateAll(xs=>xs.filter(x=>x.scrollHeight>x.clientHeight+2).length);assert.equal(teacherOverflow,0,unit.id+' teacher overflow');await page.getByRole('checkbox',{name:'교사용 설명·정답',exact:true}).uncheck();
  if(unit.number===1){await page.screenshot({path:resolve(out,`level-${unit.step}-desktop.png`),fullPage:true});if(process.env.READY_PDF==='1')await page.pdf({path:resolve(out,`level-${unit.step}.pdf`),preferCSSPageSize:true,printBackground:true});for(let i=0;i<await page.locator('.rc-sheet').count();i++)await page.locator('.rc-sheet').nth(i).screenshot({path:resolve(out,`level-${unit.step}-page-${i+1}.png`)});}
 }
 pass('All 42 units rendered: every page checked for overflow / missing images; representative pages captured');
 await go('/phonics/workbook?unit=course-2-1');await page.getByRole('button',{name:'선택 지우기',exact:true}).click();assert.equal(await page.locator('.rc-sheet').count(),0);await page.locator('.rc-page-list input').nth(1).check();assert.equal(await page.locator('.rc-sheet').count(),1);await page.getByRole('checkbox',{name:'교사용 설명·정답',exact:true}).check();assert.equal(await page.locator('[data-rc-teacher]').count(),1);await page.getByRole('button',{name:'전체 선택',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(out,'workbook-mobile.png'),fullPage:true});pass('Page selection, teacher-only answers, all/clear and mobile scrollable page preview');
 await go('/phonics?tab=songs');await page.getByText('등록된 노래·챈트가 없습니다.',{exact:false}).waitFor();await page.getByRole('button',{name:'노래·챈트 등록·수정',exact:true}).click();const form=page.locator('[data-phonics-songs] form');await form.locator('input').nth(0).fill('Synthetic phonics song');await form.locator('input').nth(1).fill('https://www.youtube.com/watch?v=abcdefghijk');await form.locator('input').nth(2).fill('Synthetic channel');await form.locator('input[type=number]').fill('90');await form.locator('input[type=checkbox]').nth(0).check();await form.getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('link',{name:'유튜브에서 열기'}).waitFor();assert.equal(await page.evaluate(()=>window.__db.writes.length),1);await page.getByRole('button',{name:'수정',exact:true}).click();await form.locator('input').nth(0).fill('Updated synthetic song');await form.getByRole('button',{name:'저장',exact:true}).click();assert.equal(await page.evaluate(()=>window.__db.rows.filter(c=>c.pack?.phonicsSong).length),1);pass('Actual shared video_clips read/insert/update flow; song IDs / unit links shared, no duplicate record');
 const validation=await page.evaluate(()=>window.__models.validatePhonicsSong({title:'x',url:'https://evil.test/youtube.com/watch?v=abcdefghijk',channel:'x',duration:20,unitIds:['course-1-1']}));assert.equal(validation,'url');pass('Non-YouTube host rejected, valid URL & unit mapping checked');
 await go('/materials/videos');await page.getByRole('button',{name:/Synthetic fruit conversation/}).click();await page.getByRole('checkbox',{name:'단어',exact:true}).uncheck();await page.getByRole('button',{name:'이 영상으로 수업 만들기',exact:true}).click();const state=await page.evaluate(()=>history.state.usr);assert.deepEqual(state.clipActivities,['shadow','questions']);pass('Only teacher-selected video activities passed into existing lesson draft route');
 await go('/materials/videos');await page.getByRole('button',{name:/Synthetic fruit conversation/}).click();await page.getByRole('button',{name:'전체화면',exact:true}).click();await page.locator('[data-video-full=true]').waitFor();await page.getByRole('button',{name:'수업 설정',exact:true}).click();assert.equal(await page.locator('[data-video-popup] select').nth(0).locator('option').count(),6);await page.locator('[data-video-popup] select').nth(0).selectOption('0.75');await page.locator('[data-video-popup] select').nth(1).selectOption('2');await page.locator('[data-video-popup]').getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('button',{name:'자막',exact:true}).click();assert.equal(await page.locator('[data-video-popup] button[aria-pressed]').count(),5);await page.locator('[data-video-popup]').getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('button',{name:'재생',exact:true}).click();await page.mouse.move(10,10);await page.waitForTimeout(3600);assert.equal(await page.locator('[data-video-controls]').evaluate(el=>getComputedStyle(el).opacity),'0');await page.mouse.move(150,150);await page.getByRole('button',{name:'수업 설정',exact:true}).click();await page.getByRole('checkbox',{name:'메뉴 항상 표시',exact:true}).check();await page.locator('[data-video-popup]').getByRole('button',{name:'닫기',exact:true}).click();await page.mouse.move(10,10);await page.waitForTimeout(3400);assert.equal(await page.locator('[data-video-controls]').evaluate(el=>getComputedStyle(el).opacity),'1');await page.getByRole('button',{name:'멈춤',exact:true}).click();await page.locator('[data-video-controls]').hover();await page.screenshot({path:resolve(out,'video-full-mobile.png')});pass('Whole stage fullscreen, original ranges, subtitle modes; 3-second auto-hide / movement restore / always-show / paused controls');
 await go('/lesson-memory');await page.locator('[data-shadow-board]').waitFor();await page.waitForTimeout(100);await page.getByRole('button',{name:'재생',exact:true}).click();await page.evaluate(()=>{window.__yt.time=14;});await page.getByRole('button',{name:'Switch activity'}).click();assert.equal(await page.evaluate(()=>window.__yt.playing),false);const plays=await page.evaluate(()=>window.__yt.plays);await page.getByRole('button',{name:'Switch activity'}).click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__yt.time),14);assert.equal(await page.evaluate(()=>window.__yt.plays),plays);pass('Leaving pauses video; returning restores timestamp/settings without autoplay');
 await go('/start-runner');await page.getByRole('button',{name:'Start actual lesson'}).click();await page.locator('[data-lesson-video-nav]').waitFor();assert.equal(await page.locator('[data-lesson-video-nav] button').count(),3);await page.evaluate(()=>document.documentElement.requestFullscreen());await page.getByRole('button',{name:'재생',exact:true}).click();await page.evaluate(()=>{window.__yt.time=14;});await page.locator('[data-lesson-video-nav] button').nth(1).click();await page.waitForFunction(()=>window.__yt.playing===false,{timeout:3000});assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);assert.equal(await page.evaluate(()=>window.__yt.playing),false);const oldPlays=await page.evaluate(()=>window.__yt.plays);await page.locator('[data-lesson-video-nav] button').nth(0).click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__yt.time),14);assert.equal(await page.evaluate(()=>window.__yt.plays),oldPlays);await page.evaluate(()=>document.exitFullscreen());pass('Actual lesson runner: real 3-step navigation order, fullscreen preserved across activities, paused timestamp restored');
 const subset=await page.evaluate(async()=>{const clip=window.__db.rows[0];return (await window.__models.buildSelectedClipLesson({},clip,['questions'])).map(s=>s.kind);});assert.deepEqual(subset,['qna']);pass('Selected lesson builder emits exactly selected activities without unrelated games / word-list writes');
 const counts=await page.evaluate(()=>{const m=window.__models,items=Array.from({length:20},(_,i)=>({id:String(i),label:String(i)}));return {legacy:m.popcornCount(20),zero:m.popcornDeck(items,0).filter(x=>x==='pop').length,three:m.popcornDeck(items,3).filter(x=>x==='pop').length,max:m.popcornCount(20,999),nan:m.popcornCount(20,NaN)};});assert.deepEqual(counts,{legacy:5,zero:0,three:3,max:100,nan:5});pass('POP! exact count, zero-practice, upper bound, safe legacy / invalid values');
 assert.deepEqual(result.errors,[]);result.passed=true;
}catch(e){result.passed=false;result.failure=String(e);console.error(e);if(page){console.error((await page.locator('body').innerText()).slice(-1800));await page.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});}process.exitCode=1;}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify(result,null,2));await browser?.close();await server.close();}
