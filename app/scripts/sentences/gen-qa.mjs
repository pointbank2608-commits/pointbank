// 질문·대답 짝 생성: 상황 12 × 레벨 4 × 6쌍을 Gemini 로 만들고 형식 검사 → 독립 검수 → src/data/sentenceQA.ts 로 쓴다.
//   node scripts/sentences/gen-qa.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ask, pool } from '../grammar-sheets/v2lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'src', 'data', 'sentenceQA.ts');

const TOPICS = [
  { id: 'intro', ko: '자기소개', en: 'Introducing myself' },
  { id: 'food', ko: '음식 주문', en: 'Ordering food' },
  { id: 'shopping', ko: '물건 사기', en: 'Shopping' },
  { id: 'direction', ko: '길 묻기', en: 'Asking the way' },
  { id: 'doctor', ko: '병원', en: 'At the doctor' },
  { id: 'weather', ko: '날씨', en: 'Weather' },
  { id: 'school', ko: '학교생활', en: 'School life' },
  { id: 'family', ko: '가족', en: 'Family' },
  { id: 'hobby', ko: '취미', en: 'Hobbies' },
  { id: 'travel', ko: '여행·공항', en: 'Travel and airport' },
  { id: 'daily', ko: '하루 일과·시간', en: 'Daily routine and time' },
  { id: 'feeling', ko: '기분·감정', en: 'Feelings' },
];
const SPEC = {
  kinder: 'question 2-6 words and answer 1-6 words, very simple (ages 5-7)',
  elem: 'question 3-9 words and answer 3-10 words, Korean elementary school (ages 8-12)',
  middle: 'question 5-14 words and answer 5-16 words, Korean middle school',
  high: 'question 7-18 words and answer 8-22 words, Korean high school, richer vocabulary',
};
const Q_RANGE = { kinder: [2, 7], elem: [3, 10], middle: [5, 15], high: [7, 19] };
const A_RANGE = { kinder: [1, 7], elem: [2, 11], middle: [4, 17], high: [7, 23] };
const hangul = /[가-힣]/;
const words = (s) => s.trim().split(/\s+/).length;

function split(line) {
  const [en, ko, ...rest] = String(line).split(' | ');
  return en && ko && !rest.length ? { en: en.trim(), ko: ko.trim() } : null;
}
function check(data) {
  const problems = [];
  const seen = new Set();
  for (const lv of Object.keys(SPEC)) {
    const list = data?.[lv];
    if (!Array.isArray(list) || list.length !== 6) { problems.push(`${lv}: 6쌍이어야 함(${list?.length})`); continue; }
    for (const [i, pair] of list.entries()) {
      const q = split(pair?.q);
      const a = split(pair?.a);
      if (!q || !a) { problems.push(`${lv}#${i + 1}: "영어 | 우리말" 형식 아님`); continue; }
      if (hangul.test(q.en) || hangul.test(a.en) || !hangul.test(q.ko) || !hangul.test(a.ko)) problems.push(`${lv}#${i + 1}: 영어/한국어 자리`);
      if (!/\?$/.test(q.en)) problems.push(`${lv}#${i + 1}: 질문은 ?로 끝나야 함: ${q.en}`);
      if (!/[.!]$/.test(a.en)) problems.push(`${lv}#${i + 1}: 대답은 . 또는 !로 끝나야 함: ${a.en}`);
      const qn = words(q.en);
      const an = words(a.en);
      if (qn < Q_RANGE[lv][0] || qn > Q_RANGE[lv][1]) problems.push(`${lv}#${i + 1}: 질문 낱말 수(${qn}): ${q.en}`);
      if (an < A_RANGE[lv][0] || an > A_RANGE[lv][1]) problems.push(`${lv}#${i + 1}: 대답 낱말 수(${an}): ${a.en}`);
      const key = q.en.toLowerCase();
      if (seen.has(key)) problems.push(`${lv}#${i + 1}: 같은 질문 중복: ${q.en}`);
      seen.add(key);
    }
  }
  return problems;
}

