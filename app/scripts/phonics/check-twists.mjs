// 파닉스 게임 "판 구조"(별·콤보·팀 대결·난이도·소리 설명)와 끌어서 놓기를 실제 Chrome 으로 확인한다.
//   node --experimental-websocket scripts/phonics/check-play-layer.mjs
// 합성 계정과 가로챈 Supabase 요청만 쓰며 운영 DB 쓰기는 0건이다.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const out = '../output/phonics-games-twists';
await mkdir(out, { recursive: true });
const server = await createServer({ cacheDir: 'node_modules/.vite/qa-phonics-twists', server: { host: '127.0.0.1', port: 5266, strictPort: true }, logLevel: 'error' });
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
  const root = 'http://127.0.0.1:5266';
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


  // 1) 컨베이어: 소리 분류 공장은 카드 3장을 차례로 보내야 한 문제가 끝난다
  {
    const g = game('sorting-factory'), u = unit('course-2-1');
    await open(g.id, u.id, { rounds: 3 });
    const pool = gamePool(g, u);
    const chip = page.locator('.pg-twist');
    await chip.getByText('카드 1 / 3').waitFor();
    for (let i = 0; i < 3; i++) {
      const word = (await page.locator('.pg-drag-card .pg-word').first().innerText()).replace(/\s+/g, '');
      const entry = pool.find((e) => e.word === word); assert(entry, `카드 낱말 ${word}`);
      assert.equal(await page.locator('.pg-next').count(), 0, '카드가 남았으면 다음 문제 버튼이 없다');
      await page.locator(`.pg-baskets>button[data-drop="${patternKey(u, entry)}"]`).click();
      if (i < 2) await chip.getByText(`카드 ${i + 2} / 3`).waitFor();
    }
    await page.locator('.pg-next').waitFor();
    assert.match(await hud(), /3 \/ 9/, '3장 모두 첫 시도에 맞히면 별 3개');
    await page.screenshot({ path: `${out}/conveyor.png` });
    console.log('PASS conveyor: three cards in a row, one round');
  }

  // 2) 소리만 듣고 고르기: oo / ow 갈림길은 낱말 글자를 숨기고 듣기 버튼만 보인다
  {
    for (const id of ['two-oo', 'ow-crossroads']) {
      const g = game(id), u = units.find((x) => !model.gameAvailability(g, x));
      assert(u, `${id}: 가능한 유닛`);
      await open(g.id, u.id, { rounds: 3 });
      assert.equal(await page.locator('.pg-drag-card .pg-word').count(), 0, `${id}: 글자를 숨긴다`);
      assert.equal(await page.locator('.pg-drag-card [data-learning-audio]').count(), 1, `${id}: 듣기 버튼`);
      await page.locator('.pg-twist').getByText('소리만 듣고 골라요').waitFor();
      const r = makeRound(g, u, 0, 123);
      const key = id === 'ow-crossroads' ? patternKey(u, r.entry) : patternKey(u, r.entry);
      await page.locator(`.pg-baskets>button[data-drop="${key}"]`).click();
      await page.locator('.pg-next').waitFor();
    }
    console.log('PASS listen-only: oo and ow hide the written word');
  }

  // 3) 같은 단어, 다른 모습: 소리 낚시 2번째 문제는 그림을 보고 단어를 찾는다
  {
    const g = game('sound-fishing'), u = unit('course-2-1');
    await open(g.id, u.id, { rounds: 6 });
    assert.equal(await page.locator('.pg-twist').getByText('이번엔 이렇게 해요').count(), 0, '첫 문제는 원래 모습');
    const r0 = makeRound(g, u, 0, 123);
    await page.locator('.pg-options>button').nth(r0.options.findIndex((e) => e.id === r0.entry.id)).click();
    await next();
    await page.locator('.pg-twist').getByText('이번엔 이렇게 해요').waitFor();
    await page.getByText('그림을 보고 알맞은 단어를 찾아요.').waitFor();
    assert.equal(await page.locator('.pg-options img').count(), 0, '보기는 단어 글자');
    const r1 = makeRound(g, u, 1, 123);
    await page.locator('.pg-options>button').nth(r1.options.findIndex((e) => e.id === r1.entry.id)).click();
    await page.locator('.pg-next').waitFor();
    await page.screenshot({ path: `${out}/form-picture-word.png` });
    console.log('PASS forms: same word shown another way in round 2');
  }

  // 4) 시간 도전: 쉬움은 시간 없음, 보통은 숫자가 줄고, 끝나면 정답이 반짝이며 별은 2개까지
  {
    const g = game('sound-balloons'), u = unit('course-1-1');
    await open(g.id, u.id, { rounds: 3, level: 'easy' });
    assert.equal(await page.locator('.pg-clock').count(), 0, '쉬움에는 시계가 없다');
    await open(g.id, u.id, { rounds: 3 });
    const secs = async () => Number((await page.locator('.pg-clock').innerText()).replace(/\D/g, ''));
    const t0 = await secs();
    assert.equal(t0, 12);
    await page.waitForTimeout(2300);
    assert((await secs()) <= 10);
    // 잠시 멈춤 동안 시계도 멈춘다
    await page.getByRole('button', { name: '잠시 멈춤' }).click();
    const frozen = await secs();
    await page.waitForTimeout(2200);
    assert.equal(await secs(), frozen, '멈춤 중에는 시간이 줄지 않는다');
    await page.getByRole('button', { name: '계속하기' }).first().click();
    await page.getByText('시간이 다 됐어요', { exact: false }).waitFor({ timeout: 20000 });
    assert.equal(await page.locator('[data-hint=true]').count(), 1);
    await page.screenshot({ path: `${out}/clock-timeout.png` });
    await page.locator('[data-hint=true]').click();
    await page.locator('.pg-next').waitFor();
    assert.match(await hud(), /2 \/ 9/, '시간 초과는 도움 후 완성 = 별 2개');
    console.log('PASS clock: easy has none, counts down, pauses, timeout reveals the answer (max 2 stars)');
  }

  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log('ALL PASS: per-game rules (no database writes)');
} finally {
  await browser?.close();
  await server.close();
}
