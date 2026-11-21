import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},logLevel:'error'});
try{
 const {findVideoQuestionLesson}=await server.ssrLoadModule('/src/lib/videoQuestionLessons.ts');
 const {parseShadowText,shadowLineAtTime}=await server.ssrLoadModule('/src/lib/shadowLines.ts');
 const {nextVideoQuestion,questionTimeInVideo}=await server.ssrLoadModule('/src/lib/videoQuestions.ts');
 const slide=(clipId,at)=>({id:clipId,kind:'video',clipId,questionLesson:true,startSec:24.5,endSec:89.5,timedQuestions:[{id:'q',kind:'spoken',at,prompt:'Question'}]});
 const lesson=(id,owner,clipId,date,at)=>({id,created_by:owner,playlist:[slide(clipId,at)],created_at:date,updated_at:date});
 const rows=[lesson('old','me','clip','2026-11-19',30),lesson('mine','me','clip','2026-11-20',38.51),lesson('other-owner','other','clip','2026-11-21',40),lesson('other-clip','me','other-clip','2026-11-21',45)];
 const before=JSON.stringify(rows);
 const found=findVideoQuestionLesson(rows,'clip','me');
 assert.equal(found.lesson.id,'mine');assert.equal(found.slide.timedQuestions[0].at,38.51);
 assert.equal(findVideoQuestionLesson(rows,'missing','me'),null);
 assert.equal(JSON.stringify(rows),before);
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
 console.log('PASS: teacher/clip revision lookup, immutable stored times, offset crossing/continuation, current-line selection and gap handling.');
}finally{await server.close();}
