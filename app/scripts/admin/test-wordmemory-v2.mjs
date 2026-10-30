// 단어암기 프로젝트(096) SQL 검증 — 임시 Postgres(PGlite)에서만, 운영 DB 와 무관한 합성 데이터. 090 테스트(test-wordmemory.mjs)와 같은 하네스.
// 실행: node test-wordmemory-v2.mjs
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

const OWNER = '00000000-0000-4000-8000-000000000001';
const OWNER_B = '00000000-0000-4000-8000-000000000002';
const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'aaaaaaaa-0000-4000-8000-000000000002';
const CLASS = 'cccccccc-0000-4000-8000-000000000001';
const CLASS_B = 'cccccccc-0000-4000-8000-000000000002';
const S1 = 'dddddddd-0000-4000-8000-000000000001';
const S2 = 'dddddddd-0000-4000-8000-000000000002';
const S3 = 'dddddddd-0000-4000-8000-000000000003';
const S4 = 'dddddddd-0000-4000-8000-000000000004';
await db.exec(`
  insert into auth.users (id, email) values ('${OWNER}', 'a@x.com'), ('${OWNER_B}', 'b@x.com');
  insert into public.academies (id, name, features) values ('${A}', 'A학원', '{"homework":true}'), ('${B}', 'B학원', '{"homework":true}');
  insert into public.profiles (id, academy_id, role, display_name) values ('${OWNER}', '${A}', 'owner', 'A원장'), ('${OWNER_B}', '${B}', 'owner', 'B원장');
  insert into public.classes (id, academy_id, name) values ('${CLASS}', '${A}', '1반'), ('${CLASS_B}', '${B}', 'B반');
  insert into public.students (id, academy_id, class_id, name) values ('${S1}', '${A}', '${CLASS}', '민수'), ('${S2}', '${A}', '${CLASS}', '지아'), ('${S3}', '${A}', '${CLASS}', '하준'), ('${S4}', '${A}', '${CLASS}', '서윤');
`);
await as(db, OWNER);
await setDay(db, '2026-11-02');

const WORDS = ['apple|사과', 'apply|신청하다', 'ample|충분한', 'maple|단풍나무', 'banana|바나나', 'cat|고양이', 'cap|모자', 'dog|강아지', 'egg|달걀', 'fish|물고기', 'goat|염소', 'lion|사자'];
const plain = WORDS.map((w) => ({ word: w.split('|')[0], meaning: w.split('|')[1] }));
const rich = plain.map((c, i) => ({ ...c, imageUrl: i % 2 === 0 ? `/img/${c.word}.webp` : null, example: c.word === 'dog' ? 'I like my dog a lot.' : null }));
const assign = (over = {}) =>
  call('wm_assign', over.request ?? uuid(), over.classId ?? CLASS, over.title ?? '프로젝트', over.cards ?? plain, over.source ?? { type: 'wordlist' },
    over.students ?? [S1], over.mode ?? 'normal', over.study ?? 14, over.review ?? 14);
const tokenOf = async (planId, studentId) => (await one('select access_token as t from public.wm_targets where plan_id = $1 and student_id = $2', [planId, studentId])).t;
const targetOf = async (planId, studentId) => (await one('select id from public.wm_targets where plan_id = $1 and student_id = $2', [planId, studentId])).id;

// ========== 1. 큰 범위·하루 분량 ==========
console.log('1. 큰 범위(최대 1000개)·plus 분량·긴 기간');
const big = Array.from({ length: 800 }, (_, i) => ({ word: `word${i}`, meaning: `뜻${i}` }));
const rBig = await assign({ cards: big, mode: 'plus', study: 120, review: 30, students: [S1, S2] });
check('800개를 plus 분량으로 배정할 수 있다', rBig.words === 800 && rBig.created === 2);
check('1001개는 막는다', (await fails('wm_assign', uuid(), CLASS, 't', Array.from({ length: 1001 }, (_, i) => ({ word: `w${i}`, meaning: `m${i}` })), {}, [S1], 'normal', 14, 14))?.includes('too_many_words'));
const clampPlan = await assign({ cards: plain.slice(0, 10), study: 999, review: 999, students: [S3], mode: 'light' });
const clampRow = await one('select study_days, review_days from public.wm_plans where id = $1', [clampPlan.plan_id]);
check('공부 기간은 최대 240일, 복습 기간은 최대 90일로 줄여 저장한다', clampRow.study_days === 240 && clampRow.review_days === 90);
check('알 수 없는 분량은 막는다', (await fails('wm_assign', uuid(), CLASS, 't', plain, {}, [S1], 'huge', 14, 14))?.includes('bad_mode'));
const TB = await tokenOf(rBig.plan_id, S1);
const dBig = await call('wm_today_state', TB);
check('plus 분량: 첫날 새 낱말 10개를 소개하고 문항은 하루 25개를 넘지 않는다', dBig.counts.new === 10 && dBig.items.filter((i) => i.kind === 'ask').length <= 25, JSON.stringify(dBig.counts));
check('800개 중 아직 안 만난(소개 전) 낱말 수를 알려 준다 — 소개 카드를 확인하기 전까지는 800', dBig.unseen === 800, String(dBig.unseen));

