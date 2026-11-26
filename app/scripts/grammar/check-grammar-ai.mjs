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
const {compileWorkshop,meaningChoices,extensionPool,refreshCatalogChoices,choiceVersion}=await import(esm(new URL('_shared/grammarWorkshop.ts',root)));
const {photoRequestLesson}=await import(esm(new URL('extract-textbook/requestLesson.ts',root)));
const bare="I ____ to read a book.", fixed="어제 책을 읽기로 마음을 정했어요. Yesterday, I ____ to read a book.";
const badQuestion={prompt:bare,options:['want','decided'],correct:1,reason:'과거 결정이에요.'};
let rejectRepair=false,repairs=0;
const modelResponse=result=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});
globalThis.fetch=async (url,init)=>{
  if (url.endsWith('/rpc/reserve_enabled_scan')) {
    assert.equal(JSON.parse(init.body).p_academy_id,academy);
    return Response.json(access===200,{status:access===429?200:access});
  }
  if (url.endsWith('/rpc/my_academy_id')) return Response.json(academy);
  assert.equal(url,'https://api.openai.com/v1/responses');
  const call=JSON.parse(init.body);
  if(call.text.format.name==='grammar_choice_review'){
    const visible=JSON.parse(call.input[0].content[0].text);
    const w=family==='other'?compileWorkshop(modelOutput.source,7).workshop:photoRequestLesson([{en:'Sure. No problem.',ko:'물론이지.'}],7,5).workshop;
    const expected=[...w.choices,w.reading,w.interpretation,...meaningChoices(w)];
    return modelResponse(Object.fromEntries(visible.map(q=>{
      assert.deepEqual(Object.keys(q).sort(),['id','options','prompt','task']);
      const possible=q.prompt===bare || (rejectRepair && q.prompt===fixed)?['A','B']:[q.prompt===fixed?'B':Object.keys(q.options)[expected[Number(q.id.slice(1))].correct]];
      return [q.id,{possible,evidence:q.prompt.match(/[가-힣a-z0-9]+/i)[0]}];
    })));
  }
  if(call.text.format.name==='grammar_choice_repair'){
    const failed=JSON.parse(call.input[0].content[0].text);
    assert.equal(failed.length,1);
    assert([bare,fixed].includes(failed[0].prompt));
    repairs++;
    return modelResponse({[failed[0].id]:{...badQuestion,prompt:fixed,reason:'어제 하기로 정했으므로 decided예요.'}});
  }
  if(call.text.format.name==='grammar_source'){
    assert(call.input[0].content.some(part=>part.type==='input_image'));
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({
      family,goal:'문법 학습',situations:'교실',examples:family==='other'?board.examples:family==='infinitive_noun_roles'?
        [{en:'To swim is fun.',ko:'수영하는 것은 재미있다.'},{en:'My goal is to play the guitar.',ko:'내 목표는 기타 치기다.'}]:[{en:'Sure. No problem.',ko:'물론이지.'}]
    })}]}]});
  }
  assert.equal(call.text.format.name,'grammar_board');
  assert(call.input[0].content.every(part=>part.type==='input_text'));
  assert.equal(call.store,false);
  calls++;
  const source=modelOutput.source;
  const phrases=p=>({...p,phrases:p.chunks.map((en,i)=>({en,ko:p.glosses[i]}))});
  const mapped={...source,pair:source.pair.map(phrases),mapScenes:source.mapScenes.map(p=>({...phrases(p),intent:p.label,paraphrase:p.meaning}))};
  return modelResponse({...modelOutput,source:mapped});
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
assert.equal(content.goal,board.goal);
assert.deepEqual(content.steps[2].practice.assembly,scenes[0].chunks);assert.equal(content.workshop.scenes.high.task,kit.scenes.high.task);
assert.deepEqual(content.examples,topic.examples);assert.deepEqual(content.translations,topic.translations);
modelOutput={...board,source:{...board.source,choices:[badQuestion,...kit.choices.slice(1)]}};
const repaired=await handler(source());
assert.equal(repaired.status,200);assert.equal((await repaired.json()).content.workshop.choices[0].prompt,fixed);
rejectRepair=true;assert.equal((await handler(source())).status,422);assert.equal(repairs,3);
modelOutput={...board,readable:false};assert.equal((await handler(source())).status,422);
modelOutput={...board,source:{...board.source,pair:[]}};assert.equal((await handler(source())).status,422);
const {photoInfinitiveLesson}=await import(esm(new URL('extract-textbook/infinitiveLesson.ts',root)));
const worksheet=[{en:'My dream is to play the guitar.',ko:'내 꿈은 기타를 치는 거야.'}];
const noun=photoInfinitiveLesson(worksheet,7,5);
assert.deepEqual(noun.steps[0].practice.map.map(entry=>entry.label),['주어','목적어','보어']);
assert.deepEqual(noun.steps[1].practice.panels.map(p=>p.chunks.join(' ')),['I want to play the guitar.','My dream is to play the guitar.']);
assert.deepEqual(noun.examples,worksheet.map(row=>row.en));
for(let grade=1;grade<=12;grade++)assert(extensionPool(photoInfinitiveLesson(worksheet,grade,25).workshop).length>=25);
for(const action of ['write a book','draw pictures','play the guitar','play soccer','help others']){
  const draft=photoInfinitiveLesson([{en:'My goal is to '+action+'.',ko:'목표를 소개해요.'}],7,5);
  const workshop=draft.workshop;
  const questions=[...workshop.choices,workshop.reading,workshop.interpretation,...meaningChoices(workshop)];
  const keys=['그림 그리는 것','to read','내 계획이 무엇인지','decided','to','To read books','Her goal','너를 만나는 일','~로','To help is important.','To play the drums.',draft.steps[1].answer,...workshop.models.map(m=>m.ko)];
  assert.deepEqual(questions.map(q=>q.options[q.correct]),keys);
  assert(questions.every(q=>new Set(q.options).size===q.options.length && q.prompt.trim() && q.reason.trim()));
  assert(workshop.choices[3].prompt.includes('어제')&&workshop.choices[3].prompt.includes('마음을 정했어요'));
}
family='infinitive_noun_roles';
const fromPhoto=await handler(source());
assert.equal(fromPhoto.status,200);
assert.deepEqual((await fromPhoto.json()).content.steps[0].practice.map.map(m=>m.label),['주어','목적어','보어']);
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
assert.equal(calls,5);
const catalog=[...JSON.parse(fs.readFileSync(new URL('../../src/data/grammarPoints.json',import.meta.url))),
  JSON.parse(fs.readFileSync(new URL('../../src/data/doYouCanYouWorkshop.json',import.meta.url)))];
