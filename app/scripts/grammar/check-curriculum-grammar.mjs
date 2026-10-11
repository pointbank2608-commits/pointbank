// 교과과정 문법(lib/curriculumGrammar.ts) 확인 — 모든 문법 항목이 단원에 하나씩 들어가는지, 새 항목의 필수 칸이 갖춰졌는지 본다.
// 실행: node app/scripts/grammar/check-curriculum-grammar.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  const cg = await server.ssrLoadModule('/src/lib/curriculumGrammar.ts');
  const gr = await server.ssrLoadModule('/src/lib/grammar.ts');
  const points = gr.GRAMMAR_POINTS;

  await test('모든 문법 항목이 단원 하나에 들어간다', () => {
    const count = new Map();
    for (const u of cg.UNITS) for (const id of u.ids) count.set(id, (count.get(id) ?? 0) + 1);
    const ids = new Set(points.map((p) => p.id));
    const missing = points.filter((p) => !count.has(p.id)).map((p) => p.id);
    const dup = [...count].filter(([, n]) => n > 1).map(([id]) => id);
    const unknown = [...count.keys()].filter((id) => !ids.has(id));
    assert.deepEqual({ missing, dup, unknown }, { missing: [], dup: [], unknown: [] });
  });

  await test('학교급·학년 지도에 항목이 빠짐없이 나온다', () => {
    let n = 0;
    for (const s of cg.SCHOOLS) {
      const grades = cg.curriculumFor(s.id);
      assert.equal(grades.length, s.grades.length);
      for (const g of grades) {
        n += g.units.reduce((a, u) => a + u.points.length, 0);
        assert.equal(g.count, g.units.reduce((a, u) => a + u.points.length, 0), `${s.id} ${g.grade}`);
      }
    }
    assert.equal(n, points.length);
    const per = Object.fromEntries(cg.SCHOOLS.map((s) => [s.id, cg.curriculumFor(s.id).reduce((a, g) => a + g.count, 0)]));
    console.log('  학교급별:', JSON.stringify(per));
  });

  await test('새로 보강한 39개 항목이 모두 있고 필수 칸을 갖췄다', () => {
    const byId = new Map(points.map((p) => [p.id, p]));
    assert.equal(cg.NEW_CURRICULUM_IDS.size, 39);
    for (const id of cg.NEW_CURRICULUM_IDS) {
      const p = byId.get(id);
      assert.ok(p, `${id} 없음`);
      for (const k of ['name', 'pattern', 'explain', 'tip']) assert.ok(String(p[k] ?? '').trim(), `${id}.${k}`);
      assert.ok(p.examples.length >= 4, `${id} 예문`);
      assert.equal(p.translations.length, p.examples.length, `${id} 해석 수`);
      assert.ok(p.pitfalls.length >= 1 && p.pitfalls.every((x) => x.wrong && x.right && x.why), `${id} 틀리기 쉬운 것`);
      assert.ok(p.detail.length >= 1 && p.usage.length >= 1 && p.rule.length >= 1, `${id} 설명`);
      // 예문의 ** 표시 짝이 맞아야 한다
      for (const e of p.examples) assert.equal((e.match(/\*\*/g) ?? []).length % 2, 0, `${id} ** 짝: ${e}`);
      assert.ok(['entry', 'grow', 'bridge'].includes(p.band), `${id} band`);
    }
  });

  await test('학년이 학교급과 맞는다', () => {
    const ok = { elementary: ['초3', '초4', '초5', '초6'], middle: ['중1', '중2', '중3'], high: ['고1', '고2', '고3'] };
    for (const p of points) if (ok[p.stage]) assert.ok(ok[p.stage].includes(p.grade), `${p.id}: ${p.stage} ${p.grade}`);
  });

  await test('문장 배열하기용 문장이 항목마다 만들어진다(새 항목)', () => {
    for (const id of cg.NEW_CURRICULUM_IDS) {
      const p = points.find((x) => x.id === id);
      const s = gr.sentencesForUnscramble(p, []);
      assert.ok(s.length >= 2, `${id}: 배열할 문장 ${s.length}개`);
    }
  });
} finally {
  await server.close();
}
if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log('\n모두 통과');
