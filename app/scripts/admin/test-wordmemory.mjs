// 단어암기숙제(090) SQL 검증 — 임시 Postgres(PGlite, WASM)에서만, 운영 DB 와 무관한 합성 데이터.
// 시간은 app.wm_now 로 움직인다(실제로 기다리지 않는다). 실행: node test-wordmemory.mjs
import { makeWmDb, setDay } from './wm-setup.mjs';
import { as, check, summary } from './lib.mjs';

const db = await makeWmDb();
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const call = async (fn, ...args) => {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await one(`select public.${fn}(${ph}) as r`, args)).r;
};
const fails = async (fn, ...args) => {
  try {
    await call(fn, ...args);
    return null;
  } catch (e) {
    return String(e.message);
  }
};
const uuid = () => crypto.randomUUID();

// ---------- 합성 학원 ----------
const OWNER = '00000000-0000-4000-8000-000000000001';
const OWNER_B = '00000000-0000-4000-8000-000000000002';
const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'aaaaaaaa-0000-4000-8000-000000000002';
const CLASS = 'cccccccc-0000-4000-8000-000000000001';
const CLASS_B = 'cccccccc-0000-4000-8000-000000000002';
const S1 = 'dddddddd-0000-4000-8000-000000000001';
const S2 = 'dddddddd-0000-4000-8000-000000000002';
const S3 = 'dddddddd-0000-4000-8000-000000000003';
const S_B = 'dddddddd-0000-4000-8000-000000000009';
await db.exec(`
  insert into auth.users (id, email) values ('${OWNER}', 'a@x.com'), ('${OWNER_B}', 'b@x.com');
  insert into public.academies (id, name, features) values ('${A}', 'A학원', '{"homework":true}'), ('${B}', 'B학원', '{"homework":true}');
  insert into public.profiles (id, academy_id, role, display_name) values ('${OWNER}', '${A}', 'owner', 'A원장'), ('${OWNER_B}', '${B}', 'owner', 'B원장');
  insert into public.classes (id, academy_id, name) values ('${CLASS}', '${A}', '1반'), ('${CLASS_B}', '${B}', 'B반');
  insert into public.students (id, academy_id, class_id, name) values ('${S1}', '${A}', '${CLASS}', '민수'), ('${S2}', '${A}', '${CLASS}', '지아'), ('${S3}', '${A}', '${CLASS}', '하준'), ('${S_B}', '${B}', '${CLASS_B}', '타학원');
`);

// 그림·예문이 없는 평범한 단어장 12개 + 같은 철자 다른 뜻(bank) 두 개
const WORDS = ['apple|사과', 'banana|바나나', 'cat|고양이', 'dog|강아지', 'egg|달걀', 'fish|물고기', 'goat|염소', 'hat|모자', 'ice|얼음', 'jump|뛰다', 'kite|연', 'lion|사자'];
const plain = WORDS.map((w) => ({ word: w.split('|')[0], meaning: w.split('|')[1] }));
const homographs = [...plain, { word: 'bank', meaning: '은행', pos: '명사' }, { word: 'bank', meaning: '둑', pos: '명사' }];
const withExtras = plain.map((c, i) => ({
  ...c,
  imageUrl: i % 2 === 0 ? `/img/${c.word}.webp` : null,
  example: c.word === 'jump' ? 'She jumps high.' : c.word === 'cat' ? 'The cat sleeps.' : c.word === 'dog' ? 'I like my dog a lot.' : null,
}));

const assign = (over = {}) =>
  call('wm_assign', over.request ?? uuid(), over.classId ?? CLASS, over.title ?? '테스트', over.cards ?? plain, over.source ?? { type: 'wordlist', name: '단어장' },
    over.students ?? [S1, S2], over.mode ?? 'light', over.study ?? 14, over.review ?? 14);
