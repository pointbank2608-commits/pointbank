import type { ReactNode } from 'react';
import { cueDate, cueLabel, cueModes, type CueOutcome, type CueTimetable } from '../../lib/vocabCues';
import type { CueFeedbackRow } from '../../lib/vocabLearning';

export const cueNeedsPractice = (row: CueFeedbackRow) => row.context_correct === false ||
  Object.values(row.cues).some(outcome => outcome && ((row.ready || outcome.essential) && outcome.latest === false ||
    outcome.essential && outcome.latest === null && outcome.unavailable));
export const cueCanFollowUp = (row: CueFeedbackRow) => row.ready && (!row.context_id || row.context_correct === false) &&
  Object.values(row.cues).some(outcome => typeof outcome?.latest === 'boolean');

function groupBy<T>(rows: CueFeedbackRow[], key: (row: CueFeedbackRow) => T) {
  const groups = new Map<T, CueFeedbackRow[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id) ?? [];
    group.push(row);
    groups.set(id, group);
  }
  return [...groups.values()];
}

export default function VocabCueFeedback({ rows, en, timetable, actions }: {
  rows: CueFeedbackRow[];
  en: boolean;
  timetable?: CueTimetable | null;
  actions: (rows: CueFeedbackRow[], student: string | null) => ReactNode;
}) {
  const l = (ko: string, english: string) => en ? english : ko;
  const status = (correct: boolean | null) => correct === null ? l('미확인','Pending') : correct ? l('맞힘','Correct') : l('틀림·모름','Incorrect / unknown');
  const students = groupBy(rows, row => row.student_id);
  const words = groupBy(rows, row => row.goal_index);
  const completed = students.filter(group => group[0].ready);
  const belowTarget = completed.filter(([row]) => row.gap_count !== null && row.verified_count !== null &&
    row.verified_count * 5 < row.gap_count * 4);
  const essential = rows.flatMap(row => cueModes.flatMap(mode => {
    const outcome = row.cues[mode];
    return outcome?.essential ? [{row, mode, outcome}] : [];
  }));
  const essentialUnresolved = essential.filter(({outcome}) => outcome.latest !== true || outcome.before_deadline !== true);
  function essentialStatus(outcome: CueOutcome) {
    const deadline = timetable?.deadline_passed;
    if (outcome.before_deadline === true) return outcome.latest === false
      ? l('기한 내 확인 · 현재 다시 연습 필요','Verified by deadline · needs practice again')
      : l('기한 내 확인','Verified by deadline');
    if (outcome.latest === true) return l('기한 후 확인','Verified after deadline');
    if (outcome.latest === false) return l('아직 어려움','Still needs practice');
    if (outcome.unavailable || outcome.deadline_unavailable) return l('음성 미확인','Audio unavailable');
    return deadline ? l('기한까지 미응답','No response by deadline') : l('확인 대기','Awaiting a check');
  }
  const priority = words.flatMap(group => [
    { card: group[0].card, label: l('문장 속 뜻 알기','Meaning in context'), required: 0, count: group.filter(row => row.ready && row.context_correct === false).length },
    ...cueModes.map(mode => ({
      card: group[0].card, label: cueLabel(mode, en),
      required: group.filter(row => row.cues[mode]?.essential && row.cues[mode]?.latest === false).length,
      count: group.filter(row => (row.ready || row.cues[mode]?.essential) && row.cues[mode]?.latest === false).length,
    })),
  ]).sort((a, b) => b.required - a.required || b.count - a.count)[0];
  return <>
    <article className="space-y-3 rounded-2xl bg-white p-4">
      <h4 className="font-bold">{l('반 전체','Class feedback')} · {students.length}{l('명 배정',' assigned')}</h4>
      <p className="text-sm font-semibold">{l(
        `첫 학습 완료 ${completed.length}/${students.length}명 · 완료자 중 80% 목표에 아직 못 미친 학생 ${belowTarget.length}명`,
        `Initial learning complete: ${completed.length}/${students.length} students · ${belowTarget.length} are still below the 80% target`
      )}</p>
      {essential.length > 0 && <section aria-label={l('다음 수업 전 필수 목표 현황','Essential goals before the next class')}
        className="space-y-2 rounded-xl border border-primary/25 bg-primary-fixed/20 p-3 text-sm">
        <h5 className="font-bold">{l('다음 수업 전 필수 목표 현황','Essential goals before the next class')}</h5>
        {timetable?.next_class_on && <p>{l('다음 대면 수업','Next class')} · {cueDate(timetable.next_class_on,en)}</p>}
        {timetable?.focus_due_at && <p>{l('확인 기준 시각','Deadline')} · {cueDate(timetable.focus_due_at,en,true)}</p>}
        <p>{l(`기한 내 확인 ${essential.filter(({outcome})=>outcome.before_deadline===true).length}/${essential.length}개 · 현재 미확인·어려움 ${essential.filter(({outcome})=>outcome.latest!==true).length}개`,
          `Verified by deadline: ${essential.filter(({outcome})=>outcome.before_deadline===true).length}/${essential.length} · Currently unresolved: ${essential.filter(({outcome})=>outcome.latest!==true).length}`)}</p>
        {essentialUnresolved.length>0 && <ul className="max-h-52 space-y-1 overflow-auto">
          {essentialUnresolved.map(({row,mode,outcome}) => <li key={`${row.student_id}:${row.goal_index}:${mode}`}>
            <b>{row.student_name}</b> · {row.card.word} ({row.card.meaning}) · {cueLabel(mode,en)} · {essentialStatus(outcome)}
          </li>)}
        </ul>}
      </section>}
      <p className="text-sm">{l('단서별로 확인된 응답을 모았어요. 음성 미확인과 숙제 미응답은 오답과 따로 표시합니다.','Responses are grouped by cue. Unavailable audio and unanswered homework are separate from incorrect answers.')}</p>
      <ul className="divide-y divide-outline-variant/40">
        {words.map(group => {
          const linked = group.filter(row => row.context_id);
          const context = linked.filter(row => row.context_correct !== null);
          return <li key={group[0].goal_index} className="space-y-1 py-3 text-sm">
            <b>{group[0].card.word} · {group[0].card.meaning}</b>
            {cueModes.map(mode => {
              const planned = group.flatMap(row => row.cues[mode] ? [row.cues[mode]] : []);
              if (!planned.length) return null;
              const first = planned.filter(outcome => outcome.first !== null);
              const latest = planned.filter(outcome => outcome.latest !== null);
              const unavailable = planned.filter(outcome => outcome.unavailable).length;
              return <p key={mode}>{cueLabel(mode, en)} · {l(
                `첫 확인 ${first.filter(outcome => outcome.first).length}/${first.length} 맞힘 · 최근 확인 ${latest.filter(outcome => outcome.latest).length}/${latest.length} 맞힘 · 응답 ${latest.length}/${planned.length}명`,
                `First: ${first.filter(outcome => outcome.first).length}/${first.length} correct · Latest: ${latest.filter(outcome => outcome.latest).length}/${latest.length} correct · ${latest.length}/${planned.length} responded`
              )}{unavailable > 0 && ` · ${l('최근 음성 미확인','Latest audio unavailable')} ${unavailable}`}</p>;
            })}
            <p>{l(`새 문장 숙제 ${context.length}/${linked.length}명 응답 · ${context.filter(row => row.context_correct).length}명 맞힘 · 미연결 ${group.length - linked.length}명`,
              `New sentence: ${context.length}/${linked.length} responded · ${context.filter(row => row.context_correct).length} correct · ${group.length - linked.length} unlinked`)}</p>
          </li>;
        })}
      </ul>
      {!!priority?.count && <p className="text-sm font-semibold">{l(
        `‘${priority.card.word} · ${priority.card.meaning}’에서 ${priority.count}명에게 ‘${priority.label}’ 보충 근거가 있어요.`,
        `${priority.count} students have evidence supporting “${priority.label}” practice for “${priority.card.word}”.`
      )}</p>}
      {actions(rows, null)}
    </article>
    <div className="space-y-2">
      <h4 className="font-bold">{l('학생별 단서 피드백','Student feedback by cue')}</h4>
      {students.map(group => {
        const student = group[0];
        return <details key={student.student_id} className="rounded-xl border border-outline-variant bg-white px-4">
          <summary className="min-h-11 cursor-pointer py-3 font-bold">{student.student_name}
            {!!student.gap_count && ` · ${l('처음 막힌 항목 중 독립 확인','Initial gaps independently verified')} ${student.verified_count}/${student.gap_count}`}
          </summary>
          <ul className="space-y-2 pb-3">
            {group.map(row => <li key={row.goal_index} className="space-y-1 rounded-lg bg-surface-container-low p-3 text-sm">
              <b>{row.card.word} · {row.card.meaning}</b>
              {cueModes.map(mode => {
                const evidence = row.cues[mode];
                if (!evidence) return null;
                return <p key={mode}>{cueLabel(mode, en)} · {l('첫 답','First')} {status(evidence.first)}
                  {evidence.check !== null && ` · ${l('연습 후 혼자 확인','After practice')} ${status(evidence.check)}`}
                  {evidence.round !== null && ` · ${l('복습','Review')} ${evidence.review_on ? cueDate(evidence.review_on,en) : ''} ${status(evidence.review)}`}
                  {evidence.unavailable && ` · ${l('음성 미확인','Audio unavailable')}`}
                  {evidence.essential && <strong> · {l('필수','Essential')} {essentialStatus(evidence)}</strong>}</p>;
              })}
              <p>{l('새 문장 숙제','New-sentence homework')} · {row.context_id ? status(row.context_correct) : l('미연결','Unlinked')}</p>
            </li>)}
          </ul>
          <div className="pb-4">{actions(group, student.student_id)}</div>
        </details>;
      })}
    </div>
  </>;
}
