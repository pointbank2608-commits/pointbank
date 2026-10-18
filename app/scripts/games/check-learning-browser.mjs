import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const named = (file) =>
  [
    ...readFileSync(resolve(root, file), 'utf8').matchAll(
      /export (?:async )?function (\w+)|export const (\w+)/g,
    ),
  ].map((m) => m[1] || m[2]);
const callables = (file, prefix) =>
  named(file)
    .map(
      (n) =>
        `export const ${n}=(...a)=>(${prefix}.${n}||async function(){return []})(...a);`,
    )
    .join('\n');
const common = `
const words=[['apple','사과'],['banana','바나나'],['cat','고양이'],['dog','강아지']];
const cards=words.map(([word,meaning],i)=>({id:String(i),word,meaning,imageUrl:null}));
window.__learning=window.__learning||{checks:{},requests:[],writes:[],fail:false,partial:false};
const state=window.__learning;
`;
const apiStub =
  common +
  `const handlers={fetchClasses:async()=>[{id:'c',academy_id:'a',name:'합성 반'}],fetchStudentsOfClass:async()=>[{id:'alice',name:'Alice',class_id:'c'},{id:'bob',name:'Bob',class_id:'c'}],fetchWordBank:async()=>[],fetchWordLists:async()=>[{id:'list',name:'동물과 과일',kind:'word',updated_at:'2026-10-19',items:cards.map(c=>({...c,image_url:null}))}]};` +
  callables('src/lib/api.ts', 'handlers');
const homeworkStub =
  common +
  `const handlers={fetchHomeworkOverview:async()=>[],fetchReviewCandidates:async(student)=>({graded:40,completed_activities:4,words:cards.map(c=>({word:c.word,card:c,last_seen:new Date().toISOString(),skills:{[student==='alice'?'vocab.spelling':'listening.word']:{wrong:3,right:0,last_wrong:new Date().toISOString(),last_right:null}}}))}),createHomework:async(p)=>{if(state.partial&&p.studentIds[0]==='bob'){state.partial=false;throw new Error('synthetic partial failure')}state.writes.push(p);return{id:'hw',code:'123456'}}};` +
  callables('src/lib/homework.ts', 'handlers');
const soloStub =
  common +
  `const handlers={createSoloLesson:async(p)=>{const id='lesson-'+state.writes.length;state.writes.push({id,...p});return{id}},assignSoloLesson:async(id,students)=>{state.writes.push({lesson:id,students});return 1}};` +
  callables('src/lib/soloApi.ts', 'handlers');
const backend =
  common +
  `export const supabase={rpc:async(fn,p)=>{
 if(fn==='solo_game_check_open'&&location.search.includes('missing'))return{data:null,error:{code:'PGRST202',message:'Could not find the function'}};
 if(fn==='solo_game_check_open')return{data:{id:'check',questions:[{t:'pickMeaning',word:'apple',imageUrl:null,options:['사과','바나나']},{t:'typeWord',meaning:'바나나',imageUrl:null,length:6,first:''}],responses:state.checks},error:null};
 if(fn==='solo_game_check_answer'){
   state.requests.push(p);if(state.fail){state.fail=false;return{data:null,error:{message:'synthetic network error'}}}
   const correct=p.p_question===0?p.p_value==='0':p.p_value==='banana';state.checks[p.p_question]={correct,last_correct:correct,attempts:1,answer:p.p_question===0?'사과':'banana'};return{data:{correct,first:correct,answer:state.checks[p.p_question].answer},error:null};
 }return{data:[],error:null};},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}};`;
