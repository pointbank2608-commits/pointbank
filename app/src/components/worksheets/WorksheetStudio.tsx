import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fetchAllWordLists, fetchPhonicsBankResult } from '../../lib/api';
import { ACTIVITY_PURPOSES, WORKSHEET_ACTIVITIES, WORKSHEET_BASICS, worksheetActivity, type ActivityPurpose } from '../../lib/worksheetActivityCatalog';
import { addKnownWorksheetSounds, exampleWorksheet } from '../../lib/worksheetActivitySamples';
import { parseWorksheetFile, readWorksheetStore, rebuildWordTasks, replaceStudioWords, studioKey, studioWordsFromCards, worksheetIssues, writeWorksheetStore, type StudioWord, type WorksheetDocument, type WorksheetStore } from '../../lib/worksheetStudio';
import { teacherCues } from '../../lib/worksheetActivityPrinting';
import { handoffFromLocationState, wordsFromLocationState } from '../../lib/materialsHandoff';
import { speakSequence } from '../../lib/speech';
import type { FullCardItem, PhonicsBankEntry, WordList } from '../../lib/types';
import WorksheetActivitySheets from './WorksheetActivitySheets';
import WorksheetSourceEditor from './WorksheetSourceEditor';
import WorksheetTaskEditor from './WorksheetTaskEditor';
import '../../styles/worksheet-studio.css';