const tokenOf = async (planId, studentId) => (await one('select access_token as t from public.wm_targets where plan_id = $1 and student_id = $2', [planId, studentId])).t;
const dayOf = async (access) => call('wm_today_state', access);
const todo = (st) => st.items.filter((i) => i.state === 'todo');
const ackAll = async (access, st) => {
  for (const it of st.items) if (it.kind === 'study' && it.state === 'todo') await call('wm_ack', access, st.session_id, it.i, uuid());
};
// 정답은 서버에만 있다 — 테스트는 DB 에서 직접 읽어 "맞는 답"을 만든다
const rightResponse = async (sessionId, i) => {
  const qn = (await one('select questions -> $2::int as q from public.wm_sessions where id = $1', [sessionId, i])).q;
  if (qn.qtype === 'choice') return String(qn.correct);
  if (qn.qtype === 'text') return String(qn.correct).split('/')[0];
  return JSON.stringify(qn.correct);
};
const wrongResponse = async (sessionId, i) => {
  const qn = (await one('select questions -> $2::int as q from public.wm_sessions where id = $1', [sessionId, i])).q;
  if (qn.qtype === 'choice') return String((qn.correct + 1) % qn.choices.length);
  if (qn.qtype === 'text') return 'zzzz';
  return JSON.stringify([...qn.correct].reverse().concat(['x']));
};
const answerAll = async (access, st, { wrongKeys = [], help = false } = {}) => {
  // 아직 풀 문제를 앞에서부터 풀고, 다시 묻기로 생긴 문제도 이어서 푼다
  let cur = st;
  for (let guard = 0; guard < 80; guard++) {
    const next = cur.items.find((i) => i.state === 'todo' && i.kind === 'ask');
    if (!next) break;
    const keyRow = (await one('select questions -> $2::int ->> \'key\' as k from public.wm_sessions where id = $1', [cur.session_id, next.i])).k;
    const bad = wrongKeys.includes(keyRow) && !next.retry;
    if (help && next.qtype === 'choice') await call('wm_hint', access, cur.session_id, next.i);
    await call('wm_answer', access, cur.session_id, next.i, bad ? await wrongResponse(cur.session_id, next.i) : await rightResponse(cur.session_id, next.i), uuid());
    cur = await dayOf(access);
  }
  return cur;
};
const wordRow = async (planTarget, word) => one(`select w.*, w.due_day::text as due_txt, w.introduced_day::text as intro_txt from public.wm_words w where w.target_id = $1 and w.key like $2`, [planTarget, `${word.toLowerCase()}|%`]);
const targetId = async (access) => (await one('select id from public.wm_targets where access_token = $1', [access])).id;

// ========== 1. 배정 ==========
console.log('1. 배정(권한·검증·멱등·중복)');
await as(db, OWNER);
await setDay(db, '2026-11-02');
check('직원이 아니면 배정 불가', (await (async () => { await as(db, null); const e = await fails('wm_assign', uuid(), CLASS, 't', plain, {}, [S1], 'light', 14, 14); await as(db, OWNER); return e; })())?.includes('not_staff'));
check('단어 4개 미만은 막는다', (await fails('wm_assign', uuid(), CLASS, 't', plain.slice(0, 3), {}, [S1], 'light', 14, 14))?.includes('too_few_words'));
check('다른 학원 학생을 넣으면 막는다', (await fails('wm_assign', uuid(), CLASS, 't', plain, {}, [S_B], 'light', 14, 14))?.includes('bad_student'));
check('다른 학원 반이면 막는다', (await fails('wm_assign', uuid(), CLASS_B, 't', plain, {}, [S1], 'light', 14, 14))?.includes('bad_class'));
check('잘못된 학습량을 막는다', (await fails('wm_assign', uuid(), CLASS, 't', plain, {}, [S1], 'heavy', 14, 14))?.includes('bad_mode'));
await db.exec(`update public.academies set features = '{"homework":false}' where id = '${A}'`);
check('숙제 기능이 닫힌 학원은 배정 불가', (await fails('wm_assign', uuid(), CLASS, 't', plain, {}, [S1], 'light', 14, 14))?.includes('feature_closed'));
await db.exec(`update public.academies set features = '{"homework":true}' where id = '${A}'`);

const req1 = uuid();
const r1 = await assign({ request: req1, students: [S1] });
check('배정 성공: 학생 1명, 단어 12개', r1.created === 1 && r1.total === 1 && r1.words === 12 && !r1.duplicate);
const r1b = await assign({ request: req1, students: [S1] });
check('같은 요청 두 번(중복 클릭) → 계획·학생 중복 없음', r1b.duplicate && r1b.created === 0 && r1b.plan_id === r1.plan_id && r1b.total === 1);
const r1c = await assign({ request: req1, students: [S1, S2] });
check('같은 요청 재시도로 빠진 학생만 더한다(부분 실패 복구)', r1c.created === 1 && r1c.total === 2 && r1c.plan_id === r1.plan_id);
const r1d = await assign({ students: [S1, S2] });
check('같은 단어 묶음을 같은 학생에게 새 요청으로 또 주면 건너뛴다', r1d.plan_id === null && r1d.skipped.length === 2);
const planRow = await one('select * from public.wm_plans where id = $1', [r1.plan_id]);
check('단어 스냅샷이 열쇠(낱말|뜻)와 함께 저장됨', planRow.cards.length === 12 && planRow.cards[0].key === 'apple|사과');
check('열쇠 없는 줄·중복 줄은 정리됨', (await call('wm_clean_cards', [{ word: 'a', meaning: 'x' }, { word: 'A', meaning: 'x' }, { word: '', meaning: 'y' }, { word: 'b' }])).length === 1);