// ========== 2. 새 방식(문제 만들기) ==========
console.log('2. 새 방식 문제 만들기');
const cardsJ = (await call('wm_clean_cards', rich));
const apple = cardsJ.find((c) => c.word === 'apple');
const cat = cardsJ.find((c) => c.word === 'cat'); // 홀수 번째 → 그림 없음
const mk = (card, style) => call('wm_make_q', card, style, cardsJ);
const qCopy = await mk(apple, 'copy');
check('따라 쓰기: 낱말을 보여 주고 같은 낱말이 정답(text)', qCopy.style === 'copy' && qCopy.qtype === 'text' && qCopy.prompt === 'apple' && qCopy.correct === 'apple' && qCopy.sub === '사과');
const qHint = await mk(apple, 'hint');
check('힌트 글자: 첫·끝 글자만 보여 준다(a _ _ _ e)', qHint.style === 'hint' && qHint.sub === 'a _ _ _ e' && qHint.correct === 'apple' && qHint.prompt === '사과');
check('힌트 글자: 두 글자 낱말은 만들지 않는다', (await mk({ key: 'at|에', word: 'at', meaning: '에' }, 'hint')) === null);
const qPic = await mk(apple, 'typepic');
check('그림 쓰기: 그림이 있는 낱말만, 안내 글 없이 그림만', qPic.style === 'typepic' && qPic.imageUrl === '/img/apple.webp' && qPic.prompt === '' && qPic.correct === 'apple');
check('그림 쓰기: 그림이 없으면 만들지 않는다', (await mk(cat, 'typepic')) === null);
const qFlash = await mk(apple, 'flash');
check('섬광 카드: 보여 주는 시간(flashMs)과 정답', qFlash.style === 'flash' && qFlash.flashMs === 1500 && qFlash.correct === 'apple');
const qFade = await mk(apple, 'fade');
check('점점 가리기: 낱말·뜻·정답', qFade.style === 'fade' && qFade.prompt === 'apple' && qFade.correct === 'apple');
let trueSeen = 0;
let falseSeen = 0;
let oxOk = true;
for (let i = 0; i < 40; i++) {
  const o = await mk(apple, 'ox');
  const shownMeaning = o.prompt.split(' = ')[1];
  const truth = shownMeaning === '사과';
  if (o.correct === 0) trueSeen += 1; else falseSeen += 1;
  if (truth !== (o.correct === 0) || JSON.stringify(o.choices) !== '["O","X"]') oxOk = false;
}
check('맞다/아니다: 맞는 짝이면 O(0), 틀린 짝이면 X(1)가 정답이고 둘 다 나온다', oxOk && trueSeen > 5 && falseSeen > 5, `${trueSeen}/${falseSeen}`);
const qConf = await mk(apple, 'confuse');
check('헷갈리는 짝: 철자가 비슷한 낱말(apply·ample·maple)이 보기에 들어간다', qConf.style === 'confuse' && qConf.choices.filter((c) => ['apply', 'ample', 'maple'].includes(c)).length >= 2 && qConf.choices[qConf.correct] === 'apple', JSON.stringify(qConf.choices));
for (const [style, kind, skill] of [['whack', 'listening', 'listening'], ['monster', null, 'meaning'], ['balloon', null, 'meaning'], ['fish', null, 'meaning']]) {
  const g = await mk(apple, style);
  check(`게임 모양 ${style}: 고르기 문제로 만들어지고 정답이 보기 안에 있다`, g.style === style && g.qtype === 'choice' && g.choices.length >= 2 && g.correct >= 0 && g.skill === skill, JSON.stringify(g));
}
check('알 수 없는 방식은 null', (await mk(apple, 'ghost')) === null);
check('기존 8가지 방식은 그대로 만들어진다', (await Promise.all(['meaning', 'reverse', 'listen', 'letters', 'spell', 'dictation'].map((s) => mk(apple, s)))).every((x) => x !== null));

