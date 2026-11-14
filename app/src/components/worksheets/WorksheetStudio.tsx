import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fetchAllWordLists, fetchPhonicsBankResult } from '../../lib/api';
import { ACTIVITY_PURPOSES, WORKSHEET_ACTIVITIES, WORKSHEET_BASIC_ACTIVITIES, worksheetActivity, type ActivityPurpose } from '../../lib/worksheetActivityCatalog';
import { addKnownWorksheetSounds } from '../../lib/worksheetActivitySamples';
import { parseWorksheetFile, readWorksheetStore, rebuildWordTasks, replaceStudioWords, studioKey, studioWordsFromCards, writeWorksheetStore, type StudioWord, type WorksheetDocument, type WorksheetStore } from '../../lib/worksheetStudio';
import { teacherCues } from '../../lib/worksheetActivityPrinting';
import { handoffFromLocationState } from '../../lib/materialsHandoff';
import { speakSequence } from '../../lib/speech';
import type { FullCardItem, PhonicsBankEntry, WordList } from '../../lib/types';
import {prepareWorksheet,worksheetRequirement} from '../../lib/worksheetPreparation';
import {documentFromSource,sourceFromList,sourceFromHandoff,rememberWorksheetSource,restoreWorksheetSource,worksheetSource,type WorksheetSource} from '../../lib/worksheetSources';
import WorksheetSourceDialog from './WorksheetSourceDialog';
import WorksheetActivitySheets from './WorksheetActivitySheets';
import WorksheetSourceEditor from './WorksheetSourceEditor';
import WorksheetTaskEditor from './WorksheetTaskEditor';
import WorksheetSampleCard from './WorksheetSampleCard';
import WorksheetSampleDialog from './WorksheetSampleDialog';
import '../../styles/worksheet-studio.css';

