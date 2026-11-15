import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GrammarWordEntry } from '../lib/grammarCoreWords';
import '../i18n/grammarLessonLocales';

export default function GrammarWordPicker({ candidates, decision, onDecision, busy }: {
  candidates: GrammarWordEntry[];
  decision: string[] | null;
  onDecision: (ids: string[] | null) => void;
  busy: boolean;
}) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith('ko');
  const [ids, setIds] = useState(() => decision?.length ? decision : candidates.slice(0, 4).map(entry => entry.id));
  const action = 'min-h-11 rounded-full border border-outline-variant px-4 text-sm font-bold aria-pressed:bg-primary aria-pressed:text-white disabled:opacity-50';
  function update(next: string[]) {
    setIds(next);
    onDecision(null);
  }
  const choices = (entries: GrammarWordEntry[]) => entries.map(word => (
    <label key={word.id} className="flex min-h-9 items-center gap-2">
      <input type="checkbox" checked={ids.includes(word.id)} onChange={event => {
        update(event.target.checked ? [...ids, word.id] : ids.filter(id => id !== word.id));
      }} />
      <span>{word.label}{ko ? ` · ${word.meaning}` : ''}</span>
    </label>
  ));
  return <fieldset disabled={busy} className="space-y-2 rounded-xl border border-outline-variant bg-white p-3">
    <legend className="px-1 font-bold">{t('grammarLesson.coreTitle')}</legend>
    <p className="text-sm">{t('grammarLesson.coreHelp')}</p>
    {choices(candidates.slice(0, 4))}
    {candidates.length > 4 && <details>
      <summary className="cursor-pointer font-bold text-primary">{t('grammarLesson.coreMore', { count: candidates.length })}</summary>
      <p className="mt-2 text-sm">{t('grammarLesson.coreVolume')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 px-2 text-sm font-bold text-primary" onClick={() => update(candidates.map(entry => entry.id))}>{t('grammarLesson.coreSelectAll')}</button>
        <button type="button" className="min-h-11 px-2 text-sm font-bold text-primary" onClick={() => update(candidates.slice(0, 4).map(entry => entry.id))}>{t('grammarLesson.coreReset')}</button>
      </div>
      <div className="mt-2 grid gap-x-3 sm:grid-cols-2">{choices(candidates.slice(4))}</div>
    </details>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!ids.length} aria-pressed={!!decision?.length} className={action} onClick={() => onDecision(ids)}>{t('grammarLesson.coreConfirm', { count: ids.length })}</button>
      <button type="button" aria-pressed={decision?.length === 0} className={action} onClick={() => onDecision([])}>{t('grammarLesson.coreSkip')}</button>
    </div>
    <p role="status" className="text-sm font-bold">{decision ? decision.length ? t('grammarLesson.coreConfirmed', { count: decision.length }) : t('grammarLesson.coreSkipped') : ''}</p>
  </fieldset>;
}
