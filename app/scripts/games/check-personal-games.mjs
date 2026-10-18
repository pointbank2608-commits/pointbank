import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({
  root,
  logLevel: 'error',
  plugins: [
    {
      name: 'no-network',
      enforce: 'pre',
      load(id) {
        if (id.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts'))
          return 'export const supabase={};';
      },
    },
  ],
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});
try {
  const { recommendGamePractice: recommend, gamePracticeToSolo: convert } =
    await server.ssrLoadModule('/src/lib/homework/personalGames.ts');
  const { gradeSoloLocal, toPublicStep } = await server.ssrLoadModule(
    '/src/lib/soloLessons.ts',
  );
  const { gradeLocal } = await server.ssrLoadModule(
    '/src/lib/homework/grade.ts',
  );
  const pool = [
    ['apple', '사과'],
    ['banana', '바나나'],
    ['cat', '고양이'],
    ['dog', '강아지'],
  ].map(([word, meaning]) => ({ id: word, word, meaning, imageUrl: null }));
  const labels = {
    quiz: 'Quiz',
    worksheet: 'Worksheet',
    matchup: 'Match',
    anagram: 'Anagram',
    spelling: 'Spelling',
    shadowing: 'Shadow',
  };
  const now = Date.now();
  const candidate = (skill) => ({
    graded: 40,
    completed_activities: 4,
    words: [
      ...pool,
      { id: 'outside', word: 'outside', meaning: '밖', imageUrl: null },
    ].map((c) => ({
      word: c.word,
      card: c,
      last_seen: new Date(now).toISOString(),
      skills: {
        [skill]: {
          wrong: 3,
          right: 0,
          last_wrong: new Date(now).toISOString(),
          last_right: null,
        },
      },
    })),
  });
  for (const skill of [
    'vocab.spelling',
    'listening.word',
    'listening.dictation',
    'vocab.meaning',
    'vocab.picture',
    'vocab.context',
  ]) {
    const input = candidate(skill);
    const frozen = JSON.stringify([input, pool]);
    const rec = recommend(input, pool, [], labels, now, () => 0.35, true);
    assert(rec.items.length > 0);
    assert(rec.items.every((i) => i.kind === 'game'));
    const qs = rec.items.flatMap((i) => i.content.questions);
    assert(qs.every((q) => pool.some((c) => c.word === q.word)));
    assert(qs.every((q) => q.skill !== 'vocab.spelling' || q.speak === null));
    const steps = convert(rec.items, 'Practice');
    assert.equal(steps.length, qs.length + 1);
    qs.forEach((q, i) => {
      const value =
        q.qtype === 'order' ? JSON.stringify(q.correct) : String(q.correct);
      assert(gradeLocal(q, value));
      const step = steps[i + 1];
      const soloValue =
        step.t === 'unscramble'
          ? step.sentence
          : step.t === 'spell'
            ? step.word
            : value;
      assert.equal(
        gradeSoloLocal(step, soloValue),
        true,
        `${skill} / ${step.t}`,
      );
      const pub = toPublicStep(step);
      assert(!('answer' in pub));
      if (['spell', 'typeWord'].includes(step.t)) assert(!('word' in pub));
    });
    assert.equal(JSON.stringify([input, pool]), frozen);
    console.log('ok scoped personal games + solo grading:', skill);
  }
  const fallback = recommend(
    { graded: 1, completed_activities: 0, words: [] },
    pool,
    [],
    labels,
    now,
    () => 0.3,
    true,
  );
  assert.equal(fallback.personal, false);
  assert(fallback.items.length);
  const empty = recommend(
    candidate('vocab.spelling'),
    [],
    [],
    labels,
    now,
    () => 0.3,
    true,
  );
  assert.equal(empty.items.length, 0);
  console.log(
    'ok low evidence uses common practice; empty source produces no fake game',
  );
} finally {
  await server.close();
}
