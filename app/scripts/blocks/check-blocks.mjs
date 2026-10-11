// 블록 레지스트리(lib/blocks/registry.ts) 확인 — 기존 기능이 빠짐없이 블록으로 등록됐는지 본다.
// 실행: node app/scripts/blocks/check-blocks.mjs   (저장소 루트 또는 app/ 어디서든)
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

try {
  const reg = await server.ssrLoadModule('/src/lib/blocks/registry.ts');
  const cat = await server.ssrLoadModule('/src/lib/gameCatalog.ts');
  const mat = await server.ssrLoadModule('/src/lib/materialsCatalog.ts');
  const edit = await server.ssrLoadModule('/src/lib/soloEdit.ts');

  const count = (cond) => reg.BLOCKS.filter(cond).length;
  console.log(`\n블록 ${reg.BLOCKS.length}개:`, ['game', 'practice', 'learn', 'print', 'media', 'free', 'helper'].map((c) => `${c} ${count((b) => b.category === c && !b.soloStep)}`).join(' · '), `· 개별수업 문제 ${count((b) => !!b.soloStep)}\n`);

  await test('아이디가 겹치지 않는다', () => {
    const ids = reg.BLOCKS.map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length);
  });
  await test('게임 카탈로그의 모든 게임이 블록이다', () => {
    for (const g of cat.GAME_CATALOG) {
      const b = reg.blockOfSlide({ id: 'x', kind: 'game', gameType: g.type });
      assert.ok(b, g.type);
      assert.ok(b.category === 'game' || b.category === 'practice', g.type);
    }
    assert.equal(count((b) => b.slide?.kind === 'game'), cat.GAME_CATALOG.length);
  });
  await test('문제풀이 블록 5개', () => {
    assert.equal(count((b) => b.category === 'practice' && !b.soloStep), 5);
  });
  await test('수업 자료실 카드가 모두 인쇄 블록이다', () => {
    for (const m of mat.MATERIALS_CATALOG) assert.ok(reg.findBlock(`print.${m.id}`), m.id);
  });
  await test('개별수업 문제 종류(intro 제외)가 모두 블록이다', () => {
    for (const k of edit.STEP_KINDS.filter((x) => x.t !== 'intro')) assert.ok(reg.blockOfSoloStep(k.t), k.t);
  });
  await test('단체수업 슬라이드 종류가 모두 블록으로 읽힌다', () => {
    const slides = [
      { kind: 'image' }, { kind: 'video' }, { kind: 'game', gameType: 'wheel' }, { kind: 'material', materialId: 'worksheet' }, { kind: 'web' },
      { kind: 'canvas' }, { kind: 'study' }, { kind: 'grammar' }, { kind: 'reading', mode: 'lines' }, { kind: 'reading', mode: 'cloze' },
      { kind: 'shadow' }, { kind: 'qna' }, { kind: 'drill' }, { kind: 'rainbow', mode: 'speak' }, { kind: 'rainbow', mode: 'structure' },
      { kind: 'wordshow' }, { kind: 'attendance' },
    ];
    for (const s of slides) assert.ok(reg.blockOfSlide({ id: 'x', ...s }), JSON.stringify(s));
    // 모르는 자료실 id 는 워크시트로 읽는다(예전 library 슬라이드 호환)
    assert.equal(reg.blockOfSlide({ id: 'x', kind: 'material', materialId: 'nope' }).id, 'print.worksheet');
  });
  await test('단체·개별 짝 개념이 양쪽에 있다', () => {
    for (const c of ['wordIntro', 'meaningPick', 'spelling', 'sentenceOrder', 'rainbowSpeak', 'rainbowStructure', 'roleplay']) {
      const bs = reg.blocksOfConcept(c);
      assert.ok(bs.some((b) => b.uses.includes('group')), `${c}: 단체수업 쪽 없음`);
      assert.ok(bs.some((b) => b.uses.includes('solo')), `${c}: 개별수업 쪽 없음`);
    }
  });
  await test('보조 블록은 주 블록이 아니다', () => {
    for (const b of reg.BLOCKS.filter((x) => x.category === 'helper')) assert.equal(b.role, 'helper');
    for (const b of reg.BLOCKS.filter((x) => x.category !== 'helper')) assert.equal(b.role, 'main');
    assert.ok(reg.findBlock('helper.annotation'), '판서');
  });
} finally {
  await server.close();
}
if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log('\n모두 통과');
