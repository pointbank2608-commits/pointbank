// 텔레파시 검증: 순수 로직 + 실제 브라우저(합성 페이지, 서버·로그인 없음).
// 사용: cd app && node scripts/games/check-telepathy.mjs   (스크린샷은 SHOT_DIR 가 있으면 거기에 저장)
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const shotDir = process.env.SHOT_DIR;
if (shotDir) mkdirSync(shotDir, { recursive: true });
let pass = 0;
const ok = (n) => { pass += 1; console.log("PASS", n); };
const server = await createServer({ root, logLevel: "error", server: { host: "127.0.0.1", port: 5197, strictPort: true, hmr: false } });
await server.listen();
let browser;
try {
  const T = await server.ssrLoadModule("/src/lib/telepathy.ts");
  assert.deepEqual(T.normalizeTelepathyConfig(undefined), { teams: 3, choices: 3, rounds: 8, seconds: 20 });
  const bad = T.normalizeTelepathyConfig({ telepathyTeams: 99, telepathyChoices: 1, telepathyRounds: -4, telepathySeconds: 17 });
  assert.deepEqual(bad, { teams: 6, choices: 3, rounds: 1, seconds: 20 });
  assert.equal(T.normalizeTelepathyConfig({ telepathySeconds: 0 }).seconds, 0);
  assert.equal(T.usableChoices(2, 4), 2);
  assert.equal(T.usableChoices(9, 4), 4);
  ok("설정 정규화(범위·허용 시간만)·후보 수 보정");

  let deck = [];
  const hist = [0, 0, 0];
  for (let r = 0; r < 3000; r++) {
    const b = T.buildTelepathyRound(deck, 5, 3);
    deck = b.deck;
    assert.equal(new Set(b.round.labels).size, 3, "후보가 겹치지 않는다");
    assert.equal(new Set(b.round.animals).size, 3, "동물이 겹치지 않는다");
    assert.ok(b.round.answer >= 0 && b.round.answer < 3);
    hist[b.round.answer] += 1;
  }
  assert.ok(hist.every((h) => h > 3000 * 0.28 && h < 3000 * 0.39), `정답 자리가 고르게 나온다 ${hist}`);
  ok(`한 판 구성: 후보·동물 중복 없음, 정답 자리 분포 ${hist.join("/")}`);
  assert.deepEqual(T.addRoundScores([1, 0, 2], [true, false, true]), [2, 0, 3]);
  assert.deepEqual(T.rankTeams([3, 1, 3]).map((r) => r.rank), [1, 1, 3]);
  ok("점수 더하기·순위");

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  async function open(width, query) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
    const page = await ctx.newPage();
    page.on("response", (r) => r.status() >= 400 && !/favicon/.test(r.url()) && errors.push(`${r.status()} ${r.url()}`));
    page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:5197/scripts/games/telepathy.html${query}`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="telepathy"]');
    return { ctx, page };
  }
  const waitStatus = (page, text, timeout = 12000) => page.waitForFunction((x) => document.querySelector('[role="status"]')?.textContent?.includes(x), text, { timeout });

  {
    const { ctx, page } = await open(1440, "?rounds=2&teams=3&seconds=0");
    assert.match(await page.locator('[role="status"]').first().innerText(), /텔레파시 준비/);
    if (shotDir) await page.screenshot({ path: `${shotDir}/tp-ready-1440.png` });
    await page.keyboard.press("Space");
    await waitStatus(page, "종이에 적어요");
    assert.equal(await page.locator('[role="timer"]').count(), 0, "시간 제한 없음이면 타이머가 없다");
    if (shotDir) await page.screenshot({ path: `${shotDir}/tp-predict-1440.png` });
    assert.equal(await page.locator("[data-testid=telepathy] img[src*='/a-']").count(), 3, "후보 3개에 동물 3마리");
    await page.keyboard.press("Space");
    await waitStatus(page, "흔들려요");
    if (shotDir) await page.screenshot({ path: `${shotDir}/tp-shake-1440.png` });
    await waitStatus(page, "열려요");
    await page.waitForTimeout(350);
    if (shotDir) await page.screenshot({ path: `${shotDir}/tp-open-1440.png` });
    await waitStatus(page, "적은 팀은 누구");
    await page.waitForTimeout(900);
    assert.equal(await page.getByText("정답!", { exact: true }).count(), 1, "정답 후보 하나만 표시");
    if (shotDir) await page.screenshot({ path: `${shotDir}/tp-reveal-1440.png` });
    // 맞힌 팀 표시 → 점수 미리 반영, 다시 누르면 취소
    const team1 = page.getByRole("button", { name: /^1팀/ });
    await team1.click();
    assert.match(await page.locator('[aria-label="점수판"]').innerText(), /1팀\s*1점/);
    await team1.click();
    assert.match(await page.locator('[aria-label="점수판"]').innerText(), /1팀\s*0점/);
    await team1.click();
    await page.getByRole("button", { name: /^3팀/ }).click();
    await page.keyboard.press("Space"); // 다음 판
    await waitStatus(page, "종이에 적어요");
    await page.keyboard.press("Space");
    await waitStatus(page, "적은 팀은 누구", 15000);
    await page.getByRole("button", { name: /^3팀/ }).click();
    assert.equal(await page.getByRole("button", { name: "결과 보기" }).count(), 1);
    await page.keyboard.press("Space");
    await page.waitForSelector("text=게임 끝!");
    const body = await page.locator("body").innerText();
    // 1팀 1점, 3팀 2점, 2팀 0점
    assert.match(body, /1[\s\S]*3팀[\s\S]*2점/);
    if (shotDir) await page.screenshot({ path: `${shotDir}/tp-done-1440.png` });
    await page.getByRole("button", { name: "다시 하기" }).click();
    assert.match(await page.locator('[role="status"]').first().innerText(), /텔레파시 준비/);
    await ctx.close();
    ok("전체 흐름: 후보→적기→흔들림→열림→맞힌 팀 표시(토글)→다음 판→결과→다시 하기");
  }

  {
    const { ctx, page } = await open(1440, "?rounds=1&teams=2&seconds=10");
    await page.keyboard.press("Space");
    await waitStatus(page, "종이에 적어요");
    const first = Number(await page.locator('[role="timer"]').innerText());
    assert.ok(first <= 10 && first >= 8, `타이머 시작값 ${first}`);
    await page.waitForTimeout(3000);
    const later = Number(await page.locator('[role="timer"]').innerText());
    assert.ok(later <= first - 2, `타이머가 줄어든다 ${first}→${later}`);
    await waitStatus(page, "시간 끝", 12000);
    assert.equal(Number(await page.locator('[role="timer"]').innerText()), 0);
    await ctx.close();
    ok("제한 시간: 줄어들고 0이 되면 시간 끝 안내(자동으로 열지는 않음)");
  }

  for (const [w, choices] of [[390, 3], [768, 4], [1440, 4]]) {
    const { ctx, page } = await open(w, `?rounds=1&teams=6&choices=${choices}&items=10`);
    await page.keyboard.press("Space");
    await waitStatus(page, "종이에 적어요");
    await page.keyboard.press("Space");
    await waitStatus(page, "적은 팀은 누구", 15000);
    await page.waitForTimeout(900);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `${w}px 가로 넘침 ${over}`);
    if (shotDir) await page.screenshot({ path: `${shotDir}/tp-reveal-${choices}-${w}.png`, fullPage: true });
    await ctx.close();
  }
  ok("후보 3·4개 × 390·768·1440px, 팀 6개: 가로 넘침 없음");

  {
    const { ctx, page } = await open(1440, "?rounds=1&choices=4&items=3");
    await page.keyboard.press("Space");
    await waitStatus(page, "종이에 적어요");
    assert.equal(await page.locator("[data-testid=telepathy] img[src*='/a-']").count(), 3);
    await ctx.close();
    ok("항목 3개면 후보 4개 설정도 3개로 보정");
  }
  assert.deepEqual(errors, [], "브라우저 오류 없음: " + errors.join("|"));
  ok("브라우저 콘솔 오류 없음");
} finally {
  await browser?.close();
  await server.close();
}
console.log(`\n${pass} passed`);
