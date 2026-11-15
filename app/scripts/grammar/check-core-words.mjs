import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../..', import.meta.url));
const server = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  plugins: [{
    name: 'mock-supabase', enforce: 'pre',
    load(id) {
      if (id.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};';
    },
  }],
});

try {
  const core = await server.ssrLoadModule('/src/lib/grammarCoreWords.ts');
  const { GRAMMAR_POINTS } = await server.ssrLoadModule('/src/lib/grammar.ts');
  const { buildGrammarLessonSlides } = await server.ssrLoadModule('/src/lib/grammarLesson.ts');
  const { validateItems } = await server.ssrLoadModule('/src/lib/homework/blocks.ts');
  const t = (key, args) => args?.word ?? key;
  const games = { unscrambleId: null, teamQuizId: null };
  const uses = Object.keys(core.GRAMMAR_WORD_USE);
  let topics = 0;
  let candidates = 0;
  const uniqueEntries = new Set();

  for (const { id, name } of GRAMMAR_POINTS) {
    const entries = core.grammarWordCandidates(id);
    if (!entries.length) continue;
    topics++;
    candidates += entries.length;
    entries.forEach(entry => uniqueEntries.add(entry.id));
    assert.equal(new Set(entries.map(word => word.id)).size, entries.length, id);
    for (const entry of entries) {
      const selection = core.selectGrammarWords(id, name, [entry.id]);
      const questions = uses.map(use => core.grammarWordQuestions(selection, use));
      const prompts = questions.flatMap(list => list.map(question => question.q));
      assert.ok(questions.every(list => list.length), id + '/' + entry.id);
      assert.equal(new Set(prompts).size, prompts.length, id + '/' + entry.id);
      assert.ok(questions.flat().every(q => q.q.split('___').length === 2 && q.a && !q.example.includes('___')));
    }

    const chosenIds = entries.slice(0, 3).map(entry => entry.id);
    const selection = core.selectGrammarWords(id, name, [...chosenIds, 'unknown-entry']);
    const slides = buildGrammarLessonSlides({ t, grammarId: id, hasWords: false, games, grammarWords: selection });
    const lesson = { id: 'saved', updated_at: '2026-11-09T00:00:00Z', playlist: JSON.parse(JSON.stringify(slides)), video_url: null };
    const stored = core.lessonGrammarWordSelection(lesson);
    assert.deepEqual(stored.selection.entries.map(entry => entry.id), chosenIds);
    const practice = slides.filter(slide => slide.kind === 'qna' && slide.grammarWordSource);
    const wordIds = core.grammarWordQuestions(selection, 'recall').map(question => question.contentId);
    assert.deepEqual(practice.flatMap(slide => slide.questions.map(question => question.grammarWord.contentId)), wordIds);
    assert.ok(practice.every(slide => slide.grammarWordSource.recommendationId === selection.recommendationId));
    assert.ok(slides.some(slide => slide.kind === 'canvas' && slide.elements[0]?.text === 'grammarLesson.coreDiscover'));
    assert.equal(slides.filter(slide => slide.kind === 'material' && slide.grammarWords).length, 1);
    const review = core.grammarWordReview(stored.selection, 'Review', lesson.id);
    assert.equal(review.questions.length, Math.min(2, core.grammarWordQuestions(selection, 'review').length));
    assert.equal(review.helpers[0].seconds, 60);
    assert.equal(review.grammarWordSource.recommendationId, selection.recommendationId);
    assert.equal(review.grammarWordSource.lessonId, lesson.id);
    const homework = core.grammarWordHomework(lesson, 'Review');
    assert.deepEqual(validateItems(homework), []);
    assert.ok(homework.every(item => item.config.grammarWordSource.slideId === stored.slide.id));
    assert.deepEqual(homework.flatMap(item => item.content.questions.map(question => question.contentId)), wordIds);
    assert.ok(homework.flatMap(item => item.content.questions).every(q => q.id.startsWith(selection.recommendationId) && q.qtype === 'text' && q.card.meaning));
  }

  assert.equal(core.selectGrammarWords('m-comparison', 'Compare', []), undefined);
  assert.equal(core.lessonGrammarWordSelection({ playlist: [], video_url: null }), null);
  assert.deepEqual(core.grammarWordHomework({ playlist: [], video_url: null }, 'Review'), []);
  const answers = (topic, word) => core.grammarWordCandidates(topic).find(entry => entry.id === word).targets.map(target => target.answer);
  assert.deepEqual(answers('m-comparison', 'good'), ['better', 'best']);
  assert.deepEqual(answers('past-irregular', 'go'), ['went']);
  assert.deepEqual(answers('m-present-perfect', 'go'), ['gone']);
  assert.deepEqual(answers('present-progressive', 'plan'), ['planning']);
  assert.deepEqual(answers('plural', 'child'), ['children']);
  assert.deepEqual(answers('m-noun-count', 'advice'), ['pieces of advice']);
  assert.deepEqual(answers('m-passive', 'write'), ['written']);
  assert.deepEqual(answers('m-pronoun-case', 'she'), ['her', 'her', 'hers']);
  assert.deepEqual(answers('past-be', 'were'), ['were']);
  assert.deepEqual(core.grammarWordCandidates('constructor'), []);
  assert.ok(topics >= 35 && candidates >= 500);
  console.log(`Passed: ${topics} topics, ${candidates} topic/word candidates, ${uniqueEntries.size} distinct word or phrase IDs`);
} finally {
  await server.close();
}
