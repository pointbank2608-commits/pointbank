// 문장 공장(2026-11-03) 규칙 검사. 실행: node app/scripts/grammar/check-sentence-factory.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let failed = 0;
const test = async (n, f) => { try { await f(); console.log('ok  ', n); } catch (e) { failed++; console.log('FAIL', n, '\n     ', e.message); } };
try {
  const f = await server.ssrLoadModule('/src/lib/sentenceFactory.ts');
  const T = (s) => Object.fromEntries(f.transformSentence(s).map((x) => [x.kind, x.to]));
  await test('일반동사 3인칭', () => {
    const r = T('She plays soccer.');
    assert.equal(r.negative, 'She does not play soccer.');
    assert.equal(r.question, 'Does she play soccer?');
    assert.equal(r.past, 'She played soccer.');
    assert.equal(r.future, 'She will play soccer.');
    assert.equal(r.subjectThey, 'They play soccer.');
    assert.equal(r.present, undefined);
  });
  await test('일반동사 1인칭·불규칙', () => {
    const r = T('I eat breakfast.');
    assert.equal(r.past, 'I ate breakfast.');
    assert.equal(r.negative, 'I do not eat breakfast.');
    assert.equal(r.subjectHe, 'He eats breakfast.');
  });
  await test('과거 문장 → 현재', () => {
    const r = T('They watched a movie.');
    assert.equal(r.present, 'They watch a movie.');
    assert.equal(r.negative, 'They did not watch a movie.');
    assert.equal(r.question, 'Did they watch a movie?');
  });
  await test('be동사', () => {
    const r = T('I am happy.');
    assert.equal(r.negative, 'I am not happy.');
    assert.equal(r.question, 'Am I happy?');
    assert.equal(r.past, 'I was happy.');
    assert.equal(r.future, 'I will be happy.');
    assert.equal(r.subjectThey, 'They are happy.');
    const w = T('We were tired.');
    assert.equal(w.present, 'We are tired.');
    assert.equal(w.subjectHe, 'He was tired.');
  });
  await test('조동사', () => {
    const r = T('He can swim.');
    assert.equal(r.negative, 'He cannot swim.');
    assert.equal(r.question, 'Can he swim?');
    assert.equal(r.past, undefined);
    assert.equal(T('You should go.').negative, 'You should not go.');
  });
  await test('철자 규칙', () => {
    assert.equal(T('She studies English.').past, 'She studied English.');
    assert.equal(T('He stops the car.').past, 'He stopped the car.');
    assert.equal(T('She watches TV.').negative, 'She does not watch TV.');
    assert.equal(T('I like cake.').past, 'I liked cake.');
  });
  await test('확실하지 않은 문장은 건너뛴다', () => {
    for (const s of ['She play soccer.', 'Is she a teacher?', 'She plays soccer every day.', 'I do not like milk.', 'There is a book.']) {
      const r = T(s);
      assert.ok(!r.past && !r.future, `${s} -> ${JSON.stringify(r)}`);
    }
    assert.equal(T('I like my dog.').subjectThey, undefined);
    assert.equal(T('I like my dog.').question, undefined);
  });
  await test('buildFactoryItems: 종류가 고루, 개수 제한', () => {
    const items = f.buildFactoryItems(['She plays soccer.', 'I eat breakfast.', 'They watched a movie.', 'I am happy.', 'He can swim.'], { perSentence: 3, max: 12 });
    assert.ok(items.length >= 10 && items.length <= 12);
    assert.ok(new Set(items.map((x) => x.kind)).size >= 4);
    assert.ok(items.every((x) => x.to !== x.from));
  });
} finally { await server.close(); }
if (failed) { console.log(`\n${failed}개 실패`); process.exit(1); }
console.log('\n전부 통과');
