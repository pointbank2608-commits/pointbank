// 전자칠판 검증: 순수 로직 + 실제 브라우저(합성 페이지, 서버·로그인 없음).
// 사용: cd app && node scripts/games/check-whiteboard.mjs   (스크린샷은 SHOT_DIR 가 있으면 거기에 저장)
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const shotDir = process.env.SHOT_DIR;
if (shotDir) mkdirSync(shotDir, { recursive: true });
let pass = 0;
const ok = (n) => { pass += 1; console.log("PASS", n); };

const names = [...readFileSync(resolve(root, "src/lib/api.ts"), "utf8").matchAll(/export (?:async )?function (\w+)|export const (\w+)/g)].map((m) => m[1] || m[2]);
const api = `
const lists=[{id:'w1',kind:'word',name:'합성 단어장',items:[{id:'i1',word:'tiger',meaning:'호랑이',image_url:null}]},{id:'s1',kind:'sentence',name:'합성 문장',items:[{id:'i2',word:'We play together.',meaning:'함께 놀아요',image_url:null}]}];
const fn={fetchAllWordLists:async()=>lists,fetchWordLists:async()=>lists,fetchClasses:async()=>[]};
${names.map((n) => `export const ${n}=(...args)=>(fn.${n}||(async()=>[]))(...args);`).join("\n")}`;
const auth = `const value={academy:{id:'academy-a',features:{group:true,solo:true,homework:true},plan:'paid'},profile:{id:'teacher-a'},isStaff:true,isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:true}};export const useAuth=()=>value;`;

