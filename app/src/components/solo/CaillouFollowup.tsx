import { useEffect, useState } from 'react';
import {
  CAILLOU_TRANSFER_PROMPT, recommendCaillouFollowup, transferDate, transferGradeLabels,
  type FollowupPlan, type FollowupRow, type StudentTransferAction, type TeacherTransferApi, type TransferState,
} from '../../lib/caillouFollowup';

const primary = 'min-h-11 rounded-xl bg-[#3b5bdb] px-4 py-2 font-bold text-white disabled:opacity-50';
const secondary = 'min-h-11 rounded-xl border border-[#ccd6ef] bg-white px-4 py-2 font-bold text-[#243968] disabled:opacity-50';
const input = 'w-full rounded-xl border border-[#aab8d6] bg-white px-3 py-2 text-[#152c50] focus:outline-2 focus:outline-[#3b5bdb]';

export function CaillouHomeworkCard({ state, act }: {
  state: TransferState;
  act: (action: StudentTransferAction, answer?: string) => Promise<void>;
}) {
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isRetry = state.first_grade !== null;

  async function send(action: StudentTransferAction) {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      await act(action, action === 'hint' ? undefined : answer.trim());
      if (action !== 'hint') setAnswer('');
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return <article className="space-y-3 rounded-2xl border border-[#dce4f4] bg-[#f5f8ff] p-4 text-[#142e51]">
    <h3 className="text-lg font-bold">카이유 1차시 · 다음 날 숙제</h3>
    {state.done ? <p role="status">제출했어요. 선생님이 답을 확인할 수 있어요.</p> : !state.available ? (
      <p>{state.opens_at ? `${transferDate(state.opens_at)}에 열려요.` : '개별수업을 마친 다음 날 열려요.'}</p>
    ) : !expanded ? <button type="button" className={primary} onClick={() => setExpanded(true)}>{isRetry ? '이어서 쓰기' : '숙제 시작'}</button> : (
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (answer.trim()) void send(isRetry ? 'retry' : 'first'); }}>
        <p className="text-lg font-semibold">{CAILLOU_TRANSFER_PROMPT}</p>
        {isRetry && <p role="status">{state.first_grade === 'review' ? '첫 답을 저장했어요. 문장을 한 번 더 확인해 보세요.' : '배웠던 표현을 떠올려 한 번 더 써 봐요.'}</p>}
        {state.hint && <p role="status" className="rounded-xl bg-[#e3ebff] p-3">{state.hint}</p>}
        <label className="block space-y-1">
          <span className="font-bold">영어 문장</span>
          <textarea className={input} value={answer} onChange={event => setAnswer(event.target.value)} rows={3} maxLength={300} lang="en" spellCheck={false} autoComplete="off" autoCorrect="off" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className={primary} type="submit" disabled={pending || !answer.trim()}>{isRetry ? '다시 쓴 답 제출' : '첫 답 제출'}</button>
          {isRetry && !state.hint_used && <button className={secondary} type="button" disabled={pending} onClick={() => void send('hint')}>힌트 보기</button>}
        </div>
        {error && <p role="alert">저장하지 못했어요. 화면을 새로 열어 진행 상태를 확인한 뒤 다시 시도해 주세요.</p>}
      </form>
    )}
  </article>;
}

function PlanPreview({ plan }: { plan: FollowupPlan }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <div className="rounded-xl border border-[#dce4f4] bg-white p-3"><h4 className="font-bold">다음 개별수업</h4><p className="mt-1 whitespace-pre-wrap break-words">{plan.lesson}</p></div>
    <div className="rounded-xl border border-[#dce4f4] bg-white p-3"><h4 className="font-bold">다음 숙제</h4><p className="mt-1 whitespace-pre-wrap break-words">{plan.homework}</p></div>
  </div>;
}