const basicLabels:Record<string,string>={list:'tabList',card:'tabCard',tracing:'tabTracing',quiz:'tabQuiz',coloring:'tabColoring',fillBlank:'tabFillBlank',cutPaste:'tabCutPaste',miniBook:'tabMiniBook',trueFalse:'tabTrueFalse'};
export default function WorksheetStudio() {
 const {session,academy}=useAuth();
 return <WorksheetStudioOwner key={`${session?.user.id}:${academy?.id}`} owner={studioKey(session?.user.id||'guest',academy?.id||'none')}/>;
}
function WorksheetStudioOwner({owner}:{owner:string}) {
 const {t}=useTranslation(),{session,academy}=useAuth(),{notify}=useToast(),location=useLocation(),navigate=useNavigate(),[params]=useSearchParams();
 const tr=(key:string,values?:Record<string,string|number>)=>t(`worksheetStudio.${key}`,values);
 const store=useRef<WorksheetStore>(readWorksheetStore(owner)),[copies,setCopies]=useState(store.current.copies),[copyName,setCopyName]=useState('');
 const [doc,setDoc]=useState<WorksheetDocument|null>(null),docRef=useRef(doc);docRef.current=doc;
 const [purpose,setPurpose]=useState<ActivityPurpose|'all'>('all'),[search,setSearch]=useState(''),[limit,setLimit]=useState(18);
 const [lists,setLists]=useState<WordList[]>([]),[bank,setBank]=useState<PhonicsBankEntry[]>([]),[loading,setLoading]=useState(true),[sourceError,setSourceError]=useState(false);
 const [saved,setSaved]=useState(true),[undo,setUndo]=useState<WorksheetDocument|null>(null),[audience,setAudience]=useState<'student'|'teacher'>('student'),[imageStatus,setImageStatus]=useState<'ready'|'loading'|'error'>('loading'),[pageCount,setPageCount]=useState(0),[printing,setPrinting]=useState(false);
 const preview=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null),[previewScale,setPreviewScale]=useState(1);
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;window.speechSynthesis?.cancel();};},[]);
 const persist=useCallback((value:WorksheetStore)=>{store.current=value;const success=writeWorksheetStore(owner,value);setSaved(success);return success;},[owner]);
 const change=useCallback((next:WorksheetDocument)=>{docRef.current=next;setDoc(next);persist({...store.current,current:{...store.current.current,[next.activityId]:next}});},[persist]);
 const requested=params.get('activity');
 const incoming=handoffFromLocationState(location.state),allowed=!incoming.materialsOwnerId||(incoming.materialsOwnerId===session?.user.id&&incoming.materialsAcademyId===academy?.id);
 const incomingWords=wordsFromLocationState(allowed?location.state:null);
 const consumed=useRef('');
 const navigationInput=useRef({incomingWords,bank,location});navigationInput.current={incomingWords,bank,location};
 useEffect(()=>{
  const {incomingWords:cards,bank:media,location:route}=navigationInput.current;
  if(!requested||!worksheetActivity(requested)){docRef.current=null;setDoc(null);return;}
  if(docRef.current?.activityId!==requested){const next=store.current.current[requested]||exampleWorksheet(requested);docRef.current=next;setDoc(next);setAudience('student');setUndo(null);}
  if(cards.length&&consumed.current!==route.key){consumed.current=route.key;const next=replaceStudioWords(docRef.current!,studioWordsFromCards(cards,media).map(addKnownWorksheetSounds));change(next);navigate(route.pathname+route.search,{replace:true,state:{}});}
 },[requested,location.key,change,navigate]);
 const reloadSources=useCallback(async()=>{
  if(!academy?.id){setLoading(false);return;}setLoading(true);setSourceError(false);
  const results=await Promise.allSettled([fetchAllWordLists(academy.id,'all'),fetchPhonicsBankResult({includeExtensions:true})]);if(!active.current)return;
  if(results[0].status==='fulfilled')setLists(results[0].value);else setSourceError(true);
  if(results[1].status==='fulfilled'&&results[1].value.mediaAvailable)setBank(results[1].value.entries);else setSourceError(true);setLoading(false);
 },[academy?.id]);
 useEffect(()=>{void reloadSources();},[reloadSources]);
 useEffect(()=>{
  const current=docRef.current;if(!current||!bank.length)return;
  const words=current.words.map(w=>{const hit=bank.find(e=>e.word.toLowerCase()===w.word.toLowerCase()&&(e.meaning||'').trim()===w.meaning.trim()&&(!w.patternMarked||e.pattern_marked===w.patternMarked));return hit?{...w,imageUrl:w.sharedImage?hit.image_url:w.imageUrl,lineartUrl:w.sharedLineart?hit.lineart_url??null:w.lineartUrl}:w;});
  if(JSON.stringify(words)!==JSON.stringify(current.words))change({...current,words});
 },[bank,requested,change]);
 const documentOpen=!!doc,landscape=doc?.activityId==='basic-miniBook'&&audience==='student';
 useLayoutEffect(()=>{const el=viewport.current;if(!el)return;const resize=()=>setPreviewScale(Math.min(1,el.clientWidth/(landscape?1063:704)));resize();const obs=new ResizeObserver(resize);obs.observe(el);return()=>obs.disconnect();},[documentOpen,landscape]);
 useEffect(()=>{
  if(!doc||!preview.current)return;let cancelled=false;setImageStatus('loading');
  const frame=requestAnimationFrame(()=>{const imgs=[...preview.current!.querySelectorAll('img')];setPageCount(preview.current!.querySelectorAll('.print-board').length);
   Promise.all(imgs.map(img=>img.decode().then(()=>{if(!img.naturalWidth)throw Error('image');}))).then(()=>{if(!cancelled)setImageStatus('ready');},()=>{if(!cancelled)setImageStatus('error');});
  });return()=>{cancelled=true;cancelAnimationFrame(frame);};
 },[doc,audience]);
 function choose(id:string){let next=store.current.current[id]||exampleWorksheet(id);if(incomingWords.length)next=replaceStudioWords(next,studioWordsFromCards(incomingWords,bank).map(addKnownWorksheetSounds));change(next);setUndo(null);setAudience('student');navigate(`/materials/worksheet?activity=${encodeURIComponent(id)}`,{state:{}});}
 function importWords(cards:FullCardItem[],append:boolean){const current=docRef.current;if(!current)return;if(current.editedTasks&&!append&&!confirm(tr('confirmReplace')))return;setUndo(structuredClone(current));const words=studioWordsFromCards(cards,bank).map(addKnownWorksheetSounds);const combined=append?[...current.words,...words.map(w=>({...w,id:crypto.randomUUID()}))]:words;change(replaceStudioWords(current,combined));}
 function editWords(words:StudioWord[]){const current=docRef.current!;let next={...current,words};const semantic=JSON.stringify(current.words.map(w=>[w.id,w.word,w.meaning,w.example]))!==JSON.stringify(words.map(w=>[w.id,w.word,w.meaning,w.example]));if(worksheetActivity(current.activityId)!.mode==='words'){
   if(!current.editedTasks)next=rebuildWordTasks(next);
   else if(semantic){const validIds=new Set(words.map(w=>w.id)),oldIds=new Set(current.words.map(w=>w.id));next={...next,tasks:[...current.tasks.filter(r=>!r.wordId||validIds.has(r.wordId)),...rebuildWordTasks(next).tasks.filter(r=>r.wordId&&!oldIds.has(r.wordId))],needsReview:true};}
  }change(next);}
 function saveCopy(){if(!doc)return;if(copies.length>=30){notify(tr('storageLimit'),'error');return;}const row={id:crypto.randomUUID(),name:copyName.trim()||doc.title,document:structuredClone(doc),updatedAt:new Date().toISOString()};const next=[row,...copies];const success=persist({...store.current,copies:next});setCopies(next);setCopyName('');notify(tr(success?'copySaved':'saveFailed'),success?undefined:'error');}
 function download(){if(!doc)return;const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${doc.title.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,60)||'ClassBank'}-editable.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function openFile(file:File){try{if(file.size>1024*1024)throw Error('size');const next=parseWorksheetFile(JSON.parse(await file.text()));if(!active.current)return;if(docRef.current)setUndo(structuredClone(docRef.current));change(next);navigate(`/materials/worksheet?activity=${encodeURIComponent(next.activityId)}`,{state:{}});}catch{if(active.current)notify(tr('importFailed'),'error');}}
 async function print(target:'student'|'teacher'){
  if(!doc||worksheetIssues(doc).length||printing||loading)return;setPrinting(true);setAudience(target);
  try{await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));await document.fonts.ready;const imgs=[...preview.current!.querySelectorAll('img')];await Promise.all(imgs.map(i=>i.decode()));if(imgs.some(i=>!i.naturalWidth))throw Error('image');window.print();}catch{notify(tr('imageFailed'),'error');setImageStatus('error');}finally{setPrinting(false);}
 }
 const activity=doc?worksheetActivity(doc.activityId):undefined,issues=useMemo(()=>doc?worksheetIssues(doc):[],[doc]);
 const filtered=WORKSHEET_ACTIVITIES.filter(a=>(purpose==='all'||a.purpose===purpose)&&`${a.ko} ${a.en} ${a.goalKo} ${a.goalEn}`.toLowerCase().includes(search.trim().toLowerCase()));
 const cues=doc?teacherCues(doc):[];
 const editFile=<label className="ws-button ws-file-button">{tr('import')}<input type="file" accept="application/json,.json" onChange={e=>{const f=e.target.files?.[0];if(f)void openFile(f);e.target.value='';}}/></label>;
 const copyShelf=<details className="ws-copy-shelf no-print"><summary>{tr('savedList')} · {copies.length}</summary>{copies.map(copy=><div className="ws-saved-copy" key={copy.id}><span>{copy.name}</span><button type="button" className="ws-button" onClick={()=>{change(structuredClone(copy.document));navigate(`/materials/worksheet?activity=${copy.document.activityId}`,{state:{}});}}>{tr('load')}</button><button type="button" className="ws-button" onClick={()=>{if(confirm(tr('deleteConfirm'))){const next=copies.filter(c=>c.id!==copy.id);setCopies(next);persist({...store.current,copies:next});}}}>{tr('deleteCopy')}</button></div>)}</details>;
 return <div className="worksheet-studio">
  {!doc?<div className="no-print" data-worksheet-hub><Link to="/materials" className="ws-back">← {t('materials.backToMaterials')}</Link><header className="ws-hub-heading"><h1>{tr('title')}</h1><p>{tr('subtitle')}</p><span>{tr('recommended')}</span></header>
   <div className="ws-actions">{editFile}</div>{copyShelf}
   <label className="ws-search">{tr('search')}<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(18);}}/></label>
   <nav className="ws-purpose-nav" aria-label={tr('title')}><button type="button" aria-pressed={purpose==='all'} onClick={()=>{setPurpose('all');setLimit(18);}}>{tr('all')} <small>{WORKSHEET_ACTIVITIES.length}</small></button>{ACTIVITY_PURPOSES.map(p=><button type="button" key={p} aria-pressed={purpose===p} onClick={()=>{setPurpose(p);setLimit(18);}}>{tr(`purpose.${p}`)} <small>{WORKSHEET_ACTIVITIES.filter(a=>a.purpose===p).length}</small></button>)}</nav>
   <p role="status">{tr('count',{count:filtered.length})}</p><div className="ws-activity-grid">{filtered.slice(0,limit).map(a=><button className="ws-activity-card" type="button" key={a.id} onClick={()=>choose(a.id)} data-activity-card={a.id}><span className="ws-purpose-label">{tr(`purpose.${a.purpose}`)}</span><h2>{tr(`activities.${a.id}.title`)}</h2><p>{tr(`activities.${a.id}.goal`)}</p><small>{tr(`people.${a.people}`)} · {tr('time',{count:a.minutes})}</small><strong>{tr('open')} →</strong></button>)}</div>{!filtered.length&&<p>{tr('noResults')}</p>}{filtered.length>limit&&<button type="button" className="ws-button" onClick={()=>setLimit(n=>n+18)}>{tr('more')}</button>}
   <section className="ws-basics"><h2>{tr('basics')}</h2><div className="ws-actions">{WORKSHEET_BASICS.map(tab=><button type="button" key={tab} className="ws-button" onClick={()=>choose('basic-'+tab)}>{t(`materials.worksheet.${basicLabels[tab]}`)}</button>)}</div></section>
  </div>:<>
   <div className="ws-preparation no-print" data-worksheet-editor={doc.activityId}><button type="button" className="ws-back" onClick={()=>navigate('/materials/worksheet',{state:{}})}>← {tr('back')}</button><header><span className="ws-purpose-label">{tr(`purpose.${activity!.purpose}`)}</span><h1>{tr(`activities.${doc.activityId}.title`)}</h1><p>{tr(`activities.${doc.activityId}.goal`)}</p></header>
    <details open className="ws-help"><summary>{tr('help')}</summary><p>{tr(`people.${activity!.people}`)} · {tr('time',{count:activity!.minutes})}</p><ol><li>{tr('prepare')}</li><li>{tr('model')}</li><li>{tr('finish')}</li></ol><p className="ws-tip"><strong>{tr('tip')}: </strong>{tr(`activities.${doc.activityId}.tip`)}</p></details>
    <section className="ws-editor-section"><h2>{tr('stepSource')}</h2>{sourceError&&<p role="alert">{tr('sourceError')}</p>}<div className="ws-actions"><button type="button" className="ws-button" onClick={()=>void reloadSources()} disabled={loading}>{tr('refresh')}</button><button type="button" className="ws-button" onClick={()=>{if(confirm(tr('confirmReplace'))){setUndo(structuredClone(doc));change(exampleWorksheet(doc.activityId));}}}>{tr('sample')}</button>{undo&&<button type="button" className="ws-button" onClick={()=>{change(undo);navigate(`/materials/worksheet?activity=${encodeURIComponent(undo.activityId)}`,{state:{}});setUndo(null);}}>{tr('undo')}</button>}</div>{activity!.mode==='content'&&<p className="ws-note">{tr('contentHint')}</p>}<WorksheetSourceEditor key={owner+doc.activityId} words={doc.words} onChange={editWords} onImport={importWords} lists={lists} loading={loading} activityId={doc.activityId}/></section>
    <section className="ws-editor-section"><h2>{tr('stepEdit')}</h2><WorksheetTaskEditor doc={doc} onChange={change}/>{activity!.mode==='words'&&<div className="ws-actions"><button type="button" className="ws-button" onClick={()=>{if(!doc.editedTasks||confirm(tr('confirmReplace'))){setUndo(structuredClone(doc));change(rebuildWordTasks(doc));}}}>{tr('regenerate')}</button>{doc.needsReview&&<button type="button" className="ws-button" onClick={()=>change({...doc,needsReview:false})}>{tr('reviewDone')}</button>}</div>}</section>
    <section className="ws-editor-section"><h2>{tr('stepPreview')}</h2><p role="status">{saved?tr('autosave'):tr('saveFailed')}</p><div className="ws-actions"><button type="button" className="ws-button" onClick={()=>persist(store.current)}>{tr('save')}</button><button type="button" className="ws-button" onClick={download}>{tr('download')}</button>{editFile}</div><p className="ws-file-hint">{tr('fileHint')}</p><div className="ws-copy-controls"><label>{tr('copyName')}<input value={copyName} maxLength={100} onChange={e=>setCopyName(e.target.value)}/></label><button type="button" className="ws-button" onClick={saveCopy}>{tr('saveCopy')}</button></div>{copyShelf}
     {issues.length>0?<div role="alert" className="ws-validation"><strong>{tr('needs')}</strong><ul>{issues.map((issue,i)=>{const values={...issue.values,...(issue.values?.field?{field:tr(`field.${issue.values.field}`)}:{})};const message=tr(issue.key,values);return <li key={i}>{issue.index===undefined?message:tr('questionNumber',{number:issue.index+1,message})}</li>;})}</ul></div>:<p className="ws-ready">{tr('ready')}</p>}
     {imageStatus==='loading'&&<p>{tr('imageLoading')}</p>}{imageStatus==='error'&&<p role="alert">{tr('imageFailed')}</p>}
     <div className="ws-actions"><button type="button" className="ws-button ws-primary" disabled={!!issues.length||imageStatus!=='ready'||printing||loading} onClick={()=>void print('student')}>{tr('printStudent')}</button><button type="button" className="ws-button" disabled={!!issues.length||imageStatus!=='ready'||printing||loading} onClick={()=>void print('teacher')}>{tr('printTeacher')}</button></div>
    </section>
    <div className="ws-preview-controls"><div className="ws-actions"><button type="button" className="ws-button" aria-pressed={audience==='student'} onClick={()=>setAudience('student')}>{tr('student')}</button><button type="button" className="ws-button" aria-pressed={audience==='teacher'} onClick={()=>setAudience('teacher')}>{tr('teacher')}</button></div><span>{tr('pages',{count:pageCount})}</span></div>
    {audience==='teacher'&&cues.length>0&&<div className="ws-actions"><button type="button" className="ws-button" onClick={()=>speakSequence(cues)}>{tr('listen')}</button><button type="button" className="ws-button" onClick={()=>window.speechSynthesis?.cancel()}>{tr('stop')}</button><small>{tr('voiceHint')}</small></div>}
   </div><div className="ws-preview-viewport" ref={viewport}><div className={`ws-preview-stack print-sheet${landscape?' ws-landscape-stack':''}`} ref={preview} style={{zoom:previewScale}} data-audience={audience}><WorksheetActivitySheets doc={doc} audience={audience}/></div></div>
  </>}
 </div>;
}
