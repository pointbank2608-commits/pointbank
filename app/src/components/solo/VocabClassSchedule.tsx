import { useEffect, useState } from 'react';
import {
  cueDate, cueLabel, essentialCueKey, nextCueClass, readCueSchedule, saveCueSchedule,
  type CueMode, type CueSchedule, type EssentialCue,
} from '../../lib/vocabCues';
import type { PathCard } from '../../lib/learningPaths';

const inputStyle = 'min-h-11 rounded-xl border border-outline-variant bg-white px-3 py-2';
const dayNumbers = [1, 2, 3, 4, 5, 6, 7];
const labels = (en: boolean) => en ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['월', '화', '수', '목', '금', '토', '일'];

export function cueWeekdays(days: number[], en: boolean) {
  return days.map(day => labels(en)[day - 1]).join(' · ');
}

export default function VocabClassSchedule({ classId, en, onLoaded, disabled = false }: {
  classId: string; en: boolean; onLoaded: (schedule: CueSchedule) => void; disabled?: boolean;
}) {
  const l = (ko: string, english: string) => en ? english : ko;
  const [schedule, setSchedule] = useState<CueSchedule | null>(null);
  const [classDays, setClassDays] = useState<number[]>([]);
  const [reviewDays, setReviewDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    readCueSchedule(classId).then(result => {
      if (!active || !result || typeof result.revision !== 'number') return;
      setSchedule(result);
      setClassDays(result.class_days);
      setReviewDays(result.review_days);
      setError('');
      onLoaded(result);
    }).catch(cause => {
      if (!active) return;
      if (cause instanceof Error && cause.message === 'path_not_ready') setMissing(true);
      else setError('load');
    });
    return () => { active = false; };
  }, [classId, refresh, onLoaded]);

  async function save() {
    if (!schedule || !classDays.length || busy || disabled) return;
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      const result = await saveCueSchedule(classId, schedule.revision, classDays, reviewDays);
      setSchedule(result);
      setClassDays(result.class_days);
      setReviewDays(result.review_days);
      onLoaded(result);
      setSaved(true);
    } catch (cause) { setError(cause instanceof Error && cause.message.includes('schedule_changed') ? 'conflict' : 'save'); }
    finally { setBusy(false); }
  }

  if (missing || (!schedule && !error)) return null;
  function picker(name: string, days: number[], update: (days: number[]) => void) {
    return <fieldset className="space-y-1"><legend className="font-bold">{name}</legend>
      <div className="flex flex-wrap gap-1">{dayNumbers.map(day => <label className="flex min-h-11 cursor-pointer items-center gap-1 rounded-full border px-3" key={day}>
        <input type="checkbox" checked={days.includes(day)} onChange={event => {
          update(event.target.checked ? [...days, day].sort() : days.filter(value => value !== day));
          setSaved(false);
        }}/>{labels(en)[day - 1]}
      </label>)}</div>
    </fieldset>;
  }
  const changed = schedule && (classDays.join() !== schedule.class_days.join() || reviewDays.join() !== schedule.review_days.join());
  return <details className="space-y-3 rounded-2xl border border-outline-variant p-4">
    <summary className="min-h-11 cursor-pointer py-2 font-bold">{l('반 수업·복습 요일 설정','Class lesson and review days')}
      {schedule?.revision ? <span className="ml-2 text-sm font-normal">
        {cueWeekdays(schedule.class_days, en)} / {cueWeekdays(schedule.review_days, en) || l('자동 복습 없음','No automatic reviews')}
      </span> : null}
    </summary>
    <p className="text-sm">{l('한국 시간 기준이에요. 복습 요일을 비우면 새 계획에서 자동 복습을 열지 않아요. 저장한 설정은 이후 승인하는 계획에 적용됩니다.','Times are in Korea. Leave review days empty to turn off automatic reviews for new plans. Changes apply to plans approved afterward.')}</p>
    {schedule && <fieldset disabled={busy || disabled || error === 'conflict'} className="space-y-3">
      {picker(l('대면 수업 요일','Class days'), classDays, setClassDays)}
      {picker(l('집 복습 요일','Review days'), reviewDays, setReviewDays)}
      <button type="button" className="min-h-11 rounded-full bg-primary px-5 font-bold text-on-primary disabled:opacity-40"
        disabled={!changed || !classDays.length} onClick={() => void save()}>{l('요일 저장','Save days')}</button>
      <button type="button" className="ml-2 min-h-11 underline" disabled={!!changed} onClick={() => setRefresh(value => value + 1)}>
        {l('저장된 요일 다시 읽기','Reload saved days')}</button>
    </fieldset>}
    {saved && <p role="status" className="text-sm">{l('반 요일을 저장했어요.','Class days saved.')}</p>}
    {error && <p role="alert" className="text-error">{error === 'conflict' ? l('다른 곳에서 반 요일이 바뀌었어요. 최신 설정을 확인해 주세요.','Class days changed elsewhere. Reload the latest settings.') :
      l('반 요일 설정을 처리하지 못했어요.','Could not load or save class days.')}
      <button type="button" className="ml-2 min-h-11 underline" onClick={() => setRefresh(value => value + 1)}>{l('설정 다시 조회','Reload settings')}</button>
    </p>}
  </details>;
}

