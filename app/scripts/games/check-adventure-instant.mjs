import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const names = [
  ...readFileSync(resolve(root, "src/lib/api.ts"), "utf8").matchAll(
    /export (?:async )?function (\w+)|export const (\w+)/g,
  ),
].map((m) => m[1] || m[2]);
const stub = `
import { isActivityDraft, patchActivityDraft } from '/src/lib/quickActivity.ts';
const academy={id:'academy-a',features:{group:true,homework:true},plan:'paid'};
const registeredClasses=[{id:'class-a',academy_id:'academy-a',name:'합성 A반'},{id:'class-b',academy_id:'academy-a',name:'합성 B반'}];
const classes=new URLSearchParams(location.search).has('roster')?[...registeredClasses,{id:'class-empty',academy_id:'academy-a',name:'빈 반'}]:[];
const students=[{id:'alice',academy_id:'academy-a',class_id:'class-a',name:'Alice'},{id:'bob',academy_id:'academy-a',class_id:'class-a',name:'Bob'},{id:'cara',academy_id:'academy-a',class_id:'class-b',name:'Cara'},{id:'foreign',academy_id:'academy-other',class_id:'class-a',name:'FOREIGN'}];
const lists=[{id:'words',academy_id:'academy-a',class_id:'class-a',kind:'word',name:'합성 과일',updated_at:'2026-10-19',items:[{id:'apple',word:'apple',meaning:'사과',image_url:'/word-bank-images/apple.webp',category:'fruit'},{id:'banana',word:'banana',meaning:'바나나',image_url:'/word-bank-images/banana.webp',category:'fruit'},{id:'cat',word:'cat',meaning:'고양이',image_url:'/word-bank-images/cat.webp',category:'animal'},{id:'dog',word:'dog',meaning:'강아지',image_url:null,category:'animal'}]},{id:'sentences',academy_id:'academy-a',class_id:'class-a',kind:'sentence',name:'합성 문장',updated_at:'2026-10-19',items:[{id:'s',word:'I like cats.',meaning:'나는 고양이를 좋아해요.',image_url:null}]}];
if(new URLSearchParams(location.search).has('applyAudit')){
  lists.push({...lists[0],id:'invalid',name:'중복 단어장',items:[lists[0].items[0],{...lists[0].items[0],id:'duplicate'}]});
  lists[1].items.push(
    {id:'s2',word:'She likes apples.',meaning:'그녀는 사과를 좋아해요.',image_url:null},
    {id:'s3',word:'We play soccer.',meaning:'우리는 축구를 해요.',image_url:null},
    {id:'s4',word:'He has a red bag.',meaning:'그는 빨간 가방이 있어요.',image_url:null},
  );
}
if(new URLSearchParams(location.search).has('pictureAudit')){
  lists.push({...lists[0],id:'text-only',name:'그림 없는 단어장',items:lists[0].items.map(item=>({...item,image_url:null}))});
}
window.__workspace={templates:[],writes:[],fail:false,empty:new URLSearchParams(location.search).has('empty')};
if(new URLSearchParams(location.search).has('student'))window.__workspace.templates.push({id:'student-game',academy_id:'academy-a',class_id:'class-a',game_type:'wheel',name:'학생용 저장 게임',items:[{id:'a',label:'apple'},{id:'b',label:'cat'}],config:{}});
if(new URLSearchParams(location.search).has('saved'))window.__workspace.templates.push({id:'original-game',academy_id:'academy-a',class_id:null,game_type:'wheel',name:'원본 저장 게임',items:[{id:'original',label:'ORIGINAL'}],config:{}});
lists.push({...lists[1],id:'foreign-list',academy_id:'academy-other',name:'FOREIGN SENTENCES'});
window.__originalSources=JSON.stringify({lists,classes,students});window.__readSources=()=>JSON.stringify({lists,classes,students});
const functions={
fetchMyStudentRow:async()=>({class_id:'class-a'}),
wordListKindOf:(list)=>list.kind==='sentence'?'sentence':'word',
updateWordListItems:async(id,items)=>{if(window.__workspace.fail)throw new Error('synthetic word update failure'); const list=lists.find(row=>row.id===id);if(list)list.items=items;},
fetchClasses:async()=>classes,fetchStudentsOfClass:async(id)=>{if(window.__workspace.failRoster)throw new Error('roster failure');await new Promise(resolve=>setTimeout(resolve,id==='class-a'?120:10));return structuredClone(students.filter(s=>s.class_id===id));},fetchStudentsOfAcademy:async()=>students,
createWordList:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic save failure'); const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,kind:p.kind,items:p.items,updated_at:'now'};(window.__workspace.wordWrites||=[]).push(row);lists.push(row);return row;},
fetchAllWordLists:async()=>{if(window.__workspace.failLists)throw new Error('list failure');return window.__workspace.empty?[]:structuredClone(lists);},fetchAllCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessonById:async(id)=>(window.__workspace.lessons||[]).find(x=>x.id===id),
createCurriculumLesson:async(p)=>{const l={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,playlist:p.playlist,updated_at:'now'};(window.__workspace.lessons||=[]).push(l);return l;},
appendActivityToLesson:async(l,s)=>{l.playlist.push(s)},
fetchWordLists:async(_a,_c,k)=>structuredClone(k==='all'?lists:lists.filter(x=>x.kind===k)),
fetchGameTemplates:async(_a,_c,type)=>window.__workspace.templates.filter(x=>x.game_type===type),
createGameTemplate:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic failure');const t={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,name:p.name,items:p.items,config:p.config||{},updated_at:'2026-10-19'};window.__workspace.templates.push(t);window.__workspace.writes.push(t);return t;},
fetchGameTemplateById:async(id)=>window.__workspace.templates.find(t=>t.id===id),
updateGameTemplate:async(id,p)=>{if(isActivityDraft(id))patchActivityDraft(id,p);else Object.assign(window.__workspace.templates.find(t=>t.id===id)||{},p)}
};
${names.map((n) => `export const ${n}=(...args)=>(functions.${n}|| (async()=>[]))(...args);`).join("\n")}
`;
const auth = `const value={academy:{id:'academy-a',features:{group:true},plan:'paid',deletion_requested_at:null,deletion_scheduled_at:null},profile:{id:'teacher-a'},isStaff:!new URLSearchParams(location.search).has('student'),isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:false,inTrial:false,daysLeft:7},pointUnit:'별'};export const useAuth=()=>value;export const AuthProvider=({children})=>children;`;
const toast = `const run=async(fn)=>{try{await fn();return true}catch(e){console.error(e);return false}};const value={notify:()=>{},run};export const useToast=()=>value;export const ToastProvider=({children})=>children;`;
const server = await createServer({
  root,
  logLevel: "error",
  plugins: [
    {
      name: "synthetic-workspace",
      enforce: "pre",
      load(id) {
        const p = id.replaceAll("\\", "/");
        if (p.endsWith("/src/lib/api.ts")) return stub;
        if (p.endsWith("/src/context/AuthContext.tsx")) return auth;
        if (p.endsWith("/src/context/ToastContext.tsx")) return toast;
        if (p.endsWith("/src/lib/supabase.ts"))
          return `
            const from = (table) => ({ insert: (row) => {
              if (table === 'support_tickets') return { select: () => ({ single: async () => {
                (window.__gameReports ??= []).push(row);
                return { data: { id: 'report-1' }, error: null };
              } }) };
              if (table === 'support_messages') {
                if (window.__reportMessageFails) return { error: new Error('simulated write failure') };
                (window.__reportMessages ??= []).push(row);
                return { error: null };
              }
              throw new Error('Unexpected insert into ' + table);
            } });
            export const supabase={from,rpc:async(name)=>{if(name==='live_host_create')window.__liveCreated=true;return {data:name==='my_deletion_request'?null:[],error:null}},channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}})};
          `;
      },
    },
  ],
  server: { hmr: false, host: "127.0.0.1", port: 5263, strictPort: true },
});