let slots=0, changed=0;
for(const {workshop} of catalog){
  slots+=workshop.choices.length;
  changed+=workshop.choices.filter(q=>q.previousVersion).length;
  assert.equal(new Set(workshop.choices.map(q=>q.previousPrompt??q.prompt)).size,workshop.choices.length);
  for(let grade=1;grade<=12;grade++){
    const pool=extensionPool({...workshop,grade});
    for(const q of pool.filter(q=>q.kind==='choice')){
      assert(q.prompt.trim() && q.reason.trim());
      assert.equal(new Set(q.options.map(o=>o.trim())).size,q.options.length,q.prompt);
      assert.equal(q.options.filter(o=>o===q.answer).length,1,q.prompt);
    }
  }
}
const jumping=catalog.find(p=>p.id==='i-can').workshop;
assert(jumping.choices.find(q=>q.previousPrompt==='____ you jump?').prompt.includes('점프할 줄'));
const infinitive=catalog.find(p=>p.id==='m-to-inf-noun').workshop;
assert(infinitive.choices.some(q=>q.prompt.includes('Yesterday') && q.prompt.includes('결정')));
const sample={...badQuestion,previousPrompt:undefined};
const revised={...sample,prompt:fixed,previousVersion:choiceVersion(sample),previousPrompt:bare};
const saved={...kit,choices:[sample],grade:7};
const updated=refreshCatalogChoices(saved,{...kit,choices:[revised]});
assert.equal(updated.choices[0].prompt,fixed);
assert.equal(refreshCatalogChoices({...saved,choices:[{...sample,reason:'선생님의 풀이'}]},{...kit,choices:[revised]}).choices[0].prompt,bare);
const teacherQuestion={kind:'choice',title:'직접 수정',prompt:'교사가 편집한 문항',answer:'decided',options:sample.options,reason:'교사의 풀이'};
assert(extensionPool({...updated,overrides:{['choice|'+bare]:teacherQuestion}}).includes(teacherQuestion));
console.log(catalog.length+' blocks, '+slots+' choice slots, '+changed+' revised, all 12 grades. Independent review, targeted repair, rejection and teacher overrides passed.');
