// 개별수업 시험 블록(lib/soloTest.ts) 확인 — 수업 단계로 시험을 만들고, 영역이 섞이는지·정답이 학생에게 안 가는지·채점이 맞는지 본다.
// 실행: node app/scripts/solo/check-test-block.mjs   (저장소 루트 또는 app/ 어디서든)
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stubSupabase = {
  name: 'stub-supabase',
  enforce: 'pre',
  load(id) {
    if (id.replace(/\\/g, '/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};';
  },
};
const server = await createServer({ root, logLevel: 'error', plugins: [stubSupabase], server: { middlewareMode: true, hmr: false }, appType: 'custom' });

try {
  const L = await server.ssrLoadModule('/src/lib/soloLessons.ts');
  const T = await server.ssrLoadModule('/src/lib/soloTest.ts');
  const E = await server.ssrLoadModule('/src/lib/soloEdit.ts');

  const words = 'apple banana milk bread cheese egg dog cat bird fish rabbit horse'.split(' ').map((w, i) => ({
    id: `w${i}`,
    word: w,
    meaning: `${w}뜻`,
    imageUrl: i % 3 === 0 ? null : `/img/${w}.webp`,
    example: `I like the ${w} very much.`,
    partOfSpeech: i % 4 === 0 ? '동사' : i % 4 === 1 ? '형용사' : '명사',
  }));
  const lesson = L.buildSoloWordSteps('과일', words);
  lesson.push({ t: 'pickCorrect', options: ['He is happy.', 'He are happy.'], answer: 0, why: 'he → is' });
  lesson.push({ t: 'unscramble', sentence: 'I like red apples', words: ['red', 'I', 'apples', 'like'] });

  // 1) 만들기: 길이·영역 섞임·문제 모양
  const cap = T.testCapacity(lesson);
  assert.ok(cap >= 20, `만들 수 있는 문제가 충분해야 한다(${cap})`);
  const test = T.buildTestStep(lesson, { count: 20, timed: true, title: '확인 시험' });
  assert.ok(test, '시험이 만들어져야 한다');
  assert.equal(test.items.length, 20);
  const counts = T.areaCounts(test.items);
  for (const a of T.TEST_AREAS) assert.ok(counts[a] > 0, `영역 ${a} 문제가 있어야 한다(${JSON.stringify(counts)})`);
  assert.ok(test.items.every((it) => it.sec >= 5 && T.TEST_ITEM_TYPES.includes(it.t)), '문제마다 제한 시간과 채점되는 모양');
  assert.ok(test.items.every((it) => E.stepProblems(it).length === 0), '만든 문제에 저장 전 검사 문제가 없어야 한다');
  assert.deepEqual(E.stepProblems(test), [], '시험 블록 자체도 검사 통과');
  // 영역 순서: 어휘 → 듣기 → 쓰기 → 문장
  const order = test.items.map((it) => T.TEST_AREAS.indexOf(it.area));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), '영역별로 모여 있어야 한다');
  // 수업에 있던 문장 문제가 들어온다(보기 순서는 다시 섞여도 정답은 같은 문장)
  const pc = test.items.find((it) => it.t === 'pickCorrect');
  assert.ok(pc && pc.options[pc.answer] === 'He is happy.', '맞는 문장 고르기 문제가 정답과 함께 들어와야 한다');

  // 2) 학생에게 가는 모양에는 정답이 없다
  const pub = L.toPublicStep(test);
  for (const it of pub.items) {
    assert.ok(!('answer' in it), `${it.t}: answer 가 빠져야 한다`);
    if (it.t === 'typeWord' || it.t === 'spell') assert.ok(!('word' in it), `${it.t}: word 가 빠져야 한다`);
    if (it.t === 'unscramble') assert.ok(!('sentence' in it), 'unscramble: sentence 가 빠져야 한다');
    assert.ok(it.area && it.sec, '영역·시간은 남아야 한다');
  }

  // 3) 채점: 다 맞히기 / 빈 답은 오답
  const right = test.items.map((it) => {
    if ('answer' in it) return String(it.answer);
    if (it.t === 'unscramble') return it.sentence;
    return it.word;
  });
  const full = T.gradeTestLocal(test.items, right);
  assert.equal(full.score, 20);
  assert.ok(Object.values(full.by_area).every((v) => v.right === v.total));
  const blank = T.gradeTestLocal(test.items, test.items.map(() => null));
  assert.equal(blank.score, 0);
  assert.ok(blank.items.every((x) => x.answer), '틀려도 정답 글자를 돌려준다');

  // 4) 재료가 적은 수업: 있는 만큼만, 아무것도 없으면 null
  const tiny = [{ t: 'intro', title: 'x', text: '' }, { t: 'pickCorrect', options: ['A is.', 'A are.'], answer: 0, why: '' }];
  const small = T.buildTestStep(tiny, { count: 10, timed: false, title: '' });
  assert.equal(small.items.length, 1);
  assert.equal(T.buildTestStep([{ t: 'intro', title: 'x', text: '' }], { count: 10, timed: true, title: '' }), null);

  // 5) 시험 블록은 블록 하나로 보인다(같은 수업의 블록 나누기)
  const withTest = [...lesson, test];
  const runs = E.stepRuns(withTest);
  assert.equal(runs[runs.length - 1].t, 'test');
  assert.equal(runs[runs.length - 1].start, runs[runs.length - 1].end);

  console.log(`시험 블록 확인 통과 — 20문항 ${JSON.stringify(counts)}, 최대 ${cap}문항`);
} finally {
  await server.close();
}