function StudentEvidence({ row, approve, busy }: { row: FollowupRow; approve: (plan: FollowupPlan) => void; busy: boolean }) {
  const [draft, setDraft] = useState<FollowupPlan | null>(null);
  const [editing, setEditing] = useState(false);
  const state = row.state;
  if (!state) return null;
  const recommendation = recommendCaillouFollowup(state);
  const approved = row.approved_lesson !== null && row.approved_homework !== null
    ? { lesson: row.approved_lesson, homework: row.approved_homework } : null;

  function openPlan() {
    if (recommendation) setDraft(recommendation.plan);
  }

  return <div className="space-y-3">
    {!state.first_grade && <p className="text-sm">{state.available ? '숙제 응답 대기 중' : state.opens_at ? `${transferDate(state.opens_at)}에 숙제가 열려요.` : '개별수업을 마친 다음 날 열려요.'}</p>}
    {state.first_grade && <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="font-bold">힌트 없이 쓴 첫 답</dt><dd className="break-words" lang="en">{row.first_answer}</dd><dd>{transferGradeLabels[state.first_grade]}</dd>{row.first_at && <dd>{transferDate(row.first_at)} 제출</dd>}</div>
      <div><dt className="font-bold">힌트</dt><dd>{state.hint_used ? '사용함' : '사용하지 않음'}</dd></div>
      {row.retry_answer && <div><dt className="font-bold">다시 쓴 답</dt><dd className="break-words" lang="en">{row.retry_answer}</dd><dd>{state.retry_grade && transferGradeLabels[state.retry_grade]}</dd></div>}
    </dl>}
    {state.first_grade && !row.lesson_version_recorded && <p className="text-sm text-[#526186]">학생에게 제공된 개별수업 버전 기록이 없어요.</p>}
    {!state.done && state.first_grade && <p className="text-sm">재시도 답변 대기 중</p>}
    {recommendation && <div className="space-y-3 border-t border-[#dce4f4] pt-3">
      <p className="text-sm">{recommendation.reason}</p>
      {approved ? <>
        <p role="status" className="font-bold text-[#14563b]">승인한 계획 · 배정 전</p>
        <PlanPreview plan={approved} />
      </> : !draft ? <button type="button" className={primary} onClick={openPlan}>추천 미리보기</button> : <>
        {editing ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); setEditing(false); }}>
          <label className="block space-y-1"><span className="font-bold">다음 개별수업 수정</span><textarea className={input} rows={3} required maxLength={1000} value={draft.lesson} onChange={event => setDraft({ ...draft, lesson: event.target.value })} /></label>
          <label className="block space-y-1"><span className="font-bold">다음 숙제 수정</span><textarea className={input} rows={3} required maxLength={1000} value={draft.homework} onChange={event => setDraft({ ...draft, homework: event.target.value })} /></label>
          <button type="submit" className={primary} disabled={!draft.lesson.trim() || !draft.homework.trim()}>수정 반영</button>
        </form> : <>
          <PlanPreview plan={draft} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondary} disabled={busy} onClick={() => setEditing(true)}>수정</button>
            <button type="button" className={primary} disabled={busy} onClick={() => approve(draft)}>계획 승인</button>
            <button type="button" className={secondary} disabled={busy} onClick={() => setDraft(null)}>나중에</button>
          </div>
        </>}
      </>}
    </div>}
  </div>;
}

export function CaillouFollowupTeacher({ api, revision = 0 }: { api: TeacherTransferApi; revision?: number }) {
  const [rows, setRows] = useState<FollowupRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    void api('list').then(result => { if (active) setRows(result); }, cause => {
      if (active) setError(cause.code === 'PGRST202' ? '다음 날 숙제 기능을 이 서버에서 준비 중이에요.' : '숙제 상태를 불러오지 못했어요.');
    });
    return () => { active = false; };
  }, [api, refresh, revision]);

  async function save(action: 'enable' | 'approve', id: string, plan?: FollowupPlan) {
    setBusy(true);
    setError(null);
    try {
      setRows(await api(action, id, plan));
    } catch {
      setError('저장하지 못했어요. 상태를 새로고침한 뒤 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="space-y-4 text-[#142e51]" aria-label="카이유 1차시 다음 날 숙제">
    <div className="flex flex-wrap gap-2">
      <button type="button" className={secondary} aria-expanded={showPrompt} onClick={() => setShowPrompt(!showPrompt)}>첫 문항 미리보기</button>
      <button type="button" className={secondary} disabled={busy} onClick={() => { setError(null); setRefresh(value => value + 1); }}>결과 새로고침</button>
    </div>
    {showPrompt && <p className="rounded-xl border border-[#dce4f4] bg-white p-3">{CAILLOU_TRANSFER_PROMPT}</p>}
    {error && <p role="alert">{error}</p>}
    {rows === null && !error && <p>불러오는 중이에요.</p>}
    {rows?.length === 0 && <p>카이유 1차시를 개별수업으로 배정하면 여기에 학생이 표시돼요.</p>}
    {rows?.map(row => <article key={row.assignment_id} aria-label={row.name} className="space-y-3 rounded-2xl border border-[#dce4f4] bg-[#f5f8ff] p-4">
      <h3 className="font-bold">{row.name}</h3>
      {row.lesson_changed ? <p>수업 단계가 바뀌어 이 숙제를 열 수 없어요.</p> : row.enabled ? <StudentEvidence row={row} busy={busy} approve={plan => void save('approve', row.assignment_id, plan)} /> : (
        row.target_selected ? <button type="button" className={primary} disabled={busy} onClick={() => void save('enable', row.assignment_id)}>다음 날 숙제 연결</button>
          : <p>수업에 by myself가 선택되어 있어야 연결할 수 있어요.</p>
      )}
    </article>)}
  </section>;
}
