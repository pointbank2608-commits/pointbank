// 암기 방식 블록(memory.ts)·자동 암기 칸(slots.ts) 순수 로직 확인 — check-logic 과 같은 방식(Vite 로 TS 불러오기)
// 실행: node app/scripts/homework/check-memory.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stub = { name: 'stub-supabase', enforce: 'pre', load(id) { if (id.replaceAll(String.fromCharCode(92), '/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};'; } };
const server = await createServer({ root, logLevel: 'error', plugins: [stub], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { failed += 1; console.log('FAIL', name, '\n     ', e.message); } };

const mem = await server.ssrLoadModule('/src/lib/homework/memory.ts');
const build = await server.ssrLoadModule('/src/lib/homework/build.ts');
const slots = await server.ssrLoadModule('/src/lib/homework/slots.ts');
const blocks = await server.ssrLoadModule('/src/lib/homework/blocks.ts');
const comp = await server.ssrLoadModule('/src/components/homework/QuestionCard.tsx');

const W = ['apple', 'apply', 'ample', 'maple', 'banana', 'cat', 'cap', 'cut', 'dog', 'dig', 'bag', 'big'];
const cards = W.map((w, i) => ({ id: String(i), word: w, meaning: `뜻${i}`, imageUrl: i % 2 ? '/x.webp' : null, example: `I like the ${w} very much.` }));
const rng = () => 0.4;

await test('방식 12가지가 모두 문제를 만든다', () => {
  for (const m of mem.MEMORY_METHOD_LIST) {
    if (mem.MEMORY_METHODS[m].sentence) continue; // 문장 목록용은 아래 별도 검사
    const it = mem.memoryItemFromCards(cards, m, 6, false, rng);
    assert.ok(it, m);
    assert.equal(it.config.block.type, m === 'flip' ? 'study' : 'recall');
    assert.equal(it.config.block.method, m);
    if (m === 'flip') assert.equal(it.content.questions.length, 0, 'flip 은 문제 없이 카드 한 벌');
    else assert.ok(it.content.questions.length >= 1 && it.content.questions.length <= 6, m);
  }
});
await test('문항 수 상한(100)과 모자란 낱말', () => {
  const big = Array.from({ length: 300 }, (_, i) => ({ id: String(i), word: 'wordx' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + ((i / 26) | 0)), meaning: '뜻' + i, imageUrl: null, example: null }));
  assert.equal(mem.memoryItemFromCards(big, 'spell', 500, false, rng).content.questions.length, 100);
  assert.equal(mem.memoryItemFromCards(cards.slice(0, 3), 'spell', 50, false, rng).content.questions.length, 3);
});
await test('섬광·점점 가리기: 정답은 낱말, 서버가 아는 모양(text)', () => {
  const f = build.flashQ(cards[0]);
  assert.equal(f.qtype, 'text'); assert.equal(f.correct, 'apple'); assert.equal(f.style, 'flash'); assert.ok(f.flashMs > 0);
  const d = build.fadeQ(cards[0]);
  assert.equal(d.qtype, 'text'); assert.equal(d.correct, 'apple'); assert.equal(d.style, 'fade');
});
await test('헷갈리는 짝: 철자가 가까운 낱말이 보기에 들어간다', () => {
  const q = build.confuseQ(cards[0], cards, rng);
  assert.equal(q.style, 'confuse');
  assert.equal(q.choices[q.correct], 'apple');
  const wrong = q.choices.filter((_, i) => i !== q.correct);
  assert.ok(wrong.includes('apply') && wrong.includes('ample'), wrong.join());
  assert.equal(new Set(q.choices).size, q.choices.length);
});
await test('낱말이 적으면 헷갈리는 짝은 만들지 않는다', () => {
  assert.equal(build.confuseQ(cards[0], cards.slice(0, 2), rng), null);
});
await test('점점 가리기 가림: 같은 낱말은 늘 같게, 갈수록 많이 가려진다', () => {
  const a = comp.fadeMask('apple', 1, 3), b = comp.fadeMask('apple', 2, 3);
  assert.equal(comp.fadeMask('apple', 0, 3), 'apple');
  assert.equal(comp.fadeMask('apple', 3, 3), '_____');
  assert.equal(a, comp.fadeMask('apple', 1, 3));
  assert.ok([...b].filter((c) => c === '_').length > [...a].filter((c) => c === '_').length);
});
await test('졸업 시험: 낱말마다 한 문제, 여러 방식이 섞인다', () => {
  const qs = mem.graduationQs(cards, cards, rng);
  assert.equal(qs.length, cards.length);
  assert.ok(new Set(qs.map((q) => q.style)).size >= 3);
});
await test('만든 블록은 편집기 검사를 통과한다', () => {
  for (const m of mem.MEMORY_METHOD_LIST) {
    if (mem.MEMORY_METHODS[m].sentence) continue;
    const it = mem.memoryItemFromCards(cards, m, 6, false, rng);
    const errs = blocks.validateItems([it]);
    assert.deepEqual(errs, [], m + ': ' + errs.join());
  }
});
await test('자동 암기 칸: 추천 문제를 쉬운 것부터 이어 붙이고 방식을 더한다', () => {
  const rec = { items: [
    { kind: 'quiz', title: 'q', config: {}, content: { questions: [build.meaningQ(cards[0], cards, rng), build.spellQ(cards[1])] } },
    { kind: 'game', title: 'g', config: { game: 'anagram' }, content: { questions: [build.lettersQ(cards[2], rng)] } },
  ] };
  const items = [slots.newSlot('memory')];
  const r = slots.expandSlots(items, rec, cards);
  assert.equal(r.empty, 0);
  const qs = r.items[0].content.questions;
  assert.ok(qs.length > 3, String(qs.length));
  const rank = (q) => (q.qtype === 'choice' ? 0 : q.style === 'letters' ? 1 : 2);
  for (let i = 1; i < qs.length; i++) assert.ok(rank(qs[i - 1]) <= rank(qs[i]));
  assert.ok(!r.items[0].config.slot);
  assert.deepEqual(blocks.validateItems(r.items), []);
});
await test('자동 암기 칸: 추천이 비면 칸이 빠진다', () => {
  const r = slots.expandSlots([slots.newSlot('memory')], { items: [] }, cards);
  assert.equal(r.empty, 1); assert.equal(r.items.length, 0);
});

