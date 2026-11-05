import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const report={research_version:'vocab-research-v1',generated_at:'2026-11-05T10:00:00Z',evidence_hash:'synthetic-hash',days:30,academy_id:null,
 overview:{plans:2,assignments:3,students:2,started:2,first_completed:2,finished:0},
 cohorts:[{practice:'letters',baseline:'needs_practice',goal_units:2,students:2,plans:1,versions:1,diagnostic_answered:2,first_checked:2,first_correct:1,final_checked:2,final_correct:2,practice_denominator:2,practice_answers:3,d1_due:2,d1_answered:1,d1_correct:1,d2_due:0,d2_answered:0,d2_correct:0},
 {practice:'recall',baseline:'unknown',goal_units:1,students:1,plans:1,versions:0,diagnostic_answered:0,first_checked:0,first_correct:0,final_checked:0,final_correct:0,practice_denominator:0,practice_answers:0,d1_due:0,d1_answered:0,d1_correct:0,d2_due:0,d2_answered:0,d2_correct:0}],
 rounds:[{round:1,due:2,answered:1,correct:1,missing:1,not_due:0,not_scheduled:1,min_elapsed_days:1.2,max_elapsed_days:1.2},{round:2,due:0,answered:0,correct:0,missing:0,not_due:2,not_scheduled:1,min_elapsed_days:null,max_elapsed_days:null}],
 content_versions:[{fingerprint:'synthetic-version-001',title:'합성 어휘 회상 수업',practice:'letters',baseline:'needs_practice',students:2,goal_units:2,first_checked:2,first_correct:1,final_checked:2,final_correct:2,d1_answered:1,d1_correct:1,d2_answered:0,d2_correct:0}],versions_truncated:false,
 quality:{answers:8,unlinked_answers:0,mismatched_answers:0,observed_runs:1,visible_ms:90000,hint_events:1,help_requests:0,unresolved_goals:0},
 feedback:{assigned:1,dismissed:1,changed_practice:1},protection:[],scopes:[{id:'synthetic-academy',label:'합성 학원'}]};
