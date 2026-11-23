import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { grammarBoardContent, grammarPoint, type GrammarBoardContent, type GrammarPoint } from '../lib/grammar';
import { PresentSyncContext } from '../lib/presentSync';
import AccessibleDialog from './AccessibleDialog';
import GrammarBoard, { type GrammarBoardEditor, type GrammarField } from './GrammarBoard';
import './GrammarContentEditor.css';

type TextRange = { key: GrammarField; index?: number };

export default function GrammarContentEditor({ point, themeId, inline, onClose, onSave, onSaveCopy, saveLabel }: {
  point: GrammarPoint;
  themeId?: string | null;
  inline?: boolean;
  onClose: () => void;
  onSave: (content: GrammarBoardContent) => Promise<void> | void;
  onSaveCopy?: (content: GrammarBoardContent) => Promise<void>;
  saveLabel: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => structuredClone(grammarBoardContent(point)));
  const [selected, setSelected] = useState<TextRange | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copyName, setCopyName] = useState<string | null>(null);
  const catalogPoint = grammarPoint(point.id);
  const saving = useRef(false);
  const original = useRef('');
  const focusInput = useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);
  const fieldButton = useRef<HTMLButtonElement>(null);
  function change(key: GrammarField, value: string, index = 0) {
    setDraft(prev => {
      if (key === 'rule' || key === 'detail' || key === 'usage') return { ...prev, [key]: value.split('\n') };
      if (key === 'en' || key === 'ko') {
        const prop = key === 'en' ? 'examples' : 'translations';
        const rows = prev.examples.map((_, i) => i === index ? value : prev[prop]?.[i] ?? '');
        return { ...prev, [prop]: rows };
      }
      if (key === 'wrong' || key === 'right' || key === 'why') {
        return { ...prev, pitfalls: prev.pitfalls?.map((row, i) => i === index ? { ...row, [key]: value } : row) };
      }
      return { ...prev, [key]: value };
    });
    setError('');
  }
  function begin(key: GrammarField, value: string, index?: number) {
    original.current = value;
    setSelected({ key, index });
    setEditing(true);
  }
  function finishField() {
    setEditing(false);
    requestAnimationFrame(() => fieldButton.current?.focus());
  }
  function field(key: GrammarField, value: string, display: ReactNode, index?: number) {
    const label = (index === undefined ? '' : (index + 1) + '. ') + t('myGrammar.' + key);
    const active = selected?.key === key && selected.index === index;
    if (active && editing) return <textarea aria-label={label} className="grammar-inline-input"
      rows={Math.max(1, value.split('\n').length)} value={value} ref={focusInput}
      onBlur={e => { original.current = e.currentTarget.value; setEditing(false); }} onChange={e => change(key, e.target.value, index)}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === 'Escape') { e.preventDefault(); change(key, original.current, index); finishField(); }
        if (e.key === 'Enter' && !e.shiftKey && (e.ctrlKey || e.metaKey || !['rule','detail','usage'].includes(key))) {
          e.preventDefault(); finishField();
        }
      }} />;
    return <button type="button" ref={active ? fieldButton : undefined} aria-label={label} aria-pressed={active}
      className="grammar-field" onClick={() => { original.current = value; setSelected({ key, index }); }}
      onDoubleClick={() => begin(key, value, index)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); begin(key, value, index); }
      }}>{value.trim() ? display : <span className="opacity-75">{label}</span>}</button>;
  }
  const editor: GrammarBoardEditor = {
    field,
    addExample() {
      begin('en', '', draft.examples.length);
      setDraft(prev => ({ ...prev, examples: [...prev.examples, ''] }));
    },
    addPitfall() {
      begin('wrong', '', draft.pitfalls?.length ?? 0);
      setDraft(prev => ({ ...prev, pitfalls: [...(prev.pitfalls ?? []), { wrong: '', right: '', why: '' }] }));
    },
  };
  function remove() {
    const i = selected?.index;
    if (i === undefined) return;
    setDraft(prev => selected?.key === 'en' || selected?.key === 'ko'
      ? { ...prev, examples: prev.examples.filter((_, j) => j !== i), translations: prev.translations?.filter((_, j) => j !== i) }
      : { ...prev, pitfalls: prev.pitfalls?.filter((_, j) => j !== i) });
    setSelected(null);
    setEditing(false);
  }
  function restoreOriginal() {
    if (!catalogPoint) return;
    setDraft(structuredClone(grammarBoardContent(catalogPoint)));
    setSelected(null);
    setEditing(false);
    setError('');
  }
  async function save(copy = false) {
    if (saving.current) return;
    const name = (copy ? copyName ?? '' : draft.name).trim();
    if (!name || !draft.pattern.trim() || !draft.examples.length || draft.examples.some(en => !en.trim())) {
      setError(t('myGrammar.required')); return;
    }
    saving.current = true;
    setBusy(true);
    try {
      const clean = (rows?: string[]) => (rows ?? []).map(row => row.trim()).filter(Boolean);
      const content = { ...draft, name, pattern: draft.pattern.trim(), examples: draft.examples.map(en => en.trim()),
        translations: draft.translations?.some(ko => ko.trim()) ? draft.examples.map((_, i) => draft.translations?.[i]?.trim() ?? '') : [],
        rule: clean(draft.rule), usage: clean(draft.usage), detail: clean(draft.detail),
        pitfalls: draft.pitfalls?.filter(row => row.wrong.trim() || row.right.trim() || row.why.trim()) ?? [] };
      if (copy && onSaveCopy) {
        await onSaveCopy(content);
        setCopyName(null);
        setError('');
      } else {
        await onSave(content);
        onClose();
      }
    } catch { setError(t('myGrammar.saveFailed')); }
    finally { saving.current = false; setBusy(false); }
  }
  const body = <section aria-label={t('myGrammar.edit')} className="grammar-visual-editor space-y-2">
    <p className="text-sm text-on-surface-variant">{t('myGrammar.editHint')}</p>
    <div className="aspect-video w-full" onClickCapture={e => {
      if ((e.target as Element).closest('button:not(.grammar-field)')) setSelected(null);
    }}>
      <PresentSyncContext.Provider value={null}>
        <GrammarBoard point={{ ...point, ...draft }} themeId={themeId} keyboard={false} editor={editor} />
      </PresentSyncContext.Provider>
    </div>
    {error && copyName === null && <p role="alert" className="text-error">{error}</p>}
    <footer className="flex flex-wrap items-center gap-2">
      {selected && <><span className="text-sm">{selected.index !== undefined && (selected.index + 1) + '. '}{t('myGrammar.' + selected.key)}</span>
        {!editing && <button type="button" className="rounded-lg border px-2 py-1" onClick={() => setEditing(true)}>{t('common.edit')}</button>}
        {selected.index !== undefined && <button type="button" className="rounded-lg border px-2 py-1" onClick={remove}>{t('myGrammar.remove')}</button>}
      </>}
      <button type="button" className="ml-auto px-2 py-2" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
      {onSaveCopy && <button type="button" className="rounded-lg border px-3 py-2 font-bold text-primary" disabled={busy}
        onClick={() => { setCopyName(draft.name); setError(''); }}>{t('myGrammar.save')}</button>}
      {catalogPoint && <button type="button" className="rounded-lg border px-3 py-2" disabled={busy} onClick={restoreOriginal}>
        {t('myGrammar.restoreOriginal')}
      </button>}
      <button type="button" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-white" onClick={() => void save()}>{saveLabel}</button>
    </footer>
    {copyName !== null && <AccessibleDialog label={t('myGrammar.save')} onClose={() => { if (!saving.current) { setCopyName(null); setError(''); } }}>
      <div className="grid gap-4 p-5">
        <h2 className="text-lg font-bold">{t('myGrammar.save')}</h2>
        <label className="grid gap-1">{t('myGrammar.copyName')}
          <input className="rounded-lg border p-2" autoFocus value={copyName} onFocus={e => e.currentTarget.select()}
            onChange={e => setCopyName(e.target.value)} onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault(); if (copyName.trim()) void save(true);
              }
            }} />
        </label>
        {error && <p role="alert" className="text-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-2" disabled={busy} onClick={() => { setCopyName(null); setError(''); }}>{t('common.cancel')}</button>
          <button type="button" className="rounded-lg bg-primary px-4 py-2 text-white" disabled={busy || !copyName.trim()} onClick={() => void save(true)}>{t('common.save')}</button>
        </div>
      </div>
    </AccessibleDialog>}
  </section>;
  return inline ? body : <AccessibleDialog label={t('myGrammar.edit')} onClose={() => { if (!saving.current) onClose(); }}>
    <div className="p-4">{body}</div>
  </AccessibleDialog>;
}
