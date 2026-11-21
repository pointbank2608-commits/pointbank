import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/playwright/index.mjs';
import {openUnitOnePreview} from '../ready-media/unit-one-preview.mjs';
const clips=JSON.parse(await readFile(process.argv[2],'utf8'));
const catalog=JSON.parse(await readFile(new URL('../../src/data/animationEpisodes.json',import.meta.url),'utf8'));
const episodeCount=catalog.reduce((count,source)=>count+source.episodes.length,0);
const excluded=JSON.parse(await readFile(new URL('../../src/data/animationExcludedSources.json',import.meta.url),'utf8'));
const originalCount=catalog.length;
process.env.VITE_LEARNING_SENSORS_ENABLED='false';
const origin='http://127.0.0.1:5236';
const server=await openUnitOnePreview(5236);
let browser;
try{
  const {animationEpisodeLibrary,episodeLessonDraft}=await server.ssrLoadModule('/src/lib/animationEpisodes.ts');
  const {videoDraftSteps,videoSelectedSteps}=await server.ssrLoadModule('/src/lib/soloVideoTemplate.ts');
  const {videoReviewSteps,videoReviewChoices}=await server.ssrLoadModule('/src/lib/videoReviewGames.ts');
  const library=animationEpisodeLibrary(clips);
  assert.equal(originalCount,29);assert.equal(library.sources.length,originalCount);assert.equal(library.episodes.length,181);assert.equal(library.episodes.length,episodeCount);assert.equal(library.pending.length,0);
  assert.equal(excluded.length,6);assert.equal(clips.filter(clip=>excluded.some(source=>source.youtubeId===clip.youtube_id)).length,14);
  for(const source of excluded){assert.ok(!catalog.some(item=>item.youtubeId===source.youtubeId));assert.ok(!library.sources.some(item=>item.youtubeId===source.youtubeId));}
  for(const source of catalog){
    assert.equal(source.episodes[0].start,0);assert.equal(source.episodes.at(-1).end,source.duration);
    for(let index=1;index<source.episodes.length;index++)assert.equal(source.episodes[index-1].end,source.episodes[index].start);
    for(const episode of source.episodes){
      assert.equal(episode.boundary.revision,2);assert.equal(episode.boundary.sampleSeconds,0);
      assert.ok(episode.chapters.length);assert.ok(episode.thumbnail.startsWith('/animation-episodes/'));
      await readFile(new URL('../../public'+episode.thumbnail,import.meta.url));
      for(const chapter of episode.chapters){assert.ok(chapter.intent);assert.ok(chapter.words.length>=1);for(const word of chapter.words){assert.equal(word.basis,'scene-context');assert.match(word.word,/[A-Za-z]/);assert.ok(!/[가-힣]/.test(word.word));}}
    }
  }
  assert.equal(new Set(library.episodes.map(material=>material.episode.id)).size,episodeCount);
  const skating=library.episodes.find(material=>material.source.youtubeId==='O37zFRCQhEQ'&&material.episode.start===0);
  const easter=library.episodes.find(material=>material.episode.id==='O37zFRCQhEQ:episode:306000');
  assert.equal(skating.episode.end,305.722);assert.ok(!skating.words.some(word=>word.word==='brush'));
  assert.equal(easter.episode.start,305.722);assert.ok(easter.words.some(word=>word.word==='brush'));assert.equal(easter.episode.end,625.333);
  const talent=library.episodes.find(material=>material.source.youtubeId==='6P84M_sXCHM');
  assert.deepEqual(talent.chapters.map(chapter=>chapter.start),[0,30.4,190.722]);
  assert.ok(!talent.lines.some(line=>line.en.startsWith('When Mrs. Martin')));
  const joinedNarration=talent.lines.find(line=>line.start===3.3);
  assert.equal(joinedNarration.end,10);assert.ok(joinedNarration.en.includes('classroom when Mrs. Martin'));
  for(const chapter of talent.chapters)assert.ok(!talent.lines.some(line=>line.start<chapter.start&&line.end>chapter.start),'Talent-show chapters must not divide a known timed utterance');
  for(const material of library.episodes){
    const {episode,chapters,words}=material;
    assert.ok(episode.start>=0&&episode.end<=material.source.duration&&episode.end>episode.start);
    assert.equal(chapters[0].start,episode.start);assert.equal(chapters.at(-1).end,episode.end);
    for(let index=1;index<chapters.length;index++)assert.equal(chapters[index-1].end,chapters[index].start);
    assert.equal(new Set(words.map(word=>word.id)).size,words.length);
    assert.ok(words.length);
    for(const word of words){assert.ok(word.start>=episode.start&&word.end<=episode.end);assert.ok(word.chapterIds.length);if(word.basis==='scene-context')assert.equal(word.example,'');}
    const chosen=chapters.map((_,index)=>index);
    const draft=episodeLessonDraft(material,chosen,words.map(word=>word.id),20);
    for(const step of draft.steps)if('clip' in step&&step.clip)assert.ok(step.clip.start>=episode.start&&step.clip.end<=episode.end);
  }
  const bee=library.episodes.find(material=>material.source.youtubeId==='yCzDip2ma9o');
  const second=library.episodes.find(material=>material.source.youtubeId==='x48eq6AYfTY'&&material.episode.start>0);
  assert.ok(bee.words.length>=2);assert.ok(second);
  browser=await chromium.launch({channel:'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1080},serviceWorkers:'block'});
  const uid='00000000-0000-4000-8000-000000000001',academy='00000000-0000-4000-8000-000000000002',classId='00000000-0000-4000-8000-000000000003';
  const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp=Math.floor(Date.now()/1000)+86400;
  const user={id:uid,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
  const session={user,access_token:`${b64({alg:'HS256'})}.${b64({sub:uid,role:'authenticated',exp,aud:'authenticated',aal:'aal1'})}.test-only`,refresh_token:'test-only',expires_at:exp,expires_in:86400,token_type:'bearer'};
  await context.addInitScript(session=>{
    localStorage.setItem('sb-127-auth-token',JSON.stringify(session));localStorage.setItem('classbank.lang','ko');
    window.__episodePlayers=[];
    window.YT={PlayerState:{PLAYING:1,ENDED:0},Player:class{
      constructor(id,options){this.options=options;this.time=options.playerVars?.start??0;this.state=2;this.volume=100;window.__episodePlayers.push(this);setTimeout(()=>options.events?.onReady?.(),0);}
      getCurrentTime(){return this.time;}getDuration(){return 10000;}getPlayerState(){return this.state;}
      playVideo(){this.state=1;this.options.events?.onStateChange?.({data:1});}pauseVideo(){this.state=2;this.options.events?.onStateChange?.({data:2});}
      seekTo(value){this.time=value;}setPlaybackRate(){}getAvailablePlaybackRates(){return [0.75,1];}setVolume(value){this.volume=value;}getVolume(){return this.volume;}destroy(){this.state=2;this.destroyed=true;}
      loadVideoById(value){this.lastLoad={...value};this.time=value.startSeconds??0;this.playVideo();}
    }};
  },session);
  const lessonWrites=[],wordWrites=[],rpc=[];
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin)return route.abort();
    if(!url.pathname.startsWith('/rest/')&&!url.pathname.startsWith('/auth/'))return route.continue();
    const name=url.pathname.split('/').at(-1);let data=[];
    if(name==='user')data=user;else if(url.pathname.startsWith('/auth/'))data=session;
    else if(name==='profiles')data=[{id:uid,academy_id:academy,role:'owner',display_name:'검증 선생님'}];
    else if(name==='academies')data=[{id:academy,name:'검증 학원',plan:'paid',plan_status:'active',features:{solo:true,homework:true,group:true}}];
    else if(name==='classes')data=[{id:classId,academy_id:academy,name:'검증 반'}];
    else if(name==='video_clips')data=clips;else if(name==='my_deletion_request')data=null;
    else if(name==='solo_lessons'&&request.method()==='POST'){lessonWrites.push(request.postDataJSON());data={id:'saved-lesson',...lessonWrites.at(-1)};}
    else if(name==='word_lists'&&request.method()==='POST'){wordWrites.push(request.postDataJSON());data={id:'saved-words',...wordWrites.at(-1)};}
    if(url.pathname.includes('/rpc/'))rpc.push(name);
    return route.fulfill({status:200,json:data});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/videos');await page.getByRole('link',{name:'애니메이션 영어 개별수업',exact:true}).click();
  await page.getByText(`원본 ${originalCount}개 · 에피소드 ${episodeCount}개`,{exact:true}).waitFor();
  for(const source of excluded)assert.equal(await page.locator(`[data-episode-id^="${source.youtubeId}:"]`).count(),0);
  assert.equal(await page.getByRole('option',{name:'Peppa Pig',exact:true}).count(),0);
  await page.screenshot({path:'../output/animation-solo/library-episodes.jpg',type:'jpeg',quality:85});
  const newOriginals=catalog.filter(source=>source.episodes.length>1).map(source=>source.youtubeId);
  assert.equal(newOriginals.length,9);
  for(const youtubeId of newOriginals){
    const sample=library.episodes.find(material=>material.source.youtubeId===youtubeId&&material.episode.start>0);
    assert.ok(sample);
    await page.locator(`[data-episode-id="${sample.episode.id}"]`).click();
    const timeline=page.locator('.tv-progress input[type=range]');
    assert.equal(await timeline.getAttribute('min'),'0');assert.equal(Number(await timeline.getAttribute('max')),sample.episode.end-sample.episode.start);
    await page.waitForFunction(start=>window.__episodePlayers.at(-1)?.time===start,sample.episode.start);
    const last=sample.chapters.at(-1);
    await page.getByRole('button',{name:`챕터: ${last.title}`,exact:true}).click();
    await page.waitForFunction(start=>Math.abs(window.__episodePlayers.at(-1).time-start)<.01,last.start);
    const word=sample.words.find(word=>word.chapterIds.includes(sample.chapters.length-1));
    assert.ok(word);
    const checkbox=page.getByRole('checkbox',{name:`${word.word} · ${word.meaning}`,exact:true});
    await checkbox.setChecked(true);assert.equal(await checkbox.isChecked(),true);
    await checkbox.setChecked(false);assert.equal(await checkbox.isChecked(),false);
    await page.getByRole('button',{name:'← 에피소드 목록',exact:true}).click();
  }
  await page.locator(`[data-episode-id="${second.episode.id}"]`).click();
  const seek=page.getByRole('slider',{name:'재생 위치',exact:true});
  const input=page.locator('.tv-progress input[type=range]');
  assert.equal(await input.getAttribute('min'),'0');assert.equal(Number(await input.getAttribute('max')),second.episode.end-second.episode.start);
  await page.waitForFunction(start=>window.__episodePlayers.at(-1)?.time===start,second.episode.start);
  await input.press('Home');await input.press('ArrowRight');
  assert.ok(await page.evaluate(start=>window.__episodePlayers.at(-1).time>=start,second.episode.start));
  await input.press('End');
  assert.ok(await page.evaluate(end=>window.__episodePlayers.at(-1).time<end,second.episode.end),'End seek must stay before the next story frame');
  await page.getByRole('button',{name:'재생',exact:true}).last().click();
  await page.waitForFunction(end=>window.__episodePlayers.at(-1).lastLoad?.endSeconds===end,second.episode.end);
  assert.equal(await page.evaluate(()=>window.__episodePlayers.at(-1).lastLoad.startSeconds),second.episode.start);
  await page.evaluate(end=>{const player=window.__episodePlayers.at(-1);player.time=end+.2;player.state=1;},second.episode.end);
  await page.waitForFunction(()=>window.__episodePlayers.at(-1).state===2);
  await page.getByRole('button',{name:'← 에피소드 목록',exact:true}).click();
  await page.locator(`[data-episode-id="${bee.episode.id}"]`).click();
  const chapterButton=page.getByRole('button',{name:`챕터: ${bee.chapters[1].title}`,exact:true});await chapterButton.waitFor();await chapterButton.click();
  await page.waitForFunction(start=>Math.abs(window.__episodePlayers.at(-1).time-start)<.01,bee.chapters[1].start);
  await page.getByRole('button',{name:'챕터별 단어·표현',exact:true}).click();
  await page.getByRole('combobox',{name:'단어 모음을 볼 챕터',exact:true}).selectOption('1');
  const expectedChapterWords=bee.words.filter(word=>word.chapterIds.includes(1));
  for(const word of expectedChapterWords)await page.getByRole('checkbox',{name:`${word.word} · ${word.meaning}`,exact:true}).waitFor();
  await page.getByRole('button',{name:'에피소드 전체 단어·표현',exact:true}).click();
  await page.getByRole('button',{name:'수업 챕터의 단어·표현 모두 선택',exact:true}).click();
  await page.getByRole('button',{name:'선택한 항목을 내 단어장에 저장',exact:true}).click();
  await page.getByText('선택한 단어·표현을 내 단어장에 저장했어요.',{exact:true}).waitFor();
  assert.equal(wordWrites.length,1);assert.equal(wordWrites[0].items.length,bee.words.length);assert.equal(wordWrites[0].class_id,classId);
  for(const item of wordWrites[0].items){assert.equal(item.videoSource.youtubeId,bee.source.youtubeId);assert.equal(item.videoSource.episodeId,bee.episode.id);assert.ok(item.videoSource.chapters.length);}
  await page.getByRole('button',{name:'구성·학생 미리보기',exact:true}).click();
  await page.getByRole('button',{name:'학생 화면 미리보기',exact:true}).click();
  const draft=episodeLessonDraft(bee,bee.chapters.map((_,index)=>index),bee.words.map(word=>word.id),10);
  const games=videoReviewSteps(videoReviewChoices(videoSelectedSteps(draft)),{matchup:true},key=>key);
  const steps=videoDraftSteps(draft,undefined,games),recap=steps.findIndex(step=>step.t==='intro'&&step.title==='오늘 배운 내용 총정리');
  for(let index=0;index<recap;index++)await page.getByRole('button',{name:/다음 단계/}).click();
  await page.getByRole('heading',{name:'오늘 배운 내용 총정리',exact:true}).waitFor();
  assert.equal(lessonWrites.length,0);
  await page.getByRole('button',{name:'나가기',exact:true}).click();
  await page.getByRole('button',{name:'이 초안으로 수업 만들기',exact:true}).click();
  await page.waitForFunction(()=>!document.body.textContent.includes('학생 화면 미리보기'));
  assert.equal(lessonWrites.length,1);assert.match(lessonWrites[0].source,/^animation-episode-yCzDip2ma9o-0-v2$/);
  assert.equal(lessonWrites[0].steps.filter(step=>step.t==='meet').length,bee.words.length);
  assert.ok(lessonWrites[0].steps.some(step=>step.t==='game'));
  assert.ok(!rpc.some(name=>/solo_assign|sensor.*report|learning_run_open/.test(name)));assert.deepEqual(errors,[]);
  await page.setViewportSize({width:390,height:844});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+2).slice(0,10).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width}))));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log(JSON.stringify({originals:originalCount,episodes:episodeCount,pendingOriginals:0,excludedOriginals:excluded.length,excludedClips:14,newOriginalsTested:newOriginals.length,wordListItems:bee.words.length,browser:'PASS removed sources absent; retained full original/chapter coverage; thumbnail files; episode bounds and relative timeline; chapter seek/filter; word selection, provenance and explicit saves; games and final review; preview records zero; mobile width'}));
}finally{await browser?.close();await server.close();}
