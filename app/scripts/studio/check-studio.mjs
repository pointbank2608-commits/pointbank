// 학습 스튜디오(단어 숙제 · 문법 학습) 화면 검증: 합성 데이터 하네스(studio-compare)를 열어 모바일/데스크톱을 캡처하고 흐름을 확인한다.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = process.env.STUDIO_TEST_OUTPUT
  ? resolve(process.env.STUDIO_TEST_OUTPUT) + sep
  : fileURLToPath(new URL('../../../output/studio/', import.meta.url));
mkdirSync(out, { recursive: true });
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 5319, strictPort: false } });
await server.listen();
const base = `http://127.0.0.1:${server.config.server.port}/scripts/studio/studio-compare.html`;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
const ok = (name) => { results.push(name); console.log('ok -', name); };
const sizes = { mobile: { width: 390, height: 700 }, desktop: { width: 1280, height: 860 } };

async function open(size, v) {
  const ctx = await browser.newContext({ viewport: sizes[size], reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}?v=${v}`);
  return { page, ctx, errors };
}
const noOverflow = async (page, label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: 가로 넘침`);
const tops = (page) => page.$$eval('[data-choice]', (els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
const shot = (page, name) => page.screenshot({ path: `${out}${name}.png`, fullPage: true });

// 하단 고정 버튼이 화면 안에 있고, 맨 아래로 스크롤하면 피드백 마지막 줄이 버튼에 가려지지 않는지
async function checkBar(page, label, buttonName, name) {
  const btn = page.getByRole('button', { name: buttonName });
  assert.equal(await btn.evaluate((e) => getComputedStyle(e.closest('.fixed')).position), 'fixed', `${label}: 버튼 줄 고정`);
  const vh = page.viewportSize().height;
  const box = await btn.boundingBox();
  assert.ok(box.y + box.height <= vh + 1 && box.y >= vh / 2, `${label}: 버튼이 화면 아래에 보임`);
  await page.screenshot({ path: `${out}${name}.png` }); // 채점 직후 학생이 보는 화면
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}${name}-bottom.png` }); // 맨 아래까지 읽은 화면
  const gap = await page.evaluate(() => {
    const last = document.querySelector('[role="status"]');
    const bar = document.querySelector('.fixed.bottom-0');
    return Math.round(bar.getBoundingClientRect().top - last.getBoundingClientRect().bottom);
  });
  assert.ok(gap >= 0, `${label}: 피드백 마지막 줄이 하단 버튼에 가려짐(${gap}px)`);
  await page.evaluate(() => window.scrollTo(0, 0));
}
const feedbackInView = (page) => page.evaluate(() => {
  const r = document.querySelector('[role="status"]').getBoundingClientRect();
  return r.top >= 0 && r.top < window.innerHeight;
});

for (const size of ['mobile', 'desktop']) {
  // ---------- 단어 ----------
  let { page, ctx, errors } = await open(size, 'word');
  await page.waitForSelector('[data-choice]');
  assert.equal(await page.getByText('뜻을 골라요').count(), 1, '지시문은 한 번만');
  assert.equal(await page.locator('main img').count(), 0, '뜻 고르기: 채점 전에는 사전 그림을 숨김');
  const t0 = await tops(page);
  if (size === 'desktop') { assert.equal(t0[0], t0[1], '데스크톱은 2×2'); assert.ok(t0[2] > t0[0]); } else assert.ok(t0[1] > t0[0], '모바일은 한 줄씩');
  const cardTop = await page.locator('main section').evaluate((e) => Math.round(e.getBoundingClientRect().top));
  assert.ok(cardTop < 130, `카드가 위쪽 가까이에서 시작(${cardTop}px)`);
  assert.ok(!(await page.locator('body').innerText()).includes('아쉬워요'));
  await noOverflow(page, `word ${size}`);
  await page.screenshot({ path: `${out}word-${size}-1-before.png` });
  ok(`word ${size}: 풀기 전(그림 숨김, 지시문 1회, 보기 배치, 위쪽 여백)`);
  await page.locator('[data-choice="0"]').click();
  await page.getByText('정답은').waitFor();
  assert.ok((await page.locator('body').innerText()).includes('정답은 고양이'));
  assert.equal(await page.locator('[data-choice="1"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('main img').count(), 1, '채점 뒤에 사전 그림 표시');
  assert.equal(await page.locator('main img').getAttribute('src'), '/phonics-images/cat.webp');
  await page.waitForFunction(() => document.querySelector('main img')?.naturalWidth > 0);
  assert.ok(await feedbackInView(page));
  if (size === 'mobile') {
    const visible = await page.evaluate(() => {
      const word = document.querySelector('main [lang="en"]').getBoundingClientRect();
      const header = document.querySelector('header.sticky').getBoundingClientRect();
      const image = document.querySelector('main img').getBoundingClientRect();
      const actionBar = document.querySelector('[data-studio-action-bar]').getBoundingClientRect();
      return word.top >= header.bottom && image.bottom <= actionBar.top;
    });
    assert.ok(visible, 'mobile: 채점 후 단어와 그림 전체가 고정 바 사이에 보임');
  }
  await checkBar(page, `word ${size}`, '다음', `word-${size}-2-feedback-wrong`);
  ok(`word ${size}: 오답 피드백(고른 답·정답 대조, 그림은 채점 뒤, 하단 고정 버튼)`);
  await page.waitForTimeout(2500);
  assert.equal(await page.getByRole('button', { name: '다음' }).count(), 1, '자동으로 넘어가지 않음(오답)');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByText('dog', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '다음' }).count(), 0, '다음 문제는 하단 버튼 없음');
  await page.keyboard.press('1'); // 키보드: 1번 = 개(정답)
  await page.getByText('정답!').waitFor();
  await page.waitForTimeout(2500);
  assert.equal(await page.getByRole('button', { name: '다음' }).count(), 1, '정답이어도 자동으로 넘어가지 않음');
  await page.screenshot({ path: `${out}word-${size}-3-feedback-correct.png` });
  await page.getByRole('button', { name: '다음' }).click();
  await page.waitForSelector('.hwmole', { timeout: 5000 });
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('div')].some((d) => getComputedStyle(d).backgroundColor === 'rgb(22, 33, 62)')), '게임 모양 문제는 예전 어두운 화면 유지');
  await shot(page, `word-${size}-4-game-style-unchanged`);
  ok(`word ${size}: 정답도 자동 넘김 없음 → 다음 누르면 이동, 게임 모양 문제는 기존 화면`);
  assert.deepEqual(errors, []);
  await ctx.close();

  // ---------- 문법 ----------
  for (const v of ['grammar-short', 'grammar-long']) {
    ({ page, ctx, errors } = await open(size, v));
    await page.waitForSelector('[data-choice]');
    const body = await page.locator('body').innerText();
    assert.ok(!body.includes('원형이에요. 지난') && !body.includes('다시 살펴봐요'), '제출 전 설명 없음');
    const t = await tops(page);
    if (v === 'grammar-short' && size === 'desktop') assert.equal(t[0], t[1], '짧은 보기 2×2');
    else assert.ok(t[1] > t[0], `${v} ${size}: 한 줄씩`);
    await noOverflow(page, `${v} ${size}`);
    await page.screenshot({ path: `${out}${v}-${size}-1-before.png` });
    ok(`${v} ${size}: 풀기 전`);
    const wrongIdx = v === 'grammar-short' ? 1 : 0; // went
    await page.locator(`[data-choice="${wrongIdx}"]`).click();
    await page.getByText('이 부분을 다시 살펴봐요').waitFor();
    assert.equal(await page.locator('[data-choice]').count(), 1);
    assert.ok((await page.locator('body').innerText()).includes('내가 고른 이유'));
    assert.ok(await feedbackInView(page), '피드백이 읽기 시작할 위치로 이동');
    await checkBar(page, `${v} ${size}`, '계속하기', `${v}-${size}-2-feedback-wrong`);
    ok(`${v} ${size}: 오답 피드백(고른 이유 + 설명, 마지막 줄까지 읽힘, 하단 고정 버튼)`);
    await page.getByRole('button', { name: '계속하기' }).click();
    await page.getByText('오늘 학습 완료').waitFor();
    assert.ok(/\d+월 \d+일/.test(await page.locator('body').innerText()), '다음 확인 시각');
    await page.getByRole('button', { name: '복습이 열렸는지 확인' }).click();
    await page.getByText('아직 복습 시간이 아니에요').waitFor();
    await noOverflow(page, `${v} wait ${size}`);
    await shot(page, `${v}-${size}-3-waiting`);
    ok(`${v} ${size}: 복습 대기(오늘 학습 완료 + 다음 확인 시각)`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  ({ page, ctx, errors } = await open(size, 'grammar-long'));
  await page.waitForSelector('[data-choice]');
  await page.locator('[data-choice="1"]').click();
  await page.getByText('이렇게 판단하면 돼요').waitFor();
  await checkBar(page, `grammar correct ${size}`, '계속하기', `grammar-long-${size}-2b-feedback-correct`);
  ok(`grammar-long ${size}: 정답 피드백`);
  await ctx.close();
  ({ page, ctx } = await open(size, 'grammar-explain'));
  await page.getByText('Did you go home?').waitFor();
  await noOverflow(page, `explain ${size}`);
  await shot(page, `grammar-explain-${size}`);
  ok(`grammar-explain ${size}: 예문·문장 덩어리`);
  await ctx.close();
  ({ page, ctx } = await open(size, 'grammar-done'));
  await page.getByText('잘했어요!').waitFor();
  await shot(page, `grammar-done-${size}`);
  ok(`grammar-done ${size}: 완료`);
  await ctx.close();
}
await browser.close();
await server.close();
console.log(`\n${results.length}개 확인 통과 · 캡처: ${out}`);
