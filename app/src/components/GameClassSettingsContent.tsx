import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassRow, GameItem } from '../lib/types';

export type ClassPlayMode = 'none' | 'solo' | 'team';
const button = 'min-h-11 rounded-xl border border-outline-variant bg-white px-4 py-2 text-base font-bold text-deep-navy focus-visible:outline-4 focus-visible:outline-primary disabled:opacity-40';

/** One class-settings layout for standard games, phonics and lesson editing. */
export default function GameClassSettingsContent({ classes, classId, students, loading, absentIds, mode, teams, maxTeams = 4,
  autoTurn, showAutoTurn = true, hint, busy, error, onClass, onAbsent, onMode, onTeams, onAutoTurn, onOrder, onApply, onClose,
}: {
  classes: ClassRow[]; classId: string; students: GameItem[]; loading: boolean; absentIds: string[];
  mode: ClassPlayMode; teams: number; maxTeams?: number; autoTurn: boolean; showAutoTurn?: boolean; hint?: string;
  busy?: boolean; error?: string | null;
  onClass: (id: string) => void; onAbsent: (ids: string[]) => void; onMode: (mode: ClassPlayMode) => void;
  onTeams: (count: number) => void; onAutoTurn: (on: boolean) => void; onOrder: () => void;
  onApply: () => void; onClose: () => void;
}) {
  const { i18n } = useTranslation();
  const text = (ko: string, en: string) => i18n.language.startsWith('en') ? en : ko;
  const [absentOpen, setAbsentOpen] = useState(false);
  useEffect(() => setAbsentOpen(false), [classId]);
  const effective = students.filter(row => !absentIds.includes(row.id));
  const chip = (selected: boolean) => `${button} min-w-16 ${selected ? 'ring-2 ring-primary' : ''}`;
  return <>
    <div className="sticky top-0 z-10 -mx-4 mb-1 flex items-center justify-between gap-2 rounded-t-2xl border-b border-outline-variant bg-white px-4 py-3">
      <p className="text-lg font-extrabold">{text('반 설정', 'Class settings')}</p>
      <button type="button" className={button} onClick={onClose}>{text('닫기', 'Close')}</button>
    </div>
    <div className="space-y-3 pb-8" data-class-settings-fields>
      {classes.length > 0 && <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
        <label className="block text-sm font-bold">{text('반', 'Class')}
          <select className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 font-normal" value={classId} onChange={event => onClass(event.target.value)}>
            <option value="">{text('반 없이 하기', 'No class')}</option>
            {classes.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>
        {classId && <p className="text-sm" aria-live="polite">
          {loading ? text('학생 명단을 불러오는 중…', 'Loading students…') : students.length > 0
            ? <>{text(`학생 ${students.length}명: `, `${students.length} students: `)}<span className="font-semibold">{students.slice(0, 8).map(row => row.label).join(', ')}{students.length > 8 ? ' …' : ''}</span></>
            : text('이 반에는 학생이 없어요. 학생·출석 메뉴에서 먼저 추가해 주세요.', 'This class has no students yet.')}
        </p>}
      </div>}
      {classId && students.length > 0 && <div className="space-y-2">
        <button type="button" className={button} aria-expanded={absentOpen} onClick={() => setAbsentOpen(on => !on)}>
          {text('결석 학생 제외', 'Exclude absent students')}{absentIds.length > 0 ? text(` (${absentIds.length}명)`, ` (${absentIds.length})`) : ''}
        </button>
        {absentOpen && <div className="rounded-xl border border-outline-variant p-3">
          <p className="mb-2 text-sm text-on-surface-variant">{text('오늘 빠지는 학생을 체크하세요. 차례와 팀에서 빠져요.', 'Check students who are absent today.')}</p>
          <div className="flex flex-wrap gap-2">{students.map(row => {
            const gone = absentIds.includes(row.id);
            return <label key={row.id} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 font-bold ${gone ? 'border-error bg-error-container/40 text-error line-through' : 'border-outline-variant bg-white'}`}>
              <input type="checkbox" className="h-5 w-5" checked={gone} onChange={event => onAbsent(event.target.checked ? [...absentIds, row.id] : absentIds.filter(id => id !== row.id))} />
              {row.label}
            </label>;
          })}</div>
        </div>}
      </div>}
      <div className="space-y-2">
        <p className="text-sm font-bold">{text('참여 방식', 'How to play')}</p>
        <div className="flex flex-wrap items-center gap-2">
          {(['none', 'solo', 'team'] as const).map((value, i) => <button key={value} type="button" className={chip(mode === value)} aria-pressed={mode === value} onClick={() => onMode(value)}>{[text('없음', 'None'), text('개인', 'Solo'), text('팀', 'Teams')][i]}</button>)}
        </div>
        {mode === 'team' && <div className="flex items-center gap-3" role="group" aria-label={text('팀 수', 'Number of teams')}>
          <span className="text-sm font-bold">{text('팀 수', 'Teams')}</span>
          <button type="button" className={button} aria-label={text('팀 하나 줄이기', 'Fewer teams')} disabled={teams <= 2} onClick={() => onTeams(Math.max(2, teams - 1))}>−</button>
          <span className="min-w-12 text-center text-2xl font-extrabold tabular-nums text-deep-navy">{teams}{text('팀', '')}</span>
          <button type="button" className={button} aria-label={text('팀 하나 늘리기', 'More teams')} disabled={teams >= maxTeams} onClick={() => onTeams(Math.min(maxTeams, teams + 1))}>＋</button>
        </div>}
        <p className="text-xs text-on-surface-variant">{hint ?? text('개인·팀을 고르면 도구줄 아래에 지금 차례가 보여요. 팀은 "적용"을 누르면 학생이 무작위로 나뉘어요. 직접 바꾸려면 아래 팀·순서 정하기를 쓰세요.', 'Press Apply to split students into random teams. Use Set teams and order to adjust by hand.')}</p>
      </div>
      {mode !== 'none' && showAutoTurn && <label className="flex min-h-11 items-center gap-2 font-bold">
        <input type="checkbox" className="h-5 w-5" checked={autoTurn} onChange={event => onAutoTurn(event.target.checked)} />
        {text('한 판이 끝나면 자동으로 다음 차례로 넘기기', 'Move to the next turn automatically')}
      </label>}
      {!loading && effective.length > 0 && mode !== 'none' && <button type="button" className={button} onClick={onOrder}>{text('팀·순서 정하기 (반 명단)', 'Set teams and order')}</button>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
    <div className="sticky bottom-0 z-10 -mx-4 -mb-4 rounded-b-2xl border-t border-outline-variant bg-white px-4 py-3">
      <button type="button" className="min-h-11 w-full rounded-xl bg-primary px-5 py-2 text-base font-bold text-white focus-visible:outline-4 focus-visible:outline-primary disabled:opacity-40" disabled={busy || loading || !!error} onClick={onApply}>{text('적용', 'Apply')}</button>
    </div>
  </>;
}
