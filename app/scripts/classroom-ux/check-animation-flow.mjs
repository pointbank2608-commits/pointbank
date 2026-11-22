import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},logLevel:'error'});
try{
 const {findVideoQuestionLesson}=await server.ssrLoadModule('/src/lib/videoQuestionLessons.ts');
 const {parseShadowText,shadowLineAtTime}=await server.ssrLoadModule('/src/lib/shadowLines.ts');
 const {nextVideoQuestion,questionTimeInVideo}=await server.ssrLoadModule('/src/lib/videoQuestions.ts');
 const {animationPracticeLines,animationEpisodeWords,animationRangeInvalid,animationExpressionFits,animationEpisodeClip}=await server.ssrLoadModule('/src/lib/animationSession.ts');
 const {animationEpisodeLibrary}=await server.ssrLoadModule('/src/lib/animationEpisodes.ts');
 const {animationSentenceChunks,animationPrintActivities}=await server.ssrLoadModule('/src/lib/animationPrint.ts');
 const slide=(clipId,at)=>({id:clipId,kind:'video',clipId,questionLesson:true,startSec:24.5,endSec:89.5,timedQuestions:[{id:'q',kind:'spoken',at,prompt:'Question'}]});
 const lesson=(id,owner,clipId,date,at)=>({id,created_by:owner,playlist:[slide(clipId,at)],created_at:date,updated_at:date});
 const rows=[lesson('old','me','clip','2026-11-19',30),lesson('mine','me','clip','2026-11-20',38.51),lesson('other-owner','other','clip','2026-11-21',40),lesson('other-clip','me','other-clip','2026-11-21',45)];
 const before=JSON.stringify(rows);
 const found=findVideoQuestionLesson(rows,'clip','me');
 assert.equal(found.lesson.id,'mine');assert.equal(found.slide.timedQuestions[0].at,38.51);
 assert.equal(findVideoQuestionLesson(rows,'missing','me'),null);
 assert.equal(JSON.stringify(rows),before);
 const episodeRow=lesson('episode','me','clip','2026-11-22',100);
 episodeRow.playlist[0].animationEpisode={id:'episode-one',start:0,end:400,revision:2};
 assert.equal(findVideoQuestionLesson([...rows,episodeRow],'clip','me').lesson.id,'mine');
 assert.equal(findVideoQuestionLesson([...rows,episodeRow],'clip','me','episode-one').lesson.id,'episode');
 assert.equal(findVideoQuestionLesson([...rows,episodeRow],'clip','me','episode-two'),null);
 const lines=parseShadowText('[0:25-0:27] First line. | 첫 문장\n[0:27-0:30] Second line. | 둘째 문장\n[0:32-0:35] Third line. | 셋째 문장');
 assert.equal(shadowLineAtTime(lines,24.5),0);
 assert.equal(shadowLineAtTime(lines,27.5),1); // clip-relative 3 seconds
 assert.equal(shadowLineAtTime(lines,30.5),1); // keep last heard line across a gap
 assert.equal(shadowLineAtTime(lines,32),2);
 assert.equal(lines[1].ko,'둘째 문장');
 const q1={id:'one',at:questionTimeInVideo(14.01,24.5)},q2={id:'two',at:questionTimeInVideo(18.23,24.5)},served=new Set();
 assert.equal(nextVideoQuestion([q1,q2],served,38.3),undefined);
 assert.equal(nextVideoQuestion([q1,q2],served,38.58).id,'one'); // crossed between player polls
 served.add('one');assert.equal(nextVideoQuestion([q1,q2],served,38.6),undefined);
 assert.equal(nextVideoQuestion([q1,q2],served,43).id,'two');
 assert.equal(nextVideoQuestion([q1,q2],new Set(),43,42).id,'two');
 assert.equal(nextVideoQuestion([q1,q2],new Set(),45,44),undefined); // enabling mid-video never jumps to old questions
 const crossing=animationPracticeLines('[2:15-2:19] Second chapter.\n[1:40-1:44] Hi!\n[2:15-2:19] Second chapter.\n[2:39-2:42] Outside.',100,160);
 assert.deepEqual(crossing.map(line=>line.start),[100,135]);
 assert.equal(animationRangeInvalid(100,160,336),false);
 const catalogClip={id:'source',youtube_id:'kioBK0l8w5w',series:'Bluey',start_sec:0,end_sec:6800,hidden:false,script:'[1:40-1:44] A cat. | 고양이',pack:{words:[{word:'cat',meaning:'고양이',example:'A cat.',time:100}]}};
 const materials=animationEpisodeLibrary([catalogClip]).episodes;
 const catalogueBefore=JSON.stringify(materials.map(m=>m.episode));
 const adapted=animationEpisodeClip(materials[0]);
 assert.equal(adapted.start_sec,materials[0].episode.start);assert.equal(adapted.end_sec,materials[0].episode.end);
 assert.equal(adapted.pack.words.length,materials[0].words.length);
 assert.equal(JSON.stringify(materials.map(m=>m.episode)),catalogueBefore);
 assert.equal(parseShadowText('[113:01-113:04] A long source.')[0].start,6781);
 for(const [start,end] of [[-1,160],[160,100],[100,337],[100,100],[NaN,160]])assert.equal(animationRangeInvalid(start,end,336),true);
 const chapters=[{pack:{words:[{word:'cat',meaning:'고양이'},{word:'dog',meaning:'개'}]}}];
 const untouched=JSON.stringify(chapters);
 const vocabulary=animationEpisodeWords(chapters,undefined);
 const a={startSec:100,endSec:160,animationSession:{words:vocabulary.slice(0,1)},timedQuestions:[q1]};
 const b=structuredClone({...a,startSec:130,endSec:210,animationSession:{words:vocabulary.slice(1)}});
 b.animationSession.words[0].word='edited';b.timedQuestions[0].at=150;
 assert.equal(a.timedQuestions[0].at,38.51);assert.equal(a.animationSession.words[0].word,'cat');assert.equal(JSON.stringify(chapters),untouched);
 assert.deepEqual(animationSentenceChunks(['We','hung','out','yesterday.']),['We','hung out','yesterday.']);
 assert.deepEqual(animationSentenceChunks(['Unrelated','words','stay','separate.']),['Unrelated','words','stay','separate.']);
 assert.equal(animationExpressionFits("There's nothing wrong with being small, honey.",{text:'There’s nothing wrong with + -ing.',original:"There's nothing wrong with being small, honey."}),true);
 assert.equal(animationExpressionFits('Can you help me climb?',{text:'Can you help me …?'}),true);
 assert.equal(animationExpressionFits('I like apples.',{text:'Can you help me …?'}),false);
 const printClip={id:'print-fixture',start_sec:0,end_sec:5,script:'[0:01-0:04] We hung out.',pack:{words:[{word:'cat',meaning:'고양이',example:'A cat.',time:1}],questions:[{q:'What animal?',a:'Cat.',time:1,end:4}],scene:{choices:{'What animal?':['Dog.','Pig.']}}}};
 const activities=opts=>animationPrintActivities(printClip,[],{letters:3,bank:true,chunks:true,pictureClues:false,choiceCount:3,...opts}).flatMap(g=>g.types);
 assert.equal((activities({}).find(t=>t.id==='letters').items[0].prompt.match(/_/g)??[]).length,3);
 assert.equal(activities({choiceCount:2}).find(t=>t.id==='questionChoice').items[0].choices.length,2);
 assert.equal(activities({choiceCount:3}).find(t=>t.id==='questionChoice').items[0].choices.length,3);
 console.log('PASS: teacher/clip revision lookup, immutable stored times, offset crossing/continuation, current-line selection and gap handling.');
}finally{await server.close();}
