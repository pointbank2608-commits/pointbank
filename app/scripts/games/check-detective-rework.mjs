import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {tmpdir} from 'node:os';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {createServer} from 'vite';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const names=[...readFileSync(resolve(root,'src/lib/api.ts'),'utf8').matchAll(/export (?:async )?function (\w+)|export const (\w+)/g)].map(m=>m[1]||m[2]);
const api=`
const rows=JSON.parse(sessionStorage.getItem('adventure-test-rows')||'[]');
const lessons=JSON.parse(sessionStorage.getItem('adventure-test-lessons')||'[]');
const flush=()=>{sessionStorage.setItem('adventure-test-rows',JSON.stringify(rows));sessionStorage.setItem('adventure-test-lessons',JSON.stringify(lessons));};
const lists=[{id:'words-test',kind:'word',name:'검증 단어장',items:['apple','banana','milk'].map((word,i)=>({id:String(i),word,meaning:['사과','바나나','우유'][i],image_url:null}))},{id:'sentences-test',kind:'sentence',name:'검증 문장',items:[{id:'s',word:'She goes to school.',meaning:'그녀는 학교에 가요.',image_url:null}]}];
const fn={fetchClasses:async()=>[{id:'class-test',academy_id:'academy-test',name:'검증 반'}],fetchMyStudentRow:async()=>({class_id:'class-test'}),fetchAllWordLists:async()=>lists,fetchWordLists:async()=>lists,
fetchGameTemplates:async(a,c,t)=>structuredClone(rows.filter(r=>r.game_type===t)),fetchGameTemplateById:async id=>structuredClone(rows.find(r=>r.id===id)),
createGameTemplate:async p=>{if(window.__failStorySave)throw Error('합성 저장 실패');const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,name:p.name,items:p.items,config:p.config,created_by:p.teacherId,updated_at:'test'};rows.push(row);flush();return structuredClone(row)},
updateGameTemplate:async(id,patch)=>{if(window.__failStorySave)throw Error('합성 저장 실패');const row=rows.find(r=>r.id===id);if(row){Object.assign(row,patch);flush()}},renameGameTemplate:async(id,name)=>{rows.find(r=>r.id===id).name=name;flush()},
fetchAllCurriculumLessons:async()=>structuredClone(lessons),fetchCurriculumLessonById:async id=>structuredClone(lessons.find(l=>l.id===id)),createCurriculumLesson:async p=>{const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,playlist:p.playlist};lessons.push(row);flush();return row},appendActivityToLesson:async(l,s)=>{lessons.find(r=>r.id===l.id).playlist.push(s);flush()}};
${names.map(n=>`export const ${n}=(...args)=>(fn.${n}||(async()=>[]))(...args);`).join('\n')}`;
const auth=`const value={academy:{id:'academy-test',plan:'paid',features:{group:true}},profile:{id:'teacher-test'},isStaff:new URLSearchParams(location.search).get('mode')!=='student',isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-test'}},trial:{active:true}};export const useAuth=()=>value;`;
const server=await createServer({root,configLoader:'runner',logLevel:'error',plugins:[{name:'adventure-synthetic-only',enforce:'pre',load(id){const p=id.replaceAll('\\','/');if(p.endsWith('/src/lib/api.ts'))return api;if(p.endsWith('/src/context/AuthContext.tsx'))return auth;if(p.endsWith('/src/context/ToastContext.tsx'))return `const value={notify:(s)=>{window.__notice=s},run:async f=>{try{await f();return true}catch{return false}}};export const useToast=()=>value;`;if(p.endsWith('/src/lib/supabase.ts'))return 'export const supabase={};';}}],cacheDir:resolve(tmpdir(),'classbank-detective-vite-cache'),server:{host:'127.0.0.1',port:5461,strictPort:true,hmr:false}});
await server.listen();
let browser,page;
try {
  const base='http://127.0.0.1:5461/scripts/games/adventure-page.html';
  const grammar=await server.ssrLoadModule('/src/lib/detectiveSuggestion.ts');
  const adventure=await server.ssrLoadModule('/src/lib/adventureGames.ts');
  const config=adventure.sampleAdventure('grammardetective');
  for (const rule of grammar.DETECTIVE_RULES) {
    const variants=grammar.detectiveVariants(rule.example,[rule.id]);
    assert.ok(variants.length,rule.id);
    for (const variant of variants) {
      const item=grammar.detectiveCaseFromVariant(variant);
      assert.equal(adventure.detectiveSentence(item,{[item.errors[0].id]:item.errors[0].replacement}),rule.example);
      assert.deepEqual(adventure.adventureErrors('grammardetective',{...config,cases:[item]}),[]);
    }
  }
  for (const sentence of ['She stopped talking.','She stopped to talk.','I ate orange for breakfast.','She can swims.']) {
    assert.deepEqual(grammar.detectiveVariants(sentence),[],sentence);
  }
  assert.deepEqual(grammar.detectiveVariants('She lives in Seoul.',['prepositions']),[]);
  assert.deepEqual(grammar.detectiveVariants('She has better books than mine.',['comparison']),[]);
  assert.equal(grammar.detectiveVariants('She has a bigger bag than mine.',['comparison'])[0].incorrect,'She has a more bigger bag than mine.');
  const mixed=grammar.previewDetectiveDraft('She eats an apple every morning.\nShe can swim.\nShe stopped talking.', ['articles','verb-form','comparison']);
  assert.deepEqual(mixed.ready.map(r=>r.variant.rule),['articles','verb-form']);
  assert.deepEqual(mixed.review.map(r=>r.correct),['She stopped talking.']);
  assert.equal(mixed.counts.get('comparison').length,0);
  const deck=grammar.previewDetectiveDraft('She eats an apple.\nShe needs a pencil.\nShe can swim.', ['articles','verb-form']);
  const limited={...config,count:2,shuffle:true,detectiveDraft:{sentences:'',rules:['articles','verb-form']},
    cases:deck.ready.map(({variant})=>grammar.detectiveCaseFromVariant(variant))};
  assert.deepEqual(adventure.adventureRounds('grammardetective',limited).map(round=>round.item.rule).sort(),['articles','verb-form']);
  console.log('PASS nine rules, exact corrections, review queue and selection');
  browser=await chromium.launch({channel:'chrome',headless:true});
  page=await browser.newPage({viewport:{width:1350,height:950}});
  page.setDefaultTimeout(12000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?mode=games');
  const star=page.getByRole('button',{name:'문법 탐정 즐겨찾기',exact:true});
  await star.click();
  assert.equal(await star.getAttribute('aria-pressed'),'true');
  assert.match(page.url(),/mode=games/);
  const phonics=page.locator('a[href^="/phonics-games/"]').filter({has:page.locator('h3')}).first().locator('..').getByRole('button',{name:/즐겨찾기/});
  await phonics.click();
  await page.reload();
  await page.getByRole('button',{name:'★ 즐겨찾기 2',exact:true}).click();
  assert.equal(await page.locator('a[href="/games/grammardetective"]').count(),1);
  assert.equal(await page.locator('a[href="/games/balloonpop"]').count(),0);
  await star.click();
  assert.equal(await page.locator('a[href="/games/grammardetective"]').count(),0);
  console.log('PASS favorite ordinary and phonics cards, no navigation, reload, filter and remove');
  await page.goto(base+'?game=grammardetective&mode=teacher');
  await page.getByRole('button',{name:'내 단어/문장',exact:true}).click();
  await page.getByLabel('올바른 영어 문장 (한 줄에 하나)',{exact:true}).waitFor();
  await page.goto(base+'?game=grammardetective&mode=embed');
  await page.getByLabel('올바른 영어 문장 (한 줄에 하나)',{exact:true}).fill('She eats an apple every morning.\nShe can swim.\nShe stopped talking.');
  const generator=page.locator('[data-detective-generator]');
  await generator.getByRole('button',{name:'선택 지우기'}).click();
  for(const name of ['관사 a/an','조동사·동사 형태','비교급'])await generator.getByRole('checkbox',{name,exact:true}).check();
  await generator.getByText('출제 가능 2문제 · 이번 게임 2문제 · 확인 필요 1문장').waitFor();
  await generator.getByText('비교급 · 0문제').waitFor();
  await generator.getByText('She stopped talking.',{exact:true}).waitFor();
  await generator.getByRole('button',{name:'이 문제들로 바꾸기'}).click();
  await page.getByRole('button',{name:'설정 적용 · 게임 다시 준비',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('adventure-test-rows')||'[]').some(row=>row.game_type==='grammardetective'));
  const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('adventure-test-rows')).find(row=>row.game_type==='grammardetective'));
  await page.goto(base+`?game=grammardetective&mode=embed&template=${saved.id}`);
  await page.getByLabel('올바른 영어 문장 (한 줄에 하나)',{exact:true}).waitFor();
  const editors=page.locator('[data-detective-case-editor]');
  assert.equal(await editors.count(),2);
  assert.equal(await generator.getByRole('checkbox',{name:'비교급',exact:true}).isChecked(),true);
  await page.getByRole('button',{name:'게임 시작',exact:true}).click();
  const evidence=page.locator('.ad-evidence');
  await evidence.getByRole('button',{name:'a',exact:true}).click();
  await page.locator('.ad-choices').getByRole('button',{name:'an',exact:true}).click();
  await page.getByText('사건 해결!',{exact:true}).waitFor();
  await page.getByRole('button',{name:/다음 문제/}).click();
  await evidence.getByRole('button',{name:'swims',exact:true}).click();
  await page.locator('.ad-choices').getByRole('button',{name:'swim',exact:true}).click();
  await page.getByText('사건 해결!',{exact:true}).waitFor();
  await page.getByRole('button',{name:'결과 보기',exact:true}).click();
  await page.getByText('한 번에 오류를 찾은 문제 2개 · 한 번에 고친 문제 2개').waitFor();
  await page.goto(base+`?game=grammardetective&mode=embed&template=${saved.id}`);
  const input=page.getByLabel('올바른 영어 문장 (한 줄에 하나)',{exact:true});
  await input.fill('She needs a pencil.');
  await generator.getByRole('button',{name:'이 문제들로 바꾸기'}).click();
  await editors.first().getByRole('button',{name:'다른 오류 만들기'}).click();
  await page.getByRole('button',{name:'설정 적용 · 게임 다시 준비',exact:true}).click();
  await page.getByRole('button',{name:'게임 시작',exact:true}).click();
  await evidence.getByRole('button',{name:'pencil 앞에 빠진 말 선택',exact:true}).click();
  await page.locator('.ad-choices').getByRole('button',{name:'a',exact:true}).click();
  await page.getByText('사건 해결!',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS preview, selected rules, apply and play both generated problems');
}catch(error){
  if(page)console.error((await page.locator('body').innerText()).slice(-3500));
  throw error;
}finally {
  await browser?.close();
  await server.close();
}
