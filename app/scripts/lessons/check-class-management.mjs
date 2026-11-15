import assert from 'node:assert/strict';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { createLessonUxServer } from './ux-server.mjs';

const port = 5556;
const server = await createLessonUxServer(port);
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('classbank.selectedClassId', 'a'));
  const origin = `http://127.0.0.1:${port}`;
  await page.goto(origin + '/curriculum');
  const all = page.getByRole('button', { name: '전체 반', exact: true });
  const first = page.getByText('기존 리딩 수업', { exact: true });
  const other = page.getByText('다른 반 수업', { exact: true });
  const shared = page.getByText('모든 반 공용 수업', { exact: true });
  const classA = page.getByRole('button', { name: '3:30 리딩', exact: true });
  await first.waitFor();
  await shared.waitFor();
  assert.equal(await other.count(), 0);
  await all.click();
  await other.waitFor();
  await first.waitFor();
  await shared.waitFor();
  assert.equal(await all.getAttribute('aria-pressed'), 'true');
  const otherCard = page.locator('#lesson-card-lesson-b');
  await otherCard.getByText('단어장 없는 반', { exact: true }).waitFor();
  assert.notEqual(await classA.getAttribute('aria-pressed'), 'true');
  await otherCard.getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.locator('[data-lesson-edit-form]');
  await editor.getByText('저장 대상 반: 단어장 없는 반', { exact: true }).waitFor({ state: 'attached' });
  assert.equal(await editor.locator('option[value="words-c"]').count(), 0);
  await editor.locator('input[type="text"]').first().fill('다른 반 수업 수정');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  assert.deepEqual(await page.evaluate(() => {
    const edited = window.__lessonQA.lessons.find(row => row.id === 'lesson-b');
    return [edited.name, edited.class_id];
  }), ['다른 반 수업 수정', 'b']);
  await classA.click();
  await otherCard.waitFor({ state: 'hidden' });
  await first.waitFor();
  assert.equal(await classA.getAttribute('aria-pressed'), 'true');

  const completedLoads = await page.evaluate(() => {
    window.__lessonQA.delays.all = 650;
    return window.__lessonQA.allLessonLoads;
  });
  await all.click();
  await page.getByRole('button', { name: '단어장 없는 반', exact: true }).click();
  await otherCard.waitFor();
  await shared.waitFor();
  await page.waitForFunction(previous => window.__lessonQA.allLessonLoads > previous, completedLoads);
  assert.equal(await first.count(), 0);
  assert.equal(await all.getAttribute('aria-pressed'), 'false');

  await page.goto(origin + '/board');
  const manage = page.getByRole('button', { name: '반 관리', exact: true });
  const dialog = page.getByRole('dialog', { name: '반 관리' });
  const remove = dialog.getByRole('button', { name: '삭제', exact: true });
  const choose = () => dialog.getByRole('button', { name: '3:30 리딩', exact: true }).click();
  const deleteCalls = () => page.evaluate(() => window.__lessonQA.calls.filter(call => call.name === 'deleteClass').map(call => call.args[0]));
  await manage.click();
  assert.equal(await remove.count(), 0);
  await choose();
  await dialog.getByText(/3:30 리딩.*소속 학생/).waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(await deleteCalls(), []);

  await manage.click();
  await choose();
  await page.evaluate(() => { window.__lessonQA.failDeleteClass = true; });
  await remove.click();
  await dialog.getByRole('alert').getByText(/반을 삭제하지 못했어요/).waitFor();
  assert.deepEqual(await deleteCalls(), ['a']);
  await page.evaluate(() => { window.__lessonQA.failDeleteClass = false; });
  await remove.click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText('반을 삭제했습니다.', { exact: true }).waitFor();
  await page.getByRole('button', { name: '단어장 없는 반', exact: true }).waitFor();
  assert.equal(await classA.count(), 0);
  assert.deepEqual(await deleteCalls(), ['a', 'a']);
  assert.deepEqual(await page.evaluate(() => window.__lessonQA.classes.map(row => row.id)), ['b', 'c']);
  assert.deepEqual(errors, []);
  console.log('Passed: all-class filtering, class switching, scoped deletion confirmation, failure recovery and board refresh');
} finally {
  await browser?.close();
  await server.close();
}
