import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { build } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { buildAdaptiveFixture } from '../admin/adaptive-homework-fixture.mjs';

const f = await buildAdaptiveFixture();
const withCues = process.argv.includes('--cues');
const root = fileURLToPath(new URL('../../', import.meta.url));
const student = { id: f.ST, name: '학생 A' };
const stub = `
const from = name => new Proxy({}, {get(_,key) {
  if(key==='then')return done=>done({data:name==='students'?${JSON.stringify([student])}:[],error:null});
  return ()=>from(name);
}});
export const supabase = {from, rpc:async (name,args) => (await fetch('/__vocab-test-rpc', {
  method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,args})
})).json()};`;
const parameters = {
  learning_path_teacher_summary: ['p_class'],
  learning_vocab_feedback: ['p_class', 'p_lesson'],
  learning_vocab_draft: ['p_source', 'p_kind', 'p_student'],
  learning_vocab_approve: ['p_request', 'p_class', 'p_students', 'p_title', 'p_cards', 'p_practice', 'p_games', 'p_draft', 'p_due'],
  learning_vocab_cue_feedback: ['p_class', 'p_lesson'],
  learning_vocab_cue_draft: ['p_source', 'p_kind', 'p_student'],
  learning_vocab_cue_approve: ['p_request', 'p_class', 'p_students', 'p_title', 'p_cards', 'p_modes', 'p_games', 'p_draft', 'p_due', 'p_contexts', 'p_contextual'],
  learning_vocab_cue_approve_scheduled: ['p_request', 'p_class', 'p_students', 'p_title', 'p_cards', 'p_modes', 'p_games', 'p_draft', 'p_due', 'p_contexts', 'p_contextual', 'p_timetable'],
  learning_vocab_schedule_read: ['p_class'],
  learning_vocab_schedule_save: ['p_class','p_revision','p_class_days','p_review_days'],
  learning_vocab_cue_open: ['p_token', 'p_assignment'],
  learning_vocab_cue_action: ['p_token', 'p_assignment', 'p_request', 'p_revision', 'p_action', 'p_value'],
  learning_path_open: ['p_token', 'p_assignment'],
  learning_path_action: ['p_token', 'p_assignment', 'p_request', 'p_position', 'p_action', 'p_value'],
};
const calls = [];
let pending = Promise.resolve();
let loseHomeworkResponse = true;
const serial = task => {
  const result = pending.then(task);
  pending = result.catch(() => {});
  return result;
};
const origin = 'https://classbank-vocab.test';
const harness = '/scripts/learning-sensors/path-harness.html';
async function rpc(name, args) {
  calls.push({ name, args });
  assert.ok(parameters[name], name);
  return serial(async () => {
    const role = ['learning_path_open', 'learning_path_action', 'learning_vocab_cue_open', 'learning_vocab_cue_action'].includes(name) ? 'anon' : 'authenticated';
    await f.db.exec(`reset role; set role ${role}; select set_config('test.academy','${f.A}',false),set_config('test.staff','yes',false)`);
    try {
      const data = await f.call(name, ...parameters[name].map(key => ['p_cards', 'p_contexts', 'p_timetable'].includes(key) && args[key] != null ? JSON.stringify(args[key]) : args[key] ?? null));
      if (name.includes('approve') && args.p_draft && loseHomeworkResponse) {
        loseHomeworkResponse = false;
        return { data: null, error: { message: 'Failed to fetch' } };
      }
      return { data, error: null };
    } catch (error) { return { data: null, error: { message: error.message, code: error.code } }; }
    finally { await f.db.exec('reset role'); }
  });
}

