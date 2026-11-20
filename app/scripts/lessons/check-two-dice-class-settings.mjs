import assert from 'node:assert/strict';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { createLessonUxServer } from './ux-server.mjs';

const server = await createLessonUxServer(5582);
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('classbank.selectedClassId', 'a');
    localStorage.setItem('classbank.startCheck.skip', '1');
    Element.prototype.requestFullscreen = async () => {};
  });
  const home = 'http://127.0.0.1:5582/curriculum';
  await page.goto(home);
  await page.waitForFunction(() => window.__lessonQA);
  await page.evaluate(() => {
    const db = window.__lessonQA;
    db.students = { a: ['하늘', '바다', '결석 학생'].map((name, index) => ({ id: `dice-student-${index}`, name })) };
    db.templates.push({ id: 'legacy-dice', academy_id: 'academy', class_id: 'a', game_type: 'twodice', name: '기존 주사위',
      items: db.lists[0].items.map(item => ({ id: item.id, label: item.word })), config: { twoDiceTeams: 2, twoDiceSize: 6 } });
    db.lessons.find(lesson => lesson.id === 'lesson-a').playlist = [{ id: 'dice-slide', kind: 'game', gameType: 'twodice', templateId: 'legacy-dice' }];
    window.__saveLessonQA();
  });
  await page.reload();
  const lesson = page.locator('#lesson-card-lesson-a');
  const form = page.locator('[data-lesson-edit-form]');
  const toolbar = page.locator('[data-game-toolbar]');
  const classPanel = page.locator('[data-game-toolbar-panel="class"]');
  const orderDialog = page.getByRole('dialog', { name: '팀 나누기 · 순서 정하기', exact: true });
  const scoreboard = page.locator('.td-scoreboard');
  const openClass = () => toolbar.getByRole('button', { name: '반 설정', exact: true }).click();
  const applyClass = async () => {
    await classPanel.getByRole('button', { name: '적용', exact: true }).click();
    await classPanel.waitFor({ state: 'hidden' });
  };
  const openOrder = () => classPanel.getByRole('button', { name: '팀·순서 정하기 (반 명단)', exact: true }).click();
  const current = () => scoreboard.locator('[data-turn-current]').textContent();

  await lesson.getByRole('button', { name: '수정', exact: true }).click();
  await form.locator('[data-slide-id="dice-slide"]').click();
  await openClass();
  for (const name of ['없음', '개인', '팀']) assert(await classPanel.getByRole('button', { name, exact: true }).isVisible());
  await classPanel.getByRole('checkbox', { name: '한 판이 끝나면 자동으로 다음 차례로 넘기기', exact: true }).check();
  await classPanel.getByRole('button', { name: /^결석 학생 제외/ }).click();
  await classPanel.getByRole('checkbox', { name: '결석 학생', exact: true }).check();
  await openOrder();
  await orderDialog.getByRole('textbox', { name: '1팀 이름', exact: true }).fill('해팀');
  await orderDialog.getByRole('textbox', { name: '2팀 이름', exact: true }).fill('달팀');
  await orderDialog.getByRole('button', { name: '위로 이동', exact: true }).nth(1).click();
  await orderDialog.getByRole('button', { name: '적용', exact: true }).click();
  await applyClass();
  await scoreboard.getByText('달팀 차례', { exact: true }).waitFor();
  assert.equal(await toolbar.locator('[data-turn-bar]').count(), 0);

  await openClass();
  await openOrder();
  const names = await orderDialog.getByRole('button', { name: '여기서 시작', exact: true }).evaluateAll(buttons => buttons.map(button => button.parentElement.textContent));
  assert(names[0].includes('달팀'));
  assert(!await orderDialog.getByText('결석 학생', { exact: true }).count());
  await orderDialog.getByRole('button', { name: '적용', exact: true }).click();
  await applyClass();
  await form.getByRole('button', { name: '저장', exact: true }).click();
  await form.waitFor({ state: 'hidden' });
  await page.reload();
  await lesson.getByRole('button', { name: '수업 시작', exact: true }).click();
  await page.waitForURL(/\/games\/twodice/);
  await scoreboard.getByText('달팀 차례', { exact: true }).waitFor();
  await page.getByRole('button', { name: '주사위 굴리기', exact: true }).click();
  await scoreboard.getByText('해팀 차례', { exact: true }).waitFor();
  assert.equal(await page.locator('.td-score').count(), 2);
  console.log('PASS legacy two-dice class settings, absence filter, named/reordered teams, save/reload and presentation turns');

  await page.goto(home);
  await lesson.getByRole('button', { name: '수정', exact: true }).click();
  await openClass();
  await classPanel.getByRole('button', { name: '개인', exact: true }).click();
  await applyClass();
  const strip = toolbar.locator('[data-turn-bar]');
  await strip.getByText('하늘', { exact: true }).waitFor();
  await form.locator('[data-game-start-card]').getByRole('button', { name: '게임 시작', exact: true }).click();
  await page.getByRole('button', { name: '주사위 굴리기', exact: true }).click();
  await strip.locator('p').first().getByText('바다', { exact: true }).waitFor();

  await openClass();
  await classPanel.getByRole('button', { name: '팀', exact: true }).click();
  await classPanel.getByRole('button', { name: '팀 하나 늘리기', exact: true }).click();
  await classPanel.getByRole('checkbox', { name: '한 판이 끝나면 자동으로 다음 차례로 넘기기', exact: true }).uncheck();
  await applyClass();
  assert.equal(await page.locator('.td-score').count(), 3);
  await form.locator('[data-game-start-card]').getByRole('button', { name: '게임 시작', exact: true }).click();
  const previous = await current();
  await page.getByRole('button', { name: '주사위 굴리기', exact: true }).click();
  await page.locator('.td-reading-word').getByText('—', { exact: true }).waitFor({ state: 'hidden' });
  assert.equal(await current(), previous);
  await scoreboard.getByRole('button', { name: '다음 차례', exact: true }).click();
  assert.notEqual(await current(), previous);
  await openClass();
  await classPanel.getByRole('button', { name: '없음', exact: true }).click();
  await applyClass();
  assert.equal(await toolbar.locator('[data-turn-bar]').count(), 0);
  assert.equal(await page.locator('.td-score').count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS individual auto turns, three teams, manual team turns and no-participation practice');
} finally {
  await browser?.close();
  await server.close();
}
