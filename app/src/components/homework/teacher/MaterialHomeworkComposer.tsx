import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAllWordLists, fetchStudentsOfClass, fetchWordBank } from '../../../lib/api';
import type { ClassRow, Student, WordBankEntry } from '../../../lib/types';
import { fetchVideoClips } from '../../../lib/videoClips';
import { activitiesByKind, buildMaterialPlan, type Activity, type Material, type Settings } from '../../../lib/homework/materialPlan';
import { bankCard, frequentMaterials, savedMaterials, sceneMaterials, type CatalogueMaterial } from '../../../lib/homework/materialSources';
import { dispatchMaterials, type DispatchResult, type MaterialDispatch } from '../../../lib/homework/materialDispatch';
import { estimateMinutes } from '../../../lib/homework/build';
import { newDraft, validateItems } from '../../../lib/homework/blocks';
import { buildGuidedPractice, CHECK_TYPES, splitLearningContent, type CheckType, type FinalCheck, type LearningContent } from '../../../lib/homework/guided';
import { WM_MIN_WORDS, toWmCards } from '../../../lib/wordMemory/plan';
import type { HwItemDraft } from '../../../lib/homework/types';
import AccessibleDialog from '../../AccessibleDialog';
import HomeworkPreview from './HomeworkPreview';
import HomeworkDeadlinePicker from './HomeworkDeadlinePicker';
import { VocabularyProjectLinks } from './HomeworkComposer';
import '../../../styles/homework-composer.css';
import '../../../i18n/materialHomeworkLocales';
import type { TFunction } from 'i18next';

type Kind = Material['kind'];
const kinds: Kind[] = ['word', 'sentence', 'scene', 'frequent'];
const categoryLabels = { word: 'categoryWord', sentence: 'categorySentence', scene: 'categoryScene', frequent: 'categoryFrequent' } as const;
const defaults: Settings = { activities: [], spelling: 'first', mask: 1, writing: 'blank', role: '' };
type Form = {
  request: string; step: number; categories: Kind[]; selected: Record<string, Settings>;
  recipientClass?: string; students: string[]; title: string; due: string; portion: number; part: number;
  daily: string; custom: string; final: boolean; types: CheckType[]; count: FinalCheck['count'];
};
const fresh = (): Form => ({ request: crypto.randomUUID(), step: 0, categories: [], selected: {}, students: [],
  title: '', due: '', portion: 0, part: 0, daily: '5', custom: '', final: false, types: [], count: 5 });
function restore(key: string): Form {
  try {
    const form: Form = JSON.parse(localStorage.getItem(key) || 'null');
    if (form && typeof form.request === 'string' && Array.isArray(form.categories) && Array.isArray(form.students) &&
        Array.isArray(form.types) && form.selected && Object.values(form.selected).every(v => v && Array.isArray(v.activities))) {
      return { ...fresh(), ...form };
    }
  } catch { /* older or damaged browser drafts do not change issued homework */ }
  return fresh();
}
const toggle = <T,>(items: T[], id: T) => items.includes(id) ? items.filter(item => item !== id) : [...items, id];
const keyOf = (source: Material) => `${source.kind}/${source.id}`;
function counts(materials: Material[], t: TFunction<'materialHomework'>) {
  const words = materials.filter(m => m.kind !== 'sentence').reduce((n, m) => n + m.cards.length, 0);
  const sentences = materials.reduce((n, m) => n + (m.kind === 'sentence' ? m.cards.length : m.scene?.lines.length ?? 0), 0);
  return [words > 0 && t('wordCount',{n:words}), sentences > 0 && t('sentenceCount',{n:sentences})].filter(Boolean).join(' · ');
}

