import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/playwright/index.mjs';
import { openUnitOnePreview } from './unit-one-preview.mjs';

const port = 5226;
const server = await openUnitOnePreview(port);
const snapshots = process.argv[2];
if (snapshots) await mkdir(snapshots, { recursive: true });
let browser;
try {
  const { courseUnits, courseWord, availableLessonSlides, builderParts } = await server.ssrLoadModule('/src/data/phonicsLessons.ts');
  const units = courseUnits().filter(unit => unit.status === 'confirmed');
  assert.deepEqual([1, 2, 3, 4, 5].map(step => units.filter(unit => unit.step === step).length), [9, 8, 8, 8, 9]);
  browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(() => {
    window.readyClassSpeech = [];
    const engine = window.speechSynthesis;
    const speak = engine.speak.bind(engine);
    engine.speak = utterance => {
      const event = { word: utterance.text, state: 'requested' };
      window.readyClassSpeech.push(event);
      utterance.addEventListener('end', () => { event.state = 'ended'; });
      utterance.addEventListener('error', error => { event.state = error.error; });
      speak(utterance);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const event = { recording: this.src, state: 'requested' };
      window.readyClassSpeech.push(event);
      this.addEventListener('ended', () => { event.state = 'ended'; }, { once: true });
      this.addEventListener('error', () => { event.state = 'error'; }, { once: true });
      return play.call(this);
    };
  });

  const checked = { units: 0, sections: 0, slideLinks: 0, builders: 0, listeningReveals: 0, sortingReveals: 0, memoryReveals: 0 };
  const samples = [];
  const errors = [];
  const origin = `http://127.0.0.1:${port}`;
  const route = (unit, lesson, slide = null) => `/phonics/lesson?${new URLSearchParams({ unit: unit.id, lesson: String(lesson), ...(slide ? { slide } : {}) })}`;
  const chunks = [units.filter(unit => unit.step <= 2), units.filter(unit => unit.step === 3), units.filter(unit => unit.step === 4), units.filter(unit => unit.step === 5)];
  await Promise.all(chunks.map(async chunk => {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    const slide = page.locator('[data-course-slide]');
    const activity = type => slide.locator(`[data-ready-activity="${type}"]`);
    const select = page.locator('.pc-player select');
    const next = () => page.locator('[data-course-next]').click();
    const previous = () => page.locator('.pc-player-controls:has(> select) > button').first().click();
    const wait = id => page.locator(`[data-course-slide="${id}"]`).waitFor();
    const jump = async item => { await select.selectOption(item.id); await wait(item.id); };
    const fit = async element => assert.equal(await element.evaluate(element => {
      const board = element.closest('[data-ready-activity]').getBoundingClientRect();
      return [...element.children].every(child => {
        const box = child.getBoundingClientRect();
        return box.left >= board.left - 1 && box.right <= board.right + 1 && box.bottom <= board.bottom + 1;
      });
    }), true, `Activity does not fit at ${page.url()}`);

    for (const [unitIndex, unit] of chunk.entries()) {
      const slides = availableLessonSlides(unit);
      for (const section of [1, 2, 'extra']) {
        const sequence = slides.filter(item => item.lesson === section);
        const url = route(unit, section);
        if (unitIndex === 0 && section === 1) await page.goto(origin + url);
        else await page.evaluate(url => {
          const state = { idx: (history.state?.idx ?? 0) + 1 };
          history.pushState(state, '', url);
          dispatchEvent(new PopStateEvent('popstate', { state }));
        }, url);
        await wait(sequence[0].id);
        assert.deepEqual(await select.locator('option').evaluateAll(options => options.map(option => option.value)), sequence.map(item => item.id));
        checked.sections++;
        checked.slideLinks += sequence.length;
        await next();
        await wait(sequence[1].id);
        await previous();
        await wait(sequence[0].id);

        for (const item of sequence.filter(item => item.kind === 'builder')) {
          const word = courseWord(unit, item.entryIds[0]);
          await jump(item);
          assert.deepEqual(await slide.locator('[data-builder-part]').allTextContents(), builderParts(word, unit.step));
          assert.equal(await slide.locator('.rc-activity-result').textContent(), word.word);
          if (unit.id !== 'course-2-1') assert.equal(await slide.locator('.rc-blend-support img').getAttribute('src'), word.image_url);
          if (unit.step === 3) assert.match(await slide.locator('.rc-blend-note').textContent(), /^Silent e/);
          await fit(slide.locator('.rc-activity-equation'));
          checked.builders++;
          if (unit.number === 1 && item === sequence.find(item => item.kind === 'builder')) {
            samples.push({ route: route(unit, section, item.id), type: 'blend', step: unit.step, word });
          }
        }

        for (const item of sequence.filter(item => item.kind === 'choose' && item.phase === 0)) {
          const cards = slide.locator('.rc-activity-choice');
          await jump(item);
          assert.deepEqual(await cards.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src'))), item.entryIds.map(id => courseWord(unit, id).image_url));
          assert.equal(await cards.locator('.s1-word, button').count(), 0);
          assert.equal(await slide.locator('.pc-answer').count(), 0);
          if (unit.number === 1 && item === sequence.find(item => item.kind === 'choose')) {
            samples.push({ route: route(unit, section, item.id), type: 'listen', step: unit.step, word: courseWord(unit, item.answerIds[0]) });
          }
          const answer = sequence[sequence.indexOf(item) + 1];
          await next();
          await wait(answer.id);
          const marked = await slide.locator('.rc-activity-choice.pc-answer').evaluateAll(cards => cards.map(card => card.dataset.entry));
          assert.deepEqual(marked, answer.entryIds.filter(id => answer.answerIds.includes(id)));
          assert.ok(marked.length > 0);
          await previous();
          await wait(item.id);
          assert.equal(await slide.locator('.pc-answer').count(), 0);
          checked.listeningReveals++;
        }

        for (const item of sequence.filter(item => item.kind === 'sort' && item.phase === 0)) {
          await jump(item);
          const bins = slide.locator('.rc-activity-bin');
          assert.equal(await bins.locator('.s1-word').count(), 0);
          const answer = sequence[sequence.indexOf(item) + 1];
          const groups = unit.groups.filter(group => !answer.groupIds.length || answer.groupIds.includes(group.id));
          assert.deepEqual(await bins.locator('h3').allTextContents(), groups.map(group => group.label));
          await next();
          await wait(answer.id);
          for (const [index, group] of groups.entries()) {
            const expected = answer.entryIds.filter(id => group.entries.some(entry => entry.id === id)).map(id => courseWord(unit, id).word);
            assert.deepEqual(await bins.nth(index).locator('.s1-word').allTextContents(), expected);
          }
          await fit(slide.locator('.rc-activity-bins'));
          checked.sortingReveals++;
        }

        const reader = sequence.find(item => item.kind === 'readAlone');
        const memory = sequence.find(item => item.kind === 'memory' && item.phase === 0);
        for (const item of [reader, memory].filter(Boolean)) {
          await jump(item);
          await activity('read').waitFor();
          assert.deepEqual(await slide.locator('.rc-activity-independent > span').allTextContents(), item.entryIds.map(id => courseWord(unit, id).word));
          assert.equal(await slide.locator('img, button, .s1-target').count(), 0);
          await fit(slide.locator('.rc-activity-independent'));
          if (item.kind === 'memory') {
            await next();
            await slide.locator('[data-game-phase="1"]').waitFor();
            await next();
            await slide.locator('[data-game-phase="2"] img').waitFor();
            assert.equal(await slide.locator('[data-game-phase="2"] img').getAttribute('src'), courseWord(unit, item.entryIds[0]).image_url);
            checked.memoryReveals++;
          }
        }
      }
      checked.units++;
    }
    await page.close();
  }));
  const audio = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const sample of samples.sort((a, b) => a.step - b.step || a.type.localeCompare(b.type))) {
    await page.goto(origin + sample.route);
    const slide = page.locator('[data-ready-activity]');
    await slide.waitFor();
    if (snapshots) await slide.screenshot({ path: join(snapshots, `level-${sample.step}-${sample.type}.png`) });
    await slide.locator(`.rc-activity-${sample.type}-audio`).getByRole('button').click();
    const recording = sample.word.audio?.recordingUrl;
    const target = recording ? { recording: new URL(recording, origin).href } : { word: sample.word.word };
    try {
      await page.waitForFunction(target => window.readyClassSpeech.some(event => event.state === 'ended' &&
        Object.keys(target).every(key => event[key] === target[key])), target, { timeout: 8000 });
    } catch (error) {
      throw new Error(`Audio for ${sample.word.word} at ${sample.route}: ${JSON.stringify(await page.evaluate(() => window.readyClassSpeech))}`, { cause: error });
    }
    audio.push(sample.word.word);
  }
  assert.deepEqual([...new Set(samples.map(sample => sample.step))], [1, 2, 3, 4, 5]);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ...checked, completedAudio: audio.sort() }));
} finally {
  await browser?.close();
  await server.close();
}
