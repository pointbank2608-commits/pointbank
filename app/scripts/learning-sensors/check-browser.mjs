import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const disabled=process.argv.includes('--disabled');
const stub=`
window.__sensors={calls:[],offline:false,missing:false};
const s=window.__sensors;
const day={session_id:'20000000-0000-4000-8000-000000000001',day:'2026-11-05',done:false,counts:{new:0,review:1,hard:0,asks:1},retry_left:0,items:[{i:0,kind:'ask',state:'todo',qtype:'choice',style:'meaning',prompt:'cat',choices:['고양이','개']}],waiting_review:0,next_due:null,unseen:0,stages:{unseen:0,seen:0,practicing:1,alone:0,kept:0,total:1}};
export const supabase={rpc:async(name,args)=>{
 if(name==='learning_run_open')return {data:null,error:{code:'PGRST202'}};
 if(name==='learning_sensor_report'){s.calls.push({name,args});if(s.offline)throw Error('synthetic offline');if(s.missing)return {data:null,error:{code:'PGRST202'}};return {data:{accepted:args.p_events.length},error:null};}
 if(name==='admin_learning_sensor_summary')return {data:{days:7,sources:[{source:'homework',events:12,students:2,shown:4,visible_ms:10000,input_recent_ms:5000}],evidence:[{source:'homework',responses:4,first_responses:3,first_correct:2,help_unknown:4}]},error:null};
 if(name==='wm_open')return {data:{title:'합성 단어암기',daily_mode:'light',day_index:1,study_days:7,review_days:7,phase:'study',stages:day.stages},error:null};
 if(name==='wm_today_state')return {data:day,error:null};
 if(name==='wm_answer')return {data:{correct:false,answer:'고양이',first:true,requeued:false,done:false},error:null};
 if(name==='wm_hint')return {data:{type:'letters',text:'c'},error:null};
 return {data:[],error:null};
}};`;
const server=await createServer({root,logLevel:'error',define:{'import.meta.env.VITE_LEARNING_SENSORS_ENABLED':JSON.stringify(disabled?'false':'true')},
  plugins:[{name:'sensor-synthetic-backend',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return stub;}}],server:{host:'127.0.0.1',port:5194,strictPort:true}});
let browser; let activePage;
try{
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=activePage=await browser.newPage({viewport:{width:1100,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'?route.continue():route.abort();});
 const go=kind=>page.goto(`http://127.0.0.1:5194/scripts/learning-sensors/harness.html?${kind}`);
 const events=()=>page.evaluate(()=>window.__sensors.calls.flatMap(c=>c.args.p_events));
 await go('kind=hook');await page.getByText('next activity',{exact:true}).waitFor();
 if(disabled){await page.getByText('hint action',{exact:true}).click();assert.equal((await events()).length,0);console.log('Sensor browser: disabled flag prevents all collection.');}
 else {
  await page.waitForFunction(()=>window.__sensors.calls.length>0);
  await page.getByText('next activity',{exact:true}).click();await page.getByText('hint action',{exact:true}).click();
  let es=await events();assert.ok(es.some(e=>e.position===0&&e.action==='left'));assert.ok(es.some(e=>e.position===1&&e.action==='shown'));assert.ok(es.some(e=>e.action==='hint'));
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(60);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  es=await events();assert.ok(es.some(e=>e.action==='hidden'));assert.equal(es.findLast(e=>e.action==='resumed').visible_ms,0);
  assert.ok(es.every(e=>e.visible_ms>=0&&e.visible_ms<=30000&&e.input_recent_ms<=e.visible_ms));
  await page.evaluate(()=>window.__sensors.offline=true);await page.getByText('hint action',{exact:true}).click();
  const retryId=(await events()).at(-1).id;
  await page.evaluate(()=>{window.__sensors.offline=false;window.dispatchEvent(new Event('online'));});
  await page.waitForFunction(id=>window.__sensors.calls.flatMap(c=>c.args.p_events).filter(e=>e.id===id).length>=2,retryId);
  await page.getByText('stop sensor',{exact:true}).click();await page.waitForTimeout(60);
  await go('kind=hook&preview=1');await page.getByText('hint action',{exact:true}).click();assert.equal((await events()).length,0);
  for(const kind of ['homework','solo']){
   await go(`kind=${kind}`);await page.getByRole('button',{name:/개$/}).click();
   await page.waitForFunction(()=>window.__sensors.calls.flatMap(c=>c.args.p_events).some(e=>e.action==='submitted'));
   await page.waitForFunction(action=>window.__sensors.calls.flatMap(c=>c.args.p_events).some(e=>e.action===action),kind==='homework'?'revealed':'hint');
   es=await events();assert.ok(es.some(e=>e.action==='shown'));
   assert.ok(es.every(e=>!('correct'in e)&&!('response'in e)&&!('credential'in e)));
   await go(`kind=${kind}&preview=1`);await page.getByRole('button',{name:/개$/}).click();assert.equal((await events()).length,0);
  }
  await go('kind=word_memory');await page.getByRole('button',{name:/오늘의 단어암기숙제 시작/}).click();await page.getByRole('button',{name:/개$/}).click();
  await page.waitForFunction(()=>window.__sensors.calls.some(c=>c.args.p_source==='word_memory'));
  assert.ok((await events()).some(e=>e.action==='submitted'));
  await go('kind=admin');await page.getByRole('button',{name:'수집 상태 조회'}).click();await page.getByText('homework',{exact:true}).first().waitFor();
  await page.screenshot({path:resolve(process.env.TEMP || root,'classbank-sensor-admin-synthetic.png')});
  console.log('Sensor browser: hook lifecycle, visibility exclusion, offline retry identity, three real players, preview exclusion, private payload and admin coverage passed. External requests blocked.');
 }
 assert.deepEqual(errors,[]);
}catch(error){if(activePage)console.error((await activePage.locator('body').innerText()).slice(0,1600));throw error;}finally{await browser?.close();await server.close();}
