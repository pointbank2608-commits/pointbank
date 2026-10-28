// 말하기 목적별 문장 모음 생성: 목적 × 레벨 4 × 8문장을 Gemini 로 만들고 형식 검사 → 독립 검수 → src/data/sentencePurposes.ts 로 쓴다.
//   node scripts/sentences/gen-purposes.mjs
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ask, pool } from '../grammar-sheets/v2lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'src', 'data', 'sentencePurposes.ts');
const existing = readFileSync(join(here, '..', '..', 'src', 'data', 'sentenceBank.ts'), 'utf8').toLowerCase();

const PURPOSES = [
  { id: 'introduce', ko: '소개하기', en: 'Introducing', hint: 'name, age, where I live, family, who someone is' },
  { id: 'ask', ko: '질문하기', en: 'Asking questions', hint: 'what/where/when/who/how/why/do you/can you questions about everyday things' },
  { id: 'request', ko: '부탁하기·허락 구하기', en: 'Requests and permission', hint: 'Can I borrow...? / Could you help me? / May I...? / Please pass...' },
  { id: 'likes', ko: '좋아하는 것 말하기', en: 'Likes and dislikes', hint: 'I like / I love / I do not like / favorite / I am good at' },
  { id: 'feelings', ko: '감정·상태 표현하기', en: 'Feelings and conditions', hint: 'happy, sad, tired, hungry, angry, nervous, excited, sick and why' },
  { id: 'directions', ko: '길 묻고 안내하기', en: 'Directions', hint: 'Where is...? turn left, go straight, next to, across from' },
  { id: 'thanks', ko: '감사·사과·인사하기', en: 'Thanks, sorry, greetings', hint: 'Thank you, I am sorry, excuse me, welcome, see you, congratulations' },
  { id: 'suggest', ko: '제안·권유하기', en: 'Suggestions and invitations', hint: "Let's..., Why don't we...?, Shall we...?, How about...?, Would you like to...?" },
  { id: 'describe', ko: '사람·사물 묘사하기', en: 'Describing', hint: 'appearance, color, size, personality, it is... / he has... / she looks...' },
  { id: 'plans', ko: '계획·약속 말하기', en: 'Plans and schedules', hint: 'I am going to..., I will..., on Saturday, next week, tomorrow' },
  { id: 'opinion', ko: '의견 말하기·동의하기', en: 'Opinions and agreeing', hint: 'I think..., I agree, I do not agree, in my opinion, because...' },
];
const SPEC = {
  kinder: '2-6 words, very simple, one idea (ages 5-7)',
  elem: '4-9 words, simple present/past/future, Korean elementary school (ages 8-12)',
  middle: '6-14 words, Korean middle school level, may use because/if/when',
  high: '8-20 words, Korean high school level, richer vocabulary and clauses',
};
const RANGE = { kinder: [2, 7], elem: [4, 10], middle: [6, 15], high: [8, 22] };
const hangul = /[가-힣]/;

function check(data) {
  const problems = [];
  const seen = new Set();
  for (const lv of Object.keys(SPEC)) {
    const list = data?.[lv];
    if (!Array.isArray(list) || list.length !== 8) { problems.push(`${lv}: 8문장이어야 함(${list?.length})`); continue; }
    for (const raw of list) {
      const [en, ko, ...rest] = String(raw).split(' | ');
      if (!en || !ko || rest.length) { problems.push(`${lv}: "영어 | 우리말" 형식 아님: ${raw}`); continue; }
      const n = en.trim().split(/\s+/).length;
      if (hangul.test(en) || !hangul.test(ko)) problems.push(`${lv}: 영어/한국어 자리 확인: ${raw}`);
      if (n < RANGE[lv][0] || n > RANGE[lv][1]) problems.push(`${lv}: 낱말 수 ${RANGE[lv][0]}~${RANGE[lv][1]} 밖(${n}): ${en}`);
      if (!/[.?!]$/.test(en.trim())) problems.push(`${lv}: 문장부호로 끝나야 함: ${en}`);
      const key = en.trim().toLowerCase();
      if (seen.has(key)) problems.push(`${lv}: 중복: ${en}`);
      seen.add(key);
      if (existing.includes(`'${key}`)) problems.push(`${lv}: 상황 은행에 이미 있음: ${en}`);
    }
  }
  return problems;
}

