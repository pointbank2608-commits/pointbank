// 문법 워크북 v2 독립 검수 + 자동 수정 반복: 검수(Gemini) → error 지적을 항목 단위로 고치기(Gemini) → 정적 검사 → 다시 검수.
//   node scripts/grammar-sheets/loop-v2.mjs [id,id,...] [--rounds=3]
// 지적이 남으면 out/loop-remaining.json 에 적고 종료 코드 1. 고친 내용은 bank/*.json 에 바로 저장한다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allItems, ask, checkTopic, loadBank, pointById, pool, saveItem, strip } from './v2lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const bank = loadBank();
const all = allItems(bank);
const only = process.argv.slice(2).find((a) => !a.startsWith('--'))?.split(',');
const rounds = Number(process.argv.find((a) => a.startsWith('--rounds='))?.split('=')[1] ?? 3);
let targets = all.filter((it) => !only || only.includes(it.id));
const fileOf = (it) => bank.find((b) => b.list.includes(it));

function view(it, set) {
  const p = pointById[it.id];
  if (set === 'A') {
    return {
      choose: it.choose.map((q, i) => ({ n: i + 1, sentence: q.p, options: q.c, answerIndex: q.a, why: q.why })),
      build: (it.buildExtra ?? []).map((b, i) => ({ n: i + 1, en: strip(b.en), marked: b.en, ko: b.ko })),
      correct: it.correct.map((c, i) => ({ n: i + 1, ...c })),
      say: it.say.map((s, i) => ({ n: i + 1, ...s })),
      review: it.review.map((r, i) => ({ n: i + 1, ...r })),
      mission: it.mission, discover: it.discover,
      pitfallsTaught: (p.pitfalls ?? []).map((x, i) => ({ n: i + 1, wrong: strip(x.wrong), right: strip(x.right) })).filter((x) => !(it.dropPitfalls ?? []).some((d) => strip(d).trim().toLowerCase() === x.wrong.trim().toLowerCase())),
    };
  }
  const b = it.b;
  return {
    choose: b.choose.map((q, i) => ({ n: i + 1, sentence: q.p, options: q.c, answerIndex: q.a, why: q.why })),
    build: b.build.map((x, i) => ({ n: i + 1, en: strip(x.en), marked: x.en, ko: x.ko })),
    correct: b.correct.map((c, i) => ({ n: i + 1, ...c })), say: b.say.map((s, i) => ({ n: i + 1, ...s })),
    review: b.review.map((r, i) => ({ n: i + 1, ...r })), mission: b.mission, discover: b.discover,
  };
}
function brief(it) {
  const p = pointById[it.id];
  return { id: it.id, topic: p.name, level: `${p.stage} ${p.grade}`, rule: p.rule, taughtExamples: p.examples.map(strip), taughtTranslations: p.translations, setA: view(it, 'A'), setB: view(it, 'B') };
}

const RULES = `You are a strict English-grammar reviewer for a children's ESL worksheet (Korean elementary/middle/high school learners).
Each topic has two worksheets, setA and setB. Check ONLY the authored items and report real problems:
1. choose: the sentence with the marked answer must be correct; EVERY other option must be clearly wrong for that sentence (exactly one acceptable option). If two options are both acceptable in some reading, report it. The sentence must contain a clue that decides the answer. It must test the stated topic.
2. correct: "w" must be wrong in EVERY plausible reading in exactly the way the topic teaches, "r" must be fully correct, and they must differ in a single spot.
3. build: "en" must be correct natural English; the **marked** part must be the target grammar; "ko" must translate it faithfully. The sentence must be usable as a gap-fill (marked part removed) and as a word-order task without ambiguity.
4. say: each frame must be natural, grammatical English practising the topic (blanks "____" are fine).
5. review: the Korean sentence must translate to "model" faithfully; model must satisfy "cond" and be grammatical and show the topic.
6. discover: the model answer must be true for the examples; mission: clear, safe, doable in class, steps consistent with the scene.
7. pitfallsTaught (setA only): each "wrong" must be genuinely incorrect in EVERY plausible reading. Report as section "pitfall", set "A", n = its n.
8. Korean must be natural; vocabulary and grammar must fit the level. Items inside a set must not duplicate each other.
Do NOT report style preferences or minor wording. Return a JSON array; each element {"id":string,"set":"A"|"B","section":"choose|build|correct|say|review|discover|mission|pitfall","n":number,"severity":"error|warning","problem":string,"fix":string}. Return [] if there are no problems.`;

async function review(batch) {
  const res = await ask(`${RULES}\n\nTOPICS:\n${JSON.stringify(batch.map(brief))}`);
  return res;
}

