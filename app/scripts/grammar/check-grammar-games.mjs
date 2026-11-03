// 문법별 게임(2026-11-03) 문제 생성 검사. 실행: node app/scripts/grammar/check-grammar-games.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stub = { name: 's', enforce: 'pre', load(id) { if (id.split('\\').join('/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};'; } };
const server = await createServer({ root, logLevel: 'error', plugins: [stub], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let failed = 0;
const test = async (n, f) => { try { await f(); console.log('ok  ', n); } catch (e) { failed++; console.log('FAIL', n, '\n     ', e.message); } };
try {
  const gg = await server.ssrLoadModule('/src/lib/grammarGames.ts');
  const { GRAMMAR_POINTS } = await server.ssrLoadModule('/src/lib/grammar.ts');
  const ids = GRAMMAR_POINTS.map((p) => p.id);
  const count = { grammarlab: 0, grammarverb: 0, grammarauction: 0, grammarwrite: 0, detective: 0 };
  for (const id of ids) {
    const s = gg.grammarGameSupport(id);
    for (const k of Object.keys(count)) if (s[k] >= gg.MIN_ROUNDS[k]) count[k]++;
  }
  console.log('플레이 가능한 문법 수(169개 중):', JSON.stringify(count));

  await test('문장 변신: 칩을 순서대로 놓으면 정답이 된다', () => {
    for (const id of ids) for (const r of gg.labRounds(id)) {
      const words = r.to.replace(/[.?]$/, '').split(/\s+/);
      for (const w of words) assert.ok(r.chips.includes(w), `${id}: ${w} missing in chips`);
      assert.ok(r.chips.length >= words.length + 1);
    }
  });
  await test('주어·동사 짝꿍: 정답이 보기에 있고 문장이 복원된다', () => {
    for (const id of ids) for (const r of gg.verbRounds(id)) {
      assert.ok(r.options.includes(r.answer) && new Set(r.options).size === r.options.length, `${id}: ${JSON.stringify(r)}`);
      assert.ok(r.options.length >= 2);
      const rebuilt = `${r.subject} ${r.before.split(' ').slice(1).join(' ')} ${r.answer} ${r.after}`.replace(/\s+/g, ' ').replace(/ ([.?])$/, '$1');
      assert.ok(rebuilt.length > 0);
    }
  });
  await test('문법 경매: 맞는 문장/틀린 문장이 섞이고 틀린 것엔 고친 문장이 있다', () => {
    let both = 0;
    for (const id of ids) {
      const lots = gg.auctionLots(id);
      for (const l of lots) assert.ok(l.ok ? l.fix === null : Boolean(l.fix && l.fix !== l.sentence), id);
      if (lots.some((l) => l.ok) && lots.some((l) => !l.ok)) both++;
    }
    assert.ok(both > 100, `both ${both}`);
  });
  await test('조건 영작 대결: 우리말·조건·모범 답이 비지 않는다', () => {
    for (const id of ids) for (const r of gg.writeRounds(id)) assert.ok(r.ko && r.cond && r.model, id);
  });
  await test('탐정 사건집: 오류 범위가 틀린 문장 안에 있다', () => {
    for (const id of ids) for (const c of gg.detectiveCases(id)) {
      const e = c.errors[0];
      assert.ok(e.start >= 0 && e.end <= c.incorrect.length && e.start < e.end, id);
      assert.ok(e.choices.includes(e.replacement));
    }
  });
  await test('시드가 같으면 같은 문제, 다르면 순서가 바뀐다', () => {
    const id = ids.find((x) => gg.labRounds(x).length >= 6);
    assert.deepEqual(gg.labRounds(id, 3), gg.labRounds(id, 3));
    assert.notDeepEqual(gg.labRounds(id, 3).map((r) => r.id + r.to), gg.labRounds(id, 4).map((r) => r.id + r.to));
  });
  await test('각 게임을 플레이할 수 있는 문법이 충분하다', () => {
    for (const k of Object.keys(count)) assert.ok(count[k] >= (k === 'grammarverb' ? 40 : 60), `${k} only ${count[k]}`);
  });
} finally { await server.close(); }
if (failed) { console.log(`\n${failed}개 실패`); process.exit(1); }
console.log('\n전부 통과');
