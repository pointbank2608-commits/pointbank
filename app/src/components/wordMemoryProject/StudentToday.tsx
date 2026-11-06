import type { ReactNode } from 'react';
import { StudioCard } from '../studio/StudioKit';
import { dateKoSmart, estimateMinutesForAsks, fmt, studentTodayView, type StudentTodayView } from './model';
import { useL } from './useL';
import type { WmToday } from '../../lib/wordMemory/types';

type L = (ko: string, en: string) => string;
const dateText = (iso: string, today: string, en: boolean) => (en ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC', ...(iso.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }) }) : dateKoSmart(iso, today));

/**
 * 단어 프로젝트(wm-v2): 학생의 "오늘 할 학습" 화면. 버튼은 하나(시작 또는 이어서). 내부 점수·단계 이름은 보이지 않는다.
 * 입력은 서버의 wm_today_state 응답 그대로다(project 가 있는 새 계획만 이 화면을 쓴다).
 * 날짜는 서버가 준 한국 날짜(today.day, next_due, goal_date)만 쓴다.
 */
export default function StudentToday({ today, studentName, title, onStart, onCollection }: {
  today: WmToday; studentName: string; title: string; onStart: () => void; onCollection?: () => void;
}) {
  const { l, en } = useL();
  const v = studentTodayView(today);
  const date = (iso: string) => dateText(iso, today.day, en);
  return (
    <StudioCard label={l('오늘 할 학습', "Today's study")} barSpace={v.mode === 'run'}>
      <div data-wmp-mode={v.mode} className="space-y-5">
        <header className="text-center">
          <p className="text-sm font-bold text-[#5b6580]">{studentName}</p>
          <h1 className="mt-1 text-xl font-extrabold leading-snug">{title}</h1>
        </header>
        {v.total !== null && v.verified !== null && <Verified l={l} date={date} verified={v.verified} total={v.total} goalDate={v.goalDate} goalPassed={v.goalPassed} done={v.mode === 'completed'} />}
        {v.mode === 'run' && <Run l={l} v={v} onStart={onStart} />}
        {v.mode === 'doneToday' && <DoneToday l={l} date={date} v={v} onCollection={onCollection} />}
        {v.mode === 'nothing' && <Nothing l={l} date={date} v={v} onCollection={onCollection} />}
        {v.mode === 'completed' && <Completed l={l} v={v} onCollection={onCollection} />}
        {v.mode === 'ended' && <Ended l={l} onCollection={onCollection} />}
      </div>
    </StudioCard>
  );
}

function Verified({ l, date, verified, total, goalDate, goalPassed, done }: { l: L; date: (iso: string) => string; verified: number; total: number; goalDate: string | null; goalPassed: boolean; done: boolean }) {
  const pct = Math.round((verified / Math.max(1, total)) * 100);
  return (
    <section aria-label={l('내가 익힌 단어', 'Words I have learned')} className="rounded-2xl border border-[#eadfc5] bg-[#fffdf8] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-[#5b6580]">{l('내가 익힌 단어', 'Words I have learned')}</h2>
        <p className="text-lg font-extrabold tabular-nums" data-wmp-verified><span>{fmt(verified)}</span><span className="text-sm font-bold text-[#5b6580]"> / {fmt(total)}{l('개', '')}</span></p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#e6dcc4]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={l('익힌 단어 비율', 'Share of words learned')}>
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }} />
      </div>
      <p className="mt-2 text-xs text-[#5b6580]">{l('며칠 간격을 두고 도움 없이 맞힌 단어만 세요.', 'Only words you got right on your own, days apart, are counted.')}</p>
      {goalDate && !done && (
        <p className="mt-2 text-sm" data-wmp-goal>
          {goalPassed
            ? l(`목표일(${date(goalDate)})이 지났어요. 괜찮아요, 남은 단어도 이어서 배워요.`, `The target date (${date(goalDate)}) has passed. That's okay, keep learning the rest.`)
            : <>{l(`목표일 ${date(goalDate)}`, `Target date ${date(goalDate)}`)} <span className="text-[#5b6580]">{l('(예상 일정이에요)', '(an estimate)')}</span></>}
        </p>
      )}
    </section>
  );
}

