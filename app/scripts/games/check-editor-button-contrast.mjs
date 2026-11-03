import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
mkdirSync(resolve(root,"../output/ux-remaining"),{recursive:true});
const names = [
  ...readFileSync(resolve(root, "src/lib/api.ts"), "utf8").matchAll(
    /export (?:async )?function (\w+)|export const (\w+)/g,
  ),
].map((m) => m[1] || m[2]);
const stub = `
import { isActivityDraft, patchActivityDraft } from '/src/lib/quickActivity.ts';
const academy={id:'academy-a',features:{group:true,homework:true},plan:'paid'};
const registeredClasses=[{id:'class-a',academy_id:'academy-a',name:'합성 A반'},{id:'class-b',academy_id:'academy-a',name:'합성 B반'}];
const classes=registeredClasses;
const students=[{id:'alice',name:'Alice',academy_id:'academy-a',class_id:'class-a'},{id:'bob',name:'Bob',academy_id:'academy-a',class_id:'class-a'}];
const lists=[{id:'words',academy_id:'academy-a',class_id:'class-a',kind:'word',name:'합성 과일',updated_at:'2026-10-19',items:[{id:'apple',word:'apple',meaning:'사과',image_url:'/word-bank-images/apple.webp',category:'fruit'},{id:'banana',word:'banana',meaning:'바나나',image_url:'/word-bank-images/banana.webp',category:'fruit'},{id:'cat',word:'cat',meaning:'고양이',image_url:'/word-bank-images/cat.webp',category:'animal'},{id:'dog',word:'dog',meaning:'강아지',image_url:null,category:'animal'}]},{id:'sentences',academy_id:'academy-a',class_id:'class-a',kind:'sentence',name:'합성 문장',updated_at:'2026-10-19',items:[{id:'s',word:'I like cats.',meaning:'나는 고양이를 좋아해요.',image_url:null}]}];
window.__workspace=JSON.parse(sessionStorage.getItem('UX점검.backend')||'null')||{templates:[],writes:[],fail:false,empty:false,lessons:[]};window.__persist=()=>sessionStorage.setItem('UX점검.backend',JSON.stringify(window.__workspace));
if(new URLSearchParams(location.search).has('student'))window.__workspace.templates.push({id:'student-game',academy_id:'academy-a',class_id:'class-a',game_type:'wheel',name:'학생용 저장 게임',items:[{id:'a',label:'apple'},{id:'b',label:'cat'}],config:{}});
if(new URLSearchParams(location.search).has('saved'))window.__workspace.templates.push({id:'original-game',academy_id:'academy-a',class_id:null,game_type:'wheel',name:'원본 저장 게임',items:[{id:'original',label:'ORIGINAL'}],config:{}});
const functions={
fetchMyStudentRow:async()=>({class_id:'class-a'}),
wordListKindOf:(list)=>list.kind==='sentence'?'sentence':'word',
updateWordListItems:async(id,items)=>{if(window.__workspace.fail)throw new Error('synthetic word update failure'); const list=lists.find(row=>row.id===id);if(list)list.items=items;},
fetchSavedGames:async()=>structuredClone(window.__workspace.templates),fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>students,fetchStudentsOfAcademy:async()=>students,
createWordList:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic save failure'); const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,kind:p.kind,items:p.items,updated_at:'now'};(window.__workspace.wordWrites||=[]).push(row);lists.push(row);return row;},
fetchAllWordLists:async()=>window.__workspace.empty?[]:structuredClone(lists),fetchAllCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessonById:async(id)=>structuredClone((window.__workspace.lessons||[]).find(x=>x.id===id)),
updateCurriculumLesson:async(id,p)=>{if(window.__workspace.fail)throw Error('UX점검 lesson update failed');Object.assign(window.__workspace.lessons.find(x=>x.id===id),p);window.__persist();},
createCurriculumLesson:async(p)=>{if(window.__workspace.fail)throw Error('UX점검 create lesson failed');const l={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,word_list_id:p.wordListId,video_url:null,level:p.level,playlist:p.playlist,updated_at:'now'};(window.__workspace.lessons||=[]).push(l);window.__persist();return structuredClone(l);},
appendActivityToLesson:async(l,s)=>{if(window.__workspace.fail)throw Error('UX점검 append failed');window.__workspace.lessons.find(row=>row.id===l.id).playlist.push(s);window.__persist();},
fetchWordLists:async(_a,_c,k='all')=>structuredClone(k==='all'?lists:lists.filter(x=>x.kind===k)),
fetchGameTemplates:async(_a,_c,type)=>window.__workspace.templates.filter(x=>x.game_type===type),
createGameTemplate:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic failure');const t={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,name:p.name,items:p.items,config:p.config||{},updated_at:'2026-10-19'};window.__workspace.templates.push(t);window.__workspace.writes.push(t);window.__persist();return structuredClone(t);},
fetchGameTemplateById:async(id)=>window.__workspace.templates.find(t=>t.id===id),
updateGameTemplate:async(id,p)=>{if(isActivityDraft(id)){patchActivityDraft(id,p);return;}if(window.__workspace.fail)throw Error('UX점검 update failed');Object.assign(window.__workspace.templates.find(t=>t.id===id)||{},p);window.__persist();}
};
${names.map((n) => `export const ${n}=(...args)=>(functions.${n}|| (async()=>[]))(...args);`).join("\n")}
`;
const auth = `const value={academy:{id:'academy-a',features:{group:true},plan:'paid',deletion_requested_at:null,deletion_scheduled_at:null},profile:{id:'teacher-a'},isStaff:!new URLSearchParams(location.search).has('student'),isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:false,inTrial:false,daysLeft:7},pointUnit:'별'};export const useAuth=()=>value;export const AuthProvider=({children})=>children;`;
const toast = `const run=async(fn)=>{try{await fn();return true}catch(e){console.error(e);return false}};const value={notify:()=>{},run};export const useToast=()=>value;export const ToastProvider=({children})=>children;`;
const server = await createServer({cacheDir:'node_modules/.vite/qa-button-contrast',
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
          return "export const supabase={rpc:async(name)=>({data:name==='my_deletion_request'?null:[],error:null}),channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}})};";
      },
    },
  ],
  server: { hmr: false, host: "127.0.0.1", port: 5380, strictPort: true },
});



