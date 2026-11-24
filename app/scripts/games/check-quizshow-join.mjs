// Isolated host/phone UI: no production data or learning records.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createLessonUxServer} from '../lessons/ux-server.mjs';
process.env.VITE_SUPABASE_URL='http://127.0.0.1:5595';
process.env.VITE_SUPABASE_ANON_KEY='local-fixture-key';
process.env.VITE_LEARNING_SENSORS_ENABLED='false';
const fixture={name:'quizshow-join-fixture',enforce:'pre',transform(code,id){
 const path=id.replaceAll('\\','/').split('?')[0];
 if(path.endsWith('/src/lib/supabase.ts'))return code
 .replace('export const supabase={storage,','export const supabase={storage,removeChannel:async()=>{},')
 .replace('unsubscribe(){}','unsubscribe(){},send:async()=>{}')
 .replace("rpc:async name=>({data:name==='my_deletion_request'?null:[],error:null})",`rpc:async(name,args)=>{
 window.__quizCalls??=[];window.__quizCalls.push({name,args});
 if(name==='live_host_create'){window.__quizSession={id:'local-session',code:'123456',title:args.p_title,questions:args.p_questions,speed_bonus:args.p_speed_bonus,phase:'lobby',q_index:-1,q_started_at:null,created_at:new Date().toISOString(),ended_at:null};return {data:window.__quizSession,error:null};}
 if(name==='live_host_set'){Object.assign(window.__quizSession,{phase:args.p_phase,q_index:args.p_q_index});return {data:window.__quizSession,error:null};}
 return {data:name==='my_deletion_request'?null:[],error:null};}`);
 if(path.endsWith('/scripts/lessons/ux-fixture.tsx'))return code.replace('import AppLayout',`import LiveJoinPage from '../../src/pages/LiveJoinPage';
 import {GameEmbedContext} from '../../src/context/GameEmbedContext';
 import QuizShowPage from '../../src/pages/QuizShowPage';
 import AppLayout`).replace('<Route path="/curriculum"',`<Route path="/join/:code" element={<LiveJoinPage/>}/>
 <Route path="/quiz-preview" element={<GameEmbedContext.Provider value={{classId:null,onSelect:()=>{},preview:{content:null,title:'칠판 미리보기 검증'}}}><QuizShowPage/></GameEmbedContext.Provider>}/>
 <Route path="/curriculum"`);
},configureServer(server){server.middlewares.use((req,_res,next)=>{if(/^\/(join\/|quiz-preview)/.test(req.url||''))req.url='/scripts/lessons/ux-fixture.html?go='+encodeURIComponent(req.url);next();});}};
const server=await createLessonUxServer(5595,false,[fixture]);let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000);
 await page.addInitScript(()=>localStorage.setItem('classbank.startCheck.skip','1'));
 await page.goto('http://127.0.0.1:5595/games/quizshow');
 await page.getByRole('button',{name:'게임설정',exact:true}).waitFor();
 const close=page.getByRole('button',{name:'닫기',exact:true});if(await close.isVisible())await close.click();
 const start=page.locator('[data-game-start-card]').getByRole('button',{name:'게임 시작',exact:true});if(await start.isVisible())await start.click();
 await page.getByRole('button',{name:'내 단어/문장',exact:true}).click();
 await page.getByRole('button',{name:/파닉스 A·B·C/}).click();
 await page.getByRole('button',{name:'선택',exact:true}).click();
 const open=page.getByRole('button',{name:/대회 열기/});await open.waitFor();
 assert.equal(await page.getByRole('button',{name:'반 설정',exact:true}).isEnabled(),false);
 assert.equal(await page.getByText('학생 휴대폰 화면(미리보기)',{exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>window.__quizCalls?.filter(x=>x.name==='live_host_create').length||0),0);
 // Round selection stays visible; details start collapsed and retain edits across folding/reorder.
 await page.getByRole('button',{name:'게임설정',exact:true}).click();
 const round=page.locator('[data-quiz-round="choice"]');
 assert.equal(await round.getByRole('spinbutton').first().isVisible(),false);
 await round.getByRole('button',{name:'뜻 고르기 펼치기',exact:true}).click();
 await round.getByRole('spinbutton',{name:'문제 수 (−1은 전체)',exact:true}).fill('2');
 await round.getByRole('spinbutton',{name:'제한 시간(초)',exact:true}).fill('35');
 await round.getByRole('spinbutton',{name:'점수',exact:true}).fill('500');
 await round.getByRole('button',{name:'아래로',exact:true}).click();
 await round.getByRole('button',{name:'뜻 고르기 접기',exact:true}).click();
 await round.getByRole('button',{name:'뜻 고르기 펼치기',exact:true}).click();
 assert.equal(await round.getByRole('spinbutton',{name:'점수',exact:true}).inputValue(),'500');
 const estimateText=await page.locator('[data-contest-duration]').innerText();
 assert(estimateText.includes('예상 진행시간'));
 await page.getByRole('button',{name:'적용',exact:true}).click();
 await open.click();await page.getByRole('img',{name:'QR',exact:true}).waitFor();
 await page.getByText('123456',{exact:true}).waitFor();
 const call=await page.evaluate(()=>window.__quizCalls.find(x=>x.name==='live_host_create'));
 assert.equal(call.args.p_template_id,null);assert(call.args.p_questions.length>0);
 const choices=call.args.p_questions.filter(q=>q.round?.includes('뜻 고르기'));
 assert.equal(choices.length,2);assert(choices.every(q=>q.seconds===35&&q.points===500));
 const expectedSeconds=call.args.p_questions.reduce((sum,q)=>sum+10+(q.kind==='buzzer'?30:q.seconds??20),0)+new Set(call.args.p_questions.map(q=>q.round)).size*10;
 assert(estimateText.includes('약 '+Math.ceil(expectedSeconds/60)+'분'));
 assert(estimateText.includes('출제 가능 '+call.args.p_questions.length+'문제'));
 console.log('PASS duration estimate matches actual generated count and timers');
 assert.equal(await page.getByText('학생 휴대폰 화면(미리보기)',{exact:true}).count(),0);
 if(process.env.QUIZ_JOIN_OUTPUT){await mkdir(process.env.QUIZ_JOIN_OUTPUT,{recursive:true});await page.screenshot({path:process.env.QUIZ_JOIN_OUTPUT+'/local-lobby.jpg'});}
 console.log('PASS temporary game: real contest with QR / entry code, class disabled, no mock phone');
 console.log('PASS collapsible quiz settings: selection, details, reorder and applied count/time/points');
 await page.goto('http://127.0.0.1:5595/join/123456');
 assert.equal(await page.getByRole('textbox').first().inputValue(),'123456');
 await page.getByPlaceholder('예: 번개토끼').waitFor();
 console.log('PASS phone route with entry code prefilled');
 const durationCases=await page.evaluate(async()=>{const {estimateContestDuration}=await import('/src/lib/contestDuration.ts');const q={id:'q',prompt:'test',kind:'choice',choices:['a','b'],correctIndex:0,seconds:20};return [estimateContestDuration([]),estimateContestDuration([q,{...q,id:'buzz',kind:'buzzer',answer:'a',seconds:120}])];});
 assert.deepEqual(durationCases,[{count:0,seconds:0},{count:2,seconds:90}]);
 console.log('PASS duration: empty, timer allowance, buzzer without countdown');
 await page.goto('http://127.0.0.1:5595/quiz-preview');
 await page.getByRole('button',{name:/미리보기 시작/}).click();
 await page.getByText('선생님 칠판 미리보기예요. 실제 학생 입장과 응답은 받지 않아요.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('img',{name:'QR',exact:true}).count(),0);
 assert.equal(await page.getByText('학생 휴대폰 화면(미리보기)',{exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>window.__quizCalls?.filter(x=>x.name.startsWith('live_')).length||0),0);
 console.log('PASS lesson activity preview: board only, no contest RPC');
 await page.goto('http://127.0.0.1:5595/games/twodice');
 await page.getByRole('button',{name:'반 설정',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'반 설정',exact:true}).isEnabled(),true);
 console.log('PASS other games retain class settings');
 const native=await browser.newPage({viewport:{width:1600,height:1000}});
 native.on('pageerror',error=>errors.push(error.message));native.setDefaultTimeout(20000);
 await native.addInitScript(()=>localStorage.setItem('classbank.startCheck.skip','1'));
 await native.goto('http://127.0.0.1:5595/games/quizshow');
 await native.getByRole('button',{name:'게임설정',exact:true}).waitFor();
 const startNative=native.locator('[data-game-start-card]').getByRole('button',{name:'게임 시작',exact:true});
 if(await startNative.isVisible())await startNative.click();
 await native.getByRole('button',{name:'게임설정',exact:true}).click();
 for(const type of ['ox','text','buzzer'])await native.locator(`[data-quiz-round="${type}"]`).getByRole('checkbox').uncheck();
 const nativeRound=native.locator('[data-quiz-round="choice"]');
 await nativeRound.getByRole('button',{name:'뜻 고르기 펼치기',exact:true}).click();
 await nativeRound.getByRole('spinbutton',{name:'문제 수 (−1은 전체)',exact:true}).fill('1');
 await nativeRound.getByRole('spinbutton',{name:'제한 시간(초)',exact:true}).fill('40');
 await nativeRound.getByRole('spinbutton',{name:'점수',exact:true}).fill('600');
 assert((await native.locator('[data-contest-duration]').innerText()).includes('출제 가능 1문제'));
 await native.getByRole('button',{name:'적용',exact:true}).click();
 await native.getByRole('button',{name:/대회 열기/}).click();
 await native.getByRole('img',{name:'QR',exact:true}).waitFor();
 const nativeQuestions=await native.evaluate(()=>window.__quizSession.questions);
 assert.equal(nativeQuestions.length,1);assert.equal(nativeQuestions[0].seconds,40);assert.equal(nativeQuestions[0].points,600);
 const bank=await native.evaluate(async()=>{
  const {configuredContestQuestions}=await import('/src/lib/liveQuiz.ts');
  const questions=[1,2,3].map(n=>({id:String(n),prompt:'q'+n,kind:'choice',choices:['a','b'],correctIndex:0,seconds:20,custom:true}));
  const original=JSON.stringify(questions);
  const rounds=[{type:'choice',on:false,count:1}];
  return {off:configuredContestQuestions(questions,rounds).length,limited:configuredContestQuestions(questions,[{...rounds[0],on:true}]).length,
   restored:configuredContestQuestions(questions,[{...rounds[0],on:true,count:-1}]).length,unchanged:JSON.stringify(questions)===original};
 });
 assert.deepEqual(bank,{off:0,limited:1,restored:3,unchanged:true});
 console.log('PASS sample / custom questions obey round selection, count, time and points; full bank retained');
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