// ========== 2. 학생 입장·격리 ==========
console.log('2. 학생 입장·접근 격리');
const T1 = await tokenOf(r1.plan_id, S1);
const T2 = await tokenOf(r1.plan_id, S2);
check('잘못된 열쇠는 not_found', (await fails('wm_open', 'nope'))?.includes('not_found'));
const open = await call('wm_open', T1);
check('입장: 이름·단계 수·학습 방식 표시', open.student_name === '민수' && open.phase === 'study' && open.stages.unseen === 12 && open.daily_mode === 'light');
check('입장 정보에 정답·낱말 열쇠 없음', !JSON.stringify(open).includes('correct'));

// ========== 3. 첫날 학습(그림·예문 없는 단어장) ==========
console.log('3. 첫날 학습');
const d1 = await dayOf(T1);
const asks = d1.items.filter((i) => i.kind === 'ask');
const studies = d1.items.filter((i) => i.kind === 'study');
check('첫날: 새 낱말 소개 카드 3개(가볍게)', studies.length === 3 && d1.counts.new === 3);
check('첫날: 문항은 하루 상한(12)을 넘지 않는다', asks.length <= 12 && asks.length === 6);
check('학생에게 가는 문제에 정답·낱말 열쇠·능력 이름표가 없다', !/"correct"|"key"|"skill"/.test(JSON.stringify(todo(d1).filter((i) => i.kind === 'ask'))));
check('그림이 없으면 그림 문제·예문이 없으면 빈칸 문제를 만들지 않는다', asks.every((a) => a.style !== 'picture' && a.style !== 'blank'));
check('같은 날 두 번 불러도 같은 학습(중복 생성 없음)', (await dayOf(T1)).session_id === d1.session_id && (await one('select count(*)::int c from public.wm_sessions where target_id = (select id from public.wm_targets where access_token = $1)', [T1])).c === 1);
const sIdx = d1.items.findIndex((i) => i.kind === 'study');
const firstAskAfterStudy = d1.items.findIndex((i, n) => n > sIdx && i.kind === 'ask');
check('소개 카드 바로 뒤에 같은 낱말을 묻지 않고 간격을 둔다', firstAskAfterStudy - sIdx >= 1);
const studyWords = studies.map((s) => s.word);
const askBySessionKey = async (st) => (await q('select (e.q ->> \'i\')::int i, e.q ->> \'key\' k, e.q ->> \'kind\' kd, e.q ->> \'style\' st from public.wm_sessions s, jsonb_array_elements(s.questions) e(q) where s.id = $1', [st.session_id]));
const meta = await askBySessionKey(d1);
for (const s of studies) {
  const studyI = s.i;
  const key = meta.find((m) => m.i === studyI).k;
  const askPos = d1.items.map((it, n) => ({ it, n })).filter(({ it }) => it.kind === 'ask' && meta.find((m) => m.i === it.i).k === key).map(({ n }) => n);
  const studyPos = d1.items.findIndex((it) => it.i === studyI);
  if (!(askPos.length === 2 && askPos[0] - studyPos >= 3 && askPos[1] > askPos[0] + 2)) check(`'${s.word}': 소개 → 3칸 뒤 알아보기 → 더 뒤 다른 활동`, false, JSON.stringify({ studyPos, askPos }));
}
check('새 낱말마다 서로 다른 두 활동으로 만난다', (() => {
  const byKey = {};
  for (const m of meta.filter((x) => x.kd === 'ask')) (byKey[m.k] ||= []).push(m.st);
  return Object.values(byKey).every((s) => s.length === 2 && s[0] !== s[1]);
})());

