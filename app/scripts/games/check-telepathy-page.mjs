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
const api = `
const classes=[{id:'class-a',academy_id:'academy-a',name:'합성 반'}];
const lists=[{id:'sentences',kind:'sentence',name:'합성 문장',items:[{id:'custom',word:'We play together.',meaning:'함께 놀아요',image_url:null}]}];
const rows=JSON.parse(sessionStorage.getItem('telepathy-test-rows')||'[]');
const flush=()=>sessionStorage.setItem('telepathy-test-rows',JSON.stringify(rows));
window.__telepathyWrites=[];
const fn={fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>[],fetchAllWordLists:async()=>lists,fetchWordLists:async()=>lists,
fetchGameTemplates:async()=>structuredClone(rows),fetchGameTemplateById:async id=>structuredClone(rows.find(r=>r.id===id)),
createGameTemplate:async p=>{const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,name:p.name,items:p.items,config:p.config,updated_at:'test'};rows.push(row);flush();window.__telepathyWrites.push(row);return row},
updateGameTemplate:async(id,patch)=>{if(window.__telepathyFail)throw Error('synthetic save failure');Object.assign(rows.find(r=>r.id===id),patch);flush()}};
${names.map((n) => `export const ${n}=(...args)=>(fn.${n}||(async()=>[]))(...args);`).join("\n")}`;
const auth = `const staff=new URLSearchParams(location.search).get('mode')!=='student';const value={academy:{id:'academy-a',features:{group:true,solo:true,homework:true},plan:'paid'},profile:{id:'teacher-a'},isStaff:staff,isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:true}};export const useAuth=()=>value;`;
const server = await createServer({
  root,
  logLevel: "error",
  plugins: [
    {
      name: "telepathy-synthetic-only",
      enforce: "pre",
      load(id) {
        const p = id.replaceAll("\\", "/");
        if (p.endsWith("/src/lib/api.ts")) return api;
        if (p.endsWith("/src/context/AuthContext.tsx")) return auth;
        if (p.endsWith("/src/context/ToastContext.tsx"))
          return `const value={notify:()=>{},run:async f=>{try{await f();return true}catch{return false}}};export const useToast=()=>value;`;
        if (p.endsWith("/src/lib/supabase.ts"))
          return "export const supabase={};";
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5198, strictPort: true, hmr: false },
});

await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
const url = "http://127.0.0.1:5198/scripts/games/shuffle-page.html?game=telepathy&x=1";
const sleep = (ms) => page.waitForTimeout(ms);
let pass = 0;
const ok = (n) => { pass += 1; console.log("PASS", n); };

// 1) 게임 목록: 카드·경로
await page.goto(url + "&mode=games");
await page.getByText("텔레파시", { exact: true }).first().waitFor();
assert.ok((await page.locator('a[href="/games/telepathy"]').count()) >= 1, "게임 카드가 /games/telepathy 로 연결");
ok("게임 목록에 텔레파시 카드·링크");

// 2) 선생님 작업 화면: 샘플로 게임 시작
await page.goto(url + "&mode=teacher");
await page.locator('[data-game="telepathy"]').waitFor();
await page.getByRole("button", { name: "게임 시작", exact: true }).click();
await page.waitForSelector('[data-testid="telepathy"]');
assert.match(await page.locator("[role=status]").first().innerText(), /텔레파시 준비/);
ok("선생님 작업 화면: 샘플로 게임 시작");

// 3) 저장된 게임(팀 4·후보 4·1판·제한 없음)을 수업 안 화면으로 열고, 편집 화면의 설정 단추가 저장을 바꾼다
await page.evaluate(() => sessionStorage.setItem("telepathy-test-rows", JSON.stringify([{
  id: "t1", academy_id: "academy-a", class_id: "class-a", game_type: "telepathy", name: "합성 텔레파시",
  items: ["cat | 고양이", "dog | 강아지", "mouse | 쥐", "bird | 새", "fish | 물고기"].map((label, i) => ({ id: "i" + i, label })),
  config: { telepathyTeams: 4, telepathyChoices: 4, telepathyRounds: 1, telepathySeconds: 0 }, updated_at: "test",
}])));
await page.goto(url + "&mode=embed&template=t1");
await page.waitForSelector('[data-testid="telepathy"]');
await page.keyboard.press("Space");
await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("종이에 적어요"));
assert.equal(await page.locator("[data-testid=telepathy] img[src*='/a-']").count(), 4, "저장한 후보 수(4)대로 열린다");
assert.match(await page.locator("body").innerText(), /4팀/);
ok("저장된 템플릿 설정(후보 4·팀 4)대로 열림");

const stepper = (label, name) => page.locator("div", { hasText: new RegExp("^" + label + "$") }).locator("xpath=..").getByRole("button", { name, exact: true });
await stepper("팀 수", "-").click();
await stepper("판 수", "+").click();
await page.getByRole("button", { name: "30초", exact: true }).click();
await sleep(400);
const cfg = await page.evaluate(() => JSON.parse(sessionStorage.getItem("telepathy-test-rows"))[0].config);
assert.equal(cfg.telepathyTeams, 3);
assert.equal(cfg.telepathyRounds, 2);
assert.equal(cfg.telepathySeconds, 30);
ok("편집 화면에서 팀·판 수·적는 시간 변경이 저장됨");

// 4) 학생 화면에는 편집기가 없다
await page.goto(url + "&mode=student");
await sleep(1200);
assert.equal(await page.getByText("텔레파시 편집").count(), 0);
ok("학생 화면: 편집기 없음");

assert.deepEqual(errors, [], "오류 없음: " + errors.join("|"));
ok("브라우저 오류 없음");
console.log(`\n${pass} passed`);
await browser.close();
await server.close();
