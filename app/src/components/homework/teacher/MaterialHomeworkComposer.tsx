import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAllWordLists, fetchStudentsOfClass, fetchWordBank, fetchWordLists } from '../../../lib/api';
import type { ClassRow, FullCardItem, Student, WordBankEntry } from '../../../lib/types';
import { fetchVideoClips } from '../../../lib/videoClips';
import { activitiesByKind, buildMaterialPlan, type Activity, type Material, type Settings } from '../../../lib/homework/materialPlan';
import { bankCard, frequentMaterials, savedMaterials, homeworkEpisodes, type CatalogueMaterial, type HomeworkEpisode } from '../../../lib/homework/materialSources';
import { dispatchMaterials, type DispatchResult, type MaterialDispatch } from '../../../lib/homework/materialDispatch';
import { estimateMinutes } from '../../../lib/homework/build';
import { newDraft, validateItems } from '../../../lib/homework/blocks';
import { buildGuidedPractice, CHECK_TYPES, splitLearningContent, type CheckType, type FinalCheck, type LearningContent } from '../../../lib/homework/guided';
import { WM_MIN_WORDS, toWmCards } from '../../../lib/wordMemory/plan';
import type { HwItemDraft } from '../../../lib/homework/types';
import AccessibleDialog from '../../AccessibleDialog';
import HomeworkPreview from './HomeworkPreview';
import HomeworkDeadlinePicker from './HomeworkDeadlinePicker';
import HomeworkMaterialSelection, { selectHomeworkMaterial, type ContentSelection } from './HomeworkMaterialSelection';
import MaterialReviewGames from './MaterialReviewGames';
import { buildReviewGames, reviewGameSource, type ReviewGame } from '../../../lib/homework/materialReviewGames';
import '../../../styles/homework-composer.css';
import '../../../i18n/materialHomeworkLocales';
import type { TFunction } from 'i18next';

