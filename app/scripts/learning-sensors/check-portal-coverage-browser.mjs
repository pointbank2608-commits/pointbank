import assert from 'node:assert/strict';
import{createServer}from'vite';
import{chromium}from'../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import{resolve,dirname}from'node:path';
import{fileURLToPath}from'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const due=new Date(Date.now()+86400000).toISOString();
const stub=`
window.__s={calls:[],coverage:'ok'};
const home={name:'샘플 학생',academy:'샘플 학원',class_name:'샘플 반',homework:[],features:{solo:true,homework:true},lessons:[
 {id:'wait-1',name:'대기 중인 단어 수업',minutes:5,progress:4,total:4,done:false,due_at:null,learning_path:true,path_waiting:true,path_due_at:${JSON.stringify(due)},path_round:1,path_first_completed:true},
 {id:'open-1',name:'오늘 할 단어 수업',minutes:5,progress:0,total:4,done:false,due_at:null,learning_path:true,path_waiting:false}]};
const cov={runs:[{source:'solo',runs:3,goal_items:6,unresolved_items:2}],evidence:[{source:'solo',outcomes:10,linked:8,version_matched:7,version_changed:1,origin_changed:1,unlinked:2,goal_linked:6}]};
const query=()=>new Proxy({}, {get(_,k){if(k==='then')return d=>d({data:[],error:null});return()=>query();}});
export const supabase={from:query,rpc:async(name,args)=>{
 window.__s.calls.push(name);
 if(name==='student_home')return{data:home,error:null};
 if(name==='admin_learning_run_summary'){
  if(window.__s.coverage==='missing')return{data:null,error:{code:'PGRST202'}};
  if(window.__s.coverage==='error')return{data:null,error:{code:'500'}};
  return{data:cov,error:null};}
 return{data:null,error:null};
}};`;
const server=await createServer({root,logLevel:'error',plugins:[{name:'stub',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return stub;}}],server:{host:'127.0.0.1',port:5196,strictPort:true}});
let browser;
try{
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const base='http://127.0.0.1:5196/scripts/learning-sensors/portal-harness.html';
 await page.goto(base+'?mode=portal');await page.getByText('대기 중인 단어 수업').waitFor();
 const wait=page.locator('a[href="/s/lesson/wait-1"]'),open=page.locator('a[href="/s/lesson/open-1"]');
 assert.match(await wait.innerText(),/오늘 학습 완료/);assert.match(await wait.innerText(),/일정 보기/);
 assert.doesNotMatch(await wait.innerText(),/시작|이어서/);
 // only the open lesson is highlighted as today's pick
 assert.equal(await page.getByText('오늘 할 것',{exact:false}).count()>=0,true);
 const pickBefore=await page.evaluate(()=>{const els=[...document.querySelectorAll('a[href^="/s/lesson/"]')];return els.map(a=>({h:a.getAttribute('href'),y:a.className.includes('bg-warm-yellow')}));});
 assert.deepEqual(pickBefore,[{h:'/s/lesson/wait-1',y:false},{h:'/s/lesson/open-1',y:true}]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
 // Admin coverage
 await page.setViewportSize({width:1280,height:900});await page.goto(base+'?mode=admin');
 const btn=page.getByRole('button',{name:'제공 버전 연결 조회'});await btn.waitFor();
 assert.equal(await page.getByRole('table').count(),0,'no data shown before explicit load');
 await btn.click();await page.getByRole('table').waitFor();
 const t=await page.getByRole('table').innerText();assert.match(t,/solo/);assert.match(t,/10/);
 assert.match(await page.locator('section').innerText(),/뜻을 확정하지 못한 제공 문항: 2/);
 assert.match(await page.locator('section').innerText(),/고정한 문제로 채점한 기록: 1/);
 await page.evaluate(()=>{window.__s.coverage='missing';});await btn.click();await page.getByText('제공 버전 DB가 아직 준비되지 않았습니다.').waitFor();
 await page.evaluate(()=>{window.__s.coverage='error';});await btn.click();await page.getByText('이전 결과는 갱신되지 않았습니다.').waitFor();
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('Portal/coverage browser: waiting lesson not highlighted or startable, open lesson highlighted, mobile fit, coverage explicit load, missing/error states passed. External requests blocked.');
}finally{await browser?.close();await server.close();}