const server = await createServer({
  root,
  logLevel: "error",
  plugins: [
    {
      name: "board-synthetic-only",
      enforce: "pre",
      load(id) {
        const p = id.replaceAll("\\", "/");
        if (p.endsWith("/src/lib/api.ts")) return api;
        if (p.endsWith("/src/context/AuthContext.tsx")) return auth;
        if (p.endsWith("/src/context/ToastContext.tsx")) return `const value={notify:()=>{},run:async f=>{try{await f();return true}catch{return false}}};export const useToast=()=>value;`;
        if (p.endsWith("/src/lib/supabase.ts")) return "export const supabase={};";
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5195, strictPort: true, hmr: false },
});
await server.listen();
let browser;
try {
  const B = await server.ssrLoadModule("/src/lib/boardMaterial.ts");
  const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

  // 1) 붙여넣기 해석·자료 종류
  const words = B.parseBoardText("apple 사과\nbanana - 바나나\ncat\n1. dog | 강아지\napple 또 사과").cards;
  assert.deepEqual(words.map((c) => [c.word, c.meaning]), [["apple", "사과"], ["banana", "바나나"], ["cat", ""], ["dog", "강아지"]], "중복은 한 번만, 번호·구분자 정리");
  assert.equal(B.detectKind(words), "word");
  const sents = B.parseBoardText("I like apples. | 나는 사과를 좋아해요.\nShe has a cat. 그녀는 고양이가 있어요.\nHello").cards;
  assert.equal(B.detectKind(sents), "sentence");
  assert.equal(sents[1].meaning, "그녀는 고양이가 있어요.");
  assert.equal(B.parseBoardText("a\n".repeat(5) + Array.from({ length: 80 }, (_, i) => `w${i}`).join("\n")).cards.length, 60, "최대 60장");
  const merged = B.mergeCards(words, B.cardsFromLines(["Apple | 사과", "pear | 배"]));
  assert.deepEqual(merged.map((c) => c.word), ["apple", "banana", "cat", "dog", "pear"], "같은 낱말(대소문자 무시)은 건너뜀");
  ok("붙여넣기 해석(구분자·번호·중복·최대 60장)·단어/문장 판별·합치기");

  // 2) 퀴즈
  const quizCards = B.cardsFromLines(["apple 사과", "banana 바나나", "cat 고양이", "dog 강아지", "book 책", "sun 해"]);
  for (let r = 0; r < 200; r++) {
    const qs = B.buildBoardQuiz(quizCards, 5);
    assert.equal(qs.length, 5);
    for (const q of qs) {
      assert.equal(new Set(q.choices).size, q.choices.length, "보기 중복 없음");
      assert.ok(q.choices.length >= 2 && q.choices.length <= 4);
      const card = quizCards.find((c) => c.word === q.prompt);
      assert.equal(q.choices[q.correct], card.meaning, "정답 위치가 맞다");
    }
    assert.equal(new Set(qs.map((q) => q.prompt)).size, 5, "같은 문제가 겹치지 않는다");
  }
  assert.deepEqual(B.buildBoardQuiz(B.cardsFromLines(["apple 사과"]), 5), [], "뜻이 하나뿐이면 만들 수 없다");
  assert.deepEqual(B.buildBoardQuiz(B.cardsFromLines(["cat", "dog"]), 5), [], "뜻이 없으면 만들 수 없다");
  assert.equal(B.buildBoardQuiz(B.cardsFromLines(["a 하나", "b 하나"]), 5).length, 0, "뜻이 모두 같으면 만들 수 없다");
  const spread = [0, 0, 0, 0];
  for (let r = 0; r < 2000; r++) spread[B.buildBoardQuiz(quizCards, 1)[0].correct] += 1;
  assert.ok(spread.slice(0, 4).every((n) => n > 2000 * 0.15), `정답 자리가 고르게 나온다 ${spread}`);
  ok("퀴즈: 정답·보기 중복·문제 겹침·만들 수 없는 경우·정답 자리 분포");

  // 3) 브라우저
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  page.on("response", (r) => r.status() >= 400 && !/favicon/.test(r.url()) && errors.push(`${r.status()} ${r.url()}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  const url = "http://127.0.0.1:5195/scripts/games/board.html";
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-whiteboard]");
  assert.match(await page.locator("[data-board-material-open]").innerText(), /오늘 자료 넣기/);
  assert.equal(await page.locator("[data-whiteboard] canvas").count(), 1, "펜 판");
  if (shotDir) await page.screenshot({ path: `${shotDir}/wb-empty.png` });

  // 자료 없이 도구를 누르면 자료 창이 먼저 → 예시로 시작 → 바로 그 도구
  await page.locator('[data-board-tool="flash"]').click();
  await page.waitForSelector("[data-board-material]");
  await page.getByRole("button", { name: "예시 단어로 해 보기" }).click();
  assert.match(await page.locator("[data-board-material]").innerText(), /카드 6장/);
  await page.getByRole("button", { name: "이 자료로 쓰기" }).click();
  await page.waitForSelector('[data-board-overlay="flash"]');
  assert.match(await page.locator('[data-board-overlay="flash"]').innerText(), /apple|banana|cat|dog|book|sun/);
  if (shotDir) await page.screenshot({ path: `${shotDir}/wb-flash.png` });
  await page.locator("[data-board-back]").click();
  assert.equal(await page.locator("[data-board-overlay]").count(), 0);
  assert.match(await page.locator("[data-board-material-open]").innerText(), /단어 6개/);
  ok("자료 없이 도구 → 자료 창 → 예시 단어 → 플래시카드 → 칠판으로 돌아오기");

  // 판서가 도구를 다녀와도 남는다
  const canvas = page.locator("[data-whiteboard] canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 260, { steps: 8 });
  await page.mouse.up();
  const strokes = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("classbank.board.strokes.v1") || "[]").length);
  assert.equal(await strokes(), 1, "선 하나 저장");
  await page.locator('[data-board-tool="read"]').click();
  await page.waitForSelector("[data-board-reader]");
  assert.equal(await strokes(), 1, "도구를 열어도 판서는 그대로");
  ok("펜으로 쓴 판서가 저장되고 도구를 열어도 남는다");

  // 예문 읽기
  const readerText = () => page.locator("[data-board-reader] p[lang=en]").innerText();
  const first = await readerText();
  await page.getByRole("button", { name: /다음/ }).click();
  assert.notEqual(await readerText(), first);
  await page.getByRole("button", { name: "뜻 보기" }).click();
  assert.match(await page.locator("[data-board-reader] [aria-live=polite]").innerText(), /[가-힣]/);
  await page.keyboard.press("ArrowLeft");
  assert.equal(await readerText(), first);
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-board-overlay]", { state: "detached" });
  ok("예문 읽기: 다음·이전(키보드)·뜻 보기");

  // 문법 불러오기: 고르기 → 문법 칠판 → 다시 고르기 → 검색
  await page.locator('[data-board-tool="grammar"]').click();
  await page.waitForSelector("[data-board-grammar-picker]");
  assert.ok((await page.locator("[data-grammar-id]").count()) > 5, "문법 목록이 보인다");
  await page.locator("[data-grammar-id]").first().click();
  await page.waitForSelector("[data-board-grammar-view]");
  assert.ok((await page.locator("[data-board-grammar-view]").innerText()).length > 20, "문법 칠판 내용");
  await page.locator("[data-board-grammar-list]").click();
  await page.getByPlaceholder("문법 이름·문장 틀로 찾기").fill("zzzzqq");
  assert.equal(await page.locator("[data-grammar-id]").count(), 0);
  await page.getByRole("button", { name: /← 칠판으로/ }).click();
  await page.waitForSelector("[data-board-overlay]", { state: "detached" });
  ok("문법 불러오기: 목록·문법 칠판·다시 고르기·검색");

  // 영어 4선 노트: 줄 칸 크기 바꾸기
  await page.getByRole("button", { name: "영어 4선 노트" }).click();
  const bgSize = () => page.locator("[data-whiteboard]").evaluate((el) => getComputedStyle(el).backgroundSize);
  const sizeM = await bgSize();
  await page.locator("[data-board-linesize] button").nth(3).click();
  const sizeXL = await bgSize();
  assert.notEqual(sizeM, sizeXL, "칸 크기를 바꾸면 줄 간격이 달라진다");
  await page.screenshot({ path: process.env.LINED_SHOT || "/tmp/lined.png" });
  await page.getByRole("button", { name: "초록" }).click();
  ok("영어 4선 노트: 줄 칸 크기 조절");

  // 지우개: 눈에 보이는 원 모양·크기 단추·휠·두 손가락 벌리기
  await page.locator("button:has-text(\"ink_eraser\")").click();
  await page.mouse.move(600, 400);
  const ring = page.locator("[data-eraser-cursor]");
  await ring.waitFor();
  const ringW = async () => Math.round((await ring.boundingBox()).width);
  assert.equal(await ringW(), 64, "기본 지우개 원 크기");
  await page.locator("[data-eraser-sizes] button").nth(3).click();
  await page.mouse.move(610, 410);
  assert.equal(await ringW(), 200, "큰 지우개");
  await page.mouse.wheel(0, 120);
  await page.mouse.move(612, 412);
  assert.ok((await ringW()) < 200, "휠로 작아진다");
  const before = await ringW();
  const after = await page.evaluate(async () => {
    const cv = document.querySelector("canvas");
    const fire = (type, id, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true, isPrimary: id === 11 }));
    fire("pointerdown", 11, 400, 400);
    fire("pointerdown", 12, 500, 400);
    fire("pointermove", 12, 700, 400);
    await new Promise((r) => setTimeout(r, 50));
    const w = document.querySelector("[data-eraser-cursor]")?.getBoundingClientRect().width;
    fire("pointerup", 12, 700, 400);
    fire("pointerup", 11, 400, 400);
    return w;
  });
  assert.ok(after > before * 1.5, `두 손가락을 벌리면 커진다(${before} → ${after})`);
  await page.locator("button:has-text(\"ink_pen\")").click();
  ok("지우개: 원 모양 표시·크기 단추·휠·두 손가락 조절");

  // 타이머: 시간 고르기·시작·멈춤·처음으로, 도구를 열어도 유지
  await page.locator('[data-board-tool="timer"]').click();
  const clock = () => page.locator("[data-timer-clock]").innerText();
  await page.locator('[data-timer-preset="30"]').click();
  assert.equal((await clock()).trim(), "0:30");
  await page.locator("[data-timer-toggle]").click();
  await page.waitForTimeout(2300);
  const mid = (await clock()).trim();
  assert.ok(mid < "0:30" && mid >= "0:25", `줄어든다(${mid})`);
  await page.locator('[data-board-tool="flash"]').click();
  await page.waitForSelector("[data-board-timer]");
  await page.locator("[data-board-back]").click();
  await page.locator("[data-timer-toggle]").click();
  const paused = (await clock()).trim();
  await page.waitForTimeout(1200);
  assert.equal((await clock()).trim(), paused, "멈추면 그대로");
  await page.locator("[data-timer-reset]").click();
  assert.equal((await clock()).trim(), "0:30");
  await page.locator('[data-timer-preset="1"], [data-timer-preset="60"]').first().click();
  assert.equal((await clock()).trim(), "1:00");
  await page.getByRole("button", { name: "닫기" }).last().click().catch(() => {});
  ok("타이머: 시간 고르기·시작·멈춤·처음으로·도구를 열어도 유지");

  // 간단 퀴즈(6장 → 6문제), 정답·오답 표시, 결과
  await page.locator('[data-board-tool="quiz"]').click();
  await page.getByRole("button", { name: "퀴즈 시작" }).click();
  let right = 0;
  for (let n = 0; n < 6; n++) {
    await page.waitForSelector('[data-board-quiz="question"]');
    const prompt = (await page.locator("[data-board-quiz] button[lang=en]").innerText()).replace(/\s*🔊/, "").trim();
    const answers = { apple: "사과", banana: "바나나", cat: "고양이", dog: "강아지", book: "책", sun: "해" };
    const wantRight = n % 2 === 0;
    const choices = page.locator("[data-choice]");
    const count = await choices.count();
    let idx = 0;
    for (let i = 0; i < count; i++) {
      const text = (await choices.nth(i).innerText()).trim();
      if ((text === answers[prompt]) === wantRight) { idx = i; break; }
    }
    await choices.nth(idx).click();
    if (wantRight) right += 1;
    assert.equal(await page.locator('[data-state="right"]').count(), 1, "정답 하나만 초록");
    assert.equal(await page.locator('[data-state="wrong"]').count(), wantRight ? 0 : 1);
    await page.getByRole("button", { name: "다음 문제" }).click();
  }
  await page.waitForSelector('[data-board-quiz="result"]');
  assert.match(await page.locator('[data-board-quiz="result"]').innerText(), new RegExp(`${right} / 6`));
  if (shotDir) await page.screenshot({ path: `${shotDir}/wb-quiz-result.png` });
  await page.getByRole("button", { name: "칠판으로" }).first().click();
  ok(`간단 퀴즈: 6문제·정답/오답 표시·결과 ${right} / 6`);

  // 게임 불러오기 → 그 자료로 시작 → 돌아오기(판서 유지)
  await page.locator('[data-board-tool="game"]').click();
  await page.waitForSelector("[data-board-games]");
  const gameCount = await page.locator("[data-board-games] [data-game]").count();
  assert.ok(gameCount >= 5, `게임 카드 ${gameCount}`);
  await page.locator('[data-board-games] [data-game="matchup"]').click();
  await page.waitForSelector('[data-probe="game"]');
  assert.equal(await page.locator("[data-probe=game]").getAttribute("data-cards"), "6");
  assert.equal(await page.locator("[data-probe=game]").getAttribute("data-kind"), "word");
  await page.waitForSelector("[data-board-return]");
  await page.getByRole("button", { name: /칠판으로 돌아가기/ }).click();
  await page.waitForSelector("[data-whiteboard]");
  assert.equal(await page.locator("[data-board-return]").count(), 0, "돌아오면 띠가 사라진다");
  assert.equal(await strokes(), 1, "게임에 다녀와도 판서 유지");
  assert.match(await page.locator("[data-board-material-open]").innerText(), /단어 6개/, "오늘 자료도 유지");
  ok(`게임 불러오기(${gameCount}종): 오늘 자료로 시작·칠판으로 돌아오기·판서와 자료 유지`);

  // 활동지 인쇄
  await page.locator('[data-board-tool="print"]').click();
  await page.waitForSelector("[data-board-print]");
  await page.locator("[data-board-print] button", { hasText: /플래시카드/ }).first().click();
  await page.waitForSelector('[data-probe="materials"]');
  assert.equal(await page.locator("[data-probe=materials]").getAttribute("data-cards"), "6");
  await page.waitForSelector("[data-board-return]");
  await page.getByRole("button", { name: /칠판으로 돌아가기/ }).click();
  await page.waitForSelector("[data-whiteboard]");
  ok("활동지 인쇄: 오늘 자료를 들고 인쇄 화면으로 → 칠판으로 돌아오기");

  // 문장 자료 → 종류 판별, 배경 바꾸기 유지
  await page.locator("[data-board-material-open]").click();
  await page.locator("[data-board-material] textarea").fill("I like apples. | 나는 사과를 좋아해요.\nShe has a cat. | 그녀는 고양이가 있어요.");
  await page.locator("[data-board-material] button", { hasText: /^\+$/ }).click();
  await page.getByRole("button", { name: "자료 비우기" }).click();
  await page.locator("[data-board-material] textarea").fill("I like apples. | 나는 사과를 좋아해요.\nShe has a cat. | 그녀는 고양이가 있어요.\nWe play soccer. | 우리는 축구를 해요.");
  await page.locator("[data-board-material] button", { hasText: /^\+$/ }).click();
  await page.getByRole("button", { name: "이 자료로 쓰기" }).click();
  assert.match(await page.locator("[data-board-material-open]").innerText(), /문장 3개/);
  await page.getByRole("button", { name: "검정" }).click();
  assert.equal(await page.locator("[data-whiteboard]").getAttribute("data-theme-name"), "black");
  if (shotDir) await page.screenshot({ path: `${shotDir}/wb-black.png` });
  ok("문장 자료 판별(문장 3개)·배경 바꾸기");

  // 작은 화면(전자칠판이 아닌 태블릿)에서도 상단 막대가 넘치지 않는다
  for (const w of [1024, 768]) {
    await page.setViewportSize({ width: w, height: 700 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `${w}px 가로 넘침 ${over}`);
  }
  ok("태블릿 폭(1024·768px) 가로 넘침 없음");

  // 나가기
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.getByRole("button", { name: "나가기" }).click();
  await page.waitForSelector('[data-probe="dashboard"]');
  assert.deepEqual(errors, [], "브라우저 오류 없음: " + errors.join("|"));
  ok("나가기·브라우저 콘솔 오류 없음");
} finally {
  await browser?.close();
  await server.close();
}
console.log(`\n${pass} passed`);
