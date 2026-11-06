import { useMemo, useRef, useState } from 'react';
import { DAILY_MODES, MODE_LABEL, addDays, projectSchedule } from './model';
import { GoalSchedule, RangeSummary } from './ProjectPlan';
import { dailyBudget } from '../../lib/wordMemory/plan';
import type { WmAssignInput, WmDailyMode } from '../../lib/wordMemory/types';

export type ApprovalInput = Pick<WmAssignInput, 'requestId' | 'title' | 'studentIds' | 'mode' | 'studyDays' | 'reviewDays'>;
export interface ApprovalResult { duplicate: boolean; created: number }

const box = 'rounded-2xl border border-[#eadfc5] bg-white p-4';
const label = 'text-sm font-bold text-[#5b6580]';

/**
 * 단어 프로젝트: 교사가 전체 범위·하루 분량 상한·목표일을 보고 한 번 승인한다.
 * 목표일은 예상 일정이다(지나도 남은 학습은 이어진다). 승인한 하루 분량은 이 화면에서 자동으로 바뀌지 않는다 —
 * 목표일에 못 맞는 경우에도 "이 분량으로 바꾸기"를 교사가 눌러야 바뀐다.
 * 같은 승인 요청의 재시도는 requestId 가 같아 서버에서 중복을 만들지 않는다(wm_project_assign).
 */
export default function TeacherApproval({ sourceName, total, students, today, onApprove }: {
  sourceName: string; total: number; students: { id: string; name: string }[]; today: string;
  onApprove: (input: ApprovalInput) => Promise<ApprovalResult>;
}) {
  const [mode, setMode] = useState<WmDailyMode>('normal');
  const [goal, setGoal] = useState(addDays(today, 420));
  const [reviewDays, setReviewDays] = useState(14);
  const [picked, setPicked] = useState<string[]>(students.map((s) => s.id));
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ApprovalResult | null>(null);
  const requestId = useRef(crypto.randomUUID()); // 이 승인 하나에 요청 번호 하나(재시도도 같은 번호)
  const sch = useMemo(() => projectSchedule({ total, mode, start: today, goal, reviewDays }), [total, mode, today, goal, reviewDays]);
  const canApprove = sch.valid && picked.length > 0 && state !== 'sending' && state !== 'done';

  async function approve() {
    setState('sending');
    try {
      const r = await onApprove({ requestId: requestId.current, title: sourceName, studentIds: picked, mode, studyDays: sch.studyDays, reviewDays });
      setResult(r);
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (canApprove) void approve(); }} className="mx-auto max-w-2xl space-y-4 p-4 text-[#1c2742]" data-wmp-approval>
      <header>
        <p className={label}>단어 프로젝트 배정</p>
        <h1 className="text-2xl font-extrabold">한 번 승인하면 학생마다 오늘 할 학습이 자동으로 정해져요</h1>
      </header>

      <RangeSummary name={sourceName} total={total} />

      <fieldset className={box}>
        <legend className="px-1 font-extrabold">하루 분량 상한</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {DAILY_MODES.map((m) => {
            const bm = dailyBudget(m);
            const on = mode === m;
            return (
              <label key={m} className={`flex min-h-16 cursor-pointer flex-col justify-center rounded-xl border-2 px-3 py-2 ${on ? 'border-[#3b5bdb] bg-[#e8edff]' : 'border-[#d9d3c3] bg-[#fffdf8]'}`}>
                <span className="flex items-center gap-2 font-bold"><input type="radio" name="mode" checked={on} onChange={() => setMode(m)} className="h-5 w-5 accent-[#3b5bdb]" />{MODE_LABEL[m]}</span>
                <span className="text-sm text-[#5b6580]">새 단어 하루 {bm.newMax}개 · 문제 최대 {bm.asks}개</span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-[#5b6580]">승인한 하루 분량은 고정돼요. 늘리려면 선생님이 다시 승인해야 해요(자동으로 늘어나지 않아요).</p>
      </fieldset>

      <GoalSchedule total={total} mode={mode} today={today} goal={goal} reviewDays={reviewDays} onGoal={setGoal} onMode={setMode} onReviewDays={setReviewDays} />

      <fieldset className={box}>
        <legend className="px-1 font-extrabold">대상 학생 {picked.length}/{students.length}명</legend>
        <ul className="mt-1 grid gap-1 sm:grid-cols-2">
          {students.map((s) => (
            <li key={s.id}><label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-[#f8f1e3]">
              <input type="checkbox" checked={picked.includes(s.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} className="h-5 w-5 accent-[#3b5bdb]" />{s.name}</label></li>
          ))}
        </ul>
      </fieldset>

      <div className="space-y-2">
        <button type="submit" disabled={!canApprove} data-wmp-approve className="min-h-14 w-full rounded-full bg-[#3b5bdb] text-xl font-bold text-white shadow disabled:opacity-50">
          {state === 'sending' ? '배정하는 중…' : state === 'done' ? '배정했어요' : state === 'error' ? '다시 시도' : '승인하고 배정하기'}
        </button>
        {state === 'done' && result && <p role="status" data-wmp-result className="rounded-xl bg-emerald-50 p-3 text-emerald-900">{result.duplicate ? '이미 배정된 요청이에요. 중복으로 만들지 않았어요.' : `${result.created}명에게 배정했어요.`}</p>}
        {state === 'error' && <p role="alert" data-wmp-error className="rounded-xl bg-rose-50 p-3 text-rose-900">배정을 확인하지 못했어요. 다시 시도해도 같은 요청이라 두 번 만들어지지 않아요.</p>}
      </div>
    </form>
  );
}
