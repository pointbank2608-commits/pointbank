import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { File } from 'node:buffer';
import { materialDatabase } from './material-fixture.mjs';
import { fixtureIds } from './block-fixture.mjs';
import { createAudioFixture } from './material-audio-fixture.mjs';

const origin='http://127.0.0.1:5498';
const {db,students}=await materialDatabase();
const scalar=async(q,args)=>(await db.query(q+' as v',args)).rows[0].v;
try {
  const handle=await createAudioFixture(db,origin);
  async function send(url,method,body,headers={}) {
    const request=new Request(origin+url,{method,body,headers:{origin,...headers}});
    const req=request.body ? Readable.fromWeb(request.body) : Readable.from([]);
    Object.assign(req,{url,method,headers:Object.fromEntries(request.headers)});
    let status=0,data;
    await handle(req,{writeHead(s){status=s;},end(b){data=b;}});
    return {status,data:data??Buffer.alloc(0)};
  }
  const block={schemaVersion:1,type:'speak',completion:'recording',method:'material:learn',text:'road',translation:'길',
    audioUrl:'',imageUrl:'',videoUrl:'',question:'',stages:['model'],hiddenWords:[],repeats:1,start:0,end:30};
  const draft={id:crypto.randomUUID(),revision:0,title:'Audio flow test',template:false,items:[{kind:'worksheet',title:'단어 익히기',config:{block},content:{questions:[]}}]};
  const issued=await scalar('select hw_assign_draft($1,$2,$3::uuid[],null,$4)',[fixtureIds.c,JSON.stringify(draft),[students[0].id],crypto.randomUUID()]);
  const student=await scalar('select student_login_by_phone($1,$2,$3)',[students[0].name,'01000000000','audio-qa']);
  const attempt=await scalar('select student_open_homework($1,$2)',[student.token,issued.code]);
  const state=await scalar('select hw_state($1)',[attempt.token]);
  const item=state.items[0].id;
  const file=readFileSync(resolve(process.env.HOMEWORK_AUDIO_TOOLS || 'app/node_modules/homework-test-tools',process.env.HOMEWORK_AUDIO_FIXTURE || 'synthetic-recording.webm'));
  const form=new FormData();form.set('token',attempt.token);form.set('item',item);form.set('duration','1.1');form.set('audio',new File([file],'capture',{type:'audio/webm'}));
  const upload=await send('/audio/edge','POST',form);
  assert.equal(upload.status,200,upload.data.toString());
  const {path}=JSON.parse(upload.data);
  assert.equal((await send('/audio/edge','POST',form)).status,200);
  const byteCount=(await db.query('select count(*)::int as n from fixture_audio_bytes')).rows[0].n;
  assert.equal(byteCount,1);
  const submit=await scalar("select hw_progress($1,$2,'item_complete',$3,$4)",[attempt.token,item,JSON.stringify({recording:path,duration:1.1,meaningSeen:true,recordingCheck:'unavailable'}),crypto.randomUUID()]);
  assert(submit);
  await scalar('select hw_finish($1)',[attempt.token]);
  const found=await scalar('select hw_block_results($1)',[issued.id]);assert.equal(found[0].meta.recording,path);
  const sign=async authorization=>send('/audio/edge','POST',JSON.stringify({path}),{'content-type':'application/json',authorization});
  assert.equal((await sign('Bearer student-fixture')).status,403);
  const teacher=await sign('Bearer fixture-staff');assert.equal(teacher.status,200);
  const pathToFile=new URL(JSON.parse(teacher.data).url).pathname.slice('/test-rpc'.length);
  const played=await send(pathToFile,'GET',undefined);assert.equal(played.status,200);assert.deepEqual(played.data,file);
  const partial=await send(pathToFile,'GET',undefined,{range:'bytes=0-15'});assert.equal(partial.status,206);assert.deepEqual(partial.data,file.subarray(0,16));
  console.log('PASS teacher dispatch -> student phone login -> upload, submit and finish -> teacher result, signed playback and byte-for-byte/range read. Real SQL and Edge code, generated WebM and local storage adapter.');
} finally {await db.close();}
