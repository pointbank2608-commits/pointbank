import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
// Pure selection test never connects a realtime channel; Node 20 needs a constructor present.
globalThis.WebSocket??=class {};
const server=await createServer({configFile:false,define:{'import.meta.env.VITE_SUPABASE_URL':'"https://fixture.invalid"','import.meta.env.VITE_SUPABASE_ANON_KEY':'"test-only"','import.meta.env.VITE_LEARNING_SENSORS_ENABLED':'"false"'},logLevel:'error',server:{middlewareMode:true,hmr:false}});
try{
 const clips=JSON.parse(await readFile(process.argv[2],'utf8'));
 const {animationEpisodeLibrary}=await server.ssrLoadModule('/src/lib/animationEpisodes.ts');
 const {animationSelectedClip,animationPracticeLines}=await server.ssrLoadModule('/src/lib/animationSession.ts');
 const {episodeGroupLesson,episodeClassroomSlide}=await server.ssrLoadModule('/src/lib/animationEpisodeGroup.ts');
 const {animationPrintActivities}=await server.ssrLoadModule('/src/lib/animationPrint.ts');
 const before=JSON.stringify(clips),materials=animationEpisodeLibrary(clips).episodes;
 const caillou=materials.find(m=>m.episode.id==='DhKIqYVB_Ws:episode:0');
 assert.equal(caillou.chapters.length,3);assert.ok(caillou.words.length>=15);assert.ok(caillou.lines.length>10);
 const wordIds=caillou.words.filter(w=>['work','tie','elevator','floor'].includes(w.word)).map(w=>w.id);
 const draft=episodeGroupLesson(caillou,{episodeId:caillou.episode.id,chapterStarts:caillou.chapters.map(c=>c.start),wordIds,minutes:30});
 const video=draft.slides.find(s=>s.kind==='video');
 assert.deepEqual(video.animationSession.words.map(w=>w.word),['work','tie','elevator','floor']);
 assert.ok(animationPracticeLines(video.source,video.startSec,video.endSec).length>10);
 assert.equal(video.animationSession.expressions.length,4); // three chapter expressions plus primary compatibility value
 const options={letters:1,bank:true,chunks:true,pictureClues:false,choiceCount:3};
 const printing=(selection)=>animationPrintActivities(selection,[],options).flatMap(g=>g.types);
 for(const chapterIndices of [[1],[1,2],[0,1,2]]){
  const starts=chapterIndices.map(i=>caillou.chapters[i].start);
  const selectedIds=caillou.words.filter(w=>w.word!=='tray').map(w=>w.id);
  const selected=animationSelectedClip(caillou,starts,selectedIds);
  assert.equal(selected.pack.questions.length,chapterIndices.length*2);
  assert.equal(selected.pack.words.some(w=>w.word==='tray'),false);
  for(const word of selected.pack.words)assert.ok(caillou.words.find(w=>w.word===word.word).chapterIds.some(i=>chapterIndices.includes(i)));
  const activities=printing(selected);
  assert.equal(activities.find(t=>t.id==='study').items.length,selected.pack.words.length);
  assert.equal(activities.find(t=>t.id==='questionChoice').items.length,chapterIndices.length*2);
 }
 const printWords=caillou.words.filter(w=>['copy','glasses'].includes(w.word));
 const scoped=animationSelectedClip(caillou,[caillou.chapters[1].start],printWords.map(w=>w.id));
 const study=printing(scoped).find(t=>t.id==='study').items;
 assert.equal(study.length,2);
 for(const item of study){assert.ok(item.meaning);assert.ok(item.definition);assert.ok(item.exampleTranslation);assert.equal(item.exampleOrigin,'script');assert.ok(caillou.lines.some(l=>l.en===item.exampleSentence&&l.ko===item.exampleTranslation));}
 const direct=episodeClassroomSlide(caillou,{episodeId:caillou.episode.id,chapterStarts:[caillou.chapters[1].start],wordIds:printWords.map(w=>w.id),minutes:30});
 assert.equal(direct.startSec,caillou.episode.start);assert.equal(direct.endSec,caillou.episode.end);
 assert.deepEqual(direct.chapters.map(c=>c.selected),[false,true,false]);assert.deepEqual(direct.animationSession.words.map(w=>w.word),['copy','glasses']);
 assert.deepEqual(animationSelectedClip(caillou,[],[]).pack.words,[]);
 assert.deepEqual(animationPracticeLines('An untimed sentence.\nAnother sentence.'),[],'Untimed text never receives guessed timestamps');
 for(const m of materials){
  const all=episodeGroupLesson(m,{episodeId:m.episode.id,chapterStarts:m.chapters.map(c=>c.start),wordIds:m.words.map(w=>w.id),minutes:30});
  const v=all.slides.filter(s=>s.kind==='video');assert.equal(v.length,1);assert.equal(v[0].startSec,m.episode.start);assert.equal(v[0].endSec,m.episode.end);
  assert.equal(v[0].animationSession.words.length,m.words.length);
 }
 assert.equal(JSON.stringify(clips),before);
 console.log('PASS: 181 episode bounds, four-word handoff, caption-backed lines, chapter 2/2+3/all questions and words, excluded word, print parity, no synthetic timing, immutable source.');
}finally{await server.close();}
