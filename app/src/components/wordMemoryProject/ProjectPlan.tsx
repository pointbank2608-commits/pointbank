import { useMemo } from 'react';
import { addDays, dateKoLong, dateKoSmart, fmt, projectSchedule, rangeSections, sectionSizeFor } from './model';
import { useL } from './useL';
import { dailyBudget } from '../../lib/wordMemory/plan';
import type { WmDailyMode } from '../../lib/wordMemory/types';

const MODE_KO: Record<WmDailyMode, string> = { light: '가볍게', normal: '보통', plus: '넉넉히' };
const MODE_EN: Record<WmDailyMode, string> = { light: 'Light', normal: 'Normal', plus: 'Plenty' };

/** 전체 범위와 구간(서버 50개 구간을 화면에서 묶어 20구간 이하로) */
export function RangeSummary({ name, total }: { name: string; total: number }) {
  const { l } = useL();
  const size = sectionSizeFor(total);
  const sections = useMemo(() => rangeSections(total, size), [total, size]);
  return (
    <section className="rounded-xl bg-surface-container-low p-4" aria-label={l('전체 범위', 'Full range')} data-wmp-range>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-on-surface-variant">{l('전체 범위', 'Full range')}</div>
          <div className="text-sm text-on-surface-variant">{name} · {l(`${size}개씩 ${sections.length}구간`, `${sections.length} groups of ${size}`)}</div>
        </div>
        <p className="text-2xl font-extrabold tabular-nums" data-wmp-total>{fmt(total)}{l('개', '')}</p>
      </div>
      {sections.length > 1 && (
        <details className="mt-1">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-primary">{l('구간 보기', 'Show groups')}</summary>
          <ol className="grid grid-cols-2 gap-1 text-sm tabular-nums sm:grid-cols-3" data-wmp-sections>
            {sections.map((s) => <li key={s.n} className="rounded-lg bg-white px-2 py-1">{l(`${s.n}구간 · `, `#${s.n} · `)}{fmt(s.from)}~{fmt(s.to)}</li>)}
          </ol>
        </details>
      )}
    </section>
  );
}

/**
 * 목표일(예상) + 예상 일정. 서버의 목표일은 "시작일 + 공부 기간 + 복습 기간"이라, 교사가 고른 목표일에서 복습 기간을 뺀 값을 공부 기간으로 넘긴다.
 * 목표일에 못 맞는 경우에도 하루 분량·목표일을 자동으로 바꾸지 않는다 — 교사가 단추를 눌러야 바뀐다.
 */
