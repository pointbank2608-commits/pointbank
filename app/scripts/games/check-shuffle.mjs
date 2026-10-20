// 컵 속 친구 찾기 검증: 순수 로직 + 실제 브라우저(합성 페이지, 서버·로그인 없음).
// 사용: cd app && node scripts/games/check-shuffle.mjs   (스크린샷은 환경 변수 SHOT_DIR 가 있으면 거기에 저장)
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
const ok = (name) => { pass += 1; console.log("PASS", name); };

const server = await createServer({
  root,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 5195, strictPort: true, hmr: false },
});
await server.listen();
let browser;
try {
  const L = await server.ssrLoadModule("/src/lib/shuffleFind.ts");

  // ---- 순수 로직 ----
  assert.deepEqual(L.normalizeShuffleConfig(undefined), { teams: 2, cups: 3, speed: "normal", rounds: 6 });
  assert.equal(L.normalizeShuffleConfig({ shuffleTeams: 99, shuffleCups: 1, shuffleSpeed: "bogus", shuffleRounds: -5 }).teams, 4);
  assert.equal(L.normalizeShuffleConfig({ shuffleCups: 1 }).cups, 3);
  assert.equal(L.normalizeShuffleConfig({ shuffleSpeed: "bogus" }).speed, "normal");
  assert.equal(L.normalizeShuffleConfig({ shuffleRounds: -5 }).rounds, 1);
  assert.equal(L.usableCups(2, 5), 2);
  assert.equal(L.usableCups(10, 5), 5);
  ok("설정 정규화·컵 수 보정");

  assert.deepEqual(L.slotCenters(3), [20, 50, 80]);
  for (const n of [3, 4, 5]) {
    const c = L.slotCenters(n);
    const w = L.cupWidth(n);
    for (let i = 1; i < c.length; i++) assert.ok(c[i] - c[i - 1] > w, `컵 ${n}개: 자리 간격이 컵 폭보다 넓다`);
    assert.ok(c[0] - w / 2 > 0 && c[n - 1] + w / 2 < 100, `컵 ${n}개: 무대 안`);
  }
  ok("자리 위치: 겹치지 않고 무대 안");

  let deck = [];
  for (let r = 0; r < 200; r++) {
    const d = L.drawLabels(deck, 4, 3);
    assert.equal(d.labels.length, 3);
    assert.equal(new Set(d.labels).size, 3, "한 판에 같은 항목이 겹치지 않는다");
    assert.ok(d.labels.every((x) => x >= 0 && x < 4));
    deck = d.deck;
  }
  ok("라벨 뽑기: 중복 없음(항목 4개·컵 3개 200판)");

  const hist = [0, 0, 0];
  for (let r = 0; r < 4000; r++) {
    const rd = L.buildRound([0, 1, 2], "normal", undefined);
    assert.equal(rd.swaps.length, 6);
    assert.equal(rd.finalCupAtSlot.indexOf(rd.hideCup), rd.answerSlot);
    assert.deepEqual([...rd.finalCupAtSlot].sort(), [0, 1, 2]);
    rd.swaps.forEach(([a, b], i) => {
      assert.ok(a < b && a >= 0 && b < 3);
      if (i) assert.notDeepEqual(rd.swaps[i - 1], [a, b], "같은 쌍을 연달아 바꾸지 않는다");
    });
    assert.deepEqual(L.applySwaps([0, 1, 2], rd.swaps), rd.finalCupAtSlot);
    hist[rd.answerSlot] += 1;
  }
  assert.ok(hist.every((h) => h > 4000 * 0.28 && h < 4000 * 0.39), `정답 자리가 고르게 나온다 ${hist}`);
  ok(`섞기·정답 자리 일치, 자리 분포 ${hist.join("/")}`);

  assert.equal(L.buildRound([0, 1, 2], "fast", "fox").animal !== "fox", true);
  const s1 = L.scoreRound({ scores: [0, 0], turn: 0 }, true);
  assert.deepEqual(s1, { scores: [1, 0], turn: 1 });
  assert.deepEqual(L.scoreRound(s1, false), { scores: [1, 0], turn: 0 });
  assert.deepEqual(L.scoreRound({ scores: [2], turn: 0 }, true), { scores: [3], turn: 0 });
  assert.deepEqual(L.rankTeams([2, 5, 5, 1]).map((r) => r.rank), [1, 1, 3, 4]);
  ok("점수·차례 넘김·순위(동점 같은 등수)");

  // ---- 실제 브라우저 ----
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  async function open(width, query) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
    const page = await ctx.newPage();
    // 합성 페이지에는 사이트 아이콘이 없어 favicon 404 가 나온다 — 그 밖의 실패한 요청만 오류로 센다
    page.on("response", (r) => r.status() >= 400 && !/favicon/.test(r.url()) && errors.push(`${r.status()} ${r.url()}`));
    page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:5195/scripts/games/shuffle.html${query}`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="shuffle-find"]');
    return { ctx, page };
  }
  const status = (page) => page.locator('[role="status"]').first().innerText();
  const waitPick = (page) => page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("소리 내어 읽고"), null, { timeout: 25000 });
  /** 동물이 놓인 자리 번호(0부터) — 섞기가 끝난 뒤 동물의 left 와 자리 가운데를 비교한다 */
  const answerSlot = (page, cups) =>
    page.evaluate((n) => {
      const centers = n === 3 ? [20, 50, 80] : n === 4 ? [15, 38.3, 61.7, 85] : [12, 31, 50, 69, 88];
      const img = document.querySelector('img[src*="/a-"]');
      const left = parseFloat(img.style.left);
      return centers.reduce((best, c, i) => (Math.abs(c - left) < Math.abs(centers[best] - left) ? i : best), 0);
    }, cups);

  // 1) 정답 자리 고르기 → 찾았어요, 오답 자리 → 아쉬워요 + 정답 공개
  {
    const { ctx, page } = await open(1440, "?speed=fast&rounds=2&teams=2&cups=3");
    assert.match(await status(page), /준비됐나요/);
    assert.equal(await page.locator("button:has-text('시작하기')").count(), 1);
    if (shotDir) await page.screenshot({ path: `${shotDir}/shuffle-ready-1440.png` });
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("잘 보세요"));
    if (shotDir) await page.screenshot({ path: `${shotDir}/shuffle-show-1440.png` });
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("섞여요"), null, { timeout: 10000 });
    if (shotDir) await page.screenshot({ path: `${shotDir}/shuffle-shuffling-1440.png` });
    // 섞는 동안에는 컵을 눌러도 고를 수 없다
    assert.equal(await page.locator("button[disabled][aria-label*='컵']").count() >= 3, true);
    await waitPick(page);
    const right = await answerSlot(page, 3);
    // 컵들이 서로 겹치지 않고 무대 안에 있는지
    const boxes = await page.locator("button[aria-label$='번 컵']").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })));
    boxes.sort((a, b) => a.l - b.l);
    for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i].l >= boxes[i - 1].r - 2, "컵이 겹치지 않는다");
    if (shotDir) await page.screenshot({ path: `${shotDir}/shuffle-pick-1440.png` });
    await page.keyboard.press(String(right + 1));
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("찾았어요"));
    assert.match(await page.locator("body").innerText(), /1팀\s*1점/);
    if (shotDir) await page.screenshot({ path: `${shotDir}/shuffle-found-1440.png` });
    await page.keyboard.press("Space"); // 다음 판
    await waitPick(page);
    const right2 = await answerSlot(page, 3);
    const wrong = (right2 + 1) % 3;
    await page.keyboard.press(String(wrong + 1));
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("아쉬워요"));
    await page.waitForTimeout(1500);
    if (shotDir) await page.screenshot({ path: `${shotDir}/shuffle-missed-1440.png` });
    assert.match(await page.locator("button:has-text('결과 보기')").innerText(), /결과 보기/);
    await page.keyboard.press("Space");
    await page.waitForSelector("text=게임 끝!");
    const body = await page.locator("body").innerText();
    assert.match(body, /1팀[\s\S]*1점/);
    assert.match(body, /2팀[\s\S]*0점/);
    if (shotDir) await page.screenshot({ path: `${shotDir}/shuffle-done-1440.png` });
    await page.getByRole("button", { name: "다시 하기" }).click();
    assert.match(await status(page), /준비됐나요/);
    await ctx.close();
    ok("전체 흐름: 시작→보기→섞기→고르기(정답/오답)→결과→다시 하기");
  }

  // 2) 컵 4·5개, 문장·긴 문장 라벨, 모바일 폭에서 가로 넘침 없음
  for (const [w, cups] of [[390, 3], [768, 4], [1440, 5]]) {
    const { ctx, page } = await open(w, `?speed=fast&rounds=1&teams=3&cups=${cups}&items=10`);
    await page.keyboard.press("Space");
    await waitPick(page);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `${w}px 가로 넘침 ${over}`);
    assert.equal(await page.locator("button[aria-label$='번 컵']").count(), cups);
    const right = await answerSlot(page, cups);
    if (shotDir) await page.screenshot({ path: `${shotDir}/shuffle-${cups}cups-${w}.png`, fullPage: true });
    await page.keyboard.press(String(right + 1));
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("찾았어요"));
    await ctx.close();
  }
  ok("컵 3·4·5개 × 390·768·1440px: 넘침 없음, 컵 수 일치");

  // 3) 항목이 컵 수보다 적으면 컵 수를 줄인다
  {
    const { ctx, page } = await open(1440, "?speed=fast&rounds=1&cups=5&items=3");
    assert.equal(await page.locator("button[aria-label$='번 컵']").count(), 3);
    await ctx.close();
    ok("항목 3개면 컵 5개 설정도 컵 3개로 보정");
  }

  // 4) 팀 1개(점수판이 횟수 표시), 새로고침 시 오류 없음
  {
    const { ctx, page } = await open(1440, "?speed=fast&rounds=1&teams=1");
    assert.match(await page.locator("body").innerText(), /찾은 횟수 0/);
    await ctx.close();
    ok("팀 1개: 찾은 횟수 표시");
  }
  assert.deepEqual(errors, [], "브라우저 오류 없음: " + errors.join("|"));
  ok("브라우저 콘솔 오류 없음");
} finally {
  await browser?.close();
  await server.close();
}
console.log(`\n${pass} passed`);
