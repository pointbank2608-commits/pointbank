import { useState, type ReactNode } from 'react';
import { dateKoSmart, fmt, groupSections, progressBuckets, sectionFill, sectionSizeFor } from './model';
import { useL } from './useL';
import type { WmDailyMode, WmProgressStudent } from '../../lib/wordMemory/types';

/** 시안 하네스가 학생 옆에 붙이는 메모(실제 서버 응답에는 없다) */
export type ProgressRow = WmProgressStudent & { note?: string };

const MODE_KO: Record<WmDailyMode, string> = { light: '가볍게', normal: '보통', plus: '넉넉히' };
const MODE_EN: Record<WmDailyMode, string> = { light: 'Light', normal: 'Normal', plus: 'Plenty' };

type L = (ko: string, en: string) => string;
const dateText = (iso: string, today: string, en: boolean) => (en ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC', ...(iso.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }) }) : dateKoSmart(iso, today));

/**
 * 단어 프로젝트(wm-v2) 교사 진행 화면. 학생마다 전체 · 확인됨 · 아직 확인 부족 · 오답 후 다시 확인 · 오늘 복습 대기를 보여 준다.
 *  - "확인됨"은 며칠 간격을 두고 도움 없이 맞힌 근거가 있는 단어다. 오늘 복습 대기는 다른 분류와 겹칠 수 있어 막대에 더하지 않는다.
 *  - 목표일은 예상 일정이라 지나도 학습은 이어진다(표시만 하고 재촉하지 않는다). 날짜는 서버(한국 날짜) 값 `today`를 쓴다.
 *  - 사용자 지정 상한 안에서 자동으로 조절된 오늘 분량을 보여 준다.
 *  - 서버 구간(50개)은 화면에서 묶어 20구간 이하로 보여 준다.
 */
export default function TeacherProgress({ rows, words, sectionSize, today, planMode, initialNewWords, onOpenNextSteps, rowExtra }: {
  rows: ProgressRow[]; words: number; sectionSize: number; today: string; planMode?: WmDailyMode; initialNewWords?: number | null; onOpenNextSteps?: () => void;
  /** 학생 줄 아래에 붙일 단추(예: 학부모 요약 복사) */
  rowExtra?: (r: ProgressRow) => ReactNode;
}) {
  const { l, en } = useL();
  const [open, setOpen] = useState<string | null>(null);
  const shown = sectionSizeFor(words, sectionSize);
  const date = (iso: string) => dateText(iso, today, en);
  const modeName = (m: WmDailyMode) => (en ? MODE_EN : MODE_KO)[m];
  return (
    <section className="space-y-3 text-[#1c2742]" data-wmp-progress>
      <header className="space-y-1">
        <h3 className="text-lg font-extrabold">{l(`전체 ${fmt(words)}개 · ${shown}개씩 ${Math.ceil(words / shown)}구간`, `${fmt(words)} words · ${Math.ceil(words / shown)} groups of ${shown}`)}</h3>
        <p className="text-sm text-on-surface-variant" data-wmp-adjust-note>
          {l('최근 학습과 복습 기록에 따라 학생별 새 단어 분량을 자동 조절해요.', 'New word loads adjust automatically for each student based on recent practice and reviews.')}{' '}
          {onOpenNextSteps && <button type="button" onClick={onOpenNextSteps} data-wmp-next-steps className="min-h-11 font-bold text-primary underline">{l('다음 단계 카드 보기', 'Open Next steps')}</button>}
        </p>
      </header>
      <dl className="grid gap-2 rounded-xl border border-outline-variant bg-white p-3 text-sm sm:grid-cols-2" aria-label={l('진행 분류 설명', 'Progress categories')}>
        <Legend color="bg-emerald-600" term={l('확인됨', 'Confirmed')} desc={l('며칠 간격을 두고 도움 없이 맞힌 단어', 'Right on their own, days apart')} />
        <Legend color="bg-amber-500" term={l('오답 후 다시 확인', 'Recheck after a miss')} desc={l('틀린 뒤 다시 확인하는 중인 단어', 'Missed, being checked again')} />
        <Legend color="bg-[#cfc7b0]" term={l('아직 확인 부족', 'Not confirmed yet')} desc={l('아직 근거가 모자란 단어(안 만난 단어 포함)', 'Not enough evidence yet (incl. unseen)')} />
        <Legend color="bg-sky-500" term={l('오늘 복습 대기', 'Review due today')} desc={l('오늘 복습 차례인 단어(다른 분류와 겹칠 수 있어요)', 'Due today (may overlap the others)')} />
      </dl>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.student_id} className="rounded-xl border border-outline-variant bg-white p-4" data-wmp-row={r.student_id} data-wmp-kind={r.project ? 'project' : 'legacy'}>
            {r.project ? <ProjectRow l={l} date={date} r={r} modeName={modeName} planMode={planMode} initialNewWords={initialNewWords} /> : <LegacyRow l={l} r={r} words={words} />}
            <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" aria-expanded={open === r.student_id} onClick={() => setOpen(open === r.student_id ? null : r.student_id)} className="min-h-11 rounded-full border border-outline-variant px-4 text-sm font-bold">
              {open === r.student_id ? l('구간 접기', 'Hide groups') : l('구간별로 보기', 'Show by group')}
            </button>
            {rowExtra?.(r)}
            </div>
            {open === r.student_id && <SectionMap l={l} r={r} groupSize={shown} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Legend({ color, term, desc }: { color: string; term: string; desc: string }) {
  return <div className="flex items-start gap-2"><span aria-hidden="true" className={`mt-1 h-3 w-3 shrink-0 rounded-full ${color}`} /><div><dt className="font-bold">{term}</dt><dd className="text-on-surface-variant">{desc}</dd></div></div>;
}

const Badge = ({ children, tone = 'bg-[#f3ecd7]' }: { children: ReactNode; tone?: string }) => <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{children}</span>;

function ProjectRow({ l, date, r, modeName, planMode, initialNewWords }: { l: L; date: (iso: string) => string; r: ProgressRow; modeName: (m: WmDailyMode) => string; planMode?: WmDailyMode; initialNewWords?: number | null }) {
  const p = r.project!;
  const b = progressBuckets(p);
  const adjusted = r.current_mode && planMode && r.current_mode !== planMode;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-lg font-extrabold">{r.name}</h4>
        {p.completed && <Badge tone="bg-emerald-100 text-emerald-900">{l('완료', 'Done')}</Badge>}
        {!p.completed && p.goal_passed && <Badge tone="bg-[#e8edff] text-[#2b3f9e]">{l(`목표일(${date(p.goal_date)}) 지남 · 학습은 이어져요`, `Target date (${date(p.goal_date)}) passed · learning continues`)}</Badge>}
        {!p.completed && !p.goal_passed && <Badge>{l(`목표일 ${date(p.goal_date)}(예상)`, `Target ${date(p.goal_date)} (estimate)`)}</Badge>}
        {initialNewWords != null && <Badge>{l(`새 단어 상한 ${fmt(initialNewWords)}개`, `Up to ${fmt(initialNewWords)} new words`)}</Badge>}
        {r.today_new_words != null && <Badge tone="bg-sky-100 text-sky-900">{l(`오늘 새 단어 ${fmt(r.today_new_words)}개`, `${fmt(r.today_new_words)} new today`)}</Badge>}
        {initialNewWords == null && r.current_mode && <Badge tone={adjusted ? 'bg-amber-100 text-amber-900' : undefined}>{l(`하루 분량 ${modeName(r.current_mode)}${adjusted ? '(조정됨)' : ''}`, `Daily load ${modeName(r.current_mode)}${adjusted ? ' (adjusted)' : ''}`)}</Badge>}
        {r.note && <Badge>{r.note}</Badge>}
      </div>
      <p className="mt-2 text-sm"><span className="text-2xl font-extrabold tabular-nums" data-wmp-verified>{fmt(b.verified)}</span> <span className="text-on-surface-variant">{l(`/ 전체 ${fmt(b.total)}개 확인됨 (${Math.round(b.pct.verified)}%)`, `/ ${fmt(b.total)} confirmed (${Math.round(b.pct.verified)}%)`)}</span></p>
      <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-[#e6dcc4]" role="img" aria-label={l(`확인됨 ${fmt(b.verified)}, 오답 후 다시 확인 ${fmt(b.needsReview)}, 아직 확인 부족 ${fmt(b.unconfirmed)}`, `Confirmed ${fmt(b.verified)}, recheck ${fmt(b.needsReview)}, not confirmed ${fmt(b.unconfirmed)}`)}>
        <span className="bg-emerald-600" style={{ width: `${b.pct.verified}%` }} />
        <span className="bg-amber-500" style={{ width: `${b.pct.needsReview}%` }} />
        <span className="bg-[#cfc7b0]" style={{ width: `${b.pct.unconfirmed}%` }} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
        <Stat dot="bg-emerald-600" term={l('확인됨', 'Confirmed')} n={b.verified} />
        <Stat dot="bg-amber-500" term={l('오답 후 다시 확인', 'Recheck')} n={b.needsReview} />
        <Stat dot="bg-[#cfc7b0]" term={l('아직 확인 부족', 'Not confirmed')} n={b.unconfirmed} />
        <Stat dot="bg-sky-500" term={l('오늘 복습 대기', 'Due today')} n={b.reviewDue} />
      </dl>
      {!b.consistent && <p role="alert" className="mt-2 rounded-lg bg-error-container p-2 text-sm" data-wmp-inconsistent>{l('집계 합계가 전체와 달라요. 새로고침해도 같으면 알려 주세요.', 'The counts do not add up to the total. If it persists after refresh, please report it.')}</p>}
    </>
  );
}

function Stat({ dot, term, n }: { dot: string; term: string; n: number }) {
  return <div className="flex items-baseline gap-1"><span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 translate-y-px rounded-full ${dot}`} /><dt className="text-on-surface-variant">{term}</dt><dd className="font-extrabold tabular-nums">{fmt(n)}</dd></div>;
}

/** 기존 wm-v1 계획 학생: 프로젝트 분류가 없으니 만난 단어·며칠 뒤에도 기억한 단어만 보여 준다 */
function LegacyRow({ l, r, words }: { l: L; r: ProgressRow; words: number }) {
  const keptPct = (r.kept / Math.max(1, words)) * 100;
  const metPct = (Math.max(0, r.met - r.kept) / Math.max(1, words)) * 100;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2"><h4 className="text-lg font-extrabold">{r.name}</h4><Badge tone="bg-[#ece5d1]">{l('기존 방식(wm-v1)', 'Classic (wm-v1)')}</Badge></div>
      <p className="mt-2 text-sm"><span className="text-2xl font-extrabold tabular-nums">{fmt(r.kept)}</span> <span className="text-on-surface-variant">{l(`/ ${fmt(words)}개 며칠 뒤에도 기억함 · 만난 단어 ${fmt(r.met)}개`, `/ ${fmt(words)} remembered days later · ${fmt(r.met)} met`)}</span></p>
      <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-[#e6dcc4]" role="img" aria-label={l(`며칠 뒤에도 기억함 ${r.kept}, 만난 단어 ${r.met}, 전체 ${words}`, `Remembered ${r.kept}, met ${r.met}, total ${words}`)}>
        <span className="bg-emerald-600" style={{ width: `${keptPct}%` }} />
        <span className="bg-sky-400" style={{ width: `${metPct}%` }} />
      </div>
    </>
  );
}

function SectionMap({ l, r, groupSize }: { l: L; r: ProgressRow; groupSize: number }) {
  const groups = groupSections(r.sections, groupSize);
  return (
    <div className="mt-3" data-wmp-sections={r.student_id}>
      <p className="mb-2 text-sm text-on-surface-variant">{l('구간마다 며칠 뒤에도 기억한 단어 비율이에요.', 'Share of each group remembered days later.')}</p>
      <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {groups.map((s) => {
          const pct = Math.round(sectionFill(s) * 100);
          return (
            <li key={s.n} className="relative overflow-hidden rounded-lg border border-[#e1d8bd] bg-[#fffdf8] px-2 py-1.5 text-xs" title={`${s.from}~${s.to} · ${s.kept}/${s.size}`}>
              <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-emerald-200/80" style={{ width: `${pct}%` }} />
              <span className="relative block font-bold tabular-nums">{fmt(s.from)}~{fmt(s.to)}</span>
              <span className="relative block text-on-surface-variant">{pct}%</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
