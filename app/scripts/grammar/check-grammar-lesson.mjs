// 문법 30분 수업(2026-11-03) 구성 검사 — 슬라이드 순서·시간표·게임 연결·자료 없는 문법의 예전 수업 복귀.
// 실행: node app/scripts/grammar/check-grammar-lesson.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stubSupabase = {
  name: 'stub-supabase', enforce: 'pre',
  load(id) { if (id.split('\\').join('/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};'; },
};
const server = await createServer({ root, logLevel: 'error', plugins: [stubSupabase], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { failed += 1; console.log('FAIL', name, '\n     ', e.message); } };
const t = (k) => k;

try {
  const gl = await server.ssrLoadModule('/src/lib/grammarLesson.ts');
  const bank = (await server.ssrLoadModule('/src/data/grammarSheets/index.ts')).GRAMMAR_SHEET_BANK;
  const ids = Object.keys(bank).filter((id) => gl.hasGrammarLessonBank(id));
  const id = ids[0];
  const secs = (s) => (s.helpers ?? []).filter((h) => h.type === 'timer').reduce((a, h) => a + h.seconds, 0);

  await test('자료가 있는 문법이 대부분이다', () => assert.ok(ids.length > 100, `only ${ids.length}`));
  await test('전체 구성: 순서·게임·시간', () => {
    const slides = gl.buildGrammarLessonSlides({ t, grammarId: id, hasWords: false, games: { unscrambleId: 'u1', teamQuizId: 'q1' } });
    const kinds = slides.filter((s) => s.title !== 'grammarLesson.factoryTitle').map((s) => s.kind + (s.kind === 'game' ? ':' + s.gameType : ''));
    assert.deepEqual(kinds, ['attendance', 'canvas', 'grammar', 'qna', 'qna', 'game:unscramble', 'qna', 'qna', 'game:gameshowquiz', 'canvas', 'qna']);
    const total = slides.reduce((a, s) => a + secs(s), 0);
    assert.ok(total >= 28 * 60 && total <= 37 * 60, `total ${total}s`);
    assert.equal(slides.find((s) => s.kind === 'game' && s.gameType === 'gameshowquiz').templateId, 'q1');
    assert.ok(slides[4].helpers.some((h) => h.type === 'scoreboard'));
  });
  await test('모든 문법의 문제 슬라이드는 질문이 비지 않는다', () => {
    for (const gid of ids) {
      const slides = gl.buildGrammarLessonSlides({ t, grammarId: gid, hasWords: false, games: { unscrambleId: null, teamQuizId: null } });
      for (const s of slides.filter((x) => x.kind === 'qna')) {
        assert.ok(s.questions.length > 0, `${gid} empty qna`);
        for (const q of s.questions) assert.ok(q.q && q.a, `${gid} blank q/a`);
      }
    }
  });
  await test('문장 공장 슬라이드: 변형 가능한 문법에 붙고 정답이 비지 않는다', () => {
    let withFactory = 0;
    for (const gid of ids) {
      const slides = gl.buildGrammarLessonSlides({ t, grammarId: gid, hasWords: false, games: { unscrambleId: null, teamQuizId: null } });
      const f = slides.find((s) => s.title === 'grammarLesson.factoryTitle');
      if (!f) continue;
      withFactory += 1;
      assert.ok(f.questions.length >= 6 && f.questions.every((q) => q.q && q.a && q.a.endsWith('.') || q.a.endsWith('?')));
    }
    assert.ok(withFactory >= 10, `factory on ${withFactory}`);
  });
  await test('게임이 없으면 게임 슬라이드만 빠진다', () => {
    const slides = gl.buildGrammarLessonSlides({ t, grammarId: id, hasWords: false, games: { unscrambleId: null, teamQuizId: null } });
    assert.ok(!slides.some((s) => s.kind === 'game'));
  });
  await test('자료 없는 문법은 예전 짧은 수업', () => {
    const slides = gl.buildGrammarLessonSlides({ t, grammarId: 'no-such-id', hasWords: false, games: { unscrambleId: 'u1', teamQuizId: null } });
    assert.deepEqual(slides.map((s) => s.kind), ['attendance', 'grammar', 'game']);
  });
  await test('팀 퀴즈 문항은 보기 정답 위치가 맞다', () => {
    const q = gl.chooseToQuiz(bank[id].choose.slice(0, 6));
    q.forEach((x, i) => assert.equal(x.choices[x.correctIndex], bank[id].choose[i].c[bank[id].choose[i].a]));
  });
} finally {
  await server.close();
}
if (failed) { console.log(`\n${failed}개 실패`); process.exit(1); }
console.log('\n전부 통과');
