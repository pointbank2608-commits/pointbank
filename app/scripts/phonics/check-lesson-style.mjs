// 파닉스 게임 "판 구조"(별·콤보·팀 대결·난이도·소리 설명)와 끌어서 놓기를 실제 Chrome 으로 확인한다.
//   node --experimental-websocket scripts/phonics/check-play-layer.mjs
// 합성 계정과 가로챈 Supabase 요청만 쓰며 운영 DB 쓰기는 0건이다.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const out = '../output/lesson-style';
await mkdir(out, { recursive: true });
const server = await createServer({ cacheDir: 'node_modules/.vite/qa-lesson-style', server: { host: '127.0.0.1', port: 5268, strictPort: true }, logLevel: 'error' });
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
  }, { key: `sb-${ref}-auth-token`, session });  const writes = [], errors = [], posts = [];
  const lessonSlides = [
    { id: 's1', kind: 'wordshow', boardTheme: 'green', words: [{ id: 'old', word: 'oldword', meaning: '옛', imageUrl: null }] },
    { id: 's2', kind: 'study', words: [{ id: 'old', word: 'oldword', meaning: '옛', imageUrl: null }] },
    { id: 's3', kind: 'game', gameType: 'matchup', templateId: 'tpl-old', ownWordListId: 'wl-old' },
    { id: 's4', kind: 'game', gameType: 'unscramble', templateId: 'tpl-old2' },
    { id: 's5', kind: 'canvas', elements: [], background: 'white' },
  ];
  const lesson = { id: 'lesson-1', academy_id: aid, class_id: 'class-qa', name: '원본 수업', word_list_id: 'wl-old', video_url: null, level: null, playlist: lessonSlides, created_by: uid, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
  const mk = (id, name, kind, rows) => ({ id, academy_id: aid, class_id: 'class-qa', name, kind, items: rows.map((r, i) => ({ id: `${id}-${i}`, word: r[0], meaning: r[1], example: r[2] ?? null, image_url: null, category: null })), created_by: uid, created_at: '2026-10-02T00:00:00Z' });
  const wordList = mk('wl-new', '새 단어장', 'word', [['apple', '사과', 'I eat an apple.'], ['banana', '바나나', 'She likes a banana.'], ['cat', '고양이', 'The cat is small.'], ['dog', '개'], ['egg', '달걀'], ['fish', '물고기']]);
  const sentenceList = mk('sl-1', '내 문장', 'sentence', [['I like apples.', '나는 사과를 좋아해요.'], ['She has a red hat.', '그녀는 빨간 모자가 있어요.'], ['We play in the park.', '우리는 공원에서 놀아요.']]);
  await context.route('**/*.supabase.co/**', async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const method = req.method();
    const single = (req.headers().accept || '').includes('vnd.pgrst.object');
    if (method === 'POST' && (path.endsWith('/game_templates') || path.endsWith('/curriculum_lessons'))) {
      const body = JSON.parse(req.postData() || '{}');
      posts.push({ table: path.split('/').pop(), body });
      const row = { id: `new-${posts.length}`, created_at: '2026-10-30T00:00:00Z', updated_at: '2026-10-30T00:00:00Z', ...body };
      return route.fulfill({ status: 201, headers, json: single ? row : [row] });
    }
    if (!['GET', 'HEAD'].includes(method) && !path.includes('/auth/') && !path.includes('/rpc/')) writes.push(path);
    let data = single ? {} : [];
    if (path.includes('/auth/v1/user')) data = user; else if (path.includes('/auth/v1/')) data = session;
    else if (path.endsWith('/profiles')) data = single ? profile : [profile];
    else if (path.endsWith('/academies')) data = single ? academy : [academy];
    else if (path.endsWith('/classes')) data = [{ id: 'class-qa', academy_id: aid, name: '검증 반' }];
    else if (path.endsWith('/curriculum_lessons')) data = [lesson];
    else if (path.endsWith('/word_lists')) data = [wordList, sentenceList];
    else if (path.endsWith('/rpc/my_deletion_request')) data = null;
    return route.fulfill({ status: 200, headers, json: data });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(30000);
  const root = 'http://127.0.0.1:5268';
  await page.goto(`${root}/curriculum`);
  await page.getByText('원본 수업').first().waitFor();

  // 1) 저장: 더보기 → 내 수업 틀로 저장
  await page.getByRole('button', { name: '더보기' }).first().click();
  await page.getByText('내 수업 틀로 저장').first().click();
  await page.getByLabel('틀 이름').fill('내 기본 틀');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const stored = await page.evaluate((a) => JSON.parse(localStorage.getItem(`classbank.lessonStyles.${a}`) || '[]'), aid);
  assert.equal(stored.length, 1);
  const st = stored[0];
  assert.equal(st.name, '내 기본 틀');
  assert(!JSON.stringify(st).includes('oldword'), '단어가 틀에 남으면 안 된다');
  assert(st.slides.every((s) => s.kind !== 'game' || (!s.templateId && !s.ownWordListId)), '게임 내용 연결을 뺀다');
  assert.equal(st.slides.length, 5);
  console.log('PASS save: structure kept, words and game contents stripped');

  // 2) 단어장으로 시작
  await page.getByRole('button', { name: '내 틀로 시작' }).click();
  await page.locator('select').nth(1).selectOption('wl-new');
  const planText = await page.locator('ol').last().innerText();
  assert(/새 단어장/.test(planText), planText);
  await page.getByRole('button', { name: '이 틀로 수업 만들기' }).click();
  await page.getByRole('button', { name: '바로 시작' }).waitFor();
  const lessonPost = posts.filter((p) => p.table === 'curriculum_lessons').at(-1).body;
  assert.deepEqual(lessonPost.playlist.map((s) => s.kind), ['wordshow', 'study', 'game', 'game', 'canvas']);
  assert.equal(lessonPost.playlist[0].words.length, 6);
  assert.equal(lessonPost.playlist[0].words[0].word, 'apple');
  assert(lessonPost.playlist.slice(2, 4).every((s) => s.templateId?.startsWith('new-')), '게임은 새 게임 내용으로 연결');
  assert.equal(lessonPost.word_list_id, 'wl-new');
  assert(posts.filter((p) => p.table === 'game_templates').length >= 1);
  console.log('PASS apply: word list fills words, builds new game contents, keeps fixed slides');
  await page.screenshot({ path: `${out}/after-make.png` });
  await page.getByRole('button', { name: '닫기' }).first().click();

  // 3) 문장 모음으로 시작: 낱말 슬라이드·단어 게임은 빠지고 문장 게임만 남는다
  const before = posts.length;
  await page.getByRole('button', { name: '내 틀로 시작' }).click();
  await page.locator('select').nth(1).selectOption('sl-1');
  const plan2 = await page.locator('ol').last().innerText();
  assert(/문장 모음에서 빼요/.test(plan2) && /쓸 수 없어서 빼요/.test(plan2), plan2);
  await page.screenshot({ path: `${out}/plan-sentence.png` });
  await page.getByRole('button', { name: '이 틀로 수업 만들기' }).click();
  await page.getByRole('button', { name: '바로 시작' }).waitFor();
  const lp2 = posts.slice(before).filter((p) => p.table === 'curriculum_lessons').at(-1).body;
  assert.deepEqual(lp2.playlist.map((s) => s.kind), ['game', 'canvas']);
  assert.equal(lp2.playlist[0].gameType, 'unscramble');
  assert.equal(lp2.word_list_id, null);
  const tpl = posts.slice(before).filter((p) => p.table === 'game_templates').at(-1).body;
  assert.equal(tpl.items.length, 3);
  console.log('PASS sentence list: only sentence games are made, word slides and word games are left out');

  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log('ALL PASS: lesson styles');
} finally {
  await browser?.close();
  await server.close();
}