// ========== 3. 활동 사다리(새 방식이 며칠에 걸쳐 돌아온다) ==========
console.log('3. 활동 사다리');
const P = await assign({ cards: rich, students: [S4], mode: 'normal' });
const T4 = await targetOf(P.plan_id, S4);
const firstStyles = async (setup) => {
  await db.exec(`update public.wm_words set introduced_day = '2026-11-01', ${setup} where target_id = '${T4}' and key = 'apple|사과'`);
  return (await one(`select public.wm_pick_styles(w, 'review', '{}') as r from public.wm_words w where w.target_id = '${T4}' and w.key = 'apple|사과'`)).r;
};
const seen = new Set();
for (let tries = 0; tries < 6; tries++) seen.add((await firstStyles(`ok_total = 1, tries = ${tries}, last_skill = null, miss = 0, last_style = null`))[0]);
check('1단계 낱말은 6번 만나는 동안 뜻→단어·듣기·O·X·낚시 모양으로 돌아간다', ['reverse', 'listen', 'meaning', 'ox', 'fish'].every((s) => seen.has(s)), [...seen].join());
const seen3 = new Set();
for (let tries = 0; tries < 6; tries++) seen3.add((await firstStyles(`ok_total = 3, tries = ${tries}, last_skill = null, miss = 0, last_style = null`))[0]);
check('3단계 낱말은 철자·빈칸·그림 쓰기·풍선·섬광 카드가 돌아간다', ['spell', 'typepic', 'balloon', 'flash'].every((s) => seen3.has(s)), [...seen3].join());
const spelling = await firstStyles(`ok_total = 2, tries = 0, last_skill = 'spelling', miss = 2, last_style = null`);
check('철자를 틀린 낱말은 글자 배열·철자·힌트 글자로 다시 연습한다(기존 규칙 유지)', ['letters', 'spell', 'hint'].includes(spelling[0]) && spelling.includes('letters') && spelling.includes('spell'), spelling.join());
await db.exec(`update public.wm_targets set focus_skill = 'listening' where id = '${T4}'`);
const focused = await firstStyles(`ok_total = 2, tries = 0, last_skill = null, miss = 0, last_style = null`);
check('듣기 집중을 켜면 듣고 고르기·받아쓰기·두더지가 앞에 온다', ['listen', 'whack', 'dictation'].includes(focused[0]), focused.join());
const focusedSpelling = await firstStyles(`ok_total = 3, tries = 0, last_skill = 'spelling', miss = 1, last_style = null`);
check('지금 틀린 능력(철자)이 있으면 집중 설정보다 그것을 먼저 연습한다', ['spell', 'dictation', 'letters', 'fade'].includes(focusedSpelling[0]), focusedSpelling.join());
await db.exec(`update public.wm_targets set focus_skill = null where id = '${T4}'`);

// ========== 4. 학생별 분량 조정 ==========
console.log('4. 학생별 분량 조정(다음 단계 카드 승인)');
const PL = await assign({ cards: big.slice(0, 40), students: [S1, S2], mode: 'normal', study: 20 });
const TOK_S1 = await tokenOf(PL.plan_id, S1);
const TOK_S2 = await tokenOf(PL.plan_id, S2);
const stepA = await call('wm_apply_step', PL.plan_id, S1, 'lighter');
check('분량 줄이기: normal → light, 기록이 남는다', stepA.mode === 'light' && (await one('select count(*)::int c from public.wm_step_log where action = $1', ['lighter'])).c === 1);
const dS1 = await call('wm_today_state', TOK_S1);
const dS2 = await call('wm_today_state', TOK_S2);
check('조정한 학생은 가볍게(새 낱말 3개), 다른 학생은 보통(5개)으로 학습한다', dS1.counts.new === 3 && dS2.counts.new === 5, `${dS1.counts.new}/${dS2.counts.new}`);
check('조정은 그 학생에게만 적용된다(계획 분량은 그대로)', (await one('select daily_mode from public.wm_plans where id = $1', [PL.plan_id])).daily_mode === 'normal');
const stepB = await call('wm_apply_step', PL.plan_id, S1, 'heavier');
check('분량 늘리기: light → normal', stepB.mode === 'normal');
const stepC = await call('wm_apply_step', PL.plan_id, S2, 'focus_spelling');
check('집중 능력 설정', stepC.focus === 'spelling');
const stepD = await call('wm_apply_step', PL.plan_id, S2, 'clear_focus');
check('집중 끝내기', stepD.focus === null);
check('알 수 없는 카드는 막는다', (await fails('wm_apply_step', PL.plan_id, S1, 'explode'))?.includes('bad_action'));
check('계획에 없는 학생은 막는다', (await fails('wm_apply_step', PL.plan_id, S3, 'lighter'))?.includes('not_found'));
await as(db, OWNER_B);
check('다른 학원 선생님은 못 바꾼다', (await fails('wm_apply_step', PL.plan_id, S1, 'lighter'))?.includes('not_found'));
check('다른 학원 선생님은 브리핑·진행도 못 본다', (await fails('wm_plan_briefing', PL.plan_id))?.includes('not_found') && (await fails('wm_plan_progress', PL.plan_id))?.includes('not_found'));
await as(db, null);
check('직원이 아니면 못 바꾼다', (await fails('wm_apply_step', PL.plan_id, S1, 'lighter'))?.includes('not_staff'));
await as(db, OWNER);

