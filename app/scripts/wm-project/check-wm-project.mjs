// 단어 프로젝트(wm-v2) 시안 검증: 합성 시나리오로 학생·교사 화면을 모바일/데스크톱에서 확인하고 캡처한다. 서버를 부르지 않는다.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = fileURLToPath(new URL('../../../output/wm-project/', import.meta.url));
mkdirSync(out, { recursive: true });
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 5329, strictPort: false } });
await server.listen();
const base = `http://127.0.0.1:${server.config.server.port}/scripts/wm-project/prototype.html`;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const sizes = { mobile: { width: 390, height: 800 }, desktop: { width: 1280, height: 860 } };
let count = 0;
const ok = (n) => { count += 1; console.log('ok -', n); };

async function open(size, query) {
  const ctx = await browser.newContext({ viewport: sizes[size], reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}?${query}`);
  return { page, ctx, errors };
}
// 시안 하네스의 안내 줄(시나리오 제목)은 제외하고 실제 화면 영역만 읽는다
const body = async (page) => (await page.locator('main, [data-wmp-approval], [data-wmp-progress]').allInnerTexts()).join(' ');
const noOverflow = async (page, l) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${l}: 가로 넘침`);
const snap = (page, name) => page.screenshot({ path: `${out}${name}.png`, fullPage: false });
const BANNED = ['점수', '정답률', '정확도', 'unseen', 'practicing', '밀렸', '밀린', '결석', '늦었', '지각', '뒤처'];
const clean = (text, l) => BANNED.forEach((w) => assert.ok(!text.includes(w), `${l}: 화면에 '${w}' 표시`));

// ---------- 순수 계산 ----------
{
  const { page, ctx } = await open('desktop', 'view=index');
  const r = await page.evaluate(() => {
    const m = window.__model;
    const sch = (mode, goal, total = 3520, start = '2026-11-07') => m.projectSchedule({ total, mode, start, goal, reviewDays: 14 });
    const bk = (unconfirmed) => m.progressBuckets({ goal_date: '', goal_passed: false, verified: 1, needs_review: 2, unconfirmed, review_due: 5, total: 10, completed: false }).consistent;
    return {
      normal: sch('normal', '2027-12-31'), light: sch('light', '2027-12-31'), plus: sch('plus', '2027-12-31'), tight: sch('plus', '2027-11-07'),
      tooLong: sch('plus', '2037-11-30'), before: sch('plus', '2026-11-01'), short: sch('plus', '2026-11-08', 30),
      sizes: [30, 500, 1000, 3520, 5000].map((t) => m.sectionSizeFor(t)),
      secs: m.rangeSections(3520).map((s) => [s.from, s.to]).filter((_, i, a) => i === 0 || i === a.length - 1),
      grouped: (() => { const secs = Array.from({ length: 71 }, (_, i) => ({ n: i + 1, from: i * 50 + 1, to: Math.min(3520, i * 50 + 50), size: Math.min(50, 3520 - i * 50), met: 10, kept: 5 })); const g = m.groupSections(secs, m.sectionSizeFor(3520)); return { n: g.length, kept: g.reduce((a, x) => a + x.kept, 0), size: g.reduce((a, x) => a + x.size, 0) }; })(),
      good: bk(7), bad: bk(5), add: m.addDays('2026-12-31', 1),
    };
  });
  assert.equal(r.normal.introDays, 704); assert.equal(r.normal.fits, false); assert.equal(r.normal.studyDays, 405, '서버 목표일 = 시작일 + 공부 기간 + 복습 기간'); assert.equal(r.normal.requiredPerDay, 9); assert.equal(r.normal.neededMode, 'plus');
  assert.equal(r.tight.fits, false); assert.equal(r.tight.neededMode, null, '넉넉히로도 안 맞으면 분량 변경 단추 없음');
  assert.equal(r.light.introDays, 1174); assert.equal(r.plus.introDays, 352); assert.equal(r.plus.fits, true);
  assert.equal(r.tooLong.reason, 'too_long'); assert.equal(r.before.reason, 'goal_before_start'); assert.equal(r.short.reason, 'too_short');
  assert.deepEqual(r.sizes, [50, 50, 50, 200, 250]); assert.deepEqual(r.secs, [[1, 200], [3401, 3520]]); assert.deepEqual(r.grouped, { n: 18, kept: 355, size: 3520 });
  assert.equal(r.good, true); assert.equal(r.bad, false); assert.equal(r.add, '2027-01-01');
  ok('계산: 3,520개 소개 일수·목표일 적합·구간 나누기·집계 합계 검사');
  await ctx.close();
}

for (const size of ['mobile', 'desktop']) {
  const stu = async (id, fn) => {
    const { page, ctx, errors } = await open(size, `view=student&s=${id}`);
    await page.waitForSelector('[data-wmp-mode], [data-wmp-run]');
    await fn(page);
    await noOverflow(page, `${id} ${size}`);
    assert.deepEqual(errors, []);
    await ctx.close();
  };

  await stu('first-day', async (p) => {
    const t = await body(p); clean(t, 'first-day');
    assert.equal(await p.locator('[data-wmp-start]').count(), 1, '시작 버튼은 하나');
    assert.equal(await p.locator('[data-wmp-start]').innerText(), '오늘 할 학습 시작');
    assert.equal(await p.locator('[data-wmp-tile]').count(), 1); assert.ok(t.includes('새 단어'));
    assert.ok(t.includes('3,520') && t.includes('예상 일정'));
    await snap(p, `student-first-day-${size}`);
  }); ok(`학생 ${size}: 첫날(새 단어만, 시작 버튼 하나, 3,520개 범위)`);

  await stu('absent-return', async (p) => {
    const t = await body(p); clean(t, 'absent');
    assert.deepEqual(await p.locator('[data-wmp-tile]').evaluateAll((e) => e.map((x) => x.getAttribute('data-wmp-tile'))), ['새 단어', '복습', '다시 확인']);
    assert.ok(t.includes('남은 복습 42개는 다음 날들에 나눠서 해요'));
    assert.ok(t.includes('오늘은 이만큼만 하면 돼요'));
    await snap(p, `student-absent-return-${size}`);
  }); ok(`학생 ${size}: 결석 뒤 — 오늘 분량 16개와 나눠서 할 42개를 구분`);

  await stu('review-only', async (p) => {
    const t = await body(p);
    assert.ok(t.includes('오늘은 복습만 해요')); assert.ok(!t.includes('새 단어'));
    await snap(p, `student-review-only-${size}`);
  }); ok(`학생 ${size}: 복습만 하는 날`);

  await stu('goal-passed', async (p) => {
    const t = await body(p); clean(t, 'goal-passed');
    assert.ok(t.includes('목표일(10월 31일)이 지났어요') && t.includes('남은 단어도 이어서 배워요'));
    assert.equal(await p.locator('[data-wmp-start]').count(), 1);
    await snap(p, `student-goal-passed-${size}`);
  }); ok(`학생 ${size}: 목표일 경과 — 재촉 없이 이어서 배우기`);

  await stu('nothing-today', async (p) => {
    const t = await body(p);
    assert.equal(await p.locator('[data-wmp-start]').count(), 0);
    assert.ok(t.includes('오늘은 할 학습이 없어요') && t.includes('다음 복습은 11월 9일'));
    await snap(p, `student-nothing-today-${size}`);
  }); ok(`학생 ${size}: 오늘 할 분량 없음 + 다음 복습일`);

  await stu('done-today', async (p) => { assert.ok((await body(p)).includes('오늘 학습 끝!')); await snap(p, `student-done-today-${size}`); }); ok(`학생 ${size}: 오늘 학습 끝`);
  await stu('completed', async (p) => {
    const t = await body(p);
    assert.ok(t.includes('프로젝트 완료!') && t.includes('3,520')); assert.equal(await p.locator('[data-wmp-start]').count(), 0);
    await snap(p, `student-completed-${size}`);
  }); ok(`학생 ${size}: 프로젝트 완료`);

  await stu('legacy-v1', async (p) => {
    const t = await body(p);
    assert.ok(!t.includes('내가 익힌 단어') && !t.includes('목표일')); assert.equal(await p.locator('[data-wmp-start]').count(), 1);
    assert.ok(t.includes('새 단어') && t.includes('복습') && t.includes('다시 확인'));
    await snap(p, `student-legacy-v1-${size}`);
  }); ok(`학생 ${size}: 기존 wm-v1 — 프로젝트 요소 없이 기존 방식`);
  await stu('legacy-ended', async (p) => {
    const t = await body(p); assert.ok(t.includes('학습 기간이 끝났어요') && !t.includes('프로젝트 완료'));
  }); ok(`학생 ${size}: 기존 wm-v1 기간 종료는 완료와 구분`);

  // 답 제출 후 새로고침: 서버에 저장된 진행(sessionStorage)으로 이어서 하기
  {
    const { page, ctx, errors } = await open(size, 'view=student&s=refresh');
    await page.locator('[data-wmp-start]').click();
    await page.locator('[data-wmp-answer]').click(); await page.locator('[data-wmp-answer]').click();
    await page.reload();
    await page.waitForSelector('[data-wmp-mode]');
    assert.equal(await page.locator('[data-wmp-start]').innerText(), '이어서 하기');
    assert.equal(await page.locator('[data-wmp-remaining]').innerText(), '12', '14개 중 2개 푼 뒤 12개');
    await snap(page, `student-resume-after-refresh-${size}`);
    await page.locator('[data-wmp-start]').click();
    for (let n = 0; n < 12; n += 1) await page.locator('[data-wmp-answer]').click();
    await page.waitForSelector('[data-wmp-mode="doneToday"]');
    assert.equal(await page.locator('[data-wmp-start]').count(), 0);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  ok(`학생 ${size}: 답 제출 → 새로고침 → 이어서 하기(남은 12개) → 모두 풀면 오늘 끝`);

  // 마지막 단어 확인 → 완료(새로고침 후에도 유지)
  {
    const { page, ctx } = await open(size, 'view=student&s=last-word');
    assert.ok((await body(page)).includes('3,519'));
    await snap(page, `student-last-word-${size}`);
    await page.locator('[data-wmp-start]').click();
    await page.locator('[data-wmp-answer]').click();
    await page.waitForSelector('[data-wmp-mode="completed"]');
    assert.ok((await body(page)).includes('프로젝트 완료!'));
    await page.reload(); await page.waitForSelector('[data-wmp-mode="completed"]');
    await snap(page, `student-last-word-completed-${size}`);
    await ctx.close();
  }
  ok(`학생 ${size}: 마지막 단어 확인 후 완료(새로고침 유지)`);

  // ---------- 교사 승인 ----------
  {
    const { page, ctx, errors } = await open(size, 'view=approval');
    const t = await body(page);
    assert.ok(t.includes('3,520개') && t.includes('200개씩 18구간'));
    await page.getByText('구간 보기').click();
    assert.equal(await page.locator('[data-wmp-sections] li').count(), 18);
    await snap(page, `teacher-approval-warn-${size}`);
    assert.equal(await page.locator('[data-wmp-fits]').getAttribute('data-wmp-fits'), 'false');
    assert.ok((await body(page)).includes('목표일은 예상 일정이에요. 목표일이 지나도 남은 학습은 이어져요.'));
    assert.ok((await body(page)).includes('늘리려면 선생님이 다시 승인해야 해요'));
    await page.waitForTimeout(500);
    assert.ok(await page.getByRole('radio', { name: /보통/ }).isChecked(), '자동으로 하루 분량이 바뀌지 않음');
    await page.locator('[data-wmp-raise]').click();
    assert.ok(await page.getByRole('radio', { name: /넉넉히/ }).isChecked());
    assert.equal(await page.locator('[data-wmp-fits]').getAttribute('data-wmp-fits'), 'true');
    await snap(page, `teacher-approval-fits-${size}`);
    // 잘못된 목표일은 승인을 막는다
    await page.locator('[data-wmp-goal]').fill('2026-11-08');
    assert.equal(await page.locator('[data-wmp-fits]').getAttribute('data-wmp-fits'), 'invalid');
    assert.equal(await page.locator('[data-wmp-approve]').isDisabled(), true);
    await page.locator('[data-wmp-goal]').fill('2027-09-30');
    await page.locator('[data-wmp-approve]').click();
    await page.waitForSelector('[data-wmp-result]');
    assert.ok((await page.locator('[data-wmp-result]').innerText()).includes('3명에게 배정했어요'));
    await snap(page, `teacher-approval-done-${size}`);
    await noOverflow(page, `approval ${size}`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  ok(`교사 ${size}: 승인 — 3,520개 구간, 목표일 경고, 자동 변경 없음, 교사가 눌러 분량 변경, 잘못된 목표일 차단`);

  {
    const { page, ctx } = await open(size, 'view=approval&fail=1');
    await page.locator('[data-wmp-approve]').click();
    await page.waitForSelector('[data-wmp-error]');
    await snap(page, `teacher-approval-retry-${size}`);
    await page.locator('[data-wmp-approve]').click();
    await page.waitForSelector('[data-wmp-result]');
    assert.ok((await page.locator('[data-wmp-result]').innerText()).includes('중복으로 만들지 않았어요'));
    const a = await page.evaluate(() => window.__approvals);
    assert.equal(a.calls, 2); assert.equal(a.created, 3); assert.equal(new Set(a.ids).size, 1, '재시도는 같은 요청 번호');
    await ctx.close();
  }
  ok(`교사 ${size}: 응답 유실 뒤 재시도 — 같은 요청 번호, 중복 배정 없음`);

  // ---------- 교사 진행 ----------
  {
    const { page, ctx, errors } = await open(size, 'view=progress');
    const rows = page.locator('[data-wmp-row]');
    assert.equal(await rows.count(), 6);
    assert.deepEqual(await rows.evaluateAll((e) => e.map((x) => x.getAttribute('data-wmp-kind'))), ['project', 'project', 'project', 'project', 'project', 'legacy']);
    const t = await body(page); clean(t, 'progress');
    assert.ok(t.includes('1,480') && t.includes('3,520') && t.includes('오늘 복습 대기') && t.includes('오답 후 다시 확인') && t.includes('아직 확인 부족'));
    assert.ok(t.includes('목표일(10월 31일) 지남 · 학습은 이어져요')); assert.ok(t.includes('기존 방식(wm-v1)'));
    assert.equal(await page.locator('[data-wmp-inconsistent]').count(), 0, '집계 합계 일치');
    await snap(page, `teacher-progress-${size}`);
    await page.locator('[data-wmp-row="s2"] button', { hasText: '구간별로 보기' }).click();
    assert.equal(await page.locator('[data-wmp-sections="s2"] li').count(), 18);
    await snap(page, `teacher-progress-sections-${size}`);
    // 하루 분량 조정은 기존 '다음 단계 카드'로 안내하고, pace.on_track 만으로 늘리기 버튼을 띄우지 않는다
    assert.equal(await page.locator('[data-wmp-suggest], [data-wmp-raise-ok]').count(), 0);
    assert.ok(t.includes('다음 단계 카드'));
    assert.ok(t.includes('하루 분량 보통'));
    await page.locator('[data-wmp-next-steps]').click();
    assert.deepEqual(await page.evaluate(() => window.__decisions), ['next-steps']);
    await noOverflow(page, `progress ${size}`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  ok(`교사 ${size}: 진행 — 분류·구간·목표일 지남·기존 wm-v1 행·늘리기 버튼 없이 다음 단계 안내`);
}

await browser.close(); await server.close();
console.log(`\n${count}개 확인 통과 · 캡처: ${out}`);
