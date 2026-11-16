import assert from 'node:assert/strict';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { createLessonUxServer } from './ux-server.mjs';

const port = 5576;
const server = await createLessonUxServer(port);
let browser;
try {
  await server.listen();
  const { phonicsGameUnits, PHONICS_GAMES, makeRound, shuffled } = await server.ssrLoadModule('/src/lib/phonicsGames.ts');
  const unit = phonicsGameUnits().find(candidate => candidate.id === 'course-2-6');
  const game = PHONICS_GAMES.find(candidate => candidate.id === 'diner-recipe');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('classbank.selectedClassId', 'a');
    localStorage.setItem('classbank.startCheck.skip', '1');
    Element.prototype.requestFullscreen = async () => {};
    const random = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 1 ? values.fill(123) : random(values);
    window.qaSpeech = [];
    speechSynthesis.speak = utterance => {
      window.qaSpeech.push(utterance.text);
      if (window.qaSpeechFails) utterance.onerror?.({ error: 'voice-unavailable' });
      else {
        utterance.onstart?.();
        utterance.onend?.();
      }
    };
  });
  const curriculum = `http://127.0.0.1:${port}/curriculum`;
  await page.goto(curriculum);
  await page.waitForFunction(() => window.__lessonQA);
  await page.evaluate(entries => {
    const db = window.__lessonQA;
    db.lists.push({ ...db.lists[0], id: 'phonics-qa-list', name: 'QA 파닉스 단어장',
      items: entries.map(entry => ({ id: entry.id, word: entry.word, meaning: entry.meaning ?? '', image_url: entry.image_url })) });
    window.__saveLessonQA();
  }, unit.entries);
  await page.reload();

  await page.getByRole('button', { name: /직접 구성하기/ }).click();
  const edit = page.locator('[data-lesson-edit-form]');
  await edit.locator('input[type="text"]').first().fill('QA 파닉스 게임 수업');
  await edit.locator('select').first().selectOption('phonics-qa-list');
  await edit.getByRole('button', { name: /활동 추가/ }).click();
  const picker = page.locator('.lesson-activity-picker');
  await picker.locator('nav').getByRole('button', { name: /게임·퀴즈/ }).click();
  await picker.getByRole('button', { name: /^파닉스 \d+$/ }).click();
  const card = picker.locator('[data-activity-id="phonicsGame.diner-recipe"]');
  await card.getByText('내 자료 적용', { exact: true }).waitFor();
  await card.getByText(/Level 2 · Unit 6/).waitFor();
  await card.click();
  const detail = page.locator('[data-phonics-slide-detail]');
  await detail.locator('[data-phonics-unit-summary]').getByText('2단계 · Unit 6', { exact: true }).waitFor();
  assert.equal(await detail.getByLabel('수업 유닛', { exact: true }).inputValue(), '');
  await detail.getByLabel('문제 수', { exact: true }).selectOption('3');
  await detail.getByLabel('난이도', { exact: true }).selectOption('hard');
  await detail.getByLabel('팀', { exact: true }).selectOption('3');
  await edit.getByRole('button', { name: '저장', exact: true }).click();
  await edit.waitFor({ state: 'hidden' });
  const saved = await page.evaluate(() => window.__lessonQA.lessons.find(row => row.name === 'QA 파닉스 게임 수업'));
  const gameSlide = saved.playlist.find(slide => slide.kind === 'phonicsGame');
  assert.deepEqual([gameSlide.gameId, gameSlide.unitId, gameSlide.rounds, gameSlide.level, gameSlide.teams], [game.id, undefined, 3, 'hard', 3]);

  await page.reload();
  await page.locator(`#lesson-card-${saved.id}`).getByRole('button', { name: '수업 시작', exact: true }).click();
  await page.waitForURL(url => url.pathname === `/curriculum/${saved.id}/slide/${gameSlide.id}`);
  const session = page.locator('[data-phonics-session="diner-recipe"]');
  await session.getByText('레시피 조립 · Unit 6', { exact: true }).waitFor();
  assert.equal(await session.getByRole('progressbar', { name: '게임 진행' }).getAttribute('max'), '3');
  assert.equal(await session.locator('.pg-teams > span').count(), 3);
  await session.getByText('빨강팀 차례예요!', { exact: true }).waitFor();
  await session.locator('.pg-listen-only').filter({ hasText: '그림 없이 소리를 듣고 풀어요.' }).waitFor();
  const listen = session.getByRole('button', { name: '단어·문장 듣기', exact: true });
  const round = makeRound(game, unit, 0, 123);
  await page.evaluate(() => { window.qaSpeechFails = true; });
  await listen.click();
  await session.getByText(/이 기기에서 음성을 재생할 수 없어요/).waitFor();
  await page.evaluate(() => { window.qaSpeechFails = false; });
  await listen.click();
  await session.getByText(/이 기기에서 음성을 재생할 수 없어요/).waitFor({ state: 'hidden' });
  assert.deepEqual(await page.evaluate(() => window.qaSpeech.slice(-2)), [round.entry.word, round.entry.word]);
  const tiles = shuffled(round.tokens.map((_, id) => ({ id })), 123 + 24);
  for (let id = 0; id < tiles.length; id++) {
    await session.locator('.pg-token-bank > button').nth(tiles.findIndex(tile => tile.id === id)).click();
  }
  await session.locator('.pg-next').click();
  await session.getByText('파랑팀 차례예요!', { exact: true }).waitFor();
  assert.equal(await session.getByRole('progressbar', { name: '게임 진행' }).getAttribute('value'), '1');
  assert.deepEqual(errors, []);
  console.log('Passed: recommended unit and saved rounds, difficulty and teams through real presentation; audio failure and recovery.');
} finally {
  await browser?.close();
  await server.close();
}
