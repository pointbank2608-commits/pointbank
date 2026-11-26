import { File } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { app, sqlRoot } from './block-fixture.mjs';

// Opt-in, localhost-only browser fixture. A Web Audio oscillator feeds Chromium's
// real MediaRecorder. No physical microphone or device recognizer is opened.
export const syntheticAudioSetup = `
Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {configurable:true, value:async()=>{
  const context = new AudioContext();
  await context.resume();
  const output = context.createMediaStreamDestination();
  const oscillator = context.createOscillator();
  oscillator.frequency.value = 330;
  oscillator.connect(output);
  oscillator.start();
  let closed=false;
  for(const track of output.stream.getTracks()){
    const stop = track.stop.bind(track);
    track.stop = ()=>{
      stop();
      if(closed)return;
      closed=true;oscillator.stop();oscillator.disconnect();void context.close();
    };
  }
  return output.stream;
}});
Object.defineProperty(window, 'SpeechRecognition',{configurable:true,value:undefined});
Object.defineProperty(window, 'webkitSpeechRecognition',{configurable:true,value:undefined});
document.documentElement.dataset.homeworkQaAudio='synthetic';
`;
export const audioInvoke = `functions:{async invoke(name,{body}){
  if(name!=='homework-recording')throw Error('unsupported fixture function');
  const upload=body instanceof FormData;
  const response=await fetch('/test-rpc/audio/edge',{method:'POST',
    headers:upload?{}:{'Content-Type':'application/json',...(location.pathname==='/homework'?{Authorization:'Bearer fixture-staff'}:{})},
    body:upload?body:JSON.stringify(body)});
  const data=await response.json();return response.ok?{data,error:null}:{data:null,error:{message:data.error}};
}},`;

export async function createAudioFixture(db, origin) {
  const tools = resolve(process.env.HOMEWORK_AUDIO_TOOLS || resolve(app,'node_modules/homework-test-tools'));
  const {parseBuffer} = await import(pathToFileURL(resolve(tools,'node_modules/music-metadata/lib/index.js')));
  globalThis.File ??= File;
  await db.exec('create table fixture_audio_bytes(path text primary key, bytes bytea not null, mime text not null)');
  const links = new Map();
  const createClient=(_url,_key,options)=>({
    async rpc(name,args){
      try {
        if(name==='hw_recording_target_v2') {
          const result=await db.query('select hw_recording_target_v2($1,$2,$3) as data',[args.p_token,args.p_item,args.p_digest]);
          return {data:result.rows[0].data,error:null};
        }
        if(name==='hw_recording_access' && options?.global?.headers?.Authorization==='Bearer fixture-staff'){
          const result=await db.query('select hw_recording_access($1) as data',[args.p_path]);
          return {data:result.rows[0].data,error:null};
        }
        return {data:false,error:null};
      }catch(error){return {data:null,error};}
    },
    storage:{from(bucket){return {
      async upload(path,bytes,options){
        try {
          await db.transaction(async tx=>{
            await tx.query('insert into fixture_audio_bytes values($1,$2,$3)',[path,bytes,options.contentType]);
            await tx.query('insert into storage.objects(bucket_id,name,user_metadata) values($1,$2,$3)',[bucket,path,JSON.stringify(options.metadata)]);
          });
          return {error:null};
        }catch(error){return {error};}
      },
      async createSignedUrl(path,seconds){
        const token=crypto.randomUUID();
        links.set(token,{path,expires:Date.now()+seconds*1000});
        return {data:{signedUrl:origin+'/test-rpc/audio/file/'+token},error:null};
      }
    };}},
  });
  const source=readFileSync(resolve(sqlRoot,'functions/homework-recording/index.ts'),'utf8').replace(/^import .*;\r?\n/gm,'');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  let handle;
  new Function('createClient','parseBuffer','Deno',js)(createClient,parseBuffer,{
    serve(handler){handle=handler;},env:{get:()=> 'test'},
  });
  return async function audioRequest(req,res){
    const url=new URL(req.url,origin);
    if(url.pathname==='/audio/edge'&&req.method==='POST'&&req.headers.origin===origin){
      const response=await handle(new Request(origin+'/recording',{method:'POST',headers:req.headers,body:req,duplex:'half'}));
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const link=url.pathname.startsWith('/audio/file/')?links.get(url.pathname.slice('/audio/file/'.length)):undefined;
    if(!link || link.expires<Date.now() || !['GET','HEAD'].includes(req.method)){
      res.writeHead(403);res.end();return;
    }
    const row=(await db.query('select bytes,mime from fixture_audio_bytes where path=$1',[link.path])).rows[0];
    if(!row){res.writeHead(404);res.end();return;}
    const bytes=Buffer.from(row.bytes),range=req.headers.range;
    const headers={'Content-Type':row.mime,'Cache-Control':'no-store','Accept-Ranges':'bytes'};
    let start=0,end=bytes.length-1;
    if(range){
      const match=/^bytes=(\d+)-(\d*)$/.exec(range);
      if(!match || Number(match[1])>end){res.writeHead(416);res.end();return;}
      start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));
      if(end<start){res.writeHead(416);res.end();return;}
      headers['Content-Range']='bytes '+start+'-'+end+'/'+bytes.length;
    }
    headers['Content-Length']=String(end-start+1);
    res.writeHead(range?206:200,headers);res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));
  };
}