export function EssentialCuePicker({ cards, modes, selected, onChange, en }: {
  cards: PathCard[]; modes: readonly CueMode[]; selected: EssentialCue[]; onChange: (goals: EssentialCue[]) => void; en: boolean;
}) {
  if (!cards.length || !modes.length) return null;
  const keys = new Set(selected.map(essentialCueKey));
  return <fieldset className="space-y-2 rounded-xl border border-outline-variant p-3">
    <legend className="px-1 font-bold">{en ? 'Essential before the next class' : '다음 수업 전 필수 목표'}</legend>
    <p className="text-sm">{en ? 'Pick the specific cues students need. Remaining essential goals appear separately in feedback.' :
      '다음 수업에서 꼭 써야 하는 단서만 골라 주세요. 남은 필수 목표는 피드백에 따로 표시해요.'}</p>
    {cards.map(card => <fieldset className="border-t border-outline-variant/50 pt-2" key={JSON.stringify([card.word, card.meaning])}>
      <legend className="font-bold">{card.word} · {card.meaning}</legend>
      <div className="flex flex-wrap gap-2">{modes.map(mode => {
        const goal = { word: card.word, meaning: card.meaning, mode };
        const key = essentialCueKey(goal);
        return <label className="flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm" key={mode}>
          <input type="checkbox" checked={keys.has(key)} onChange={event => onChange(event.target.checked ?
            [...selected, goal] : selected.filter(item => essentialCueKey(item) !== key))}/>{cueLabel(mode, en)}
        </label>;
      })}</div>
    </fieldset>)}
  </fieldset>;
}

export function VocabPlanTiming({ schedule, en, nextClass, onNextClass, opens, onOpens, homework = false, hasEssential }: {
  schedule: CueSchedule; en: boolean; nextClass: string; onNextClass: (value: string) => void;
  opens?: string; onOpens?: (value: string) => void; homework?: boolean; hasEssential: boolean;
}) {
  const l = (ko: string, english: string) => en ? english : ko;
  const expected = nextClass || nextCueClass(schedule, opens ?? '') || '';
  return <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
    {onOpens && <label className="flex flex-wrap items-center gap-2"><span>{l('학생에게 열리는 날짜 · 선택','Opens on · optional')}</span>
      <input type="date" className={inputStyle} min={schedule.today} value={opens ?? ''} onChange={event => onOpens(event.target.value)}/>
      <span className="text-sm">{l('비우면 승인 직후 열려요.','Leave empty to open on approval.')}</span>
    </label>}
    {!homework && <label className="flex flex-wrap items-center gap-2"><span>{l('다음 대면 수업일','Next class date')}</span>
      <input type="date" className={inputStyle} value={expected} onChange={event => onNextClass(event.target.value)}/>
    </label>}
    {hasEssential && <p className="text-sm">{l('필수 목표는 열린 뒤 최대 24시간 동안 우선 연습해요. 다음 수업일이 먼저 오면 그날 0시까지의 답을 따로 집계합니다.','Essential goals get up to 24 hours of priority practice. If the next class comes earlier, answers are tracked up to midnight before that class.')}</p>}
    {!homework && schedule.revision > 0 && <p className="text-sm">{schedule.review_days.length
      ? l(`자동 복습 요일 ${cueWeekdays(schedule.review_days, en)}`, `Automatic review days ${cueWeekdays(schedule.review_days, en)}`)
      : l('자동 복습 없음','No automatic reviews')}</p>}
    {opens && <p className="text-sm">{l('시작 예정','Scheduled opening')} · {cueDate(opens, en)}</p>}
  </div>;
}
