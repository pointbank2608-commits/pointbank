// 숙제 2단계(041) 핵심 순수 로직 가벼운 확인 — 테스트 도구 없이 Vite 로 TS 파일을 불러와 검사한다.
// 실행: node app/scripts/homework/check-logic.mjs   (저장소 루트 또는 app/ 어디서든)
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// 순수 로직만 본다 — 서버 연결 파일은 빈 것으로 바꿔 끼운다(네트워크·환경 변수 없이 돈다)
const stubSupabase = {
  name: 'stub-supabase',
  enforce: 'pre',
  load(id) {
    if (id.replace(/\\/g, '/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};';
  },
};
const server = await createServer({ root, logLevel: 'error', plugins: [stubSupabase], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let failed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    console.log('ok  ', name);
  } catch (e) {
    failed += 1;
    console.log('FAIL', name, '\n     ', e.message);
  }
};

try {
  const grade = await server.ssrLoadModule('/src/lib/homework/grade.ts');
  const build = await server.ssrLoadModule('/src/lib/homework/build.ts');
  const rec = await server.ssrLoadModule('/src/lib/homework/recommend.ts');

  // ---- 채점(서버 hw_grade 와 같은 규칙 — 041_check.sql 6번과 같은 예) ----
  await test('채점: 보기 번호', () => {
    assert.equal(grade.gradeLocal({ qtype: 'choice', correct: 2 }, '2'), true);
    assert.equal(grade.gradeLocal({ qtype: 'choice', correct: 2 }, '1'), false);
    assert.equal(grade.gradeLocal({ qtype: 'choice', correct: 2 }, '2abc'), false);
  });
  await test('채점: 철자(여러 답·대소문자·끝 문장부호·공백)', () => {
    assert.equal(grade.gradeLocal({ qtype: 'text', correct: 'color/colour' }, ' Colour. '), true);
    assert.equal(grade.gradeLocal({ qtype: 'text', correct: 'ice cream' }, 'ice   cream'), true);
    assert.equal(grade.gradeLocal({ qtype: 'text', correct: 'cat' }, ''), false);
  });
  await test('채점: 순서', () => {
    assert.equal(grade.gradeLocal({ qtype: 'order', correct: ['c', 'a', 't'] }, '["c","a","t"]'), true);
    assert.equal(grade.gradeLocal({ qtype: 'order', correct: ['c', 'a', 't'] }, '["a","c","t"]'), false);
    assert.equal(grade.gradeLocal({ qtype: 'order', correct: ['c'] }, 'not json'), false);
  });

  // ---- 문제 만들기 ----
  const cards = [
    ['apple', '사과', 'I eat an apple.'],
    ['dog', '개', 'The dog is big.'],
    ['book', '책', 'I read a book.'],
    ['happy', '행복한', 'I am happy today.'],
    ['school', '학교', 'We go to school.'],
    ['water', '물', 'I drink water.'],
    ['bird', '새', 'A bird can fly.'],
    ['green', '초록색', 'The leaf is green.'],
  ].map(([word, meaning, example], i) => ({ id: `c${i}`, word, meaning, example, imageUrl: i % 2 ? `/img/${word}.webp` : null }));
  const labels = { quiz: 'quiz', worksheet: 'ws', matchup: 'mu', anagram: 'an', spelling: 'sp', shadowing: 'sh' };
  let seed = 7;
  const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  for (const minutes of [5, 10, 15]) {
    await test(`문제 만들기: ${minutes}분 구성 — 모든 문제가 자기 정답으로 맞게 채점된다`, () => {
      const items = build.buildItems(cards, build.presetPlan(minutes, cards, false), labels, null, rng);
      assert.ok(items.length > 0, '활동이 하나도 없음');
      for (const it of items)
        for (const q of it.content.questions) {
          assert.ok(q.skill && q.word && q.gen, `skill/word/gen 빠짐: ${q.id}`);
          const answer = q.qtype === 'choice' ? String(q.correct) : q.qtype === 'text' ? String(q.correct).split('/')[0] : JSON.stringify(q.correct);
          assert.equal(grade.gradeLocal(q, answer), true, `${it.kind} ${q.style} 정답이 틀림으로 채점됨`);
          if (q.qtype === 'choice') assert.ok(Number(q.correct) < (q.choices?.length ?? 0), '정답 번호가 보기 밖');
          if (q.qtype === 'order') assert.deepEqual([...q.tokens].sort(), [...q.correct].sort(), '조각과 정답 낱말이 다름');
        }
    });
  }
  await test('문제 만들기: 워크시트 3종(고르기·빈칸·순서)·게임 3종(짝 맞추기·글자 섞기·철자)을 만들 수 있다', () => {
    const plan = { ...build.EMPTY_PLAN, sheetChoose: 3, sheetBlank: 3, sheetOrder: 3, gameMatchup: 5, gameAnagram: 3, gameSpelling: 3 };
    const items = build.buildItems(cards, plan, labels, null, rng);
    const ws = items.find((i) => i.kind === 'worksheet');
    assert.deepEqual(ws.config.sheets, ['choose', 'blank', 'order']);
    assert.deepEqual(items.filter((i) => i.kind === 'game').map((i) => i.config.game), ['matchup', 'anagram', 'spelling']);
  });

  // ---- 맞춤 추천 ----
  const ago = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
  await test('추천: 기록이 모자라면 개인화라고 하지 않고 반 공통 복습', () => {
    const r = rec.recommendForStudent({ graded: 10, completed_activities: 1, words: [] }, cards, cards.slice(0, 3), labels);
    assert.equal(r.personal, false);
    assert.ok(r.reasons.every((x) => x.kind === 'common_review'));
    assert.equal(r.ruleVersion, 'rec-v1');
  });
  await test('추천: 뜻을 틀린 낱말은 다른 모양(뜻→단어)으로, 15문제 이하, 이유가 붙는다', () => {
    const words = cards.map((c, i) => ({
      word: c.word,
      card: { meaning: c.meaning, example: c.example },
      last_seen: ago(i < 2 ? 2 : 20),
      skills: { 'vocab.meaning': i < 2 ? { wrong: 3, right: 0, last_wrong: ago(2), last_right: null } : { wrong: 0, right: 2, last_wrong: null, last_right: ago(20) } },
    }));
    const r = rec.recommendForStudent({ graded: 60, completed_activities: 6, words }, cards, [], labels);
    assert.equal(r.personal, true);
    const qs = r.items.flatMap((i) => i.content.questions);
    assert.ok(qs.length > 0 && qs.length <= 15, `문제 수 ${qs.length}`);
    const weak = r.reasons.filter((x) => x.kind === 'wrong_meaning').map((x) => x.word);
    assert.deepEqual(weak.sort(), ['apple', 'dog']);
    const appleQs = qs.filter((q) => q.word === 'apple');
    assert.ok(appleQs.length > 0 && appleQs.every((q) => q.style !== 'meaning'), '틀린 문제와 같은 모양(뜻 고르기)을 그대로 냄');
    assert.ok(r.reasons.some((x) => x.kind === 'review_due'), '복습할 때 된 낱말이 없음');
  });
  // ---- 스탯 카드 ----
  const stats = await server.ssrLoadModule('/src/lib/homework/stats.ts');
  const baseCard = (over) => ({
    student: { id: 's', name: '민준', archived: false },
    days: 30,
    graded: 60,
    completed_activities: 6,
    skills: [],
    habit: { assigned: 4, finished: 4, prev_assigned: 0, prev_finished: 0 },
    retries: { count: 0, corrected: 0 },
    shadowing: { lines: 0, listens: 0 },
    wrong_words: [],
    recent: [],
    passbook_homework: { done: 0, missing: 0 },
    ...over,
  });
  await test('스탯: 등급 경계(S+ 95 · S 90 · A 80 · B 70 · C)', () => {
    assert.deepEqual([0.96, 0.9, 0.85, 0.7, 0.69].map(stats.gradeOf), ['S+', 'S', 'A', 'B', 'C']);
  });
  await test('스탯: 문제 8개 미만 세부 능력은 ?, 기록이 모자라면 모두 ?', () => {
    const sk = (skill, n, correct, weighted) => ({ skill, n, correct, weighted, prev_n: 0, prev_correct: 0 });
    const full = stats.buildStatSheet(baseCard({ skills: [sk('vocab.meaning', 20, 19, 0.95), sk('vocab.spelling', 5, 5, 1)] }));
    const vocab = full.abilities.find((a) => a.key === 'vocab');
    assert.equal(vocab.subs.find((s) => s.key === 'vocab.meaning').grade, 'S+');
    assert.equal(vocab.subs.find((s) => s.key === 'vocab.spelling').grade, null);
    assert.equal(vocab.grade, 'S+');
    assert.equal(full.abilities.find((a) => a.key === 'reading').grade, null);
    const thin = stats.buildStatSheet(baseCard({ graded: 20, skills: [sk('vocab.meaning', 20, 19, 0.95)] }));
    assert.equal(thin.enough, false);
    assert.ok(thin.abilities.every((a) => a.grade === null) && thin.overall.grade === null);
  });
  await test('스탯: 지난 기간 비교(%p)와 잘하는·연습할 것', () => {
    const s = stats.buildStatSheet(
      baseCard({
        skills: [
          { skill: 'vocab.meaning', n: 20, correct: 18, weighted: 0.9, prev_n: 10, prev_correct: 6 },
          { skill: 'listening.word', n: 10, correct: 5, weighted: 0.5, prev_n: 0, prev_correct: 0 },
        ],
      }),
    );
    assert.equal(s.abilities[0].subs[0].delta, 30);
    const sf = stats.strengthsAndFocus(s);
    assert.deepEqual(sf.strengths.map((x) => x.key).slice(0, 1), ['vocab.meaning']);
    assert.deepEqual(sf.focus.map((x) => x.key), ['listening.word']);
  });
} finally {
  await server.close();
}

console.log(failed ? `\n${failed}개 실패` : '\n모두 통과');
process.exit(failed ? 1 : 0);
