// 개별수업 블록 보드(lib/soloBoard.ts) 확인 — 표준 50분 수업을 그룹·블록으로 읽고, 그룹 이동·번호 매김이 맞는지 본다.
// 실행: node app/scripts/solo/check-board.mjs
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
const W = (w) => ({ id: w, word: w, meaning: `${w}뜻`, imageUrl: null, example: `I like the ${w} very much.`, partOfSpeech: '명사' });

try {
  const board = await server.ssrLoadModule('/src/lib/soloBoard.ts');
  const std = await server.ssrLoadModule('/src/lib/soloStandard.ts');
  const words = 'apple banana milk bread cheese egg bag money dog cat'.split(' ').map(W);
  const lesson = std.buildStandardWordLesson('과일', words);

  await test('표준 50분 수업이 그룹·블록으로 읽힌다', () => {
    const b = board.buildBoard(lesson.steps);
    assert.equal(b.head, 0);
    assert.equal(b.groups.length, 6);
    assert.ok(b.groups.every((g) => g.intro !== null && g.no !== null && g.title && g.minutes));
    assert.deepEqual(b.groups.map((g) => g.no), [1, 2, 3, 4, 5, 6]);
    const first = b.groups[0];
    assert.equal(first.title, '오늘의 낱말 만나기');
    assert.equal(first.minutes, 8);
    assert.ok(first.blocks.length >= 2 && first.blocks[0].type === 'meet' && first.blocks[0].count === 10);
    assert.ok(first.blocks[0].words.length > 0);
    // 문제 수 = 소개 + 그룹 안 모든 문제
    const sum = b.groups.reduce((n, g) => n + g.end - g.start + 1, 0) + 1;
    assert.equal(sum, lesson.steps.length);
  });

  await test('그룹 위치 이동은 번호를 다시 매기고 문제를 잃지 않는다', () => {
    const moved = board.moveGroup(lesson.steps, 1, -1);
    assert.equal(moved.length, lesson.steps.length);
    const b = board.buildBoard(moved);
    assert.deepEqual(b.groups.map((g) => g.no), [1, 2, 3, 4, 5, 6]);
    assert.equal(b.groups[0].title, '소리 듣고 찾기');
    assert.equal(b.groups[1].title, '오늘의 낱말 만나기');
  });

  await test('그룹 이름·시간 고치기와 지우기', () => {
    const named = board.updateGroup(lesson.steps, board.buildBoard(lesson.steps).groups[2].intro, { title: '뜻 확인', minutes: 7 });
    const g = board.buildBoard(named).groups[2];
    assert.equal(g.title, '뜻 확인');
    assert.equal(g.minutes, 7);
    assert.equal(g.no, 3);
    const removed = board.removeGroup(named, 0);
    const b = board.buildBoard(removed);
    assert.equal(b.groups.length, 5);
    assert.deepEqual(b.groups.map((x) => x.no), [1, 2, 3, 4, 5]);
  });

  await test('그룹 추가·예상 시간', () => {
    const added = board.addGroup(lesson.steps, '새 그룹', 4, '직접 정해요');
    const b = board.buildBoard(added);
    assert.equal(b.groups.length, 7);
    assert.equal(b.groups[6].title, '새 그룹');
    assert.equal(b.groups[6].blocks.length, 0);
    const mins = board.formatMinutes(b.totalSeconds);
    assert.ok(mins >= 25 && mins <= 70, `예상 ${mins}분`);
  });

  await test('그룹이 없는 옛 수업은 이름 없는 묶음 하나로 읽힌다', () => {
    const old = lesson.steps.filter((s, i) => i === 0 || s.t !== 'intro');
    const b = board.buildBoard(old);
    assert.equal(b.groups.length, 1);
    assert.equal(b.groups[0].intro, null);
    assert.ok(b.groups[0].blocks.length >= 5);
  });

  await test('손으로 고친 문제 수를 센다', () => {
    const copy = lesson.steps.map((s) => ({ ...s }));
    copy[3].edited = true;
    copy[4].edited = true;
    const b = board.buildBoard(copy);
    assert.equal(b.groups[0].blocks[0].edited, 2);
  });
  await test('단어장 출처가 문제에 남고 블록이 다시 읽는다', () => {
    const stamped = board.withSource(lesson.steps, { id: 'L1', name: '과일 단어' });
    assert.ok(stamped.filter((s) => s.t !== 'intro').every((s) => s.src?.name === '과일 단어'));
    assert.ok(stamped.filter((s) => s.t === 'intro').every((s) => !s.src));
    const b = board.buildBoard(stamped);
    assert.equal(b.lessonSource.name, '과일 단어');
    assert.ok(b.groups[0].blocks.every((x) => x.type === 'intro' || x.source?.name === '과일 단어'));
    // 한 블록만 다른 단어장으로 바꾸면 그 블록만 다른 출처, 수업 기본은 그대로
    const first = b.groups[0].blocks[0];
    const swapped = stamped.map((s, i) => (i >= first.start && i <= first.end ? { ...s, src: { id: 'L2', name: '동물 단어' } } : s));
    const b2 = board.buildBoard(swapped);
    assert.equal(b2.groups[0].blocks[0].source.name, '동물 단어');
    assert.equal(b2.lessonSource.name, '과일 단어');
    assert.equal(board.sameStepSource(b2.groups[0].blocks[1].source, b2.lessonSource), true);
    // 한 블록 안에서 출처가 섞이면 mixed
    const mixed = swapped.map((s, i) => (i === first.start ? { ...s, src: { id: 'L3', name: '다른 것' } } : s));
    assert.equal(board.buildBoard(mixed).groups[0].blocks[0].source, 'mixed');
    // 출처가 없는 옛 수업은 null
    assert.equal(board.buildBoard(lesson.steps).lessonSource, null);
  });
} finally {
  await server.close();
}
if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log('\n모두 통과');