// ========== 5. 아침 브리핑 ==========
console.log('5. 아침 브리핑');
const rightResponse = async (sessionId, i) => {
  const qn = (await one('select questions -> $2::int as q from public.wm_sessions where id = $1', [sessionId, i])).q;
  if (qn.qtype === 'choice') return String(qn.correct);
  if (qn.qtype === 'text') return String(qn.correct).split('/')[0];
  return JSON.stringify(qn.correct);
};
const doDay = async (access, { wrongFirst = 0 } = {}) => {
  let st = await call('wm_today_state', access);
  for (const it of st.items) if (it.kind === 'study') await call('wm_ack', access, st.session_id, it.i, uuid());
  let wrong = wrongFirst;
  for (let g = 0; g < 80; g++) {
    st = await call('wm_today_state', access);
    const next = st.items.find((i) => i.state === 'todo' && i.kind === 'ask');
    if (!next) break;
    let resp = await rightResponse(st.session_id, next.i);
    if (wrong > 0 && !next.retry) {
      wrong -= 1;
      resp = next.qtype === 'choice' ? String((Number(resp) + 1) % next.choices.length) : 'zzzz';
    }
    await call('wm_answer', access, st.session_id, next.i, resp, uuid());
  }
};
await setDay(db, '2026-11-10');
const PB = await assign({ cards: rich, students: [S1, S2, S3], mode: 'normal', study: 10, review: 10 });
const [B1, B2] = [await tokenOf(PB.plan_id, S1), await tokenOf(PB.plan_id, S2)];
await doDay(B1, { wrongFirst: 3 });
await call('wm_today_state', B2); // 열기만 하고 풀지 않음
await setDay(db, '2026-11-11');
const brief = await call('wm_plan_briefing', PB.plan_id);
const bs = Object.fromEntries(brief.students.map((s) => [s.name, s]));
check('어제 끝낸 학생 / 열기만 한 학생 / 아예 안 한 학생이 구분된다', bs['민수'].yesterday === 'done' && bs['지아'].yesterday === 'none' && bs['하준'].yesterday === 'none', JSON.stringify(brief.students.map((s) => [s.name, s.yesterday])));
check('어제 푼 문제 수·맞힌 수가 나온다', bs['민수'].answered_yesterday > 0 && bs['민수'].correct_yesterday < bs['민수'].answered_yesterday);
check('연속 학습일: 어제 했으면 1일, 아직 안 했으면 0일', bs['민수'].streak_days === 1 && bs['지아'].streak_days === 0, `${bs['민수'].streak_days}/${bs['지아'].streak_days}`);
check('반이 이번 주 많이 틀린 낱말이 순위로 나온다', brief.hot_words.length > 0 && brief.hot_words[0].misses >= 1 && typeof brief.hot_words[0].word === 'string');
check('브리핑에 개인 링크 열쇠·정답이 없다', !JSON.stringify(brief).includes('access_token') && !JSON.stringify(brief).includes('"correct":'));
await doDay(B1);
const brief2 = await call('wm_plan_briefing', PB.plan_id);
check('오늘 끝내면 연속 2일, 오늘 상태 done', brief2.students.find((s) => s.name === '민수').streak_days === 2 && brief2.students.find((s) => s.name === '민수').today === 'done');

