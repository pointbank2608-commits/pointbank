import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';

// Only the session RPC is replaced. Exercise the shipped storage and activity navigation code.
const root = fileURLToPath(new URL('../../', import.meta.url));
const cacheDir = await mkdtemp(join(tmpdir(), 'student-activities-'));
const server = await createServer({
  root, cacheDir, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null, ws: false },
  optimizeDeps: { noDiscovery: true },
  plugins: [{ name: 'isolated-student-session', enforce: 'pre', load(id) {
    if (id.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) {
      return 'export const supabase={rpc:async name=>({data:name==="hw_state"?{finished:globalThis.__history}: {token:"test-session"},error:null})};';
    }
    if (id.replaceAll('\\', '/').endsWith('/src/lib/learningSensors/delivery.ts'))
      return 'export const openDelivery=async(_source,_credential,_resource,load)=>{globalThis.__deliveries++;return load()}; export const deliveryAction=async()=>null;';
  } }],
});
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
try {
  const { activityGroups, nextActivityCard } = await server.ssrLoadModule('/src/lib/homework/activityGroups.ts');
  const words = { id: 'words', kind: 'quiz', title: '뜻 고르기', config: { block: { type:'recall', schemaVersion:1, method:'material:choice', completion: 'answers', groupKey: 'set1-choice' } }, content: { questions: Array(10).fill({}) } };
  const sentences = Array.from({ length: 8 }, (_, i) => ({ id: 'line-' + i, kind: 'worksheet', title: '읽고 가리고 말하기',
    config: { block: { type:'speak', schemaVersion:1, method:'material:hide', completion: 'recording', groupKey: 'set2-hide-one' } }, content: { questions: [] } }));
  const empty = { id: 'empty', kind: 'quiz', title: 'empty', config: {}, content: { questions: [] } };
  const items = [words, ...sentences, empty];
  const groups = activityGroups(items);
  assert.deepEqual(groups.map(group => group.count), [10, 8]);
  const done = new Set();
  done.add(words.id);
  assert.deepEqual(nextActivityCard(items, groups, done, 0), { index: 1, transition: true });
  for (let i = 1; i < sentences.length; i++) {
    done.add(items[i].id);
    assert.deepEqual(nextActivityCard(items, groups, done, i), { index: i + 1, transition: false });
  }
  done.add(items[8].id);
  assert.equal(nextActivityCard(items, groups, done, 8), null);
  done.delete(words.id);
  assert.deepEqual(nextActivityCard(items, groups, done, 8), { index: 0, transition: true });
  const other = { ...sentences[0], id: 'other-role', config: { block: { completion: 'recording', groupKey:'other-source-and-options' } } };
  assert.deepEqual(activityGroups([...sentences, other]).map(group => group.count), [8, 1]);
  assert.equal(activityGroups([{ ...empty, config:{ block:{ method:'flip', text:'bat | 박쥐\nship | 배' } } }])[0].count, 2);
  console.log('PASS grouped 10+8 cards, skipped empty row, out-of-order completion, one transition, legacy cards and distinct settings');

  const history = (await server.ssrLoadModule('/src/components/homework/CompletedHomework.tsx')).default;
  const i18n = createInstance();
  await i18n.init({ lng: 'ko', resources: { ko: { translation: {} } } });
  const runner = (await server.ssrLoadModule('/src/components/homework/HomeworkRunner.tsx')).default;
  const intro = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(runner, {
    title:'Family Road Trip', items, initialAnswers:new Map(), finishedItems:new Set(), shadowLinesDone:new Map(), alreadyFinished:false, api:{}, saveState:'saved'
  })));
  assert.equal((intro.match(/<button/g) ?? []).length,2);
  assert.ok(intro.includes('10단어') && intro.includes('8문장'));
  console.log('PASS student activity list renders two actionable groups without a global start button');
  const first = { ...words, content: { questions: [{ qtype:'choice', prompt:'road', choices:['길','배','사과','모자'] }] } };
  const state = { title:'이전 배정', items:[first, sentences[0]], item_attempts:[{ item_id:sentences[0].id, finished:true, meta:{ recording:'private-path' } }],
    answers:[{ item_id:first.id, q_index:0, correct:false, response:'1', answer:'길' }] };
  const markup = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(history, { state, onHome() {} })));
  assert.ok(markup.includes('Incorrect · 배') && markup.includes('정답 · 길') && markup.includes('녹음 제출 완료'));
  assert.equal(markup.includes('private-path'), false);
  assert.equal((markup.match(/<button/g) ?? []).length, 1); // Only the home button; this view receives no mutation API.
  globalThis.__deliveries = 0;
  const { hwState } = await server.ssrLoadModule('/src/lib/homework/studentApi.ts');
  globalThis.__history = true;
  assert.equal((await hwState('completed')).finished,true);
  assert.equal(globalThis.__deliveries,0);
  globalThis.__history = false;
  assert.equal((await hwState('active')).finished,false);
  assert.equal(globalThis.__deliveries,1);
  console.log('PASS completed detail renders stored choice, answer, and recording status without starting a new learning run');

  const student = await server.ssrLoadModule('/src/lib/studentPortal.ts');
  const key = 'classbank.studentToken';
  globalThis.window = { sessionStorage: storage(), localStorage: storage() };
  window.localStorage.setItem(key, 'previous-version-token');
  assert.equal(student.savedToken(), 'previous-version-token');
  await student.studentLogin('', 'Test student', '01000000000');
  assert.equal(window.localStorage.getItem(key), null);
  assert.equal(window.sessionStorage.getItem(key), 'test-session');
  await student.studentLogin('', 'Test student', '01000000000', '', true);
  assert.equal(window.sessionStorage.getItem(key), null);
  assert.equal(window.localStorage.getItem(key), 'test-session');
  await student.studentLogout(student.savedToken());
  assert.equal(student.savedToken(), null);
  assert.equal(window.localStorage.getItem(key), null);
  assert.equal(window.sessionStorage.getItem(key), null);
  console.log('PASS legacy login, session-only login, persistent login, explicit logout');
} finally {
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
