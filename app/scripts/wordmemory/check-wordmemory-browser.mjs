// 단어암기숙제 브라우저 검증: 선생님 배정 창·현황·학생 화면이 실제 SQL(PGlite)과 연결돼 도는지 본다.
// 서버 호출(wm_*)만 임시 Postgres 로 가고, 로그인·반·학생 목록은 합성이다. 운영 DB·운영 계정과 무관하다.
// 실행(저장소 app 폴더에서): node scripts/wordmemory/check-wordmemory-browser.mjs   (스크린샷: output/word-memory/)
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { makeWmDb, setDay } from '../admin/wm-setup.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shots = resolve(process.env.WM_TEST_OUTPUT || resolve(root, '../output/word-memory'));
mkdirSync(shots, { recursive: true });
const db = await makeWmDb();
await db.exec(readFileSync(new URL('../../../supabase/103_word_projects.sql', import.meta.url), 'utf8'));

// ---------- 합성 학원 ----------
const OWNER = '00000000-0000-4000-8000-000000000001';
const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const CLASS = 'cccccccc-0000-4000-8000-000000000001';
const S = ['dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000003'];
await db.exec(`
  insert into auth.users (id, email) values ('${OWNER}', 'a@x.com');
  insert into public.academies (id, name, features) values ('${A}', 'A학원', '{"homework":true}');
  insert into public.profiles (id, academy_id, role, display_name) values ('${OWNER}', '${A}', 'owner', 'A원장');
  insert into public.classes (id, academy_id, name) values ('${CLASS}', '${A}', '1반');
  insert into public.students (id, academy_id, class_id, name) values ('${S[0]}', '${A}', '${CLASS}', '민수'), ('${S[1]}', '${A}', '${CLASS}', '지아'), ('${S[2]}', '${A}', '${CLASS}', '하준');
  insert into public.student_sessions (token, student_id) values ('11111111-1111-4111-8111-111111111111', '${S[1]}');
`);
await setDay(db, '2026-11-02');

