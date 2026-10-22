import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
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
const rows=JSON.parse(sessionStorage.getItem('splash-test-rows')||'[]');
const flush=()=>sessionStorage.setItem('splash-test-rows',JSON.stringify(rows));
window.__splashWrites=[];
const fn={fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>[],fetchAllWordLists:async()=>lists,fetchWordLists:async()=>lists,
fetchGameTemplates:async()=>structuredClone(rows),fetchGameTemplateById:async id=>structuredClone(rows.find(r=>r.id===id)),
createGameTemplate:async p=>{const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,name:p.name,items:p.items,config:p.config,updated_at:'test'};rows.push(row);flush();window.__splashWrites.push(row);return row},
updateGameTemplate:async(id,patch)=>{if(window.__splashFail)throw Error('synthetic save failure');Object.assign(rows.find(r=>r.id===id),patch);flush()}};
${names.map((n) => `export const ${n}=(...args)=>(fn.${n}||(async()=>[]))(...args);`).join("\n")}`;
const auth = `const staff=new URLSearchParams(location.search).get('mode')!=='student';const value={academy:{id:'academy-a',features:{group:true,solo:true,homework:true},plan:'paid'},profile:{id:'teacher-a'},isStaff:staff,isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:true}};export const useAuth=()=>value;`;
const server = await createServer({
  root,
  logLevel: "error",
  plugins: [
    {
      name: "splash-synthetic-only",
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
  server: { host: "127.0.0.1", port: 5194, strictPort: true, hmr: false },
});
let browser;
try {
  const logic = await server.ssrLoadModule("/src/lib/sentenceSplash.ts");
  const { prepareClassroomGame } = await server.ssrLoadModule(
    "/src/lib/gameWorkspace.ts",
  );
  const { buildGameContent } = await server.ssrLoadModule(
    "/src/lib/gameFromWords.ts",
  );
  const words = logic.sentenceWords("  He'd\tlike to like them?  ");
  assert.deepEqual(words, ["He'd", "like", "to", "like", "them?"]);
  const bricks = logic.makeSplashBricks(
    { id: "s", label: "I like it like this." },
    () => 0.42,
  );
  assert.equal(new Set(bricks.map((b) => b.id)).size, 5);
  const duplicates = bricks.filter((b) => b.word === "like");
  assert(
    logic.canClaimBrick(
      ["I", "like", "it", "like", "this."],
      ["s:0"],
      duplicates[1],
      bricks,
    ),
  );
  assert(
    !logic.canClaimBrick(
      ["I", "like"],
      ["s:0", duplicates[1].id],
      duplicates[1],
      bricks,
    ),
  );
  for (const width of [180, 280, 650, 1200]) {
    const packed = logic.layoutSplashBricks(
      [
        ...bricks,
        ...logic.makeSplashBricks({
          id: "long",
          label:
            "supercalifragilisticexpialidocious words repeat words repeat words repeat words",
        }),
      ],
      width,
      (s) => s.length * 12,
    );
    for (const b of packed.positions) {
      assert(b.x >= 0 && b.x + b.width <= width);
      assert(b.width >= 48 && b.height >= 48);
    }
    for (let i = 0; i < packed.positions.length; i++)
      for (let j = i + 1; j < packed.positions.length; j++) {
        const a = packed.positions[i],
          b = packed.positions[j];
        assert(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
        );
      }
    assert.equal(
      Math.max(...packed.positions.map((b) => b.y + b.height)) + packed.fall,
      packed.height - 90,
    );
  }
  for (const time of [30, 45, 60, 90]) {
    assert.equal(logic.splashProgress(100, 100 + time * 500, time), 0.5);
    assert.equal(logic.splashProgress(100, 100 + time * 1000, time), 1);
  }
  const source = {
    kind: "sentence",
    items: [{ id: "a", word: "We play together.", meaning: "함께 놀아요" }],
  };
  const before = JSON.stringify(source);
  const content = prepareClassroomGame("sentencesplash", source);
  assert.equal(content.items[0].label, "We play together.");
  assert.equal(content.config.splashSeconds, 45);
  assert.equal(JSON.stringify(source), before);
  assert.equal(
    buildGameContent("sentencesplash", [
      { id: "s", word: "We play together.", meaning: "" },
    ]).items.length,
    1,
  );
  assert.equal(
    buildGameContent("sentencesplash", [
      { id: "s", word: "play", meaning: "" },
    ]),
    null,
  );
  assert.equal(
    prepareClassroomGame("sentencesplash", {
      kind: "sentence",
      items: Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        word: `We play game ${i}.`,
        meaning: "",
      })),
    }).items.length,
    50,
  );
  console.log(
    "ok logic: contractions, punctuation, duplicate identities, row packing, four durations, source conversion",
  );
  assert.match(
    readFileSync(resolve(root, "src/lib/gamePages.ts"), "utf8"),
    /'\/games\/sentencesplash': SentenceSplashPage/,
  );
  assert.match(
    readFileSync(resolve(root, "src/lib/blocks/registry.ts"), "utf8"),
    /sentencesplash: 'sentenceOrder'/,
  );
  await server.listen();
  browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() === 'error' && /Encountered two children|Maximum update depth|Rendered (?:more|fewer) hooks/.test(msg.text())) errors.push(msg.text());
  });
  const remote = [];
  await page.route("https://**/*", (r) => {
    remote.push(r.request().url());
    return r.abort();
  });
  const url = "http://127.0.0.1:5194/scripts/games/splash.html";
  // 효과음: Audio.play 호출을 기록해 어떤 소리가 났는지 확인한다(실제 소리는 내지 않는다).
  await page.addInitScript(() => {
    window.__snd = [];
    HTMLMediaElement.prototype.play = function () {
      window.__snd.push((this.src || "").split("/").pop().split("?")[0]);
      return Promise.resolve();
    };
  });
  await page.goto(url);
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  await page.getByRole("button", { name: "them?", exact: true }).click();
  assert.match(await page.getByRole("status").innerText(), /아직/);
  for (const word of ["He'd", "like", "to", "like", "them?"])
    await page
      .getByRole("button", { name: word, exact: true })
      .filter({ visible: true })
      .first()
      .click();
  await page.getByText("문장 완성!", { exact: true }).waitFor();
  assert.equal(
    await page.locator(".splash-answer").innerText(),
    "He'd like to like them?",
  );
  const played = await page.evaluate(() => window.__snd);
  assert.equal(played[0], "4041.mp3", "시작 소리");
  assert.ok(played.includes("4025.mp3"), "틀린 벽돌 소리");
  assert.equal(played.filter((n) => n === "4015.mp3").length, 4, "맞힌 벽돌마다 소리(마지막 벽돌은 완성 소리로 대신)");
  assert.equal(played.at(-1), "5037.mp3", "문장 완성 소리");
  await page
    .getByRole("button", { name: "전체 결과 보기", exact: true })
    .click();
  assert.match(await page.locator(".splash-modal").innerText(), /1 \/ 1/);
  await page
    .getByRole("button", { name: "다시 플레이하기", exact: true })
    .click();
  await page.evaluate(() => window.__splash.shift(31000));
  await page.getByText("다시 도전해요!", { exact: true }).waitFor();
  assert.equal(await page.locator(".splash-answer").count(), 0);
  assert.ok((await page.evaluate(() => window.__snd)).includes("3091.mp3"), "바다에 빠진 소리");
  await page
    .getByRole("button", { name: "다시 도전하기", exact: true })
    .click();
  await page.evaluate(() => window.__splash.pause(true));
  const frozen = await page.locator('[role="timer"]').innerText();
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('[role="timer"]').innerText(), frozen);
  await page.evaluate(() => window.__splash.pause(false));
  console.log(
    "ok play: wrong answer, duplicates, success, score, timeout without answer leak, retry, pause",
  );
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(url);
    await page.evaluate(() => window.__splash.sample());
    await page.waitForTimeout(120);
    await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
    const bounds = await page.locator(".splash-stage").boundingBox();
    const buttons = await page.locator(".splash-brick").all();
    for (const b of buttons) {
      const box = await b.boundingBox();
      assert(
        box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width + 1,
      );
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (width === 390) {
      mkdirSync(resolve(root, "node_modules/homework-test-tools/splash-qa"), {
        recursive: true,
      });
      await page.screenshot({
        path: resolve(
          root,
          "node_modules/homework-test-tools/splash-qa/mobile.png",
        ),
        fullPage: true,
      });
    }
    await page.evaluate(() => window.__splash.shift(91000));
    await page.getByText("다시 도전해요!", { exact: true }).waitFor();
  }
  console.log(
    "ok layout: 1440 / 768 / 390, no clipped bricks or horizontal overflow",
  );
  await page.goto(url);
  await page.evaluate(() => window.__splash.sample());
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  for (let round = 0; round < logic.SPLASH_SAMPLES.length; round++) {
    for (const word of logic.sentenceWords(logic.SPLASH_SAMPLES[round])) {
      const target = page
        .getByRole("button", { name: word, exact: true })
        .filter({ visible: true })
        .first();
      await target.focus();
      await page.keyboard.press("Enter");
    }
    await page.getByText("문장 완성!", { exact: true }).waitFor();
    await page
      .getByRole("button", {
        name: round === 6 ? "전체 결과 보기" : "다음 문장",
        exact: true,
      })
      .click();
  }
  assert.match(await page.locator(".splash-modal").innerText(), /7 \/ 7/);
  await page
    .getByRole("button", { name: "게임 종료하기", exact: true })
    .click();
  assert.equal(await page.locator("html").getAttribute("data-exited"), "yes");
  console.log(
    "ok complete game: seven rounds, keyboard input, final score, exit",
  );
  await page.goto(url + "?mode=teacher");
  await page.locator('[data-game="sentencesplash"]').waitFor();
  await page
    .getByRole("button", { name: "설정·저장", exact: true })
    .first()
    .click();
  const settings = page.locator("[data-game-existing-settings]");
  assert.equal(
    await settings.getByLabel(/^문장 \d+$/, { exact: true }).count(),
    7,
  );
  await settings.getByLabel('게임 이름', {exact:true}).fill('합성 첫 저장');
  await settings.getByRole('button', {name:'새 게임으로 저장',exact:true}).click();
  await page.waitForFunction(() => window.__splashWrites.length === 1);
  await page.evaluate(() => { window.__splashWrites = []; });
  await settings
    .getByLabel("문장 1", { exact: true })
    .fill("I like it like this.");
  await settings
    .getByLabel("문장당 제한 시간", { exact: true })
    .selectOption("60");
  await settings
    .getByLabel("여러 문장 붙여넣기 (한 줄에 한 문장)", { exact: true })
    .fill("We play together.\nLook what I found.");
  await settings
    .getByRole("button", { name: "입력한 문장 추가", exact: true })
    .click();
  await settings
    .getByRole("button", { name: "문장 9 위로", exact: true })
    .click();
  await settings
    .getByRole("button", { name: "문장 9 삭제", exact: true })
    .click();
  await page.evaluate(() => (window.__splashFail = true));
  await settings
    .getByRole("button", { name: "미리보기 적용", exact: true })
    .click();
  await settings.getByText(/입력 내용은 유지/).waitFor();
  assert.equal(
    await settings.getByLabel("문장 1", { exact: true }).inputValue(),
    "I like it like this.",
  );
  await page.evaluate(() => (window.__splashFail = false));
  await settings
    .getByRole("button", { name: "미리보기 적용", exact: true })
    .click();
  await settings.getByText(/미리보기에 적용/).waitFor();
  await settings.getByLabel("게임 이름", { exact: true }).fill("합성 Splash");
  await settings
    .getByRole("button", { name: "새 게임으로 저장", exact: true })
    .click();
  await page.waitForFunction(() => window.__splashWrites.length === 1);
  const saved = await page.evaluate(() => window.__splashWrites[0]);
  assert.equal(saved.config.splashSeconds, 60);
  assert.equal(saved.items.length, 8);
  assert.equal(saved.items[0].label, "I like it like this.");
  await page.reload();
  await page.locator('[data-game="sentencesplash"]').waitFor();
  await page
    .getByRole("button", { name: "설정·저장", exact: true })
    .first()
    .click();
  await settings
    .getByLabel("저장한 게임", { exact: true })
    .selectOption(saved.id);
  assert.equal(
    await settings.getByLabel("문장 1", { exact: true }).inputValue(),
    "I like it like this.",
  );
  assert.equal(
    await settings.getByLabel("문장당 제한 시간", { exact: true }).inputValue(),
    "60",
  );
  console.log(
    "ok editor: seven samples, bulk input, order, delete, failed save retry, existing storage and reload",
  );
  await page.goto(url + "?mode=embed&template=" + saved.id);
  await page.locator('[data-game="sentencesplash"]').waitFor();
  assert.equal(
    await page.getByLabel("문장 1", { exact: true }).inputValue(),
    "I like it like this.",
  );
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  await page.getByRole("button", { name: "I", exact: true }).click();
  assert.equal(await page.locator(".splash-filled").count(), 1);
  console.log(
    "ok lesson: registered page renders saved template through the real lesson embed context",
  );
  await page.goto(url + "?mode=student");
  await page.locator('[data-game="sentencesplash"]').waitFor();
  assert.equal(
    await page
      .getByRole("region", { name: "Sentence Splash 편집", exact: true })
      .count(),
    0,
  );
  assert.equal(await page.getByLabel("게임 이름", { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    remote.filter((u) =>
      /openai|anthropic|generativelanguage|supabase/.test(u),
    ),
    [],
  );
  console.log(
    "ok student view: no editing controls; no AI/backend network calls; no browser errors",
  );
  await page.goto(url + '?mode=games');
  await page.getByText('Sentence Splash', { exact: true }).waitFor();
  assert.equal(await page.locator('a[href="/games/sentencesplash"]').count(), 1);
  assert.equal(await page.locator('img[src="/covers/game-sentencesplash.svg"]').count(), 1);
  assert.deepEqual(errors, []);
  console.log('ok catalog: actual game list renders Sentence Splash with its thumbnail and route');
} finally {
  await browser?.close();
  await server.close();
}