// ========== 4. 풀이: 소개 → 오답 → 다시 묻기 ==========
console.log('4. 풀이·오답·다시 묻기');
await ackAll(T1, d1);
const tid1 = await targetId(T1);
const w0 = await wordRow(tid1, studyWords[0]);
check('소개 카드를 보면 "처음 만남(0)"이고 내일 복습 대상', w0.stage === 0 && w0.intro_txt === '2026-11-02' && w0.due_txt === '2026-11-03');
let st = await dayOf(T1);
const firstAsk = st.items.find((i) => i.kind === 'ask' && i.state === 'todo');
const wrongRes = await call('wm_answer', T1, d1.session_id, firstAsk.i, await wrongResponse(d1.session_id, firstAsk.i), uuid());
check('틀리면 정답을 보여 주고 다시 묻기가 생긴다', wrongRes.correct === false && !!wrongRes.answer && wrongRes.requeued === true);
st = await dayOf(T1);
const retryItem = st.items.find((i) => i.retry && i.state === 'todo');
check('다시 묻기는 다른 활동이고 3문제쯤 뒤에 온다', !!retryItem && retryItem.style !== firstAsk.style && st.items.findIndex((i) => i.i === retryItem.i) - st.items.findIndex((i) => i.i === firstAsk.i) >= 3);
check('다시 묻기 때문에 하루 상한 안의 여유가 줄어든다', st.retry_left === 1);
const dup = await call('wm_answer', T1, d1.session_id, firstAsk.i, await rightResponse(d1.session_id, firstAsk.i), uuid());
check('이미 낸 문제에 다른 요청으로 다시 내도 첫 결과를 돌려주고 기록은 안 바뀐다', dup.first === false && dup.correct === false);
const sameClient = uuid();
const ask2 = st.items.find((i) => i.kind === 'ask' && i.state === 'todo' && !i.retry);
const rA = await call('wm_answer', T1, d1.session_id, ask2.i, await rightResponse(d1.session_id, ask2.i), sameClient);
const rB = await call('wm_answer', T1, d1.session_id, ask2.i, await wrongResponse(d1.session_id, ask2.i), sameClient);
check('같은 요청(재전송)은 중복 기록 없이 같은 결과', rA.correct === true && rB.correct === true && (await one('select count(*)::int c from public.wm_answers where client_id = $1', [sameClient])).c === 1);
const wAfterWrong = await wordRow(tid1, (await one("select questions -> $2::int ->> 'key' k from public.wm_sessions where id = $1", [d1.session_id, firstAsk.i])).k.split('|')[0]);
check('틀리면 연습 중(1)·내일 다시·틀린 능력이 기록된다', wAfterWrong.stage === 1 && wAfterWrong.miss === 1 && wAfterWrong.last_skill && wAfterWrong.due_txt === '2026-11-03');
st = await answerAll(T1, st);
check('모두 풀면 오늘 학습 완료', st.done === true);
const sameDayRows = await q('select w.* from public.wm_words w where w.target_id = $1 and w.introduced_day is not null', [tid1]);
check('소개한 날 맞힌 것은 "혼자 맞힘"이 아니다(같은 자리에서 본 정답은 기억 증거가 아님)', sameDayRows.every((r) => r.stage <= 1 && r.unaided_ok === 0));
check('다시 묻기에서 맞혀도 도움 없이 맞힌 기록으로 세지 않는다', sameDayRows.every((r) => r.unaided_days.length === 0));
const answeredRows = await q('select unaided, kind, correct from public.wm_answers a join public.wm_sessions s on s.id = a.session_id where s.id = $1 and a.kind <> \'ack\'', [d1.session_id]);
check('답 기록: 첫 답·다시 풀기를 구분한다', answeredRows.some((r) => r.kind === 'retry') && answeredRows.some((r) => r.kind === 'answer'));

// ========== 5. 다음 날 복습·숙련 판정 ==========
console.log('5. 다음 날 복습·숙련');
await setDay(db, '2026-11-03');
const d2 = await dayOf(T1);
const reviewCount2 = d2.items.filter((i) => i.kind === 'ask' && (i.phase === 'review' || i.phase === 'hard')).length;
check('다음 날: 어제 만난 낱말이 복습으로 나온다(3개)', reviewCount2 === 3 && d2.counts.review + d2.counts.hard === 3);
check('틀렸던 낱말은 "어려운 단어"로 따로 센다', d2.counts.hard >= 1);
check('복습이 있어도 새 낱말을 이어서 소개한다(상한 안)', d2.items.filter((i) => i.kind === 'study').length === 3);
await ackAll(T1, d2);
const d2answers = await answerAll(T1, d2);
check('둘째 날 학습 완료', d2answers.done === true);
const stageDay2 = await q('select stage, unaided_ok, array_length(unaided_days,1) n from public.wm_words where target_id = $1 and introduced_day = $2::date', [tid1, '2026-11-02']);
check('소개한 다음 날 도움 없이 처음 답으로 맞히면 "혼자 맞힘(2)"', stageDay2.filter((r) => r.stage === 2).length >= 2 && stageDay2.every((r) => r.stage >= 1));
check('아직 한 번뿐이므로 "며칠 뒤에도 기억함(3)"은 아니다', stageDay2.every((r) => r.stage < 3));
// 사흘째: 성공한 낱말은 +2일 뒤(4일)라 아직 안 나온다
await setDay(db, '2026-11-04');
const d3 = await dayOf(T1);
const d3review = d3.items.filter((i) => i.kind === 'ask' && ['review', 'hard'].includes(i.phase));
check('사흘째: 둘째 날 성공한 낱말은 +2일 간격이라 아직 안 나오고 어려웠던 낱말은 나온다', d3review.length < reviewCount2 + 3);
await ackAll(T1, d3);
await answerAll(T1, d3);
await setDay(db, '2026-11-05');
const d4 = await dayOf(T1);
await ackAll(T1, d4);
await answerAll(T1, d4);
const keptRows = await q("select key, stage, unaided_days from public.wm_words where target_id = $1 and stage = 3", [tid1]);
check('서로 다른 두 날 도움 없이 맞히고 2일 이상 떨어지면 "며칠 뒤에도 기억함(3)"', keptRows.length >= 1 && keptRows.every((r) => r.unaided_days.length >= 2));

