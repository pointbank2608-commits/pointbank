// Exercise the real Edge handler with in-memory HTTP dependencies, without spending model credits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const root = new URL('../../../supabase/functions/', import.meta.url);
let handler;
globalThis.Deno = { serve(fn) { handler = fn; }, env: { get: () => 'fixture' } };
function esm(path) {
  const source = fs.readFileSync(path,'utf8').replace(/from '([.][^']+\.ts)'/g,
    (_, dep) => 'from "' + esm(new URL(dep,path)) + '"');
  const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext}});
  return 'data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64');
}
await import(esm(new URL('extract-textbook/index.ts',root)));
const academy='00000000-0000-4000-8000-000000000001';
const topic=JSON.parse(fs.readFileSync(new URL('../../src/data/grammarPoints.json',import.meta.url)))[0];
const board={...topic,readable:true,examples:topic.examples.map((en,i)=>({en,ko:topic.translations[i]}))};
const kit=topic.workshop, scenes=topic.steps[1].practice.panels, why=topic.steps[1].practice.why[0];
const panels=scenes.map(p=>({...p,image:'',setting:topic.steps[0].prompt,response:p.meaning,rationale:why[1]}));
board.source={...kit.scenes,scene:topic.steps[0].prompt,map:panels.map(p=>p.label+': '+p.meaning),mapScenes:panels,pair:panels,
  why:why[0],because:why[1],misconception:'거리에 관계없이 두 말은 늘 같은 뜻이다.',clue:kit.choices[0],apply:kit.choices[1],
  models:kit.models,choices:kit.choices,repairs:kit.repairs,reading:kit.reading};
let modelOutput=board, access=403, calls=0, family='other';
globalThis.fetch=async (url,init)=>{
  if (url.endsWith('/rpc/reserve_enabled_scan')) {
    assert.equal(JSON.parse(init.body).p_academy_id,academy);
    return Response.json(access===200,{status:access===429?200:access});
  }
  if (url.endsWith('/rpc/my_academy_id')) return Response.json(academy);
  assert.equal(url,'https://api.openai.com/v1/responses');
  const call=JSON.parse(init.body);
  if(call.text.format.name==='grammar_source'){
    assert(call.input[0].content.some(part=>part.type==='input_image'));
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({
      family,goal:'문법 학습',situations:'교실',examples:family==='other'?board.examples:[{en:'Sure. No problem.',ko:'물론이지.'}]
    })}]}]});
  }
  assert.equal(call.text.format.name,'grammar_board');
  assert(call.input[0].content.every(part=>part.type==='input_text'));
  assert.equal(call.store,false);
  calls++;
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(modelOutput)}]}]});
};
const headers={authorization:'Bearer fixture'};
const req=body=>new Request('https://fixture.invalid',{method:'POST',headers,body});
function source() {
  const body=new FormData();
  body.set('academy',academy);body.set('mode','grammar');body.set('audience','middle');
  body.set('files',new File([new Uint8Array([255,216,255,0])],'unit.jpg',{type:'image/jpeg'}));
  return req(body);
}
assert.equal((await handler(source())).status,403);
for (const data of [{mode:'generate',academy,grade:7,wordCount:2,sentenceCount:2,topic:'test'},
  {mode:'worksheet',academy,source:'unit'}]) {
  const request=new Request('https://fixture.invalid',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await handler(request)).status,403);
}
access=429;assert.equal((await handler(source())).status,429);assert.equal(calls,0);
access=200;const good=await handler(source());
assert.equal(good.status,200);const {content}=await good.json();
assert.equal(content.steps.length,6);assert.equal(content.audience,'middle');assert.equal(content.workshop.grade,7);
assert.deepEqual(content.steps[2].practice.assembly,scenes[0].chunks);assert.equal(content.workshop.scenes.high.task,kit.scenes.high.task);
assert.deepEqual(content.examples,topic.examples);assert.deepEqual(content.translations,topic.translations);
modelOutput={...board,readable:false};assert.equal((await handler(source())).status,422);
modelOutput={...board,source:{...board.source,pair:[]}};assert.equal((await handler(source())).status,422);
family='can_request_response';
const requests=await (await handler(source())).json();
assert.equal(requests.content.steps[2].practice.assembly.join(' '),'Can you please close the door?');
assert(requests.content.steps[1].practice.panels[1].chunks.join(' ').includes("I can't. I'm busy now."));
assert(!/[a-z]/i.test(requests.content.workshop.scenes.middle.task));
access=403;
for(const endpoint of ['shadow-script','extract-lesson-from-video']){
  await import(esm(new URL(endpoint+'/index.ts',root)));
  assert.equal((await handler(req(JSON.stringify({videoId:'example'})))).status,403);
}
assert.equal(calls,3);
console.log('Edge: allowed grammar, denied photo/topic/worksheet/video, quota, unreadable source and incomplete stages passed.');
