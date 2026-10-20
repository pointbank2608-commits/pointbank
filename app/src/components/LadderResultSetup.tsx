import { useTranslation } from 'react-i18next';
import { ladderSlots, type LadderResultDraft, type LadderResultSlot } from '../lib/ladderSetup';
import { guideButton } from './GameCreateButton';

interface Props { draft: LadderResultDraft; count: number; onChange: (draft: LadderResultDraft) => void }
export default function LadderResultSetup({ draft, count, onChange }: Props) {
  const { t } = useTranslation();
  const slots = ladderSlots(draft, count);
  const missing = slots.filter(s => !s.miss && !s.label.trim()).length;
  function update(index: number, patch: Partial<LadderResultSlot>) {
    const next = [...draft.slots];
    next[index] = { ...slots[index], ...patch };
    // Keep temporarily removed columns so adding a participant back restores their result.
    onChange({ ...draft, slots: Array.from({ length: Math.max(next.length, count) }, (_, i) => next[i] || slots[i]) });
  }
  return <section className="space-y-3 rounded-2xl border bg-sky-50/50 p-4" aria-label={t('guide.ladder.title')}>
    <h3 className="text-xl font-bold">{t('guide.ladder.title')}</h3>
    <p>{t('guide.ladder.hint', { count })}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {slots.map((slot, i) => <div key={i} className="space-y-2 rounded-xl border bg-white p-3">
        <label className="block font-bold">{t('guide.ladder.result', { n: i + 1 })}
          <input data-ladder-result={i} className="mt-1 w-full rounded-xl border p-3 font-normal focus-visible:outline-primary disabled:bg-slate-100" value={slot.miss ? t('guide.ladder.miss') : slot.label} disabled={slot.miss} placeholder={t('guide.ladder.placeholder')} onChange={e => update(i, { label: e.target.value })} />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="checkbox" checked={slot.miss} onChange={e => update(i, { miss: e.target.checked })} />{t('guide.ladder.markMiss', { n: i + 1 })}</label>
      </div>)}
    </div>
    <p aria-live="polite" className="font-bold">{t(missing ? 'guide.ladder.missing' : 'guide.ladder.complete', { count: missing || count })}</p>
    <button type="button" className={guideButton} disabled={!missing} onClick={() => {
      const next = [...draft.slots];
      slots.forEach((s, i) => { next[i] = !s.label.trim() ? { ...s, miss: true } : s; });
      onChange({ ...draft, slots: next });
    }}>{t('guide.ladder.fillMiss')}</button>
    <fieldset className="space-y-2 border-t pt-3"><legend className="font-bold">{t('guide.ladder.order')}</legend>
      {(['input', 'random'] as const).map(order => <label key={order} className="flex min-h-11 cursor-pointer items-center gap-2"><input type="radio" name="ladder-result-order" value={order} checked={draft.order === order} onChange={() => onChange({ ...draft, order })} />{t(`guide.ladder.${order}`)}</label>)}
      <p className="text-sm">{t('guide.ladder.orderHint')}</p>
    </fieldset>
  </section>;
}
