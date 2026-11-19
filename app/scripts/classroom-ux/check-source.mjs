import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  cacheDir: '../tmp/classroom-ux-vite',
  server: { middlewareMode: true },
  logLevel: 'error',
});
try {
  const { transcriptClozeSource, parseReadingText, clozeSegments } = await server.ssrLoadModule('/src/lib/readingLines.ts');
  const source = '[0:01.25-0:03.75] I **like** it. | 나는 그게 좋아요.\n[0:05.5-0:07.8] We can play. | 우리는 놀 수 있어요.';
  const lines = parseReadingText(transcriptClozeSource(source));
  assert.equal(lines.length, 2, 'A prepared transcript stays as separate sentence cues');
  assert.deepEqual(lines.map(({ start, end }) => [start, end]), [[1.25, 3.75], [5.5, 7.8]], 'Do not round off or drop clip cue ranges');
  assert.deepEqual(lines.map(({ en }) => en.replaceAll('**', '')), ['I like it.', 'We can play.']);
  assert.equal(lines[0].ko, '나는 그게 좋아요.');
  assert.deepEqual(clozeSegments(lines[0].en).filter(part => part.blank).map(part => part.text), ['like'], 'Keep existing prepared blanks');
  assert(clozeSegments(lines[1].en).some(part => part.blank), 'Unmarked prepared dialogue needs a usable listening blank');

  const { courseUnits, availableLessonSlides, courseWord } = await server.ssrLoadModule('/src/data/phonicsLessons.ts');
  const units = courseUnits();
  assert.equal(units.length, 42);
  for (const unit of units) {
    const slides = availableLessonSlides(unit);
    for (const section of [1, 2]) assert(slides.some(slide => slide.lesson === section), `${unit.id} lesson ${section}`);
    for (const slide of slides) {
      for (const id of [...slide.entryIds, ...slide.answerIds]) assert(courseWord(unit, id), `${slide.id}: unresolved word ${id}`);
    }
  }
  const { SIGHT_WORD_REVIEWS } = await server.ssrLoadModule('/src/data/sightWords.ts');
  assert.equal(SIGHT_WORD_REVIEWS.length, 37);
  assert(SIGHT_WORD_REVIEWS.every(review => review.words.length === 3));
  console.log('PASS: prepared video cues/blanks, 42 units and slide references, 37 review sets');
} finally {
  await server.close();
}