export default function WorksheetStudio() {
 const {session,academy}=useAuth();
 return <WorksheetStudioOwner key={`${session?.user.id}:${academy?.id}`} owner={studioKey(session?.user.id||'guest',academy?.id||'none')}/>;
}
function WorksheetStudioOwner({owner}:{owner:string}) {
 const {t,i18n}=useTranslation(),{session,academy}=useAuth(),{notify}=useToast(),location=useLocation(),navigate=useNavigate(),[params]=useSearchParams();
 const tr=(key:string,values?:Record<string,string|number>)=>t(`worksheetStudio.${key}`,values);
 const store=useRef<WorksheetStore>(readWorksheetStore(owner)),[copies,setCopies]=useState(store.current.copies),[copyName,setCopyName]=useState('');
 const [doc,setDoc]=useState<WorksheetDocument|null>(null),docRef=useRef(doc);docRef.current=doc;
 const [purpose,setPurpose]=useState<ActivityPurpose|'all'>('all'),[search,setSearch]=useState(''),[limit,setLimit]=useState(18);
 const [lists,setLists]=useState<WordList[]>([]),[bank,setBank]=useState<PhonicsBankEntry[]>([]),[loading,setLoading]=useState(true),[sourceError,setSourceError]=useState(false);
 const [saved,setSaved]=useState(true),[undo,setUndo]=useState<WorksheetDocument|null>(null),[audience,setAudience]=useState<'student'|'teacher'>('student'),[imageStatus,setImageStatus]=useState<'ready'|'loading'|'error'>('loading'),[pageCount,setPageCount]=useState(0),[printing,setPrinting]=useState(false);
 const inlineEditor=useRef<HTMLDetailsElement>(null);
 const preview=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null),[previewScale,setPreviewScale]=useState(1);
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;window.speechSynthesis?.cancel();};},[]);
 const persist=useCallback((value:WorksheetStore)=>{store.current=value;const success=writeWorksheetStore(owner,value);setSaved(success);return success;},[owner]);
 const change=useCallback((next:WorksheetDocument)=>{docRef.current=next;setDoc(next);persist({...store.current,current:{...store.current.current,[next.activityId]:next}});},[persist]);
 const requested=params.get('activity'),sourceId=params.get('source');
 const incoming=handoffFromLocationState(location.state),allowed=!incoming.materialsOwnerId||(incoming.materialsOwnerId===session?.user.id&&incoming.materialsAcademyId===academy?.id);
 const [source,setSource]=useState<WorksheetSource|null>(()=>sourceFromHandoff(allowed?incoming:{})||(params.get('source')?restoreWorksheetSource(owner,params.get('source')!):null));
 const [sourceDialog,setSourceDialog]=useState(false),[showAll,setShowAll]=useState(false),[sampleId,setSampleId]=useState<string|null>(null);
 const sourceRef=useRef(source);sourceRef.current=source;
 const route=useCallback((id?:string,selection:WorksheetSource|null=sourceRef.current)=>'/materials/worksheet'+((id||selection)?'?'+new URLSearchParams({...id?{activity:id}:{},...selection?{source:selection.id}:{}}).toString():''),[]);
 useEffect(()=>{const h=handoffFromLocationState(location.state);if(h.materialsOwnerId&&(h.materialsOwnerId!==session?.user.id||h.materialsAcademyId!==academy?.id))return;const selected=sourceFromHandoff(h);if(selected){rememberWorksheetSource(owner,selected);setSource(selected);navigate(route(requested||undefined,selected),{replace:true,state:{}});}},[location.key,location.state,session?.user.id,academy?.id,owner,requested,navigate,route]); // consume an explicit handoff once; format navigation carries the source ID
 useEffect(()=>{const id=sourceId;if(id&&id!==sourceRef.current?.id){setSource(restoreWorksheetSource(owner,id));}},[sourceId,owner]);
 useEffect(()=>{const id=sourceId;if(!id||sourceRef.current?.id===id||loading)return;const list=lists.find(l=>l.id===id);if(list){const selected=sourceFromList(list);setSource(selected);rememberWorksheetSource(owner,selected);}},[lists,loading,sourceId,owner,sourceError]);
 useEffect(()=>{
  if(!requested||!worksheetActivity(requested)){docRef.current=null;setDoc(null);return;}
  if(sourceId&&!source)return;
  if(source&&loading&&!bank.length)return;
  if(docRef.current?.activityId===requested&&docRef.current.source?.id===source?.id)return;
  const next=documentFromSource(requested,source,bank,store.current.current[requested]);docRef.current=next;setDoc(next);setAudience('student');setUndo(null);change(next);
  if(!source&&next.source){const restored={...worksheetSource(next.source.id,next.source.name,next.source.kind,next.words),revision:next.source.revision||''};sourceRef.current=restored;setSource(restored);rememberWorksheetSource(owner,restored);navigate(route(requested,restored),{replace:true,state:{}});}
 },[requested,source,sourceId,loading,bank,change,navigate,owner,route]);
 const reloadSources=useCallback(async()=>{
  if(!academy?.id){setLoading(false);return;}setLoading(true);setSourceError(false);
  const results=await Promise.allSettled([fetchAllWordLists(academy.id,'all'),fetchPhonicsBankResult({includeExtensions:true})]);if(!active.current)return;
  if(results[0].status==='fulfilled')setLists(results[0].value);else setSourceError(true);
  if(results[1].status==='fulfilled')setBank(results[1].value.entries);setLoading(false);
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
 function choose(id:string){setUndo(null);setAudience('student');navigate(route(id),{state:{}});}
 function applySource(list:WordList,append:boolean){
  if(docRef.current?.editedTasks&&!confirm(tr('confirmReplace')))return;
  const selected=sourceFromList(list);if(append&&docRef.current){const combined=[...docRef.current.words,...selected.cards.map(c=>({...c,id:crypto.randomUUID()}))];selected.id='combined:'+crypto.randomUUID();selected.name=(source?.name||docRef.current.source?.name||'자료')+' + '+list.name;selected.cards=combined;selected.revision=worksheetSource(selected.id,selected.name,selected.kind,combined).revision;}
  if(docRef.current)setUndo(structuredClone(docRef.current));rememberWorksheetSource(owner,selected);sourceRef.current=selected;setSource(selected);setSourceDialog(false);
  if(docRef.current){const next=documentFromSource(docRef.current.activityId,selected,bank);change(next);}navigate(route(requested||undefined,selected),{state:{}});
 }
 function openStored(next:WorksheetDocument){let selected:WorksheetSource|null=null;if(next.source){selected={...worksheetSource(next.source.id,next.source.name,next.source.kind,next.words),revision:next.source.revision||''};rememberWorksheetSource(owner,selected);}sourceRef.current=selected;setSource(selected);change(next);navigate(route(next.activityId,selected),{state:{}});}
 function useSample(next:WorksheetDocument){
  const previous=store.current.current[next.activityId];
  if(previous&&copies.length>=30){notify(tr('storageLimit'),'error');return 'storageLimit' as const;}
  const nextCopies=previous?[{id:crypto.randomUUID(),name:tr('previousWork',{title:previous.title}).slice(0,100),document:structuredClone(previous),updatedAt:new Date().toISOString()},...copies]:copies;
  const nextStore={...store.current,copies:nextCopies,current:{...store.current.current,[next.activityId]:next}};
  // Write atomically before replacing the screen so a quota failure cannot discard earlier work.
  if(!writeWorksheetStore(owner,nextStore)){setSaved(false);notify(tr('saveFailed'),'error');return 'saveFailed' as const;}
  store.current=nextStore;setCopies(nextCopies);setSaved(true);docRef.current=next;setDoc(next);sourceRef.current=null;setSource(null);setUndo(previous?structuredClone(previous):null);setAudience('student');setSampleId(null);
  navigate(`/materials/worksheet?activity=${encodeURIComponent(next.activityId)}`,{state:{}});
  return null;
 }
 function importWords(cards:FullCardItem[],append:boolean){const current=docRef.current;if(!current)return;if(current.editedTasks&&!append&&!confirm(tr('confirmReplace')))return;setUndo(structuredClone(current));const words=studioWordsFromCards(cards,bank).map(addKnownWorksheetSounds);const combined=append?[...current.words,...words.map(w=>({...w,id:crypto.randomUUID()}))]:words;change(replaceStudioWords(current,combined));}
 function editWords(words:StudioWord[]){const current=docRef.current!;let next={...current,words};const semantic=JSON.stringify(current.words.map(w=>[w.id,w.word,w.meaning,w.example]))!==JSON.stringify(words.map(w=>[w.id,w.word,w.meaning,w.example]));if(worksheetActivity(current.activityId)!.mode==='words'){
   if(!current.editedTasks)next=rebuildWordTasks(next);
   else if(semantic){const validIds=new Set(words.map(w=>w.id)),oldIds=new Set(current.words.map(w=>w.id));next={...next,tasks:[...current.tasks.filter(r=>!r.wordId||validIds.has(r.wordId)),...rebuildWordTasks(next).tasks.filter(r=>r.wordId&&!oldIds.has(r.wordId))],needsReview:true};}
  }change(next);}
 function saveCopy(){if(!doc)return;if(copies.length>=30){notify(tr('storageLimit'),'error');return;}const row={id:crypto.randomUUID(),name:copyName.trim()||doc.title,document:structuredClone(doc),updatedAt:new Date().toISOString()};const next=[row,...copies];const success=persist({...store.current,copies:next});setCopies(next);setCopyName('');notify(tr(success?'copySaved':'saveFailed'),success?undefined:'error');}
 function download(){if(!doc)return;const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${doc.title.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,60)||'ClassBank'}-editable.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function openFile(file:File){try{if(file.size>1024*1024)throw Error('size');const next=parseWorksheetFile(JSON.parse(await file.text()));if(!active.current)return;if(docRef.current)setUndo(structuredClone(docRef.current));openStored(next);}catch{if(active.current)notify(tr('importFailed'),'error');}}
 async function print(target:'student'|'teacher'){
  if(!doc||!plan?.ready||sourceBlocked||!pageCount||printing||loading)return;setPrinting(true);setAudience(target);
  try{await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));await document.fonts.ready;const imgs=[...preview.current!.querySelectorAll('img')];await Promise.all(imgs.map(i=>i.decode()));if(imgs.some(i=>!i.naturalWidth))throw Error('image');window.print();}catch{notify(tr('imageFailed'),'error');setImageStatus('error');}finally{setPrinting(false);}
 }
 const activity=doc?worksheetActivity(doc.activityId):undefined,plan=useMemo(()=>doc?prepareWorksheet(doc):null,[doc]);
 const issues=plan?.issues||[];const sourceBlocked=!!params.get('source')&&!source;
 const sourceName=source?.name||doc?.source?.name;const allActivities=[...WORKSHEET_BASIC_ACTIVITIES,...WORKSHEET_ACTIVITIES];
 const cardDocument=(id:string)=>documentFromSource(id,source,bank,store.current.current[id]);
 const recommended=['basic-tracing','pictureMatch','scramble','basic-fillBlank','wordSearch'];
 const recommendedCards=source?.kind==='sentence'?['sentenceOrder','dictation','readMatch']:recommended;
 const visibleCards=source&&!showAll?recommendedCards.map(id=>worksheetActivity(id)!):null;
 const cues=plan?.ready?teacherCues(plan.doc):[];
 const editFile=<label className="ws-button ws-file-button">{tr('import')}<input type="file" accept="application/json,.json" onChange={e=>{const f=e.target.files?.[0];if(f)void openFile(f);e.target.value='';}}/></label>;
 const copyShelf=<details className="ws-copy-shelf no-print"><summary>{tr('savedList')} · {copies.length}</summary>{copies.map(copy=><div className="ws-saved-copy" key={copy.id}><span>{copy.name}</span><button type="button" className="ws-button" onClick={()=>{openStored(structuredClone(copy.document));}}>{tr('load')}</button><button type="button" className="ws-button" onClick={()=>{if(confirm(tr('deleteConfirm'))){const next=copies.filter(c=>c.id!==copy.id);setCopies(next);persist({...store.current,copies:next});}}}>{tr('deleteCopy')}</button></div>)}</details>;
 const sourceBar=<div className="ws-current-source" data-worksheet-source data-source-id={source?.id||doc?.source?.id||''}><span>{sourceName?tr('usingSource'):tr('sampleSource')}</span><strong>{sourceName||tr('samplePreview')}</strong><span>{source||doc?<>{source?.cards.length??doc?.source?.total??doc?.words.length} {tr('itemsUnit')}</>:null}</span><button type="button" className="ws-button" onClick={()=>setSourceDialog(true)}>{sourceName?tr('changeSource'):i18n.language.startsWith('en')?'Use my material':'내 자료로 바꾸기'}</button></div>;
 const cardsToShow=(visibleCards?visibleCards.filter(a=>prepareWorksheet(cardDocument(a.id)).ready):allActivities.filter(a=>(purpose==='all'||a.purpose===purpose)&&`${a.ko} ${a.en} ${a.goalKo} ${a.goalEn}`.toLowerCase().includes(search.trim().toLowerCase())));
 return <div className="worksheet-studio">
  {sourceBlocked&&requested?<div className="no-print" data-source-blocked><h1>{tr('title')}</h1><p role={loading?'status':'alert'}>{loading?tr('loadingSource'):tr('loadSourceFailed')}</p>{!loading&&<button type="button" className="ws-button" onClick={()=>void reloadSources()}>{tr('retrySource')}</button>}</div>:!doc?<div className="no-print" data-worksheet-hub>
   <Link to="/materials" className="ws-back">← {t('materials.backToMaterials')}</Link><header className="ws-hub-heading"><h1>{tr('title')}</h1><p>{tr('subtitle')}</p></header>{sourceBar}
   <h2>{source&&!showAll?tr('usableFormats'):tr('allFormats')}</h2>
   {(!source||showAll)&&<><label className="ws-search">{tr('search')}<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(18);}}/></label><nav className="ws-purpose-nav" aria-label={tr('title')}><button type="button" aria-pressed={purpose==='all'} onClick={()=>{setPurpose('all');setLimit(18);}}>{tr('all')}</button>{ACTIVITY_PURPOSES.map(p=><button type="button" key={p} aria-pressed={purpose===p} onClick={()=>{setPurpose(p);setLimit(18);}}>{tr(`purpose.${p}`)}</button>)}</nav></>}
   {sourceBlocked&&<p role="alert">{loading?tr('loadingSource'):tr('loadSourceFailed')} <button type="button" onClick={()=>void reloadSources()}>{tr('retrySource')}</button></p>}
   <div className="ws-activity-grid">{cardsToShow.slice(0,limit).map(a=><WorksheetSampleCard key={a.id} activity={a} document={source?cardDocument(a.id):undefined} onPreview={()=>setSampleId(a.id)} onEdit={()=>choose(a.id)}/>)}</div>
   {!cardsToShow.length&&<p>{tr('noResults')}</p>}{source&&!showAll&&<button type="button" className="ws-button ws-all-formats" onClick={()=>{setShowAll(true);setPurpose('all');setLimit(30);}}>{tr('allFormats')}</button>}{cardsToShow.length>limit&&<button type="button" className="ws-button" onClick={()=>setLimit(n=>n+18)}>{tr('more')}</button>}
   <details className="ws-editor-section"><summary>{tr('savedList')}</summary><div className="ws-actions">{editFile}</div>{copyShelf}</details>
  </div>:<>
   <div className="ws-edit-layout"><div className="ws-edit-sidebar no-print"><div className="ws-preparation no-print" data-worksheet-editor={doc.activityId}>
    <button type="button" className="ws-back" onClick={()=>navigate(route(),{state:{}})}>← {tr('back')}</button><header><h1>{tr(`activities.${doc.activityId}.title`)}</h1></header>
    <details className="ws-help"><summary>{tr('help')}</summary><p>{tr(`activities.${doc.activityId}.goal`)}</p><p>{tr(`people.${activity!.people}`)} · {tr('time',{count:activity!.minutes})}</p><ol><li>{tr('prepare')}</li><li>{tr('model')}</li><li>{tr('finish')}</li></ol><p className="ws-tip">{tr(`activities.${doc.activityId}.tip`)}</p></details>
    {sourceBar}
    {source&&activity!.mode==='words'&&<details className="ws-editor-section"><summary>같은 자료로 다른 활동 만들기</summary><div className="ws-actions">{recommendedCards.filter(id=>id!==doc.activityId&&prepareWorksheet(cardDocument(id)).ready).map(id=><button key={id} type="button" className="ws-button" onClick={()=>choose(id)}>{tr(`activities.${id}.title`)}</button>)}</div></details>}
    {activity!.mode==='content'&&<p className="ws-note" data-content-source>{tr('builtInSource')}</p>}
    <div className="ws-preview-controls"><h2>{tr('preview')}</h2><span role="status" data-worksheet-usage>{doc.activityId==='basic-coloring'&&!plan!.ready?'색칠용 그림이 있는 단어 0개':activity!.mode==='content'?doc.tasks.length+'문항 · A4 '+plan!.pages+'쪽':tr('usedPages',{total:plan!.totalCount,used:plan!.usedCount,pages:plan!.pages})}</span></div>
    {doc.activityId==='targetLetters'&&plan!.ready&&<p data-used-rules>{tr('appliedRules')}: {[...new Set(plan!.doc.words.map(w=>w.soundGroup||w.category||w.patternMarked))].join(', ')}</p>}
    {doc.activityId==='frayer'&&<details className="ws-editor-section"><summary>{tr('chooseWords')} · {plan!.pages} {tr('pagesUnit')}</summary><p>{tr('oneWordPage')}</p><div className="ws-word-checks">{doc.words.map(word=><label key={word.id}><input type="checkbox" checked={(doc.selectedWordIds||doc.words.slice(0,1).map(w=>w.id)).includes(word.id)} onChange={e=>{const selected=doc.selectedWordIds||doc.words.slice(0,1).map(w=>w.id);change({...doc,selectedWordIds:e.target.checked?[...selected,word.id]:selected.filter(id=>id!==word.id)});}}/>{word.word}</label>)}</div></details>}
    {!plan!.ready&&<div role="alert" className="ws-validation" data-worksheet-requirement><strong>{tr('cannotPrint')}</strong><p>{tr('requirement.'+worksheetRequirement(doc.activityId))}</p>{doc.activityId==='basic-coloring'&&<button type="button" className="ws-button" onClick={()=>{const editor=inlineEditor.current;if(editor){editor.open=true;editor.querySelector('summary')?.focus();}}}>선화 추가</button>}<button type="button" className="ws-button" onClick={()=>setSourceDialog(true)}>{doc.activityId==='basic-coloring'?'다른 자료 선택':tr(worksheetRequirement(doc.activityId)==='sentences'?'chooseSentences':'changeSource')}</button><ul>{issues.slice(0,6).map((issue,i)=><li key={i}>{tr(issue.key,{...issue.values,...issue.values?.field?{field:tr(`field.${issue.values.field}`)}:{}})}</li>)}</ul></div>}
    {plan!.excluded.length>0&&plan!.ready&&<p className="ws-note">{tr('excludedCount',{count:plan!.excluded.length})}</p>}
    <div className="ws-actions ws-print-actions"><button type="button" className="ws-button" onClick={()=>{const editor=inlineEditor.current;if(editor){editor.open=true;editor.querySelector('summary')?.focus();}}}>{tr('editWords')}</button><button type="button" className="ws-button ws-primary" disabled={!plan!.ready||!pageCount||imageStatus!=='ready'||printing||loading||sourceBlocked} onClick={()=>void print('student')}>{tr('printStudent')}</button><button type="button" className="ws-button" disabled={!plan!.ready||!pageCount||imageStatus!=='ready'||printing||loading||sourceBlocked} onClick={()=>void print('teacher')}>{tr('printTeacher')}</button></div>
    {imageStatus==='loading'&&plan!.ready&&<p role="status">{tr('imageLoading')}</p>}{imageStatus==='error'&&<p role="alert">{tr('imageFailed')}</p>}
    <div className="ws-preview-controls"><div className="ws-actions"><button type="button" className="ws-button" aria-pressed={audience==='student'} onClick={()=>setAudience('student')}>{tr('student')}</button><button type="button" className="ws-button" aria-pressed={audience==='teacher'} onClick={()=>setAudience('teacher')}>{tr('teacher')}</button></div><span>{tr('pages',{count:pageCount})}</span></div>
    {audience==='teacher'&&cues.length>0&&<div className="ws-actions"><button type="button" className="ws-button" onClick={()=>speakSequence(cues)}>{tr('listen')}</button><button type="button" className="ws-button" onClick={()=>window.speechSynthesis?.cancel()}>{tr('stop')}</button></div>}
   </div>
   <details ref={inlineEditor} className="ws-editor-section no-print"><summary id="worksheet-detail-edit">{tr('editWords')}</summary><WorksheetSourceEditor key={owner+doc.activityId} compact words={doc.words} onChange={editWords} onImport={importWords} lists={lists} loading={loading} activityId={doc.activityId}/><details><summary>{tr('stepEdit')}</summary><WorksheetTaskEditor doc={doc} onChange={change}/>{activity!.mode==='words'&&<button type="button" className="ws-button" onClick={()=>{if(!doc.editedTasks||confirm(tr('confirmReplace'))){setUndo(structuredClone(doc));change(rebuildWordTasks(doc));}}}>{tr('regenerate')}</button>}</details>{undo&&<button type="button" className="ws-button" onClick={()=>{openStored(undo);setUndo(null);}}>{tr('undo')}</button>}</details></div>
   <div className="ws-preview-viewport" ref={viewport}><div className={`ws-preview-stack print-sheet${landscape?' ws-landscape-stack':''}`} ref={preview} style={{zoom:previewScale}} data-audience={audience}><WorksheetActivitySheets doc={doc} audience={audience}/></div></div></div>
   <details className="ws-editor-section no-print"><summary>{tr('savedList')}</summary><p role="status">{saved?tr('autosave'):tr('saveFailed')}</p><div className="ws-actions"><button type="button" className="ws-button" onClick={()=>persist(store.current)}>{tr('save')}</button><button type="button" className="ws-button" onClick={download}>{tr('download')}</button>{editFile}</div><div className="ws-copy-controls"><label>{tr('copyName')}<input value={copyName} maxLength={100} onChange={e=>setCopyName(e.target.value)}/></label><button type="button" className="ws-button" onClick={saveCopy}>{tr('saveCopy')}</button></div>{copyShelf}</details>
  </>}
  {sourceDialog&&<WorksheetSourceDialog lists={lists} loading={loading} failed={sourceError} kind={requested&&['sentenceOrder','readMatch'].includes(requested)?'sentence':doc?'word':undefined} onReload={()=>void reloadSources()} onApply={applySource} onClose={()=>setSourceDialog(false)} canAppend={!!doc||!!source} onDirect={doc?()=>{setSourceDialog(false);const editor=inlineEditor.current;if(editor){editor.open=true;requestAnimationFrame(()=>editor.querySelector('summary')?.focus());}}:undefined}/>}
  {sampleId&&<WorksheetSampleDialog key={sampleId} activityId={sampleId} onClose={()=>setSampleId(null)} onUse={useSample}/>}
 </div>;
}
