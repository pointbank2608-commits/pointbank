import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/playwright/index.mjs';
const moduleId='\0segment-harness.js';
const harness=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{useYoutubeSegment}from'/src/lib/useYoutubeSegment.ts';import SoloSourceVideo from '/src/components/solo/SoloSourceVideo.tsx';
function Check(){const segment=useYoutubeSegment('fixture-video',10.25,true);const[result,setResult]=useState('');const[progress,setProgress]=useState('');
 const play=async tracking=>{setResult('pending');setProgress('');const ok=await segment.playSegment(10.25,12.75,tracking?.5:.75,tracking?t=>setProgress(String(t)):undefined);setResult(String(ok));};
 return React.createElement('main',null,React.createElement('div',{id:segment.elementId}),React.createElement('button',{disabled:!segment.ready,onClick:()=>play(false)},'Shadow'),React.createElement('button',{disabled:!segment.ready,onClick:()=>play(true)},'Watch'),React.createElement('button',{onClick:segment.stop},'Stop'),React.createElement('output',{'data-result':true},result),React.createElement('output',{'data-progress':true},progress));}
function SourceCheck(){const[done,setDone]=useState('');return React.createElement('main',null,React.createElement(SoloSourceVideo,{clip:{videoId:'fixture-video',start:10.25,end:12.75,captions:[{start:10.25,end:11,text:'First caption'},{start:11,end:12.75,text:'Second caption'}]},bounded:true,onPlay:()=>setDone('source-playing'),onHeard:()=>setDone('source-complete'),onError:()=>setDone('source-error')}),React.createElement('output',{'data-source-result':true},done));}
createRoot(document.getElementById('root')).render(React.createElement(location.search.includes('source')?SourceCheck:Check));`;
const server=await createServer({root:fileURLToPath(new URL('../../',import.meta.url)),configFile:false,cacheDir:await mkdtemp(join(tmpdir(),'segment-bounds-')),server:{host:'127.0.0.1',port:5234,strictPort:true},plugins:[react(),{
 name:'segment-hook-check',resolveId(id){if(id==='/@segment-harness.js')return moduleId;},load(id){if(id===moduleId)return harness;},
 configureServer(vite){vite.middlewares.use('/segment-check',async(_request,response,next)=>{try{const html=await vite.transformIndexHtml('/segment-check','<div id="root"></div><script type="module" src="/@segment-harness.js"></script>');response.setHeader('Content-Type','text/html').end(html);}catch(error){next(error);}});}
}]});
await server.listen();let browser;
try{
 browser=await chromium.launch({channel:'chrome'});const context=await browser.newContext();
 await context.addInitScript(()=>{
  window.__segmentLoads=[];
  window.YT={Player:class{
   constructor(id,options){this.options=options;window.__segmentOptions=options;this.time=0;this.state=2;this.rate=1;window.__segmentPlayer=this;setTimeout(()=>options.events.onReady(),0);}
   getCurrentTime(){return this.time;}getDuration(){return 500;}getPlayerState(){return this.state;}setPlaybackRate(value){this.rate=value;}
   loadVideoById(value){window.__segmentLoads.push({...value});this.time=value.startSeconds;this.state=1;this.rate=1;queueMicrotask(()=>this.options.events.onStateChange?.({data:1}));}
   seekTo(time){this.time=time;}playVideo(){this.state=1;}pauseVideo(){this.state=2;}destroy(){}
  }};
 });
 const page=await context.newPage();page.on('pageerror',error=>console.error(error.message));await page.goto('http://127.0.0.1:5234/segment-check');
 await page.getByRole('button',{name:'Shadow',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>window.__segmentLoads.at(-1)),{videoId:'fixture-video',startSeconds:10.25,endSeconds:12.75});
 assert.equal(await page.evaluate(()=>window.__segmentPlayer.rate),.75);
 // Native segment completion is valid even when a poll resumes slightly before the configured end.
 await page.evaluate(()=>{window.__segmentPlayer.time=12.66;window.__segmentPlayer.state=0;});
 await page.locator('[data-result]').getByText('true',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Watch',exact:true}).click();
 await page.evaluate(()=>{window.__segmentPlayer.time=10.4;});
 await page.locator('[data-progress]').getByText('10.4',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.__segmentPlayer.rate),.5);
 await page.evaluate(()=>{window.__segmentPlayer.time=12.66;window.__segmentPlayer.state=0;});
 await page.locator('[data-result]').getByText('true',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Shadow',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__segmentLoads.length),3);
 assert.equal(await page.evaluate(()=>window.__segmentLoads.at(-1).endSeconds),12.75);
 await page.getByRole('button',{name:'Stop',exact:true}).click();
 await page.locator('[data-result]').getByText('false',{exact:true}).waitFor();
 await page.goto('http://127.0.0.1:5234/segment-check?source');
 await page.getByRole('button',{name:'자막 켜기',exact:true}).click();await page.getByText('First caption',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.__segmentOptions.playerVars.controls),0);assert.equal(await page.locator('[inert]').count(),1);
 await page.getByRole('button',{name:'원본 재생',exact:true}).click();
 await page.evaluate(()=>{window.__segmentPlayer.time=11.2;});await page.getByText('Second caption',{exact:true}).waitFor();
 await page.evaluate(()=>{window.__segmentPlayer.time=12.66;window.__segmentPlayer.state=0;});await page.locator('[data-source-result]').getByText('source-complete',{exact:true}).waitFor();
 await page.getByRole('button',{name:'원본 재생',exact:true}).click();await page.getByRole('button',{name:'재생 멈추기',exact:true}).click();
 assert.equal(await page.locator('[data-source-result]').textContent(),'source-playing');assert.equal(await page.getByRole('button',{name:'원본 재생',exact:true}).isEnabled(),true);
 console.log('PASS: native bounds for shadow/watch/replay, speed restoration, native end/interruption, locked source controls and advancing bounded captions.');
}finally{await browser?.close();await server.close();}
