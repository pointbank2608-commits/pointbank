import { useTranslation } from 'react-i18next';
import { PHONICS_RULES, PHONICS_STAGES, unitsForStep } from '../data/phonicsCurriculum';

/** Existing stage/rule browsers share one stable-ID unit picker and explicit extension opt-in. */
export default function PhonicsUnitControls({ step, ruleNames = [], unitId, onUnit, extensions, onExtensions }: {
  step: number; ruleNames?: string[]; unitId: string; onUnit: (id: string) => void;
  extensions: boolean; onExtensions: (on: boolean) => void;
}) {
  const { t } = useTranslation();
  const units = unitsForStep(step).filter(u => !ruleNames.length || ruleNames.includes(PHONICS_RULES.find(r => r.id === u.ruleId)!.name));
  const stage = PHONICS_STAGES.find(s => s.number === step);
  return <div className="no-print flex flex-wrap items-center gap-3">
    <span className="text-sm text-on-surface-variant">{t(`phonicsCourse.stage${stage?.number ?? step}`)}</span>
    <label className="max-w-full">{t('phonicsCourse.unit')} <select aria-label={t('phonicsCourse.unit')} value={unitId} onChange={e => onUnit(e.target.value)} className="max-w-full rounded-lg border border-outline-variant bg-surface p-2">
      <option value="">{t('phonicsCourse.allUnits')}</option>
      {units.map(u => <option key={u.id} value={u.id}>{u.order}. {u.name} · {u.entries.map(e => e.word).join(' · ')}</option>)}
    </select></label>
    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={extensions} onChange={e => onExtensions(e.target.checked)} />{t('phonicsCourse.extensions')}</label>
  </div>;
}
