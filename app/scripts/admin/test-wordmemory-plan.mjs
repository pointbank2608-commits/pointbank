// 단어암기숙제 배정 미리보기 계산(앱, TypeScript)이 서버(SQL) 규칙과 같은지 확인한다 — 같은 입력을 양쪽에 넣어 비교.
import { createServer } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWmDb } from './wm-setup.mjs';
import { check, summary } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true } });
const db = await makeWmDb();
try {
  const P = await server.ssrLoadModule('/src/lib/wordMemory/plan.ts');

  console.log('1. 열쇠(낱말|뜻)가 서버와 같다');
  const samples = [['Apple', ' 사과 '], ['ice  cream', '아이스   크림'], ['bank', '은행'], ['BANK', '둑'], ['Hello!', '안녕']];
  for (const [w, m] of samples) {
    const sql = (await db.query('select public.wm_key($1, $2) as k', [w, m])).rows[0].k;
    check(`열쇠 일치: ${w}|${m}`, sql === P.cardKey(w, m), `${sql} vs ${P.cardKey(w, m)}`);
  }

  console.log('2. 단어장 카드 → 배정 카드');
  const cards = P.toWmCards([
    { id: '1', word: 'apple', meaning: '사과', imageUrl: '/a.webp', example: 'I eat an apple.' },
    { id: '2', word: 'Apple', meaning: '사과' },
    { id: '3', word: 'bank', meaning: '은행', partOfSpeech: '명사' },
    { id: '4', word: 'bank', meaning: '둑' },
    { id: '5', word: '', meaning: '빈낱말' },
    { id: '6', word: 'cat', meaning: '' },
  ]);
  check('낱말·뜻이 없는 줄과 같은 낱말|뜻은 한 번만', cards.length === 3 && cards.map((c) => c.word).join() === 'apple,bank,bank');
  check('같은 철자·다른 뜻은 둘 다 남는다', cards.filter((c) => c.word === 'bank').length === 2);
  const sqlClean = (await db.query('select public.wm_clean_cards($1::jsonb) as c', [JSON.stringify(cards)])).rows[0].c;
  check('서버 정리 결과와 개수·열쇠가 같다', sqlClean.length === cards.length && sqlClean.every((c, i) => c.key === P.cardKey(cards[i].word, cards[i].meaning)));

  console.log('3. 빈칸 가능 여부가 서버와 같다');
  const pool = [
    { word: 'cat', meaning: '고양이', example: 'The cat sleeps.' },
    { word: 'jump', meaning: '뛰다', example: 'She jumps high.' },
    { word: 'dog', meaning: '강아지', example: 'My dog, Max, is big.' },
    { word: 'run', meaning: '달리다', example: 'We can run.' },
    { word: 'sun', meaning: '해', example: 'Sunny days are nice.' },
    { word: 'ice cream', meaning: '아이스크림', example: 'I love ice cream!' },
    { word: 'c++', meaning: '언어', example: 'He knows c++ well.' },
    { word: 'apple', meaning: '사과' },
    { word: 'fish', meaning: '물고기', example: 'fish' },
    { word: 'ball', meaning: '공', example: 'A ball-game starts.' },
  ];
  const full = (await db.query('select public.wm_clean_cards($1::jsonb) as c', [JSON.stringify(pool)])).rows[0].c;
  for (const c of pool) {
    const k = P.cardKey(c.word, c.meaning);
    const q = (await db.query('select public.wm_make_q($1::jsonb, $2, $3::jsonb) as q', [JSON.stringify(full.find((x) => x.key === k)), 'blank', JSON.stringify(full)])).rows[0].q;
    check(`빈칸 ${c.word}: 앱 ${P.canMakeBlank(c)} = 서버 ${q !== null}`, P.canMakeBlank(c) === (q !== null));
  }

  console.log('4. 미리보기 분석');
  const a = P.analyzeCards(pool);
  check('그림·예문·빈칸 가능·활용형 제외 수', a.total === 10 && a.withImage === 0 && a.withExample === 9 && a.blankUsable + a.exampleUnusable === a.withExample);
  check('활용형 예문은 "빈칸 불가"로 센다(jump·sun)', a.exampleUnusable >= 2);
  check('같은 철자 묶음 수', P.analyzeCards(cards).homographs === 1);
  check('단어 4개 미만·1000개 초과를 알린다', P.analyzeCards(cards).issues.includes('too_few') && P.analyzeCards(Array.from({ length: 1001 }, (_, i) => ({ word: `w${i}`, meaning: `m${i}` }))).issues.includes('too_many'));

  console.log('5. 하루 학습량·기간');
  check('가볍게/보통 상한이 서버 규칙과 같다', JSON.stringify(P.dailyBudget('light')) === '{"asks":12,"newMax":3,"retryReserve":2}' && JSON.stringify(P.dailyBudget('normal')) === '{"asks":20,"newMax":5,"retryReserve":4}');
  const par = (m) => db.query('select public.wm_mode_params($1) as p', [m]).then((r) => r.rows[0].p);
  const [pl, pn] = [await par('light'), await par('normal')];
  check('서버 파라미터와 앱 숫자 일치', pl.asks === 12 && pl.reserve === 2 && pl.new_max === 3 && pn.asks === 20 && pn.reserve === 4 && pn.new_max === 5);
  const pp = await par('plus');
  check('넉넉히(plus) 분량도 서버와 앱 숫자가 같다', pp.asks === 30 && pp.reserve === 5 && pp.new_max === 10 && JSON.stringify(P.dailyBudget('plus')) === '{"asks":30,"newMax":10,"retryReserve":5}');
  check('100개 단어를 모두 소개하는 데 가볍게 34일 / 보통 20일', P.introDays(100, 'light') === 34 && P.introDays(100, 'normal') === 20);
  check('공부 기간 기본값은 7~240일 안', P.defaultStudyDays(10, 'normal') === 7 && P.defaultStudyDays(400, 'light') === 137 && P.defaultStudyDays(1000, 'light') === 240 && P.defaultStudyDays(100, 'normal') === 23);
  const m = P.estimateMinutes('light');
  check('예상 시간은 범위로(정확한 수치를 단정하지 않는다)', m.min < m.max && m.min >= 2);
} finally {
  await server.close();
}
summary();
