import {useCallback,useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useSearchParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useToast} from '../context/ToastContext';
import {useLessonRunner} from '../context/LessonRunnerContext';
import {createCurriculumLesson,createWordList,fetchAllCurriculumLessons,fetchCurriculumLessonById,fetchSavedGames} from '../lib/api';
import {announceLessonChange} from '../lib/lessonChanges';
import {copyStem,emptyStem,saveStemPlaylist,stemFromLesson,stemPlaylist,stemWordItems,validateStem} from '../lib/stem';
import {effectiveSlides} from '../lib/lessonSlides';
import {READY_STEM,REVIEW_STEM} from '../data/stemLessons';
import type {StemLesson} from '../lib/stemTypes';
import type {CurriculumLesson,GameTemplate} from '../lib/types';
import StemPlayer from '../components/stem/StemPlayer';
import StemEditor from '../components/stem/StemEditor';
import StemReportPreview from '../components/stem/StemReport';
import AccessibleDialog from '../components/AccessibleDialog';
import '../styles/stem.css';

export default function StemLibraryPage(){
 const {t}=useTranslation();const {academy,profile}=useAuth();const {notify}=useToast();const runner=useLessonRunner();const [params,setParams]=useSearchParams();
 const [tab,setTab]=useState<'ready'|'mine'>('ready'),[rows,setRows]=useState<CurriculumLesson[]>([]),[games,setGames]=useState<GameTemplate[]>([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(false);
 const [draft,setDraft]=useState<StemLesson|null>(null),[editing,setEditing]=useState<CurriculumLesson|null>(null),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 const [preview,setPreview]=useState<{lesson:StemLesson;row?:CurriculumLesson;index?:number}|null>(null),[report,setReport]=useState<StemLesson['meta']['report']|null>(null),[adding,setAdding]=useState<StemLesson|null>(null),[target,setTarget]=useState('');
 const academyId=academy?.id;
 const reload=useCallback(async()=>{if(!academyId){setLoading(false);return;}setLoading(true);setLoadError(false);try{setRows(await fetchAllCurriculumLessons(academyId));}catch{setLoadError(true);}finally{setLoading(false);}try{setGames(await fetchSavedGames(academyId));}catch{/* Existing lesson library remains usable. */}},[academyId]);
 useEffect(()=>{void reload();},[reload]);
 useEffect(()=>{const id=params.get('copy');if(!id||draft||!profile)return;const source=[...READY_STEM,...REVIEW_STEM].find(l=>l.meta.sourceId===id);if(source){setDraft(copyStem(source,profile.id));setEditing(null);setDirty(false);setTab('mine');const next=new URLSearchParams(params);next.delete('copy');setParams(next,{replace:true});}},[params,draft,profile,setParams]);
 useEffect(()=>{const id=params.get('edit');if(id&&!draft){const row=rows.find(r=>r.id===id&&r.created_by===profile?.id);if(row){const source=stemFromLesson(row);if(source){setEditing(row);setDraft(source);setDirty(false);setTab('mine');}}}},[params,rows,profile,draft]);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const closeEditor=()=>{if(dirty&&!window.confirm(t('stem.confirmDiscard')))return false;setDraft(null);setEditing(null);setDirty(false);setError('');setParams({}, {replace:true});return true;};
 function edit(source:StemLesson,row?:CurriculumLesson){if(!profile)return;if(dirty&&!window.confirm(t('stem.confirmDiscard')))return;setDraft(row?structuredClone(source):copyStem(source,profile.id));setEditing(row||null);setDirty(false);setError('');setTab('mine');}
 const issues=(source:StemLesson)=>validateStem(source).map(key=>t(`stem.${({words:'wordsError',game:'gameError',video:'videoError',report:'reportError'} as Record<string,string>)[key]||key}`));
 async function save(){if(!draft||!academy||!profile||lock.current)return;const bad=issues(draft);if(bad.length){setError(t('stem.validation',{items:bad.join(' · ')}));return;}lock.current=true;setBusy(true);setError('');try{
  const data={...draft,meta:{...draft.meta,ownerId:profile.id,visibility:'academy' as const,published:false}};const playlist=stemPlaylist(data);
  if(editing){if(editing.created_by!==profile.id)throw new Error('owner');await saveStemPlaylist(editing,playlist,data.meta.title);announceLessonChange(academy.id,editing.id);}else{const saved=await createCurriculumLesson({academyId:academy.id,classId:null,teacherId:profile.id,name:data.meta.title,wordListId:null,videoUrl:null,level:'STEM',playlist});announceLessonChange(academy.id,saved.id);}
  setDraft(null);setEditing(null);setDirty(false);setParams({}, {replace:true});setTab('mine');notify(t('stem.saved'));await reload();
 }catch{setError(t('stem.saveError'));}finally{lock.current=false;setBusy(false);}}
 async function add(){if(!adding||!target||!academy||!profile||lock.current)return;lock.current=true;setBusy(true);setError('');try{
  const data=copyStem(adding,profile.id),playlist=stemPlaylist(data);if(issues(data).length)throw new Error('invalid');
  let id:string;
  if(target==='new'){const saved=await createCurriculumLesson({academyId:academy.id,classId:null,teacherId:profile.id,name:data.meta.title,wordListId:null,videoUrl:null,level:'STEM',playlist});id=saved.id;}else{const row=await fetchCurriculumLessonById(target);if(row.academy_id!==academy.id)throw new Error('scope');await saveStemPlaylist(row,[...effectiveSlides(row),...playlist]);id=row.id;}
  announceLessonChange(academy.id,id);notify(t('stem.added'));setAdding(null);setTarget('');await reload();
 }catch{setError(t('stem.saveError'));}finally{lock.current=false;setBusy(false);}}
 async function saveWords(source:StemLesson){if(!academy||!profile||lock.current)return;lock.current=true;setBusy(true);try{await createWordList({academyId:academy.id,classId:null,name:`${source.meta.title} · STEM`,teacherId:profile.id,items:stemWordItems(source)});notify(t('stem.wordsSaved'));}catch{notify(t('stem.saveError'),'error');}finally{lock.current=false;setBusy(false);}}
 const mine=rows.filter(r=>r.level==='STEM'&&r.created_by===profile?.id).map(row=>({row,lesson:stemFromLesson(row)})).filter((v):v is {row:CurriculumLesson;lesson:StemLesson}=>!!v.lesson);
 function card(lesson:StemLesson,row?:CurriculumLesson){const m=lesson.meta,videos=lesson.frames.filter(f=>f.mode==='video').length,hasReport=lesson.frames.some(f=>f.mode==='report');return <article className="stem-card" key={row?.id||m.sourceId}><img loading="lazy" src={lesson.frames.find(f=>f.imageUrl)?.imageUrl||'/ui2/m-paper.webp'} alt=""/><div className="stem-card-body"><div><h2>{m.title}</h2>{m.reviewSample&&<span className="stem-review-badge">{t('stem.reviewSample')}</span>}<p>{m.description}</p></div><dl><div><dt>{t('stem.grade')}</dt><dd>{m.grade}</dd></div><div><dt>{t('stem.level')}</dt><dd>{m.level}</dd></div><dd>{t('stem.minutes',{count:m.duration})}</dd><dd>{m.category}</dd><dd>{t('stem.slides',{count:lesson.frames.length})}</dd><dd>{t(hasReport?'stem.report':'stem.noReport')}</dd><dd>{t(videos?'stem.video':'stem.noVideo',{count:videos})}</dd></dl><div className="stem-actions"><button className="stem-primary" onClick={()=>setPreview({lesson,row})}>{t('stem.preview')}</button><button onClick={()=>{setAdding(lesson);setError('');setTarget('');}}>{t('stem.addLesson')}</button><button onClick={()=>edit(lesson,row)}>{t(row?'stem.edit':'stem.duplicate')}</button></div>{row&&<button onClick={()=>edit({...lesson,meta:{...m,title:t('stem.copyName',{name:m.title})}})}>{t('stem.duplicate')}</button>}{hasReport&&<button onClick={()=>{const f=lesson.frames.find(f=>f.mode==='report');setReport(f?.report||(f?.metaOverride||m).report);}}>{t('stem.reportPreview')}</button>}<details><summary>{t('stem.words')} · {m.vocabulary.length}</summary><ul>{m.vocabulary.map(w=><li key={w.id}><b>{w.word}</b> · {w.meaning} · {w.example}</li>)}</ul><button disabled={busy||!m.vocabulary.length} onClick={()=>void saveWords(lesson)}>{t('stem.saveWords')}</button></details></div></article>;}
 return <main className="stem-page space-y-6" data-stem-ready><header className="stem-toolbar"><div><h1>{t('stem.title')}</h1><p>{t('stem.intro')}</p></div><button className="stem-primary" disabled={!profile||busy} onClick={()=>profile&&edit(emptyStem(profile.id))}>{t('stem.newLesson')}</button></header>
  <nav role="tablist" className="stem-tabs" aria-label={t('stem.title')}>{(['ready','mine']as const).map(k=><button key={k} role="tab" aria-selected={tab===k} onClick={()=>{if(draft&&!closeEditor())return;setTab(k);}}>{t(`stem.${k}`)}</button>)}</nav>
  {draft&&academy?<StemEditor lesson={draft} academyId={academy.id} games={games} busy={busy} error={error} onChange={next=>{setDraft(next);setDirty(true);}} onSave={()=>void save()} onClose={closeEditor} onPreview={index=>setPreview({lesson:draft,index})} onReport={r=>setReport(r||draft.meta.report)}/>:tab==='ready'?<div className="stem-catalog">{[...READY_STEM,...REVIEW_STEM].map(l=>card(l))}</div>:<><p className="stem-note">{t('stem.savedScope')}</p>{loading?<p>{t('common.loading')}</p>:loadError?<p role="alert">{t('stem.loadError')}</p>:mine.length?<div className="stem-catalog">{mine.map(v=>card(v.lesson,v.row))}</div>:<p className="stem-empty">{t('stem.noMine')}</p>}</>}
  {preview&&<StemPlayer lesson={preview.lesson} initialIndex={preview.index} onClose={()=>setPreview(null)} onRunSaved={preview.row?(index)=>{const row=preview.row!;setPreview(null);runner.start(row,null,row.class_id,{startSlideId:preview.lesson.frames[index].id,returnToEdit:true});}:undefined}/>}
  {report&&<StemReportPreview report={report} onClose={()=>setReport(null)}/>}
  {adding&&<AccessibleDialog label={t('stem.addLesson')} onClose={()=>{if(!busy)setAdding(null);}}><div className="stem-add"><h2>{t('stem.addLesson')}</h2><p>{adding.meta.title}</p><label>{t('stem.chooseLesson')}<select aria-label={t('stem.chooseLesson')} value={target} disabled={busy||loading} onChange={e=>setTarget(e.target.value)}><option value="">{t('stem.selectTarget')}</option><option value="new">{t('stem.newTarget')}</option>{rows.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>{error&&<p role="alert">{error}</p>}<div className="stem-actions"><button disabled={busy} onClick={()=>setAdding(null)}>{t('stem.cancel')}</button><button className="stem-primary" disabled={busy||!target||loadError} onClick={()=>void add()}>{t(busy?'stem.working':'stem.addLesson')}</button></div></div></AccessibleDialog>}
 </main>;
}
