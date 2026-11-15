import assert from 'node:assert/strict';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { createLessonUxServer } from '../lessons/ux-server.mjs';
import { createGuidedServer } from '../homework/guided-server.mjs';

const lessonServer = await createLessonUxServer(5536);
const homeworkServer = await createGuidedServer(5530);
let browser;
try {
  await Promise.all([lessonServer.listen(), homeworkServer.listen()]);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const curriculum = 'http://127.0.0.1:5536/curriculum';
  await page.addInitScript(() => {
    if (location.port === '5536') localStorage.setItem('classbank.selectedClassId', 'a');
    window.print = () => {
      window.__worksheetPrinted = true;
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  const openWizard = async () => {
    await page.getByRole('button', { name: /추천 구성으로 만들기/ }).click();
    const wizard = page.getByRole('dialog', { name: '수업 빨리 만들기' });
    await wizard.getByRole('button', { name: '3:30 리딩', exact: true }).click();
    await wizard.getByRole('button', { name: /^문법/ }).click();
    await wizard.locator('select:has(option[value="past-irregular"])').selectOption('past-irregular');
    return wizard;
  };
  await page.goto(curriculum);
  const wizard = await openWizard();
  const words = wizard.getByRole('group', { name: '이 문법에서 꼭 외울 단어' });
  const defaults = await words.locator('input:checked').all();
  assert.equal(defaults.length, 4);
  await defaults[0].uncheck();
  await wizard.getByRole('button', { name: '선택한 3개 확정' }).click();
  await wizard.getByRole('button', { name: '저장해 두기' }).click();
  await wizard.waitFor({ state: 'hidden' });
  const lesson = await page.evaluate(() => window.__lessonQA.lessons.find(row => row.playlist?.some(slide => slide.grammarWords)));
  const material = lesson.playlist.find(slide => slide.grammarWords);
  assert.equal(material.grammarWords.entries.length, 3);

  await page.goto(`${curriculum}/${lesson.id}/slide/${material.id}`);
  await page.getByRole('heading', { name: /핵심 문법 단어 활동지/ }).first().waitFor();
  await page.locator('summary').getByText('교사용 정답', { exact: true }).click();
  await page.getByRole('heading', { name: /교사용 정답/ }).waitFor();
  await page.getByRole('button', { name: '활동지와 정답 인쇄' }).click();
  await page.waitForFunction(() => window.__worksheetPrinted);

  await page.goto(curriculum);
  const reviewWizard = await openWizard();
  await reviewWizard.getByLabel('지난 수업 1분 복습').selectOption(lesson.id);
  await reviewWizard.getByRole('button', { name: '이번 수업에서는 건너뛰기' }).click();
  await reviewWizard.getByRole('button', { name: '저장해 두기' }).click();
  await reviewWizard.waitFor({ state: 'hidden' });
  const review = await page.evaluate(id => window.__lessonQA.lessons.flatMap(row => row.playlist ?? [])
    .find(slide => slide.grammarWordSource?.lessonId === id), lesson.id);
  assert.equal(review.questions.length, 2);
  assert.equal(review.helpers[0].seconds, 60);
  assert.equal(review.grammarWordSource.recommendationId, material.grammarWords.recommendationId);

  await page.goto('http://127.0.0.1:5530/homework');
  await page.waitForFunction(() => window.__guided);
  await page.evaluate(saved => {
    window.__guided.lessons.push({ ...saved, class_id: 'class' });
    window.__saveGuided();
  }, lesson);
  await page.reload();
  await page.getByRole('button', { name: /새 숙제 내기/ }).click();
  await page.getByRole('button', { name: /수업에서 가져오기/ }).click();
  await page.getByLabel('수업 선택', { exact: true }).selectOption(lesson.id);
  await page.getByRole('button', { name: '문법 복습 숙제 미리보기' }).click();
  assert.equal(await page.evaluate(() => window.__guided.assignments.length), 0);
  await page.getByRole('button', { name: '배정', exact: true }).click();
  await page.getByRole('button', { name: '확인하고 배정' }).click();
  await page.waitForFunction(() => window.__guided.assignments.length === 1);
  const assignment = await page.evaluate(() => window.__guided.assignments[0]);
  const items = assignment.draft.items;
  assert.ok(items.every(item => item.config.grammarWordSource.recommendationId === material.grammarWords.recommendationId));
  assert.deepEqual(items.flatMap(item => item.content.questions.map(question => question.contentId)),
    lesson.playlist.filter(slide => slide.kind === 'qna' && slide.grammarWordSource)
      .flatMap(slide => slide.questions.map(question => question.grammarWord.contentId)));
  assert.deepEqual(errors, []);
  console.log('Passed: word selection, saved worksheet and print, one-minute review, homework preview and explicit assignment');
} finally {
  await browser?.close();
  await Promise.all([lessonServer.close(), homeworkServer.close()]);
}
