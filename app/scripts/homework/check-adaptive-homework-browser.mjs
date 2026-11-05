import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {fileURLToPath} from 'node:url';
import {buildAdaptiveFixture} from '../admin/adaptive-homework-fixture.mjs';
const f=await buildAdaptiveFixture();
const root=fileURLToPath(new URL('../../',import.meta.url)),out='C:/Users/likes/Documents/Codex/2026-11-05/sor/outputs';
const fixtures={students:[{id:f.ST,name:'샘플 학생'}],word_lists:[{id:f.WL,kind:'word',name:'샘플 단어장',academy_id:f.A,class_id:null,items:[['book','책'],['fish','물고기'],['bird','새'],['desk','책상'],['cat','고양이'],['dog','개']].map(([word,meaning],i)=>({id:String(i),word,meaning,image_url:null,category:null}))}]};
const stub=`const fixtures=${JSON.stringify(fixtures)};const table=(name)=>new Proxy({}, {get(_,k){if(k==='then')return resolve=>resolve({data:fixtures[name]||[],error:null});return()=>table(name);}});export const supabase={from:table,rpc:async(name,args)=>await(await fetch('/__adaptive-test-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json()};`;
const keys={learning_homework_summary:['p_class'],learning_homework_assign:['p_request','p_class','p_students','p_title','p_cards','p_practice','p_portion','p_due','p_source_kind','p_source_id'],admin_learning_homework_summary:['p_days'],student_home:['p_token'],learning_run_open:['p_source','p_credential','p_resource'],learning_path_open:['p_token','p_assignment'],learning_path_action:['p_token','p_assignment','p_request','p_position','p_action','p_value'],learning_sensor_report_run:['p_run','p_credential','p_events']};
let queue=Promise.resolve(),lost=false;const calls=[];
const serial=job=>{const p=queue.then(job);queue=p.catch(()=>{});return p;};
const server=await createServer({root,logLevel:'error',define:{'import.meta.env.VITE_LEARNING_SENSORS_ENABLED':JSON.stringify('true')},server:{host:'127.0.0.1',port:5197,strictPort:true},plugins:[{name:'isolated-sql-homework-browser',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return stub;},configureServer(s){
 s.middlewares.use(async(req,res,next)=>{
  if(req.url==='/s'||req.url==='/research'||req.url.startsWith('/s/homework/'))req.url='/scripts/homework/adaptive-homework-harness.html';
  if(req.url!=='/__adaptive-test-rpc')return next();
  try{let body='';for await(const chunk of req)body+=chunk;const {name,args}=JSON.parse(body);calls.push({name,args});
   const result=keys[name]?await serial(async()=>{const role=name.startsWith('admin_')||name.startsWith('learning_homework_')?'authenticated':'anon';
    await f.db.exec(`reset role;set role ${role};select set_config('test.academy','${f.A}',false),set_config('test.staff','yes',false),set_config('test.admin','${name.startsWith('admin_')?'yes':'no'}',false)`);
    try{const data=await f.call(name,...keys[name].map(k=>['p_cards','p_events'].includes(k)?JSON.stringify(args[k]):args[k]??null));
      if(name==='learning_homework_assign'&&!lost){lost=true;return{data:null,error:{message:'Failed to fetch'}};}
      return{data,error:null};
    }catch(e){return{data:null,error:{code:e.code,message:e.message}};}finally{await f.db.exec('reset role');}
   }):{data:[],error:null};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  }catch{res.statusCode=500;res.end('{}');}
 });
}}]});
let browser,page;
try{
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const origin='http://127.0.0.1:5197';await page.goto(origin+'/scripts/homework/adaptive-homework-harness.html');
 const btn=(name)=>page.getByRole('button',{name,exact:true});
 await page.getByRole('combobox',{name:'단어장 선택',exact:true}).selectOption(f.WL);
 await page.getByRole('combobox',{name:'이번에 보낼 묶음',exact:true}).selectOption('1');
 await btn('추천 숙제 확인').click();await page.getByRole('list',{name:'숙제 블록 구성',exact:true}).waitFor();
 assert.equal(await btn('이 계획으로 숙제 배정').isDisabled(),true);assert.equal(calls.filter(c=>c.name==='learning_homework_assign').length,0);
 assert.ok((await page.locator('body').innerText()).includes('cat (고양이) · dog (개)'));
 await page.screenshot({path:out+'/adaptive-homework-teacher.png',fullPage:true});
 await page.getByRole('checkbox',{name:/학습 내용과 학생을 확인했습니다/}).check();await btn('이 계획으로 숙제 배정').click();
 await btn('같은 요청으로 배정 확인').waitFor();await btn('같은 요청으로 배정 확인').click();
 await page.getByRole('status').filter({hasText:'숙제를 배정했어요.'}).waitFor();await page.getByRole('heading',{name:'맞춤 단어 숙제 진행'}).waitFor();
 const assignments=calls.filter(c=>c.name==='learning_homework_assign');assert.equal(assignments.length,2);assert.deepEqual(assignments[0].args,assignments[1].args);
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/s');
 const link=page.getByRole('link',{name:/샘플 단어장 · 단어 회상 숙제/});await link.waitFor();assert.match(await link.getAttribute('href'),/^\/s\/homework\//);
 await link.click();await page.getByRole('heading',{name:'먼저 혼자 떠올려요'}).waitFor();assert.equal(await page.getByText('cat',{exact:true}).count(),0);
 const type=async value=>{for(const letter of value)await btn(letter).click();await btn('내기').click();await btn('계속하기').click();};
 await type('cat');await page.getByRole('heading',{name:'혼자 다시 확인해요'}).waitFor();await type('cat');
 await btn('아직 모르겠어요').click();await btn('계속하기').click();await page.getByRole('heading',{name:'단어를 확인해요'}).waitFor();
 await btn('가리고 연습하기').click();await btn('작은 힌트 보기').click();await page.getByText('첫 글자: d').waitFor();
 for(const letter of 'dog')await btn(letter).click();await btn('확인').click();await page.getByRole('heading',{name:'잘 떠올렸어요'}).waitFor();await btn('계속하기').click();
 await type('dog');await page.getByRole('heading',{name:'오늘 숙제를 마쳤어요'}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:out+'/adaptive-homework-mobile.png',fullPage:true});await btn('학생 홈으로').click();
 await page.getByRole('link',{name:/오늘 숙제 완료 · 다음 확인/}).waitFor();
 assert.equal(calls.filter(c=>c.name==='learning_homework_assign').length,2,'student never creates another assignment');
 await page.setViewportSize({width:1200,height:900});await page.goto(origin+'/research');await page.getByText('맞춤 단어 숙제 분석',{exact:true}).click();
 assert.equal(calls.filter(c=>c.name==='admin_learning_homework_summary').length,0);await btn('맞춤 숙제 분석 조회').click();
 await page.getByText('계획 1 · 배정 1 · 학생 1명 · 첫 학습 완료 1',{exact:true}).waitFor();
 await page.getByText(/활동 센서가 있는 배정 1 · 연결된 서버 채점 [5-9]/).waitFor();
 assert.deepEqual(errors,[]);await page.screenshot({path:out+'/adaptive-homework-research.png',fullPage:true});
 console.log('Adaptive homework browser: approved batch selection, lost response retry, real SQL grading, supported/independent branches, mobile completion/return, and automatic research evidence passed.');
}catch(e){if(page)console.error((await page.locator('body').innerText()).slice(0,1400));throw e;}
finally{await browser?.close();await server.close();await queue;await f.db.close();}