const auth = `const value={academy:{id:'a',features:{homework:true,solo:true}},profile:{id:'teacher'},isStaff:true,hasFullAccess:true};export const useAuth=()=>value;export const AuthProvider=({children})=>children;`;
const toast = `const value={notify:()=>{},run:async fn=>{await fn();return true}};export const useToast=()=>value;export const ToastProvider=({children})=>children;`;
const server = await createServer({
  root,
  logLevel: 'error',
  plugins: [
    {
      name: 'synthetic-learning',
      enforce: 'pre',
      load(id) {
        const p = id.replaceAll('\\', '/');
        if (p.endsWith('/src/lib/api.ts')) return apiStub;
        if (p.endsWith('/src/lib/homework.ts')) return homeworkStub;
        if (p.endsWith('/src/lib/soloApi.ts')) return soloStub;
        if (p.endsWith('/src/lib/supabase.ts')) return backend;
        if (p.endsWith('/src/context/AuthContext.tsx')) return auth;
        if (p.endsWith('/src/context/ToastContext.tsx')) return toast;
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5190, strictPort: true },
});
let browser, page;
const errors = [];
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error' && !m.text().includes('Failed to load resource'))errors.push(m.text());});
  await page.route('https://**/*', (r) => r.abort());
  const url = 'http://127.0.0.1:5190/scripts/games/learning.html';
  await page.goto(url);
  await page.getByRole('button', { name: 'apple', exact: true }).click();
  await page.getByRole('button', { name: '사과', exact: true }).click();
  await page.getByRole('button', { name: 'banana', exact: true }).click();
  await page.getByRole('button', { name: '바나나', exact: true }).click();
  await page
    .getByRole('button', { name: '혼자 확인하고 마치기', exact: true })
    .click();
  await page.getByRole('region', { name: '혼자 확인하기' }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: '설정·저장' }).count(),
    0,
  );
  await page.evaluate(() => (window.__learning.fail = true));
  await page.getByRole('button', { name: '사과', exact: true }).click();
  await page.getByRole('alert').waitFor();
  await page.getByRole('button', { name: '사과', exact: true }).click();
  const requests = await page.evaluate(() => window.__learning.requests);
  assert.equal(requests[0].p_request, requests[1].p_request);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('textbox', { name: '정답 입력' }).fill('banana');
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByText('학습 확인 완료', { exact: true }).waitFor();
  await page.getByRole('button', { name: '다음으로', exact: true }).click();
  await page.getByRole('heading', { name: '합성 검증 완료' }).waitFor();
  console.log(
    'ok actual game → checkpoint → save failure retry with stable request → complete; teacher settings absent',
  );
  await page.goto(url + '?recommend=1');
  await page
    .getByText('동물과 과일', { exact: true })
    .waitFor({ state: 'attached' });
  await page.getByLabel('함께 배울 자료').selectOption('list');
  await page.getByRole('button', { name: /확인하고.*보내기/ }).waitFor();
  await page.evaluate(() => (window.__learning.partial = true));
  await page.getByRole('button', { name: /확인하고.*보내기/ }).click();
  await page.getByText('1명에게 보냈습니다.', { exact: false }).waitFor();
  await page.getByRole('button', { name: /확인하고.*보내기/ }).click();
  await page.getByRole('heading', { name: '합성 검증 완료' }).waitFor();
  const writes = await page.evaluate(() => window.__learning.writes);
  assert.equal(writes.length, 2);
  assert.deepEqual(
    writes.map((w) => w.studentIds),
    [['alice'], ['bob']],
  );
  assert(writes.every((w) => w.items.every((i) => i.kind === 'game')));
  assert(
    writes[0].items.some((i) =>
      i.content.questions.some((q) => q.skill === 'vocab.spelling'),
    ),
  );
  assert(
    writes[1].items.some((i) =>
      i.content.questions.some((q) => q.skill === 'listening.word'),
    ),
  );
  console.log(
    'ok same material, individual skill games, teacher sends only on click; partial send retries only remaining student',
  );
  await page.goto(url + '?recommend=1');
  await page.getByLabel('진행할 곳').selectOption('lesson');
  await page.getByRole('button', { name: /확인하고.*보내기/ }).click();
  await page.getByRole('heading', { name: '합성 검증 완료' }).waitFor();
  const soloWrites = await page.evaluate(() => window.__learning.writes);
  assert.equal(soloWrites.filter((w) => w.steps).length, 2);
  assert.equal(soloWrites.filter((w) => w.students).length, 2);
  console.log(
    'ok personal game practice can be assigned as individual lessons',
  );
  await page.goto(url+'?missing=1');
  for(const [word,meaning] of [['apple','사과'],['banana','바나나']]){await page.getByRole('button',{name:word,exact:true}).click();await page.getByRole('button',{name:meaning,exact:true}).click();}
  await page.getByRole('button',{name:'혼자 확인하고 마치기',exact:true}).click();
  await page.getByText('아직 학습 확인이 준비되지 않았어요.',{exact:false}).waitFor();
  assert.equal((await page.evaluate(()=>window.__learning.requests)).length,0);
  console.log('ok SQL not yet applied: completion-only notice, no invented stat score');
  await page.goto(url+'?handoff=1');
  await page.getByLabel('함께 배울 자료').waitFor();assert.equal(await page.getByLabel('함께 배울 자료').inputValue(),'__source__');
  assert.equal(await page.evaluate(()=>window.__learning.writes.length),0);
  await page.getByRole('button',{name:/확인하고.*보내기/}).click();
  await page.waitForFunction(()=>window.__learning.writes.length===2);
  assert.deepEqual(await page.evaluate(()=>window.__learning.writes.map(w=>w.studentIds)),[['alice'],['bob']]);
  console.log('ok actual homework page receives game material, waits for correct class roster, then sends only after teacher confirmation');
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url + '?recommend=1');
    await page.getByLabel('함께 배울 자료').waitFor();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow ${width}`,
    );
  }
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: resolve(root, 'node_modules/homework-test-tools/game-learning.png'),
    fullPage: true,
  });
  console.log('All learning browser checks passed. Synthetic adapters only.');
} catch (e) {
  console.error('FAILED', e.message);
  if (page) {
    console.error((await page.locator('body').innerText()).slice(0, 3000));
    await page.screenshot({
      path: resolve(
        root,
        'node_modules/homework-test-tools/game-learning-failure.png',
      ),
      fullPage: true,
    });
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
