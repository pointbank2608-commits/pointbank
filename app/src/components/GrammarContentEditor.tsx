import { useCallback, useRef, useState, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { grammarBoardContent, grammarPoint, type GrammarBoardContent, type GrammarPoint } from '../lib/grammar';
import { PresentSyncContext } from '../lib/presentSync';
import AccessibleDialog from './AccessibleDialog';
import GrammarBoard, { type GrammarBoardEditor, type GrammarBoardPosition, type GrammarField } from './GrammarBoard';
import './GrammarContentEditor.css';
import WorkshopEditor from './grammar/WorkshopEditor';
import {schoolOf} from '../../../supabase/functions/_shared/grammarWorkshop';

type TextRange = { key: GrammarField; index?: number };

export default function GrammarContentEditor({ point, themeId, inline, initialPosition, onPositionChange,
  initialRevealAll, initialShowKo, titleRef, onClose, onSave, onSaveCopy, saveLabel }: {
  point: GrammarPoint;
  themeId?: string | null;
  inline?: boolean;
  initialPosition?: GrammarBoardPosition;
  initialRevealAll?: boolean;
  initialShowKo?: boolean;
  onPositionChange?: (position: GrammarBoardPosition) => void;
  titleRef?: Ref<HTMLInputElement>;
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
  const [uploading,setUploading]=useState(false);
  const [stageIndex,setStageIndex]=useState(initialPosition?.step??0);
  const [requestedStage,setRequestedStage]=useState<{index:number}>();
  const trackPosition=useCallback((pos:GrammarBoardPosition)=>{
    if(pos.view==='lesson')setStageIndex(pos.step);
    onPositionChange?.(pos);
  },[onPositionChange]);
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
      if (key === 'prompt' || key === 'hint' || key === 'answer' || key === 'followUp') {
        if(prev.workshop && ((key==='prompt' && index===0)||(key==='answer' && index===5))){
          const w=prev.workshop, school=schoolOf(w.grade);
          return {...prev,workshop:{...w,scenes:{...w.scenes,[school]:{...w.scenes[school],[key==='prompt'?'opening':'model']:value}}}};
        }
        return { ...prev, steps: prev.steps?.map((step, i) => i === index ? { ...step, [key]: value } : step) };
      }
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
  const removable = selected && ['en', 'ko', 'wrong', 'right', 'why'].includes(selected.key);
  function remove() {
    const i = selected?.index;
    if (!removable || i === undefined) return;
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
    if (saving.current || uploading) return;
    const name = (copy ? copyName ?? '' : draft.name).trim();
    if (!name || !draft.pattern.trim() || !draft.examples.length || draft.examples.some(en => !en.trim())) {
      setError(t('myGrammar.required')); return;
    }
    if(draft.steps?.some(s=>s.practice?.panels?.some(line=>line.glosses && (line.glosses.length!==line.chunks.length || line.glosses.some(gloss=>!gloss.trim()))))){
      setError('영어 조각 하나마다 같은 줄에 우리말 뜻을 넣어 주세요.');return;
    }
    if(Object.values(draft.workshop?.overrides??{}).some(q=>
      !q.prompt.trim() || !q.answer.trim() || !q.reason.trim() || q.kind==='order'&&q.answer.trim().split(/\s+/).length<3 || q.options&&(
        !q.options.includes(q.answer)||q.options.some(s=>!s.trim())||new Set(q.options.map(s=>s.trim())).size!==q.options.length))){
      setError('심화 문제의 보기와 정답, 풀이를 확인해 주세요.');return;
    }
    if (draft.workshop && Object.values(draft.workshop.scenes).some(scene=>Object.values(scene).some(v=>!v.trim())) ||
        draft.steps?.some(({ prompt, hint, answer, followUp,practice },i) => [prompt, ...(draft.workshop ? (i===5 ? [followUp] : []) : [hint,answer,followUp]),
          ...(practice?.assembly??[]), ...(practice?.map?.flatMap(entry=>[entry.label,entry.text])??[]), ...(practice?.why.flat()??[]), ...(practice?.panels?.flatMap(p=>[p.meaning,p.label,...p.chunks])??[]),
          ...(practice && 'choices'in practice?practice.choices.flat():[])].some(value => !value.trim()))) {
      setError(t('myGrammar.stepsRequired')); return;
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
    <label className="grid gap-1 font-bold">{t('myGrammar.grammarTitle')}
      <input ref={titleRef} className="w-full rounded-lg border p-2 font-normal" value={draft.name}
        onChange={event => change('name', event.target.value)} />
    </label>
    <p className="text-sm text-on-surface-variant">{t('myGrammar.editHint')}</p>
    <div className={draft.workshop ? 'workshop-reading' : inline ? 'aspect-video w-full max-w-3xl' : 'aspect-video w-full'} onClickCapture={e => {
      if ((e.target as Element).closest('button:not(.grammar-field)')) setSelected(null);
    }}>
      <PresentSyncContext.Provider value={null}>
        <GrammarBoard point={{ ...point, ...draft }} mode="prepare" themeId={themeId} keyboard={false} editor={editor}
          initialPosition={initialPosition} onPositionChange={trackPosition} requestedStage={requestedStage}
          initialRevealAll={initialRevealAll} initialShowKo={initialShowKo} />
      </PresentSyncContext.Provider>
    </div>
    {draft.workshop && <WorkshopEditor draft={draft} setDraft={setDraft} onUploading={setUploading} index={stageIndex} onStage={index=>setRequestedStage({index})}/>}
    {draft.steps && draft.steps.length !== 6 && <details className="rounded-lg border p-3">
      <summary className="cursor-pointer font-bold">{t('myGrammar.sixSteps')}</summary>
      {draft.steps.map((step, index) => <fieldset key={index} className="my-3 grid gap-2">
        <legend className="font-bold">{index + 1}. {t('myGrammar.stage' + (index + 1))}</legend>
        {(['prompt', 'hint', 'answer', 'followUp'] as const).map(key => <label className="grid text-sm" key={key}>
          {t('myGrammar.' + key)}
          <textarea rows={2} value={step[key]} className="rounded-md border p-2" onChange={event => {
            const value = event.target.value;
            setDraft(prev => ({ ...prev, steps: prev.steps?.map((s, i) => i === index ? { ...s, [key]: value } : s) }));
          }} />
        </label>)}
      </fieldset>)}
    </details>}
    {error && copyName === null && <p role="alert" className="text-error">{error}</p>}
    <footer className="flex flex-wrap items-center gap-2">
      {selected && <><span className="text-sm">{selected.index !== undefined && (selected.index + 1) + '. '}{t('myGrammar.' + selected.key)}</span>
        {!editing && <button type="button" className="rounded-lg border px-2 py-1" onClick={() => setEditing(true)}>{t('common.edit')}</button>}
        {removable && <button type="button" className="rounded-lg border px-2 py-1" onClick={remove}>{t('myGrammar.remove')}</button>}
      </>}
      <button type="button" className="ml-auto px-2 py-2" disabled={busy || uploading} onClick={onClose}>{t('common.cancel')}</button>
      {onSaveCopy && <button type="button" className="rounded-lg border px-3 py-2 font-bold text-primary" disabled={busy || uploading}
        onClick={() => { setCopyName(draft.name); setError(''); }}>{t('myGrammar.save')}</button>}
      {catalogPoint && <button type="button" className="rounded-lg border px-3 py-2" disabled={busy || uploading} onClick={restoreOriginal}>
        {t('myGrammar.restoreOriginal')}
      </button>}
      <button type="button" disabled={busy || uploading} className="rounded-lg bg-primary px-4 py-2 text-white" onClick={() => void save()}>{saveLabel}</button>
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
          <button type="button" className="px-3 py-2" disabled={busy || uploading} onClick={() => { setCopyName(null); setError(''); }}>{t('common.cancel')}</button>
          <button type="button" className="rounded-lg bg-primary px-4 py-2 text-white" disabled={busy || !copyName.trim()} onClick={() => void save(true)}>{t('common.save')}</button>
        </div>
      </div>
    </AccessibleDialog>}
  </section>;
  return inline ? body : <AccessibleDialog label={t('myGrammar.edit')} onClose={() => { if (!saving.current && !uploading) onClose(); }}>
    <div className="p-4">{body}</div>
  </AccessibleDialog>;
}