type Kind = Material['kind'];
const kinds: Kind[] = ['word', 'sentence', 'scene', 'frequent'];
const categoryLabels = { word: 'categoryWord', sentence: 'categorySentence', scene: 'categoryScene', frequent: 'categoryFrequent' } as const;
const defaults: Settings = { activities: [], spelling: 'first', mask: 1, writing: 'blank', role: '' };
type Form = {
  request: string; step: number; categories: Kind[]; selected: Record<string, Settings & ContentSelection>; titleEdited?:boolean; gameEnabled:boolean; games:ReviewGame[];
  recipientClass?: string; students: string[]; title: string; due: string; portion: number; part: number;
  daily: string; custom: string; final: boolean; types: CheckType[]; count: FinalCheck['count'];
};
const fresh = (): Form => ({ request: crypto.randomUUID(), step: 0, categories: [], selected: {}, students: [],
  title: '', gameEnabled:false, games:[], due: '', portion: 0, part: 0, daily: '5', custom: '', final: false, types: [], count: 5 });
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
export default function MaterialHomeworkComposer({ academyId, classId, classes, ownerId, students, onCreated, onClose }: {
  academyId: string; classId: string; classes: ClassRow[]; ownerId: string; students: Student[];
  onCreated: (result: DispatchResult, targetClass:string) => void; onClose: () => void;
}) {
  const { t, i18n } = useTranslation('materialHomework');
  const en = i18n.language.startsWith('en');
  const cache = `classbank.hw.materials.v1.${ownerId}.${academyId}.${classId}`;
  const [form, setForm] = useState<Form>(fresh);
  const targetClass = form.recipientClass || classId;
  const receiptKey = cache + '.sending';
  const [pending, setPending] = useState<MaterialDispatch | null>(null);
  const [receipt,setReceipt] = useState<MaterialDispatch | null>(() => {
    try {
      const saved: MaterialDispatch | null = JSON.parse(localStorage.getItem(receiptKey) || 'null');
      return saved?.request && saved.studentIds.length > 0 ? saved : null;
    } catch { return null; }
  });
  const [notice, setNotice] = useState('');
  const [catalogue, setCatalogue] = useState<Catalogue>({});
  const [episodes,setEpisodes] = useState<HomeworkEpisode[]>([]);
  const [episodeView,setEpisodeView] = useState({id:'',series:'',query:''});
  const [bank, setBank] = useState<WordBankEntry[]>([]);
  const [choiceWords, setChoiceWords] = useState<FullCardItem[] | null>(null);
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
    // Unsent drafts from older versions are no longer restored. Keep attempted dispatches for idempotent retries.
    try { if (!localStorage.getItem(receiptKey)) localStorage.removeItem(cache); } catch { /* The new draft lives in memory. */ }
  }, [cache, receiptKey]);
  useEffect(() => {
    let active = true;
    setFailed([]);
    function failedKinds(...keys: Kind[]) {
      if (active) setFailed(previous => [...previous, ...keys]);
    }
    void fetchWordLists(academyId, classId, 'all', 'classOnly').then(rows => {
      if (!active) return;
      const materials = savedMaterials(rows);
      setCatalogue(old => ({ ...old, word: materials.filter(m => m.kind === 'word'), sentence: materials.filter(m => m.kind === 'sentence') }));
    }).catch(() => failedKinds('word', 'sentence'));
    void fetchVideoClips().then(rows => {
      if (active) {
        const available = homeworkEpisodes(rows);
        setEpisodes(available);
        setCatalogue(old => ({ ...old, scene: available.flatMap(episode=>episode.materials) }));
      }
    }).catch(() => failedKinds('scene'));
    void fetchWordBank().then(rows => {
      if (active) { setBank(rows); setCatalogue(old => ({ ...old, frequent: frequentMaterials(rows) })); }
    }).catch(() => failedKinds('frequent'));
    return () => { active = false; };
  }, [academyId, classId, revision]);
  function edit(patch: Partial<Form>) {
    setError('');
    setForm(old => ({ ...old, ...patch }));
  }
  const materials = useMemo(() => kinds.flatMap(kind => catalogue[kind] ?? []), [catalogue]);
  const selected = useMemo(() => materials.filter(m => form.categories.includes(m.kind) && form.selected[keyOf(m)]).map(m => selectHomeworkMaterial(m, form.selected[keyOf(m)])), [materials, form.categories, form.selected]);
  const selectedKeys = Object.keys(form.selected);
  const missing = selectedKeys.filter(key => !selected.some(m => keyOf(m) === key));
  // Multiple-choice distractors use the original academy pool, independently of the selectable lists.
  const needsChoiceWords = selected.some(m => form.selected[keyOf(m)].activities.includes('choice'));
  useEffect(() => {
    if (!needsChoiceWords || choiceWords !== null) return;
    let active = true;
    fetchAllWordLists(academyId).then(rows => {
      if (active) setChoiceWords(savedMaterials(rows).flatMap(m => m.cards));
    }).catch(() => { /* The class words and word bank are still available. */ });
    return () => { active = false; };
  }, [academyId, needsChoiceWords, choiceWords, revision]);
  const pool = useMemo(() => [...(choiceWords ?? materials.filter(m => m.kind === 'word').flatMap(m => m.cards)), ...bank.map(bankCard)], [bank, materials, choiceWords]);
  const portion = useMemo(() => portionMaterials(selected, form.portion, form.part), [selected, form.portion, form.part]);
  const plans = useMemo(() => portion.ordinary.map(material => ({
    material, ...buildMaterialPlan(material, form.selected[keyOf(material)], pool),
  })), [portion, form.selected, pool]);
  const frequent = selected.filter(m => m.kind === 'frequent');
  const emptySources = selected.filter(m => m.kind !== 'scene' && !m.cards.length);
  const gamePlan = useMemo(() => buildReviewGames(portion.ordinary, form.gameEnabled ? form.games : [], en), [portion, form.games, form.gameEnabled, en]);
  const recurrentCards = toWmCards(frequent.flatMap(m => m.cards));
  const threshold = Number(form.daily === 'custom' ? form.custom : form.daily);
  const finalPlan = useMemo(() => {
    if (!form.final || !portion.ordinary.length) return { items: [], issues: [], covered:new Set<string>() };
    const contents: LearningContent[] = portion.ordinary.flatMap(m => [
      ...m.cards.map(card => ({ id: JSON.stringify([keyOf(m),'card',card.id]), kind: m.kind === 'sentence' ? 'sentence' as const : 'word' as const, card, origins: [keyOf(m)] })),
      ...(m.scene?.lines ?? []).map(line => ({ id: JSON.stringify([keyOf(m),'line',line.s,line.e,line.en]), kind: 'sentence' as const,
        card: { id: `${m.id}/${line.s}`, word: line.en, meaning: line.ko || '', imageUrl: null }, origins: [keyOf(m)] })),
    ]);
    const { items, issues, finalContentIds } = buildGuidedPractice(contents, [], [], en, { types: form.types, count: form.count }, undefined, 'finalOnly');
    for (const item of items) {
      item.config.block!.groupKey = 'material-final';
      item.config.block!.materialName = t('final');
      item.title = t('final');
    }
    return { items, issues, covered:new Set(contents.filter(content=>finalContentIds.has(content.id)).flatMap(content=>content.origins)) };
  }, [en, portion, form.final, form.types, form.count, t]);
  const items = useMemo(() => [...plans.flatMap(plan => plan.items), ...gamePlan.items, ...finalPlan.items], [plans, gamePlan, finalPlan]);
  const targets = classStudents.filter(s => form.students.includes(s.id)).map(s => s.id).sort();
  const issues: string[] = [...gamePlan.issues];
  if (emptySources.length) issues.push(t('emptySelection'));
  for (const plan of plans) {
    const gameUsesMaterial = !!gamePlan.items.length && form.games.some(game=>reviewGameSource([plan.material],game,en).cards.length>0);
    if (!gameUsesMaterial && !finalPlan.covered.has(keyOf(plan.material)) && !form.selected[keyOf(plan.material)].activities.length) {
      issues.push(t('chooseActivity',{name:plan.material.name}));
    }
    if (plan.material.kind!=='sentence') issues.push(...plan.issues);
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
  const invalidDue = items.length > 0 && !!form.due && !(Date.parse(form.due) > Date.now());
  const names = [...new Set(selected.map(m => m.name))];
  const typeNames = kinds.filter(k => selected.some(m => m.kind === k)).map(k => t(categoryLabels[k]));
  const typeTitle = !en && typeNames.length===2 && typeNames[0]===t('categoryWord') && typeNames[1]===t('categorySentence') ? '단어와 문장' : typeNames.join(en ? ' and ' : ' · ');
  const generatedTitle = [names.join(' · '), typeTitle].filter(Boolean).join(' · ').slice(0,120);
  const title = form.titleEdited || form.title ? form.title : generatedTitle;
  const assignmentTitle = title.trim();
  const configValid = !missing.length && !issues.length && plans.every(plan=>!plan.issues.length) && (items.length > 0 || frequent.length > 0);
  const ready = configValid && !!assignmentTitle && !invalidDue && targets.length > 0;
  const step = pending ? 2 : form.step;
  const heading = t(step === 0 ? 'choose' : step === 1 ? 'configure' : 'sendHeading');
  const sourceValid = selected.some(m=>m.kind!=='scene' || m.cards.length || m.scene?.lines.length || (!form.selected[keyOf(m)].cardIds && !form.selected[keyOf(m)].lineIds))
    && !missing.length && !emptySources.length;
  const dismissal = () => {
    if (!busy) onClose();
  };

  function choose(m: Material) {
    const key = keyOf(m);
    const next = { ...form.selected };
    if (next[key]) delete next[key]; else next[key] = { ...defaults };
    edit({ selected: next, categories: [...new Set([...form.categories, m.kind])], part: 0 });
  }
  function category(kind: Kind) {
    const enabled = form.categories.includes(kind);
    if (enabled && kind==='scene') setEpisodeView({id:'',series:'',query:''});
    const selected = { ...form.selected };
    if (enabled) for (const key of Object.keys(selected)) { if (key.startsWith(kind + '/')) delete selected[key]; }
    edit({ categories: toggle(form.categories, kind), selected, part: 0 });
  }
  function configure(m: Material, patch: Partial<Settings> & ContentSelection) {
    const key = keyOf(m);
    const next = {...form.selected[key],...patch};
    if (m.scene && (patch.cardIds || patch.lineIds)) {
      const filtered = selectHomeworkMaterial(m,next);
      const lines = filtered.scene?.lines ?? [];
      next.activities = next.activities.filter(activity=>{
        if(activity==='sceneWords') return filtered.cards.length>0;
        if(activity==='echo'||activity==='shadow') return lines.length>0;
        return activity!=='dub'||lines.some(line=>line.speaker);
      });
      if(next.role && !lines.some(line=>line.speaker===next.role)) next.role='';
      if(next.activities.length!==form.selected[key].activities.length || next.role!==form.selected[key].role) setNotice(t('removedOptions'));
    }
    edit({ selected:{...form.selected,[key]:next}, ...((patch.cardIds||patch.lineIds) ? {part:0} : {}) });
  }

  async function send() {
    if (lock.current || step !== 2 || (!pending && !ready)) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      let payload = pending;
      if (!payload) {
        const ranges = frequent.map(m => m.id);
        const project = ranges.length ? {
          request: form.request, cards: recurrentCards, title: items.length ? `${assignmentTitle} · ${t('categoryFrequent')}`.slice(0,120) : assignmentTitle,
          limit: threshold, source: { type: 'curriculum' as const, name: t('categoryFrequent'), ranges },
        } : null;
        payload = { classId:targetClass, request: form.request, studentIds: targets, due: items.length ? form.due : '', project,
          draft: items.length ? { ...newDraft(), title: assignmentTitle, items } : null };
        // Preserve the exact randomized questions and request across a lost response or reload.
        const previous = localStorage.getItem(receiptKey);
        if (previous && JSON.parse(previous).request !== payload.request) throw Error(t('pending'));
        try { localStorage.setItem(cache,JSON.stringify(form)); localStorage.setItem(receiptKey, JSON.stringify(payload)); }
        catch { throw Error(t('retryNote')); }
        setPending(payload);
      }
      const result = await dispatchMaterials(payload);
      localStorage.removeItem(cache);
      localStorage.removeItem(receiptKey);
      onCreated(result, payload.classId);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : (cause as {message?:string})?.message;
      // A database rejection rolls back the operation. Transport failure leaves
      // the commit status unknown; retry that exact payload before editing it.
      if (/^[0-9A-Z]{5}$/.test((cause as {code?:string})?.code ?? '')) {
        localStorage.removeItem(receiptKey);
        localStorage.removeItem(cache);
        setReceipt(null);
        setPending(null);
      }
      setError(`${t('sendError')}${detail ? ' (' + detail + ')' : ''}`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const summaries = [
    ...new Set(plans.flatMap(plan => form.selected[keyOf(plan.material)].activities.map(activity=>t(`activity.${activity}`)))),
    ...gamePlan.items.map(item=>item.title),
    ...(frequent.length ? [t('dailySummary',{n:threshold})] : []), ...(form.final && finalPlan.items.length ? [t('final')] : []),
  ];
  const nextInEpisode = step===0 && form.categories.includes('scene') && !!catalogue.scene && !failed.includes('scene');
  const nextButton = <button type="button" className="hw-forward" disabled={step===0 ? !sourceValid : !configValid}
    onClick={()=>{setNotice('');edit({step:step+1});}}>{t(step===0 ? 'toConfigure' : 'toStudents')} <span aria-hidden>→</span></button>;
  return <section className="hw-studio" aria-label={heading}>
    <nav className="hw-breadcrumb" aria-label={t('path')}><span>{t('ourClass')}</span><span aria-hidden>›</span>
      <button type="button" onClick={dismissal} disabled={busy}>{t('homework')}</button><span aria-hidden>›</span><span>{t('newHomework')}</span></nav>
    <h1>{heading}</h1>
    {step === 0 && <p className="hw-intro">{t('chooseHelp')}</p>}
    {receipt && !pending && <button type="button" onClick={()=>{
      setForm({...restore(cache),recipientClass:receipt.classId,students:receipt.studentIds,step:2});
      setPending(receipt);
    }}>{en?'Review previous dispatch attempt':'이전 발송 요청 확인'}</button>}
    {pending && !busy && <p role="status">{t('pending')}</p>}
    {notice && <p role="status">{notice}</p>}
    <fieldset className="hw-studio-body" disabled={busy || !!pending}>
      {step === 0 && <>
        <HomeworkMaterialSelection catalogue={catalogue} categories={form.categories} selected={form.selected}
          episodes={episodes} episodeView={episodeView} onEpisodeView={setEpisodeView} next={nextButton}
          failed={failed} onCategory={category} onChoose={choose} onConfigure={configure}
          onRetry={()=>setRevision(n=>n+1)}/>
        {!!missing.length && <p role="status">{t('missing')}</p>}
        {!!emptySources.length && <p role="status">{t('emptySelection')}</p>}
      </>}
      {step === 1 && <>
        {plans.map(plan => <div key={keyOf(plan.material)}><MaterialOptions material={plan.material} settings={form.selected[keyOf(plan.material)]}
          onChange={patch => configure(plan.material,patch)} onPreview={()=>setPreview(plan.items)} canPreview={!!plan.items.length&&!plan.issues.length}/>
          {plan.material.kind==='sentence' && !!plan.issues.length && <div role="status" className="hw-studio-issue">
            {plan.issues.map(issue=><p key={issue}>{issue}</p>)}
            <button type="button" onClick={()=>edit({step:0})}>{en?'Edit selected sentences':'선택한 문장 보완하기'}</button>
          </div>}</div>)}
        {frequent.length > 0 && <details className="hw-plan-row"><summary><strong>{t('categoryFrequent')} {t('nItems',{n:recurrentCards.length})}</strong>
          <span className="hw-checked-plan"><span className="hw-plan-check" aria-hidden="true">✓</span>{t('dailySummary',{n:threshold || '—'})}</span><span className="hw-small-action"><span className="material-symbols-outlined" aria-hidden="true">edit</span>{t('edit')}</span></summary><div className="hw-plan-fields">
          <p>{frequent.map(m => m.name).join(' · ')}</p>
          <label className="hw-compose-label">{t('newMax')}<select value={form.daily} onChange={e => edit({ daily: e.target.value })}>
            {[5,10,15].map(n => <option key={n} value={n}>{t('nItems',{n})}</option>)}<option value="custom">{t('custom')}</option></select></label>
          {form.daily === 'custom' && <label>{t('limit')}<input type="number" min={1} max={recurrentCards.length} step={1} value={form.custom} onChange={e => edit({ custom: e.target.value })}/></label>}
          <p>{t('reviewHelp')}</p></div></details>}
        {!missing.length && <MaterialReviewGames materials={portion.ordinary} games={form.games} en={en}
          onGames={games=>edit({games,gameEnabled:games.length>0})}/>}
        {!!portion.ordinary.length && <details className="hw-extra"><summary>{t('moreConfig')}</summary><div className="hw-plan-fields">
        {selected.some(m => m.kind === 'word' || m.kind === 'sentence') && <div className="hw-portion-choices" aria-label={t('portions')}>
          {[0,10,20].map(n => <button type="button" key={n} aria-pressed={form.portion === n} onClick={() => edit({ portion: n, part: 0 })}>{n ? t('each',{n}) : t('whole')}</button>)}
          {portion.count > 1 && <label>{t('part')}<select value={portion.index} onChange={e => edit({ part: Number(e.target.value) })}>
            {Array.from({ length: portion.count }, (_, i) => <option key={i} value={i}>{i + 1} / {portion.count}</option>)}</select></label>}
        </div>}
        {!!portion.ordinary.length && <section className="hw-content-card"><label className="flex items-center gap-2"><input type="checkbox" checked={form.final} onChange={e => edit({ final: e.target.checked })}/>{t('final')}</label>
          {form.final && <><div className="hw-content-summary">{(Object.keys(CHECK_TYPES) as CheckType[]).map(type =>
            <label key={type}><input type="checkbox" checked={form.types.includes(type)} onChange={() => edit({ types: toggle(form.types,type) })}/>{CHECK_TYPES[type][en ? 1 : 0]}</label>)}</div>
            <label>{t('count')}<select value={form.count} onChange={e => edit({ count: Number(e.target.value) as Form['count'] })}>
              {[5,10,15,0].map(n => <option value={n} key={n}>{n ? t('nItems',{n}) : t('all')}</option>)}</select></label></>}
        </section>}
        {items.length > 0 && configValid && <>
          <p>{t('estimatedPart',{n:estimateMinutes(items)})}</p>
          <button type="button" onClick={() => setPreview(items)}>{t('previewAll')}</button>
        </>}
        </div></details>}
        {!!issues.length && <div role="status" className="hw-studio-issue">{[...new Set(issues)].map(issue=><p key={issue}>{issue.split(' / ')[en?1:0] || issue}</p>)}</div>}
      </>}
      {step === 2 && <>
        <label className="hw-form-row"><b>{t('title')}</b><input value={title} maxLength={120} onChange={e=>edit({title:e.target.value,titleEdited:true})}/></label>
        <label className="hw-form-row"><b>{t('sendClass')}</b><select value={targetClass} onChange={e=>edit({recipientClass:e.target.value,students:[]})}>
          {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="hw-form-row"><b id="hw-recipients">{t('sendStudents')}</b><div role="group" aria-labelledby="hw-recipients">
          {roster?.error && roster.classId === targetClass && <p role="alert">{t('rosterError')} <button type="button" onClick={()=>setRevision(n=>n+1)}>{t('reload')}</button></p>}
          <div className="hw-student-chips">{classStudents.map(s=><label key={s.id}><input type="checkbox" checked={targets.includes(s.id)} onChange={()=>edit({students:toggle(targets,s.id)})}/>{s.name}</label>)}</div>
          <div className="hw-recipient-count"><button type="button" disabled={!classStudents.length} onClick={()=>edit({students:targets.length===classStudents.length ? [] : classStudents.map(s=>s.id)})}>
            {t(targets.length && targets.length===classStudents.length ? 'clearAll' : 'selectAll')}</button> · {t('selectedCount',{total:classStudents.length,n:targets.length})}</div>
        </div></div>
        {!!items.length && <div className="hw-date-row"><HomeworkDeadlinePicker value={form.due} onChange={due=>edit({due})} en={en}/></div>}
        <div className="hw-send-summary"><b>{t('summary')}</b><span>{summaries.join(' · ')}</span></div>
        {(!assignmentTitle || invalidDue || !configValid) && <p role="alert">{!assignmentTitle ? t('emptyTitle') : invalidDue ? t('deadlineError') : t('reviewConfig')}</p>}
      </>}
    </fieldset>
    {error && <p role="alert" className="hw-studio-issue">{error}</p>}
    <footer className="hw-studio-footer">
      <button type="button" className="hw-back" disabled={busy || !!pending} onClick={()=>step ? edit({step:step-1}) : dismissal()}>{step ? t('back') : t('close')}</button>
      {step < 2 ? (!nextInEpisode && nextButton) :
        <button type="button" className="hw-forward" disabled={busy || (!pending&&!ready)} onClick={()=>void send()}><span className="material-symbols-outlined" aria-hidden>send</span>{t(busy?'sending':'sendButton')}</button>}
    </footer>
    {preview && <AccessibleDialog label={t('preview')} onClose={() => setPreview(null)}><div className="hw-preview-dialog"><header><h3>{t('preview')}</h3><button type="button" onClick={() => setPreview(null)}>{t('close')}</button></header>
      <HomeworkPreview title={assignmentTitle} items={preview}/></div></AccessibleDialog>}
  </section>;
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
  const [expanded, setExpanded] = useState(false);
  return <section className="hw-plan-row">
    <div className="hw-plan-head"><strong>{material.kind === 'scene' ? t('categoryScene') : ''} {counts([material],t)}</strong>
      <div className="hw-plan-text"><small>{material.name}</small><span className="hw-checked-plan">{activities.length>0 && <span className="hw-plan-check" aria-hidden="true">✓</span>}{activities.length ? activities.map(id=>t(`activity.${id}`)).join(' · ') : t('pickType')}</span></div>
      <button type="button" className="hw-small-action" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}><span className="material-symbols-outlined" aria-hidden>edit</span>{t(expanded?'done':'chooseLearningActivities')}</button>
    </div>
    {expanded && <div className="hw-plan-fields">
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
    </div>}
  </section>;
}
