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
const academy={id:'academy-a',features:{group:true,homework:true},plan:'paid'};
const classes=[{id:'class-a',academy_id:'academy-a',name:'합성 A반'},{id:'class-b',academy_id:'academy-a',name:'합성 B반'}];
const students=[{id:'alice',name:'Alice'},{id:'bob',name:'Bob'},{id:'cara',name:'Cara'}];
const lists=[{id:'words',academy_id:'academy-a',class_id:'class-a',kind:'word',name:'합성 과일',updated_at:'2026-10-19',items:[{id:'apple',word:'apple',meaning:'사과',image_url:'/word-bank-images/apple.webp',category:'fruit'},{id:'banana',word:'banana',meaning:'바나나',image_url:'/word-bank-images/banana.webp',category:'fruit'},{id:'cat',word:'cat',meaning:'고양이',image_url:'/word-bank-images/cat.webp',category:'animal'},{id:'dog',word:'dog',meaning:'강아지',image_url:null,category:'animal'}]},{id:'sentences',academy_id:'academy-a',class_id:'class-a',kind:'sentence',name:'합성 문장',updated_at:'2026-10-19',items:[{id:'s',word:'I like cats.',meaning:'나는 고양이를 좋아해요.',image_url:null}]}];
window.__workspace={templates:[],writes:[],fail:false};
const functions={
fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>students,fetchStudentsOfAcademy:async()=>students,
fetchWordLists:async(_a,_c,k)=>k==='all'?lists:lists.filter(x=>x.kind===k),
fetchGameTemplates:async(_a,_c,type)=>window.__workspace.templates.filter(x=>x.game_type===type),
createGameTemplate:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic failure');const t={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,name:p.name,items:p.items,config:p.config||{},updated_at:'2026-10-19'};window.__workspace.templates.push(t);window.__workspace.writes.push(t);return t;},
fetchGameTemplateById:async(id)=>window.__workspace.templates.find(t=>t.id===id),
updateGameTemplate:async(id,p)=>Object.assign(window.__workspace.templates.find(t=>t.id===id)||{},p)
};
${names.map((n) => `export const ${n}=(...args)=>(functions.${n}|| (async()=>[]))(...args);`).join("\n")}
`;
const auth = `const value={academy:{id:'academy-a',features:{group:true},plan:'paid'},profile:{id:'teacher-a'},isStaff:true,isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:true},pointUnit:'별'};export const useAuth=()=>value;export const AuthProvider=({children})=>children;`;
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
          return "export const supabase={rpc:async()=>({data:[],error:null}),channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}})};";
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5188, strictPort: true },
});
let browser, page;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://**/*", (r) => r.abort());
  const url = "http://127.0.0.1:5188/scripts/games/workspace.html";
  await page.goto(url + "?game=quiz");
  await page.locator('.game-workspace-stage [data-game="quiz"]').waitFor();
  assert.equal(await page.locator("dialog[open]").count(), 0);
  assert.equal(
    await page.locator("[data-game-existing-settings]").isVisible(),
    false,
  );
  await page.evaluate(() => {
    window.__ticks = 0;
    window.__clock.setTimeout(() => window.__ticks++, 80);
  });
  await page.waitForTimeout(160);
  assert.equal(await page.evaluate(() => window.__ticks), 0);
  await page
    .locator(".game-workspace > div")
    .first()
    .getByRole("button", { name: /시작·이어하기/ })
    .click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__ticks), 1);
  await page.getByRole("button", { name: "설정·저장", exact: true }).click();
  await page
    .getByRole("dialog", { name: "선생님 준비", exact: true })
    .waitFor();
  await page.evaluate(() => {
    window.__clock.setTimeout(() => window.__ticks++, 80);
  });
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__ticks), 1);
  await page
    .getByRole("button", { name: "닫고 게임으로", exact: true })
    .click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__ticks), 2);
  console.log(
    "ok portal: board outside settings, pause/resume retains clock, mounted settings and board",
  );
  await page.getByRole("button", { name: /📚/ }).click();
  await page.getByRole("button", { name: /합성 과일 · 4/ }).click();
  await page.waitForFunction(() => window.__workspace.writes.length === 1);
  await page.locator('.game-workspace-stage [data-game="quiz"]').waitFor();
  assert.equal(
    await page.evaluate(
      () => window.__workspace.writes[0].config.questions.length,
    ),
    4,
  );
  await page
    .getByRole("button", { name: "같은 내용으로 다른 게임", exact: true })
    .click();
  await page.getByRole("button", { name: "돌림판", exact: true }).click();
  await page.waitForURL("**/games/wheel");
  await page.locator('.game-workspace-stage [data-game="wheel"]').waitFor();
  assert.equal(
    await page.evaluate(() => window.__workspace.writes[1].items[0].label),
    "apple",
  );
  assert.equal(
    await page.evaluate(() => window.__workspace.writes[1].config.questions),
    undefined,
  );
  console.log(
    "ok real pages: list selection prepares quiz; switch to wheel with converted source and no copied quiz answers",
  );
  await page.getByRole("button", { name: "팀·순서", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Bob", { exact: true }).check();
  assert.equal(await page.getByLabel("Bob", { exact: true }).isChecked(), true);
  await page.keyboard.press("Escape");
  console.log("ok participants: team/order dialog and per-session exclusion");
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow ${width}`,
    );
  }
  console.log("ok tablet/mobile width");
  const gamePaths = [
    ...readFileSync(resolve(root, "src/lib/gamePages.ts"), "utf8").matchAll(
      /'\/games\/(\w+)'\s*:/g,
    ),
  ].map((m) => m[1]);
  for (const game of gamePaths) {
    const before = errors.length;
    await page.goto(url + "?game=" + game);
    await page
      .getByRole("button", { name: "설정·저장", exact: true })
      .first()
      .waitFor();
    await page
      .getByRole("button", { name: "설정·저장", exact: true })
      .first()
      .click();
    await page
      .getByRole("dialog", { name: "선생님 준비", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "닫고 게임으로", exact: true })
      .click();
    assert.equal(
      errors.length,
      before,
      `${game}: ${errors.slice(before).join("; ")}`,
    );
  }
  console.log(
    `ok all ${gamePaths.length} game pages: teacher settings open/close without runtime errors`,
  );
  await page.addInitScript(()=>{
    const cards=[{id:'a',word:'apple',meaning:'사과',imageUrl:null},{id:'b',word:'banana',meaning:'바나나',imageUrl:null}];
    sessionStorage.setItem('classbank.lessonRunner',JSON.stringify({lessonId:'synthetic-lesson',lessonName:'합성 수업',classId:'class-a',steps:[{kind:'game',slideId:'game-a',path:'/games/quiz',label:'Quiz'},{kind:'canvas',slideId:'next',path:'/curriculum/synthetic/slide/next',label:'Next'}],stepIndex:0,startedAt:Date.now(),words:['apple','banana'],viewSnapshot:{slides:[{kind:'game',id:'game-a',gameType:'quiz'}],words:cards}}));
    history.replaceState({usr:{materialsWords:cards},key:'synthetic'},'','/games/quiz');
  });
  await page.goto(url+'?game=quiz');
  await page.getByRole('button',{name:'다른 게임',exact:true}).waitFor();
  await page.getByRole('button',{name:'다른 게임',exact:true}).click();
  await page.getByRole('button',{name:'돌림판',exact:true}).click();
  await page.waitForURL('**/games/wheel');
  const lesson=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('classbank.lessonRunner')));
  assert.equal(lesson.steps[0].path,'/games/wheel');assert.equal(lesson.stepIndex,0);assert.equal(lesson.steps[1].slideId,'next');assert.equal(lesson.viewSnapshot.slides[0].gameType,'wheel');
  console.log('ok lesson presentation: inherited words/class; game switch updates current step and future follow-along snapshot');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: resolve(root, "node_modules/homework-test-tools/game-workspace.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log("All workspace browser checks passed. Synthetic adapters only.");
} catch (e) {
  console.error("FAILED:", e.message);
  if (page) {
    console.error((await page.locator("body").innerText()).slice(0, 4000));
    await page.screenshot({
      path: resolve(
        root,
        "node_modules/homework-test-tools/game-workspace-failure.png",
      ),
      fullPage: true,
    });
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