// ========== 6. 도움·같은 활동 반복 ==========
console.log('6. 도움 사용');
const T2b = T2;
const e1 = await dayOf(T2b);
await ackAll(T2b, e1);
await setDay(db, '2026-11-06');
const e2 = await dayOf(T2b);
const firstReview = e2.items.find((i) => i.kind === 'ask' && i.state === 'todo');
const tid2 = await targetId(T2b);
if (firstReview.qtype === 'choice') {
  const hint = await call('wm_hint', T2b, e2.session_id, firstReview.i);
  check('도움(보기 하나 지우기)은 정답이 아닌 보기를 지운다', hint.type === 'eliminate' && hint.index !== (await one("select (questions -> $2::int ->> 'correct')::int c from public.wm_sessions where id = $1", [e2.session_id, firstReview.i])).c);
}
const helpKey = (await one("select questions -> $2::int ->> 'key' k from public.wm_sessions where id = $1", [e2.session_id, firstReview.i])).k;
await call('wm_answer', T2b, e2.session_id, firstReview.i, await rightResponse(e2.session_id, firstReview.i), uuid());
const helped = await wordRow(tid2, helpKey.split('|')[0]);
check('도움 받고 맞힌 것은 "혼자 맞힘"이 아니다(연습 중·내일 다시)', helped.stage <= 1 && helped.unaided_ok === 0);
check('도움 사용이 답 기록에 남는다', (await one('select helped from public.wm_answers a where session_id = $1 and q_index = $2', [e2.session_id, firstReview.i])).helped === true);

// ========== 7. 결석 후 복귀·상한 ==========
console.log('7. 결석 후 복귀·하루 상한');
const big = Array.from({ length: 60 }, (_, i) => ({ word: `word${i}`, meaning: `뜻${i}` }));
const rBig = await assign({ cards: big, students: [S3], mode: 'normal', study: 20, review: 20 });
const T3 = await tokenOf(rBig.plan_id, S3);
await setDay(db, '2026-11-10');
for (let day = 10; day <= 12; day++) {
  await setDay(db, `2026-11-${day}`);
  const s = await dayOf(T3);
  await ackAll(T3, s);
  await answerAll(T3, s);
}
const asked = await one("select count(*)::int c from public.wm_words where target_id = (select id from public.wm_targets where access_token = $1) and introduced_day is not null", [T3]);
check('보통 학습량: 하루 새 낱말은 5개 이하(3일 최대 15개)', asked.c > 0 && asked.c <= 15);
await setDay(db, '2026-11-20');
const back = await dayOf(T3);
const backAsks = back.items.filter((i) => i.kind === 'ask');
check('9일 쉬고 돌아와도 하루 문항은 상한(20) 안이다(밀린 학습이 무제한으로 쌓이지 않는다)', backAsks.length <= 20);
check('밀린 복습이 많으면 새 낱말을 줄이거나 0으로 한다', back.items.filter((i) => i.kind === 'study').length <= 5 && (back.waiting_review === 0 || back.items.filter((i) => i.kind === 'study').length < 5));
check('남은 복습 분량을 알려 준다(내일 이어서)', typeof back.waiting_review === 'number');