await test('게임 모양 4종(두더지·낚시·풍선·행맨)은 서버가 채점하는 문제로 만들어지고 편집기 검사를 통과한다', () => {
  for (const g of ['whack', 'fish', 'balloon', 'hangman']) {
    const it = blocks.gameItemFromCards(cards, g, g, rng);
    assert.ok(it, g);
    assert.equal(it.kind, 'game');
    assert.equal(it.config.game, g);
    assert.ok(it.content.questions.length >= 2, g);
    assert.ok(it.content.questions.every((q) => q.style === g), g);
    assert.deepEqual(blocks.validateItems([it]), [], g);
  }
  const w = blocks.gameItemFromCards(cards, 'whack', 'w', rng).content.questions[0];
  assert.equal(w.qtype, 'choice');
  assert.equal(w.choices[w.correct], w.word);
  assert.ok(w.speak);
  const h = blocks.gameItemFromCards(cards, 'hangman', 'h', rng).content.questions[0];
  assert.equal(h.qtype, 'text');
  assert.equal(h.correct, h.speak);
});
await test('게임 모양: 낱말이 모자라면 만들지 않는다', () => {
  assert.equal(blocks.gameItemFromCards([cards[0]], 'whack', 'x'), null);
  assert.equal(blocks.gameItemFromCards([{ id: 'k', word: '사과', meaning: 'apple' }], 'hangman', 'x'), null);
});

await test('타이핑 4종: 정답은 낱말, 힌트는 첫·끝 글자만, 그림 쓰기는 그림이 있는 낱말만', () => {
  const dict = build.dictationQ(cards[0]);
  assert.equal(dict.qtype, 'text'); assert.equal(dict.style, 'dictation'); assert.equal(dict.correct, 'apple'); assert.equal(dict.prompt, '');
  const hint = build.hintQ(cards[0]);
  assert.equal(hint.sub, 'a _ _ _ e'); assert.equal(hint.correct, 'apple');
  const cp = build.copyQ(cards[0]);
  assert.equal(cp.prompt, 'apple'); assert.equal(cp.correct, 'apple');
  assert.equal(build.typePictureQ(cards[0]), null, '짝수 번호 카드는 그림 없음');
  const pic = build.typePictureQ(cards[1]);
  assert.ok(pic.imageUrl); assert.equal(pic.correct, 'apply'); assert.equal(pic.prompt, '');
  assert.equal(build.hintQ({ id: 'x', word: 'at', meaning: '에' }), null, '두 글자 낱말은 힌트가 없다');
});

