import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/playwright/index.mjs';
import {openUnitOnePreview} from '../ready-media/unit-one-preview.mjs';
const clips=JSON.parse(await readFile(process.argv[2],'utf8'));
process.env.VITE_LEARNING_SENSORS_ENABLED='false';
const origin='http://127.0.0.1:5235',server=await openUnitOnePreview(5235);
let browser;
try{
 const {animationEpisodeLibrary}=await server.ssrLoadModule('/src/lib/animationEpisodes.ts');
 const {episodeGroupLesson}=await server.ssrLoadModule('/src/lib/animationEpisodeGroup.ts');
 const {parseShadowText}=await server.ssrLoadModule('/src/lib/shadowLines.ts');
 const library=animationEpisodeLibrary(clips);assert.equal(library.episodes.length,181);
 for(const material of library.episodes){
  const selection={episodeId:material.episode.id,chapterStarts:material.chapters.map(c=>c.start),wordIds:material.words.map(w=>w.id),minutes:20};
  const draft=episodeGroupLesson(material,selection),videos=draft.slides.filter(s=>s.kind==='video');
  assert.equal(videos.length,1);assert.equal(videos[0].startSec,material.episode.start);assert.equal(videos[0].endSec,material.episode.end);
  assert.equal(videos[0].chapters.length,material.chapters.length);assert.equal(videos[0].animationEpisode.id,material.episode.id);
  for(const line of parseShadowText(videos[0].source))assert.ok(line.start>=videos[0].startSec&&line.end<=videos[0].endSec);
 }
 assert.equal(parseShadowText('[113:00.500-113:02.000] A complete line. | 문장')[0].start,6780.5);
 const talent=library.episodes.find(m=>m.source.youtubeId==='6P84M_sXCHM');
 const selected={episodeId:talent.episode.id,chapterStarts:[0,190.722],wordIds:talent.words.slice(0,4).map(w=>w.id),minutes:10};
 const expected=episodeGroupLesson(talent,selected),videoSlides=expected.slides.filter(s=>s.kind==='video');
 assert.deepEqual(videoSlides.map(v=>[v.startSec,v.endSec]),[[0,30.4],[190.722,270.781]]);
 browser=await chromium.launch({channel:'chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1080},serviceWorkers:'block'});
 const uid='00000000-0000-4000-8000-000000000001',academy='00000000-0000-4000-8000-000000000002',classId='00000000-0000-4000-8000-000000000003';
 const exp=Math.floor(Date.now()/1000)+86400,b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const user={id:uid,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
 const session={user,access_token:`${b64({alg:'HS256'})}.${b64({sub:uid,role:'authenticated',exp,aud:'authenticated',aal:'aal1'})}.test-only`,refresh_token:'test-only',expires_at:exp,expires_in:86400,token_type:'bearer'};
 await context.addInitScript(session=>{
  localStorage.setItem('sb-127-auth-token',JSON.stringify(session));localStorage.setItem('classbank.lang','ko');localStorage.setItem('classbank.lessonMode','solo');
  window.__episodePlayers=[];window.YT={Player:class{
   constructor(id,options){this.options=options;this.time=options.playerVars?.start??0;this.state=2;window.__episodePlayers.push(this);setTimeout(()=>options.events?.onReady?.(),0);}
   getCurrentTime(){return this.time;}getDuration(){return 10000;}getPlayerState(){return this.state;}
   playVideo(){this.state=1;this.options.events?.onStateChange?.({data:1});}pauseVideo(){this.state=2;this.options.events?.onStateChange?.({data:2});}
   seekTo(value){this.time=value;}setPlaybackRate(){}getAvailablePlaybackRates(){return [0.75,1];}setVolume(){}getVolume(){return 100;}destroy(){this.state=2;}
   loadVideoById(value){this.lastLoad=value;this.time=value.startSeconds??0;this.playVideo();}
  }};
 },session);
 const writes=[],rpc=[],saved=[];
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==origin)return route.abort();
  if(!url.pathname.startsWith('/rest/')&&!url.pathname.startsWith('/auth/'))return route.continue();
  const name=url.pathname.split('/').at(-1);let data=[];
  if(name==='user')data=user;else if(url.pathname.startsWith('/auth/'))data=session;
  else if(name==='profiles')data=[{id:uid,academy_id:academy,role:'owner',display_name:'검증 선생님'}];
  else if(name==='academies')data=[{id:academy,name:'검증 학원',plan:'paid',plan_status:'active',features:{solo:true,homework:true,group:true}}];
  else if(name==='classes')data=[{id:classId,academy_id:academy,name:'검증 반'}];
  else if(name==='video_clips')data=url.searchParams.has('id')?clips.find(c=>url.searchParams.get('id')==='eq.'+c.id)??null:clips;
  else if(name==='curriculum_lessons'){
   if(req.method()==='POST'){writes.push(req.postDataJSON());const lesson={id:crypto.randomUUID(),...writes.at(-1),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};saved.push(lesson);data=lesson;}
   else data=[...saved];
  }else if(name==='my_deletion_request')data=null;
  if(url.pathname.includes('/rpc/'))rpc.push(name);
  return route.fulfill({status:200,json:data});
 });
 const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/videos');await page.getByRole('heading',{name:'애니메이션 영어 단체수업',exact:true}).waitFor();
 await page.getByText('원본 29개 · 에피소드 181개',{exact:true}).waitFor();
 await page.locator(`[data-episode-id="${talent.episode.id}"]`).click();
 await page.getByRole('checkbox',{name:talent.chapters[1].title+' 수업에 넣기',exact:true}).uncheck();
 await page.getByRole('button',{name:'단체수업 미리보기',exact:true}).click();
 const preview=page.locator('[data-group-episode-preview]');await preview.waitFor();
 await preview.getByRole('button',{name:'다음 슬라이드',exact:true}).click();await preview.getByRole('button',{name:'다음 슬라이드',exact:true}).click();
 const slider=preview.getByRole('slider',{name:'재생 위치',exact:true});await slider.waitFor();
 assert.equal(Number(await slider.getAttribute('max')),30.4);
 const secondIndex=expected.slides.findIndex((s,i)=>i>2&&s.kind==='video');
 for(let i=2;i<secondIndex;i++)await preview.getByRole('button',{name:'다음 슬라이드',exact:true}).click();
 await page.waitForFunction(()=>Math.abs(window.__episodePlayers.at(-1).time-190.722)<.01);
 assert.ok(Math.abs(Number(await slider.getAttribute('max'))-(270.781-190.722))<.001);
 await preview.getByRole('button',{name:'설정으로 돌아가기',exact:true}).click();
 assert.equal(writes.length,0);
 await page.getByRole('button',{name:'선택한 챕터로 단체수업 만들기',exact:true}).click();
 await page.waitForURL('**/curriculum?mode=group');await page.locator('input').filter({visible:true}).first().waitFor();
 await page.locator('input[value="카이유의 장기자랑"]').waitFor();
 await mkdir('../output/animation-solo/group',{recursive:true});await page.screenshot({path:'../output/animation-solo/group/classroom-draft.jpg'});
 const save=page.getByRole('button',{name:'저장',exact:true});await save.click();
 await page.waitForFunction(()=>!document.body.textContent.includes('저장 중'));
 assert.equal(writes.length,1);
 const persisted=writes[0].playlist.filter(s=>s.kind==='video');assert.deepEqual(persisted.map(v=>[v.startSec,v.endSec]),[[0,30.4],[190.722,270.781]]);
 assert.ok(persisted.every(v=>v.chapters.length===1&&v.animationEpisode.id===talent.episode.id));
 assert.equal(writes[0].class_id,classId);assert.ok(!rpc.some(name=>/learning_run_open|sensor.*report|solo_assign/.test(name)));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({episodes:181,classroom:'PASS shared catalogue, nonconsecutive chapter ranges, real classroom renderer, teacher draft and explicit save snapshot',previewCollection:0}));
}finally{await browser?.close();await server.close();}