let browser;
try {
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const fixture='http://127.0.0.1:5263/scripts/games/focus.html';
 const args=process.argv.slice(2);
 const audit=args.includes('--apply-audit');
 const pictureAudit=args.includes('--picture-audit');
 const expandedPictureAudit=args.includes('--expanded-picture-audit');
 const requested=args.filter(arg=>!arg.startsWith('--'));
 const {pictureWordModeKind}=expandedPictureAudit?await server.ssrLoadModule('/src/lib/pictureWordQuestions.ts'):{};
 const types=args.includes('--all') || ((audit || expandedPictureAudit) && !requested.length)?[...readFileSync(resolve(root,'src/lib/gameCatalog.ts'),'utf8').matchAll(/path:\s*'\/games\/([^']+)'/g)].map(match=>match[1]).filter(type=>!expandedPictureAudit || pictureWordModeKind(type)):requested.length?requested:['wordfishing','balloonpop','feedmonster','sentencebridge','sentencetower','quizshow'];
 const bad=[];
 const applied=new Set();
 async function expectPlay(page) {
  await page.waitForFunction(()=>document.querySelector('[data-play-mode="play"] [data-game-fit]:not([inert])') && !document.querySelector('[data-game-ready-overlay]'),null,{timeout:5000});
 }
 async function auditExpandedPictures(page,type) {
  const kind=pictureWordModeKind(type);
  assert.ok(kind, type);
  const settings=page.getByRole('button',{name:'게임설정',exact:true});
  const apply=page.getByRole('button',{name:'적용',exact:true});
  const stage=page.locator('[data-game-fit]:visible').first();
  await settings.click();
  await page.getByRole('button',{name:'그림 보고 영어 단어 고르기',exact:true}).click();
  await page.getByRole('combobox',{name:/그림 문제에 쓸 단어장/}).selectOption('words');
  await apply.click();
  await expectPlay(page);
  assert.equal(await stage.locator('[data-picture-practice]').count(),0);
  assert.equal(await stage.locator('[data-picture-turn]').count(),0);
  if(type==='winlosequiz') await stage.getByRole('button',{name:/올인/}).click();
  if(type==='treasuredig') await stage.getByRole('button',{name:'1번 언덕',exact:true}).click();
  if(type==='mysterybox') await stage.locator('.mm-block').first().press('Enter');
  if(['tictactoe','connect4','mysterybox'].includes(type)) {
   const target=type==='tictactoe'?stage.locator('[data-skin-object="cell"]').first():
    type==='connect4'?stage.getByRole('button',{name:/원판을 떨어뜨리세요/}).first():
    stage.getByRole('button',{name:/버섯 공개/});
   await target.press('Enter');
   const turn=stage.locator('[data-picture-turn]');
   const answer=(await turn.locator('img').getAttribute('src')).match(/\/(apple|banana|cat)\.webp$/)?.[1];
   assert.ok(answer);
   await turn.getByRole('button',{name:answer,exact:true}).click();
   await turn.waitFor({state:'hidden'});
   if(type==='tictactoe') assert.equal(await target.isDisabled(),true);
  }
  if(type==='wheel'){
   const spin=stage.getByRole('button',{name:'돌리기',exact:true}).last();
   await spin.click();
   const turn=stage.locator('[data-picture-turn]');
   await turn.waitFor();
   const answer=(await turn.locator('img').getAttribute('src')).match(/\/(apple|banana|cat)\.webp$/)?.[1];
   assert.ok(answer);
   assert.equal(await stage.locator('[data-wheel-result]').count(),0);
   await turn.getByRole('button',{name:answer==='dog'?'cat':'dog',exact:true}).click();
   await turn.getByRole('status').waitFor();
   assert.equal(await stage.locator('[data-wheel-result]').count(),0);
   await page.keyboard.press('Escape');
   await turn.waitFor({state:'hidden'});
   await spin.click();
   const nextAnswer=(await turn.locator('img').getAttribute('src')).match(/\/(apple|banana|cat)\.webp$/)?.[1];
   await turn.getByRole('button',{name:nextAnswer,exact:true}).click();
   await stage.locator('[data-wheel-result]').waitFor({timeout:10000});
  }
  const picture=stage.locator('[data-picture-word]').first();
  if(kind==='native'){
   await picture.waitFor({timeout:7000});
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-picture-word]')).some(img=>img.complete && img.naturalWidth>0));
   const answer=(await picture.getAttribute('src')).match(/\/(apple|banana|cat)\.webp$/)?.[1];
   assert.ok(answer);
   if(type==='wordfishing' || type==='balloonpop' || type==='wordclaw') {
    await stage.locator(`[data-word="${answer}"]`).press('Enter');
    if(type==='wordclaw') await stage.getByRole('button',{name:'집게 내리기',exact:true}).click();
    await stage.locator(type==='wordfishing'?'.ad-fish-correct':type==='wordclaw'?'.ad-capsule.is-lifting':'.ad-balloon.correct').waitFor();
   }
   if(type==='treasuredig'){
    await stage.getByRole('button',{name:answer,exact:true}).click();
    await picture.waitFor({state:'hidden'});
   }
   if(type==='typeanswer' || type==='imagequiz' || type==='truefalse'){
    await stage.getByRole('button',{name:answer,exact:true}).click();
    await stage.locator('.result-pop,[role=status].iq-answer').first().waitFor();
   }
   if(type==='whackamole') {
    await stage.getByRole('button',{name:answer,exact:true}).press('Enter');
    await stage.locator('.wm-hole.is-ok').waitFor();
   }
  }
  if(type==='wordfishing' || type==='wheel'){
   if(type==='wheel'){
    await page.getByRole('button',{name:'저장/불러오기',exact:true}).click();
    await page.getByRole('textbox',{name:'저장할 이름'}).fill('그림 복습');
    await page.getByRole('button',{name:'저장하기',exact:true}).click();
    await page.getByRole('button',{name:'그림 복습',exact:true}).waitFor();
    const saved=await page.evaluate(()=>window.__workspace.writes.at(-1).config);
    assert.equal(saved.pictureWordMode,true);
    assert.equal(saved.pictureWordListId,'words');
    await page.getByRole('button',{name:'닫기',exact:true}).click();
   }
   await settings.click();
   await page.getByRole('button',{name:'기존 게임 방식',exact:true}).click();
   await apply.click();
   await expectPlay(page);
   await picture.waitFor({state:'hidden'});
  }
  console.log(type,kind,'picture mode PASS');
 }
 async function auditPictureMode(page,type) {
  const settings=page.getByRole('button',{name:'게임설정',exact:true});
  const apply=page.getByRole('button',{name:'적용',exact:true});
  const stage=page.locator('[data-game-fit]:visible').first();
  const source=page.getByRole('button',{name:'내 단어/문장',exact:true});
  const list=page.getByRole('combobox',{name:/내 단어장 · 문장 모음/});
  const pictureOption=page.getByRole('button',{name:'그림 보고 영어 단어 고르기',exact:true});
  await source.click();
  await list.selectOption('text-only');
  await apply.click();
  await expectPlay(page);
  await settings.click();
  await pictureOption.click();
  await page.getByText(/그림이 있는 단어가 1개 이상이고/).waitFor();
  await apply.click();
  await pictureOption.waitFor();
  assert.equal(await stage.locator('[data-picture-word]').count(),0);
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await source.click();
  await list.selectOption('words');
  await apply.click();
  await expectPlay(page);
  await settings.click();
  await pictureOption.click();
  await apply.click();
  await expectPlay(page);
  const picture=stage.locator('[data-picture-word]').first();
  await picture.waitFor({timeout:5000});
  await stage.locator('[data-initial-game-start]').waitFor({state:'hidden',timeout:5000});
  assert.equal(await stage.getByRole('button',{name:/발음 듣기/}).count(),0);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-picture-word]')).every(img=>img.complete && img.naturalWidth>0));
  const answer=(await picture.getAttribute('src')).match(/\/(apple|banana|cat)\.webp$/)?.[1];
  assert.ok(answer);
  await picture.locator('xpath=ancestor::section[1]').getByRole('button',{name:new RegExp(`\\b${answer}\\b`)}).click();
  await stage.getByText(type==='wordhoops'?'2점':'당김 1',{exact:true}).first().waitFor({timeout:5000});
  await page.getByRole('button',{name:'저장/불러오기',exact:true}).click();
  await page.getByRole('textbox',{name:'저장할 이름'}).fill('그림 문제 테스트');
  await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await page.getByRole('button',{name:'그림 문제 테스트',exact:true}).waitFor();
  const config=await page.evaluate(()=>window.__workspace.writes.at(-1).config);
  assert.equal(config[type==='wordhoops'?'hoopsMode':'tugMode'],'picture');
  assert.equal(config.pictureWords.length,4);
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await settings.click();
  await page.getByRole('button',{name:type==='wordhoops'?'영어 보고 뜻 고르기':'기존 글 문제',exact:true}).click();
  await apply.click();
  await expectPlay(page);
  await stage.locator('[data-initial-game-start]').waitFor({state:'hidden',timeout:5000});
  assert.equal(await stage.locator('[data-picture-word]').count(),0);
  console.log(type,'picture questions: PASS');
 }
 async function auditApply(page,type) {
  const openSource=page.getByRole('button',{name:'내 단어/문장',exact:true});
  const apply=page.getByRole('button',{name:'적용',exact:true});
  const list=page.getByRole('combobox',{name:/내 단어장 · 문장 모음|내 문장 모음/});
  if(['shopping','sentencerocket','watermelon','wordclaw'].includes(type)){
   await page.getByRole('button',{name:'게임설정',exact:true}).click();
   const more=page.getByRole('button',{name:'자세히 설정',exact:true});
   if(await more.count()) await more.click();
   const dialog=page.locator('dialog[open]');
   const isSentence=type==='sentencerocket';
   if(type==='shopping') await dialog.getByRole('button',{name:'내 단어장 가게',exact:true}).click();
   await dialog.getByRole('button',{name:isSentence?/문장 목록에서 불러오기/:/단어장에서 불러오기/}).click();
   await dialog.getByRole('button',{name:isSentence?/합성 문장/:/합성 과일/}).click();
   if(type==='wordclaw'){
    await apply.click();
    await dialog.getByRole('alert').filter({hasText:'태그'}).first().waitFor({timeout:5000});
    await dialog.getByLabel('정답 태그').fill('fruit');
    await dialog.getByLabel('미션 문장').fill('Find the fruit!');
   }
   await apply.click();
   await dialog.waitFor({state:'hidden',timeout:5000});
   await expectPlay(page);
   if(type==='shopping'){
    const config=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('activity-draft:teacher-a:academy-a:shopping')).config);
    assert.equal(config.shopScene,'words');
    assert.deepEqual(config.shopItems.map(item=>item.answer),['apple','banana','cat']);
   }
   else if(type==='watermelon'){
    const items=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('activity-draft:teacher-a:academy-a:watermelon')).items);
    assert.ok(items.some(item=>item.label==='banana'));
   } else if(type==='wordclaw') await page.locator('[data-game-fit] .ad-prompt').getByText('Find the fruit!').waitFor({timeout:5000});
   else await page.locator('[data-game-fit] .ad-assembly button').filter({hasText:/cats|apples|soccer|bag/}).first().waitFor({timeout:5000});
   applied.add(type);
  }
  if(!await openSource.count() || !await openSource.isEnabled()) return;
  await openSource.click({timeout:5000});
  if(type==='bomb') await page.getByRole('button',{name:'내 단어장/문장',exact:true}).click();
  const choices=await list.locator('option:not(:disabled)').evaluateAll(nodes=>nodes.map(node=>node.value).filter(id=>['words','sentences'].includes(id)));
  if(type==='wordsearch' || type==='crossword') assert.equal(await list.locator('option[value="invalid"]').evaluate(option=>option.disabled),true);
  for(const [index,id] of choices.entries()){
   if(index>0){
    await openSource.click();
    if(type==='bomb') await page.getByRole('button',{name:'내 단어장/문장',exact:true}).click();
   }
   await list.selectOption(id);
   await apply.click();
   await apply.waitFor({state:'hidden',timeout:5000});
   await expectPlay(page);
   await openSource.click();
   if(type==='bomb'){
    assert.match(await page.locator('textarea').filter({visible:true}).inputValue(),id==='words'?/apple/:/I like cats\./);
   } else {
    await page.getByText(id==='words'?'지금 쓰는 자료: 합성 과일 (4개)':'지금 쓰는 자료: 합성 문장 (4개)',{exact:true}).waitFor({timeout:5000});
   }
   await page.getByRole('button',{name:'닫기',exact:true}).click();
   applied.add(type);
  }
  if(!choices.length) await page.getByRole('button',{name:'닫기',exact:true}).click();
  if(type==='wheel' || type==='order'){
   await page.getByRole('button',{name:'게임설정',exact:true}).click();
   await page.getByRole('button',{name:'내 단어장/문장',exact:true}).click();
   await list.selectOption('words');
   await apply.click();
   await apply.waitFor({state:'hidden',timeout:5000});
   await expectPlay(page);
  }
  assert.equal(await page.evaluate(()=>window.__readSources()===window.__originalSources),true);
  console.log(type,'applied lists:',choices.join(',') || 'none');
 }
 async function verify(type){
  const ctx=await browser.newContext({viewport:args.includes('--mobile')?{width:390,height:844}:{width:1280,height:900}});await ctx.route('https://**/*',r=>r.abort());const page=await ctx.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  const timedSample = type === 'bomb' || type === 'passball';
  if (timedSample) await page.addInitScript(() => {
   window.__roundSounds = [];
   window.__pausedRoundSounds = [];
   const isRoundSound = (src) => /\/(bomb-tick\.m4a|pass-the-ball-bgm\.mp3)(\?|$)/.test(src);
   HTMLMediaElement.prototype.play = function () {
    if (isRoundSound(this.src)) window.__roundSounds.push(this.src);
    return Promise.resolve();
   };
   HTMLMediaElement.prototype.pause = function () {
    if (isRoundSound(this.src)) window.__pausedRoundSounds.push(this.src);
   };
  });
  await page.goto(fixture+`?start=/games/${type}${audit?'&applyAudit':''}${pictureAudit?'&pictureAudit':''}`);
  const startCard = page.locator('[data-game-start-card]');
  await startCard.waitFor({ timeout: 15000 });
  assert.ok((await startCard.getByRole('heading').innerText()).trim());
  assert.ok((await startCard.locator('p').innerText()).trim());
  assert.equal(await page.locator('[data-play-mode="prepare"] [data-game-fit][inert]').count(), 1);
  if (timedSample) assert.deepEqual(await page.evaluate(() => window.__roundSounds), []);
  await startCard.getByRole('button', { name: '게임 시작', exact: true }).click();
  await startCard.waitFor({ state: 'hidden' });
  await expectPlay(page);
  if (timedSample) {
   await page.waitForFunction(() => window.__roundSounds.length > 0, null, { timeout: 5000 });
  }
  if (args.includes('--pause-audit')) {
   const controls = page.locator('[data-frame-controls]');
   const pause = controls.getByRole('button', { name: '잠시 멈춤', exact: true });
   const resume = controls.getByRole('button', { name: '계속하기', exact: true });
   const board = await page.locator('[data-game-fit]').elementHandle();
   const soundsBeforePause = timedSample ? await page.evaluate(() => ({
    plays: window.__roundSounds.length, pauses: window.__pausedRoundSounds.length,
   })) : null;
   if (type === 'wheel') {
    await page.getByRole('button', { name: '돌리기', exact: true }).last().click();
    await page.waitForFunction(() => document.querySelector('[data-game-fit]').getAnimations({ subtree: true })
     .some(animation => animation instanceof CSSTransition && animation.transitionProperty === 'transform'));
   }
   await pause.click();
   await page.waitForFunction(() => window.__clock.paused());
   assert.equal(await board.evaluate(el => el.inert), true);
   const stoppedAt = await page.evaluate(() => window.__clock.now());
   if (soundsBeforePause) assert.equal(await page.evaluate(() => window.__pausedRoundSounds.length), soundsBeforePause.pauses + 1);
   if (type === 'wheel') assert.ok(await board.evaluate(el => el.getAnimations({ subtree: true })
    .some(animation => animation instanceof CSSTransition && animation.transitionProperty === 'transform' && animation.playState === 'paused')));
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(() => window.__clock.now()), stoppedAt);
   await resume.click();
   await expectPlay(page);
   await page.waitForFunction(() => !window.__clock.paused());
   assert.equal(await board.evaluate(el => el.isConnected && !el.inert), true);
   if (soundsBeforePause) assert.equal(await page.evaluate(() => window.__roundSounds.length), soundsBeforePause.plays + 1);
   console.log(type, 'pause/resume: PASS');
  }
  if (type === 'wheel' && args.includes('--report-audit')) {
   const contact = page.getByRole('button', { name: '문의하기', exact: true });
   await contact.click();
   const report = page.getByRole('dialog', { name: '게임 문의하기' });
   const body = report.getByRole('textbox', { name: '문의 내용' });
   const send = report.getByRole('button', { name: '보내기', exact: true });
   assert.equal(await send.isEnabled(), false);
   await page.keyboard.press('Escape');
   assert.equal(await contact.evaluate(el => el === document.activeElement), true);
   assert.equal(await page.evaluate(() => window.__gameReports), undefined);
   await contact.click();
   await report.getByLabel('문의 유형').selectOption('idea');
   await body.fill('돌림판에서 글씨가 작아요.');
   await page.evaluate(() => { window.__reportMessageFails = true; });
   await send.click();
   await report.getByRole('alert').waitFor();
   assert.equal(await body.inputValue(), '돌림판에서 글씨가 작아요.');
   await page.evaluate(() => { window.__reportMessageFails = false; });
   await send.click();
   await report.getByText(/문의를 보냈어요/).waitFor();
   assert.deepEqual(await page.evaluate(() => window.__gameReports), [{
    category: 'idea',
    subject: '게임 문의 · 돌림판',
    page_url: 'http://127.0.0.1:5263/games/wheel',
    user_agent: await page.evaluate(() => navigator.userAgent),
   }]);
   assert.deepEqual(await page.evaluate(() => window.__reportMessages), [{
    ticket_id: 'report-1', sender: 'user', body: '돌림판에서 글씨가 작아요.', attachment_path: null,
   }]);
   assert.equal(await report.getByRole('link', { name: '내 문의' }).getAttribute('href'), '/help?ticket=report-1');
   await report.getByRole('button', { name: '닫기', exact: true }).click();
   await expectPlay(page);
   console.log('wheel game report cancel, retry and delivery: PASS');
  }
  if(type==='wordfishing')await page.locator('.ad-wordfishing .ad-fish').first().waitFor({timeout:5000});
  if(type==='quizshow'){
   await page.getByText('학생 휴대폰 화면(미리보기)',{exact:true}).waitFor({timeout:5000});
   assert.equal(await page.evaluate(()=>window.__liveCreated===true),false);
  }
  const r=await page.evaluate(()=>({dialog:!!document.querySelector('dialog[open]'),toolbar:!!document.querySelector('[data-game-toolbar]'),mode:document.querySelector('[data-play-mode]')?.getAttribute('data-play-mode'),overlay:!!document.querySelector('[data-game-ready-overlay]'),board:!!document.querySelector('[data-game]')}));
  console.log(type,JSON.stringify(r),errs.slice(0,2).join('|'));
  if(r.dialog||r.overlay||!r.board||r.mode!=='play'||errs.length){bad.push(type);await page.screenshot({path:resolve(root,'../output/instant-'+type+'.png')});}
  if (type === 'ladder') {
   const participants = page.locator('[data-ladder-participants]');
   const results = page.locator('[data-ladder-results]');
   const dialog = page.getByRole('dialog');
   await participants.getByRole('button', { name: '참가자 1', exact: true }).click();
   await dialog.getByRole('textbox').fill('민지');
   await dialog.getByRole('button', { name: '저장', exact: true }).click();
   await participants.getByRole('button', { name: '민지', exact: true }).waitFor();
   await results.getByRole('button', { name: '결과 1', exact: true }).click();
   await dialog.getByRole('textbox').fill('발표하기');
   await dialog.getByRole('textbox').press('Enter');
   await results.getByRole('button', { name: '발표하기', exact: true }).waitFor();

   const stage = page.locator('[data-game-fit]');
   await stage.getByRole('button', { name: '한 명씩 결과 보기', exact: true }).click();
   assert.equal(await results.getByRole('button').count(), 0);
   await participants.getByRole('button', { name: '민지', exact: true }).click();
   await page.locator('[data-ladder-outcome]').waitFor();
   assert.equal(await dialog.count(), 0);
   await stage.getByRole('button', { name: '다시하기', exact: true }).first().click();
   await results.getByRole('button', { name: '발표하기', exact: true }).waitFor();
   await stage.getByRole('button', { name: '한 번에 결과 보기', exact: true }).click();
   assert.equal(await participants.getByRole('button').count(), 0);
   assert.equal(await results.getByRole('button').count(), 0);
   await page.locator('[data-ladder-outcome]').first().waitFor();
   assert.deepEqual(errs, []);
  }
  if(expandedPictureAudit) {
   try { await auditExpandedPictures(page,type); assert.deepEqual(errs,[]); }
   catch(error){ bad.push(type); console.error(type,error.message); }
  } else if(pictureAudit) {
   await auditPictureMode(page,type);
   assert.deepEqual(errs,[]);
  } else if(audit) {
   try { await auditApply(page,type); assert.deepEqual(errs,[]); }
   catch (error) { bad.push(type); console.error(type, error.message); }
  } else if(type==='wordfishing' || type==='balloonpop'){
   const openSource=page.getByRole('button',{name:'내 단어/문장',exact:true});
   const list=page.getByLabel('내 단어장 · 문장 모음');
   const apply=page.getByRole('button',{name:'적용',exact:true});
   await openSource.click();
   await list.selectOption('words');
   await apply.click();
   await apply.waitFor({state:'hidden'});
   const choice=page.locator(type==='wordfishing'?'.ad-fish':'.ad-balloon').filter({hasText:'dog'}).first();
   await choice.waitFor();
   await page.waitForFunction(()=>document.querySelector('[data-play-mode="play"]') && !document.querySelector('[data-game-ready-overlay]'));
   assert.equal(await choice.isEnabled(),true);
   await openSource.click();
   await page.getByText('지금 쓰는 자료: 합성 과일 (4개)',{exact:true}).waitFor();
   await apply.click();
   await apply.waitFor({state:'hidden'});
   assert.equal(await page.locator('[data-game-ready-overlay]').count(),0);
   const prompt=await page.locator('.ad-prompt span').first().innerText();
   const answer=Object.entries({apple:'사과',banana:'바나나',cat:'고양이',dog:'강아지'}).find(([,meaning])=>prompt.startsWith(meaning))?.[0];
   assert.ok(answer, 'first prompt should use the applied word list');
   await page.locator(`[data-word="${answer}"]`).press('Enter');
   await page.locator(type==='wordfishing'?'.ad-fish-correct':'.ad-balloon.correct').waitFor();
   assert.equal(await page.evaluate(()=>window.__readSources()===window.__originalSources),true);
   assert.deepEqual(errs,[]);
   console.log(type,'word list apply: PASS');
  }
  if(process.env.PANELS){for(const label of ['내 단어/문장','게임설정','저장/불러오기']){await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(600);const txt=await page.evaluate(()=>{const d=document.querySelector('dialog[open]');return (d?d.innerText:document.body.innerText).replace(/\s+/g,' ').slice(0,300)});console.log('  ['+label+']',txt);await page.screenshot({path:resolve(root,'../output/instant-'+type+'-'+label.replace(/\W/g,'')+'.png')});await page.keyboard.press('Escape');await page.waitForTimeout(200);}}
  await ctx.close();
 }
 // Load the common app graph once before opening several game routes in parallel.
 await verify(types[0]);
 for(let i=1;i<types.length;i+=6)await Promise.all(types.slice(i,i+6).map(verify));
 assert.equal(bad.length,0,'failed: '+bad);
 if(audit) console.log(`Applied and played in ${applied.size} games`);
 console.log('PASS');
}catch(e){console.error(e);process.exitCode=1;}
finally{await browser?.close();await server.close();}
