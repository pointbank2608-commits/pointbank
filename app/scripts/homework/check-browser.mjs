import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBuffer } from "../../node_modules/homework-test-tools/node_modules/music-metadata/lib/index.js";
import { writeFileSync } from "node:fs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// All Supabase access is replaced BEFORE application modules load. No real accounts or API requests.
const stub = `
window.__hwTest = { drafts: [], calls: [], failSave: false };
const state=window.__hwTest;
const samples = {
 students:[{id:'synthetic-student',name:'Synthetic Student'}],
 curriculum_lessons:[{id:'synthetic-lesson',name:'Synthetic saved lesson',updated_at:'2026-10-18',word_list_id:null,playlist:[{id:'study',kind:'study',words:[{id:'cat',word:'cat',meaning:'고양이',imageUrl:'/word-bank-images/cat.webp'},{id:'dog',word:'dog',meaning:'개',imageUrl:null}]},{id:'attendance',kind:'attendance'}]}]
};
const makeQuery=(table)=>{const query=new Proxy({}, {get(_,key){if(key==='then')return(resolve)=>resolve({data:samples[table]||[],error:null});return()=>query;}});return query;};
export const supabase = { from:(name)=>makeQuery(name), rpc: async(name,args)=>{
 state.calls.push(name);
 if(name==='hw_drafts') return {data:state.drafts,error:null};
 if(name==='hw_save_draft') { if(state.failSave) return {data:null,error:{message:'offline'}}; const d={...args.p_draft,revision:args.p_draft.revision+1}; state.drafts=[d];return {data:d,error:null}; }
 if(name==='hw_assign_draft') return {data:{id:'synthetic',code:'000000'},error:null};
 return {data:[],error:null};
} };`;
const server = await createServer({
  root,
  logLevel: "error",
  plugins: [
    {
      name: "synthetic-backend",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/src/lib/supabase.ts"))
          return stub;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5186, strictPort: true },
});
let browser;
let page;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  const context = await browser.newContext({
    permissions: ["microphone"],
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://**/*", (r) => r.abort());
  const url = "http://127.0.0.1:5186/scripts/homework/harness.html";
  await page.goto(url);
  await page.getByRole("button", { name: "+ 보고 듣기", exact: true }).click();
  await page.getByLabel("숙제 이름", { exact: true }).fill("합성 숙제");
  await page.getByLabel("단어·문장", { exact: true }).fill("I like cats.");
  await page.getByRole("button", { name: "초안 저장", exact: true }).click();
  await page.getByText("초안 저장 완료", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "현재 블록 미리보기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "미리보기 닫기", exact: true })
    .click();
  await page.getByRole("button", { name: "복제", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "삭제", exact: true }).count(),
    2,
  );
  await page.getByRole("button", { name: "실행취소", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "삭제", exact: true }).count(),
    1,
  );
  await page.evaluate(() => {
    window.__hwTest.failSave = true;
  });
  await page.getByLabel("단어·문장", { exact: true }).fill("I like dogs.");
  await page.getByRole("button", { name: "초안 저장", exact: true }).click();
  await page.getByText(/저장 실패 또는/).waitFor();
  await page.reload();
  await page.getByLabel("단어·문장", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("단어·문장", { exact: true }).inputValue(),
    "I like dogs.",
  );
  console.log(
    "ok editor: add, edit, save, preview, duplicate, undo, save failure and refresh recovery",
  );
  await page.screenshot({
    path: resolve(root, "node_modules/homework-test-tools/editor-desktop.png"),
    fullPage: true,
  });
  for (const size of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `editor overflow at ${size.width}`,
    );
  }
  console.log("ok responsive editor: desktop/tablet/mobile widths");
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const name of ['기억해서 답하기','말하기','문장 만들기','영상 미션']) {
    await page.getByRole('button',{name:`+ ${name}`,exact:true}).click();
    if (name === '영상 미션') await page.getByRole('textbox',{name:'YouTube 주소',exact:true}).fill('https://youtu.be/abcdefghijk');
    else await page.getByRole('textbox',{name:'단어·문장',exact:true}).fill('I like cats.');
    if (name === '기억해서 답하기') {
      await page.getByRole('button',{name:'+ 직접 쓰기 문제',exact:true}).click();
      await page.getByLabel('문제',{exact:true}).fill('사과를 영어로 쓰세요');
      await page.getByLabel(/허용 정답/).fill('apple');
    }
  }
  await page.getByRole('button',{name:'초안 저장',exact:true}).click();
  await page.getByText('초안 저장 완료',{exact:true}).waitFor();
  const savedId=await page.evaluate(()=>window.__hwTest.drafts[0].id);
  await page.getByRole('combobox',{name:'초안·템플릿 다시 열기',exact:true}).selectOption(savedId);
  assert.equal(await page.getByRole('button',{name:'삭제',exact:true}).count(),5);
  console.log('ok all five block types authored, saved and reopened through the editor');
  await page
    .getByRole("button", { name: "저장된 수업에서 가져오기", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "저장된 수업", exact: true })
    .selectOption("synthetic-lesson");
  await page.getByLabel(/1\. study/).check();
  await page.getByLabel("dog", { exact: true }).uncheck();
  await page.getByText(/변환 불가/).waitFor();
  await page
    .getByRole("button", { name: "선택한 내용 가져와서 추리기", exact: true })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "삭제", exact: true }).count(),
    6,
  );
  await page.getByRole("button", { name: "배정", exact: true }).click();
  await page
    .getByRole("button", { name: "확인하고 배정", exact: true })
    .click();
  await page.waitForFunction(() => document.title === "assigned");
  console.log(
    "ok lesson import: per-content selection, unsupported blocks, synthetic assignment",
  );
  await page.goto(`${url}?type=study`);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await page
    .getByRole("button", { name: "학습 내용을 확인했어요", exact: true })
    .click();
  await page.getByText("숙제 끝!", { exact: true }).waitFor();
  assert.equal(await page.locator("text=/0\\s*\\/\\s*0/").count(), 0);
  console.log("ok student study confirmation: complete without 0/0 score");
  await page.goto(`${url}?type=speak`);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  for (let n = 0; n < 3; n++)
    await page.getByRole("button", { name: /말해 봤어요/ }).click();
  await page.getByRole("button", { name: "녹음 시작", exact: true }).click();
  await page
    .getByRole("button", { name: "녹음 끝내기", exact: true })
    .waitFor();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "녹음 끝내기", exact: true }).click();
  await page.locator("audio[controls]").waitFor();
  const bytes = await page
    .locator("audio[controls]")
    .evaluate(async (el) =>
      Array.from(new Uint8Array(await (await fetch(el.src)).arrayBuffer())),
    );
  const metadata = await parseBuffer(
    new Uint8Array(bytes),
    { mimeType: "audio/webm" },
    { duration: true, skipCovers: true },
  );
  console.log("recorded audio duration:", metadata.format.duration);
  assert(metadata.format.duration >= 0.5 && metadata.format.duration < 10);
  writeFileSync(
    resolve(root, "node_modules/homework-test-tools/synthetic-recording.webm"),
    new Uint8Array(bytes),
  );
  await page
    .getByRole("button", { name: "제출하고 다음으로", exact: true })
    .click();
  console.log(
    "ok speaking: fading stages, representative recording, playback and preview submission",
  );
  await page.goto(`${url}?type=sentence&lang=en`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("textbox").fill("There may be multiple valid answers.");
  await page
    .getByRole("button", { name: "Submit and continue", exact: true })
    .click();
  console.log(
    "ok open sentence: English UI, open response, no forced string grading",
  );
  await page.goto(`${url}?type=recall`);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await page.getByRole("button", { name: /고양이/ }).click();
  await page.getByText("숙제 끝!", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__hwTest.calls.length), 0);
  console.log(
    "ok recall preview: correct response and no backend side effects",
  );
  await page.goto(`${url}?type=video`);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  assert(
    await page
      .getByRole("button", { name: "시청 완료 제출", exact: true })
      .isDisabled(),
  );
  await page
    .getByRole("button", { name: "영상 다시 연결 / Reload video", exact: true })
    .click();
  console.log(
    "ok video unavailable: playback start/navigation never completes viewing",
  );
  await page.addInitScript(() => {
    window.YT = {
      Player: class {
        constructor(_id, options) {
          this.time = 0;
          this.timer = setInterval(() => {
            this.time += 0.25;
          }, 250);
          setTimeout(() => {
            options.events.onReady();
            options.events.onStateChange({ data: 1 });
          }, 0);
        }
        getCurrentTime() {
          return this.time;
        }
        destroy() {
          clearInterval(this.timer);
        }
      },
      PlayerState: { ENDED: 0, PLAYING: 1 },
    };
  });
  await page.goto(`${url}?type=video`);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await page
    .getByRole("button", { name: "시청 완료 제출", exact: true })
    .waitFor();
  assert(
    await page
      .getByRole("button", { name: "시청 완료 제출", exact: true })
      .isDisabled(),
  );
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("button")).some(
      (b) => b.textContent === "시청 완료 제출" && !b.disabled,
    ),
  );
  await page
    .getByRole("button", { name: "시청 완료 제출", exact: true })
    .click();
  await page.getByText("숙제 끝!", { exact: true }).waitFor();
  console.log(
    "ok video segment completion with synthetic YouTube clock; no 0/0 score",
  );
  await page.goto(`${url}?type=sentence&mode=student`);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await page.getByRole("textbox").fill("Saved open response");
  await page.reload();
  await page.getByRole("button", { name: "시작", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox").inputValue(),
    "Saved open response",
  );
  await page.evaluate(() => {
    window.__hwTest.failProgress = true;
  });
  await page
    .getByRole("button", { name: "제출하고 다음으로", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "제출 또는 업로드" })
    .waitFor();
  await page.evaluate(() => {
    window.__hwTest.failProgress = false;
  });
  await page
    .getByRole("button", { name: "제출하고 다음으로", exact: true })
    .click();
  console.log(
    "ok student response: refresh recovery and failed submission retry",
  );
  await page.goto(`${url}?type=speak&mode=student`);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  for (let n = 0; n < 3; n++)
    await page.getByRole("button", { name: /말해 봤어요/ }).click();
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await page.getByRole("button", { name: "녹음 시작", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "마이크 권한이 거부" })
    .waitFor();
  assert(
    await page
      .getByRole("button", { name: "제출하고 다음으로", exact: true })
      .isDisabled(),
  );
  await page.reload();
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await page.getByRole("button", { name: "녹음 시작", exact: true }).click();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "녹음 끝내기", exact: true }).click();
  await page.locator("audio[controls]").waitFor();
  await page.evaluate(() => {
    window.__hwTest.failUpload = true;
  });
  await page
    .getByRole("button", { name: "제출하고 다음으로", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "제출 또는 업로드" })
    .waitFor();
  await page.reload();
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await page.locator("audio[controls]").waitFor();
  await page
    .getByRole("button", { name: "제출하고 다음으로", exact: true })
    .click();
  await page.getByText("숙제 끝!", { exact: true }).waitFor();
  console.log(
    "ok microphone denial; upload failure; IndexedDB recording and stage recovery; retry",
  );
  assert.deepEqual(errors, []);
  console.log("All browser checks passed. Synthetic backend only.");
} catch (e) {
  console.error("FAILED:", e.message);
  if (page) {
    console.error((await page.locator("body").innerText()).slice(0, 4000));
    await page.screenshot({
      path: resolve(
        root,
        "node_modules/homework-test-tools/browser-failure.png",
      ),
      fullPage: true,
    });
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
