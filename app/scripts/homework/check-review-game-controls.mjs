import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import React,{act} from 'react';
import {createInstance} from 'i18next';
import {I18nextProvider} from 'react-i18next';
import {app} from './block-fixture.mjs';
import {wordCards} from './material-fixture.mjs';

// DOM component test. No browser, network, microphone or production data.
const lib=resolve(process.env.HOMEWORK_AUDIO_TOOLS || resolve(app,'node_modules/homework-test-tools'));
const {Window}=await import(pathToFileURL(resolve(lib,'node_modules/happy-dom/lib/index.js')));
const window=new Window();
for (const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true}))
  Object.defineProperty(globalThis,key,{value,configurable:true});
const {createRoot}=await import('react-dom/client');
const server=await createServer({root:app,configFile:false,logLevel:'error',appType:'custom',
  server:{middlewareMode:true,ws:false,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},esbuild:{jsx:'automatic'},oxc:{jsx:{runtime:'automatic'}},
  plugins:[{name:'test-client',enforce:'pre',load(id){
    if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return 'export const supabase={}';
  }}]});
const host=document.createElement('div');document.body.appendChild(host);
const root=createRoot(host);
const i18n=createInstance();await i18n.init({lng:'ko',resources:{ko:{translation:{}}}});
const render=async(component,props)=>act(async()=>root.render(React.createElement(I18nextProvider,{i18n},React.createElement(component,props))));
const click=async el=>{assert.ok(el && !el.disabled,'expected enabled control');await act(async()=>el.click());};
const wait=async ms=>act(async()=>{await new Promise(done=>setTimeout(done,ms));});
try{
  const {buildReviewGames}=await server.ssrLoadModule('/src/lib/homework/materialReviewGames.ts');
  const {gradeLocal,answerTextLocal}=await server.ssrLoadModule('/src/lib/homework/grade.ts');
  const {items}=buildReviewGames([{id:'test',kind:'word',name:'Trip',cards:wordCards}],['memory','flip','guess','shoot'],false);
  const match=(await server.ssrLoadModule('/src/components/homework/MatchupGame.tsx')).default;
  let done=0,attempts=0;
  const qs=items[0].content.questions;
  await render(match,{item:items[0],faceDown:true,answered:new Map(),onDone:()=>done++,onSubmit:async(i,r)=>{
    attempts++;return {correct:gradeLocal(qs[i],r),answer:answerTextLocal(qs[i])};
  }});
  const pick=(type,i)=>host.querySelector(`[aria-label="${type} 카드 ${i+1}"]`);
  const first=qs[0];
  await click(pick('단어',0));assert.ok(host.textContent.includes(first.prompt));
  const wrong=(first.correct+1)%first.choices.length;
  await click(pick('뜻',wrong));assert.ok(host.textContent.includes(first.choices[wrong]));
  await wait(730);assert.ok(!host.textContent.includes(first.prompt));
  for (const round of [qs.slice(0,5),qs.slice(5)]){
    for(const [i,q] of round.entries()){
      await click(pick('단어',i));await click(pick('뜻',q.correct));
    }
    await wait(480);
  }
  assert.equal(done,1);assert.equal(attempts,11);
  const flip=(await server.ssrLoadModule('/src/components/homework/FlipDeck.tsx')).default;
  done=0;
  await render(flip,{text:items[1].config.block.text,busy:false,onDone:()=>done++});
  for(const card of wordCards){
    await click(host.querySelector('button[aria-label]'));assert.ok(host.textContent.includes(card.meaning));
    await click([...host.querySelectorAll('button')].at(-1));
  }
  assert.equal(done,1);
  const question=(await server.ssrLoadModule('/src/components/homework/QuestionCard.tsx')).default;
  const scramble=items[2].content.questions[0];let answer;
  await render(question,{q:scramble,disabled:false,onAnswer:r=>{answer=r;}});
  for(const letter of scramble.correct)await click([...host.querySelectorAll('button[data-tile]')].find(el=>el.textContent===letter));
  await click(host.querySelector('button[data-order-submit]'));assert.ok(gradeLocal(scramble,answer));
  const targets=(await server.ssrLoadModule('/src/components/homework/ReviewWordTargets.tsx')).default;
  const target=items[3].content.questions[0];
  await render(targets,{question:target,disabled:false,onAnswer:r=>{answer=r;}});
  await click(host.querySelectorAll('button')[target.correct]);assert.ok(gradeLocal(target,answer));
  console.log('PASS actual game controls: face-down pairs and mismatch reset, 10 matches in 2 rounds, flip all 10, assemble letters, hit a word target');
}finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.abort();}