const stub=`
window.__research={mode:'ok',calls:[],records:[],saves:0,dropAck:false};const s=window.__research;
const report=${JSON.stringify(report)};
export const supabase={rpc:async(name,args)=>{
 s.calls.push({name,args});
 if(name==='admin_learning_research_decisions')return{data:s.records,error:null};
 if(name==='admin_learning_research'){
  if(s.mode==='missing')return{data:null,error:{code:'PGRST202'}};
  if(s.mode==='denied')return{data:null,error:{code:'42501'}};
  if(s.mode==='error')throw Error('synthetic network');
  if(s.mode==='empty')return{data:{...report,days:args.p_days,academy_id:args.p_academy,overview:{plans:0,assignments:0,students:0,started:0,first_completed:0,finished:0},cohorts:[],content_versions:[],rounds:report.rounds.map(r=>({...r,due:0,answered:0,correct:0,missing:0,not_due:0,not_scheduled:0,min_elapsed_days:null,max_elapsed_days:null})),quality:{...report.quality,observed_runs:0}},error:null};
  return{data:{...report,days:args.p_days,academy_id:args.p_academy},error:null};
 }
 if(name==='admin_learning_research_decide'){
  if(s.mode==='changed')return{data:null,error:{code:'P0001',message:'research_changed_refresh'}};
  const found=s.records.find(r=>r.request_id===args.p_request);
  if(found)return{data:{request_id:found.request_id,duplicate:true},error:null};
  s.saves++;s.records.push({request_id:args.p_request,created_at:'2026-11-05T10:05:00Z',days:args.p_days,academy_id:args.p_academy,focus:args.p_focus,decision:args.p_decision,note:args.p_note,evidence_hash:args.p_evidence_hash,evidence:report});
  if(s.dropAck){s.dropAck=false;throw Error('response lost after commit');}
  return{data:{request_id:args.p_request,duplicate:false},error:null};
 }
 return{data:null,error:{code:'PGRST202'}};
}};`;
const server=await createServer({root,logLevel:'error',plugins:[{name:'research-synthetic',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return stub;}}],server:{host:'127.0.0.1',port:5197,strictPort:true}});
let browser;
try {
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const url='http://127.0.0.1:5197/scripts/learning-sensors/research-harness.html';
 await page.goto(url);const load=page.getByRole('button',{name:'학습 분석 조회',exact:true});await load.waitFor();
 assert.equal(await page.evaluate(()=>window.__research.calls.length),0,'no automatic admin query');
 await load.click();await page.getByRole('heading',{name:'시간을 둔 뒤 다시 기억했는가'}).waitFor();
 await page.getByText('1/2 · 50%',{exact:true}).waitFor();await page.getByText('2/2 · 100%',{exact:true}).waitFor();
 assert.match(await page.locator('main').innerText(),/미응답은 오답/);
 await page.getByRole('listitem').filter({hasText:'기한이 지난 지연 확인'}).getByRole('button',{name:'검토 대상으로 선택'}).click();
 assert.equal(await page.getByLabel('검토 영역',{exact:true}).inputValue(),'participation');
 await page.getByLabel('진행 방향',{exact:true}).selectOption('compare');
 await page.evaluate(()=>{window.__research.dropAck=true;});
 await page.getByRole('button',{name:'검토 방향과 근거 저장'}).click();
 const retry=page.getByRole('button',{name:'같은 요청으로 저장 확인'});await retry.waitFor();
 assert.equal(await page.getByLabel('계획 생성 기간',{exact:true}).isDisabled(),true,'scope locked during uncertain save');
 assert.equal(await page.getByLabel('검토 메모 · 선택',{exact:true}).isDisabled(),true);
 await retry.click();await page.getByText('검토 방향과 당시 집계 근거를 저장했습니다.',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>window.__research.saves),1,'one committed review');
 const requests=await page.evaluate(()=>window.__research.calls.filter(c=>c.name==='admin_learning_research_decide').map(c=>c.args));
 assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1],'retry retains request ID and exact reviewed evidence');
 await page.getByText('결정 당시 근거 보기',{exact:true}).click();await page.getByText('분석 시각: 2026.',{exact:false}).first().waitFor();
 await page.getByText('제공 내용 버전별 근거 비교',{exact:true}).click();await page.getByRole('cell',{name:'합성 어휘 회상 수업',exact:false}).waitFor();
 const out=process.env.LEARNING_RESEARCH_SCREENSHOTS || process.env.TEMP || root;mkdirSync(out,{recursive:true});
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:resolve(out,'classbank-learning-research-overview.png')});
 await page.screenshot({path:resolve(out,'classbank-learning-research-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no mobile horizontal overflow');
 await page.screenshot({path:resolve(out,'classbank-learning-research-mobile.png'),fullPage:true});
 await page.getByLabel('검토 메모 · 선택',{exact:true}).fill('검증 조건 변경');
 await page.evaluate(()=>{window.__research.mode='changed';});
 await page.getByRole('button',{name:'검토 방향과 근거 저장'}).click();
 await page.getByText('검토 중 근거가 달라졌습니다.',{exact:false}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'시간을 둔 뒤 다시 기억했는가'}).count(),0,'stale report removed');
 for(const [mode,text] of [['missing','학습 분석 DB가 아직 준비되지 않았습니다.'],['denied','학습 분석은 플랫폼 관리자만 조회할 수 있습니다.'],['error','분석을 불러오지 못했습니다.'],['empty','선택한 집단에 배정 기록이 없습니다.']]) {
  await page.evaluate(mode=>{window.__research.mode=mode;},mode);await load.click();await page.getByText(text,{exact:false}).waitFor();
 }
 assert.doesNotMatch(await page.locator('main').innerText(),/NaN|Infinity/);
 await page.getByLabel('계획 생성 기간',{exact:true}).selectOption('7');
 assert.equal(await page.getByRole('heading',{name:'시간을 둔 뒤 다시 기억했는가'}).count(),0,'scope change clears report');
 await load.click();
 assert.equal(await page.evaluate(()=>window.__research.calls.filter(c=>c.name==='admin_learning_research').at(-1).args.p_days),7);
 assert.equal(await page.evaluate(()=>window.__research.calls.some(c=>/assign|learning_path_feedback/.test(c.name))),false,'admin review never changes student assignments');
 await page.goto(url+'?lang=en');await page.getByRole('button',{name:'Load learning analysis',exact:true}).click();await page.getByRole('heading',{name:'Recall after a delay'}).waitFor();
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('Research browser: explicit queries, separate first/final outcomes, delayed denominators, suggestion selection, lost-ack same-request recovery, frozen history, stale-evidence refusal, missing/denied/error/empty states, scope reset, English, mobile fit and no assignment writes passed. External requests blocked.');
} finally {await browser?.close();await server.close();}
