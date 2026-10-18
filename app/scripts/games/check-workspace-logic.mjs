import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const server=await createServer({root,logLevel:'error',plugins:[{name:'no-backend',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return 'export const supabase={};';}}],server:{middlewareMode:true,hmr:false},appType:'custom'});
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
try {
 const {gameClock:c,pauseGameClock:pause}=await server.ssrLoadModule('/src/lib/gameClock.ts');
 const {prepareClassroomGame:prepare}=await server.ssrLoadModule('/src/lib/gameWorkspace.ts');
 const source={kind:'word',items:[{id:'a',word:'apple',meaning:'사과',image_url:null,category:'fruit'},{id:'b',word:'banana',meaning:'바나나',image_url:null,category:'fruit'},{id:'c',word:'cat',meaning:'고양이',image_url:null,category:'animal'}]};
 const original=JSON.stringify(source);
 assert(prepare('quiz',source).config.questions.every(q=>q.correctIndex>=0&&q.correctIndex<q.choices.length));
 assert.equal(prepare('wheel',source).items.length,3);assert.equal(JSON.stringify(source),original);
 assert.equal(prepare('quiz',{kind:'sentence',items:[{id:'s',word:'I like cats.',meaning:'좋아요',image_url:null,category:null}]}),null);
 assert.equal(prepare('unscramble',{kind:'sentence',items:[{id:'s',word:'I like cats.',meaning:'좋아요',image_url:null,category:null}]}).items.length,1);
 assert.equal(prepare('doctor',source),null);assert.equal(prepare('imagequiz',source),null);
 assert.equal(prepare('matchup',{kind:'word',items:[source.items[0],source.items[0]]}),null);
 console.log('ok source conversion: word/sentence compatibility, answer validity, original preservation, no fake roleplay/image/match data');
 let fired=0;pause('teacher',true);const start=c.now();c.setTimeout(()=>fired++,30);await wait(60);assert.equal(fired,0);assert.equal(c.now(),start);
 pause('team',true);pause('teacher',false);await wait(40);assert.equal(fired,0);pause('team',false);await wait(60);assert.equal(fired,1);
 pause('teacher',true);const canceled=c.setTimeout(()=>fired++,5);c.clearTimeout(canceled);pause('teacher',false);await wait(20);assert.equal(fired,1);
 let ticks=0;const interval=c.setInterval(()=>ticks++,15);await wait(40);pause('teacher',true);const before=ticks;await wait(50);assert.equal(ticks,before);pause('teacher',false);await wait(40);assert(ticks>before);c.clearInterval(interval);
 let frameAt;pause('teacher',true);c.requestAnimationFrame(t=>{frameAt=t;});await wait(30);assert.equal(frameAt,undefined);pause('teacher',false);await wait(40);assert.equal(typeof frameAt,'number');
 console.log('ok clock: pause, remaining duration, multiple pause owners, cancel, interval and animation-frame resume');
}finally{await server.close();}
