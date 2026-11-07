import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { allItems, loadBank, points, strip } from '../grammar-sheets/v2lib.mjs';

const expanded = process.argv.includes('--expanded');
const bank = allItems(loadBank());
const byId = new Map(bank.map(topic => [topic.id, topic]));
assert.equal(byId.size, bank.length, 'Duplicate workbook topics');

const clean = text => strip(text).trim();
const canonical = text => clean(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

function toExample(point, sentence, index) {
  let chunks = sentence.split('**').map((text, part) => ({
    text: text.trim(),
    role: part % 2 ? '이 문법이 쓰인 부분' : '문장에서 함께 쓰인 말',
  })).filter(({ text }) => /[\p{L}\p{N}]/u.test(text));
  const phrase = clean(sentence);
  if (chunks.length < 2 || chunks.map(({ text }) => text).join(' ').replace(/[^\p{L}\p{N} ]+/gu, '').replace(/ +/g, ' ').trim()
      !== phrase.replace(/[^\p{L}\p{N} ]+/gu, '').replace(/ +/g, ' ').trim()) {
    const parts = phrase.match(/^(\S+)\s+(.+)$/u)?.slice(1) ?? [];
    chunks = parts.map((text, i) => ({ text, role: i === 0 ? '문장의 시작' : '이어지는 부분' }));
  }
  return {
    sentence: phrase,
    translation: clean(point.translations[index]),
    chunks,
    why: clean(point.explain),
  };
}

function buildLesson(point, topic, index) {
  const taught = new Set(point.examples.map(canonical));
  const examples = point.examples.map((sentence, i) => toExample(point, sentence, i))
    .filter(example => example.translation && example.chunks.length >= 2);
  const distinctExamples = [...new Map(examples.map(example => [canonical(example.sentence), example])).values()];
  assert.ok(distinctExamples.length >= 3, point.id + ': needs three examples with marked parts');

  const selectedStems = new Set();
  function chooseQuestion(pool, stage, position, fallback) {
    const question = pool.find(candidate => {
      const answer = candidate.c[candidate.a];
      const stem = canonical(candidate.p);
      return answer && clean(candidate.why) && !selectedStems.has(stem)
        && !taught.has(canonical(candidate.p.replace('____', () => answer)));
    });
    if (!question && fallback) return fallback();
    assert.ok(question, point.id + ': missing independent ' + stage + ' question');
    const { p, c, a, why } = question;
    const answer = clean(c[a]);
    selectedStems.add(canonical(p));
    taught.add(canonical(p.replace('____', () => answer)));
    const options = c.map((text, i) => ({
      id: 'option-' + (i + 1),
      text: clean(text),
      feedback: i === a ? clean(why) : '빈칸에는 ‘' + answer + '’가 알맞아요. ' + clean(why),
    }));
    const correct = options.splice(a, 1)[0];
    options.splice((index + position) % c.length, 0, correct);
    return {
      id: 'bank-' + stage,
      sentence: clean(p),
      prompt: '빈칸에 들어갈 말을 고르세요. 선택하면 이유를 볼 수 있어요.',
      options,
      correctOptionId: correct.id,
    };
  }

  const [first, second, repairExample] = distinctExamples;
  function buildExpandedQuestions() {
    const supplemental = point.id === 'lets' ? [
      { en: "Let's **count** the stars.", ko: '별을 세자.' },
      { en: "Let's **plant** some seeds.", ko: '씨앗을 좀 심자.' },
      { en: "Let's **call** Grandma.", ko: '할머니께 전화하자.' },
      { en: "Let's **check** the map.", ko: '지도를 확인하자.' },
    ] : point.id === 'date-months' ? [
      { en: "The concert is on **April fourth**.", ko: '콘서트는 4월 4일이에요.' },
      { en: "The book fair is on **May ninth**.", ko: '도서 박람회는 5월 9일이에요.' },
      { en: "The picnic is on **June eighth**.", ko: '소풍은 6월 8일이에요.' },
      { en: "The match is on **July seventh**.", ko: '경기는 7월 7일이에요.' },
      { en: "The parade is on **August tenth**.", ko: '퍼레이드는 8월 10일이에요.' },
      { en: "The camp begins on **October fifth**.", ko: '캠프는 10월 5일에 시작해요.' },
      { en: "The show is on **November sixth**.", ko: '공연은 11월 6일이에요.' },
      { en: "The race is on **December ninth**.", ko: '경주는 12월 9일이에요.' },
    ] : point.id === 'so' ? [
      { en: "The box was heavy, **so** we carried it together.", ko: '상자가 무거워서 우리는 함께 옮겼어요.' },
      { en: "The shop was closed, **so** we went home.", ko: '가게가 닫혀 있어서 우리는 집에 갔어요.' },
      { en: "It was getting dark, **so** I turned on a lamp.", ko: '어두워지고 있어서 나는 등을 켰어요.' },
      { en: "The floor was wet, **so** we walked slowly.", ko: '바닥이 젖어 있어서 우리는 천천히 걸었어요.' },
      { en: "My pencil broke, **so** I borrowed one.", ko: '연필이 부러져서 나는 하나를 빌렸어요.' },
      { en: "The train was full, **so** they waited for the next one.", ko: '기차가 꽉 차서 그들은 다음 기차를 기다렸어요.' },
      { en: "The music was loud, **so** he closed the door.", ko: '음악 소리가 커서 그는 문을 닫았어요.' },
      { en: "We had some time, **so** we played a game.", ko: '시간이 좀 있어서 우리는 게임을 했어요.' },
    ] : [];
    const typed = [...topic.b.build, ...(topic.buildExtra ?? []), ...supplemental].flatMap(({ en, ko }) => {
      const match = [...en.matchAll(/\*\*([^*]+)\*\*/gu)].reverse()
        .find(part => /^[A-Za-z][A-Za-z '’-]{0,59}$/.test(part[1].trim()));
      if (!match || !clean(ko)) return [];
      const sentence = clean(en.slice(0, match.index) + '____' + en.slice(match.index + match[0].length));
      return [{ complete: canonical(en), sentence, answer: clean(match[1]), translation: clean(ko) }];
    });
    const corrections = [...topic.b.correct, ...topic.correct];
    function correction(stage, position) {
      const question = corrections.find(({ w, r, why }) => clean(why) && !selectedStems.has(canonical(w))
        && !taught.has(canonical(r)) && !taught.has(canonical(w)));
      assert.ok(question, point.id + ': not enough distinct sentences for ' + stage + '-' + position);
      taught.add(canonical(question.r));
      taught.add(canonical(question.w));
      selectedStems.add(canonical(question.w));
      return {
        id: 'bank-' + stage + '-correction-' + position,
        sentence: clean(question.w),
        prompt: '이 문장을 어떻게 고치면 좋을까요?',
        options: [
          { id: 'original', text: clean(question.w), feedback: '이 문장은 ‘' + clean(question.r) + '’로 고쳐요. ' + clean(question.why) },
          { id: 'corrected', text: clean(question.r), feedback: clean(question.why) },
        ],
        correctOptionId: 'corrected',
      };
    }
    function written(stage, position) {
      const question = typed.find(candidate => !taught.has(candidate.complete) && !selectedStems.has(canonical(candidate.sentence)));
      if (!question) return null;
      taught.add(question.complete);
      selectedStems.add(canonical(question.sentence));
      return {
        id: 'bank-' + stage + '-' + position,
        sentence: question.sentence,
        prompt: '우리말과 같은 뜻이 되게 빈칸에 들어갈 영어만 쓰세요. ' + question.translation,
        options: [],
        answerText: question.answer,
        feedback: '예시 답은 ‘' + question.answer + '’예요. ' + clean(point.explain),
      };
    }
    const writtenOrCorrection = (stage, position) => written(stage, position) ?? correction(stage, position);
    const transferWritten = [writtenOrCorrection('transfer', 3), writtenOrCorrection('transfer', 4)];
    const delayedWritten = [writtenOrCorrection('delayed', 5), writtenOrCorrection('delayed', 6)];
    const choose = (pool, stage, count) => Array.from({ length: count },
      (_, i) => chooseQuestion(pool, stage + '-' + (i + 1), i, () => writtenOrCorrection(stage, i + 1)));
    const initialPool = [...topic.choose, ...topic.b.choose];
    const assessmentPool = [...topic.b.choose, ...topic.choose];
    const reasoning = choose(initialPool, 'reasoning', 3);
    const practice = choose(initialPool, 'practice', 9);
    const transfer = [...choose(assessmentPool, 'transfer', 2), ...transferWritten];
    const delayed = choose(assessmentPool, 'delayed', 4);
    delayed.splice(3, 0, delayedWritten[1]);
    delayed.splice(1, 0, delayedWritten[0]);
    const questions = [...reasoning, ...practice, ...transfer, ...delayed];
    assert.equal(new Set(questions.map(question => question.id)).size, 22, point.id + ': repeated item ID');
    for (const assessment of [transfer, delayed]) {
      assert.ok(assessment.filter(question => 'answerText' in question).length >= 2, point.id + ': missing written checks');
    }
    return { reasoning, practice, transfer, delayed };
  }

  const reasoning = chooseQuestion(topic.choose, 'first', 0);
  const practice = chooseQuestion(topic.choose, 'practice', 1);
  const transfer = chooseQuestion(topic.b.choose, 'transfer', 2);
  const delayed = chooseQuestion([...topic.b.choose].reverse(), 'delayed', 3);
  // The version 1 fields remain a valid fallback while the new server is rolling out.
  if (expanded) {
    taught.clear();
    for (const sentence of point.examples) taught.add(canonical(sentence));
    selectedStems.clear();
  }
  const adaptive = expanded ? buildExpandedQuestions() : undefined;
  const pitfall = point.pitfalls?.find(({ wrong }) => !topic.dropPitfalls?.includes(wrong));
  const details = [point.explain, ...(point.detail ?? []), ...(point.rule ?? [])].map(clean).filter(Boolean);
  return {
    goalId: 'curriculum-' + point.id,
    grammarIds: [point.id],
    version: expanded ? 2 : 1,
    title: point.name,
    objective: point.name + ' 문장을 읽고 문맥에 맞는 표현을 고를 수 있어요.',
    rule: [...new Set(details)].join(' '),
    boundary: pitfall
      ? '헷갈리기 쉬운 예문이에요. ' + clean(pitfall.wrong) + ' → ' + clean(pitfall.right) + ' ' + clean(pitfall.why)
      : clean(point.tip || topic.discover.a),
    examples: [first, second],
    reasoning,
    repair: { explanation: clean(topic.b.discover.a), example: repairExample, practice },
    transfer,
    delayed,
    ...(adaptive ? { adaptive } : {}),
  };
}

const failures = [];
const lessons = points.flatMap((point, index) => {
  const topic = byId.get(point.id);
  assert.ok(topic?.choose?.length && topic.b?.choose?.length, point.id + ': missing workbook questions');
  try { return [buildLesson(point, topic, index)]; }
  catch (error) { failures.push(error.message); return []; }
});
assert.equal(failures.length, 0, failures.join("\n"));
assert.equal(new Set(lessons.map(({ goalId }) => goalId)).size, points.length);

const target = new URL(expanded ? '../../../supabase/108_grammar_adaptive_content.sql' : '../../../supabase/106_grammar_curriculum_content.sql', import.meta.url);
const payload = lessons.map(lesson => JSON.stringify(lesson)).join(',\n');
assert.ok(!payload.includes('$grammar_curriculum_v1$'));
const sql = `-- Snapshot generated from the grammar catalog and worksheet bank.
-- Builder: node app/scripts/grammar/build-curriculum-homework.mjs
begin;

do $migration$
declare
  lesson jsonb;
  existing jsonb;
begin
  for lesson in select value from jsonb_array_elements($grammar_curriculum_v1$[
${payload}
]$grammar_curriculum_v1$::jsonb) loop
    insert into public.grammar_content_versions(goal_id, version, content)
      values (lesson->>'goalId', (lesson->>'version')::integer, lesson) on conflict do nothing;
    select content into strict existing from public.grammar_content_versions
      where goal_id = lesson->>'goalId' and version = (lesson->>'version')::integer;
    if existing is distinct from lesson then
      raise exception 'grammar_version_conflict: %/%', lesson->>'goalId', lesson->>'version';
    end if;
  end loop;
end $migration$;

commit;
`;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(lessons));
} else if (existsSync(target)) {
  assert.equal(readFileSync(target, 'utf8').replaceAll('\r\n', '\n'), sql,
    'The versioned snapshot differs. Publish a new content version for source changes.');
  console.log('Verified snapshot for ' + lessons.length + ' grammar topics.');
} else {
  writeFileSync(target, sql);
  console.log('Built versioned snapshot for ' + lessons.length + ' grammar topics.');
}
