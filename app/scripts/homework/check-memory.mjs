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
    const it = mem.memoryItemFromCards(cards, m, 6, false, rng);
    assert.ok(it, m);
    assert.equal(it.config.block.type, 'recall');
    assert.equal(it.config.block.method, m);
    assert.ok(it.content.questions.length >= 1 && it.content.questions.length <= 6, m);
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

await server.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