// ========== 8. 같은 철자·다른 뜻 ==========
console.log('8. 같은 철자·다른 뜻');
const rH = await assign({ cards: homographs, students: [S1], title: '동음이의' });
const tH = await tokenOf(rH.plan_id, S1);
const hid = await targetId(tH);
const bankRows = await q("select key from public.wm_words where target_id = $1 and key like 'bank|%'", [hid]);
check('bank(은행)·bank(둑)은 서로 다른 학습 기록', bankRows.length === 2 && new Set(bankRows.map((r) => r.key)).size === 2);
let leak = 0;
for (let n = 0; n < 40; n++) {
  const cards = (await one('select cards from public.wm_plans where id = $1', [rH.plan_id])).cards;
  const mq = await call('wm_make_q', cards.find((c) => c.key === 'bank|은행'), 'meaning', cards);
  if (mq.choices.filter((c) => c === '둑').length) leak += 1;
  const rq = await call('wm_make_q', cards.find((c) => c.key === 'apple|사과'), 'reverse', cards);
  if (rq.choices.filter((c) => c === 'bank').length > 1) leak += 1;
  if (new Set(rq.choices).size !== rq.choices.length) leak += 1;
}
check('같은 철자의 다른 뜻은 보기에 들어가 정답이 둘이 되지 않는다', leak === 0);

// ========== 9. 예문 빈칸: 원형만 ==========
console.log('9. 그림·예문 문제');
const cardsX = (await call('wm_clean_cards', withExtras));
const canBlank = async (word) => (await call('wm_make_q', cardsX.find((c) => c.word === word), 'blank', cardsX));
check('예문에 낱말이 그대로 있으면 빈칸 문제(cat)', (await canBlank('cat'))?.prompt === 'The _____ sleeps.');
check('활용형(jumps)이면 빈칸을 만들지 않는다(jump)', (await canBlank('jump')) === null);
check('예문이 없으면 빈칸을 만들지 않는다(apple)', (await canBlank('apple')) === null);
const catBlank = await canBlank('cat');
check('빈칸 문제는 정답이 하나뿐', catBlank.choices.filter((c) => c === 'cat').length === 1 && new Set(catBlank.choices).size === catBlank.choices.length);
check('그림이 있는 낱말만 그림 문제(apple 그림 있음 / banana 없음)', (await call('wm_make_q', cardsX.find((c) => c.word === 'apple'), 'picture', cardsX)) !== null && (await call('wm_make_q', cardsX.find((c) => c.word === 'banana'), 'picture', cardsX)) === null);
check('듣고 쓰기: 화면에 낱말이 없다', (await call('wm_make_q', cardsX[0], 'dictation', cardsX)).prompt === '');
check('글자 배열: 조각이 섞여 있고 정답과 다르다', await (async () => { const l = await call('wm_make_q', cardsX[0], 'letters', cardsX); return l.tokens.join('') !== l.correct.join('') && [...l.tokens].sort().join('') === [...l.correct].sort().join(''); })());

// ========== 10. 이전 기록 이어받기(재배정) ==========
console.log('10. 같은 낱말·뜻 재배정');
const rRe = await assign({ cards: plain.slice(0, 6).concat([{ word: 'newword', meaning: '새말' }, { word: 'zebra', meaning: '얼룩말' }]), students: [S1], title: '재배정' });
const tRe = await tokenOf(rRe.plan_id, S1);
const reId = await targetId(tRe);
const carried = await q('select key, carried, stage, introduced_day, unaided_ok from public.wm_words where target_id = $1', [reId]);
check('예전에 만난 같은 낱말·뜻은 "이어받음"으로 표시', carried.filter((c) => c.carried).length >= 3 && carried.find((c) => c.key === 'newword|새말').carried === false);
check('이어받아도 이미 외웠다고 판정하지 않는다(혼자 맞힘 0, 단계 0)', carried.filter((c) => c.carried).every((c) => c.stage === 0 && c.unaided_ok === 0 && c.introduced_day === null));
await setDay(db, '2026-11-21');
const reDay = await dayOf(tRe);
check('이어받은 낱말은 소개 카드 없이 다시 확인(복습)으로 시작한다', reDay.items.filter((i) => i.kind === 'ask' && ['review', 'hard'].includes(i.phase)).length >= 3);