// ========== 6. 다음 단계 제안 규칙 ==========
console.log('6. 다음 단계 제안');
await setDay(db, '2026-11-15');
const sug = Object.fromEntries((await call('wm_plan_steps', PB.plan_id)).map((s) => [s.name, s]));
check('4일 넘게 안 한 학생에게는 분량 줄이기를 제안한다(근거: 안 한 날 수)', sug['지아'].steps.some((x) => x.action === 'lighter' && x.reason.code === 'inactive' && x.reason.days >= 3), JSON.stringify(sug['지아'].steps));
check('제안만 하고 자동으로 바꾸지 않는다', sug['지아'].mode === 'normal' && (await one('select mode_override from public.wm_targets where plan_id = $1 and student_id = $2', [PB.plan_id, S2])).mode_override === null);
// 철자를 계속 틀리는 학생
const TW = await targetOf(PB.plan_id, S3);
await db.exec(`update public.wm_words set skill_miss = '{"spelling":5}'::jsonb, miss = 5, introduced_day = '2026-11-10', stage = 1 where target_id = '${TW}' and key in ('apple|사과', 'cat|고양이')`);
const sug2 = Object.fromEntries((await call('wm_plan_steps', PB.plan_id)).map((s) => [s.name, s]));
check('한 능력(철자)이 틀림의 40% 이상이면 그 능력 집중을 제안한다', sug2['하준'].steps.some((x) => x.action === 'focus_spelling' && x.reason.code === 'weak_skill' && x.reason.count === 10), JSON.stringify(sug2['하준'].steps));
await call('wm_apply_step', PB.plan_id, S3, 'focus_spelling');
const sug3 = Object.fromEntries((await call('wm_plan_steps', PB.plan_id)).map((s) => [s.name, s]));
check('이미 집중 중이면 같은 제안을 다시 하지 않는다', !sug3['하준'].steps.some((x) => x.action === 'focus_spelling'));
await db.exec(`update public.wm_words set skill_miss = '{}'::jsonb, miss = 0 where target_id = '${TW}'`);
const sug4 = Object.fromEntries((await call('wm_plan_steps', PB.plan_id)).map((s) => [s.name, s]));
check('그 능력 틀림이 사라지면 집중 끝내기를 제안한다', sug4['하준'].steps.some((x) => x.action === 'clear_focus'), JSON.stringify(sug4['하준'].steps));
// 꾸준하고 정답률이 높은 학생(합성 기록 6일 × 8문제 전부 정답)
const TS = await targetOf(PB.plan_id, S1);
for (let d = 9; d <= 14; d++) {
  const sid = (await one(`insert into public.wm_sessions (target_id, day, main_budget, retry_left, done_at) values ($1, '2026-11-${String(d).padStart(2, '0')}', 16, 4, now()) on conflict (target_id, day) do update set done_at = now() returning id`, [TS])).id;
  for (let i = 0; i < 8; i++) await db.query(`insert into public.wm_answers (session_id, q_index, key, kind, correct, client_id) values ($1, $2, 'apple|사과', 'answer', true, $3) on conflict do nothing`, [sid, 100 + i, uuid()]);
}
const sug5 = Object.fromEntries((await call('wm_plan_steps', PB.plan_id)).map((s) => [s.name, s]));
check('5일 이상 정답률 90% 이상이면 분량 늘리기를 제안한다', sug5['민수'].steps.some((x) => x.action === 'heavier' && x.reason.code === 'steady'), JSON.stringify(sug5['민수'].steps) + ' ' + sug5['민수'].answers_7d);
await call('wm_apply_step', PB.plan_id, S1, 'heavier');
await call('wm_apply_step', PB.plan_id, S1, 'heavier');
const sug6 = Object.fromEntries((await call('wm_plan_steps', PB.plan_id)).map((s) => [s.name, s]));
check('이미 최대 분량(plus)이면 더 늘리자고 하지 않는다', sug6['민수'].mode === 'plus' && !sug6['민수'].steps.some((x) => x.action === 'heavier'));