function Tile({ icon, tone, n, label }: { icon: string; tone: string; n: number; label: string }) {
  return (
    <li className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border p-3 text-center ${tone}`} data-wmp-tile={label}>
      <span aria-hidden="true" className="material-symbols-outlined text-[26px]">{icon}</span>
      <span className="text-3xl font-extrabold tabular-nums">{n}</span>
      <span className="text-sm font-bold">{label}</span>
    </li>
  );
}

function Run({ l, v, onStart }: { l: L; v: StudentTodayView; onStart: () => void }) {
  const m = estimateMinutesForAsks(v.asks);
  const resume = v.action === 'resume';
  const heading = resume ? l('하던 학습을 이어서 해요', 'Pick up where you left off') : v.reviewOnly ? l('오늘은 복습만 해요', 'Review only today') : l('오늘 할 학습', "Today's study");
  return (
    <>
      <section aria-label={l('오늘 분량', "Today's amount")} className="space-y-3">
        <h2 className="text-center text-2xl font-extrabold">{heading}</h2>
        <ul className="flex gap-2">
          {v.fresh > 0 && <Tile icon="auto_awesome" tone="border-sky-300 bg-sky-50 text-sky-900" n={v.fresh} label={l('새 단어', 'New words')} />}
          {v.review > 0 && <Tile icon="replay" tone="border-emerald-300 bg-emerald-50 text-emerald-900" n={v.review} label={l('복습', 'Review')} />}
          {v.again > 0 && <Tile icon="refresh" tone="border-amber-300 bg-amber-50 text-amber-900" n={v.again} label={l('다시 확인', 'Check again')} />}
        </ul>
        <p className="text-center text-sm text-[#5b6580]">{l(`문제 ${v.asks}개 · 약 ${m.min}~${m.max}분`, `${v.asks} questions · about ${m.min}–${m.max} min`)}{resume && <> · {l('남은 문항', 'Left')} <b data-wmp-remaining>{v.remaining}</b></>}</p>
        {v.waiting > 0 && <p className="rounded-xl bg-[#eef1ff] p-3 text-center text-sm" data-wmp-waiting>{l(`남은 복습 ${v.waiting}개는 다음 날들에 나눠서 해요. 오늘은 이만큼만 하면 돼요.`, `${v.waiting} more reviews will be spread over the next days. Today's amount is all you need.`)}</p>}
        {v.goalPassed && <p className="sr-only">{l('목표일이 지나도 남은 학습은 이어져요.', 'Learning continues after the target date.')}</p>}
      </section>
      <StartBar label={resume ? l('이어서 하기', 'Continue') : l('오늘 할 학습 시작', "Start today's study")} onClick={onStart} />
    </>
  );
}

function StartBar({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#eadfc5] bg-[#f8f1e3]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl justify-center">
        <button type="button" onClick={onClick} data-wmp-start data-wm-start className="min-h-14 w-full rounded-full bg-[#3b5bdb] px-8 text-xl font-bold text-white shadow active:scale-95 sm:max-w-sm">{label}</button>
      </div>
    </div>
  );
}

function Plain({ icon, tone, title, children }: { icon: string; tone: string; title: string; children?: ReactNode }) {
  return (
    <section className="space-y-3 text-center" role="status">
      <span aria-hidden="true" className={`material-symbols-outlined text-[56px] ${tone}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      <h2 className="text-2xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function Next({ l, date, v }: { l: L; date: (iso: string) => string; v: StudentTodayView }) {
  return (
    <ul className="space-y-1 text-base text-[#3a4560]">
      {v.waiting > 0 && <li data-wmp-waiting>{l(`남은 복습 ${v.waiting}개는 다음 날들에 나눠서 해요.`, `${v.waiting} more reviews will be spread over the next days.`)}</li>}
      {v.nextDue && <li data-wmp-next-due>{l('다음 복습은 ', 'Next review: ')}<b>{date(v.nextDue)}</b>{l('이에요.', '.')}</li>}
      {v.unseen > 0 && <li>{l(`아직 만나지 않은 단어가 ${fmt(v.unseen)}개 있어요. 하루에 조금씩 만나요.`, `${fmt(v.unseen)} words are still new. You'll meet them a little each day.`)}</li>}
    </ul>
  );
}

function Collection({ l, onClick }: { l: L; onClick?: () => void }) {
  return onClick ? <button type="button" onClick={onClick} data-wm-open-collection className="min-h-12 rounded-full border border-[#d9d3c3] bg-white px-6 font-bold">{l('내 단어 모음 보기', 'See my words')}</button> : null;
}

function DoneToday({ l, date, v, onCollection }: { l: L; date: (iso: string) => string; v: StudentTodayView; onCollection?: () => void }) {
  return <Plain icon="celebration" tone="text-amber-500" title={l('오늘 학습 끝!', "Today's study is done!")}><Next l={l} date={date} v={v} /><Collection l={l} onClick={onCollection} /></Plain>;
}

function Nothing({ l, date, v, onCollection }: { l: L; date: (iso: string) => string; v: StudentTodayView; onCollection?: () => void }) {
  return <Plain icon="bedtime" tone="text-[#5b6580]" title={l('오늘은 할 학습이 없어요', 'Nothing to study today')}><Next l={l} date={date} v={v} /><Collection l={l} onClick={onCollection} /></Plain>;
}

function Completed({ l, v, onCollection }: { l: L; v: StudentTodayView; onCollection?: () => void }) {
  return (
    <Plain icon="emoji_events" tone="text-amber-500" title={l('프로젝트 완료!', 'Project complete!')}>
      <p className="text-base text-[#3a4560]">{l(`전체 ${fmt(v.total ?? 0)}개 단어를 모두 확인했어요. 정말 잘했어요.`, `You confirmed all ${fmt(v.total ?? 0)} words. Great job!`)}</p>
      <Collection l={l} onClick={onCollection} />
    </Plain>
  );
}

function Ended({ l, onCollection }: { l: L; onCollection?: () => void }) {
  return <Plain icon="flag" tone="text-[#5b6580]" title={l('학습 기간이 끝났어요', 'The study period has ended')}><p className="text-base text-[#3a4560]">{l('그동안 모은 단어를 볼 수 있어요.', 'You can see the words you collected.')}</p><Collection l={l} onClick={onCollection} /></Plain>;
}