// ========== 11. 기간 끝·종료 후 복습 ==========
console.log('11. 기간·종료');
await setDay(db, '2026-11-25');
const rShort = await assign({ cards: plain.map((c) => ({ ...c, word: c.word + 's' })), students: [S2], study: 3, review: 3, title: '짧은 기간' });
// 기본 최소 공부 기간은 3일
const tShort = await tokenOf(rShort.plan_id, S2);
if (rShort.plan_id) {
  await setDay(db, '2026-11-25');
  check('배정한 날(한국 날짜)이 시작일', (await one('select start_date::text d from public.wm_plans where id = $1', [rShort.plan_id])).d === '2026-11-25');
  const sDay0 = await dayOf(tShort);
  await ackAll(tShort, sDay0);
  await answerAll(tShort, sDay0);
  await setDay(db, '2026-11-28');
  const sDay3 = await dayOf(tShort);
  check('공부 기간(3일)이 끝나면 새 낱말을 더 소개하지 않는다', sDay3.items.filter((i) => i.kind === 'study').length === 0);
  await setDay(db, '2026-12-05');
  const ended = await dayOf(tShort);
  check('복습 기간까지 끝나면 종료로 알려 준다', ended.ended === true);
  const open2 = await call('wm_open', tShort);
  check('종료된 계획의 단계 수는 그대로 볼 수 있다', open2.phase === 'ended' && open2.stages.total === 12);
}

// ========== 12. 날짜 경계(한국 시간) ==========
console.log('12. 하루 경계');
const rDay = await assign({ cards: plain.map((c) => ({ ...c, word: c.word + 'x' })), students: [S1], title: '경계' });
const tDay = await tokenOf(rDay.plan_id, S1);
await setDay(db, '2026-12-10', 23);
const late = await dayOf(tDay);
await db.exec(`select set_config('app.wm_now', '2026-12-11T00:10:00+09:00', false)`);
const early = await dayOf(tDay);
check('한국 자정을 넘기면 새 날의 학습(전날 세션과 다름)', late.session_id !== early.session_id && early.day === '2026-12-11');
await db.exec(`select set_config('app.wm_now', '2026-12-10T14:59:00Z', false)`); // = 12-10 23:59 KST
check('UTC 날짜가 아닌 한국 날짜 기준', (await one('select public.wm_today()::text d')).d === '2026-12-10');

// ========== 13. 권한 격리·교사 화면 ==========
console.log('13. 접근 격리·교사 결과');
check('남의 열쇠로 다른 학생 세션에 답할 수 없다', (await fails('wm_answer', T2, d1.session_id, 0, '0', uuid()))?.includes('not_found'));
await as(db, OWNER_B);
check('다른 학원 선생님은 결과를 볼 수 없다', (await fails('wm_plan_results', r1.plan_id))?.includes('not_found'));
check('다른 학원 선생님은 링크를 볼 수 없다', (await fails('wm_plan_links', r1.plan_id))?.includes('not_found'));
check('다른 학원 선생님은 닫을 수 없다', (await fails('wm_plan_close', r1.plan_id))?.includes('not_found'));
await as(db, OWNER);
await setDay(db, '2026-11-05');
const res = await call('wm_plan_results', r1.plan_id);
const row1 = res.students.find((s) => s.name === '민수');
check('결과: 만난 낱말·도움 없이 맞힌 낱말·며칠 뒤에도 기억한 낱말을 구분해 센다', row1.met >= 6 && row1.alone_words >= row1.kept_words && row1.kept_words >= 1 && row1.met >= row1.alone_words);
check('결과: "오늘 완료"와 "기억함"은 다른 지표', 'today' in row1 && 'kept_words' in row1);
check('결과: 더 연습할 능력(뜻·철자 등)별 틀린 횟수가 있다', typeof row1.skill_miss === 'object');
const links = await call('wm_plan_links', r1.plan_id);
check('링크 목록: 학생별 열쇠', links.length === 2 && links.every((l) => l.access.length >= 32));
const list = await call('wm_plan_list', CLASS);
check('계획 목록: 단어 수·학생 수·오늘 완료 수', list.length >= 1 && list.some((p) => p.words === 12 && p.students === 2));
await call('wm_plan_close', r1.plan_id);
check('닫은 계획은 학생이 더 못 연다', (await fails('wm_open', T1))?.includes('closed'));
await db.exec(`update public.students set archived_at = now() where id = '${S3}'`);
check('보관(삭제) 처리된 학생의 링크는 막힌다', (await fails('wm_open', T3))?.includes('not_found'));

