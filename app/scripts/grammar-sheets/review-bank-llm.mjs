// 문법 워크북 자료의 독립 검수 — 만든 쪽(Claude)과 다른 모델(Gemini, Vertex)에게 항목마다 "정답이 정말 하나인가·영어가 맞는가"를 묻는다.
//   node app/scripts/grammar-sheets/review-bank-llm.mjs [id,id,...]      (id 가 없으면 bank 의 전부)
// 결과: out/review-<시각>.json (git 제외 폴더). 문제가 하나라도 나오면 종료 코드 1.
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'src', 'data');
const points = Object.fromEntries(JSON.parse(readFileSync(join(src, 'grammarPoints.json'), 'utf8')).map((p) => [p.id, p]));
const bankDir = join(src, 'grammarSheets', 'bank');
let items = [];
for (const f of readdirSync(bankDir).filter((n) => n.endsWith('.json'))) items.push(...JSON.parse(readFileSync(join(bankDir, f), 'utf8')));
const only = process.argv[2]?.split(',');
if (only) items = items.filter((i) => only.includes(i.id));

const PROJECT = process.env.GCP_PROJECT ?? 'project-01c6d808-a517-4177-82f';
const MODEL = process.env.REVIEW_MODEL ?? 'gemini-3.1-pro-preview';
const gcloud = process.env.LOCALAPPDATA ? `"${join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd')}"` : 'gcloud';
let token = '', tokenAt = 0;
const auth = () => { if (Date.now() - tokenAt > 20 * 60 * 1000) { token = execSync(`${gcloud} auth print-access-token`, { encoding: 'utf8' }).trim(); tokenAt = Date.now(); } return token; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => (s ?? '').replace(/\*\*/g, '');

async function ask(prompt) {
  const url = `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`;
  for (let a = 1; a <= 5; a++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${auth()}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }) });
      if (res.status === 401) tokenAt = 0;
      if (!res.ok) { await sleep((res.status === 429 ? 20000 : 4000) * a); continue; }
      const j = await res.json();
      return JSON.parse(j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '[]');
    } catch { await sleep(4000 * a); }
  }
  return null;
}

function brief(it) {
  const p = points[it.id];
  return {
    id: it.id, topic: p.name, level: `${p.stage} ${p.grade}`, rule: p.rule, taughtExamples: p.examples.map(strip), taughtTranslations: p.translations,
    pitfalls: (p.pitfalls ?? []).map((x) => ({ wrong: strip(x.wrong), right: strip(x.right) })),
    choose: it.choose.map((q, i) => ({ n: i + 1, sentence: q.p, options: q.c, answerIndex: q.a, why: q.why })),
    dropPitfalls: it.dropPitfalls ?? [],
    correct: it.correct, say: it.say, mission: it.mission, review: it.review, discover: it.discover,
  };
}
const RULES = `You are a strict English-grammar reviewer for a children's ESL worksheet (Korean elementary/middle/high school learners).
For each topic below, check ONLY the authored items and report real problems:
1. choose: the sentence with the marked answer must be correct; EVERY other option must be clearly wrong for that sentence (exactly one correct option). If two options are both acceptable in some reading, report it. The sentence must contain a clue (time word, subject, number) that decides the answer.
2. correct: "w" must really be wrong in exactly the way the topic teaches, "r" must be fully correct, and they must differ in a single spot.
3. say: each frame must be natural, grammatical English that practises the topic.
4. review: the Korean sentence must translate to "model" faithfully; model must satisfy the Korean condition "cond" and be grammatical.
5. discover: the model answer must be true for the taught examples.
6. mission: scene and steps must be clear, safe and doable in a classroom.
6b. pitfalls (taught): each "wrong" sentence must be genuinely incorrect for the topic in EVERY plausible reading (not merely unnatural, and not correct with a different meaning, e.g. "He hurt him" is grammatical). Report a bad one with section "pitfall" and n = its index (1-based) — unless its text appears in dropPitfalls.
7. The Korean text must be natural and correct. The content must fit the level (do not use grammar above the stated level in sentences).
Do NOT report style preferences. Return a JSON array; each element {"id":string,"section":"choose|correct|say|review|discover|mission|pitfall","n":number,"severity":"error|warning","problem":string,"fix":string}. Return [] if there are no problems.`;

mkdirSync(join(here, 'out'), { recursive: true });
const all = [];
const BATCH = 4;
for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH);
  const res = await ask(`${RULES}\n\nTOPICS:\n${JSON.stringify(batch.map(brief))}`);
  if (!res) { console.log(`검수 호출 실패: ${batch.map((b) => b.id).join(',')}`); all.push({ id: batch.map((b) => b.id).join(','), section: 'review-call', severity: 'error', problem: 'API 호출 실패', fix: '' }); continue; }
  all.push(...res);
  console.log(`${Math.min(i + BATCH, items.length)}/${items.length} 검수 — 지적 ${res.length}건`);
}
const out = join(here, 'out', `review-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
writeFileSync(out, JSON.stringify(all, null, 1));
for (const p of all) console.log(`[${p.severity}] ${p.id} ${p.section}#${p.n ?? ''}: ${p.problem}${p.fix ? ` → ${p.fix}` : ''}`);
console.log(`\n지적 ${all.length}건 (error ${all.filter((x) => x.severity === 'error').length}) → ${out}`);
process.exit(all.some((x) => x.severity === 'error') ? 1 : 0);
