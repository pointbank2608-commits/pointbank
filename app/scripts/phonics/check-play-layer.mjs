// 파닉스 게임 "판 구조"(별·콤보·팀 대결·난이도·소리 설명)와 끌어서 놓기를 실제 Chrome 으로 확인한다.
//   node --experimental-websocket scripts/phonics/check-play-layer.mjs
// 합성 계정과 가로챈 Supabase 요청만 쓰며 운영 DB 쓰기는 0건이다.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const out = '../output/phonics-games-play-layer';
await mkdir(out, { recursive: true });
const server = await createServer({ cacheDir: 'node_modules/.vite/qa-phonics-play-layer', server: { host: '127.0.0.1', port: 5265, strictPort: true }, logLevel: 'error' });
await server.listen();
let browser;
try {
  const model = await server.ssrLoadModule('/src/lib/phonicsGames.ts');
  const { PHONICS_GAMES: games, phonicsGameUnits, makeRound, patternKey, gamePool } = model;
  const units = phonicsGameUnits();
  const game = (id) => games.find((g) => g.id === id);
  const unit = (id) => units.find((u) => u.id === id);

  const env = await readFile('.env.local', 'utf8');
  const ref = env.match(/VITE_SUPABASE_URL=https:\/\/([^.]+)/)[1];
  const uid = '00000000-0000-4000-8000-000000000001', aid = '00000000-0000-4000-8000-0000000000aa', exp = Math.floor(Date.now() / 1000) + 86400;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'phonics-qa@example.test', app_metadata: {}, user_metadata: {} };
  const session = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, role: 'authenticated', exp, aud: 'authenticated' })}.test-only`, refresh_token: 'test-only', expires_at: exp, expires_in: 86400, token_type: 'bearer', user };
  const profile = { id: uid, academy_id: aid, role: 'owner', display_name: 'Phonics QA' };
  const academy = { id: aid, name: 'Phonics QA', point_unit: '별', plan: 'paid', plan_status: 'active', deletion_requested_at: null, features: { group: true, solo: true, homework: true } };
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
    localStorage.setItem('classbank.lang', 'ko');
    crypto.getRandomValues = (a) => { a.fill(123); return a; };
    window.__spoken = [];
    speechSynthesis.speak = (u) => { window.__spoken.push(u.text); u.onend?.(); };
  }, { key: `sb-${ref}-auth-token`, session });
  const writes = [], errors = [];
  await context.route('**/*.supabase.co/**', async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (!['GET', 'HEAD'].includes(req.method()) && !path.includes('/auth/') && !path.includes('/rpc/')) writes.push(path);
    const single = (req.headers().accept || '').includes('vnd.pgrst.object');
    let data = single ? {} : [];
    if (path.includes('/auth/v1/user')) data = user; else if (path.includes('/auth/v1/')) data = session;
    else if (path.endsWith('/profiles')) data = single ? profile : [profile];
    else if (path.endsWith('/academies')) data = single ? academy : [academy];
    else if (path.endsWith('/classes')) data = [{ id: 'class-qa', academy_id: aid, name: '검증 반' }];
    else if (path.endsWith('/rpc/my_deletion_request')) data = null;
    return route.fulfill({ status: 200, headers, json: data });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(30000);
  const root = 'http://127.0.0.1:5265';
  const box = async (locator) => { const b = await locator.boundingBox(); assert(b, 'no box'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const drag = async (from, to, shot) => {
    await page.waitForTimeout(350); // 카드가 제자리로 돌아오는 움직임이 끝난 뒤에 잡는다
    const a = await box(from); const b = await box(to);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y + 20, { steps: 3 }); await page.mouse.move(b.x, b.y, { steps: 12 });
    if (shot) await page.screenshot({ path: `${out}/${shot}.png` });
    await page.mouse.up();
  };
  const open = async (id, unitId, opts = {}) => {
    await page.goto(`${root}/phonics-games/${id}?unit=${unitId}`);
    await page.getByRole('button', { name: '게임 시작', exact: true }).waitFor();
    await page.getByLabel('문제 수', { exact: true }).selectOption(String(opts.rounds ?? 3));
    if (opts.teams) await page.getByLabel('팀', { exact: true }).selectOption(String(opts.teams));
    if (opts.level) await page.getByLabel('난이도', { exact: true }).selectOption(opts.level);
    if (opts.speak) await page.getByLabel(/설명을 소리로 읽어 줘요/).check();
    await page.getByRole('button', { name: '게임 시작', exact: true }).click();
    await page.locator('[data-activity]').waitFor();
  };
  const next = async () => { await page.locator('.pg-next').waitFor(); await page.locator('.pg-next').click(); };
  const hud = () => page.locator('.pg-hud-stars').innerText();

  // 1) 시작 전 설정 화면에 새 선택이 있다
  await page.goto(`${root}/phonics-games/sound-fishing?unit=course-2-1`);
  await page.getByRole('button', { name: '게임 시작', exact: true }).waitFor();
  for (const label of ['팀', '난이도']) assert.equal(await page.getByLabel(label, { exact: true }).count(), 1, label);
  assert.equal(await page.getByLabel(/설명을 소리로 읽어 줘요/).isChecked(), false);
  await page.screenshot({ path: `${out}/setup.png` });
  console.log('PASS setup shows teams, difficulty and read-aloud options');

  // 2) 분류: 단어 카드를 바구니로 끌어 놓기(틀린 곳 → 다시, 맞는 곳 → 완성), 별 3개
  {
    const g = game('family-homes'), u = unit('course-2-1');
    await open(g.id, u.id, { rounds: 3 });
    assert.match(await hud(), /0 \/ 9/);
    const r = makeRound(g, u, 0, 123);
    const groups = [...new Map(gamePool(g, u).map((e) => [patternKey(u, e), e])).values()];
    const rightKey = patternKey(u, r.entry), wrongKey = groups.map((e) => patternKey(u, e)).find((k) => k !== rightKey);
    const card = page.locator('.pg-drag-card');
    await drag(card, page.locator(`.pg-baskets>button[data-drop="${wrongKey}"]`));
    await page.getByText('다시 살펴볼까요?', { exact: false }).waitFor();
    assert.equal(await page.locator('.pg-next').count(), 0);
    await drag(card, page.locator(`.pg-baskets>button[data-drop="${rightKey}"]`), 'sort-dragging');
    await page.locator('.pg-burst').waitFor({ state: 'attached' });
    await page.locator('.pg-next').waitFor();
    assert.match(await hud(), /2 \/ 9/, '한 번 틀린 뒤 맞히면 별 2개');
    await page.screenshot({ path: `${out}/sort-drag.png` });
    console.log('PASS sort: drag word card to a basket (wrong then right) gives 2 stars and a burst');
  }

  // 3) 빈칸: 글자 조각을 빈칸으로 끌어 놓기 + 첫 시도 3개 별, 콤보 3 보너스
  {
    const g = game('vowel-repair'), u = unit('course-2-1');
    await open(g.id, u.id, { rounds: 3 });
    for (let i = 0; i < 3; i++) {
      const r = makeRound(g, u, i, 123);
      await drag(page.locator('.pg-token-bank').getByRole('button', { name: r.answer, exact: true }), page.locator('.pg-blank'), i === 0 ? 'fill-dragging' : undefined);
      await page.locator('.pg-next').waitFor();
      assert.equal(await page.locator('.pg-blank-filled').innerText(), r.answer);
      if (i === 0) assert.match(await hud(), /3 \/ 9/);
      if (i === 1) assert.match(await hud(), /6 \/ 9/);
      if (i === 2) { assert.match(await hud(), /10 \/ 9/, '3연속 첫 시도는 콤보 보너스 +1'); await page.waitForTimeout(450); await page.screenshot({ path: `${out}/fill-drag-combo.png` }); }
      await page.locator('.pg-next').click();
    }
    await page.getByText('첫 시도에 혼자 맞힘: 3', { exact: false }).waitFor();
    assert.equal(await page.locator('.pg-rating-on').count(), 3);
    await page.getByText('모은 별 10개', { exact: false }).waitFor();
    await page.waitForTimeout(1800); await page.screenshot({ path: `${out}/results-stars.png` });
    console.log('PASS fill: drag letter piece into blank, 3-in-a-row combo bonus, 3-star result');
  }

  // 4) 고르기: 그림을 친구에게 끌어다 주기 + 클릭도 계속 동작
  {
    const g = game('sound-fishing'), u = unit('course-2-1');
    await open(g.id, u.id, { rounds: 3 });
    const r = makeRound(g, u, 0, 123);
    await drag(page.locator('.pg-options>button').nth(r.options.findIndex((e) => e.id === r.entry.id)), page.locator('.pg-stage-drop'));
    await page.locator('.pg-next').waitFor();
    await page.locator('.pg-next').click();
    const r1 = makeRound(g, u, 1, 123);
    await page.locator('.pg-options>button').nth(r1.options.findIndex((e) => e.id === r1.entry.id)).click();
    await page.locator('.pg-next').waitFor();
    console.log('PASS choice: drag a picture to the friend, and plain tap still works');
  }

  // 5) 팀 대결: 차례가 번갈아 가고 결과에 순위
  {
    const g = game('sound-fishing'), u = unit('course-2-1');
    await open(g.id, u.id, { rounds: 3, teams: 2 });
    await page.getByText('빨강팀 차례예요!', { exact: true }).waitFor();
    const answer = async (i) => { const r = makeRound(g, u, i, 123); await page.locator('.pg-options>button').nth(r.options.findIndex((e) => e.id === r.entry.id)).click(); await next(); };
    await answer(0);
    await page.getByText('파랑팀 차례예요!', { exact: true }).waitFor();
    await answer(1);
    await page.getByText('빨강팀 차례예요!', { exact: true }).waitFor();
    await answer(2);
    assert.equal(await page.locator('.pg-team-ranking li').count(), 2);
    assert.match(await page.locator('.pg-team-ranking li').first().innerText(), /빨강팀 · 6/, '빨강팀 두 문제 = 별 6');
    await page.screenshot({ path: `${out}/team-results.png` });
    console.log('PASS teams: turns alternate and the result ranks the teams');
  }

  // 6) 난이도: 도전은 그림을 숨기고, 쉬움은 글자도 보여 준다
  {
    const g = game('sound-train'), u = unit('course-2-1');
    await open(g.id, u.id, { rounds: 3, level: 'hard' });
    assert.equal(await page.locator('.pg-cue .pg-picture').count(), 0);
    await page.locator('.pg-listen-only').waitFor();
    await open(g.id, u.id, { rounds: 3, level: 'easy' });
    assert.equal(await page.locator('.pg-cue .pg-word').count(), 1);
    await open(g.id, u.id, { rounds: 3, level: 'normal' });
    assert.equal(await page.locator('.pg-cue .pg-word').count(), 0);
    console.log('PASS difficulty: challenge hides the picture, easy adds the written word');
  }

  // 7) 소리 설명: 자동 읽기와 설명 듣기 버튼
  {
    const g = game('family-homes'), u = unit('course-2-1');
    await open(g.id, u.id, { rounds: 3, speak: true });
    await page.waitForFunction(() => window.__spoken.length > 0);
    assert.match(await page.evaluate(() => window.__spoken.at(-1)), /끌어서/);
    await page.evaluate(() => { window.__spoken.length = 0; });
    await page.getByRole('button', { name: '설명 듣기', exact: false }).click();
    assert.match(await page.evaluate(() => window.__spoken.at(-1)), /끌어서/);
    await page.reload();
    await page.getByRole('button', { name: '게임 시작', exact: true }).waitFor();
    assert.equal(await page.getByLabel(/설명을 소리로 읽어 줘요/).isChecked(), true, '선택이 기억된다');
    console.log('PASS read-aloud: instruction is spoken automatically and on request, choice is remembered');
  }

  // 8) 정답·오답 안내가 화면 크기를 바꾸지 않고, 다음 버튼은 늘 화면 안에서 보인다(전자칠판 1366×768)
  {
    await page.setViewportSize({ width: 1366, height: 768 });
    for (const [id, unitId] of [['sound-fishing', 'course-2-1'], ['vowel-repair', 'course-2-1'], ['magic-lab', 'course-3-1']]) {
      const g = game(id), u = unit(unitId);
      await open(g.id, u.id, { rounds: 3 });
      const height = () => page.evaluate(() => document.querySelector('.pg-session').getBoundingClientRect().height);
      const before = await height();
      const r = makeRound(g, u, 0, 123);
      if (id === 'sound-fishing') {
        const wrong = r.options.findIndex((e) => e.id !== r.entry.id);
        await page.locator('.pg-options>button').nth(wrong).click();
        await page.getByText('다시 살펴볼까요?', { exact: false }).waitFor();
        assert((await height()) <= before + 2, `${id}: 오답 안내로 화면이 늘어남`);
        await page.getByText('다시 살펴볼까요?', { exact: false }).waitFor({ state: 'detached', timeout: 6000 });
        await page.locator('.pg-options>button').nth(r.options.findIndex((e) => e.id === r.entry.id)).click();
      } else if (id === 'vowel-repair') {
        await page.locator('.pg-token-bank').getByRole('button', { name: r.answer, exact: true }).click();
      } else {
        for (const i of [r.entry.word.length - 1]) await page.locator('.pg-magic-word button').nth(i).click();
      }
      await page.locator('.pg-next').waitFor();
      assert((await height()) <= before + 2, `${id}: 정답 뒤 화면이 늘어남(${before} → ${await height()})`);
      const b = await page.locator('.pg-next').boundingBox();
      assert(b && b.y >= 0 && b.y + b.height <= 768, `${id}: 다음 버튼이 화면 밖(${JSON.stringify(b)})`);
      assert.equal(await page.locator('.pg-next').isDisabled(), true, '정답 직후에는 잠깐 잠겨 있다');
      await page.waitForFunction(() => !document.querySelector('.pg-next').disabled);
      await page.screenshot({ path: `${out}/dock-${id}.png` });
      await page.keyboard.press('Enter');
      await page.getByText('2 / 3', { exact: true }).waitFor();
    }
    await page.setViewportSize({ width: 1440, height: 1200 });
    console.log('PASS dock: solve/wrong notices keep the play area size, next button stays on screen at 1366x768 and Enter advances');
  }

  // 9) 힌트: 화면 크기가 안 바뀌고, 1단계는 친구 말풍선+소리, 2단계는 정답 반짝임, 쓴 문제는 별 최대 2개
  {
    await page.setViewportSize({ width: 1366, height: 768 });
    for (const [id, unitId, answerSel] of [['sound-fishing', 'course-2-1', '.pg-options>button'], ['family-homes', 'course-2-1', '.pg-baskets>button'], ['vowel-repair', 'course-2-1', '.pg-token-bank>button']]) {
      const g = game(id), u = unit(unitId);
      await open(g.id, u.id, { rounds: 3 });
      const height = () => page.evaluate(() => document.querySelector('.pg-session').getBoundingClientRect().height);
      const before = await height();
      await page.evaluate(() => { window.__spoken.length = 0; });
      await page.getByRole('button', { name: '힌트 보기' }).click();
      await page.locator('.pg-caption-hint').waitFor();
      assert((await height()) === before, `${id}: 힌트 1단계에서 화면 크기가 바뀜`);
      assert.equal(await page.locator('[data-hint=true]').count(), 0, '1단계에는 반짝임이 없다');
      if (id !== 'family-homes') assert((await page.evaluate(() => window.__spoken.length)) > 0, '힌트 단어를 읽어 준다');
      await page.getByRole('button', { name: '힌트 보기' }).click();
      assert.equal(await page.locator('[data-hint=true]').count(), 1, `${id}: 2단계에는 정답 하나가 반짝인다`);
      assert((await height()) === before, `${id}: 힌트 2단계에서 화면 크기가 바뀜`);
      await page.screenshot({ path: `${out}/hint-${id}.png` });
      await page.locator('[data-hint=true]').click();
      await page.locator('.pg-next').waitFor();
      assert.match(await hud(), /2 \/ 9/, `${id}: 힌트를 쓴 문제는 별 2개`);
    }
    await page.setViewportSize({ width: 1440, height: 1200 });
    console.log('PASS hint: friend whispers in the bubble, answer glows on the second press, no size change, stars cap at 2');
  }

  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log('ALL PASS: play layer and drag-and-drop (no database writes)');
} finally {
  await browser?.close();
  await server.close();
}