const REPAIR = `You fix flagged items on an English-grammar worksheet for Korean pupils. For each flag, write a REPLACEMENT item of the same shape that fully resolves the problem (exactly one correct option; wrong sentences wrong in every reading and in one spot; natural English; Korean natural). Keep the same grammar topic and level, keep it different from the other items.
Shapes: choose {p (one "____"),c (2-3 options),a (index),why(Korean)}; build {en (with **bold** target part, 3-9 words),ko}; correct {w,r,why}; say {task(Korean),frame(English)}; review {ko,cond,model}; discover {q,a}; mission {title,scene,steps:[3]}.
Return JSON: [{"set":"A"|"B","section":"...","n":number,"item":{...}}] with one element per flag (same set/section/n as the flag). For a "pitfall" flag, return nothing for it.`;

const SHAPE = { choose: ['p', 'c', 'a', 'why'], build: ['en', 'ko'], correct: ['w', 'r', 'why'], say: ['task', 'frame'], review: ['ko', 'cond', 'model'], discover: ['q', 'a'], mission: ['title', 'scene', 'steps'] };
function applyFix(it, f) {
  const need = SHAPE[f.section];
  if (!need || !f.item || typeof f.item !== 'object' || need.some((k) => f.item[k] === undefined || f.item[k] === null)) return false;
  const target = f.set === 'B' ? it.b : it;
  const key = f.section === 'build' ? (f.set === 'B' ? 'build' : 'buildExtra') : f.section;
  if (['discover', 'mission'].includes(f.section)) { target[key] = f.item; return true; }
  const list = target[key];
  if (!Array.isArray(list) || !(f.n >= 1 && f.n <= list.length)) return false;
  list[f.n - 1] = f.item;
  return true;
}

mkdirSync(join(here, 'out'), { recursive: true });
let remaining = [];
for (let round = 1; round <= rounds; round++) {
  const batches = [];
  for (let i = 0; i < targets.length; i += 2) batches.push(targets.slice(i, i + 2));
  const flagsByTopic = new Map();
  let reviewed = 0;
  await pool(batches, 5, async (batch) => {
    const res = await review(batch);
    reviewed += batch.length;
    if (!Array.isArray(res)) { for (const it of batch) flagsByTopic.set(it.id, [{ id: it.id, set: 'A', section: 'call', n: 0, severity: 'error', problem: '검수 호출 실패', fix: '' }]); return; }
    for (const f of res) if (f.severity === 'error') { if (!flagsByTopic.has(f.id)) flagsByTopic.set(f.id, []); flagsByTopic.get(f.id).push(f); }
    console.log(`R${round} 검수 ${reviewed}/${targets.length} — 지적 ${res.filter((f) => f.severity === 'error').length}건`);
  });
  const failing = targets.filter((it) => flagsByTopic.has(it.id));
  console.log(`\n== 라운드 ${round}: 오류 지적이 있는 주제 ${failing.length}개 ==`);
  if (failing.length === 0) { remaining = []; break; }
  remaining = [...flagsByTopic.values()].flat();
  if (round === rounds) break;
  let fixed = 0;
  await pool(failing, 5, async (it) => {
    const flags = flagsByTopic.get(it.id).filter((f) => f.section !== 'call');
    // 가르친 틀리기 쉬운 문장이 문제라면 시트에서 뺀다
    for (const f of flags.filter((x) => x.section === 'pitfall')) {
      const wrong = pointById[it.id].pitfalls?.[f.n - 1]?.wrong;
      const shown = view(it, 'A').pitfallsTaught.find((x) => x.n === f.n);
      const w = shown ? pointById[it.id].pitfalls[f.n - 1].wrong : wrong;
      if (w) it.dropPitfalls = [...new Set([...(it.dropPitfalls ?? []), w])];
    }
    const itemFlags = flags.filter((x) => x.section !== 'pitfall');
    if (itemFlags.length) {
      const before = checkTopic(it).length;
      const snapshot = JSON.stringify(it);
      const fixes = await ask(`${REPAIR}\n\nTOPIC: ${pointById[it.id].name} (${pointById[it.id].stage} ${pointById[it.id].grade})\nRule: ${(pointById[it.id].rule ?? []).join(' / ')}\nCONTEXT: ${JSON.stringify(brief(it))}\nFLAGS: ${JSON.stringify(itemFlags)}`, 0.2);
      if (Array.isArray(fixes)) {
        for (const f of fixes) if (f?.item) applyFix(it, f);
        let broke = false;
        try { broke = checkTopic(it).length > before; } catch { broke = true; }
        if (broke) { Object.assign(it, JSON.parse(snapshot)); console.log(`↩ ${it.id} 수정이 구조 검사를 깨서 되돌림`); }
        else fixed++;
      }
    }
    saveItem(it);
  });
  console.log(`수정 적용 ${fixed}개 주제`);
  targets = failing;
}
writeFileSync(join(here, 'out', 'loop-remaining.json'), JSON.stringify(remaining, null, 1));
console.log(remaining.length ? `\n남은 오류 지적 ${remaining.length}건 → out/loop-remaining.json` : '\n모든 주제 통과');
process.exit(remaining.length ? 1 : 0);
