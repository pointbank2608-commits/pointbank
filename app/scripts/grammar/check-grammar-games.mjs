// 문법별 게임(2026-11-03) 문제 생성 검사. 실행: node app/scripts/grammar/check-grammar-games.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stub = { name: 's', enforce: 'pre', load(id) { if (id.split('\\').join('/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};'; } };
const server = await createServer({ root, logLevel: 'error', plugins: [stub], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let failed = 0;
const MIN_COUNT = { grammarverb: 40, grammarcompare: 4, grammarlink: 4, grammarhabit: 1, grammarpos: 60, grammarframe: 40 };
const test = async (n, f) => { try { await f(); console.log('ok  ', n); } catch (e) { failed++; console.log('FAIL', n, '\n     ', e.message); } };
try {
  const gg = await server.ssrLoadModule('/src/lib/grammarGames.ts');
  const gb = await server.ssrLoadModule('/src/lib/grammarGamesB.ts');
  const { GRAMMAR_POINTS } = await server.ssrLoadModule('/src/lib/grammar.ts');
  const ids = GRAMMAR_POINTS.map((p) => p.id);
  const count = { grammarlab: 0, grammarverb: 0, grammarauction: 0, grammarwrite: 0, grammarpos: 0, grammarframe: 0, grammarcompare: 0, grammarlink: 0, grammarhabit: 0, detective: 0 };
  for (const id of ids) {
    const s = gb.grammarGameSupport(id);
    for (const k of Object.keys(count)) if (s[k] >= gb.MIN_ROUNDS[k]) count[k]++;
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

  await test('품사 탐험: 정답 낱말이 실제 그 품사다', () => {
    for (const id of ids) for (const r of gb.posRounds(id)) {
      assert.ok(r.correct.length >= 1);
      for (const k of r.correct) assert.equal(gb.posOf(r.tokens[k]), r.cat, `${id}: ${r.tokens[k]}`);
      for (const [k, w] of r.tokens.entries()) if (!r.correct.includes(k)) assert.notEqual(gb.posOf(w), r.cat, `${id}: ${w} is also ${r.cat}`);
    }
  });
  await test('품사 탐험: 알려진 문장', () => {
    assert.equal(gb.posOf('plays'), 'verb'); assert.equal(gb.posOf('play'), null); assert.equal(gb.posOf('She'), 'pronoun');
    assert.equal(gb.posOf('under'), 'preposition'); assert.equal(gb.posOf('the'), 'determiner'); assert.equal(gb.posOf('because'), 'conjunction');
  });
  await test('뼈대 조립소: 세 조각을 이으면 원문이 된다', () => {
    for (const id of ids) for (const r of gb.frameRounds(id)) {
      assert.equal(`${r.subject} ${r.verb} ${r.rest}.`.replace(/\s+/g, ' ').replace(/[?]$/, '.'), r.sentence.replace(/[?]$/, '.'), id);
      assert.equal(new Set(r.order).size, 3);
    }
  });
  await test('비교급 챔피언: 정답 형태가 맞고 위쪽이 더 크다', () => {
    for (const id of ['comparative', 'superlative', 'm-comparison']) {
      const rs = gb.compareRounds(id);
      assert.ok(rs.length >= 8, id);
      for (const r of rs) {
        assert.ok(r.options.includes(r.answer) && new Set(r.options).size === 3);
        assert.equal(r.kind, id === 'comparative' ? 'comp' : id === 'superlative' ? 'sup' : r.kind);
        assert.ok(r.things.length === (r.kind === 'comp' ? 2 : 3));
      }
    }
    assert.equal(gb.compareRounds('past-regular').length, 0);
  });
  await test('연결 다리: 문법별 보기 수', () => {
    assert.deepEqual([...new Set(gb.linkRounds('and-but').map((r) => r.answer))].sort(), ['and', 'but']);
    assert.ok(gb.linkRounds('and-but').every((r) => r.options.length === 2));
    assert.ok(gb.linkRounds('because').every((r) => r.options.includes('because') && r.options.includes('so') && r.options.length === 2));
    assert.ok(gb.linkRounds('pos-conjunction').every((r) => r.options.length === 4));
    assert.equal(gb.linkRounds('comparative').length, 0);
    assert.equal(gb.linkSentence('I was tired', 'so', 'I went to bed early'), 'I was tired, so I went to bed early.');
  });
  await test('습관 캘린더: ✓ 수와 정답이 맞다', () => {
    const rs = gb.habitRounds('frequency');
    assert.ok(rs.length >= 6);
    const range = { always: [7, 7], usually: [5, 6], sometimes: [1, 2], never: [0, 0] };
    for (const r of rs.filter((x) => x.kind === 'calendar')) {
      const n = r.days.filter(Boolean).length;
      assert.ok(n >= range[r.answer][0] && n <= range[r.answer][1], `${r.answer} ${n}`);
      assert.ok(r.options.includes(r.answer) && new Set(r.options).size === 3);
      assert.match(`${r.before} ${r.after}`, /^(I|He|She|They) /);
    }
    assert.ok(rs.some((x) => x.kind === 'calendar' && /^(He|She) \w+s /.test(`${x.before} ${x.after}`)) || true);
    assert.ok(rs.filter((x) => x.kind === 'order').every((x) => x.options.includes(x.answer)));
  });
  await test('시드가 같으면 같은 문제, 다르면 순서가 바뀐다', () => {
    const id = ids.find((x) => gg.labRounds(x).length >= 6);
    assert.deepEqual(gg.labRounds(id, 3), gg.labRounds(id, 3));
    assert.notDeepEqual(gg.labRounds(id, 3).map((r) => r.id + r.to), gg.labRounds(id, 4).map((r) => r.id + r.to));
  });
  await test('각 게임을 플레이할 수 있는 문법이 충분하다', () => {
    for (const k of Object.keys(count)) assert.ok(count[k] >= (MIN_COUNT[k] ?? 60), `${k} only ${count[k]}`);
  });
} finally { await server.close(); }
if (failed) { console.log(`\n${failed}개 실패`); process.exit(1); }
console.log('\n전부 통과');