let browser,page;const results=[],baseline=!!process.env.CONTRAST_BASELINE;
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 const games=baseline?['balloonpop','wordtrain','feedmonster','sentencebridge']:['balloonpop','wordfishing','wordtrain','sentencerocket','grammardetective','treasurehunt','wordclaw','feedmonster','sentencebridge','sentencetower'];
 const measure=async()=>page.locator('.ad-editor button:visible,.sb-editor button:visible').evaluateAll(buttons=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true});const rgb=value=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);const d=ctx.getImageData(0,0,1,1).data;return [d[0],d[1],d[2],d[3]/255];},mix=(a,b)=>{const alpha=a[3]??1;return a.slice(0,3).map((v,i)=>v*alpha+b[i]*(1-alpha));};
  const background=el=>{let color=[255,255,255];const nodes=[];for(let node=el;node;node=node.parentElement)nodes.unshift(node);for(const node of nodes)color=mix(rgb(getComputedStyle(node).backgroundColor),color);return color;};
  const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((out,v,i)=>out+v*[.2126,.7152,.0722][i],0);
  return buttons.filter(el=>!el.disabled&&el.textContent.trim()).map(el=>{const st=getComputedStyle(el),bg=background(el),fg=mix(rgb(st.color),bg),a=lum(bg),b=lum(fg);return{text:el.textContent.trim().slice(0,65),color:st.color,background:st.backgroundColor,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
 });
 for(const game of games.filter(game=>!process.env.CONTRAST_GAME||game===process.env.CONTRAST_GAME)){
  await page.goto('http://127.0.0.1:5380/scripts/games/focus.html?start=/games/'+game);await page.locator('[data-game-guide]').getByRole('button',{name:'샘플로 먼저 해보기',exact:false}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.locator('[data-frame-controls]').getByRole('button',{name:'☰ 메뉴',exact:true}).click();const label=await page.evaluate(async()=>(await import('/src/i18n/index.ts')).default.t('flow.nativeEditor'));await page.getByRole('dialog').getByRole('button',{name:label,exact:true}).click();const editor=page.locator('.ad-editor:visible,.sb-editor:visible');await editor.waitFor();
  for(const summary of await editor.locator('details > summary').all())if(await summary.isVisible())await summary.click();
  await page.waitForTimeout(300);const closed=await measure();const loader=editor.getByRole('button',{name:/단어장에서 불러오기|문장 목록에서 불러오기/}).first();let hover=[];if(await loader.count()){await loader.hover();await page.waitForTimeout(300);hover=await measure();await page.keyboard.press('Tab');await loader.focus();assert.equal(await loader.evaluate(el=>getComputedStyle(el).outlineStyle!=='none'),true);await page.mouse.move(0,0);await page.waitForTimeout(300);}
  for(const button of await editor.getByRole('button',{name:/단어장에서 불러오기|문장 목록에서 불러오기/}).all())if(await button.isVisible())await button.click();const bankButton=editor.getByRole('button',{name:/문장 은행/});if(await bankButton.count())await bankButton.click();await page.mouse.move(0,0);await page.waitForTimeout(300);const opened=await measure();let mobile=[];if(!baseline&&['balloonpop','sentencebridge'].includes(game)){await page.setViewportSize({width:390,height:844});const anchor=editor.getByRole('button',{name:/단어장 닫기|문장 목록 닫기/}).first();if(await anchor.count())await anchor.scrollIntoViewIfNeeded();await page.waitForTimeout(300);mobile=await measure();await page.screenshot({path:resolve(root,'../output/ux-remaining/button-'+game+'-mobile.png')});await page.setViewportSize({width:1440,height:1100});}const low=[...closed,...hover,...opened,...mobile].filter(b=>b.ratio<4.5);results.push({game,buttonsChecked:closed.length+hover.length+opened.length+mobile.length,low});console.log(game,low.length?JSON.stringify(low):'all readable');if(!baseline)assert.equal(low.length,0,game+' has low-contrast editor buttons');
  if(game==='balloonpop'||game==='sentencebridge')await page.screenshot({path:resolve(root,'../output/ux-remaining/button-'+game+(baseline?'-before':'-after')+'.png')});
 }
 assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);assert.deepEqual(errors,[]);writeFileSync(resolve(root,'../output/ux-remaining/button-contrast'+(baseline?'-baseline':process.env.CONTRAST_GAME?'-'+process.env.CONTRAST_GAME:'-results')+'.json'),JSON.stringify({passed:!baseline,results,errors},null,2));
}catch(e){console.error(e);if(page)console.error((await page.locator('body').innerText()).slice(-3000));process.exitCode=1;}finally{await browser?.close();await server.close();}
