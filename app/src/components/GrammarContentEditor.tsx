import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type GrammarBoardContent } from '../lib/grammar';
import AccessibleDialog from './AccessibleDialog';

export default function GrammarContentEditor({ initial, onClose, onSave, saveLabel }: {
  initial: GrammarBoardContent;
  onClose: () => void;
  onSave: (content: GrammarBoardContent) => Promise<void> | void;
  saveLabel: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [examples, setExamples] = useState(() => initial.examples.map((en, i) => ({ en, ko: initial.translations?.[i] ?? '' })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const input = 'block min-h-10 w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-on-surface';
  const label = 'grid gap-1 text-sm font-semibold text-on-surface';
  async function save() {
    if (saving.current) return;
    if (!draft.name.trim() || !draft.pattern.trim() || !examples.length || examples.some(row => !row.en.trim())) {
      setError(t('myGrammar.required')); return;
    }
    saving.current = true;
    setBusy(true);
    try {
      const clean = (rows?: string[]) => (rows ?? []).map(row => row.trim()).filter(Boolean);
      await onSave({ ...draft, name: draft.name.trim(), pattern: draft.pattern.trim(),
        examples: examples.map(row => row.en.trim()), translations: examples.some(row => row.ko.trim()) ? examples.map(row => row.ko.trim()) : [],
        rule: clean(draft.rule), usage: clean(draft.usage), detail: clean(draft.detail),
        pitfalls: (draft.pitfalls ?? []).filter(row => row.wrong.trim() || row.right.trim() || row.why.trim()) });
      onClose();
    } catch { setError(t('myGrammar.saveFailed')); }
    finally { saving.current = false; setBusy(false); }
  }
  return <AccessibleDialog label={t('myGrammar.edit')} onClose={() => { if (!saving.current) onClose(); }}>
    <div className="space-y-4 p-5">
      <h2 className="text-xl font-bold">{t('myGrammar.edit')}</h2>
      {(['name','pattern','explain'] as const).map(key => <label className={label} key={key}>{t('myGrammar.' + key)}
        <input className={input} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />
      </label>)}
      <label className={label}>{t('myGrammar.rule')}<textarea className={input} value={draft.rule?.join('\n') ?? ''} onChange={e => setDraft({ ...draft, rule: e.target.value.split('\n') })} /></label>
      <fieldset className="space-y-2"><legend className="font-bold">{t('myGrammar.examples')}</legend>
        {examples.map((row, i) => <div key={i} className="grid gap-2 rounded-lg bg-surface-container-low p-2 sm:grid-cols-[1fr_1fr_auto]">
          {(['en','ko'] as const).map(key => <label key={key} className={label}>{i+1}. {t('myGrammar.' + key)}
            <input className={input} value={row[key]} onChange={e => setExamples(examples.map((r, j) => j === i ? { ...r, [key]: e.target.value } : r))} />
          </label>)}
          <button type="button" className="self-end p-2" onClick={() => setExamples(examples.filter((_, j) => i !== j))}>{t('myGrammar.remove')}</button>
        </div>)}
        <button type="button" className="font-bold text-primary" onClick={() => setExamples([...examples, { en:'', ko:'' }])}>{t('myGrammar.addExample')}</button>
      </fieldset>
      <details className="space-y-3"><summary className="cursor-pointer font-bold">{t('myGrammar.more')}</summary>
        {(['usage','detail'] as const).map(key => <label key={key} className={label}>{t('myGrammar.'+key)}
          <textarea className={input} value={draft[key]?.join('\n') ?? ''} onChange={e => setDraft({ ...draft, [key]: e.target.value.split('\n') })} />
        </label>)}
        <label className={label}>{t('myGrammar.tip')}<input className={input} value={draft.tip ?? ''} onChange={e => setDraft({ ...draft, tip: e.target.value })} /></label>
        {(draft.pitfalls ?? []).map((row, i) => <div key={i} className="space-y-1 rounded-lg border p-2">
          {(['wrong','right','why'] as const).map(key => <label key={key} className={label}>{t('myGrammar.' + key)}
            <input className={input} value={row[key]} onChange={e => setDraft({ ...draft, pitfalls: draft.pitfalls?.map((r,j) => j === i ? { ...r, [key]: e.target.value } : r) })} />
          </label>)}
          <button type="button" onClick={() => setDraft({ ...draft, pitfalls: draft.pitfalls?.filter((_, j) => j !== i) })}>{t('myGrammar.remove')}</button>
        </div>)}
        <button type="button" className="font-bold text-primary" onClick={() => setDraft({ ...draft, pitfalls: [...(draft.pitfalls ?? []), { wrong:'', right:'', why:'' }] })}>{t('myGrammar.addPitfall')}</button>
      </details>
      {error && <p role="alert" className="text-error">{error}</p>}
      <footer className="sticky bottom-0 flex justify-end gap-3 bg-white py-2">
        <button type="button" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-white" onClick={() => void save()}>{saveLabel}</button>
      </footer>
    </div>
  </AccessibleDialog>;
}
