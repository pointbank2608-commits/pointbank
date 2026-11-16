import assert from 'node:assert/strict';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { createLessonUxServer } from './ux-server.mjs';

const server = await createLessonUxServer(5418);
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => localStorage.setItem('classbank.selectedClassId', 'a'));
  page.setDefaultTimeout(12000);

  await page.goto('http://127.0.0.1:5418/curriculum');
  const lessonCard = page.locator('#lesson-card-lesson-a');
  const edit = () => lessonCard.getByRole('button', { name: '수정', exact: true }).click();
  await edit();
  const form = page.locator('[data-lesson-edit-form]');
  const detail = form.locator('[data-lesson-slide-detail]');
  const picker = page.locator('.lesson-activity-picker');
  await form.getByRole('button', { name: '활동 추가', exact: false }).click();
  await picker.locator('nav').getByRole('button', { name: '활동지', exact: true }).click();
  const cardMain = picker.locator('[data-activity-id="print.cvcworkbook"]');
  const preview = picker.locator('.activity-expanded');
  const add = preview.getByRole('button', { name: '이 활동지 추가', exact: true });
  const unit = scope => scope.getByRole('group', { name: '워크북 유닛' }).getByRole('button', { name: /^2\. / });

  await cardMain.locator('..').getByRole('button', { name: /미리보기/ }).click();
  assert.equal(await add.isDisabled(), true);
  await preview.getByRole('button', { name: /활동 목록으로/ }).click();
  await cardMain.click();
  await unit(preview).click();
  assert.equal(await unit(preview).getAttribute('aria-pressed'), 'true');
  assert.match(await preview.locator('.print-board').first().innerText(), /UNIT 2\./i);
  await preview.getByRole('button', { name: '다음 쪽', exact: true }).click();
  await preview.getByText('2 / 2', { exact: true }).waitFor();
  await add.click();
  await picker.waitFor({ state: 'hidden' });
  assert.equal(await form.locator('[data-slide-id]').count(), 2);
  assert.match(await detail.locator('.print-board').first().innerText(), /UNIT 2\./i);
  await form.getByRole('button', { name: '저장', exact: true }).click();
  await form.waitFor({ state: 'hidden' });

  const saved = await page.evaluate(() => window.__lessonQA.lessons.find(row => row.id === 'lesson-a').playlist);
  assert.deepEqual(saved.map(slide => slide.kind), ['canvas', 'material']);
  assert.deepEqual(saved[1].cvcUnits, [2]);
  assert.equal(saved[1].phonicsUnitIds.length, 1);
  await page.reload();
  await edit();
  await form.locator(`[data-slide-id="${saved[1].id}"]`).click();
  await detail.getByRole('button', { name: '활동지 설정', exact: true }).click();
  assert.equal(await unit(detail).getAttribute('aria-pressed'), 'true');
  await form.getByRole('button', { name: /이 슬라이드부터 발표/ }).click();
  await page.waitForURL(/\/materials\/cvc-workbook/);
  const title = await page.locator('.print-board').first().innerText();
  assert.match(title, /UNIT 2\./i);
  console.log('PASS CVC worksheet preview, unit choice, page navigation, save, reopen and present');
} finally {
  await browser?.close();
  await server.close();
}