// ---------- RPC 서버(브라우저 ↔ PGlite) ----------
let chain = Promise.resolve();
const locked = (fn) => (chain = chain.then(fn, fn));
let failNext = 0; // 테스트가 "답 전송 실패"를 만들 때 쓴다
const rpcServer = http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  if (req.method === 'OPTIONS') return res.end();
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () =>
    locked(async () => {
      const url = new URL(req.url, 'http://x');
      const send = (code, obj) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      try {
        if (url.pathname === '/__sql') {
          const j = JSON.parse(body);
          return send(200, { rows: (await db.query(j.sql, j.params || [])).rows });
        }
        if (url.pathname === '/__day') {
          await setDay(db, url.searchParams.get('d'));
          return send(200, { ok: true });
        }
        if (url.pathname === '/__fail') {
          failNext = Number(url.searchParams.get('n') || 1);
          return send(200, { ok: true });
        }
        if (url.pathname === '/q/classes') return send(200, (await db.query('select * from public.classes order by name')).rows);
        if (url.pathname === '/q/students') return send(200, (await db.query('select id, name, class_id, academy_id from public.students where class_id = $1 order by name', [url.searchParams.get('class')])).rows);
        const m = url.pathname.match(/^\/rpc\/(\w+)$/);
        if (!m) return send(404, { error: 'not_found' });
        if (failNext > 0 && m[1] === 'wm_answer') {
          failNext -= 1;
          res.destroy();
          return;
        }
        const args = JSON.parse(body || '{}');
        const names = Object.keys(args);
        const sql = `select public.${m[1]}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
        await db.exec(`select set_config('test.uid', '${req.headers['x-uid'] || ''}', false)`);
        const r = await db.query(sql, names.map((n) => args[n]));
        return send(200, { data: r.rows[0].r });
      } catch (e) {
        return send(200, { error: String(e.message) });
      }
    }),
  );
});
await new Promise((r) => rpcServer.listen(0, '127.0.0.1', r));
const RPC = `http://127.0.0.1:${rpcServer.address().port}`;
const sqlq = async (sql, params = []) => {
  const r = await fetch(`${RPC}/__sql`, { method: 'POST', body: JSON.stringify({ sql, params }) });
  const j = await r.json();
  if (j.error) throw new Error('SQL 오류: ' + j.error);
  return j.rows;
};
const goDay = (d) => fetch(`${RPC}/__day?d=${d}`);

// ---------- vite: 서버 호출만 가짜로 갈아 끼운다 ----------
const names = [...readFileSync(resolve(root, 'src/lib/api.ts'), 'utf8').matchAll(/export (?:async )?function (\w+)|export const (\w+)/g)].map((m) => m[1] || m[2]);
const api = `
const get = async (p) => (await fetch(window.__rpc + p)).json();
const fn = { fetchClasses: async () => get('/q/classes'), fetchStudentsOfClass: async (id) => get('/q/students?class=' + id) };
${names.map((n) => `export const ${n}=(...a)=>(fn.${n}||(async()=>[]))(...a);`).join('\n')}`;
const supabaseStub = `export const supabase = { rpc: async (name, args) => {
  const r = await fetch(window.__rpc + '/rpc/' + name, { method: 'POST', headers: { 'content-type': 'application/json', 'x-uid': window.__uid || '' }, body: JSON.stringify(args || {}) });
  const j = await r.json();
  return j.error ? { data: null, error: { message: j.error } } : { data: j.data, error: null };
} };`;
const auth = `const value={academy:{id:'${A}',features:{group:true,solo:true,homework:true},plan:'paid'},profile:{id:'${OWNER}',display_name:'원장'},isStaff:true,isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'${OWNER}'}},trial:{active:true}};export const useAuth=()=>value;`;
const PORT = 5197;
const server = await createServer({
  root,
  logLevel: 'error',
  plugins: [
    {
      name: 'wm-synthetic-only',
      enforce: 'pre',
      configureServer(s) {
        s.middlewares.use((req, _res, next) => {
          if (/^\/(wm\/|teacher|results|portal)/.test(req.url || '')) req.url = '/scripts/wordmemory/harness.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
          next();
        });
      },
      load(id) {
        const p = id.replaceAll('\\', '/');
        if (p.endsWith('/src/lib/api.ts')) return api;
        if (p.endsWith('/src/lib/supabase.ts')) return supabaseStub;
        if (p.endsWith('/src/context/AuthContext.tsx')) return auth;
        if (p.endsWith('/src/context/ToastContext.tsx')) return `const value={notify:()=>{},run:async f=>{try{await f();return true}catch{return false}}};export const useToast=()=>value;`;
      },
    },
  ],
  server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false },
});
await server.listen();
const BASE = `http://127.0.0.1:${PORT}`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
let pass = 0;
const ok = (n) => {
  pass += 1;
  console.log('PASS', n);
};
async function newPage(viewport = { width: 1000, height: 1100 }, opts = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', ...opts });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__rpc = ${JSON.stringify(RPC)}; window.__uid = ${JSON.stringify(OWNER)};`);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text()) && errors.push(m.text()));
  return page;
}
const WORDS = [['apple', '사과'], ['banana', '바나나'], ['cat', '고양이'], ['dog', '강아지'], ['egg', '달걀'], ['fish', '물고기'], ['goat', '염소'], ['hat', '모자'], ['ice', '얼음'], ['jump', '뛰다'], ['kite', '연'], ['lion', '사자']];
const cards = WORDS.map(([word, meaning], i) => ({ id: 'c' + i, word, meaning, imageUrl: null, example: null }));
const teacherPage = async (query = '', viewport) => {
  const page = await newPage(viewport);
  await page.addInitScript((c) => sessionStorage.setItem('wm-cards', JSON.stringify(c)), cards);
  await page.goto(`${BASE}/teacher${query}`);
  await page.waitForSelector('[data-wm-assign]');
  return page;
};
const sessionIdOf = async (access) => (await sqlq('select s.id from public.wm_sessions s join public.wm_targets t on t.id = s.target_id where t.access_token = $1 and s.day = public.wm_today()', [access]))[0]?.id;

try {
  // ============ 1. 선생님: 단어장(그림·예문 없음)으로 배정 ============
  console.log('1. 선생님 배정');
  let tp = await teacherPage();
  await tp.waitForFunction(() => document.querySelectorAll('[data-wm-student]').length === 3);
  assert.match(await tp.locator('[data-wm-source]').innerText(), /내 단어장 · 단어 12개/);
  const preview = await tp.locator('[data-wm-preview]').innerText();
  assert.match(preview, /단어 12개/);
  assert.match(preview, /그림이 없는 단어는 그림 문제 대신/);
  assert.match(preview, /예문이 없는 단어는 문장 빈칸/);
  assert.doesNotMatch(preview, /그림 보고 단어 찾기: 그림이 있는/);
  ok('그림·예문 없는 단어장: 미리보기가 못 만드는 활동과 이유를 알려 준다');
  assert.match(await tp.locator('[data-wm-daily-desc]').innerText(), /문제 최대 12개 · 새 단어 하루 3개까지 · 약 3~6분/);
  await tp.locator('[data-wm-mode="normal"]').click();
  assert.match(await tp.locator('[data-wm-daily-desc]').innerText(), /문제 최대 20개 · 새 단어 하루 5개까지/);
  await tp.locator('[data-wm-mode="light"]').click();
  assert.equal(await sqlq('select count(*)::int c from public.wm_plans').then((r) => r[0].c), 0);
  ok('배정 전에는 아무것도 만들어지지 않고, 하루 학습량은 실제 문항 수·어림 시간으로 보인다');
  await tp.locator('[data-wm-student]').nth(2).uncheck(); // 하준 제외
  await tp.screenshot({ path: resolve(shots, 'teacher-assign-desktop.png') });
  // 같은 단추를 연달아 눌러도 한 번만 배정된다
  await tp.locator('[data-wm-assign-btn]').dblclick();
  await tp.waitForSelector('[data-wm-result]');
  const plans = await sqlq('select id, study_days, daily_mode from public.wm_plans');
  const targets = await sqlq('select student_id from public.wm_targets');
  assert.equal(plans.length, 1);
  assert.equal(targets.length, 2);
  assert.match(await tp.locator('[data-wm-result]').innerText(), /2명에게 보냈어요/);
  ok('배정하기를 연달아 눌러도 계획 1개·학생 2명만 만들어진다(중복 배정 방지)');
  const accessTokens = Object.fromEntries((await sqlq('select s.name, t.access_token a from public.wm_targets t join public.students s on s.id = t.student_id')).map((r) => [r.name, r.a]));
  assert.equal(await tp.locator('[data-wm-copy]').count(), 2);
  await tp.close();

  // 같은 단어를 같은 학생에게 새로 배정하면 건너뛴다
  tp = await teacherPage();
  await tp.locator('[data-wm-student]').nth(2).uncheck();
  await tp.locator('[data-wm-assign-btn]').click();
  await tp.waitForSelector('[data-wm-result]');
  assert.match(await tp.locator('[data-wm-result]').innerText(), /새로 배정된 학생이 없어요/);
  assert.equal((await sqlq('select count(*)::int c from public.wm_plans'))[0].c, 1);
  ok('이미 같은 단어를 진행 중인 학생에게는 두 번째 배정이 만들어지지 않는다');
  await tp.close();

  // ============ 2. 학생: 첫날 ============
  console.log('2. 학생 첫날(모바일)');
  const phone = { width: 390, height: 844 };
  const M = accessTokens['민수'];
  const pickChoice = (page, q, index) => q.choices.join('|') === 'O|X'
    ? page.getByRole('button', { name: q.choices[index], exact: true }).click()
    : page.locator(`[data-choice="${index}"]`).click();
  const solve = async (page, access, { wrong = false, hint = false } = {}) => {
    const i = Number(await page.locator('[data-wm-view="run"]').getAttribute('data-wm-q'));
    const sid = await sessionIdOf(access);
    const q = (await sqlq('select questions -> $2::int as q from public.wm_sessions where id = $1', [sid, i]))[0].q;
    if (hint && q.qtype === 'choice') {
      await page.locator('[data-wm-hint-btn]').click();
      await page.waitForFunction(() => document.querySelectorAll('button.line-through').length >= 1);
    }
    if (q.qtype === 'choice') {
      const idx = wrong ? (q.correct + 1) % q.choices.length : q.correct;
      await pickChoice(page, q, idx);
    } else if (q.qtype === 'text') {
      await page.keyboard.type(wrong ? 'zzz' : String(q.correct));
      await page.keyboard.press('Enter');
    } else {
      const order = wrong ? [...q.correct].reverse() : q.correct;
      const used = new Set();
      for (const tk of order) {
        const k = q.tokens.findIndex((x, n) => x === tk && !used.has(n));
        used.add(k);
        await page.locator(`[data-tile="${k}"]`).click();
      }
      await page.locator('[data-order-submit]').click();
    }
    await page.waitForSelector('[data-wm-feedback]');
    return { q, kind: await page.locator('[data-wm-feedback]').getAttribute('data-wm-feedback') };
  };
  const clickNext = async (page) => {
    await page.locator('[data-wm-next]').click();
    await page.waitForFunction(() => !document.querySelector('[data-wm-feedback]'));
  };
  const viewOf = (page) => page.locator('[data-wm-view]').first().getAttribute('data-wm-view');
  const ackStudies = async (page) => {
    for (let n = 0; n < 8; n++) {
      if ((await viewOf(page)) !== 'run' || (await page.locator('[data-wm-view="run"]').getAttribute('data-wm-kind')) !== 'study') return;
      const before = await page.locator('[data-wm-view="run"]').getAttribute('data-wm-q');
      await page.locator('[data-wm-ack]').click();
      await page.waitForFunction((b) => document.querySelector('[data-wm-view]')?.getAttribute('data-wm-q') !== b || document.querySelector('[data-wm-view]')?.getAttribute('data-wm-view') !== 'run', before);
    }
  };
  const runToEnd = async (page, access, opts = {}) => {
    for (let g = 0; g < 80; g++) {
      await page.waitForSelector('[data-wm-view]');
      await ackStudies(page);
      if ((await viewOf(page)) !== 'run') return viewOf(page);
      await solve(page, access, opts);
      await clickNext(page);
    }
    throw new Error('too many steps');
  };

  let sp = await newPage(phone, { isMobile: true, hasTouch: true });
  await sp.goto(`${BASE}/wm/${M}`);
  await sp.waitForSelector('[data-wm-view="home"]');
  const home = await sp.locator('[data-wm-view="home"]').innerText();
  assert.match(home, /민수/);
  assert.match(home, /오늘 할 학습/);
  assert.equal(await sp.locator('[data-wmp-tile]').count(), 1, '첫날은 새 단어 타일 하나');
  assert.match(await sp.locator('[data-wmp-tile="새 단어"]').innerText(), /3/);
  assert.equal(await sp.locator('[data-wm-start]').count(), 1, '시작 버튼은 하나');
  assert.equal(await sp.locator('[data-wm-start]').innerText(), '오늘 할 학습 시작');
  assert.match(home, /내가 익힌 단어[\s\S]*0 \/ 12개/);
  assert.doesNotMatch(home, /점수|정답률|정확도/);
  ok('첫날 시작 화면(새 프로젝트 화면): 새 단어 3 타일, 시작 버튼 하나, 익힌 단어 0/12, 내부 점수 없음');
  await sp.screenshot({ path: resolve(shots, 'student-home-mobile.png') });
  await sp.locator('[data-wm-start]').click();
  await sp.waitForSelector('[data-wm-study]');
  await sp.screenshot({ path: resolve(shots, 'student-study-mobile.png') });
  await ackStudies(sp);
  // 새로고침해도 서버에 저장된 오늘 학습을 이어서 한다
  await sp.reload();
  await sp.waitForSelector('[data-wm-view="home"]');
  assert.match(await sp.locator('[data-wm-view="home"]').innerText(), /남은 문항/);
  assert.match(await sp.locator('[data-wm-start]').innerText(), /이어서 하기/);
  ok('새로고침·재접속: "이어서 하기"와 남은 문제 수가 보이고 서버의 오늘 학습이 그대로다');
  await sp.locator('[data-wm-start]').click();
  await sp.waitForSelector('[data-wm-view="run"]');
  await ackStudies(sp);
  const first = await solve(sp, M, { wrong: true });
  assert.equal(first.kind, 'wrong');
  assert.match(await sp.locator('[data-wm-feedback]').innerText(), /정답은/);
  assert.match(await sp.locator('[data-wm-feedback]').innerText(), /다시 만나요/);
  await sp.screenshot({ path: resolve(shots, 'student-wrong-mobile.png') });
  ok('틀리면 정답을 보여 주고 "조금 뒤에 다른 문제로 다시 만나요"라고 알린다');
  await clickNext(sp);
  // 둘째 문제: 힌트를 쓰고 맞힌다 → 도움 받음으로 기록
  await ackStudies(sp);
  const sidM = await sessionIdOf(M);
  const secondQ = Number(await sp.locator('[data-wm-view="run"]').getAttribute('data-wm-q'));
  const second = await solve(sp, M, { hint: true });
  assert.equal(second.kind, 'right');
  const helpedRow = (await sqlq('select helped, unaided from public.wm_answers where session_id = $1 and q_index = $2', [sidM, secondQ]))[0];
  if (second.q.qtype === 'choice') assert.ok(helpedRow.helped && !helpedRow.unaided, '힌트를 쓴 정답은 도움 받음');
  ok('힌트를 쓰면 보기 하나가 지워지고 그 문제는 "도움 받음"으로 기록된다');
  await clickNext(sp);
  // 전송 실패: 같은 요청 번호로 다시 보내도 한 번만 기록된다
  const count = async () => (await sqlq("select count(*)::int c from public.wm_answers where session_id = $1 and kind <> 'ack'", [sidM]))[0].c;
  let sawResend = false;
  for (let g = 0; g < 40; g++) {
    await ackStudies(sp);
    if ((await viewOf(sp)) !== 'run') break;
    const i = Number(await sp.locator('[data-wm-view="run"]').getAttribute('data-wm-q'));
    const q = (await sqlq('select questions -> $2::int as q from public.wm_sessions where id = $1', [sidM, i]))[0].q;
    if (!sawResend && q.qtype === 'choice') {
      const before = await count();
      let abortOnce = true;
      await sp.route('**/rpc/wm_answer', (route) => {
        if (abortOnce) {
          abortOnce = false;
          void route.abort('connectionfailed');
        } else void route.continue();
      });
      await pickChoice(sp, q, q.correct);
      await sp.waitForSelector('[data-wm-resend]');
      assert.equal(await count(), before, '전송 실패라 기록이 없다');
      assert.match(await sp.locator('[role=alert]').first().innerText(), /전송하지 못했어요/);
      await sp.screenshot({ path: resolve(shots, 'student-offline-mobile.png') });
      await sp.locator('[data-wm-resend]').click();
      await sp.waitForSelector('[data-wm-feedback]');
      assert.equal(await count(), before + 1, '다시 보내도 한 번만');
      sawResend = true;
      await clickNext(sp);
      continue;
    }
    await solve(sp, M);
    await clickNext(sp);
  }
  assert.ok(sawResend, '선택형 문제에서 전송 실패 시나리오를 확인했다');
  ok('전송 실패 → "다시 시도"로 같은 요청을 다시 보내도 기록은 한 번만 남는다');
  assert.equal(await viewOf(sp), 'done');
  await sp.screenshot({ path: resolve(shots, 'student-done-mobile.png') });
  const doneText = await sp.locator('[data-wm-view="done"]').innerText();
  assert.match(doneText, /오늘 학습 끝!/);
  assert.match(doneText, /아직 만나지 않은 단어가 9개/);
  ok('오늘 학습이 끝나면 종료 화면과 남은 분량(아직 안 만난 단어 9개)을 알려 준다');
  const d1 = await sqlq("select count(*) filter (where kind = 'retry')::int retries from public.wm_answers a where a.session_id = $1", [sidM]);
  assert.ok(d1[0].retries >= 1, '틀린 문제는 다시 묻기로 이어졌다');
  const stage1 = await sqlq('select max(stage)::int m, max(unaided_ok)::int u from public.wm_words w join public.wm_targets t on t.id = w.target_id where t.access_token = $1', [M]);
  assert.ok(stage1[0].m <= 1 && stage1[0].u === 0, '소개한 날에는 "혼자 맞힘"이 되지 않는다');
  ok('틀린 문제는 다른 문제 뒤에 다시 묻고, 소개 당일에는 "혼자 맞힘"으로 세지 않는다');

  // 단어 수집장
  await sp.locator('[data-wm-open-collection]').click();
  await sp.waitForSelector('[data-wm-collection]');
  const coll = await sp.locator('[data-wm-collection]').innerText();
  assert.match(coll, /처음 만남|연습 중/);
  assert.equal(await sp.locator('[data-wm-word]').count(), 3);
  assert.doesNotMatch(coll, /goat|lion|kite/, '아직 만나지 않은 단어는 미리 알려 주지 않는다');
  assert.ok((await sp.locator('li [data-wm-state="unseen"]').count()) >= 9);
  await sp.screenshot({ path: resolve(shots, 'student-collection-mobile.png'), fullPage: true });
  ok('단어 수집장: 만난 3개는 단계(아이콘+글자)와 함께, 안 만난 단어는 칸만 보인다');
  await sp.close();

  // ============ 3. 다음 날: 복습 ============
  console.log('3. 다음 날 복습');
  await goDay('2026-11-03');
  sp = await newPage(phone, { isMobile: true, hasTouch: true });
  await sp.goto(`${BASE}/wm/${M}`);
  await sp.waitForSelector('[data-wm-view="home"]');
  const home2 = await sp.locator('[data-wm-view="home"]').innerText();
  const counts = await sqlq('select counts from public.wm_sessions s join public.wm_targets t on t.id = s.target_id where t.access_token = $1 and s.day = public.wm_today()', [M]);
  assert.equal(counts[0].counts.review + counts[0].counts.hard, 3);
  assert.ok(counts[0].counts.hard >= 1);
  assert.match(home2, /복습|다시 확인/);
  await sp.screenshot({ path: resolve(shots, 'student-home-day2-mobile.png') });
  ok('다음 날 시작 화면: 어제 만난 3개가 복습으로, 틀렸던 단어는 "아직 어려운 단어"로 나뉜다');
  await sp.locator('[data-wm-start]').click();
  const end2 = await runToEnd(sp, M);
  assert.equal(end2, 'done');
  const alone = await sqlq('select count(*)::int c from public.wm_words w join public.wm_targets t on t.id = w.target_id where t.access_token = $1 and w.stage >= 2', [M]);
  assert.ok(alone[0].c >= 2);
  ok('다른 날 도움 없이 맞히면 "혼자 맞힘" 이상으로 올라간다');
  const styles = await sqlq("select e.q ->> 'key' k, array_agg(distinct e.q ->> 'style') st from public.wm_sessions s join public.wm_targets t on t.id = s.target_id, jsonb_array_elements(s.questions) e(q) where t.access_token = $1 and e.q ->> 'kind' = 'ask' group by 1 having count(distinct s.day) >= 2", [M]);
  assert.ok(styles.length >= 2 && styles.every((r) => r.st.length >= 2), '같은 낱말이 날마다 다른 활동으로 나온다');
  ok('같은 단어가 첫날과 다음 날에 서로 다른 활동·단서로 나온다');
  await sp.close();

  // ============ 4. 선생님 결과 ============
  console.log('4. 선생님 현황');
  const rp = await newPage({ width: 1100, height: 900 });
  await rp.goto(`${BASE}/results`);
  await rp.waitForSelector('[data-wm-results]');
  await rp.locator('[data-wm-plan] button').first().click();
  await rp.waitForSelector('[data-wm-student-row="민수"]');
  const row = await rp.locator('[data-wm-student-row="민수"]').innerText();
  assert.match(row, /오늘 학습 완료/);
  const tableText = await rp.locator('[data-wm-results]').innerText();
  assert.match(tableText, /도움 없이 맞힌 단어/);
  assert.match(tableText, /며칠 뒤에도 기억한 단어/);
  assert.match(tableText, /둘은 다른 지표예요/);
  assert.match(await rp.locator('[data-wm-student-row="지아"]').innerText(), /아직 안 함/);
  await rp.screenshot({ path: resolve(shots, 'teacher-results-desktop.png') });
  ok('현황: 오늘 완료·만난 단어·도움 없이 맞힌 단어·며칠 뒤에도 기억한 단어·더 연습할 부분을 구분해 보여 준다');
  await rp.close();

  // ============ 5. 학생 포털 링크·잘못된 링크 ============
  console.log('5. 포털·오류');
  const pp = await newPage({ width: 420, height: 800 });
  await pp.goto(`${BASE}/portal`);
  await pp.waitForSelector('[data-wm-portal] a');
  assert.equal(await pp.locator('[data-wm-portal] a').getAttribute('href'), `/wm/${accessTokens['지아']}`);
  ok('학생 포털 홈에 내 단어암기숙제 링크가 보인다');
  await pp.close();
  const bad = await newPage(phone);
  await bad.goto(`${BASE}/wm/not-a-real-key`);
  await bad.waitForSelector('[data-wm-view="error"]');
  assert.match(await bad.locator('[data-wm-view="error"]').innerText(), /이 링크를 찾을 수 없어요/);
  assert.doesNotMatch(await bad.locator('body').innerText(), /민수|지아/);
  ok('잘못된 링크: 쉬운 안내만 보이고 다른 학생 정보는 보이지 않는다');
  await bad.close();
  const j = await newPage(phone);
  await j.goto(`${BASE}/wm/${accessTokens['지아']}`);
  await j.waitForSelector('[data-wm-view="home"]');
  assert.match(await j.locator('body').innerText(), /지아/);
  assert.doesNotMatch(await j.locator('body').innerText(), /민수/);
  await j.close();
  ok('학생마다 개인 링크 하나로 자기 학습만 열린다');

  // ============ 6. 큰 글씨·영어·닫힌 숙제 ============
  console.log('6. 큰 글씨·영어·접근성');
  const big = await newPage(phone);
  await big.goto(`${BASE}/wm/${accessTokens['지아']}?scale=125`);
  await big.waitForSelector('[data-wm-view="home"]');
  const overflow = await big.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false, '큰 글씨에서도 가로로 넘치지 않는다');
  await big.screenshot({ path: resolve(shots, 'student-home-large-text-mobile.png') });
  const startBtn = await big.locator('[data-wm-start]').boundingBox();
  assert.ok(startBtn.height >= 44, '시작 단추는 손가락으로 누르기 충분히 크다');
  ok('큰 글씨(125%)·모바일 폭에서 가로 넘침 없고 단추 크기가 충분하다');
  await big.keyboard.press('Tab');
  assert.ok(await big.evaluate(() => document.activeElement && document.activeElement !== document.body), '키보드로 단추에 이동한다');
  ok('키보드 Tab 으로 단추에 이동할 수 있다');
  await big.close();
  const en = await newPage(phone);
  await en.goto(`${BASE}/wm/${accessTokens['지아']}?lang=en`);
  await en.waitForSelector('[data-wm-view="home"]');
  assert.match(await en.locator('[data-wm-view="home"]').innerText(), /Today.s study/);
  ok('영어 문구');
  await en.close();
  await sqlq('update public.wm_plans set closed_at = now()');
  const cl = await newPage(phone);
  await cl.goto(`${BASE}/wm/${accessTokens['지아']}`);
  await cl.waitForSelector('[data-wm-view="error"]');
  assert.match(await cl.locator('[data-wm-view="error"]').innerText(), /닫혔어요/);
  await sqlq('update public.wm_plans set closed_at = null');
  ok('닫은 숙제는 학생 화면에서 "닫혔어요"로 막힌다');
  await cl.close();

  // ============ 7. 선생님 모바일 배정 창 ============
  console.log('7. 선생님 모바일');
  const tm = await teacherPage('', { width: 390, height: 844 });
  await tm.waitForFunction(() => document.querySelectorAll('[data-wm-student]').length === 3);
  const dialogBox = await tm.locator('dialog').boundingBox();
  assert.ok(dialogBox.width <= 390, '배정 창이 모바일 화면 안에 들어온다');
  await tm.screenshot({ path: resolve(shots, 'teacher-assign-mobile.png') });
  ok('선생님 배정 창이 모바일 폭에서도 화면 안에 들어온다');
  await tm.close();

  const overdue = await newPage(phone);
  await goDay('2027-03-15');
  await overdue.goto(BASE + '/wm/' + accessTokens['지아']);
  await overdue.waitForSelector('[data-wm-view="home"]');
  assert.match(await overdue.locator('[data-wm-view="home"]').innerText(), /목표일.*지났어요.*이어서 배워요/);
  assert.equal(await overdue.locator('[data-wm-start]').innerText(), '오늘 할 학습 시작');
  await overdue.screenshot({ path: resolve(shots, 'student-project-overdue-mobile.png') });
  ok('목표일이 지나도 학생은 오늘 할 학습을 시작할 수 있다');

  await sqlq('update public.wm_words w set stage=3,relearning=false from public.wm_targets t where t.id=w.target_id and t.access_token=$1', [accessTokens['지아']]);
  await goDay('2027-03-16');
  await overdue.reload();
  await overdue.waitForSelector('[data-wm-view="ended"]');
  assert.match(await overdue.locator('[data-wm-view="ended"]').innerText(), /프로젝트 완료!/);
  await overdue.screenshot({ path: resolve(shots, 'student-project-complete-mobile.png') });
  ok('전체 단어 확인을 마친 학생에게 프로젝트 완료가 표시된다');
  await overdue.close();

  // ============ 8. 큰 프로젝트(3,520개): 교사 승인 → 학생 학습 → 교사 진행(실제 SQL 응답) ============
  console.log('8. 큰 프로젝트');
  const kst = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const addDay = (iso, n) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10);
  const realToday = kst();
  await goDay(realToday); // 서버 한국 날짜 = 화면의 배정 전 미리보기 날짜
  const BIG = Array.from({ length: 3520 }, (_, i) => ({ id: 'b' + i, word: `bigword${i}`, meaning: `뜻${i}`, imageUrl: null, example: null }));
  const bt = await newPage({ width: 1000, height: 1400 });
  await bt.addInitScript((c) => sessionStorage.setItem('wm-cards', JSON.stringify(c)), BIG);
  await bt.goto(`${BASE}/teacher`);
  await bt.waitForSelector('[data-wm-assign]');
  await bt.waitForFunction(() => document.querySelectorAll('[data-wm-student]').length === 3);
  assert.match(await bt.locator('[data-wmp-total]').innerText(), /3,520/);
  assert.match(await bt.locator('[data-wmp-range]').innerText(), /200개씩 18구간/);
  await bt.locator('[data-wmp-range] summary').click();
  assert.equal(await bt.locator('[data-wmp-sections] li').count(), 18);
  assert.equal(await bt.locator('[data-wmp-fits]').getAttribute('data-wmp-fits'), 'true', '기본 목표일은 소개에 걸리는 날 + 여유로 맞춘다');
  // 목표일을 당기면 경고만 하고, 하루 분량은 자동으로 바뀌지 않는다
  const goalWanted = addDay(realToday, 400);
  await bt.locator('[data-wmp-goal]').fill(goalWanted);
  assert.equal(await bt.locator('[data-wmp-fits]').getAttribute('data-wmp-fits'), 'false');
  await bt.waitForTimeout(400);
  assert.equal(await bt.locator('[data-wm-mode="light"]').getAttribute('aria-pressed'), 'true', '자동으로 하루 분량이 바뀌지 않음');
  const planCount0 = (await sqlq('select count(*)::int c from public.wm_plans'))[0].c;
  await bt.screenshot({ path: resolve(shots, 'teacher-big-project-warn.png') });
  await bt.locator('[data-wmp-raise]').click();
  assert.equal(await bt.locator('[data-wm-mode="plus"]').getAttribute('aria-pressed'), 'true', '교사가 눌러야 분량이 바뀐다');
  assert.equal(await bt.locator('[data-wmp-fits]').getAttribute('data-wmp-fits'), 'true');
  assert.equal((await sqlq('select count(*)::int c from public.wm_plans'))[0].c, planCount0, '배정 전에는 만들어지지 않음');
  // 하준만 배정
  await bt.locator('[data-wm-student]').nth(0).uncheck();
  await bt.locator('[data-wm-student]').nth(1).uncheck();
  await bt.locator('[data-wm-assign-btn]').dblclick();
  await bt.waitForSelector('[data-wm-result]');
  await bt.screenshot({ path: resolve(shots, 'teacher-big-project-assigned.png') });
  const bigPlan = await sqlq("select id, rule_version, daily_mode, start_date::text sd, (start_date + study_days + review_days)::text goal from public.wm_plans where jsonb_array_length(cards) = 3520");
  assert.equal(bigPlan.length, 1, '연달아 눌러도 계획 1개');
  assert.equal(bigPlan[0].rule_version, 'wm-v2');
  assert.equal(bigPlan[0].daily_mode, 'plus');
  assert.equal(bigPlan[0].sd, realToday);
  assert.equal(bigPlan[0].goal, goalWanted, '서버의 목표일 = 교사가 고른 목표일');
  ok('교사 승인(3,520개): 200개씩 18구간, 목표일 경고는 자동 변경 없이 교사가 눌러 반영, 서버 목표일이 고른 값과 같고 중복 배정 없음');
  await bt.close();
  const H = (await sqlq("select t.access_token a from public.wm_targets t join public.students s on s.id = t.student_id where s.name = '하준' and t.plan_id = $1", [bigPlan[0].id]))[0].a;

  const bs = await newPage(phone, { isMobile: true, hasTouch: true });
  await bs.goto(`${BASE}/wm/${H}`);
  await bs.waitForSelector('[data-wm-view="home"]');
  const bh = await bs.locator('[data-wm-view="home"]').innerText();
  assert.match(bh, /0 \/ 3,520개/);
  assert.match(bh, /목표일/);
  assert.match(bh, /\(예상 일정이에요\)/);
  assert.match(await bs.locator('[data-wmp-tile="새 단어"]').innerText(), /10/);
  assert.doesNotMatch(bh, /점수|정확도|정답률/);
  await bs.screenshot({ path: resolve(shots, 'student-big-project-home-mobile.png') });
  await bs.locator('[data-wm-start]').click();
  const bigEnd = await runToEnd(bs, H);
  assert.equal(bigEnd, 'done');
  assert.match(await bs.locator('[data-wm-view="done"]').innerText(), /오늘 학습 끝!/);
  await bs.reload();
  await bs.waitForSelector('[data-wm-view="done"]');
  await bs.screenshot({ path: resolve(shots, 'student-big-project-done-mobile.png') });
  ok('학생(3,520개 프로젝트): 새 단어 10개로 시작 → 풀고 오늘 끝 → 새로고침해도 서버의 오늘 끝이 유지');
  await bs.close();

  // 9일 뒤 돌아온 날: 서버 waiting_review 를 그대로 보여 준다(밀렸다고 하지 않는다)
  await goDay(addDay(realToday, 9));
  const back = await newPage(phone, { isMobile: true, hasTouch: true });
  await back.goto(`${BASE}/wm/${H}`);
  await back.waitForSelector('[data-wm-view="home"]');
  const server = (await sqlq('select public.wm_today_state($1) r', [H]))[0].r;
  const backText = await back.locator('[data-wm-view="home"]').innerText();
  assert.doesNotMatch(backText, /밀렸|결석|늦었/);
  if (server.waiting_review > 0) assert.match(await back.locator('[data-wmp-waiting]').innerText(), new RegExp(`남은 복습 ${server.waiting_review}개는 다음 날들에 나눠서 해요`));
  else assert.equal(await back.locator('[data-wmp-waiting]').count(), 0);
  assert.ok((await back.locator('[data-wmp-tile]').count()) >= 1);
  await back.screenshot({ path: resolve(shots, 'student-big-project-return-mobile.png') });
  ok(`학생 복귀: 오늘 분량(복습 ${server.counts.review}·다시 확인 ${server.counts.hard}·새 ${server.counts.new})과 서버 waiting_review ${server.waiting_review}개를 그대로 표시`);
  await back.close();

  // 교사 진행: 학생이 확인된 단어(며칠 뒤에도 혼자 맞힘)를 만들면 진행 화면에 그대로 나온다
  await sqlq("update public.wm_words w set stage = 3, relearning = false from public.wm_targets t where t.id = w.target_id and t.access_token = $1 and w.introduced_day is not null", [H]);
  const proj = (await sqlq('select public.wm_project_status(t.id, p.start_date + p.study_days + p.review_days) r from public.wm_targets t join public.wm_plans p on p.id = t.plan_id where t.access_token = $1', [H]))[0].r;
  const rp2 = await newPage({ width: 1100, height: 1200 });
  await rp2.goto(`${BASE}/results`);
  await rp2.waitForSelector('[data-wm-results]');
  await rp2.locator(`[data-wm-plan="${bigPlan[0].id}"] button`).first().click();
  await rp2.getByRole('tab', { name: '진행·시험' }).click();
  await rp2.waitForSelector('[data-wmp-progress]');
  const prog = await rp2.locator('[data-wmp-progress]').innerText();
  assert.match(prog, /3,520개 · 18구간|전체 3,520개 · 200개씩 18구간/);
  assert.equal(await rp2.locator('[data-wmp-row]').count(), 1);
  assert.equal(await rp2.locator('[data-wmp-verified]').innerText(), proj.verified.toLocaleString('ko-KR'), '확인됨 수가 서버 값과 같다');
  assert.ok(proj.verified > 0);
  assert.equal(await rp2.locator('[data-wmp-inconsistent]').count(), 0, '세 분류 합계가 전체와 같다');
  assert.equal(proj.verified + proj.needs_review + proj.unconfirmed, proj.total);
  assert.match(prog, /하루 분량 넉넉히/);
  assert.match(prog, /목표일/);
  assert.equal(await rp2.getByRole('button', { name: /늘리기/ }).count(), 0, 'pace 만으로 늘리기 버튼을 띄우지 않는다');
  await rp2.locator('button', { hasText: '구간별로 보기' }).click();
  assert.equal(await rp2.locator('[data-wmp-sections] li').count(), 18);
  await rp2.screenshot({ path: resolve(shots, 'teacher-big-project-progress.png'), fullPage: true });
  await rp2.locator('[data-wmp-next-steps]').click();
  assert.equal(await rp2.getByRole('tab', { name: '다음 단계 카드' }).getAttribute('aria-selected'), 'true');
  ok(`교사 진행: 확인됨 ${proj.verified}/3,520이 서버 값과 일치, 세 분류 합계 일치, 18구간, 늘리기 버튼 없이 '다음 단계 카드' 탭으로 안내`);
  await rp2.close();

  // 복습만 하는 날 + 복습이 하루 상한을 넘는 날: 새 단어를 모두 만난 상태에서 복습 차례 단어를 80개 만든다
  await sqlq("update public.wm_words w set introduced_day = coalesce(w.introduced_day, $2::date), stage = greatest(w.stage, 1), due_day = $3::date from public.wm_targets t where t.id = w.target_id and t.access_token = $1 and w.stage < 3", [H, addDay(realToday, 11), addDay(realToday, 60)]);
  await sqlq("update public.wm_words set due_day = $2::date where (target_id, key) in (select w.target_id, w.key from public.wm_words w join public.wm_targets t on t.id = w.target_id where t.access_token = $1 and w.stage < 3 order by w.key limit 80)", [H, addDay(realToday, 11)]);
  await goDay(addDay(realToday, 11));
  const heavy = await newPage(phone, { isMobile: true, hasTouch: true });
  await heavy.goto(`${BASE}/wm/${H}`);
  await heavy.waitForSelector('[data-wm-view]');
  if ((await viewOf(heavy)) !== 'home') throw new Error('복습만 하는 날 화면이 home 이 아님: ' + (await viewOf(heavy)) + ' / ' + (await heavy.locator('body').innerText()).slice(0, 300) + ' / state=' + JSON.stringify((await sqlq('select public.wm_today_state($1) r', [H]))[0].r).slice(0, 400));
  const hs = (await sqlq('select public.wm_today_state($1) r', [H]))[0].r;
  assert.equal(hs.counts.new, 0, '새 단어는 모두 만난 상태');
  assert.ok(hs.waiting_review > 0, `복습이 오늘 상한을 넘는다(${hs.waiting_review})`);
  const ht = await heavy.locator('[data-wm-view="home"]').innerText();
  assert.match(ht, /오늘은 복습만 해요/);
  assert.equal(await heavy.locator('[data-wmp-tile="새 단어"]').count(), 0);
  assert.match(await heavy.locator('[data-wmp-waiting]').innerText(), new RegExp(`남은 복습 ${hs.waiting_review}개는 다음 날들에 나눠서 해요`));
  assert.doesNotMatch(ht, /밀렸|결석|늦었|한꺼번에/);
  const shownAsks = hs.counts.asks;
  assert.ok(shownAsks <= 30, `오늘 문제 수(${shownAsks})가 승인한 하루 상한(30)을 넘지 않는다`);
  await heavy.screenshot({ path: resolve(shots, 'student-big-project-review-only-waiting-mobile.png') });
  ok(`복습만 하는 날: 오늘 문제 ${shownAsks}개(상한 30 이하), 서버 waiting_review ${hs.waiting_review}개를 "다음 날들에 나눠서 해요"로 그대로 표시`);
  await heavy.close();
  await goDay(addDay(realToday, 12));

  // 마지막 단어까지 확인 → 학생 완료, 교사 진행도 완료
  await sqlq("update public.wm_words w set stage = 3, relearning = false from public.wm_targets t where t.id = w.target_id and t.access_token = $1", [H]);
  await goDay(addDay(realToday, 13));
  const fin = await newPage(phone, { isMobile: true, hasTouch: true });
  await fin.goto(`${BASE}/wm/${H}`);
  await fin.waitForSelector('[data-wm-view="ended"]');
  assert.match(await fin.locator('[data-wm-view="ended"]').innerText(), /프로젝트 완료![\s\S]*3,520개/);
  assert.equal(await fin.locator('[data-wm-start]').count(), 0);
  await fin.screenshot({ path: resolve(shots, 'student-big-project-complete-mobile.png') });
  await fin.close();
  const rp3 = await newPage({ width: 1100, height: 900 });
  await rp3.goto(`${BASE}/results`);
  await rp3.waitForSelector('[data-wm-results]');
  await rp3.locator(`[data-wm-plan="${bigPlan[0].id}"] button`).first().click();
  await rp3.getByRole('tab', { name: '진행·시험' }).click();
  await rp3.waitForSelector('[data-wmp-progress]');
  assert.match(await rp3.locator('[data-wmp-row]').innerText(), /완료/);
  assert.equal(await rp3.locator('[data-wmp-verified]').innerText(), '3,520');
  await rp3.close();
  ok('마지막 단어까지 확인: 학생 화면은 프로젝트 완료, 교사 진행도 완료(3,520/3,520)');

} finally {
  await browser.close();
  await server.close();
  rpcServer.close();
}
console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
console.log(`${pass} scenarios passed`);
process.exit(errors.length ? 1 : 0);
