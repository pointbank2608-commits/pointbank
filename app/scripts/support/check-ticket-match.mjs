// 문의 유사도(초안·묶기) 가벼운 확인 — 실행: node app/scripts/support/check-ticket-match.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let failed = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log('ok  ', name);
  } catch (e) {
    failed += 1;
    console.log('FAIL', name, '\n     ', e.message);
  }
};

try {
  const m = await server.ssrLoadModule('/src/lib/ticketMatch.ts');
  const faqMod = await server.ssrLoadModule('/src/data/faq.ts');
  const faqs = faqMod.FAQ.map((f) => ({ id: f.id, q: f.q.ko, a: f.a.ko }));

  test('같은 글은 1', () => assert.equal(m.similarity('게임이 안 켜져요', '게임이 안 켜져요'), 1));
  test('상관없는 글은 낮다', () => assert.ok(m.similarity('게임이 안 켜져요', '결제 영수증을 받고 싶어요') < 0.2));

  test('수업 되돌리기 문의 → 되돌리기 FAQ', () => {
    const s = m.suggestFaq('수업을 잘못 고쳤는데 예전 내용으로 되돌릴 수 있나요', faqs);
    assert.ok(s, '제안 없음');
    assert.equal(s.faq.id, 'lesson-history');
  });
  test('아주 짧은 글은 제안하지 않는다', () => assert.equal(m.suggestFaq('안녕', faqs), null));
  test('엉뚱한 글은 제안하지 않는다', () => assert.equal(m.suggestFaq('오늘 점심 뭐 먹었어요 맛있었어요', faqs), null));

  test('비슷한 문의 묶기', () => {
    const items = [
      { id: 'a', subject: '발표 중에 슬라이드가 안 넘어가요', body: '클리커로 넘기는데 반응이 없어요' },
      { id: 'b', subject: '슬라이드 넘기기가 안돼요', body: '발표할 때 클리커가 반응이 없어요' },
      { id: 'c', subject: '단어장 인쇄 방법', body: 'A4로 뽑고 싶어요' },
    ];
    const cl = m.clusterTickets(items);
    assert.equal(cl.length, 1);
    assert.deepEqual(cl[0].map((x) => x.id).sort(), ['a', 'b']);
  });
} finally {
  await server.close();
}
if (failed > 0) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log('\n모두 통과');
