// CVC 읽기 문장(src/data/cvcReaders.json) 검수: "아직 안 배운 단어가 튀어나오지 않는" 통제된 문장인지 확인한다.
//   node app/scripts/vocab/validate-cvc-readers.mjs
//
// 규칙: 카드 n 의 문장에 나오는 낱말은 아래 중 하나여야 한다.
//   1) 최소 Heart Words(HEART)        2) 도우미 CVC 단어(HELPERS, 목표 단어는 아니지만 짝이 되는 쉬운 단어)
//   3) 앞 카드(1..n-1)의 목표 단어     4) 지금 카드(n)의 목표 단어
//   (앞 카드 목표 단어 + s 복수형은 허용한다: pens)
// 어긋나는 낱말은 카드 번호와 함께 표로 보여 준다. 문장은 "목표 단어를 반드시 포함"해야 하고, 낱말 수는 3~9여야 한다.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cards = JSON.parse(readFileSync(join(here, '..', '..', 'src', 'data', 'cvcReaders.json'), 'utf-8'));

const HEART = new Set(['the', 'a', 'is', 'on', 'in', 'can', 'has']);
// sat·mat 는 -at 가족의 쉬운 단어라 앞 카드(1~2번)에서도 문장을 이어 가기 위해 도우미로 허용한다.
const HELPERS = new Set(['sat', 'mat']);

const problems = [];
const taught = new Set();
cards.forEach((c, i) => {
  if (c.n !== i + 1) problems.push(`#${c.n}: 번호가 순서와 다름(기대 ${i + 1})`);
  const tokens = c.sentence
    .replace(/[.!?]+$/, '')
    .split(/\s+/)
    .map((t) => t.toLowerCase());
  if (tokens.length < 2 || tokens.length > 9) problems.push(`#${c.n} ${c.word}: 낱말 수 ${tokens.length}(2~9여야 함)`);
  if (!tokens.includes(c.word)) problems.push(`#${c.n} ${c.word}: 문장에 목표 단어가 없음 — ${c.sentence}`);
  taught.add(c.word);
  for (const tok of tokens) {
    const ok =
      HEART.has(tok) ||
      HELPERS.has(tok) ||
      taught.has(tok) ||
      (tok.endsWith('s') && taught.has(tok.slice(0, -1)));
    if (!ok) problems.push(`#${c.n} ${c.word}: 아직 안 배운 낱말 "${tok}" — ${c.sentence}`);
  }
  if (!/[.!?]$/.test(c.sentence)) problems.push(`#${c.n} ${c.word}: 끝 구두점이 없음`);
});

if (problems.length) {
  console.log(`문제 ${problems.length}건:\n` + problems.join('\n'));
  process.exit(1);
}
console.log(`카드 ${cards.length}개 모두 통과 (Heart Words ${[...HEART].join(', ')} / 도우미 ${[...HELPERS].join(', ')})`);
