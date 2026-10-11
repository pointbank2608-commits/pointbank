// 개별수업 "표준 50분 흐름"(lib/soloStandard.ts) 확인 — 낱말·문법·주제·영상 네 가지가 단계 나눔과 활동을 갖춰 만들어지는지 본다.
// 실행: node app/scripts/solo/check-standard.mjs   (저장소 루트 또는 app/ 어디서든)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// 가짜 사전: 장면·문법·상황에서 쓰는 낱말을 넉넉히
const WORDS = ('apple banana milk bread cheese egg bag money dog cat bird fish rabbit teacher student school book pencil friend lunch sandwich yogurt carrot snack cupboard breakfast shirt hat shoes doctor medicine fever hot water juice hand eye nose mouth name music soccer country basketball piano guitar').split(' ');
const bank = WORDS.map((w, i) => ({
  id: `w${i}`,
  word: w,
  meaning: `${w}의 뜻`,
  image_url: i % 3 === 0 ? null : `/img/${w}.webp`,
  category: i % 2 ? 'food' : 'animal',
  part_of_speech: i % 5 === 0 ? '동사' : '명사',
  example_sentence: `I like the ${w} very much.`,
  level: 1,
  sense_number: 1,
}));

const count = (steps) => {
  const m = {};
  for (const s of steps) m[s.t] = (m[s.t] ?? 0) + 1;
  return m;
};
const stages = (steps) => steps.filter((s, i) => s.t === 'intro' && i > 0).map((s) => `${s.title} (${s.text.split(' · ')[0]})`);
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
  const std = await server.ssrLoadModule('/src/lib/soloStandard.ts');
  const solo = await server.ssrLoadModule('/src/lib/soloLessons.ts');
  const scen = await server.ssrLoadModule('/src/lib/soloScenarios.ts');
  const gram = await server.ssrLoadModule('/src/lib/grammar.ts');

  const report = (label, lesson) => {
    console.log(`\n[${label}] ${lesson.name} — ${lesson.steps.length}단계`);
    console.log('  단계 나눔:', stages(lesson.steps).join(' | '));
    console.log('  종류:', JSON.stringify(count(lesson.steps)));
  };

  await test('단어형: 10개로 단계 나눔·활동이 갖춰진다', () => {
    const words = bank.slice(0, 10).map((e) => ({ id: e.id, word: e.word, meaning: e.meaning, imageUrl: e.image_url, example: e.example_sentence, partOfSpeech: e.part_of_speech }));
    const l = std.buildStandardWordLesson('과일', words);
    assert.ok(l, '만들어져야 함');
    report('단어', l);
    assert.ok(l.steps.length >= 60 && l.steps.length <= 130, `단계 수 ${l.steps.length}`);
    assert.ok(stages(l.steps).length >= 5);
    for (const t of ['meet', 'pickWord', 'listenPick', 'spell', 'typeWord']) assert.ok(count(l.steps)[t] > 0, t);
    assert.equal(l.steps[0].t, 'intro');
  });
  await test('단어형: 낱말 5개 미만이면 null', () => {
    const words = bank.slice(0, 5).map((e) => ({ id: e.id, word: e.word, meaning: e.meaning, imageUrl: null }));
    assert.equal(std.buildStandardWordLesson('x', words), null);
  });

  await test('문법형: 항목 하나로 만들어지고 마지막까지 이어진다', () => {
    const p = solo.SOLO_GRAMMAR_POINTS.find((g) => g.stage === 'elementary' && g.examples.length >= 3);
    const l = std.buildStandardGrammarLesson(p, bank);
    report('문법', l);
    assert.ok(l.steps.length >= 25, `단계 수 ${l.steps.length}`);
    assert.ok(count(l.steps).rule === 1);
    assert.ok(stages(l.steps).length >= 4);
    // 모든 문법 항목에서 예외 없이 만들어지는지
    let min = 999;
    for (const g of solo.SOLO_GRAMMAR_POINTS) {
      const x = std.buildStandardGrammarLesson(g, bank);
      min = Math.min(min, x.steps.length);
      assert.ok(x.steps.length >= 8, `${g.id} ${x.steps.length}`);
    }
    console.log('  전체 문법', solo.SOLO_GRAMMAR_POINTS.length, '개 중 가장 짧은 수업', min, '단계');
  });

  await test('주제형: 여섯 상황 모두 만들어진다', () => {
    for (const sc of scen.SOLO_SCENARIOS) {
      // 상황 낱말이 사전에 있어야 하므로 가짜 사전에 상황 낱말을 더한다
      const extra = sc.words.map((w, i) => ({ id: `s-${sc.id}-${i}`, word: w, meaning: `${w} 뜻`, image_url: `/img/${w}.webp`, category: 'x', part_of_speech: '명사', example_sentence: `This is a ${w}.`, level: 1, sense_number: 1 }));
      const l = std.buildStandardTopicLesson(sc, [...bank, ...extra], 'ko');
      assert.ok(l, sc.id);
      assert.ok(l.steps.some((s) => s.t === 'roleplay'));
      if (sc.id === 'talk-market') report('주제', l);
    }
  });

  await test('영상형: 대사가 있으면 단계 나눔과 한 줄 듣기가 들어간다', () => {
    const script = [
      '[0:06.2-0:08.0] Narrator: The perfect packed lunch | 완벽한 도시락',
      '[0:08.0-0:11.2] Narrator: is about the love that goes into making it. | 그것은 사랑을 담는 것입니다.',
      '[0:25.7-0:28.0] Peppa: Yay, sandwiches! | 야호, 샌드위치!',
      '[0:28.8-0:30.0] Suzy: My favorite sandwich! | 내가 제일 좋아하는 거야!',
      '[0:34.6-0:39.2] Narrator: Today, Peppa and her friends are eating lunch at playgroup. | 오늘 페파와 친구들은 놀이방에서 점심을 먹습니다.',
      '[0:41.2-0:43.5] Pedro: My yogurt exploded. | 내 요구르트가 터졌어.',
      '[0:45.0-0:48.4] Pedro: Mm, but yogurt carrots are delicious. | 음, 하지만 요구르트 당근은 맛있어.',
      '[0:50.7-0:53.2] Peppa: What are you having for lunch, Madame Gazelle? | 점심으로 뭘 드세요?',
    ].join('\n');
    const clip = { id: 'c1', series: 'Peppa Pig', title: 'Pack Her Lunchbox', summary: '점심 도시락', youtube_id: 'hyacEIXP3oc', start_sec: 5.7, end_sec: 186.5, script, pack: { grammar: { sentence: 'My yogurt exploded.', sentenceKo: '내 요구르트가 터졌어.', point: '과거를 나타내는 말', drills: [{ cue: '(my juice)', answer: 'My juice exploded.', answerKo: '내 주스가 터졌어.' }] } } };
    const l = std.buildStandardVideoLesson(clip, bank);
    assert.ok(l, '만들어져야 함');
    report('영상', l);
    assert.ok(count(l.steps).lineSing > 0 && count(l.steps).watch === 1);
    assert.ok(l.steps.filter((s) => s.t === 'lineSing').every((s) => s.clip.videoId === 'hyacEIXP3oc' && s.clip.end > s.clip.start));
    assert.equal(std.buildStandardVideoLesson({ ...clip, script: '[0:01] Hi.' }, bank), null);
  });
} finally {
  await server.close();
}
if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log('\n모두 통과');