export function GoalSchedule({ total, mode, today, goal, reviewDays, onGoal, onMode, onReviewDays, newWordLimit, reviewOptions = [0, 7, 14, 21, 30, 45, 60, 90] }: {
  total: number; mode: WmDailyMode; today: string; goal: string; reviewDays: number; newWordLimit?: number;
  onGoal: (iso: string) => void; onMode: (m: WmDailyMode) => void; onReviewDays: (d: number) => void; reviewOptions?: number[];
}) {
  const { l, en } = useL();
  const sch = useMemo(() => projectSchedule({ total, mode, start: today, goal, reviewDays, newWordLimit }), [total, mode, today, goal, reviewDays, newWordLimit]);
  const d = (iso: string) => (en ? iso : dateKoSmart(iso, today));
  const modeName = (m: WmDailyMode) => (en ? MODE_EN : MODE_KO)[m];
  const field = 'min-h-11 rounded-xl border border-outline-variant bg-white px-3 text-base text-deep-navy';
  const doneBy = addDays(today, sch.introDays - 1 + reviewDays);
  return (
    <section className="space-y-3 rounded-xl border border-outline-variant p-4" aria-label={l('목표일과 예상 일정', 'Target date and schedule')} data-wmp-fits={sch.valid ? String(sch.fits) : 'invalid'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-on-surface-variant">{l('목표일(예상)', 'Target date (estimate)')}
          <input type="date" value={goal} min={addDays(today, 3)} onChange={(e) => e.target.value && onGoal(e.target.value)} data-wmp-goal className={`${field} mt-1 w-full`} />
        </label>
        <label className="block text-sm font-bold text-on-surface-variant">{l('소개 뒤 확인 복습 기간', 'Review period after introductions')}
          <select value={reviewDays} onChange={(e) => onReviewDays(+e.target.value)} className={`${field} mt-1 w-full`} data-wmp-review-days>
            {reviewOptions.map((n) => <option key={n} value={n}>{l(`${n}일`, `${n} days`)}</option>)}
          </select>
        </label>
      </div>
      <p className="text-sm text-on-surface-variant">{l('목표일은 예상 일정이에요. 목표일이 지나도 남은 학습은 이어져요.', 'The target date is an estimate. Learning continues after it passes.')}</p>
      {!sch.valid ? (
        <p role="alert" className="font-bold text-error" data-wmp-invalid>
          {sch.reason === 'too_long' ? l('목표일은 시작일로부터 3,650일 안으로 정해 주세요.', 'Pick a target within 3,650 days.') : l('목표일이 너무 가까워요. 복습 기간을 빼고도 공부 기간이 3일 이상 되도록 정해 주세요.', 'The target is too soon. Study time (after the review period) must be at least 3 days.')}
        </p>
      ) : (
        <div className="space-y-2" data-wmp-schedule>
          <p>{newWordLimit === undefined
            ? l(`하루 새 단어 ${sch.newPerDay}개 · 모든 단어를 처음 만나기까지 약 `, `${sch.newPerDay} new words a day · about `)
            : l(`매일 상한 ${sch.newPerDay}개씩 학습한다면 모든 단어를 처음 만나기까지 약 `, `At the limit of ${sch.newPerDay} new words a day, about `)}<b>{l(`${fmt(sch.introDays)}일`, `${fmt(sch.introDays)} days`)}</b>{l(`(${d(sch.introEnd)}쯤)`, ` to meet them all (around ${d(sch.introEnd)})`)}</p>
          <p>{l('확인 복습까지 마치는 예상일 ', 'Estimated finish with review ')}<b>{en ? doneBy : dateKoLong(doneBy)}</b></p>
          {sch.fits ? (
            <p className="rounded-xl bg-emerald-50 p-3 text-emerald-900" data-wmp-fit-ok>{l('목표일 안에 모든 단어를 만날 수 있어요(예상).', 'You can meet every word by the target date (estimate).')}</p>
          ) : (
            <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-amber-950" data-wmp-fit-warn>
              <p>{l(`이 분량으로는 목표일(${d(goal)})까지 모든 단어를 처음 만나기 어려워요. 목표일 안에 하려면 하루 새 단어가 약 ${sch.requiredPerDay}개 필요해요.`, `At this load you may not meet every word by ${d(goal)}. You would need about ${sch.requiredPerDay} new words a day.`)}</p>
              <div className="flex flex-wrap gap-2">
                {newWordLimit === undefined && sch.neededMode && sch.neededMode !== mode && (
                  <button type="button" data-wmp-raise onClick={() => onMode(sch.neededMode!)} className="min-h-11 rounded-full border-2 border-amber-700 px-4 font-bold">
                    {l(`하루 분량을 ‘${modeName(sch.neededMode)}’(새 단어 ${dailyBudget(sch.neededMode).newMax}개)로 바꾸기`, `Switch to “${modeName(sch.neededMode)}” (${dailyBudget(sch.neededMode).newMax} new words)`)}
                  </button>
                )}
                <button type="button" data-wmp-move-goal onClick={() => onGoal(doneBy)} className="min-h-11 rounded-full border-2 border-amber-700 px-4 font-bold">
                  {l(`목표일을 예상 일정(${d(doneBy)})으로 바꾸기`, `Move the target to the estimate (${d(doneBy)})`)}
                </button>
              </div>
              <p className="text-sm">{l('바꾸지 않고 승인해도 돼요. 목표일이 지나도 남은 학습은 이어져요.', 'You can approve as is. Learning continues after the target date.')}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