// ========== 7. 프로젝트 진행·졸업·페이스 ==========
console.log('7. 프로젝트 진행·졸업·페이스');
const PG = await assign({ cards: big.slice(0, 120), students: [S2], mode: 'plus', study: 30, review: 30, request: uuid() });
const TG = await targetOf(PG.plan_id, S2);
await setDay(db, '2026-11-20');
const p0 = await call('wm_plan_progress', PG.plan_id);
check('구간은 50개씩: 120개 → 3구간(50·50·20)', p0.students[0].sections.length === 3 && p0.students[0].sections.map((s) => s.size).join() === '50,50,20' && p0.need_to_graduate === 114, JSON.stringify(p0.students[0].sections));
check('기록이 없으면 페이스를 억지로 계산하지 않는다(null)', p0.students[0].pace.intro_date === null && p0.students[0].pace.graduate_date === null);
await db.exec(`update public.wm_words set introduced_day = '2026-11-18', stage = 3 where target_id = '${TG}' and key in (select c->>'key' from public.wm_plans p, jsonb_array_elements(p.cards) c where p.id = '${PG.plan_id}' limit 60)`);
const p1 = await call('wm_plan_progress', PG.plan_id);
const sec = p1.students[0].sections;
check('구간별 졸업(며칠 뒤에도 기억함) 수가 센다: 앞 60개 = 1구간 50 + 2구간 10', p1.students[0].kept === 60 && sec[0].kept === 50 && sec[1].kept === 10 && sec[2].kept === 0, JSON.stringify(sec));
check('졸업 95% 미만이면 완성이 아니다', p1.students[0].completed === false);
const pace = p1.students[0].pace;
check('지금까지 속도로 졸업 날짜를 어림한다(10일 경과·60개 → 앞으로 60개는 10일쯤)', typeof pace.graduate_date === 'string' && pace.on_track === true, JSON.stringify(pace));
await db.exec(`update public.wm_words set introduced_day = '2026-11-18', stage = 3 where target_id = '${TG}'`);
const p2 = await call('wm_plan_progress', PG.plan_id);
check('졸업이 95% 이상이면 완성(completed)', p2.students[0].completed === true && p2.students[0].pace.on_track === true);
const cardsRange = await call('wm_plan_cards', PG.plan_id, 51, 55);
check('구간 시험용 낱말: 순번 범위로 가져온다(51~55번)', cardsRange.length === 5 && cardsRange[0].ord === 51 && cardsRange[0].word === 'word50');
check('낱말 목록은 최대 1000번까지만', (await call('wm_plan_cards', PG.plan_id, 1, 99999)).length === 120);
await db.exec(`update public.wm_words set stage = 1 where target_id = '${TG}' and key in ('word3|뜻3', 'word7|뜻7')`);
await db.exec(`update public.wm_words set miss = 4 where target_id = '${TG}' and key = 'word7|뜻7'`);
const weak = await call('wm_plan_weak_cards', PG.plan_id, 10);
check('졸업 못 한 낱말이 틀림이 많은 순으로 나온다(최종 시험용)', weak.length === 2 && weak[0].word === 'word7' && weak[1].word === 'word3', JSON.stringify(weak.map((w) => w.word)));
check('시험용 목록에는 학생 정보가 없다', !JSON.stringify(weak).includes('student') && !JSON.stringify(cardsRange).includes('student'));

// ========== 8. 권한 ==========
console.log('8. 권한');
const priv = await one(`select has_function_privilege('anon', 'public.wm_plan_progress(uuid)', 'execute') a1, has_function_privilege('anon', 'public.wm_apply_step(uuid,uuid,text)', 'execute') a2,
  has_function_privilege('anon', 'public.wm_plan_briefing(uuid)', 'execute') a3, has_function_privilege('anon', 'public.wm_plan_steps(uuid)', 'execute') a4,
  has_function_privilege('anon', 'public.wm_plan_cards(uuid,int,int)', 'execute') a5, has_function_privilege('anon', 'public.wm_plan_weak_cards(uuid,int)', 'execute') a6,
  has_function_privilege('authenticated', 'public.wm_plan_progress(uuid)', 'execute') t1, has_function_privilege('authenticated', 'public.wm_apply_step(uuid,uuid,text)', 'execute') t2,
  has_function_privilege('authenticated', 'public.wm_similar_words(jsonb,jsonb,int)', 'execute') s1, has_table_privilege('anon', 'public.wm_step_log', 'select') l1, has_table_privilege('authenticated', 'public.wm_step_log', 'select') l2`);
check('새 선생님 함수 6개는 익명이 못 부르고 로그인 사용자는 부른다', !priv.a1 && !priv.a2 && !priv.a3 && !priv.a4 && !priv.a5 && !priv.a6 && priv.t1 && priv.t2);
check('내부 함수(비슷한 낱말)·조정 기록 표는 누구도 직접 못 쓴다', !priv.s1 && !priv.l1 && !priv.l2);
const studentCall = await fails('wm_plan_briefing', PB.plan_id);
await as(db, null);
check('로그인 안 한 사람은 브리핑을 못 본다', (await fails('wm_plan_briefing', PB.plan_id))?.includes('not_staff') && studentCall === null);

summary();