// A scene keeps its approved footage and dialogue together. List entries follow
// the same part boundaries as the existing guided homework portion selector.
function portionMaterials(materials: Material[], size: number, part: number) {
  const rows = materials.filter(m => m.kind !== 'scene' && m.kind !== 'frequent').flatMap(m =>
    m.cards.map(card => ({ id: keyOf(m), kind: m.kind === 'sentence' ? 'sentence' as const : 'word' as const, card, origins: [m.name] })));
  const parts = splitLearningContent(rows, size);
  const index = Math.min(part, Math.max(parts.length - 1, 0));
  const current = parts[index] ?? [];
  const ordinary = materials.flatMap(m => {
    if (m.kind === 'frequent') return [];
    if (m.kind === 'scene') return [m];
    const cards = current.filter(row => row.id === keyOf(m)).map(row => row.card);
    return cards.length ? [{ ...m, cards }] : [];
  });
  return { index, count: Math.max(parts.length, 1), ordinary };
}

type Catalogue = Partial<Record<Kind, CatalogueMaterial[]>>;
export default function MaterialHomeworkComposer({ academyId, classId, className, classes, ownerId, students, onCreated, onClose, onSwitch, adaptiveEnabled }: {
  academyId: string; classId: string; className: string; classes: ClassRow[]; ownerId: string; students: Student[];
  onCreated: (result: DispatchResult, targetClass:string) => void; onClose: () => void;
  onSwitch:(kind:'adaptive'|'wordProject')=>void; adaptiveEnabled:boolean;
}) {
  const { t, i18n } = useTranslation('materialHomework');
  const en = i18n.language.startsWith('en');
  const cache = `classbank.hw.materials.v1.${ownerId}.${academyId}.${classId}`;
  const [form, setForm] = useState<Form>(() => restore(cache));
  const targetClass = form.recipientClass || classId;
  const receiptKey = cache + '.sending';
  const [pending, setPending] = useState<MaterialDispatch | null>(() => {
    try {
      const saved: MaterialDispatch | null = JSON.parse(localStorage.getItem(receiptKey) || 'null');
      return saved?.request === form.request && saved.classId === targetClass && saved.studentIds.length > 0 ? saved : null;
    } catch { return null; }
  });
  const [open, setOpen] = useState<Kind[]>(() => form.categories.length ? form.categories : ['word']);
  const [catalogue, setCatalogue] = useState<Catalogue>({});
  const [bank, setBank] = useState<WordBankEntry[]>([]);
  const [failed, setFailed] = useState<Kind[]>([]);
  const [revision, setRevision] = useState(0);
  const [roster, setRoster] = useState<{classId:string;students:Student[];error?:boolean}|null>(null);
  useEffect(() => {
    if (targetClass === classId) return;
    let live = true;
    setRoster(null);
    fetchStudentsOfClass(targetClass).then(students => { if (live) setRoster({classId:targetClass,students}); })
      .catch(() => { if (live) setRoster({classId:targetClass,students:[],error:true}); });
    return () => { live = false; };
  }, [classId, targetClass, revision]);
  const classStudents = targetClass === classId ? students : roster?.classId === targetClass ? roster.students : [];
  const [preview, setPreview] = useState<HwItemDraft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    try { localStorage.setItem(cache, JSON.stringify(form)); } catch { /* saving the send receipt below remains mandatory */ }
  }, [cache, form]);
  useEffect(() => {
    let active = true;
    setFailed([]);
    function failedKinds(...keys: Kind[]) {
      if (active) setFailed(previous => [...previous, ...keys]);
    }
    void fetchAllWordLists(academyId, 'all').then(rows => {
      if (!active) return;
      const materials = savedMaterials(rows);
      setCatalogue(old => ({ ...old, word: materials.filter(m => m.kind === 'word'), sentence: materials.filter(m => m.kind === 'sentence') }));
    }).catch(() => failedKinds('word', 'sentence'));
    void fetchVideoClips().then(rows => {
      if (active) setCatalogue(old => ({ ...old, scene: sceneMaterials(rows) }));
    }).catch(() => failedKinds('scene'));
    void fetchWordBank().then(rows => {
      if (active) { setBank(rows); setCatalogue(old => ({ ...old, frequent: frequentMaterials(rows) })); }
    }).catch(() => failedKinds('frequent'));
    return () => { active = false; };
  }, [academyId, revision]);
  function edit(patch: Partial<Form>) {
    setError('');
    setForm(old => ({ ...old, ...patch }));
  }
  const materials = useMemo(() => kinds.flatMap(kind => catalogue[kind] ?? []), [catalogue]);
  const selected = useMemo(() => materials.filter(m => form.categories.includes(m.kind) && form.selected[keyOf(m)]), [materials, form.categories, form.selected]);
  const selectedKeys = Object.keys(form.selected);
  const missing = selectedKeys.filter(key => !selected.some(m => keyOf(m) === key));
  const pool = useMemo(() => [...materials.filter(m => m.kind === 'word').flatMap(m => m.cards), ...bank.map(bankCard)], [bank, materials]);
  const portion = useMemo(() => portionMaterials(selected, form.portion, form.part), [selected, form.portion, form.part]);
  const plans = useMemo(() => portion.ordinary.map(material => ({
    material, ...buildMaterialPlan(material, form.selected[keyOf(material)], pool),
  })), [portion, form.selected, pool]);
  const frequent = selected.filter(m => m.kind === 'frequent');
  const recurrentCards = toWmCards(frequent.flatMap(m => m.cards));
  const threshold = Number(form.daily === 'custom' ? form.custom : form.daily);
  const finalPlan = useMemo(() => {
    if (!form.final || !portion.ordinary.length) return { items: [], issues: [] };
    const contents: LearningContent[] = portion.ordinary.flatMap(m => [
      ...m.cards.map(card => ({ id: `${m.id}/${card.id}`, kind: m.kind === 'sentence' ? 'sentence' as const : 'word' as const, card, origins: [m.name] })),
      ...(m.scene?.lines ?? []).map(line => ({ id: `${m.id}/${line.s}`, kind: 'sentence' as const,
        card: { id: `${m.id}/${line.s}`, word: line.en, meaning: line.ko || '', imageUrl: null }, origins: [m.name] })),
    ]);
    const { items, issues } = buildGuidedPractice(contents, [], [], en, { types: form.types, count: form.count }, undefined, 'finalOnly');
    for (const item of items) {
      item.config.block!.groupKey = 'material-final';
      item.config.block!.materialName = t('final');
      item.title = t('final');
    }
    return { items, issues };
  }, [en, portion, form.final, form.types, form.count, t]);
  const items = useMemo(() => [...plans.flatMap(plan => plan.items), ...finalPlan.items], [plans, finalPlan]);
  const targets = classStudents.filter(s => form.students.includes(s.id)).map(s => s.id).sort();
  const issues: string[] = [];
  for (const plan of plans) {
    if (!form.final && !form.selected[keyOf(plan.material)].activities.length) issues.push(t('chooseActivity',{name:plan.material.name}));
    else issues.push(...plan.issues);
  }
  if (items.length) {
    if (new Set(items.map(item => item.config.block?.groupKey)).size > 60 ||
        new TextEncoder().encode(JSON.stringify(items)).byteLength > 1000000) issues.push(t('large'));
    for (let i = 0; i < items.length; i += 60) issues.push(...validateItems(items.slice(i, i + 60)));
  }
  if (form.final) issues.push(...finalPlan.issues);
  if (frequent.length) {
    if (recurrentCards.length < WM_MIN_WORDS) issues.push(t('few',{n:WM_MIN_WORDS}));
    if (!Number.isSafeInteger(threshold) || threshold < 1 || (form.daily === 'custom' && threshold > recurrentCards.length)) {
      issues.push(t('limitError',{n:recurrentCards.length}));
    }
  }
  if (portion.ordinary.length && form.due && new Date(form.due).getTime() <= Date.now()) issues.push(t('deadlineError'));
  const title = form.title.trim() || selected.map(m => m.name).join(' · ').slice(0, 120);
  const assignmentTitle = portion.count > 1 ? `${title} · ${portion.index + 1}/${portion.count}` : title;

  function choose(m: Material) {
    const key = keyOf(m);
    const next = { ...form.selected };
    if (next[key]) delete next[key]; else next[key] = { ...defaults };
    edit({ selected: next, categories: [...new Set([...form.categories, m.kind])], part: 0 });
  }
  function category(kind: Kind) {
    const enabled = form.categories.includes(kind);
    const selected = { ...form.selected };
    if (enabled) for (const key of Object.keys(selected)) { if (key.startsWith(kind + '/')) delete selected[key]; }
    if (!enabled && !open.includes(kind)) setOpen([...open, kind]);
    edit({ categories: toggle(form.categories, kind), selected, part: 0 });
  }
  function configure(m: Material, patch: Partial<Settings>) {
    const key = keyOf(m);
    edit({ selected: { ...form.selected, [key]: { ...form.selected[key], ...patch } } });
  }

  async function send() {
    if (lock.current || (!pending && (issues.length || missing.length || !targets.length || (!items.length && !frequent.length)))) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      let payload = pending;
      if (!payload) {
        const ranges = frequent.map(m => m.id);
        const project = ranges.length ? {
          request: form.request, cards: recurrentCards, title: `${t('categoryFrequent')} · ${frequent.map(m => m.name).join(', ')}`.slice(0, 120),
          limit: threshold, source: { type: 'curriculum' as const, name: t('categoryFrequent'), ranges },
        } : null;
        payload = { classId:targetClass, request: form.request, studentIds: targets, due: items.length ? form.due : '', project,
          draft: items.length ? { ...newDraft(), title: assignmentTitle, items } : null };
        // Preserve the exact randomized questions and request across a lost response or reload.
        try { localStorage.setItem(receiptKey, JSON.stringify(payload)); }
        catch { throw Error(t('retryNote')); }
        setPending(payload);
      }
      const result = await dispatchMaterials(payload);
      if (portion.index + 1 < portion.count) {
        const remaining = Object.fromEntries(Object.entries(form.selected).filter(([key]) => key.startsWith('word/') || key.startsWith('sentence/')));
        const next = { ...form, request: crypto.randomUUID(), selected: remaining,
          categories: form.categories.filter(kind => kind === 'word' || kind === 'sentence'), part: portion.index + 1 };
        localStorage.setItem(cache, JSON.stringify(next));
      } else {
        localStorage.removeItem(cache);
      }
      localStorage.removeItem(receiptKey);
      onCreated(result, payload.classId);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : (cause as {message?:string})?.message;
      // A database rejection rolls back the operation. Transport failure leaves
      // the commit status unknown; retry that exact payload before editing it.
      if ((cause as {code?:string})?.code === 'P0001') {
        localStorage.removeItem(receiptKey);
        setPending(null);
      }
      setError(`${t('sendError')}${detail ? ' (' + detail + ')' : ''}`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return <section className="hw-composer" aria-label={t('newHomework')}>
    <header className="hw-compose-header"><div><p>{className}</p><h2>{form.step === 0 ? t('choose') : t('configure')}</h2></div>
      <button type="button" disabled={busy} onClick={onClose}>{t('close')}</button></header>
    <nav className="hw-compose-steps" aria-label={t('steps')}>{[t('choose'),t('configure')].map((name, i) =>
      <button type="button" key={name} disabled={busy || !!pending || (i === 1 && (!selected.length || !!missing.length))} aria-current={form.step === i ? 'step' : undefined} onClick={() => edit({ step: i })}><b>{i + 1}</b>{name}</button>)}</nav>
    {pending && !busy && <p role="status">{t('pending')}</p>}
    <fieldset className="hw-compose-body" disabled={busy || !!pending}>
      {form.step === 0 ? <>
        {kinds.map(kind => <section key={kind} className="hw-content-card">
          <div className="flex items-center gap-3"><input aria-label={t('useCategory', {name:t(categoryLabels[kind])})} type="checkbox" checked={form.categories.includes(kind)} onChange={() => category(kind)} />
            <button type="button" className="flex-1 text-left" aria-expanded={open.includes(kind)} onClick={() => setOpen(toggle(open, kind))}>{t(categoryLabels[kind])} {open.includes(kind) ? '▴' : '▾'}</button></div>
          {open.includes(kind) && (failed.includes(kind) ? <p role="alert">{t('loadFailed')} <button type="button" onClick={() => setRevision(n => n + 1)}>{t('reload')}</button></p> :
            !catalogue[kind] ? <p>{t('loading')}</p> : catalogue[kind]?.length ?
              <SourceChoices kind={kind} rows={catalogue[kind]!} selected={form.selected} onChoose={choose}/> : <p>{t('noMaterials')}</p>)}
        </section>)}
        <p aria-live="polite">{t('materialCount', {n:selected.length})}{selected.length > 0 && ' · ' + counts(selected, t)}</p>
        <VocabularyProjectLinks onSwitch={onSwitch} adaptiveEnabled={adaptiveEnabled}/>
        {!!missing.length && <p role="status">{t('missing')}</p>}
      </> : <>
        <label className="hw-compose-label">{t('title')}<input value={form.title} placeholder={title} maxLength={120} onChange={e => edit({ title: e.target.value })}/></label>
        {selected.some(m => m.kind === 'word' || m.kind === 'sentence') && <div className="hw-portion-choices" aria-label={t('portions')}>
          {[0,10,20].map(n => <button type="button" key={n} aria-pressed={form.portion === n} onClick={() => edit({ portion: n, part: 0 })}>{n ? t('each',{n}) : t('whole')}</button>)}
          {portion.count > 1 && <label>{t('part')}<select value={portion.index} onChange={e => edit({ part: Number(e.target.value) })}>
            {Array.from({ length: portion.count }, (_, i) => <option key={i} value={i}>{i + 1} / {portion.count}</option>)}</select></label>}
        </div>}
        {plans.map(plan => <MaterialOptions key={keyOf(plan.material)} material={plan.material} settings={form.selected[keyOf(plan.material)]}
          onChange={patch => configure(plan.material, patch)} onPreview={() => setPreview(plan.items)} canPreview={!!plan.items.length && !plan.issues.length}/>)}
        {frequent.length > 0 && <section className="hw-content-card"><h3>{t('categoryFrequent')} · {t('nItems',{n:recurrentCards.length})}</h3><p>{frequent.map(m => m.name).join(' · ')}</p>
          <label className="hw-compose-label">{t('newMax')}<select value={form.daily} onChange={e => edit({ daily: e.target.value })}>
            {[5,10,15].map(n => <option key={n} value={n}>{t('nItems',{n})}</option>)}<option value="custom">{t('custom')}</option></select></label>
          {form.daily === 'custom' && <label>{t('limit')}<input type="number" min={1} max={recurrentCards.length} step={1} value={form.custom} onChange={e => edit({ custom: e.target.value })}/></label>}
          <p>{t('reviewHelp')}</p></section>}
        {!!portion.ordinary.length && <section className="hw-content-card"><label className="flex items-center gap-2"><input type="checkbox" checked={form.final} onChange={e => edit({ final: e.target.checked })}/>{t('final')}</label>
          {form.final && <><div className="hw-content-summary">{(Object.keys(CHECK_TYPES) as CheckType[]).map(type =>
            <label key={type}><input type="checkbox" checked={form.types.includes(type)} onChange={() => edit({ types: toggle(form.types,type) })}/>{CHECK_TYPES[type][en ? 1 : 0]}</label>)}</div>
            <label>{t('count')}<select value={form.count} onChange={e => edit({ count: Number(e.target.value) as Form['count'] })}>
              {[5,10,15,0].map(n => <option value={n} key={n}>{n ? t('nItems',{n}) : t('all')}</option>)}</select></label></>}
        </section>}
        {items.length > 0 && !issues.length && <>
          <p>{t('estimatedPart',{n:estimateMinutes(items)})}</p>
          <button type="button" onClick={() => setPreview(items)}>{t('previewAll')}</button>
        </>}
        {portion.ordinary.length > 0 && <HomeworkDeadlinePicker value={form.due} onChange={due => edit({ due })} en={en}/>}
        <fieldset className="hw-targets"><legend>{t('recipients')}</legend>
          <label>{t('class')}<select value={targetClass} onChange={e => edit({ recipientClass:e.target.value,students:[] })}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          {roster?.error && roster.classId === targetClass && <p role="alert">{t('rosterError')} <button type="button" onClick={() => setRevision(n => n + 1)}>{t('reload')}</button></p>}
          <label><input type="checkbox" checked={!!classStudents.length && targets.length === classStudents.length} onChange={e => edit({ students: e.target.checked ? classStudents.map(s => s.id) : [] })}/>{t('selectAll')}</label>
          <div>{classStudents.map(s => <label key={s.id}><input type="checkbox" checked={targets.includes(s.id)} onChange={() => edit({ students: toggle(targets, s.id) })}/>{s.name}</label>)}</div>
          <p>{t('selectedCount',{total:classStudents.length,n:targets.length})}</p></fieldset>
        {issues.length > 0 && <div className="hw-compose-error" role="status">{Array.from(new Set(issues)).map(issue => <p key={issue}>{issue.split(' / ')[en ? 1 : 0] || issue}</p>)}</div>}
      </>}
    </fieldset>
    {error && <p role="alert" className="hw-compose-error">{error}</p>}
    <footer className="hw-compose-footer">{form.step === 0 ?
      <button className="hw-primary" type="button" disabled={!selected.length || !!missing.length} onClick={() => edit({ step: 1 })}>{t('next')}</button> :
      <><button type="button" disabled={busy || !!pending} onClick={() => edit({ step: 0 })}>{t('back')}</button>
        <button className="hw-primary" type="button" disabled={busy || (!pending && (!targets.length || !!missing.length || !!issues.length || (!items.length && !frequent.length)))} onClick={() => void send()}>{busy ? t('sending') : t('send',{n:pending?.studentIds.length ?? targets.length})}</button></>}
    </footer>
    {preview && <AccessibleDialog label={t('preview')} onClose={() => setPreview(null)}><div className="hw-preview-dialog"><header><h3>{t('preview')}</h3><button type="button" onClick={() => setPreview(null)}>{t('close')}</button></header>
      <HomeworkPreview title={assignmentTitle} items={preview}/></div></AccessibleDialog>}
  </section>;
}

function SourceChoices({kind,rows,selected,onChoose}:{kind:Kind; rows:CatalogueMaterial[];selected:Form['selected'];onChoose:(m:Material)=>void}) {
  const {t} = useTranslation('materialHomework');
  const [parent, setParent] = useState('');
  const [level, setLevel] = useState('');
  const field = kind === 'frequent' ? 'school' : 'episode';
  const parents = new Map(rows.flatMap(m => m[field] ? [[m[field].id, m[field].name] as const] : []));
  const withinParent = parent ? rows.filter(m => m[field]?.id === parent) : rows;
  const levels = new Map(withinParent.flatMap(m => m.band ? [[m.band.id,m.band.name] as const] : []));
  const filtered = level ? withinParent.filter(m => m.band?.id === level) : withinParent;
  return <>
    {!!parents.size && <div className="grid gap-2 sm:grid-cols-2">
      <label>{t(kind === 'frequent' ? 'school' : 'episode')}<select value={parent} onChange={e => {setParent(e.target.value);setLevel('');}}>
        <option value="">{t('all')}</option>{Array.from(parents, ([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      {!!levels.size && <label>{t('level')}<select value={level} onChange={e=>setLevel(e.target.value)}>
        <option value="">{t('all')}</option>{Array.from(levels, ([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
    </div>}
    <div className="grid max-h-80 gap-2 overflow-auto">{filtered.map(m =>
      <MaterialChoice key={keyOf(m)} material={m} checked={!!selected[keyOf(m)]} onChange={() => onChoose(m)}/>)}</div>
  </>;
}

function MaterialChoice({ material, checked, onChange }: { material:Material; checked:boolean; onChange:()=>void }) {
  const { t } = useTranslation('materialHomework');
  const [expanded, setExpanded] = useState(false);
  return <div>
    <label className="hw-video-choice"><input type="checkbox" disabled={!material.cards.length && !material.scene} checked={checked} onChange={onChange}/>
      <span>{material.name}<small className="block">{counts([material], t) || t('sceneVideo')}</small></span></label>
    {material.scene && <details onToggle={event => setExpanded(event.currentTarget.open)}><summary>{t('sceneContents')}</summary>
      {expanded && <div className="grid gap-2 px-3 pb-2"><p>{material.cards.map(card => card.word + ' · ' + card.meaning).join(', ')}</p>
        <ul>{material.scene.lines.map((line, i) => <li key={i}>{line.speaker && <b>{line.speaker} · </b>}{line.en}{line.ko && ' · ' + line.ko}</li>)}</ul></div>}
    </details>}
  </div>;
}

function MaterialOptions({ material, settings, onChange, onPreview, canPreview }: {
  material: Material; settings: Settings; onChange: (patch: Partial<Settings>) => void; onPreview: () => void; canPreview: boolean;
}) {
  const { t } = useTranslation('materialHomework');
  const activities = settings.activities;
  const roles = [...new Set(material.scene?.lines.flatMap(line => line.speaker ? [line.speaker] : []) ?? [])];
  function unavailable(id: Activity) {
    if (id === 'sceneWords' && !material.cards.length) return t('noWords');
    if ((id === 'echo' || id === 'shadow') && !material.scene?.lines.length) return t('noTiming');
    if (id === 'dub' && !roles.length) return t('noRoles');
    return '';
  }
  return <section className="hw-content-card"><h3>{material.name}</h3><p>{counts([material], t)}</p>
    <div className="hw-content-summary">{activitiesByKind[material.kind].map(id => <label key={id}><input type="checkbox" disabled={!!unavailable(id)} checked={activities.includes(id)}
      onChange={() => onChange({ activities: toggle(activities, id) })}/>{t(`activity.${id}`)}{unavailable(id) && <small>{unavailable(id)}</small>}</label>)}</div>
    {activities.includes('spell') && <label>{t('spelling')}<select value={settings.spelling || 'first'} onChange={e => onChange({ spelling: e.target.value as Settings['spelling'] })}>
      <option value="first">{t('first')}</option><option value="one">{t('one')}</option><option value="all">{t('allLetters')}</option></select></label>}
    {activities.includes('hide') && <label>{t('hide')}<select value={settings.mask ?? 1} onChange={e => onChange({ mask: e.target.value === 'all' ? 'all' : e.target.value === '3' ? 3 : 1 })}>
      <option value="1">{t('oneWord')}</option><option value="3">{t('threeWords')}</option><option value="all">{t('wholeSentence')}</option></select></label>}
    {activities.includes('write') && <label>{t('writing')}<select value={settings.writing || 'blank'} onChange={e => onChange({ writing: e.target.value as Settings['writing'] })}>
      <option value="blank">{t('blank')}</option><option value="full">{t('writeFull')}</option></select></label>}
    {activities.includes('dub') && <label>{t('role')}<select value={settings.role || ''} onChange={e => onChange({ role: e.target.value })}>
      <option value="">{t('pickRole')}</option>{roles.map(role => <option key={role}>{role}</option>)}</select></label>}
    <button type="button" disabled={!canPreview} onClick={onPreview}>{t('preview')}</button>
  </section>;
}