const sents = [
  { id: 's1', word: 'I want a cat.', meaning: '나는 고양이를 원해요.' },
  { id: 's2', word: 'I want an apple.', meaning: '나는 사과를 원해요.' },
  { id: 's3', word: 'She likes red, blue and green.', meaning: '그녀는 빨강, 파랑, 초록을 좋아해요.' },
  { id: 's4', word: 'We go to school.', meaning: '우리는 학교에 가요.' },
];
await test('플립 카드: 보고 듣기 블록 하나에 낱말 | 뜻 | 예문 줄로 담기고 검사를 통과한다', () => {
  const it = mem.memoryItemFromCards(cards, 'flip', 5, false, rng);
  assert.equal(it.config.block.type, 'study');
  assert.equal(it.config.block.completion, 'confirm');
  assert.equal(it.config.block.method, 'flip');
  assert.deepEqual(it.content.questions, []);
  const lines = it.config.block.text.split(String.fromCharCode(10));
  assert.equal(lines.length, 5);
  assert.ok(lines.every((l) => l.split('|').length === 3));
  assert.deepEqual(blocks.validateItems([it]), []);
  const big = Array.from({ length: 300 }, (_, i) => ({ id: 'b' + i, word: 'word' + i, meaning: '뜻' + i, example: 'This is a fairly long example sentence number ' + i + ' for the card.' }));
  const deck = mem.memoryItemFromCards(big, 'flip', 100, false, rng);
  assert.ok(deck.config.block.text.length <= 5000 && deck.config.block.count <= 60, String(deck.config.block.text.length));
});
await test('맞다/아니다: 짝이 맞으면 O, 틀린 짝이면 X가 정답이고 둘이 섞인다', () => {
  const qs = mem.MEMORY_METHODS.ox.build(cards, cards, rng);
  assert.ok(qs.length >= 6);
  assert.deepEqual(qs[0].choices, ['O', 'X']);
  const t0 = qs.find((q) => q.correct === 0), f0 = qs.find((q) => q.correct === 1);
  assert.ok(t0 && f0);
  const [w0, m0] = t0.prompt.split(' = ');
  assert.equal(cards.find((c) => c.word === w0).meaning, m0);
  const [w1, m1] = f0.prompt.split(' = ');
  assert.notEqual(cards.find((c) => c.word === w1).meaning, m1);
});
await test('문장 방식 3종은 문장 카드에서만 만들어지고, 단어 카드에서는 만들지 않는다', () => {
  for (const m of ['swrite', 'sfade']) {
    assert.equal(mem.MEMORY_METHODS[m].sentence, true);
    assert.equal(mem.memoryItemFromCards(cards, m, 5, false, rng), null, m + ' 단어 카드');
    const it = mem.memoryItemFromCards(sents, m, 5, false, rng);
    assert.equal(it.content.questions.length, 4, m);
    assert.deepEqual(blocks.validateItems([it]), [], m);
  }
});
await test('문장 정답: 쉼표를 뺀 글도 정답으로 인정한다(화면 자판에 쉼표가 없어서)', () => {
  const q = build.sentenceWriteQ(sents[2]);
  assert.equal(q.correct, 'She likes red, blue and green. / She likes red blue and green.');
  assert.equal(build.sentenceWriteQ(sents[0]).correct, 'I want a cat.');
  assert.equal(q.prompt, sents[2].meaning);
});
await test('틀 바꿔 쓰기: 처음 두 낱말이 같은 보기 문장이 있을 때만 만들어진다', () => {
  const q = build.frameQ(sents[0], sents, rng);
  assert.equal(q.sub, 'I want an apple.');
  assert.equal(q.correct, 'I want a cat.');
  assert.equal(build.frameQ(sents[3], sents, rng), null);
  const it = mem.memoryItemFromCards(sents, 'frame', 5, false, rng);
  assert.equal(it.content.questions.length, 2);
  assert.deepEqual(blocks.validateItems([it]), []);
});

await test('게임 모양 12종 추가(괴물·뽑기·미로·비행기·그룹·크로스워드·문장 5종·문법 탐정)는 문제로 만들어지고 검사를 통과한다', () => {
  const cats = cards.map((c, i) => ({ ...c, category: i % 3 === 0 ? '과일' : i % 3 === 1 ? '동물' : '탈것' }));
  const pairs = [['monster', cards], ['claw', cards], ['maze', cards], ['plane', cards], ['group', cats], ['cross', cards],
    ['train', sents], ['rocket', sents], ['tower', sents], ['bridge', sents], ['splash', sents], ['detective', sents]];
  for (const [g, src] of pairs) {
    const it = blocks.gameItemFromCards(src, g, g, rng);
    assert.ok(it, g);
    assert.equal(it.config.game, g);
    assert.ok(it.content.questions.length >= 1, g);
    assert.ok(it.content.questions.every((q) => q.style === g || (g === 'claw' && q.style === 'claw') || q.style === g), g);
    assert.deepEqual(blocks.validateItems([it]), [], g);
  }
});
await test('문법 탐정: 낱말 순서만 바뀐 틀린 문장을 보여 주고 바른 문장이 정답이다', () => {
  const q = build.detectiveQ(sents[1]);
  assert.notEqual(q.prompt, 'I want an apple.');
  assert.equal([...q.prompt.split(' ')].sort().join(' '), 'I want an apple.'.split(' ').sort().join(' '));
  assert.ok(q.prompt.endsWith('apple.'));
  assert.equal(q.correct, 'I want an apple.');
});
await test('그룹 정렬: 주제가 없거나 주제가 하나뿐이면 만들지 않는다', () => {
  assert.equal(blocks.gameItemFromCards(cards, 'group', 'g', rng), null);
  const one = cards.map((c) => ({ ...c, category: '과일' }));
  assert.equal(blocks.gameItemFromCards(one, 'group', 'g', rng), null);
});
await test('문장 게임: 문장 목록은 물론 예문이 있는 낱말도 재료가 된다', () => {
  const it = blocks.gameItemFromCards(cards, 'train', 't', rng);
  assert.ok(it && it.content.questions.length >= 1);
  assert.deepEqual(it.content.questions[0].correct.join(' ').includes('I see') || it.content.questions[0].correct.length >= 3, true);
});

await server.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