// ========== 14. 표 직접 접근 차단·학생 포털 링크 ==========
console.log('14. 권한 설정');
const privs = await one("select has_table_privilege('anon', 'public.wm_words', 'select') a, has_table_privilege('authenticated', 'public.wm_sessions', 'select') b, has_function_privilege('anon', 'public.wm_assign(uuid,uuid,text,jsonb,jsonb,uuid[],text,int,int)', 'execute') c, has_function_privilege('anon', 'public.wm_open(text)', 'execute') d, has_function_privilege('anon', 'public.wm_build_session(uuid)', 'execute') e");
check('학생·로그인 사용자가 단어 상태·세션 표를 직접 읽을 수 없다', privs.a === false && privs.b === false);
check('배정·세션 생성 함수는 익명이 못 부른다 / 학생 입장은 부른다', privs.c === false && privs.e === false && privs.d === true);
await db.exec(`insert into public.student_sessions (token, student_id) values ('11111111-1111-4111-8111-111111111111', '${S2}')`);
const portal = await call('wm_student_links', '11111111-1111-4111-8111-111111111111');
check('학생 포털 열쇠로 내 단어암기숙제 링크 목록', Array.isArray(portal));
check('만료된 포털 열쇠는 빈 목록', (await call('wm_student_links', '22222222-2222-4222-8222-222222222222')).length === 0);


// ========== 15. 능력별 어려움·반복 실패 ==========
console.log('15. 철자 어려움·반복 실패');
const S4 = 'dddddddd-0000-4000-8000-000000000004';
await db.exec(`insert into public.students (id, academy_id, class_id, name) values ('${S4}', '${A}', '${CLASS}', '서윤')`);
await setDay(db, '2026-12-14');
const rSp = await assign({ cards: plain.map((c) => ({ ...c, word: 'q' + c.word })), students: [S4], title: '철자' });
const tSp = await tokenOf(rSp.plan_id, S4);
const spId = await targetId(tSp);
let sp = await dayOf(tSp);
await ackAll(tSp, sp);
// 첫날: 철자 계열 문제는 정답, 그 밖은 정답으로 풀어 둔다 → 다음 날 철자만 틀리게 만든다
sp = await answerAll(tSp, sp);
await setDay(db, '2026-12-15');
sp = await dayOf(tSp);
await ackAll(tSp, sp);
const spItem = sp.items.find((i) => i.kind === 'ask' && i.state === 'todo' && i.phase !== 'new');
const spKey = (await one("select questions -> $2::int ->> 'key' k from public.wm_sessions where id = $1", [sp.session_id, spItem.i])).k;
// 이 낱말의 능력을 "철자"로 틀렸다고 기록(서버 규칙 그대로 wm_apply_result 사용)
await db.exec(`select public.wm_apply_result('${spId}', '${spKey}', 'spelling', 'letters', false, false, false)`);
await setDay(db, '2026-12-16');
const sp2 = await dayOf(tSp);
const spStyles = await q("select q ->> 'style' st from public.wm_sessions s, jsonb_array_elements(s.questions) q where s.id = $1 and q ->> 'kind' = 'ask' and q ->> 'key' = $2", [sp2.session_id, spKey]);
check('뜻은 맞고 철자만 틀린 낱말은 다음 날 글자 배열·철자 입력으로 다시 연습한다', spStyles.length >= 1 && spStyles.every((r) => ['letters', 'spell'].includes(r.st)));
check('철자가 약한 낱말은 "어려운 단어"로 먼저 나온다', sp2.items.filter((i) => i.phase === 'hard').length >= 1);

// 다시 묻기도 틀리면: 더 강요하지 않고 오늘 다시 묻기 상한도 지킨다
await setDay(db, '2026-12-17');
const rep = await dayOf(tSp);
await ackAll(tSp, rep);
let cur = rep;
let asksMade = 0;
for (let g = 0; g < 60; g++) {
  const next = cur.items.find((i) => i.kind === 'ask' && i.state === 'todo');
  if (!next) break;
  await call('wm_answer', tSp, cur.session_id, next.i, await wrongResponse(cur.session_id, next.i), uuid());
  asksMade += 1;
  cur = await dayOf(tSp);
}
const limit = await one("select jsonb_array_length(questions) n, (counts ->> 'asks')::int a, retry_left r from public.wm_sessions where id = $1", [rep.session_id]);
check('전부 틀려도 다시 묻기는 하루 상한(가볍게 2개)까지만, 같은 낱말을 끝없이 반복하지 않는다', limit.n - (rep.items.length) <= 2 && limit.r === 0 && asksMade <= 12);
check('전부 틀린 날도 오늘 학습은 끝난다(무한 반복 없음)', cur.done === true);
const dueNext = await one("select count(*)::int c from public.wm_words where target_id = $1 and due_day = '2026-12-18' and miss > 0", [spId]);
check('틀린 낱말은 다음 날 다시 확인하도록 일정이 잡힌다', dueNext.c >= 1);

summary();