const gen = (p, feedback = '') => ask(`You write example sentences for Korean English teachers. Speaking purpose: "${p.en}" (${p.ko}). Typical forms: ${p.hint}.
Write 8 NATURAL, CORRECT sentences for each of 4 levels. Each line is "English sentence | 자연스러운 한국어 번역".
Levels: ${Object.entries(SPEC).map(([k, v]) => `${k} = ${v}`).join('; ')}.
Rules: every sentence must clearly serve the purpose; vary the sentence patterns inside a level (do not start all 8 the same way); questions may be used when natural (a pupil could answer them); no emoji; no proper names except common ones (Mina, Jiho, Tom, Emma); every sentence ends with . ? or !; no duplicates across levels; classroom-safe.
Return JSON {"kinder":[8],"elem":[8],"middle":[8],"high":[8]}.${feedback}`, 0.6);

const results = {};
await pool(PURPOSES, 6, async (p) => {
  let feedback = '';
  for (let a = 1; a <= 3; a++) {
    const data = await gen(p, feedback);
    const problems = data ? check(data) : ['JSON 실패'];
    if (problems.length === 0) { results[p.id] = data; console.log(`✓ ${p.id}`); return; }
    console.log(`… ${p.id} 시도 ${a}: ${problems.slice(0, 3).join(' | ')}`);
    feedback = `\n\nFix these problems and return the full object again:\n- ${problems.join('\n- ')}`;
  }
  console.log(`✗ ${p.id}`);
});

// 독립 검수
const REVIEW = `You are a strict English reviewer. For each level, check every "English | Korean" line: the English must be natural and correct, fit the level, and clearly serve the purpose; the Korean must translate it faithfully and naturally. Report only real problems. Return a JSON array of {"level":string,"n":1-based index,"problem":string,"fix":"corrected full line in the same 'English | Korean' format"}; [] if none.`;
const ids = Object.keys(results);
const flags = [];
await pool(ids, 4, async (id) => {
  const p = PURPOSES.find((x) => x.id === id);
  const res = await ask(`${REVIEW}\n\nPURPOSE: ${p.en} — ${p.hint}\nDATA: ${JSON.stringify(results[id])}`);
  for (const f of Array.isArray(res) ? res : []) flags.push({ ...f, id });
});
console.log(`검수 지적 ${flags.length}건`);
for (const f of flags) {
  const list = results[f.id]?.[f.level];
  if (list && f.n >= 1 && f.n <= list.length && typeof f.fix === 'string' && f.fix.includes(' | ')) {
    console.log(`고침 ${f.id}/${f.level}#${f.n}: ${String(f.problem).slice(0, 80)}`);
    list[f.n - 1] = f.fix.trim();
  }
}
const stillBad = ids.flatMap((id) => check(results[id]).map((m) => `${id}: ${m}`));
if (stillBad.length || ids.length !== PURPOSES.length) {
  console.log('실패:', stillBad.join('\n'), `생성 ${ids.length}/${PURPOSES.length}`);
  process.exit(1);
}

const body = PURPOSES.map((p) => `  {
    id: 'p:${p.id}',
    ko: ${JSON.stringify(p.ko)},
    en: ${JSON.stringify(p.en)},
    theme: 'purpose',
    lines: {
${Object.keys(SPEC).map((lv) => `      ${lv}: [\n${results[p.id][lv].map((l) => `        ${JSON.stringify(l)},`).join('\n')}\n      ],`).join('\n')}
    },
  },`).join('\n');
writeFileSync(out, `/**
 * 말하기 목적별 문장 모음(2026-10-28) — 같은 목적(소개하기·질문하기·부탁하기 …)을 레벨(유치·초등·중등·고등)별 문장으로 모은 공용 자료.
 * 상황 은행(sentenceBank.ts)과 같은 모양이라 SentenceBankPicker 의 "말하기 목적" 보기에서 그대로 쓴다.
 * **전부 AI 초안(자동 검수 거침, 선생님 검수 전)** — 화면에 "초안"으로 알린다. 이 파일은 scripts/sentences/gen-purposes.mjs 가 만든다.
 */
import type { BankSituation } from './sentenceBank';

export const PURPOSE_BANK: BankSituation[] = [
${body}
];
`);
console.log('wrote', out);
