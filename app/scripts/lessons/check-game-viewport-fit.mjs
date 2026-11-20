import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { createLessonUxServer } from './ux-server.mjs';

const server = await createLessonUxServer(5586);
let browser;
const results = [];
try {
  await server.listen();
  browser = await chromium.launch({channel: 'chrome', headless: true});
  const [width,height]=(process.env.FIT_VIEWPORT || '1920x1080').split('x').map(Number);
  const page = await browser.newPage({viewport: {width,height}, reducedMotion: 'reduce'});
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(45000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('classbank.selectedClassId', 'a');
    localStorage.setItem('classbank.startCheck.skip', '1');
  });
  const root = 'http://127.0.0.1:5586';
  const goto = async url => {
    if (!page.url().startsWith(root)) return page.goto(root + url, {waitUntil: 'domcontentloaded'});
    const finish = page.getByRole('button', {name: '수업 끝내기', exact: true});
    if (await finish.isVisible()) await finish.click();
    // Follow the same client-side routing as the app's links; avoid reloading fonts for every game.
    await page.evaluate(url => {
      history.pushState({usr: null, key: crypto.randomUUID(), idx: 100}, '', url);
      dispatchEvent(new PopStateEvent('popstate'));
    }, url);
  };
  await goto('/curriculum');
  const manifest = await page.evaluate(async () => {
    const {GAME_PAGES} = await import('/src/lib/gamePages.ts');
    const {PHONICS_GAMES, phonicsGameUnits, gameAvailability} = await import('/src/lib/phonicsGames.ts');
    const units = phonicsGameUnits();
    return {standard: Object.keys(GAME_PAGES), phonics: PHONICS_GAMES.map(game => ({id: game.id, unit: units.find(unit => !gameAvailability(game, unit))?.id}))};
  });
  const chosen = process.env.FIT_TYPES?.split(',');
  const shots = process.env.GAME_FIT_OUTPUT;
  if (shots) await mkdir(shots, {recursive: true});
  const failures = [];
  async function fitResult(type, mode) {
    const canvas = page.locator(`[data-game="${type}"] [data-game-canvas]:visible, [data-phonics-session="${type}"] [data-game-canvas]:visible`).first();
    await canvas.waitFor();
    await page.waitForFunction(() => {
      const canvas = [...document.querySelectorAll('[data-game-canvas]')].find(el => el.getBoundingClientRect().height > 0);
      return canvas?.dataset.gameScale;
    });
    await canvas.evaluate(async element => {
      await Promise.allSettled(element.getAnimations({subtree: true})
        .filter(animation => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().iterations)
          && animation.effect.getComputedTiming().endTime <= 2500)
        .map(animation => animation.finished));
    });
    await canvas.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const dimensions = await canvas.evaluate(canvas => {
      const stage = canvas.closest('[data-game-stage]');
      const box = canvas.parentElement.getBoundingClientRect();
      const r = stage.getBoundingClientRect();
      const style = getComputedStyle(stage);
      const matrix = new DOMMatrix(getComputedStyle(canvas).transform);
      const controls = [...canvas.querySelectorAll('button,input,select')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2 && !el.closest('[hidden], [data-game-management], [aria-hidden="true"]') && getComputedStyle(el).visibility !== 'hidden';
      });
      const outside = controls.filter(el => {
        const c = el.getBoundingClientRect();
        return c.left < r.left - 3 || c.right > r.right + 3 || c.top < r.top - 3 || c.bottom > r.bottom + 3;
      }).map(el => el.textContent?.trim().slice(0, 70));
      return {view: canvas.closest('[data-game-view]')?.getAttribute('data-game-view'), bounds: JSON.parse(canvas.dataset.gameBounds || 'null'), controls: outside.map(text => {const el=controls.find(el=>el.textContent?.trim().slice(0,70)===text);const r=el.getBoundingClientRect();return {text,x:r.x,y:r.y,w:r.width,h:r.height,display:getComputedStyle(el).display,position:getComputedStyle(el).position,zoom:getComputedStyle(el).zoom};}), scale: Number(canvas.dataset.gameScale), scaleY: matrix.d, scaleX: matrix.a,
        stage: {x:r.x,y:r.y,w:r.width,h:r.height}, box: {x:box.x,y:box.y,w:box.width,h:box.height},
        available: {w: stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), h: stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)}, outside};
    });
    results.push({type, mode, ...dimensions});
    try {
      const {stage, box, available} = dimensions;
      assert.equal(dimensions.view, mode, 'Wrong game view');
      assert(stage.w > 80 && stage.h > 80, 'No available game stage');
      assert(Math.abs(dimensions.scaleX - dimensions.scaleY) < .0001, 'Objects stretched');
      assert(box.x >= stage.x - 3 && box.y >= stage.y - 3 && box.x + box.w <= stage.x + stage.w + 3 && box.y + box.h <= stage.y + stage.h + 3, 'Fitted board outside stage');
      assert(Math.max(box.w / available.w, box.h / available.h) > .96, 'Game does not use available space');
      assert.deepEqual(dimensions.outside, [], 'Controls clipped by the game viewport');
      console.log('PASS fit', type, mode, dimensions.scale);
    } catch (error) {
      failures.push({type, mode, message: error.message, ...dimensions});
      console.log('FAIL fit', type, mode, JSON.stringify(dimensions));
    }
    if (shots && (chosen || ['wheel', 'twodice', 'wordclaw', 'balloonpop', 'wordtrain', 'grammardetective', 'sound-balloons'].includes(type))) {
      await page.screenshot({path: `${shots}/${type}-${mode}.jpg`});
    }
  }
  async function start(phonics = false) {
    if (phonics) {
      await page.locator('[data-game-start-card]').getByRole('button', {name: '게임 시작', exact: true}).click();
      return;
    }
    await page.waitForFunction(() => document.querySelector('[data-game-start-card]')
      || document.querySelector('[data-game="quizshow"]')
      || [...document.querySelectorAll('[data-game-stage]')].some(el => !el.inert));
    const button = page.locator('[data-game-start-card]').getByRole('button', {name: '게임 시작', exact: true});
    if (await button.count()) await button.click();
  }
  async function fullscreen(type) {
    await page.getByRole('button', {name: '전체화면', exact: true}).click();
    await page.waitForFunction(() => document.fullscreenElement);
    await fitResult(type, 'fullscreen');
    await page.evaluate(() => document.exitFullscreen());
  }
  const standard = manifest.standard.filter(path => !chosen || chosen.includes(path.split('/').pop()));
  const after = process.env.FIT_AFTER ? standard.findIndex(path => path.endsWith('/' + process.env.FIT_AFTER)) : 0;
  for (const path of standard.slice(Math.max(0, after))) {
    const type = path.split('/').pop();
    await page.evaluate(() => sessionStorage.removeItem('classbank.lessonRunner'));
    await goto(path);
    await page.locator(`[data-game="${type}"] [data-game-canvas]`).waitFor();
    await start();
    let retained;
    if (process.env.FIT_INTERACTIONS && type === 'twodice') {
      await page.getByRole('button', {name:'주사위 굴리기', exact:true}).click();
      await page.locator('.td-reading-word').getByText('—', {exact:true}).waitFor({state:'hidden'});
      retained = await page.locator('.td-reading-word').innerText();
    }
    if (process.env.FIT_INTERACTIONS && type === 'wheel') {
      await page.getByRole('button', {name:'돌리기', exact:true}).last().click();
      await page.locator('[data-wheel-result]').waitFor();
      retained = await page.locator('[data-wheel-result]').innerText();
    }
    if (process.env.FIT_INTERACTIONS && type === 'wordtrain') {
      await page.evaluate(async () => {
        const {readActivityDraft, writeActivityDraft, draftId} = await import('/src/lib/quickActivity.ts');
        const draft = readActivityDraft(draftId('teacher','academy','wordtrain'));
        const text = 'My friends and I are going to the library after school today because we want to read a wonderful story together.';
        writeActivityDraft({...draft, config:{...draft.config, adventure:{...draft.config.adventure, count:1, sentences:[{id:'long', text, tokens:text.split(' ')}]}}});
      });
      await page.locator('.ad-carriages .ad-piece').nth(20).waitFor();
    }
    if (process.env.FIT_INTERACTIONS && type === 'quiz') {
      await page.evaluate(async () => {
        const {readActivityDraft, writeActivityDraft, draftId} = await import('/src/lib/quickActivity.ts');
        const draft = readActivityDraft(draftId('teacher','academy','quiz'));
        const question = 'What would you like to do with your friends at the library after school on a rainy afternoon?';
        writeActivityDraft({...draft, config:{...draft.config, questions:[{id:'long-question', question, choices:['I would like to read an interesting story and talk about it with my friends.','I would like to play football outside in the heavy rain.','I would like to go swimming in the cold river.','I would like to ride my bicycle in the busy street.'], correctIndex:0}]}});
      });
      await goto('/games');
      await goto('/games/quiz');
      await page.locator('[data-game="quiz"] [data-game-canvas]').waitFor();
      await start();
      await page.getByText('What would you like to do with your friends at the library after school on a rainy afternoon?',{exact:true}).waitFor();
    }
    await fitResult(type, 'normal');
    await fullscreen(type);
    if (retained) {
      const target = type === 'wheel' ? '[data-wheel-result]' : '.td-reading-word';
      assert.equal(await page.locator(target).innerText(), retained, 'Fullscreen reset the game');
      await page.setViewportSize({width: 1366, height: 768});
      await fitResult(type, 'normal');
      assert.equal(await page.locator(target).innerText(), retained, 'Resize reset the game');
      await page.setViewportSize({width, height});
      console.log('PASS retained game state', type);
    }
    if (process.env.FIT_PRESENTATION !== '0') {
      await page.evaluate(async type => {
        const {readActivityDraft, draftId} = await import('/src/lib/quickActivity.ts');
        const db = window.__lessonQA;
        const {guideSample} = await import('/src/lib/gameGuide.ts');
        const draft = readActivityDraft(draftId('teacher', 'academy', type)) ?? db.templates.find(row => row.game_type === type)
          ?? {game_type: type, ...guideSample(type, {items: [], config: {grammarId: 'third-s'}})};
        const template = {...draft, id: `fit-${type}`, name: `Fit ${type}`};
        db.templates = [template];
        db.lessons.find(row => row.id === 'lesson-a').playlist = [{id: 'fit-slide', kind: 'game', gameType: type, templateId: template.id}];
        window.__saveLessonQA();
      }, type);
      await goto('/curriculum');
      await page.locator('#lesson-card-lesson-a').getByRole('button', {name:'수업 시작', exact:true}).click();
      await page.waitForURL(/\/games\//);
      await fitResult(type, 'presentation');
    }
  }
  for (const game of manifest.phonics.filter(game => !chosen || chosen.includes(game.id))) {
    assert(game.unit, `Missing phonics unit for ${game.id}`);
    await page.evaluate(() => sessionStorage.removeItem('classbank.lessonRunner'));
    await goto(`/phonics-games/${game.id}?unit=${encodeURIComponent(game.unit)}`);
    await start(true);
    await fitResult(game.id, 'normal');
    await fullscreen(game.id);
    if (process.env.FIT_PRESENTATION !== '0') {
      await page.evaluate(game => {
        window.__lessonQA.lessons.find(row => row.id === 'lesson-a').playlist = [{id:'fit-phonics', kind:'phonicsGame', gameId:game.id, unitId:game.unit}];
        window.__saveLessonQA();
      }, game);
      await goto('/curriculum');
      await page.locator('#lesson-card-lesson-a').getByRole('button', {name:'수업 시작', exact:true}).click();
      await fitResult(game.id, 'presentation');
    }
  }
  if (shots) await writeFile(`${shots}/fit-results.json`, JSON.stringify({results, failures, errors}, null, 2));
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  console.log(`PASS ${results.length} game viewport configurations`);
} finally {
  await browser?.close();
  await server.close();
}
