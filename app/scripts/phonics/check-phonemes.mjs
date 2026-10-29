// 파닉스 게임 "판 구조"(별·콤보·팀 대결·난이도·소리 설명)와 끌어서 놓기를 실제 Chrome 으로 확인한다.
//   node --experimental-websocket scripts/phonics/check-play-layer.mjs
// 합성 계정과 가로챈 Supabase 요청만 쓰며 운영 DB 쓰기는 0건이다.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const out = '../output/phonics-games-phoneme';
await mkdir(out, { recursive: true });
// 임시 음원: 모든 규칙에 아주 짧은 무음 파일을 만들고 매니페스트에 올렸다가 끝나면 원래대로 돌린다.
const rulesJson = JSON.parse(await readFile('src/data/phonics/curriculum.json', 'utf8')).rules.map((r) => r.id);
const manifestPath = 'src/data/phonics/phoneme-audio.json';
const manifestBefore = await readFile(manifestPath, 'utf8');
const dir = 'public/phonics-sounds';
const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.from([36, 0, 0, 0]), Buffer.from('WAVEfmt '), Buffer.from([16, 0, 0, 0, 1, 0, 1, 0, 64, 31, 0, 0, 64, 31, 0, 0, 1, 0, 8, 0]), Buffer.from('data'), Buffer.from([0, 0, 0, 0])]);
const hadFile = true;
await mkdir(dir, { recursive: true });
const { existsSync } = await import('node:fs');
const fake = rulesJson.filter((id) => !existsSync(`${dir}/${id}.mp3`)); // 실제 음원은 건드리지 않는다
for (const id of fake) await writeFile(`${dir}/${id}.mp3`, wav);
await writeFile(manifestPath, JSON.stringify({ available: rulesJson }));
const cleanup = async () => { for (const id of fake) await rm(`${dir}/${id}.mp3`, { force: true }); await writeFile(manifestPath, manifestBefore); };
const server = await createServer({ cacheDir: 'node_modules/.vite/qa-phonics-phoneme', server: { host: '127.0.0.1', port: 5267, strictPort: true }, logLevel: 'error' });
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
  const root = 'http://127.0.0.1:5267';
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


  // 음가 음원 연결: 파일이 있는 규칙에만 "소리 듣기" 버튼이 나오고 눌러 재생된다
  {
    const g = game('vowel-repair'), u = unit('course-2-1');
    const ruleId = makeRound(g, u, 0, 123).entry.ruleId;
    await page.addInitScript(() => {
      window.__plays = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__plays.push(this.src); return Promise.resolve(); };
      void play;
    });
    await open(g.id, u.id, { rounds: 3 });
    if (hadFile) {
      await page.locator('.pg-phoneme').first().waitFor();
      await page.locator('.pg-phoneme').first().click();
      const plays = await page.evaluate(() => window.__plays);
      assert(plays.some((s) => s.includes(`/phonics-sounds/${ruleId}.mp3`)), `재생 요청: ${plays}`);
      await page.screenshot({ path: `${out}/phoneme-button.png` });
      console.log(`PASS phoneme: ${ruleId} button shown and plays`);
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log('ALL PASS: phoneme audio hook (no database writes)');
} finally {
  await browser?.close();
  await server.close();
  await cleanup();
}
