import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import React, { act } from 'react';
import { createServer } from 'vite';

// A component test with synthetic media devices. Does not launch a browser or use a microphone.
const app = fileURLToPath(new URL('../../', import.meta.url));
const toolsDir = resolve(process.env.HOMEWORK_AUDIO_TOOLS || resolve(app,'node_modules/homework-test-tools'));
const { Window } = await import(pathToFileURL(resolve(toolsDir,'node_modules/happy-dom/lib/index.js')));
const dom = new Window();
for (const [name,value] of Object.entries({window:dom, document:dom.document, navigator:dom.navigator,
  IS_REACT_ACT_ENVIRONMENT:true, localStorage:dom.localStorage})) Object.defineProperty(globalThis,name,{configurable:true,value});
const { createRoot } = await import('react-dom/client');
let deny=false, recordNumber=0, audioCount=0, heard='road', empty=false;
Object.defineProperty(dom.navigator, 'mediaDevices',{value:{getUserMedia:async()=>{
  if (deny) throw new DOMException('test','NotAllowedError');
  return {getTracks:()=>[{stop(){}}]};
}}});
class Recorder {
  static isTypeSupported(){return true;}
  state='inactive';
  start(){this.state='recording';}
  stop(){
    if(this.state!=='recording')return;
    this.state='inactive';
    this.ondataavailable?.({data:new Blob([new Uint8Array(empty?0:128).fill(++recordNumber)])});
    this.onstop?.();
  }
}
globalThis.MediaRecorder=Recorder;
dom.SpeechRecognition=class {
  processLocally=false;
  start(){assert.equal(this.processLocally,true);if(heard)this.onresult?.({results:[[{transcript:heard}]]});}
  stop(){} abort(){}
};
dom.speechSynthesis={cancel(){}};
globalThis.testMaterialAudio=async()=>{audioCount++;return true;};
let video;
globalThis.testMaterialVideo=props=>{video=props;return React.createElement('div',null,'테스트 영상');};
const server=await createServer({
  root:app,configFile:false,appType:'custom',logLevel:'error',optimizeDeps:{noDiscovery:true},
  server:{middlewareMode:true,hmr:false,ws:false,watch:null},
  esbuild:{jsx:'automatic'},oxc:{jsx:{runtime:'automatic'}},
  plugins:[{name:'test-media',enforce:'pre',load(id){
    const file=id.replaceAll('\\','/');
    if(file.endsWith('/src/lib/speech.ts'))return 'export const speakVerified = (...args) => globalThis.testMaterialAudio(...args);';
    if(file.endsWith('/src/components/PlainTeachingVideo.tsx'))return 'export default function Video(props){return globalThis.testMaterialVideo(props);}';
  }}],
});
const rootElement=dom.document.createElement('div');dom.document.body.appendChild(rootElement);
const root=createRoot(rootElement);
let uploaded=[],submitted=[],rejectUpload=false, rejectCommit=false;
const api={uploadRecording:async(_id,blob)=>{uploaded.push(blob);if(rejectUpload)throw Error('offline');return 'test/path';}};
const complete=async meta=>{if(rejectCommit)throw Error('network');submitted.push(meta);};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const button=label=>[...rootElement.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')===label || x.textContent.trim()===label);
const click=async label=>{
  const target=button(label);assert(target,label);assert(!target.disabled,label);
  await act(async()=>{target.click();});
};
const record=async()=>{
  await click(button('다시 녹음')?'다시 녹음':'녹음하기');
  await wait(540);await click('녹음 끝내기');
};
try{
  const {default:Card}=await server.ssrLoadModule('/src/components/homework/MaterialStudyCard.tsx');
  async function render(id,method,block={},lines=[]){
    const config={block:{method:'material:'+method,completion:method==='listen'?'confirm':'recording',
      text:'road',translation:'길',audioUrl:'',start:0,end:1,hiddenWords:[],...block}};
    await act(async()=>{root.render(React.createElement(Card,{key:id,item:{id,title:method,config,content:{lines}},
      api,preview:false,onDone:complete}));await wait(5);});
  }
  await render('learn1','learn');await act(async()=>{await wait(20);});
  assert(audioCount>=1);
  await click('한글 뜻 보기');await click('영어 단어 보기');
  assert(button('제출하기').disabled);
  await click('🔊 다시 듣기');assert(button('한글 뜻 보기'));
  await record();assert(rootElement.textContent.includes('Correct'));
  rejectUpload=true;await click('제출하기');assert(rootElement.querySelector('[role=alert]'));
  rejectUpload=false;rejectCommit=true;await click('제출하기');
  rejectCommit=false;await click('제출하기');
  assert.equal(uploaded.length,2);assert.equal(uploaded[0],uploaded[1]);assert.equal(submitted.length,1);assert.equal(submitted[0].meaningSeen,true);
  await render('learn2','learn');await act(async()=>{await wait(20);});heard='different';await record();
  assert(rootElement.textContent.includes('Incorrect'));assert(button('제출하기').disabled);
  await click('한글 뜻 보기');assert(!button('제출하기').disabled);await click('제출하기');
  await render('say','say');assert(!rootElement.textContent.includes('road'));
  deny=true;await click('녹음하기');assert(rootElement.textContent.includes('권한'));assert(button('제출하기').disabled);deny=false;
  empty=true;await record();assert(button('제출하기').disabled);empty=false;
  heard='';await record();assert(rootElement.textContent.includes('Incorrect'));await click('제출하기');
  await render('hide','hide',{text:'We need a map.',translation:'우리는 지도가 필요해요.',hiddenWords:[3]});
  assert(button('녹음하기').disabled);await click('가리기');assert(rootElement.textContent.includes('We need a _____.'));
  await click('힌트 보기');assert(rootElement.textContent.includes('We need a map.'));
  await click('힌트 가리기');assert(rootElement.textContent.includes('We need a _____'));assert(rootElement.textContent.includes('우리는 지도가 필요해요.'));
  await render('listen','listen');assert(!button('녹음하기'));await click('🔊 다시 듣기');await click('다음');
  await render('repeat','repeat');assert(button('녹음하기').disabled);await click('🔊 다시 듣기');assert(!button('녹음하기').disabled);
  const lines=[{s:0,e:1,en:'Go!',speaker:'Dad'},{s:1,e:2,en:'Yes!',speaker:'Caillou'}];
  await render('dub','dub',{role:'Caillou',videoUrl:'test',end:2},lines);
  let starts=0;
  video.controlRef.current={playFrom:at=>{assert.equal(at,0);starts++;},pause(){}};
  await act(async()=>video.onReady());await click('녹음하기');assert.equal(starts,1);await wait(540);
  for(const at of [0,.5,1,1.5,2]){
    await act(async()=>video.onTime(at,true,false));
    if(at===.5) assert(rootElement.textContent.includes('✓ Dad'));
    if(at===1.5) assert(rootElement.textContent.includes('✓ Caillou'));
  }
  assert(!button('녹음 끝내기'));await click('제출하기');
  await render('echo','echo',{text:'Go!',videoUrl:'test',end:1},[lines[0]]);
  assert(!rootElement.textContent.includes('Go!'));await click('대사 보기');assert(rootElement.textContent.includes('Go!'));await click('대사 가리기');
  assert(button('녹음하기').disabled);await act(async()=>video.onTime(1,true,false));assert(!button('녹음하기').disabled);
  console.log('PASS actual React cards with synthetic media: both flip/record orders, replay, correct/incorrect/unrecognized, permission/empty files, same-file retries, manual hints, listen/repeat, assigned role/live speaker, echo. Physical microphone/video untested.');
} finally {
  await act(async()=>root.unmount());
  await server.close();await dom.happyDOM.close();
}
