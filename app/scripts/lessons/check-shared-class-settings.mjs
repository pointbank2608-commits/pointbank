import assert from 'node:assert/strict';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { createLessonUxServer } from './ux-server.mjs';

const server = await createLessonUxServer(5585);
let browser;
try {
  await server.listen();
  browser = await chromium.launch({channel: 'chrome', headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('classbank.selectedClassId', 'a');
    localStorage.setItem('classbank.startCheck.skip', '1');
    Element.prototype.requestFullscreen = async () => {};
  });
  const root = 'http://127.0.0.1:5585';
  const navigate = url => page.goto(url, {waitUntil: 'domcontentloaded'});
  await page.route('**/*.supabase.co/**', route => route.abort());
  await navigate(root + '/curriculum');
  await page.waitForFunction(() => window.__lessonQA);
  const manifest = await page.evaluate(async () => {
    const { GAME_PAGES } = await import('/src/lib/gamePages.ts');
    const { PHONICS_GAMES, phonicsGameUnits, gameAvailability } = await import('/src/lib/phonicsGames.ts');
    const units = phonicsGameUnits();
    window.__lessonQA.students = {a: ['하늘', '바다', '결석 학생'].map((name, i) => ({id: `student-${i}`, name}))};
    window.__saveLessonQA();
    return {standard: Object.keys(GAME_PAGES), phonics: PHONICS_GAMES.map(game => ({id: game.id, unit: units.find(unit => !gameAvailability(game, unit))?.id}))};
  });
  const panel = page.locator('[data-game-toolbar-panel="class"]');
  const openClass = () => page.locator('[data-game-toolbar]').getByRole('button', {name: '반 설정', exact: true}).click();
  const apply = async () => {
    await panel.getByRole('button', {name: '적용', exact: true}).click();
    await panel.waitFor({state: 'hidden'});
  };
  const orderDialog = page.getByRole('dialog', {name: '팀 나누기 · 순서 정하기', exact: true});
  const openOrder = () => panel.getByRole('button', {name: '팀·순서 정하기 (반 명단)', exact: true}).click();
  async function checkFields() {
    await panel.locator('[data-class-settings-fields]').waitFor();
    for (const name of ['없음', '개인', '팀']) assert(await panel.getByRole('button', {name, exact: true}).isVisible());
    await panel.getByRole('button', {name: '팀', exact: true}).click();
    await panel.locator('select').selectOption('a');
    await panel.getByRole('button', {name: '팀·순서 정하기 (반 명단)', exact: true}).waitFor();
    assert(await panel.getByRole('button', {name: /^결석 학생 제외/}).isVisible());
    assert(await panel.getByRole('button', {name: '팀 하나 늘리기', exact: true}).count());
    await panel.evaluate(el => {el.scrollTop = el.scrollHeight;});
    const gap = await panel.getByRole('button', {name: '팀·순서 정하기 (반 명단)', exact: true}).evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.closest('[data-game-toolbar-panel]').querySelector('.sticky.bottom-0').getBoundingClientRect().top - r.bottom;
    });
    assert(gap >= 24, `Footer spacing ${gap}`);
    const auto = panel.getByRole('checkbox', {name: '한 판이 끝나면 자동으로 다음 차례로 넘기기', exact: true});
    if (await auto.count()) assert.equal(await auto.evaluate(el => getComputedStyle(el.closest('label')).flexDirection), 'row');
  }
  for (const path of manifest.standard.filter(path => !process.env.CLASS_SETTINGS_DEEP_ONLY || path === '/games/twodice')) {
    await navigate(root + path);
    await openClass();
    await checkFields();
    await panel.getByRole('button', {name: '닫기', exact: true}).click();
    console.log('PASS shared standard class panel', path);
  }
  for (const game of manifest.phonics.filter(game => !process.env.CLASS_SETTINGS_DEEP_ONLY || game.id === 'sound-balloons')) {
    assert(game.unit, `No playable unit for ${game.id}`);
    await navigate(`${root}/phonics-games/${game.id}?unit=${encodeURIComponent(game.unit)}`);
    await page.locator('[data-game-start-card]').getByRole('button', {name: '게임 시작', exact: true}).click();
    await openClass();
    await checkFields();
    if (process.env.CLASS_SETTINGS_SCREENSHOTS && game.id === 'sound-balloons') await page.screenshot({path: process.env.CLASS_SETTINGS_SCREENSHOTS + '/phonics-shared-class-settings.jpg'});
    await panel.getByRole('button', {name: '닫기', exact: true}).click();
    if (game.id === 'sound-balloons') {
      await page.setViewportSize({width: 820, height: 700});
      await openClass();
      await checkFields();
      await panel.getByRole('button', {name: '닫기', exact: true}).click();
      await page.setViewportSize({width: 1440, height: 1000});
    }
    console.log('PASS shared phonics class panel', game.id);
  }

  // Persist one local slide; the duplicate and the legacy teams-only slide must remain independent.
  const game = manifest.phonics.find(row => row.id === 'sound-balloons');
  await navigate(root + '/curriculum');
  await page.evaluate(game => {
    window.__lessonQA.lessons.find(row => row.id === 'lesson-a').playlist = [
      {id: 'phonics-a', kind: 'phonicsGame', gameId: game.id, unitId: game.unit, teams: 2},
      {id: 'phonics-b', kind: 'phonicsGame', gameId: game.id, unitId: game.unit, teams: 2},
    ];
    window.__saveLessonQA();
  }, game);
  await page.reload();
  const lesson = page.locator('#lesson-card-lesson-a');
  const form = page.locator('[data-lesson-edit-form]');
  await lesson.getByRole('button', {name: '수정', exact: true}).click();
  await form.locator('[data-slide-id="phonics-a"]').click();
  await openClass();
  await panel.locator('select').selectOption('a');
  await panel.getByRole('button', {name: /^결석 학생 제외/}).click();
  await panel.getByRole('checkbox', {name: '결석 학생', exact: true}).check();
  await panel.getByRole('button', {name: '팀 하나 늘리기', exact: true}).click();
  await panel.getByRole('button', {name: '팀 하나 줄이기', exact: true}).click();
  await openOrder();
  await orderDialog.getByRole('textbox', {name: '1팀 이름', exact: true}).fill('해팀');
  await orderDialog.getByRole('textbox', {name: '2팀 이름', exact: true}).fill('달팀');
  await orderDialog.getByRole('button', {name: '위로 이동', exact: true}).nth(1).click();
  await orderDialog.getByRole('button', {name: '적용', exact: true}).click();
  await apply();
  await form.getByRole('button', {name: '저장', exact: true}).click();
  await form.waitFor({state: 'hidden'});
  await page.reload();
  const slides = await page.evaluate(() => window.__lessonQA.lessons.find(row => row.id === 'lesson-a').playlist);
  assert.equal(slides[0].classPlay.classId, 'a');
  assert.equal(slides[0].classPlay.order.order[0], 'team-1');
  assert.equal(slides[0].classPlay.order.teamNames['team-1'], '달팀');
  assert.deepEqual(slides[0].classPlay.absentIds, ['student-2']);
  assert.equal(slides[1].classPlay, undefined);
  assert.equal(slides[1].teams, 2);
  await lesson.getByRole('button', {name: '수업 시작', exact: true}).click();
  const strip = page.locator('[data-phonics-session] [data-turn-bar]');
  await strip.locator('strong').getByText('달팀', {exact: true}).waitFor();
  await strip.getByRole('button', {name: '다음 차례', exact: true}).click();
  await strip.locator('strong').getByText('해팀', {exact: true}).waitFor();
  console.log('PASS phonics save/reopen/presentation, named and reordered teams, absent student and independent duplicate');

  await navigate(root + '/curriculum');
  await lesson.getByRole('button', {name: '수정', exact: true}).click();
  await form.locator('[data-slide-id="phonics-a"]').click();
  await openClass();
  await panel.getByRole('button', {name: '개인', exact: true}).click();
  await apply();
  await form.getByRole('button', {name: '저장', exact: true}).click();
  await form.waitFor({state: 'hidden'});
  await page.reload();
  await lesson.getByRole('button', {name: '수업 시작', exact: true}).click();
  await strip.locator('strong').getByText('하늘', {exact: true}).waitFor();
  await strip.getByRole('button', {name: '다음 차례', exact: true}).click();
  await strip.locator('strong').getByText('바다', {exact: true}).waitFor();
  await strip.getByRole('button', {name: '다음 차례', exact: true}).click();
  await strip.locator('strong').getByText('하늘', {exact: true}).waitFor();
  async function completeRound() {
    const choices = page.locator('.pg-learning-content .pg-options button');
    for (let i = 0; i < await choices.count(); i++) {
      if (await page.locator('[data-state="solved"]').isVisible()) break;
      await choices.nth(i).click();
    }
    await page.getByRole('button', {name: '다음 문제', exact: true}).click();
  }
  await completeRound();
  await strip.locator('strong').getByText('바다', {exact: true}).waitFor();
  await openClass();
  await panel.getByRole('checkbox', {name: '한 판이 끝나면 자동으로 다음 차례로 넘기기', exact: true}).uncheck();
  await apply();
  await strip.locator('strong').getByText('하늘', {exact: true}).waitFor();
  await completeRound();
  await strip.locator('strong').getByText('하늘', {exact: true}).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS individual turns exclude absent students; automatic and manual round advance');
  if (!process.env.CLASS_SETTINGS_DEEP_ONLY) console.log(`PASS ${manifest.standard.length} standard games + ${manifest.phonics.length} phonics games`);
} finally {
  await browser?.close();
  await server.close();
}