let browser, page;
try {
  await f.db.exec(f.read('115_vocab_learning_loop.sql'));
  if (withCues) {
    await f.db.exec("alter table word_bank add column example_sentence text; insert into word_bank values ('cat','고양이','noun',1,'The cat is sleeping in a basket.')");
    await f.db.exec(f.read('116_vocab_cues.sql'));
  }
  const bundle = await build({
    root, logLevel: 'error',
    define: { 'import.meta.env.VITE_LEARNING_SENSORS_ENABLED': JSON.stringify('false') },
    plugins: [{ name: 'isolated-vocabulary-loop', enforce: 'pre',
      load(id) { if (id.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) return stub; }
    }],
    build: { write: false, copyPublicDir: false, minify: false,
      rollupOptions: { input: fileURLToPath(new URL('../..' + harness, import.meta.url)) } }
  });
  const assets = new Map(bundle.output.map(file => ['/' + file.fileName, file.type === 'chunk' ? file.code : file.source]));
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const requested = new URL(route.request().url());
    if (requested.origin !== origin) return route.abort();
    if (requested.pathname === '/__vocab-test-rpc') {
      const { name, args } = route.request().postDataJSON();
      return route.fulfill({ json: await rpc(name, args) });
    }
    const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css', webp: 'image/webp' };
    const contentType = mime[requested.pathname.split('.').pop()];
    const asset = assets.get(requested.pathname);
    if (typeof asset === 'string') return route.fulfill({ contentType, body: asset });
    if (/^\/skins\/adventure\/(balloon|train)\.webp$/.test(requested.pathname)) {
      const body = await readFile(new URL('../..' + '/public' + requested.pathname, import.meta.url));
      return route.fulfill({ contentType, body });
    }
    return route.abort();
  });
  const url = origin + harness;
  const button = name => page.getByRole('button', { name, exact: true });
  const assignment = kind => serial(async () => (await f.one(
    "select a.id from solo_assignments a join learning_vocab_approvals v on v.lesson_id=a.lesson_id where a.kind=$1", [kind]
  )).id);
  const visitStudent = async kind => page.goto(`${url}?mode=student&token=${f.TK}&assignment=${await assignment(kind)}&homework=${kind === 'homework'}`);
  const submitWord = async word => {
    for (const letter of word) await button(letter).click();
    await button('내기').click();
    await button('계속하기').click();
  };

  if (withCues) {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', { value: {
        getVoices: () => [], speak: utterance => setTimeout(() => utterance.dispatchEvent(new Event('end')), 30),
      }});
    });
    await page.goto(url);
    await page.getByRole('option', { name: '읽기·듣기·철자 맞춤 연습 + 게임' }).waitFor({ state: 'attached' });
    await page.getByText('반 수업·복습 요일 설정',{exact:true}).click();
    const classDays=page.getByRole('group',{name:'대면 수업 요일'});
    const reviewDays=page.getByRole('group',{name:'집 복습 요일'});
    for(const day of ['월','수']) await classDays.getByLabel(day,{exact:true}).check();
    for(const day of ['금','일']) await reviewDays.getByLabel(day,{exact:true}).check();
    await button('요일 저장').click();
    await page.getByRole('status').filter({hasText:'반 요일을 저장했어요.'}).waitFor();
    await page.getByLabel('수업 이름', { exact: true }).fill('단서를 바꾸는 어휘');
    await page.getByLabel(/단어 \| 뜻 \| 예문/).fill('cat | 고양이 | The cat can jump.');
    await page.getByRole('group',{name:'다음 수업 전 필수 목표'}).getByLabel('뜻을 보고 철자 쓰기').check();
    await page.getByLabel('학생 A', { exact: true }).check();
    await page.getByLabel(/내용과 학생을 확인했으며/).check();
    await button('이 계획으로 배정').click();
    await page.getByRole('status').filter({ hasText: '배정했어요' }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await visitStudent('lesson');
    await page.getByText('뜻을 보고 철자 쓰기', { exact: true }).waitFor();
    await page.getByText('다음 수업 전 필수 목표',{exact:true}).waitFor();
    await button('아직 모르겠어요').click();
    await page.getByText('듣고 뜻 알기', { exact: true }).waitFor();
    const meaning = page.locator('[data-choice]').filter({ hasText: '고양이' });
    assert.equal(await meaning.isDisabled(), true);
    assert.equal(await page.getByText('cat', { exact: true }).count(), 0);
    await button('단어 듣기').click();
    await button('아직 모르겠어요').click();
    await page.getByText('글로 보고 뜻 알기', { exact: true }).waitFor();
    await meaning.click();
    await button('가리고 연습하기').click();
    await page.getByRole('heading', { name: '철자 기차' }).waitFor();
    for (const letter of 'cat') await button(letter).click();
    await button('확인').click();
    await button('계속하기').click();
    await button('가리고 연습하기').click();
    await page.getByRole('heading', { name: '뜻 풍선 터뜨리기' }).waitFor();
    await button('단어 듣기').click();
    await meaning.click();
    await button('계속하기').click();
    await page.getByRole('heading', { name: '도움 없이 다시 확인해요' }).waitFor();
    await submitWord('cat');
    await button('단어 듣기').click();
    await meaning.click();
    await button('계속하기').click();
    await page.getByText('처음 막힌 항목 2개 중 2개를 도움 없이 다시 맞혔어요.', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(url);
    await page.getByRole('region',{name:'다음 수업 전 필수 목표 현황'}).getByText(/기한 내 확인 1\/1개/).waitFor();
    await page.getByText(/듣고 뜻 알기 · 첫 확인 0\/1 맞힘 · 최근 확인 1\/1 맞힘/).waitFor();
    await button('반 후속 숙제 초안').click();
    const editor = page.getByRole('region', { name: '어휘 추천 초안 편집' });
    const sentence = editor.getByLabel('cat · 고양이');
    assert.equal(await sentence.inputValue(), 'The cat is sleeping in a basket.');
    await sentence.fill('The cat can jump!');
    assert.equal(await button('승인하고 숙제 배정').isDisabled(), true);
    await sentence.fill('The cat waited by the window.');
    const opens=editor.getByLabel(/학생에게 열리는 날짜/);
    assert.ok(await opens.inputValue());
    await opens.fill('');
    await editor.getByRole('checkbox', { name: /새 문장을 검토했습니다/ }).check();
    await button('승인하고 숙제 배정').click();
    await button('같은 배정 다시 확인').click();
    await page.getByText('후속 숙제를 배정하고 이 개별수업에 연결했어요.', { exact: true }).waitFor();
    await visitStudent('homework');
    await page.getByText('The cat waited by the window.', { exact: true }).waitFor();
    await button('아직 모르겠어요').click();
    await button('계속하기').click();
    await page.getByRole('heading', { name: '오늘의 확인을 마쳤어요' }).waitFor();
    await page.goto(url);
    await page.getByText(/새 문장 숙제 1\/1명 응답 · 0명 맞힘/).waitFor();
    await button('반 보충 수업 초안').click();
    await editor.getByText(/문장을 읽고 문맥으로 뜻을 고르는 연습/).waitFor();
    assert.equal(await editor.getByRole('group',{name:'집중할 단서'}).getByRole('checkbox', { name: '글로 보고 뜻 알기' }).isChecked(), true);
    await editor.getByLabel(/단어 \| 뜻 \| 예문/).fill('cat | 고양이 | The cat is looking for a toy.');
    await editor.getByRole('checkbox', { name: /이후 복습 확인까지 검토했습니다/ }).check();
    await button('승인하고 수업 배정').click();
    await page.getByText('보충 개별수업을 배정했어요.', { exact: true }).waitFor();
    assert.equal(calls.filter(call => call.name === 'learning_vocab_cue_approve_scheduled' && call.args.p_contextual).length, 1);
    assert.deepEqual(errors, []);
    console.log('Vocabulary cues browser passed: class days, essential goals, mobile games, simulated audio, editable scheduled homework and contextual approvals.');
  } else {
  await page.goto(url);
  await page.getByRole('option', { name: '뜻 풍선 + 철자 기차' }).waitFor({ state: 'attached' });
  await page.getByLabel('수업 이름', { exact: true }).fill('이번 주 어휘');
  await page.getByLabel(/단어 \| 뜻 \| 예문/).fill('cat | 고양이');
  await page.getByLabel('학생 A', { exact: true }).check();
  assert.equal(await button('이 계획으로 배정').isDisabled(), true);
  await page.getByLabel(/내용과 학생을 확인했으며/).check();
  await button('이 계획으로 배정').click();
  await page.getByRole('status').filter({ hasText: '배정했어요' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await visitStudent('lesson');
  await page.getByRole('heading', { name: '먼저 혼자 떠올려요' }).waitFor();
  assert.equal(await page.getByText('cat', { exact: true }).count(), 0);
  await button('아직 모르겠어요').click();
  await button('계속하기').click();
  await button('가리고 풍선 고르기').click();
  await page.getByRole('heading', { name: '뜻 풍선 터뜨리기' }).waitFor();
  const wrong = page.locator('[data-choice]').filter({ hasNotText: 'cat' }).first();
  await wrong.click();
  await page.getByRole('status').filter({ hasText: '방금 본 단어' }).waitFor();
  await page.locator('[data-choice]').filter({ hasText: 'cat' }).click();
  await page.getByRole('heading', { name: '철자 기차' }).waitFor();
  await button('작은 힌트 보기').click();
  await page.getByText('첫 글자: c').waitFor();
  for (const letter of 'cat') await button(letter).click();
  await button('확인').click();
  await button('계속하기').click();
  await page.getByRole('heading', { name: '혼자 다시 확인해요' }).waitFor();
  assert.equal(await page.getByText('cat', { exact: true }).count(), 0);
  await submitWord('cat');
  await page.getByRole('heading', { name: '오늘은 여기까지예요' }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(url);
  await page.getByText('혼자 확인 1/1명 · 그중 1명 맞힘', { exact: true }).waitFor();
  await button('반 후속 숙제 초안').click();
  const editor = page.getByRole('region', { name: '어휘 추천 초안 편집' });
  await editor.getByLabel('이름', { exact: true }).fill('다시 떠올리기');
  assert.equal(await button('승인하고 숙제 배정').isDisabled(), true);
  assert.equal(calls.filter(call => call.name === 'learning_vocab_approve').length, 1);
  await editor.getByRole('checkbox', { name: /이후 복습 확인까지 검토했습니다/ }).check();
  await button('승인하고 숙제 배정').click();
  await button('같은 배정 다시 확인').click();
  await page.getByText('후속 숙제를 배정하고 이 개별수업에 연결했어요.', { exact: true }).waitFor();
  const retries = calls.filter(call => call.name === 'learning_vocab_approve' && call.args.p_draft);
  assert.equal(retries.length, 2);
  assert.deepEqual(retries[0].args, retries[1].args);
  await page.getByText(/후속 숙제 첫 답 0\/1명/).waitFor();
  await visitStudent('homework');
  await submitWord('cat');
  await submitWord('cat');
  await page.getByRole('heading', { name: '오늘 숙제를 마쳤어요' }).waitFor();
  await page.goto(url);
  await page.getByText(/후속 숙제 첫 답 1\/1명 · 그중 1명 맞힘/).waitFor();
  await page.getByText('학생 A · 혼자 확인 1/1', { exact: true }).click();
  await page.getByText(/연습 중 힌트 사용/).waitFor();
  await page.getByText(/후속 숙제 첫 답 맞힘/).waitFor();
  assert.deepEqual(errors, []);
  console.log('Vocabulary loop browser passed: two mobile games, independent check, editable approval, idempotent retry and linked student/class feedback.');
  }
} catch (error) {
  if (page) console.error((await page.locator('body').innerText()).slice(0, 1800));
  throw error;
} finally {
  await browser?.close();
  await pending;
  await f.db.close();
}
