import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { createLessonUxServer } from './ux-server.mjs';

const port = 5566;
const server = await createLessonUxServer(port);
let browser;
try {
  await server.listen();
  const topics = ['plural', 'present-progressive', 'past-irregular'];
  const points = JSON.parse(readFileSync(new URL('../../src/data/grammarPoints.json', import.meta.url), 'utf8'));
  const topicName = id => points.find(point => point.id === id).name;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('classbank.selectedClassId', 'a');
    localStorage.setItem('classbank.startCheck.skip', '1');
    Element.prototype.requestFullscreen = async () => {};
  });
  const curriculum = `http://127.0.0.1:${port}/curriculum`;
  await page.goto(curriculum);
  await page.waitForFunction(() => window.__lessonQA);
  await page.evaluate(() => {
    const store = window.__lessonQA;
    store.lists.push({
      ...store.lists[0], id: 'sentences-a', kind: 'sentence', name: 'QA 문장 목록', updated_at: 'sentences-v1',
      items: ['I brought the red bag.', 'We see a blue bird.'].map((word, id) => ({ id: String(id), word, meaning: 'QA', image_url: null })),
    });
    window.__saveLessonQA();
  });
  await page.reload();
  const editor = page.locator('[data-lesson-edit-form]');
  const picker = page.locator('.lesson-activity-picker');
  const begin = async (title, list) => {
    await page.getByRole('button', { name: /직접 구성하기/ }).click();
    await editor.locator('input[type="text"]').first().fill(title);
    await editor.locator('select').first().selectOption(list);
  };
  const openPicker = async () => {
    await editor.getByRole('button', { name: /활동 추가/ }).click();
    await picker.locator('nav').getByRole('button', { name: /게임·퀴즈/ }).click();
  };
  const activity = type => picker.locator(`[data-activity-id$=".${type}"]`);
  const save = async () => {
    await editor.getByRole('button', { name: '저장', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
  };
  const saved = title => page.evaluate(name => {
    const store = window.__lessonQA;
    const lesson = store.lessons.find(row => row.name === name);
    const slide = lesson.playlist.find(row => row.kind === 'game');
    return { lesson, slide, template: store.templates.find(row => row.id === slide.templateId) };
  }, title);
  const start = async (id, type) => {
    await page.locator(`#lesson-card-${id}`).getByRole('button', { name: '수업 시작', exact: true }).click();
    await page.waitForURL(url => url.pathname === `/games/${type}`);
  };

  await begin('QA 단어 게임 수업', 'words-a');
  await openPicker();
  await activity('matchup').getByText('내 자료로 진행 가능', { exact: true }).waitFor();
  await activity('wordtrain').getByText('문장 모음 필요', { exact: true }).waitFor();
  await activity('matchup').click();
  await editor.getByRole('button', { name: '수업 자료로 게임 만들기' }).click();
  await page.waitForFunction(() => window.__lessonQA.templates.some(row => row.config.classroomSource?.id === 'words-a'));
  await save();
  const words = await saved('QA 단어 게임 수업');
  assert.equal(words.template.config.classroomSource.id, 'words-a');
  assert.equal(words.template.config.pairs[0].left, 'apple');
  await page.reload();
  await start(words.lesson.id, 'matchup');
  assert.equal(await page.evaluate(() => history.state.usr.openTemplateId), words.template.id);
  await page.getByRole('heading', { name: words.template.name, exact: true, includeHidden: true }).waitFor({ state: 'attached' });
  const wordTiles = page.locator('[data-skin-object="chip"]');
  await wordTiles.first().waitFor({ state: 'attached' });
  const allowedWords = new Set(words.template.config.pairs.flatMap(pair => [pair.left, pair.right]));
  assert.ok((await wordTiles.allTextContents()).every(word => allowedWords.has(word.trim())));

  await page.goto(curriculum);
  await begin('QA 문장 게임 수업', 'sentences-a');
  await openPicker();
  await activity('unscramble').getByText('내 자료로 진행 가능', { exact: true }).waitFor();
  await activity('matchup').getByText(/이 게임은 단어 자료를 지원합니다/).waitFor();
  await activity('unscramble').click();
  await save();
  const sentences = await saved('QA 문장 게임 수업');
  assert.equal(sentences.template.config.classroomSource.id, 'sentences-a');
  assert.equal(sentences.template.config.classroomSource.version, 'sentences-v1');
  assert.deepEqual(sentences.template.items.map(item => item.label), ['I brought the red bag.', 'We see a blue bird.']);
  await page.reload();
  await start(sentences.lesson.id, 'unscramble');
  assert.equal(await page.evaluate(() => history.state.usr.openTemplateId), sentences.template.id);
  await page.locator('[data-skin-object="tile-pool"]').getByText(/^(brought|bird\.)$/i).first().waitFor({ state: 'attached' });

  await page.goto(curriculum);
  await page.waitForFunction(() => window.__lessonQA);
  await page.evaluate(([before, after, unsupported]) => {
    const store = window.__lessonQA;
    const existing = store.lessons[0];
    store.lessons.push({
      ...existing, id: 'qa-topic', name: 'QA 문법 항목 수업', word_list_id: null,
      playlist: [
        { id: 'grammar-first', kind: 'grammar', grammarId: before },
        { id: 'grammar-game-first', kind: 'game', gameType: 'grammarverb', templateId: 'old-topic-template' },
        { id: 'grammar-second', kind: 'grammar', grammarId: after },
        { id: 'grammar-game-second', kind: 'game', gameType: 'grammarverb' },
      ],
    }, {
      ...existing, id: 'qa-missing', name: 'QA 문법 자료 없는 수업', word_list_id: null,
      playlist: [{ id: 'grammar-game-missing', kind: 'game', gameType: 'grammarverb' }],
    }, {
      ...existing, id: 'qa-unsupported', name: 'QA 지원하지 않는 문법', word_list_id: null,
      playlist: [
        { id: 'grammar-game-unsupported', kind: 'game', gameType: 'grammarverb', templateId: 'old-topic-template' },
        { id: 'grammar-unsupported', kind: 'grammar', grammarId: unsupported },
      ],
    });
    store.templates.push({
      ...store.templates[0], id: 'old-topic-template', game_type: 'grammarverb',
      items: [{ id: 'old', label: 'Unrelated saved topic' }], config: { grammarId: after },
    });
    window.__saveLessonQA();
  }, topics);
  await page.reload();
  await page.locator('#lesson-card-qa-topic').getByRole('button', { name: '수정', exact: true }).click();
  await openPicker();
  await activity('grammarverb').getByText('수업 문법 항목으로 진행', { exact: true }).waitFor();
  assert.equal(await activity('grammarverb').getByText(topicName(topics[1]), { exact: true }).count(), 1);
  await page.goto(curriculum);
  await page.locator('#lesson-card-qa-topic').getByRole('button', { name: '수업 시작', exact: true }).click();
  const next = page.getByRole('button', { name: '다음 활동', exact: true });
  await next.click();
  await page.waitForURL(url => url.pathname === '/games/grammarverb');
  await page.locator('.gg-topic').getByText(topicName(topics[0]), { exact: true }).waitFor();
  await next.click();
  await next.click();
  await page.waitForURL(url => url.pathname === '/games/grammarverb');
  await page.locator('.gg-topic').getByText(topicName(topics[1]), { exact: true }).waitFor();
  await page.goto(curriculum);
  await start('qa-missing', 'grammarverb');
  await page.getByText('수업에 문법 항목을 선택해 주세요.', { exact: true }).waitFor();
  assert.equal(await page.locator('.gg-topic').count(), 0);
  await page.goto(curriculum);
  await start('qa-unsupported', 'grammarverb');
  await page.getByText('이 게임은 수업의 문법 항목을 지원하지 않아요.', { exact: true }).waitFor();
  assert.equal(await page.locator('.gg-topic').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Passed: material readiness, word and sentence snapshots, saved presentation, and grammar topic changes without fallback.');
} finally {
  await browser?.close();
  await server.close();
}