const gen = (t, feedback = '') => ask(`You write question-and-answer pairs for Korean English teachers to use in pair speaking practice. Topic: "${t.en}" (${t.ko}).
Write 6 pairs for each of 4 levels. A pair is one question and ONE natural answer a pupil could give to exactly that question. Each of q and a is "English | 자연스러운 한국어 번역" (Korean in polite -요 style).
Levels: ${Object.entries(SPEC).map(([k, v]) => `${k} = ${v}`).join('; ')}.
Rules: the answer must directly and correctly answer the question (check the verb/auxiliary agree: Do you...? -> Yes, I do. / I like...); within a level the 6 questions must differ in pattern (do not start more than 2 with the same two words); no emoji; common names only (Mina, Jiho, Tom, Emma); classroom-safe; no duplicate questions across levels.
Return JSON {"kinder":[{"q":"...","a":"..."} x6],"elem":[...],"middle":[...],"high":[...]}.${feedback}`, 0.6);

const results = {};
await pool(TOPICS, 6, async (t) => {
  let feedback = '';
  for (let a = 1; a <= 3; a++) {
    const data = await gen(t, feedback);
    const problems = data ? check(data) : ['JSON 실패'];
    if (problems.length === 0) { results[t.id] = data; console.log(`✓ ${t.id}`); return; }
    console.log(`… ${t.id} 시도 ${a}: ${problems.slice(0, 3).join(' | ')}`);
    feedback = `\n\nFix these problems and return the full object again:\n- ${problems.join('\n- ')}`;
  }
  console.log(`✗ ${t.id}`);
});

const REVIEW = `You are a strict English reviewer. For each level, check every question/answer pair: both lines natural and correct English that fits the level; the answer must directly and correctly answer THAT question (agreement, tense, logic); the Korean must translate faithfully and naturally. Report only real problems. Return a JSON array of {"level":string,"n":1-based pair index,"problem":string,"fix":{"q":"English | Korean","a":"English | Korean"}}; [] if none.`;
const ids = Object.keys(results);
const flags = [];
await pool(ids, 4, async (id) => {
  const t = TOPICS.find((x) => x.id === id);
  const res = await ask(`${REVIEW}\n\nTOPIC: ${t.en}\nDATA: ${JSON.stringify(results[id])}`);
  for (const f of Array.isArray(res) ? res : []) flags.push({ ...f, id });
});
console.log(`검수 지적 ${flags.length}건`);
for (const f of flags) {
  const list = results[f.id]?.[f.level];
  if (list && f.n >= 1 && f.n <= list.length && split(f.fix?.q) && split(f.fix?.a)) {
    console.log(`고침 ${f.id}/${f.level}#${f.n}: ${String(f.problem).slice(0, 80)}`);
    list[f.n - 1] = { q: f.fix.q.trim(), a: f.fix.a.trim() };
  }
}
const stillBad = ids.flatMap((id) => check(results[id]).map((m) => `${id}: ${m}`));
if (stillBad.length || ids.length !== TOPICS.length) {
  console.log('실패:', stillBad.join('\n'), `생성 ${ids.length}/${TOPICS.length}`);
  process.exit(1);
}

const body = TOPICS.map((t) => `  {
    id: ${JSON.stringify(t.id)},
    ko: ${JSON.stringify(t.ko)},
    en: ${JSON.stringify(t.en)},
    pairs: {
${Object.keys(SPEC).map((lv) => `      ${lv}: [\n${results[t.id][lv].map((p) => `        { q: ${JSON.stringify(p.q)}, a: ${JSON.stringify(p.a)} },`).join('\n')}\n      ],`).join('\n')}
    },
  },`).join('\n');
writeFileSync(out, `/**
 * 질문·대답 짝(2026-10-28) — 상황 12개 × 레벨 4개 × 6쌍. 짝 활동·말하기 게임에서 질문과 그 대답을 같이 쓴다.
 * 한 줄은 \`영어 | 우리말\`. **전부 AI 초안(자동 검수만 거침, 선생님 검수 전)**. scripts/sentences/gen-qa.mjs 가 만든다.
 */
import type { BankLevel } from './sentenceBank';

export interface QAPair {
  q: string;
  a: string;
}
export interface QATopic {
  id: string;
  ko: string;
  en: string;
  pairs: Record<BankLevel, QAPair[]>;
}

export const QA_BANK: QATopic[] = [
${body}
];
`);
console.log('wrote', out);
