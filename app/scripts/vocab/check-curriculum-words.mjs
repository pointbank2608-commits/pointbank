// 교과과정 단어(lib/curriculumWords.ts) 확인 — 가짜 사전으로 학교급·학년군·주제 묶음이 규칙대로 만들어지는지 본다.
// 실행: node app/scripts/vocab/check-curriculum-words.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stub = {
  name: 'stub-supabase',
  enforce: 'pre',
  load(id) {
    if (id.split(String.fromCharCode(92)).join('/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};';
  },
};
const server = await createServer({ root, logLevel: 'error', plugins: [stub], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
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

let n = 0;
const E = (word, o = {}) => ({ id: `w${n++}`, word, sense_number: 1, part_of_speech: '명사', meaning: `${word} 뜻`, example_sentence: null, category: '동물', image_url: null, sort_order: n, level: 1, ...o });

try {
  const cw = await server.ssrLoadModule('/src/lib/curriculumWords.ts');
  const bank = [
    // 초등 Lv.1 동물 23개, 음식 12개, 몸 3개(작아서 기타 주제로)
    ...Array.from({ length: 23 }, (_, i) => E(`animal${i}`)),
    ...Array.from({ length: 12 }, (_, i) => E(`food${i}`, { category: '음식' })),
    ...Array.from({ length: 3 }, (_, i) => E(`body${i}`, { category: '몸' })),
    ...Array.from({ length: 2 }, (_, i) => E(`tiny${i}`, { category: '모양' })),
    // 교육부 800 DAY 1: 번호 순서
    ...Array.from({ length: 22 }, (_, i) => E(`moe${i}`, { category: '사물', moe800_day: 1, moe800_no: 22 - i, level: 2 })),
    // 중등·고등
    ...Array.from({ length: 11 }, (_, i) => E(`mid${i}`, { category: '생각/소통', level: 5 })),
    ...Array.from({ length: 6 }, (_, i) => E(`high${i}`, { category: '학문/지식', level: 6 })),
    // 걸러져야 하는 것: 숙어, 뜻 없음, 같은 낱말의 둘째 뜻
    E('give up', { part_of_speech: '숙어' }),
    E('nomean', { meaning: '' }),
    E('dup', { category: '동물', sense_number: 2 }),
    E('dup', { category: '동물', sense_number: 1 }),
  ];
  const schools = cw.buildCurriculumWords(bank);
  const by = Object.fromEntries(schools.map((s) => [s.id, s]));

  await test('학교급 셋이 레벨대로 나뉜다', () => {
    assert.deepEqual(schools.map((s) => s.id), ['elementary', 'middle', 'high']);
    assert.equal(by.middle.count, 11);
    assert.equal(by.high.count, 6);
    assert.ok(by.elementary.count > 40);
  });

  await test('숙어·뜻 없음은 빠지고 같은 낱말은 첫 뜻 하나만', () => {
    const all = schools.flatMap((s) => s.bands.flatMap((b) => b.units.flatMap((u) => u.sets.flatMap((x) => x.entries))));
    assert.ok(!all.some((e) => e.word === 'give up' || e.word === 'nomean'));
    const dups = all.filter((e) => e.word === 'dup');
    assert.equal(dups.length, 1, '같은 밴드 안에서 한 번만');
  });

  await test('교육부 800 DAY 는 번호 순서로 10개씩, 마지막이 모자라면 합친다', () => {
    const band = by.elementary.bands.find((b) => b.id === 'moe800');
    assert.ok(band);
    const day1 = band.units.find((u) => u.id === 'day-1');
    assert.equal(day1.count, 22);
    assert.deepEqual(day1.sets.map((s) => s.entries.length), [10, 12]);
    const nums = day1.sets.flatMap((s) => s.entries.map((e) => e.moe800_no));
    assert.deepEqual(nums, [...nums].sort((a, b) => a - b));
  });

  await test('주제별 묶음: 10개씩, 5개 미만 주제는 기타 주제로', () => {
    const lv1 = by.elementary.bands.find((b) => b.id === 'lv1');
    const animal = lv1.units.find((u) => u.label === '동물');
    assert.equal(animal.count, 24); // 23 + dup 1
    assert.deepEqual(animal.sets.map((s) => s.entries.length), [10, 14]);
    const etc = lv1.units.find((u) => u.label === '기타 주제');
    assert.ok(etc && etc.count === 5, `기타 ${etc?.count}`); // 몸 3 + 모양 2
    for (const u of lv1.units) for (const s of u.sets) assert.ok(s.entries.length >= 5, `${s.title} ${s.entries.length}`);
  });

  await test('세트 → 수업 낱말 카드', () => {
    const set = by.middle.bands[0].units[0].sets[0];
    const cards = cw.setToCards(set.entries);
    assert.equal(cards.length, set.entries.length);
    assert.ok(cards.every((c) => c.word && c.meaning && c.id));
  });
} finally {
  await server.close();
}
if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log('\n모두 통과');
