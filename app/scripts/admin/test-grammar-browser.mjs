import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { buildAdaptiveFixture } from './adaptive-homework-fixture.mjs';

const f = await buildAdaptiveFixture();
for (const name of ['102_grammar_learning.sql','102b_grammar_pilot_content.sql','102c_grammar_results.sql']) await f.db.exec(f.read(name));
const root = fileURLToPath(new URL('../../',import.meta.url));
const student = { id: f.ST, name: '검증 학생' };
const entry = `import React from 'react'; import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import GrammarTeacherPanel from '/src/components/grammar/GrammarTeacherPanel';
import GrammarResultsPanel from '/src/components/admin/GrammarResultsPanel';
import StudentGrammarPage from '/src/pages/StudentGrammarPage';
import GrammarPortalLinks from '/src/components/grammar/GrammarPortalLinks';
import { useGrammarPortalAssignments } from '/src/lib/useGrammarPortalAssignments';
import '/src/tailwind.css';
const h = React.createElement;
function Home(){ return h('ul',{className:'bg-deep-navy text-white'},h(GrammarPortalLinks,{rows:useGrammarPortalAssignments('${f.TK}').rows})); }
createRoot(document.getElementById('root')).render(h(BrowserRouter,null,h(Routes,null,
  h(Route,{path:'/teacher',element:h(GrammarTeacherPanel,{classId:'${f.HW}',mode:'homework'})}),
  h(Route,{path:'/admin',element:h(GrammarResultsPanel)}),
  h(Route,{path:'/s',element:h(Home)}),
  h(Route,{path:'/s/grammar/:assignmentId',element:h(StudentGrammarPage)})
))); `;
const stub = `const table = () => new Proxy({}, {get(_, k){if(k==='then')return resolve=>resolve({data:[${JSON.stringify(student)}],error:null});return table;}});
export const supabase={from:table,rpc:async(name,args)=>await(await fetch('/__grammar_rpc',{method:'POST',body:JSON.stringify({name,args})})).json()};`;
const rpcKeys = {
  grammar_catalog: [], grammar_preview: ['p_goal_id','p_version'], grammar_assign: ['p_request_id','p_class_id','p_student_ids','p_mode','p_goal_id','p_version','p_initial_due_at'],
  grammar_student_list: ['p_token'], grammar_open: ['p_token','p_assignment_id'],
  grammar_act: ['p_token','p_assignment_id','p_request_id','p_revision','p_action','p_item_id','p_option_id'],
  grammar_teacher_summary: ['p_class_id','p_mode'], admin_grammar_summary: ['p_days'],
};
const server = await createServer({ root, logLevel:'error',
  define:{'import.meta.env.VITE_LEARNING_SENSORS_ENABLED':JSON.stringify('false')},
  server:{host:'127.0.0.1',port:5199},plugins:[{
    name:'grammar-ui-test',enforce:'pre',
    resolveId(id){if(id==='/__grammar_ui_entry.tsx') return '\0grammar-ui-entry.tsx';},
    load(id){if(id==='\0grammar-ui-entry.tsx') return entry;
      if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts')) return stub;},
    configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
      if (!['/teacher','/admin','/s'].includes(req.url) && !req.url.startsWith('/s/grammar/')) return next();
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(await vite.transformIndexHtml(req.url,'<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/__grammar_ui_entry.tsx"></script></html>'));
    });}
  }]});
let browser;
const calls = [];
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true });
  const page = await browser.newPage({viewport:{width:390,height:840}});
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  await page.addInitScript(token => localStorage.setItem('classbank.studentToken',token), f.TK);
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(origin)) return route.abort();
    if (!url.endsWith('/__grammar_rpc')) return route.continue();
    const {name,args={}} = route.request().postDataJSON();
    calls.push(name);
    if (!Object.hasOwn(rpcKeys,name)) throw new Error('Unexpected RPC: '+name);
    let body;
    const isStudent = ['grammar_student_list','grammar_open','grammar_act'].includes(name);
    try {
      await f.db.exec(`set role ${isStudent?'anon':'authenticated'}; select set_config('test.academy','${f.A}',false),
        set_config('test.staff','yes',false),set_config('test.admin','${name.startsWith('admin_')?'yes':'no'}',false);`);
      body = {data:await f.call(name,...rpcKeys[name].map(k => args[k]??null)),error:null};
    } catch(error) { body={data:null,error:{message:error.message,code:error.code}}; }
    finally { await f.db.exec('reset role'); }
    await route.fulfill({json:body});
  });
  const button = name => page.getByRole('button',{name,exact:true});
  await page.goto(origin+'teacher');
  await button('문법 목표 고르기').click();
  await page.getByRole('combobox').selectOption('past-question-base-verb');
  await page.getByRole('checkbox',{name:'검증 학생'}).check();
  await button('학생 화면 미리보기').click();
  await page.getByText('교사 미리보기',{exact:true}).waitFor();
  assert.equal(calls.includes('grammar_open'),false);
  assert.equal(calls.includes('grammar_assign'),false);
  assert.equal(await button('이 계획으로 배정').isDisabled(),true);
  await page.getByRole('checkbox',{name:'내용과 학생을 확인했어요'}).check();
  await button('이 계획으로 배정').click();
  await page.getByText('배정했어요. 학생 홈에서 시작할 수 있어요.').waitFor();
  await page.goto(origin+'s');
  await page.getByRole('link',{name:/문법 학습 시작/}).click();
  await button('이유 골라 보기').click();
  await page.getByRole('button',{name:/Did가 과거를 알려 줘서 동사는 원형이에요/}).click();
  await button('계속하기').waitFor();
  await page.reload();
  await button('계속하기').click();
  await page.getByRole('button',{name:/found가 아니라 find여야 해요/}).click();
  await button('계속하기').click();
  await page.getByRole('heading',{name:'오늘 학습 완료',exact:true}).waitFor();
  const assignment = new URL(page.url()).pathname.split('/').at(-1);
  assert.equal(await page.getByText(/Where did they/).count(),0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
  await page.goto(origin+'teacher');
  await button('문법 학습 결과 보기').click();
  await page.getByRole('cell',{name:'예정 전',exact:true}).waitFor();
  await page.goto(origin+'admin');
  await button('문법 결과 조회').click();
  await page.getByRole('cell',{name:/예정 전 1/}).waitFor();
  await f.db.query("update grammar_assignments set review_due_at=now()-interval '1 minute' where id=$1",[assignment]);
  await page.goto(origin+'s');
  await page.getByRole('link',{name:/복습하기/}).click();
  await page.getByText('Where did they ___ lunch after school?',{exact:true}).waitFor();
  await page.getByRole('button',{name:/eat — did가 과거를 알려 줘서/}).click();
  await button('계속하기').click();
  await page.getByText('계획한 문법 학습과 복습을 마쳤어요.').waitFor();
  await page.goto(origin+'admin');
  await button('문법 결과 조회').click();
  await page.getByRole('cell',{name:/정답 1 · 오답 0/}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: grammar browser, teacher approval → student portal → resume feedback → waiting → teacher/admin results.');
} finally {
  await browser?.close();
  await server.close();
  await f.db.close();
}
