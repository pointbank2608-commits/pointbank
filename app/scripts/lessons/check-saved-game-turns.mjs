import assert from 'node:assert/strict';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { createLessonUxServer } from './ux-server.mjs';

const port = 5538;
const server = await createLessonUxServer(port);
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => console.error(error));
  await page.addInitScript(() => localStorage.setItem('classbank.selectedClassId', 'a'));
  await page.goto(`http://127.0.0.1:${port}/curriculum`);
  await page.waitForFunction(() => !!window.__lessonQA);
  await page.evaluate(() => {
    const db = window.__lessonQA;
    db.strictGameScope = true;
    db.students = { a: [
      { id: 'student-a', name: '하늘' }, { id: 'student-b', name: '바다' }, { id: 'student-absent', name: '결석 학생' },
    ] };
    localStorage.setItem('classbank.absent.a', '["student-absent"]');
    const template = (id, classId, word, config = {}) => ({ id, academy_id: 'academy', class_id: classId,
      game_type: 'connect4', name: id, items: [{ id: `${id}-word`, label: word }], config });
    db.templates.push(template('local-unrelated', 'a', 'unrelated'), template('linked-first', 'c', 'first-column', {
      pictureWordMode: true,
      pictureWords: [{ id: 'picture', word: 'apple', imageUrl: '/phonics-images/apple.webp' }, { id: 'decoy', word: 'ant', imageUrl: null }],
    }), template('linked-second', 'a', 'second-column'));
    db.lessons.find(lesson => lesson.id === 'lesson-a').playlist = [
      { id: 'first-board', kind: 'game', gameType: 'connect4', templateId: 'linked-first' },
      { id: 'second-board', kind: 'game', gameType: 'connect4', templateId: 'linked-second' },
      { id: 'detective', kind: 'game', gameType: 'grammardetective' },
    ];
    window.__saveLessonQA();
  });
  await page.reload();

  const form = page.locator('[data-lesson-edit-form]');
  const edit = () => page.locator('#lesson-card-lesson-a').getByRole('button', { name: '수정', exact: true }).click();
  const board = page.locator('[data-game="connect4"]');
  const drop = () => board.locator('[data-skin-object="drop-button"]').first().click();
  const strip = board.locator('[data-class-turn-strip]');
  const active = strip.locator('[aria-current="step"]');
  const openOrder = () => board.getByRole('button', { name: '팀·순서 정하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '팀 나누기 · 순서 정하기' });
  const apply = () => dialog.getByRole('button', { name: '적용', exact: true }).click();

  await edit();
  await form.locator('[data-slide-id="first-board"]').click();
  await board.getByText('first-column', { exact: true }).first().waitFor();
  const classSettings = board.locator('[data-game-toolbar-panel="class"]');
  const editTurn = board.locator('[data-turn-bar]');
  for (const [mode, expected] of [['팀', /[12]팀/], ['개인', '하늘']]) {
    await board.getByRole('button', { name: '반 설정', exact: true }).click();
    await classSettings.getByRole('button', { name: mode, exact: true }).click();
    await classSettings.getByRole('button', { name: '적용', exact: true }).click();
    await editTurn.getByText(expected).first().waitFor();
  }
  assert.equal(await editTurn.getByText('결석 학생').count(), 0);

  await form.getByRole('button', { name: /이 슬라이드부터 발표/ }).click();
  await page.waitForURL(/\/games\/connect4/);
  await active.filter({ hasText: '하늘' }).waitFor();
  await drop();
  const picture = page.locator('[data-picture-turn]');
  await picture.getByRole('button', { name: 'apple', exact: true }).click();
  await active.filter({ hasText: '바다' }).waitFor();

  await page.locator('[data-lesson-runner-bar]').getByRole('button', { name: '다음 활동', exact: true }).click();
  await board.getByText('second-column', { exact: true }).first().waitFor();
  await drop();
  await active.filter({ hasText: '하늘' }).waitFor();
  assert.equal(await picture.count(), 0);

  await openOrder();
  await dialog.getByRole('button', { name: '팀', exact: true }).click();
  await apply();
  await active.getByText(/1팀/).waitFor();
  console.log('PASS: lesson editor and presentation use the linked templates, preserve picture settings, and show individual/team turns');

  await page.locator('[data-lesson-runner-bar]').getByRole('button', { name: '수업 끝내기', exact: true }).click();
  await page.waitForURL(/\/curriculum$/);
  await form.locator('[data-slide-id="detective"]').click();
  await form.locator('[data-game-toolbar]').getByRole('button', { name: '내 단어/문장', exact: true }).click();
  await form.locator('[data-game-toolbar-panel="content"]').getByRole('button', { name: '직접 입력 · 문제 편집', exact: true }).click();
  const sentences = form.locator('[data-detective-sentence-authoring]');
  await sentences.locator(':scope > summary').click();
  const authorInput = sentences.getByRole('textbox', { name: '올바른 영어 문장 (한 줄에 하나)' });
  await authorInput.fill('She can swim.');
  await sentences.getByRole('button', { name: '이 문제로 게임 시작', exact: true }).click();
  const detective = page.locator('[data-game="grammardetective"]');
  const incorrectWord = detective.locator('.ad-detective-tokens').getByRole('button', { name: 'swims', exact: true });
  await incorrectWord.waitFor();
  await form.getByRole('button', { name: /이 슬라이드부터 발표/ }).click();
  await page.waitForURL(/\/games\/grammardetective/);
  await incorrectWord.click();
  await detective.getByRole('button', { name: 'swim', exact: true }).click();
  await detective.getByText('She can swim.', { exact: true }).waitFor();
  const savedSentences = await page.evaluate(() => {
    const db = window.__lessonQA;
    const id = db.lessons.find(lesson => lesson.id === 'lesson-a').playlist.find(slide => slide.id === 'detective').templateId;
    return db.templates.find(template => template.id === id).config.adventure.cases.map(item => item.correct);
  });
  assert.deepEqual(savedSentences, ['She can swim.']);
  console.log('PASS: the Detective starts with teacher-authored sentences and presents the same saved questions');
} finally {
  await browser?.close();
  await server.close();
}
