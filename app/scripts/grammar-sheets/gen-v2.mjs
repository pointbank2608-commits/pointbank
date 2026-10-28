// 문법 워크북 v2 문항 생성: 주제마다 A 세트 추가분 + B 세트 전체를 Gemini 로 만들고 정적 검사를 통과시킨다.
//   node scripts/grammar-sheets/gen-v2.mjs [id,id,...]   (id 가 없으면 B 세트가 아직 없는 모든 주제)
// 결과는 bank/*.json 에 바로 합쳐 쓴다(주제 하나가 끝날 때마다 저장). 독립 검수·수정은 loop-v2.mjs.
import { ask, allItems, checkTopic, COUNT, loadBank, pointById, pool, saveItem, strip } from './v2lib.mjs';

const bank = loadBank();
const only = process.argv[2]?.split(',');
const targets = allItems(bank).filter((it) => (only ? only.includes(it.id) : !it.b));
const LEVEL = { elementary: '한국 초등학생(영어 처음~초급)', middle: '한국 중학생', high: '한국 고등학생', pos: '한국 초·중학생(품사 개념)', tense: '한국 중학생(시제)', forms: '한국 중학생(문장 형식)' };

const RULES = `You write practice items for a printable English-grammar worksheet used by teachers in Korea.
Hard rules (a strict independent reviewer will check every item):
- Every English sentence must be natural, correct and level-appropriate. Use only vocabulary and grammar suitable for the learner level, plus the target grammar. Do not test other grammar points.
- choose: "p" is ONE sentence with exactly one "____" gap; "c" has 2 or 3 options; EXACTLY ONE option is correct and every other option must be clearly wrong in that sentence for ANY reading. The sentence itself must contain a clue (time word, subject, number, Korean gloss in parentheses, question/answer pair...) that forces the one answer. "a" is the index of the correct option (vary it: some 0, some 1, some 2 when 3 options). "why" is one Korean line. Never write items where two options could both be acceptable (e.g. flat adverbs, British/American variants, articles with different meanings, "I like apple" flavour meanings, different but valid verb patterns).
- build: "en" is a short correct sentence (3-9 words) that SHOWS the target grammar, with the changing/target part wrapped in ** ** (1 or 2 spans, each a whole word or short phrase, e.g. "He like**s** pizza." or "She **has** a bike."); "ko" is its natural Korean translation. These sentences are also used for gap-fill and word-order exercises, so keep them unambiguous.
- correct: "w" is a wrong sentence that is wrong in EVERY plausible reading and wrong in exactly ONE spot, "r" is the fully corrected sentence (differs from w by one word/ending/order), "why" is one Korean line. Never use sentences that are merely unusual, or valid with another meaning. English only in w and r.
- say: "task" is what the pupil does (Korean, one line); "frame" is an English sentence frame with ____ blanks for speaking (no Korean inside). Practises the target grammar in a classroom pair talk.
- review: "ko" Korean sentence to translate, "cond" a Korean condition naming the grammar to use, "model" a correct English model answer (4+ words) that satisfies it. Within a set the 6 review items must differ in subject and verb.
- mission: Korean title, scene, and exactly 3 short Korean steps (English frames allowed inside the steps) for a safe, easy-to-run classroom pair activity.
- discover: "q" Korean question asking pupils to find the rule from the **bold** parts of the example sentences; "a" Korean model answer that is true for the examples.
- All items inside the output must be different from each other and from the "existing" items and the taught examples. Vary subjects, verbs and situations (school, family, food, sports, animals, hobbies for younger pupils).
- Korean must be natural. No emoji. JSON only.`;

function prompt(it) {
  const p = pointById[it.id];
  const add = { choose: COUNT.choose - it.choose.length, say: COUNT.say - it.say.length, review: COUNT.review - it.review.length, correct: Math.max(0, COUNT.correctA - it.correct.length), build: COUNT.buildExtra };
  return `${RULES}

TOPIC: ${p.name}
Learner level: ${LEVEL[p.stage] ?? p.stage} (${p.grade})
Rule: ${(p.rule ?? []).join(' / ') || p.explain}
Pattern: ${p.pattern ?? ''}
Taught examples: ${JSON.stringify(p.examples)}
Translations: ${JSON.stringify(p.translations)}
Taught pitfalls: ${JSON.stringify((p.pitfalls ?? []).map((x) => ({ wrong: strip(x.wrong), right: strip(x.right) })))}

EXISTING items of set A (do NOT repeat, match their style): ${JSON.stringify({ choose: it.choose, correct: it.correct, say: it.say, review: it.review })}

Return one JSON object:
{
 "aAdd": { "choose": [${add.choose} NEW choose items {p,c,a,why}], "build": [${add.build} NEW build items {en,ko}], "correct": [${add.correct} NEW items {w,r,why}], "say": [${add.say} NEW {task,frame}], "review": [${add.review} NEW {ko,cond,model}] },
 "b": { "discover": {q,a}, "choose": [${COUNT.choose} items], "build": [${COUNT.bBuild} items], "correct": [${COUNT.bCorrect} items], "say": [${COUNT.say} items], "mission": {title,scene,steps:[3]}, "review": [${COUNT.review} items] }
}
Set B is a completely separate second worksheet on the same grammar, with different sentences from set A (a pupil should be able to practise with A, then again with B).`;
}

let done = 0;
await pool(targets, Number(process.env.GEN_CONC ?? 10), async (it) => {
  const point = pointById[it.id];
  let feedback = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await ask(prompt(it) + feedback, 0.5);
    if (!res?.aAdd || !res?.b) { feedback = '\n\nThe previous answer was not valid JSON with aAdd and b. Return the full object again.'; continue; }
    const draft = JSON.parse(JSON.stringify(it));
    draft.choose = [...it.choose, ...(res.aAdd.choose ?? [])];
    draft.say = [...it.say, ...(res.aAdd.say ?? [])];
    draft.review = [...it.review, ...(res.aAdd.review ?? [])];
    draft.correct = [...it.correct, ...(res.aAdd.correct ?? [])];
    draft.buildExtra = res.aAdd.build ?? [];
    draft.b = res.b;
    const problems = checkTopic(draft);
    if (problems.length === 0) {
      Object.assign(it, draft);
      saveItem(it);
      done++;
      console.log(`✓ ${it.id} (${done}/${targets.length})`);
      return;
    }
    console.log(`… ${it.id} 시도 ${attempt}: ${problems.slice(0, 3).join(' | ')}`);
    feedback = `\n\nYour previous answer had these structural problems, fix them and return the full object again:\n- ${problems.join('\n- ')}`;
  }
  console.log(`✗ ${it.id} 3번 시도 후에도 실패`);
});
console.log(`\n완료 ${done}/${targets.length}`);
