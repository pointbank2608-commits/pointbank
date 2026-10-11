// 복습·누적 테스트·다시 배우기(lib/soloReview.ts) 확인 — 서버 기록 모양의 가짜 데이터로 문제가 만들어지는지 본다.
// 실행: node app/scripts/solo/check-review.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stub = { name: 'stub-supabase', enforce: 'pre', load(id) { if (id.split(String.fromCharCode(92)).join('/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};'; } };
const server = await createServer({ root, logLevel: 'error', plugins: [stub], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const day = 86400000;
const W = (word, o = {}) => ({ word, meaning: `${word} 뜻`, image_url: null, example: null, pos: '명사', right: 0, wrong: 0, unsure: 0, last_at: new Date(Date.now() - 1 * day).toISOString(), recent: false, missed_here: false, ...o });
let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { failed += 1; console.log('FAIL', name, '\n     ', e.message); } };

try {
  const r = await server.ssrLoadModule('/src/lib/soloReview.ts');
  const pool = [
    W('apple', { recent: true, right: 2 }), W('banana', { recent: true, wrong: 2 }), W('cat', { recent: true }), W('dog', { recent: true, unsure: 1 }),
    W('egg', { recent: true, right: 1 }), W('fish', { recent: true }), W('goat', { wrong: 3 }), W('hat', { unsure: 2, last_at: new Date(Date.now() - 30 * day).toISOString() }),
    W('ice', { last_at: new Date(Date.now() - 40 * day).toISOString() }), W('jam'), W('kite', { missed_here: true }), W('lion', { missed_here: true, wrong: 1 }),
  ];
  const types = (l) => l.steps.map((s) => s.t);

  await test('어제 복습: 최근 낱말 5개, 문제마다 낱말이 있다', () => {
    const picked = r.pickReviewWords(pool, 'daily');
    assert.equal(picked.length, 5);
    assert.ok(picked.every((w) => w.recent));
    const l = r.buildReviewLesson('daily', pool, picked, '복습');
    assert.equal(l.steps[0].t, 'intro');
    assert.equal(l.steps.length, 1 + 5 * 2);
    for (const s of l.steps.slice(1)) {
      assert.ok(['pickMeaning', 'listenPick'].includes(s.t));
      assert.ok(s.options[s.answer], '정답 보기가 있어야 함');
    }
  });

  await test('누적 테스트: 약한 낱말이 먼저 들어가고 12개 이하', () => {
    const picked = r.pickReviewWords(pool, 'cumulative');
    assert.ok(picked.length >= 8 && picked.length <= 12, `선택 ${picked.length}`);
    const names = picked.map((w) => w.word);
    for (const weak of ['goat', 'banana', 'hat']) assert.ok(names.includes(weak), `${weak} 포함`);
    const l = r.buildReviewLesson('cumulative', pool, picked, '누적 테스트');
    assert.equal(l.steps.length, 1 + picked.length);
    // 모든 문제 낱말은 서버 검사(solo_step_word)와 같은 규칙으로 뽑을 수 있어야 한다
    for (const s of l.steps.slice(1)) {
      const word = s.t === 'pickWord' ? s.options[s.answer] : s.word;
      assert.ok(word && names.includes(word), `${s.t} 낱말 ${word}`);
    }
    console.log('  종류:', JSON.stringify(types(l).reduce((m, t) => ((m[t] = (m[t] ?? 0) + 1), m), {})));
  });

  await test('다시 배우기: 틀린 낱말마다 만나기→뜻 고르기', () => {
    const picked = r.pickReviewWords(pool, 'relearn');
    assert.deepEqual(picked.map((w) => w.word).sort(), ['kite', 'lion']);
    const l = r.buildReviewLesson('relearn', pool, picked, '다시 배우기');
    assert.deepEqual(types(l).slice(0, 3), ['intro', 'meet', 'pickMeaning']);
  });

  await test('낱말이 모자라면 null', () => {
    const few = [W('a1'), W('b1'), W('c1')];
    assert.equal(r.buildReviewLesson('cumulative', few, r.pickReviewWords(few, 'cumulative'), 'x'), null);
  });
} finally {
  await server.close();
}
if (failed) { console.log(`\n${failed}개 실패`); process.exit(1); }
console.log('\n모두 통과');
