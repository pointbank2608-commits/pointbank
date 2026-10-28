// 문법 워크북 자료(data/grammarSheets/bank/*.json) 정적 검사 — 구조·형식·정답이 보기 안에 있는지·문장 길이·A/B 세트 중복 등.
// 영어가 문법적으로 맞는지는 loop-v2.mjs(독립 검수)와 사람이 본다.
//   node scripts/grammar-sheets/check-bank.mjs [--complete]   (--complete: 모든 문법 항목에 A·B 세트가 있어야 통과)
import { allItems, checkTopic, loadBank, points } from './v2lib.mjs';

const complete = process.argv.includes('--complete');
const items = allItems(loadBank());
const problems = [];
const seen = new Set();
for (const it of items) {
  if (seen.has(it.id)) problems.push(`${it.id}: 같은 id 가 두 번 나옴`);
  seen.add(it.id);
  for (const m of checkTopic(it, { requireB: complete })) problems.push(`${it.id}: ${m}`);
}
const missing = points.filter((p) => !seen.has(p.id)).map((p) => p.id);
console.log(`항목 ${items.length}개 / 문법 ${points.length}개 (빠진 것 ${missing.length}개), B 세트 ${items.filter((i) => i.b).length}개`);
if (problems.length) console.log(problems.join('\n'));
if (complete && missing.length) console.log('빠진 id:', missing.join(', '));
const fail = problems.length > 0 || (complete && missing.length > 0);
console.log(fail ? `\n실패: 문제 ${problems.length}건` : '\n통과');
process.exit(fail ? 1 : 0);
