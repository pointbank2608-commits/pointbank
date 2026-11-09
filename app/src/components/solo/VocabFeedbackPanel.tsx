import { useEffect, useState } from 'react';
import type { Student } from '../../lib/types';
import { canFollowUpVocab, createVocabDraft, needsVocabPractice, vocabFeedback, type VocabDraft, type VocabFeedbackRow } from '../../lib/vocabLearning';
import VocabDraftEditor from './VocabDraftEditor';
import VocabCueFeedback, { cueCanFollowUp, cueNeedsPractice } from './VocabCueFeedback';
import type { CueFeedbackRow } from '../../lib/vocabLearning';
import type { CueSchedule } from '../../lib/vocabCues';

const action = 'min-h-11 rounded-full border border-primary/30 bg-white px-4 text-sm font-bold text-primary disabled:opacity-40';

export default function VocabFeedbackPanel({ classId, students, en, revision, schedule, onAvailable, onCuesAvailable, onAssigned }: {
  classId: string;
  students: Student[];
  en: boolean;
  revision: number;
  schedule: CueSchedule | null;
  onAvailable: (available: boolean) => void;
  onCuesAvailable: (available: boolean) => void;
  onAssigned: () => void;
}) {
  const l = (ko: string, english: string) => en ? english : ko;
  const [data, setData] = useState<Awaited<ReturnType<typeof vocabFeedback>> | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VocabDraft | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    let inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await vocabFeedback(classId, lessonId);
        if (!active) return;
        setData(result);
        setMissing(false);
        setError(previous => previous === 'load' ? '' : previous);
        onAvailable(true);
        onCuesAvailable(!!result.cue_ready);
        if (!lessonId && result.lessons.length) setLessonId(result.lessons[0].id);
      } catch (cause) {
        if (!active) return;
        const unavailable = cause instanceof Error && (cause.message === 'path_not_ready' ||
          cause.message.includes('permission denied for function learning_vocab_feedback'));
        setMissing(unavailable);
        if (unavailable) { onAvailable(false); onCuesAvailable(false); }
        else setError('load');
      } finally { inFlight = false; }
    }
    void load();
    const update = () => { if (!document.hidden) void load(); };
    const timer = window.setInterval(update, 30_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [classId, lessonId, revision, refresh, onAvailable, onCuesAvailable]);

  if (missing) return null;
  const cueRows = data?.cue_rows ?? [];
  const rows = data?.cue_lesson ? [] : data?.rows ?? [];
  const byWord = new Map<number, VocabFeedbackRow[]>();
  const byStudent = new Map<string, VocabFeedbackRow[]>();
  for (const row of rows) {
    const wordGroup = byWord.get(row.goal_index) ?? [];
    wordGroup.push(row);
    byWord.set(row.goal_index, wordGroup);
    const studentGroup = byStudent.get(row.student_id) ?? [];
    studentGroup.push(row);
    byStudent.set(row.student_id, studentGroup);
  }
  const result = (value: boolean | null) => value === null ? l('미확인','Pending') : value ? l('맞힘','Recalled') : l('틀림·모름','Incorrect / unknown');
  const linked = rows.filter(row => row.homework_id);
  const responded = linked.filter(row => row.homework_correct !== null);
  const practice = rows.filter(needsVocabPractice);
  const priority = Array.from(byWord.values(), group => ({ card: group[0].card, count: group.filter(needsVocabPractice).length }))
    .sort((a, b) => b.count - a.count)[0];

  function selectLesson(id: string) {
    setData(previous => previous && { ...previous, rows: [], cue_rows: [], drafts: [], followups: [] });
    setLessonId(id);
    setNotice('');
    setError('');
  }

  function studentFeedback(row: VocabFeedbackRow) {
    if (row.homework_id && row.homework_correct === null) return l('후속 숙제의 첫 답을 기다리고 있어요.','Waiting for the first follow-up homework answer.');
    if (needsVocabPractice(row)) return l('최근 혼자 푼 답에서 막혔어요. 단어와 뜻을 다시 연결한 뒤, 보기를 가리고 확인하는 연습을 추천해요.','The latest independent answer suggests difficulty. Revisit the word and meaning, then check recall without choices.');
    if (row.homework_correct === true && row.independent_correct === false) return l('수업에서 혼자 떠올리지 못한 단어를 연결 숙제의 첫 답에서 맞혔어요.','The first linked homework answer was correct for a word missed on the independent lesson check.');
    if (row.review_correct === true || row.homework_review_correct === true) return l('시간을 두고 다시 풀었을 때도 혼자 맞혔어요.','Recalled the word independently on a spaced review.');
    if (row.first_correct === false && row.independent_correct === true) return l('첫 답에서 막혔지만 학습 뒤 혼자 맞혔어요.','The student struggled on the first answer and recalled the word independently after learning.');
    if (row.independent_correct === true) return l('혼자 확인에서 맞혔어요. 후속 답이 들어오면 같은 단어의 기록을 이어서 볼 수 있어요.','Recalled the word on the independent check. Linked homework will add evidence for the same goal.');
    if (row.first_check_correct !== null) return l('첫 독립 확인 이후의 마무리 답을 기다리고 있어요.','Waiting for the final answer after the first independent check.');
    return l('혼자 확인한 결과가 아직 없어요.','An independent check has not been recorded yet.');
  }

  async function makeDraft(kind: VocabDraft['kind'], student: string | null) {
    if (!lessonId || busy || draft) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const proposal = await createVocabDraft(lessonId, kind, student, !!data?.cue_lesson);
      if (proposal) setDraft(proposal);
      else setNotice(l('지금은 이 계획을 추천할 만큼 확인된 답이 없어요.','There are no confirmed answers supporting this plan yet.'));
    } catch { setError('draft'); }
    finally { setBusy(false); }
  }

  function draftButtons(canPractise: boolean, followUp: boolean, student: string | null) {
    if (data?.cue_lesson && !data.cue_ready) return null;
    const canCheck = !!data?.homework_enabled && followUp;
    return <div className="flex flex-wrap gap-2">
      {canCheck && <button type="button" className={action} disabled={busy || !!draft} onClick={() => void makeDraft('homework', student)}>
        {student ? l('학생 후속 숙제 초안','Draft student follow-up') : l('반 후속 숙제 초안','Draft class follow-up')}
      </button>}
      {canPractise && <button type="button" className={action} disabled={busy || !!draft} onClick={() => void makeDraft('lesson', student)}>
        {student ? l('학생 보충 수업 초안','Draft student lesson') : l('반 보충 수업 초안','Draft class lesson')}
      </button>}
    </div>;
  }

  return <section id="vocab-learning-feedback" aria-label={l('어휘 학습 피드백','Vocabulary learning feedback')} className="scroll-mt-6 space-y-4 rounded-3xl border border-outline-variant bg-surface-container-low p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-xl font-bold">{l('어휘 학습 피드백','Vocabulary learning feedback')}</h3>
        <p className="mt-1 text-sm">{l('개별수업의 첫 답과 혼자 확인, 같은 목표로 연결된 후속 숙제를 모아 보여줘요.','See initial and independent lesson answers alongside linked homework for the same goal.')}</p>
      </div>
      <button type="button" className={action} onClick={() => setRefresh(value => value + 1)}>{l('새로고침','Refresh')}</button>
    </header>
    {error && <p role="alert" className="text-error">{error === 'load' ? l('피드백을 불러오지 못했어요. 다시 조회해 주세요.','Feedback could not be loaded. Refresh to try again.') : l('초안을 만들지 못했어요. 연결과 학원 설정을 확인해 주세요.','Could not create the draft. Check your connection and academy settings.')}</p>}
    {notice && <p role="status" className="rounded-xl bg-white p-3">{notice}</p>}
    {!data && !error && <p role="status">{l('학습 기록을 확인하고 있어요…','Loading learning records…')}</p>}
    {data && data.lessons.length === 0 && <p>{l('반에 배정한 어휘 개별수업이 생기면 여기에 피드백이 표시돼요.','Feedback appears here after a vocabulary lesson is assigned.')}</p>}
    {!!data?.lessons.length && <label className="block space-y-1"><span className="font-bold">{l('기준 개별수업','Source lesson')}</span>
      <select className="w-full rounded-xl border border-outline-variant bg-white px-3 py-3" value={lessonId ?? ''} disabled={busy || !!draft} onChange={event => selectLesson(event.target.value)}>
        {data.lessons.map(lesson => <option value={lesson.id} key={lesson.id}>{lesson.name} · {new Date(lesson.created_at).toLocaleDateString(en ? 'en-US' : 'ko-KR', {timeZone:'Asia/Seoul'})}</option>)}
      </select>
    </label>}
    {draft && <VocabDraftEditor key={draft.id} draft={draft} classId={classId} students={students.filter(student =>
      data?.cue_lesson ? cueRows.some(row => row.student_id === student.id) : byStudent.has(student.id))} en={en} schedule={schedule}
      sourceCards={data?.cue_lesson ? [...new Map(cueRows.map(row => [row.goal_index, row.card])).values()] : Array.from(byWord.values(), group => group[0].card)}
      onClose={() => { setDraft(null); setRefresh(value => value + 1); }}
      onApproved={kind => {
        setDraft(null);
        setNotice(kind === 'homework' ? l('후속 숙제를 배정하고 이 개별수업에 연결했어요.','The homework was assigned and linked to this lesson.') : l('보충 개별수업을 배정했어요.','The individual lesson was assigned.'));
        setRefresh(value => value + 1);
        onAssigned();
      }}/>}
    {!draft && !!data?.drafts.length && <div className="flex flex-wrap gap-2">
      {data.drafts.map(item => <button key={item.id} type="button" className={action} disabled={busy || (!!item.cue && !data.cue_ready)} onClick={() => setDraft(item)}>
        {l('초안 다시 열기','Reopen draft')} · {item.title} · {item.cards.map(card => card.word).join(', ')}
      </button>)}
    </div>}
    {!!data?.followups.length && <div className="space-y-1">
      <h4 className="font-bold">{l('이 수업에서 이어진 배정','Assignments linked to this lesson')}</h4>
      <ul className="flex flex-wrap items-center gap-2">
        {data.followups.map(item => <li key={item.id} className="rounded-xl bg-white px-3 text-sm">
          {item.kind === 'lesson' && data.lessons.some(lesson => lesson.id === item.id) ?
            <button type="button" className="min-h-11 underline" disabled={busy || !!draft} onClick={() => selectLesson(item.id)}>{item.name}</button> :
            <span className="block py-2">{item.name}</span>}
        </li>)}
      </ul>
    </div>}
    {cueRows.length > 0 && <VocabCueFeedback rows={cueRows} en={en} timetable={data?.timetable} actions={(scope: CueFeedbackRow[], student) =>
      draftButtons(scope.some(cueNeedsPractice), scope.some(cueCanFollowUp), student)}/>}
    {rows.length > 0 && <>
      <article className="space-y-3 rounded-2xl bg-white p-4">
        <h4 className="font-bold">{l('반 전체','Class feedback')} · {byStudent.size}{l('명 배정',' assigned')}</h4>
        <p>{l(`연결 숙제 첫 답 ${responded.length}/${linked.length}개(학생×단어), 응답 중 ${responded.filter(row => row.homework_correct).length}개 맞힘.`, `Linked homework first answers: ${responded.length}/${linked.length} student-word pairs, ${responded.filter(row => row.homework_correct).length} correct among responses.`)}</p>
        <p className="text-sm text-on-surface-variant">{l('숙제가 연결되지 않은 단어와 아직 답하지 않은 단어는 따로 표시합니다. 배정한 단어의 철자 회상 기록을 보여줘요.','Unlinked homework and pending answers are shown separately. The results describe spelling recall for the assigned words.')}</p>
        <ul className="divide-y divide-outline-variant/40">
          {Array.from(byWord.values(), group => {
            const answered = group.filter(row => row.independent_correct !== null);
            const matched = group.filter(row => row.homework_id);
            const hwAnswers = matched.filter(row => row.homework_correct !== null);
            return <li key={group[0].goal_index} className="py-2 text-sm">
              <b>{group[0].card.word} · {group[0].card.meaning}</b>
              <p>{l(`혼자 확인 ${answered.length}/${group.length}명 · 그중 ${answered.filter(row => row.independent_correct).length}명 맞힘`, `Independent check: ${answered.length}/${group.length} students, ${answered.filter(row => row.independent_correct).length} correct`)}</p>
              <p>{l(`후속 숙제 첫 답 ${hwAnswers.length}/${matched.length}명 · 그중 ${hwAnswers.filter(row => row.homework_correct).length}명 맞힘 · 미연결 ${group.length - matched.length}명`, `Linked first homework answer: ${hwAnswers.length}/${matched.length}, ${hwAnswers.filter(row => row.homework_correct).length} correct, ${group.length - matched.length} unlinked`)}</p>
            </li>;
          })}
        </ul>
        {practice.length > 0 && priority && <p className="text-sm font-semibold">{l(`‘${priority.card.word} · ${priority.card.meaning}’에서 ${priority.count}명이 최근 확인에 어려움을 보였어요. 반 초안은 이 단어부터 제안합니다.`, `${priority.count} students struggled with “${priority.card.word} · ${priority.card.meaning}” on their latest check. Class drafts start with this goal.`)}</p>}
        {draftButtons(rows.some(needsVocabPractice), rows.some(canFollowUpVocab), null)}
      </article>
      <div className="space-y-2">
        <h4 className="font-bold">{l('학생별 피드백','Student feedback')}</h4>
        {Array.from(byStudent.entries(), ([student, group]) => <details key={student} className="rounded-xl border border-outline-variant bg-white px-4">
          <summary className="min-h-11 cursor-pointer py-3 font-bold">{group[0].student_name} · {l(`혼자 확인 ${group.filter(row => row.independent_correct !== null).length}/${group.length}`, `Independent checks ${group.filter(row => row.independent_correct !== null).length}/${group.length}`)}</summary>
          <div className="space-y-3 pb-4">
            <ul className="space-y-3">
              {group.map(row => <li key={row.goal_index} className="rounded-lg bg-surface-container-low p-3 text-sm">
                <b>{row.card.word} · {row.card.meaning}</b>
                <p>{l('개별수업 첫 답','First lesson answer')} {result(row.first_correct)} · {l('첫 독립 확인','First independent check')} {result(row.first_check_correct)}
                  {row.independent_correct !== row.first_check_correct && row.independent_correct !== null && <> · {l('추가 연습 뒤','After more practice')} {result(row.independent_correct)}</>}
                  {row.practice_hint_used && <> · {l('연습 중 힌트 사용','Hint used during practice')}</>}</p>
                <p>{l('개별수업 복습','Lesson review')} {row.review_round ? `${row.review_round}${l('차','')}: ${result(row.review_correct)}` : result(null)} · {l('후속 숙제 첫 답','First homework answer')} {row.homework_id ? result(row.homework_correct) : l('미연결','Unlinked')}
                  {row.homework_review_round && <> · {l('숙제 복습','Homework review')} {row.homework_review_round}{l('차','')}: {result(row.homework_review_correct)}</>}</p>
                <p className="mt-1 text-on-surface-variant">{studentFeedback(row)}</p>
              </li>)}
            </ul>
            {draftButtons(group.some(needsVocabPractice), group.some(canFollowUpVocab), student)}
          </div>
        </details>)}
      </div>
    </>}
  </section>;
}
