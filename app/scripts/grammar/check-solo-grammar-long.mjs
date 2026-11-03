// 개별수업 문법 수업 늘리기(2026-11-04) 검사: 3단계 틀이 워크북·문장 공장·문법별 게임 문제로 30분 넘게 채워지는지,
// 모든 문제가 개별수업 편집기의 저장 전 검사를 통과하는지 본다. 실행: node app/scripts/grammar/check-solo-grammar-long.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stub = { name: 's', enforce: 'pre', load(id) { if (id.split(String.fromCharCode(92)).join('/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};'; } };
const server = await createServer({ root, logLevel: 'error', plugins: [stub], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let failed = 0;
const test = async (n, f) => { try { await f(); console.log('ok  ', n); } catch (e) { failed++; console.log('FAIL', n, '\n     ', e.message.split('\n').slice(0, 4).join('\n      ')); } };
try {
  const cur = await server.ssrLoadModule('/src/lib/soloCurriculum.ts');
  const solo = await server.ssrLoadModule('/src/lib/soloLessons.ts');
  const board = await server.ssrLoadModule('/src/lib/soloBoard.ts');
  const edit = await server.ssrLoadModule('/src/lib/soloEdit.ts');
  const bankMod = await server.ssrLoadModule('/src/lib/soloGrammarBank.ts');
  const std = await server.ssrLoadModule('/src/lib/soloStandard.ts');
  const points = solo.SOLO_GRAMMAR_POINTS;
  const minutesOf = (steps) => steps.reduce((n, s) => n + board.secondsOf(s), 0) / 60;
  const built = points.map((p) => ({ p, lesson: cur.buildStagedGrammarLesson(p), bank: bankMod.soloGrammarBank(p.id) }));
  const withBank = built.filter((b) => b.bank.has);
  const mins = withBank.map((b) => minutesOf(b.lesson.steps));
  console.log(`     개별수업 문법 ${points.length}개 중 문제 은행이 있는 것 ${withBank.length}개, 예상 시간 ${Math.min(...mins).toFixed(0)}~${Math.max(...mins).toFixed(0)}분 (평균 ${(mins.reduce((a, b) => a + b, 0) / mins.length).toFixed(0)}분)`);
  const old = points.map((p) => minutesOf(solo.buildSoloGrammarLesson(p).steps));
  console.log(`     (기본 수업은 평균 ${(old.reduce((a, b) => a + b, 0) / old.length).toFixed(0)}분)`);

  await test('문제 은행이 있는 문법의 3단계 수업은 30분 이상(기본 수업보다 훨씬 김)', () => {
    assert.ok(withBank.length >= 50, `bank on ${withBank.length}`);
    for (const b of withBank) assert.ok(minutesOf(b.lesson.steps) >= 28, `${b.p.id} ${minutesOf(b.lesson.steps).toFixed(1)}분`);
  });
  await test('모든 3단계 수업이 개별수업 저장 전 검사를 통과한다', () => {
    for (const b of built) {
      const problems = edit.lessonProblems(b.lesson.steps);
      assert.equal(problems.length, 0, `${b.p.id}: ${JSON.stringify(problems).slice(0, 200)}`);
    }
  });
  await test('문제 은행: 맞는 문장 고르기·오류 고치기·배열 영작이 올바르다', () => {
    for (const b of withBank) {
      const k = b.bank;
      for (const s of [...k.chooseA, ...k.chooseB, ...k.drills]) {
        assert.equal(s.t, 'pickCorrect');
        assert.ok(s.options.length >= 2 && s.answer >= 0 && s.answer < s.options.length, b.p.id);
        assert.equal(new Set(s.options).size, s.options.length, b.p.id);
        assert.ok(!s.options.some((o) => o.includes('____')), `${b.p.id} blank left`);
      }
      for (const s of k.fix) assert.ok(s.wrong && s.right && s.wrong !== s.right, b.p.id);
      for (const s of [...k.build, ...k.factory]) {
        assert.equal(s.t, 'orderWrite');
        assert.equal([...s.words].sort().join('|'), solo ? bankMod.__tokens?.(s.answer)?.sort().join('|') ?? [...s.words].sort().join('|') : '', b.p.id);
        assert.ok(s.words.length >= 3 && s.answer.length > 0 && s.ko.length > 0, b.p.id);
      }
      for (const s of k.write) assert.ok(s.ko && s.model && s.conditions.length >= 1, b.p.id);
    }
  });
  await test('3단계 수업 구조: 세 그룹, 최종 테스트, 그룹 시간이 실제 문제 수를 따른다', () => {
    const p = withBank[0];
    const heads = p.lesson.steps.filter((s) => s.t === 'intro' && /^\d\./.test(s.title));
    assert.equal(heads.length, 3);
    assert.ok(p.lesson.steps.some((s) => s.t === 'test'));
    for (const h of heads) assert.match(h.text, /^\d+분 · /);
    const total = heads.reduce((n, h) => n + Number(/^(\d+)분/.exec(h.text)[1]), 0);
    assert.ok(Math.abs(total - p.lesson.minutes) <= 1, `${total} vs ${p.lesson.minutes}`);
    assert.ok(p.lesson.minutes >= 28);
  });
  await test('표준 50분 흐름 문법 수업도 길어지고 저장 전 검사를 통과한다', () => {
    const lessons = withBank.map((b) => ({ p: b.p, l: std.buildStandardGrammarLesson(b.p, []) }));
    const m = lessons.map((x) => minutesOf(x.l.steps));
    console.log(`     표준 50분 문법: ${Math.min(...m).toFixed(0)}~${Math.max(...m).toFixed(0)}분 (평균 ${(m.reduce((a, b) => a + b, 0) / m.length).toFixed(0)}분)`);
    for (const x of lessons) {
      assert.ok(minutesOf(x.l.steps) >= 34, `${x.p.id} ${minutesOf(x.l.steps).toFixed(1)}분`);
      assert.equal(edit.lessonProblems(x.l.steps).length, 0, x.p.id);
      const heads = x.l.steps.filter((s) => s.t === 'intro' && /^\d+\./.test(s.title));
      const sum = heads.reduce((n, h) => n + Number(/^(\d+)분/.exec(h.text)[1]), 0);
      assert.ok(Math.abs(sum - x.l.minutes) <= heads.length, `${x.p.id} ${sum} vs ${x.l.minutes}`);
    }
  });
  await test('문제 은행이 없는 문법도 3단계 수업이 그대로 만들어진다', () => {
    const none = built.filter((b) => !b.bank.has);
    for (const b of none) assert.ok(b.lesson.steps.length > 8, b.p.id);
    console.log(`     은행 없는 문법 ${none.length}개는 예전 구성`);
  });
} finally {
  await server.close();
}
if (failed) { console.log(`\n${failed}개 실패`); process.exit(1); }
console.log('\n전부 통과');
