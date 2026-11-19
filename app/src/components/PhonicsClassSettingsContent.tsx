import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useClasses } from '../lib/useClasses';
import { loadAbsent, saveAbsent } from '../lib/absent';
import { loadTeamOrder, saveTeamOrder } from '../lib/teamOrder';
import { phonicsClassOrder, usePhonicsClassRoster } from '../lib/phonicsClassPlay';
import type { PhonicsClassPlay } from '../lib/types';
import GameClassSettingsContent from './GameClassSettingsContent';
import TeamOrderPanel from './TeamOrderPanel';

/** Phonics uses the same class picker, attendance and order editor as all other games. */
export default function PhonicsClassSettingsContent({ value, onApply, onClose }: {
  value: PhonicsClassPlay; onApply: (value: PhonicsClassPlay) => void; onClose: () => void;
}) {
  const { session, academy } = useAuth();
  const { i18n } = useTranslation();
  const text = (ko: string, en: string) => i18n.language.startsWith('en') ? en : ko;
  const { classes, loading, error } = useClasses(academy?.id);
  const [draft, setDraft] = useState(value);
  const roster = usePhonicsClassRoster(draft.classId);
  const effective = useMemo(() => roster.students.filter(row => !draft.absentIds.includes(row.id)), [roster.students, draft.absentIds]);
  const [orderOpen, setOrderOpen] = useState(false);
  const scope = `${session?.user.id}:${academy?.id}`;
  const patch = (value: Partial<PhonicsClassPlay>) => setDraft(old => ({...old, ...value}));
  const pickClass = (id: string) => patch({classId: id || null, absentIds: id ? loadAbsent(id) : [], order: undefined});
  function apply() {
    const previous = draft.order ?? loadTeamOrder(effective, scope);
    const order = phonicsClassOrder(effective, {...draft, order: previous});
    if (draft.mode === 'team' && (previous.mode !== 'team' || previous.teamCount !== draft.teamCount)) {
      const shuffled = [...effective].sort(() => Math.random() - 0.5);
      order.teamOf = Object.fromEntries(shuffled.map((row, i) => [row.id, i % order.teamCount]));
      order.order.sort(() => Math.random() - 0.5);
      order.turn = 0;
    }
    if (draft.classId) saveAbsent(draft.classId, draft.absentIds);
    if (draft.mode !== 'none') saveTeamOrder(effective, order, scope);
    onApply({...draft, order});
    onClose();
  }
  return <>
    <GameClassSettingsContent classes={classes} classId={draft.classId ?? ''} students={roster.students}
      loading={loading || roster.loading} error={error || roster.error ? text('반·학생 명단을 불러오지 못했어요. 닫았다가 다시 열어 주세요.', 'Could not load the class roster. Close and reopen this panel.') : null}
      absentIds={draft.absentIds} mode={draft.mode} teams={draft.teamCount} autoTurn={draft.autoTurn}
      onClass={pickClass} onAbsent={absentIds => patch({absentIds})}
      onMode={mode => {
        patch({mode});
        if (mode !== 'none' && !draft.classId && classes.length) pickClass(classes[0].id);
      }}
      onTeams={teamCount => patch({teamCount})} onAutoTurn={autoTurn => patch({autoTurn})}
      onOrder={() => {
        saveTeamOrder(effective, phonicsClassOrder(effective, {...draft, order: draft.order ?? loadTeamOrder(effective, scope)}), scope);
        setOrderOpen(true);
      }} onApply={apply} onClose={onClose} />
    {orderOpen && effective.length > 0 && <TeamOrderPanel key={`${draft.classId}:${draft.mode}:${draft.teamCount}:${effective.map(row => row.id).join(',')}`}
      scope={scope} roster={effective} fixedMode={draft.mode === 'team' ? 'team' : 'individual'} fixedTeams={draft.mode === 'team' ? draft.teamCount : undefined}
      onClose={() => { patch({order: loadTeamOrder(effective, scope)}); setOrderOpen(false); }} />}
  </>;
}
