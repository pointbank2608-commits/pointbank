import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/playwright/index.mjs';
import { openUnitOnePreview, previewPath } from './unit-one-preview.mjs';

const port = 5225;
const server = await openUnitOnePreview(port);
const snapshots = process.argv[2];
if (snapshots) await mkdir(snapshots, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1120 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.readyClassSpeech = [];
    const engine = window.speechSynthesis;
    const original = engine.speak.bind(engine);
    engine.speak = request => {
      const observed = { text: request.text, lang: request.lang, state: 'requested' };
      window.readyClassSpeech.push(observed);
      request.addEventListener('start', () => { observed.state = 'started'; });
      request.addEventListener('end', () => { observed.state = 'ended'; });
      request.addEventListener('error', event => { observed.state = event.error; });
      original(request);
    };
  });
  const slide = page.locator('[data-course-slide]');
  const activity = kind => slide.locator(`[data-ready-activity="${kind}"]`);
  const open = label => page.getByRole('link', { name: label, exact: true }).click();
  const reveal = () => page.locator('[data-course-next]').click();
  const snapshot = async name => {
    if (snapshots) await slide.screenshot({ path: join(snapshots, `${name}.png`), animations: 'disabled' });
  };
  const listen = async (target, expected) => {
    await page.evaluate(() => { window.readyClassSpeech.length = 0; });
    await target.getByRole('button').click();
    await page.waitForFunction(() => window.readyClassSpeech.length === 1);
    const result = await page.evaluate(() => window.readyClassSpeech[0]);
    assert.equal(result.text, expected);
    assert.equal(result.lang, 'en-US');
    await page.waitForFunction(() => !['requested','started'].includes(window.readyClassSpeech[0]?.state), undefined, { timeout: 3000 }).catch(() => {});
    return page.evaluate(() => window.readyClassSpeech[0]);
  };

  await page.goto(`http://127.0.0.1:${port}${previewPath}`);
  await activity('builder').waitFor();
  assert.deepEqual(await slide.locator('[data-builder-part]').allTextContents(), ['d', 'ad']);
  assert.equal(await slide.locator('.rc-activity-result').textContent(), 'dad');
  const backgroundLoaded = await activity('builder').evaluate(async element => {
    const url = getComputedStyle(element).backgroundImage.match(/url\("(.+)"\)/)?.[1];
    if (!url) return false;
    const image = new Image();
    image.src = url;
    await image.decode();
    return image.naturalWidth > 1000;
  });
  assert.equal(backgroundLoaded, true);
  const builderAudio = await listen(slide.locator('.rc-activity-blend-audio'), 'dad');
  await snapshot('01-listen-and-blend');

  await open('듣고 고르기');
  await activity('choose').waitFor();
  const cards = slide.locator('.rc-activity-choice');
  const choices = await cards.evaluateAll(elements => elements.map(element => ({ id: element.dataset.entry, width: element.getBoundingClientRect().width, color: getComputedStyle(element).backgroundColor })));
  assert.equal(choices.length, 3);
  assert.ok(choices.every(choice => Math.abs(choice.width - choices[0].width) < 1 && choice.color === choices[0].color));
  assert.equal(await cards.locator('.s1-word, button, .pc-answer').count(), 0);
  assert.equal(await cards.locator('.s1-picture').count(), 3);
  const listeningAudio = await listen(slide.locator('.rc-activity-listen-audio'), 'bad');
  await snapshot('02-listen-and-choose');
  await reveal();
  const winner = slide.locator('.rc-activity-choice.pc-answer');
  await winner.waitFor();
  assert.equal(await winner.locator('.s1-word').textContent(), 'bad');
  assert.deepEqual(await cards.evaluateAll(elements => elements.map(element => element.dataset.entry)), choices.map(choice => choice.id));
  assert.equal(await cards.locator('button').count(), 3);
  const revealedAudio = await listen(winner, 'bad');
  await snapshot('03-listen-answer');

  await open('단어 분류');
  await activity('sort').waitFor();
  const bins = slide.locator('.rc-activity-bin');
  assert.deepEqual(await bins.locator('h3').allTextContents(), ['-ad', '-ag', '-am']);
  assert.equal(await bins.locator('.s1-word').count(), 0);
  const words = await slide.locator('.rc-activity-word-bank > span').allTextContents();
  await snapshot('04-read-and-sort');
  await reveal();
  await bins.locator('.s1-word').first().waitFor();
  assert.deepEqual((await bins.locator('.s1-word').allTextContents()).sort(), words.sort());
  for (const bin of await bins.all()) {
    const rule = (await bin.getAttribute('data-rule')).slice(1);
    assert.ok((await bin.locator('.s1-word').allTextContents()).every(word => word.endsWith(rule)));
  }
  await snapshot('05-sort-answer');

  await open('혼자 읽기');
  await activity('read').waitFor();
  assert.equal(await slide.locator('.rc-activity-independent').innerText(), 'bag');
  assert.equal(await slide.locator('img, svg, .s1-target, .s1-speaker, .pc-answer').count(), 0);
  await snapshot('06-read-on-your-own');
  await reveal();
  await slide.locator('[data-game-phase="1"]').waitFor();
  await reveal();
  await slide.locator('[data-game-phase="2"] .s1-picture').waitFor();
  assert.equal(await slide.locator('.s1-word').textContent(), 'bag');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [label, kind] of [['소리 합치기','builder'], ['듣고 고르기','choose'], ['단어 분류','sort'], ['혼자 읽기','read']]) {
    await open(label);
    await activity(kind).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await activity(kind).evaluate(board => {
      const panel = board.getBoundingClientRect();
      return [...board.children].every(element => {
        const box = element.getBoundingClientRect();
        return box.left >= panel.left - 1 && box.right <= panel.right + 1 && box.bottom <= panel.bottom + 1;
      });
    }), true, `${kind} content stays inside the slide`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS four real lesson slide types, correct listening/sorting reveals, original memory reveal, 390px layout');
  console.log(JSON.stringify({ builderAudio, listeningAudio, revealedAudio }));
} finally {
  await browser?.close();
  await server.close();
}
