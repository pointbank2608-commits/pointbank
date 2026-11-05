import assert from 'node:assert/strict';
import{createServer}from'vite';
import{chromium}from'../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import{resolve,dirname}from'node:path';
import{fileURLToPath}from'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const stub=`
const student={id:'20000000-0000-4000-8000-000000000001',name:'샘플 학생'};
window.__path={calls:[],offline:false,cache:{},missing:false};const store=window.__path;
let state={run_id:'90000000-0000-4000-8000-000000000001',position:1,goal_index:0,words:1,round:0,phase:'diagnostic',waiting:false,due_at:null,finished:false,step:{t:'typeWord',meaning:'고양이',length:3},hint:null};
const steps={learn:{t:'meet',word:'cat',meaning:'고양이',example:'A cat sleeps.'},practice:{t:'spell',meaning:'고양이',letters:['t','a','c']},check:{t:'typeWord',meaning:'고양이',length:3}};
const query=table=>new Proxy({}, {get(_,key){if(key==='then')return done=>done({data:table==='students'?[student]:[],error:null});return()=>query(table);}});
export const supabase={from:query,rpc:async(name,args)=>{
 store.calls.push({name,args});
 if(name.startsWith('learning_sensor_report'))return {data:{accepted:args.p_events.length},error:null};
 if(name==='learning_path_teacher_summary')return store.missing?{data:null,error:{code:'PGRST202'}}:{data:{plans:[],recommendations:store.recommendation?[{assignment_id:'synthetic-assignment',student_name:'샘플 학생',goal_index:0,card:{word:'cat',meaning:'고양이'},failed_checks:1,delayed_checks:0}]:[]},error:null};
 if(name==='learning_path_assign'){store.recommendation=true;return {data:{lesson_id:'new-path',duplicate:false},error:null};}
 if(name==='learning_path_feedback'){store.recommendation=false;return {data:{decision:args.p_decision,lesson_id:'recommended-path'},error:null};}
 if(name==='learning_path_open')return {data:structuredClone(state),error:null};
 if(name==='learning_path_action'){
  if(store.offline)throw Error('offline');
  if(store.cache[args.p_request])return {data:store.cache[args.p_request],error:null};
  const phase=state.phase;let feedback;
  if(args.p_action==='hint'){state={...state,hint:'c'};}
  else if(args.p_action==='continue'){state={...state,position:3,phase:'practice',step:steps.practice,hint:null};}
  else {const ok=args.p_value==='cat';feedback={phase,correct:ok,answer:phase==='diagnostic'?null:'cat'};
   if(phase==='diagnostic'){state={...state,position:ok?4:2,phase:ok?'check':'learn',step:ok?steps.check:steps.learn};}
   else if(phase==='practice'){state={...state,position:4,phase:'check',step:steps.check,hint:null};}
   else state={...state,round:1,waiting:true,step:null,due_at:new Date(Date.now()+86400000).toISOString()};
  }
  const result={state:structuredClone(state),feedback};store.cache[args.p_request]=result;return {data:result,error:null};
 }
 return {data:[],error:null};
}};`;
const server=await createServer({root,logLevel:'error',define:{'import.meta.env.VITE_LEARNING_SENSORS_ENABLED':JSON.stringify('true')},plugins:[{name:'path-test-backend',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return stub;}}],server:{host:'127.0.0.1',port:5195,strictPort:true}});
let browser,page;
try{
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const url='http://127.0.0.1:5195/scripts/learning-sensors/path-harness.html';
 await page.goto(url);await page.getByRole('heading',{name:'1. 학습 내용과 학생 선택'}).waitFor();
 await page.getByLabel('수업 이름',{exact:true}).fill('새 단어 수업');await page.getByLabel(/단어 \| 뜻 \| 예문/).fill('cat | 고양이 | A cat sleeps.');await page.getByLabel('샘플 학생',{exact:true}).check();
 assert.equal(await page.evaluate(()=>window.__path.calls.filter(c=>c.name==='learning_path_assign').length),0);
 await page.getByRole('button',{name:'이 계획으로 배정',exact:true}).isDisabled().then(x=>assert.equal(x,true));
 await page.screenshot({path:'C:/Users/likes/Documents/Codex/2026-11-05/sor/work/learning-path-teacher.png',fullPage:true});
 await page.getByLabel(/내용과 학생을 확인했으며/).check();await page.getByRole('button',{name:'이 계획으로 배정',exact:true}).click();await page.getByRole('status').filter({hasText:'배정했어요'}).waitFor();
 assert.equal(await page.evaluate(()=>window.__path.calls.filter(c=>c.name==='learning_path_assign').length),1);
 await page.getByRole('button',{name:'수정해서 배정',exact:true}).click();assert.equal(await page.evaluate(()=>window.__path.calls.filter(c=>c.name==='learning_path_feedback').length),0);
 await page.getByLabel('추천 연습 방식',{exact:true}).selectOption('letters');await page.getByRole('button',{name:'수정안으로 배정',exact:true}).click();await page.waitForFunction(()=>window.__path.calls.some(c=>c.name==='learning_path_feedback'));assert.equal(await page.evaluate(()=>window.__path.calls.find(c=>c.name==='learning_path_feedback').args.p_practice),'letters');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.goto(url+'?mode=student');await page.getByRole('heading',{name:'먼저 혼자 떠올려요'}).waitFor();
 assert.equal(await page.getByText('cat',{exact:true}).count(),0);await page.getByRole('button',{name:'아직 모르겠어요',exact:true}).click();await page.getByRole('button',{name:'계속하기',exact:true}).click();await page.getByText('cat',{exact:true}).waitFor();await page.screenshot({path:'C:/Users/likes/Documents/Codex/2026-11-05/sor/work/learning-path-student.png',fullPage:true});
 await page.getByRole('button',{name:'가리고 연습하기',exact:true}).click();await page.getByRole('button',{name:'작은 힌트 보기',exact:true}).click();await page.getByText('첫 글자: c').waitFor();
 // The shared order widget emits a JSON token array; the solo grading API expects joined letters.
 for(const letter of ['c','a','t'])await page.getByRole('button',{name:letter,exact:true}).click();
 await page.getByRole('button',{name:'확인',exact:true}).click();
 await page.getByRole('heading',{name:'잘 떠올렸어요',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.__path.calls.filter(c=>c.name==='learning_path_action'&&c.args.p_position===3&&c.args.p_action==='answer').at(-1).args.p_value),'cat');
 await page.getByRole('button',{name:'계속하기',exact:true}).click();await page.getByRole('heading',{name:'혼자 다시 확인해요'}).waitFor();
 await page.evaluate(()=>window.__path.offline=true);await page.getByRole('button',{name:'아직 모르겠어요',exact:true}).click();await page.getByRole('alert').waitFor();
 const request=await page.evaluate(()=>window.__path.calls.filter(c=>c.name==='learning_path_action').at(-1).args.p_request);
 await page.evaluate(()=>window.__path.offline=false);await page.getByRole('button',{name:'다시 연결',exact:true}).click();await page.getByRole('button',{name:'계속하기',exact:true}).click();await page.getByRole('heading',{name:'오늘은 여기까지예요'}).waitFor();
 assert.equal(await page.evaluate(id=>window.__path.calls.filter(c=>c.name==='learning_path_action'&&c.args.p_request===id).length,request),2);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);console.log('New lesson browser: explicit teacher approval, student flow, hidden diagnostic answer, hint scope, retry request identity, waiting state and mobile layout passed. External requests blocked.');
}catch(e){if(page)console.error((await page.locator('body').innerText()).slice(0,1800));throw e;}finally{await browser?.close();await server.close();}
