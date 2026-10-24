import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { usePresenting } from '../context/LessonRunnerContext';
import { createCurriculumLesson, fetchPhonicsBank } from '../lib/api';
import { curriculumEntries } from '../data/phonicsCurriculum';
import { buildStage1Course, stage1Entry, stage1LessonBlocks } from '../data/phonicsStage1';
import { useWorkbookImageChecks } from '../lib/useWorkbookImageChecks';
import type { MaterialSlide } from '../lib/types';
import Stage1SlideView from '../components/phonicsStage1/Stage1SlideView';
import { Stage1TeacherGuide, Stage1WorkbookPage } from '../components/phonicsStage1/Stage1Workbook';
import '../phonicsStage1.css';

export default function PhonicsStage1Page(){
  const {t}=useTranslation();const [params,setParams]=useSearchParams();const location=useLocation();const presenting=usePresenting();
  const {academy,profile,isStaff}=useAuth();
  const nav=(location.state as {phonicsStage1?:MaterialSlide['phonicsStage1']}|null)?.phonicsStage1;
  const [bank,setBank]=useState(()=>curriculumEntries(false));const [loaded,setLoaded]=useState(false);
  useEffect(()=>{let active=true;void fetchPhonicsBank().then(rows=>{if(active)setBank(rows);}).catch(()=>{/* Keep canonical static assets. */}).finally(()=>{if(active)setLoaded(true);});return()=>{active=false;};},[]);
  const course=useMemo(()=>buildStage1Course(bank),[bank]);
  const requestedUnit=params.get('unit')??nav?.unitId??'stage1-abc';
  const unit=course.find(u=>u.id===requestedUnit);
  const view=params.get('view')??nav?.view??'units';
  const lesson=Number(params.get('lesson')??nav?.lesson??1)===2?2:1;
  const optional=params.get('optional')==='1'||(!params.has('optional')&&nav?.optional===true);
  const slides=useMemo(()=>unit?.slides.filter(s=>optional?s.optional:!s.optional&&s.lesson===lesson)??[],[unit,optional,lesson]);
  const requestedSlide=params.get('slide');const slide=requestedSlide?slides.find(s=>s.id===requestedSlide):slides[0];
  const index=slide?slides.indexOf(slide):-1;
  const paths=useMemo(()=>[...new Set(course.flatMap(u=>u.groups.flatMap(g=>g.entries.map(e=>e.image_url).filter((p):p is string=>!!p))))],[course]);
  const checked=useWorkbookImageChecks(paths);
  const missing=(u:typeof course[number])=>u.groups.flatMap(g=>g.entries).filter(e=>!e.image_url||checked[e.image_url]===false);
  const ready=(u:typeof course[number])=>loaded&&u.groups.every(g=>g.entries.every(e=>!!e.image_url&&checked[e.image_url]===true));
  const [selectedPages,setSelectedPages]=useState<string[]>([]);
  const pageIds=unit?.pages.map(p=>p.id).join('\n')??'';
  useEffect(()=>setSelectedPages(pageIds?pageIds.split('\n'):[]),[pageIds]); // Preserve selection when only media changes.
  const [large,setLarge]=useState(false),[guide,setGuide]=useState(false),[saving,setSaving]=useState(false),[savedId,setSavedId]=useState(''),[saveError,setSaveError]=useState(false);
  const go=useCallback((changes:Record<string,string|undefined>)=>setParams(old=>{
    const next=new URLSearchParams(old);
    // Runner references arrive in router state. Retain them when a query navigation clears that state.
    if(!next.has('unit'))next.set('unit',requestedUnit);
    if(!next.has('view'))next.set('view',view);
    if(!next.has('lesson'))next.set('lesson',String(lesson));
    if(!next.has('optional')&&optional)next.set('optional','1');
    for(const [k,v] of Object.entries(changes)){if(v===undefined)next.delete(k);else next.set(k,v);}return next;
  }),[requestedUnit,view,lesson,optional,setParams]);
  const start=(n:1|2,extra=false)=>go({unit:requestedUnit,view:'slides',lesson:String(n),optional:extra?'1':undefined,slide:undefined});
  const move=useCallback((n:number)=>{if(slides[n])go({slide:slides[n].id});},[slides,go]);
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){setLarge(false);return;}
      if(view!=='slides'||(e.target as HTMLElement).closest('input,select,textarea,summary,dialog'))return;
      // A presentation clicker must move this lesson's slide, not skip to the next material block.
      if(e.key==='PageDown'||e.key==='PageUp'){
        e.preventDefault();e.stopImmediatePropagation();const target=index+(e.key==='PageDown'?1:-1);
        move(target);
        return;
      }
      if((e.target as HTMLElement).closest('button,a'))return;
      if(e.key==='ArrowRight'){e.preventDefault();move(index+1);}
      if(e.key==='ArrowLeft'){e.preventDefault();move(index-1);}
    };window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true);
  },[view,index,move]);
  useEffect(()=>{if(!large)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[large]);
  async function save(){if(!unit||!academy||!profile||saving)return;setSaving(true);setSaveError(false);try{
    const name=unit.number?'Unit '+unit.number+' · Aa Bb Cc':unit.groups[0].letter+unit.groups[0].letter.toLowerCase();
    const row=await createCurriculumLesson({academyId:academy.id,teacherId:profile.id,classId:null,name:t('phonicsStage1.lessonName',{name}),wordListId:null,videoUrl:null,level:null,playlist:stage1LessonBlocks(unit.id)});setSavedId(row.id);
  }catch{setSaveError(true);}finally{setSaving(false);}}
  if(!unit)return <p role="alert">{t('phonicsStage1.invalidReference')} <Link to="/materials/phonics-stage-1">{t('phonicsStage1.back')}</Link></p>;
  const canPrint=ready(unit)&&selectedPages.length>0;
  return <div className={'s1-course '+(view==='teacher'?'s1-print-teacher':'s1-print-student')}>
    {!large&&!presenting&&<header className="s1-course-header no-print"><Link to="/phonics">← {t('phonics.title')}</Link><h1>{t('phonicsStage1.title')}</h1><p>{t('phonicsStage1.description')}</p></header>}
    {view==='units'?<div className="no-print s1-unit-selection"><p className="s1-course-intro">{t('phonicsStage1.unit1Ready')}</p><div className="s1-unit-cards">{course.map(u=><section key={u.id}><h2>{u.number?'Unit '+u.number+' · ':''}{u.groups.map(g=>g.letter+g.letter.toLowerCase()).join(' ')}</h2><p>{u.groups.flatMap(g=>g.entries.map(e=>e.word)).join(' · ')}</p><p>{u.reader?t('phonicsStage1.unit1Ready'):t('phonicsStage1.pendingReader')}</p><p>{t('phonicsStage1.slides',{count:u.slides.filter(s=>!s.optional).length})} · {t('phonicsStage1.pages',{count:u.pages.length})}</p>{missing(u).length>0&&<p role="status">{t('phonicsStage1.mediaPending',{words:missing(u).map(e=>e.word).join(', ')})}</p>}<div className="s1-actions">{([1,2] as const).map(n=><button key={n} disabled={!ready(u)} onClick={()=>go({unit:u.id,view:'slides',lesson:String(n),optional:undefined,slide:undefined})}>{t('phonicsStage1.start',{n})}</button>)}<button onClick={()=>go({unit:u.id,view:'workbook',slide:undefined})}>{t('phonicsStage1.workbook')}</button></div></section>)}</div><p>{t('phonicsStage1.letterOnly')}</p></div>:<>
      {view!=='slides'&&<nav className="s1-actions no-print"><button onClick={()=>go({view:'units',slide:undefined})}>{t('phonicsStage1.back')}</button><button onClick={()=>start(1)}>{t('phonicsStage1.start',{n:1})}</button><button onClick={()=>go({view:'workbook'})}>{t('phonicsStage1.workbook')}</button><button onClick={()=>go({view:'teacher'})}>{t('phonicsStage1.teacher')}</button></nav>}
      {!ready(unit)&&<p role="status" className="no-print">{missing(unit).length?t('phonicsStage1.mediaPending',{words:missing(unit).map(e=>e.word).join(', ')}):t('phonicsStage1.mediaChecking')}</p>}
      {view==='slides'&&slide&&<div className={'s1-player no-print '+(large?'s1-player-large':'')+(presenting?' s1-presenting':'')}>
        <nav className="s1-actions s1-player-controls"><button onClick={()=>{setLarge(false);go({view:'units',slide:undefined});}}>{t('phonicsStage1.back')}</button><button onClick={()=>setLarge(v=>!v)}>{t(large?'phonicsStage1.exitFullscreen':'phonicsStage1.fullscreen')}</button><button onClick={()=>setGuide(v=>!v)}>{t(guide?'phonicsStage1.hideGuide':'phonicsStage1.showGuide')}</button><button onClick={()=>{setLarge(false);go({view:'workbook'});}}>{t('phonicsStage1.workbook')}</button></nav>
        <Stage1SlideView key={slide.id} unit={unit} slide={slide} position={unit.slides.indexOf(slide)+1} total={unit.slides.length}/>
        <nav className="s1-actions s1-slide-navigation"><button onClick={()=>move(index-1)} disabled={index<=0}>{t('phonicsStage1.previous')}</button><label><span>{t(slide.optional?'phonicsStage1.extra':'phonicsStage1.core')}</span><select aria-label={t('phonicsStage1.lessons')} value={slide.id} onChange={e=>go({slide:e.target.value})}>{slides.map(s=><option value={s.id} key={s.id}>{unit.slides.indexOf(s)+1}. {s.title}</option>)}</select></label><button data-s1-next onClick={()=>index===slides.length-1&&!optional&&lesson===1?start(2):move(index+1)} disabled={index>=slides.length-1&&(optional||lesson===2)}>{t(index===slides.length-1&&!optional&&lesson===1?'phonicsStage1.start':slide.phase==='question'?'phonicsStage1.reveal':'phonicsStage1.next',{n:2})}</button></nav>
        {guide&&<aside className="s1-slide-guide"><p>{t('phonicsStage1.notes.'+slide.kind)}</p><p>{t('phonicsStage1.audioInfo')}</p>{!!slide.answerIds?.length&&<p>{slide.answerIds.map(id=>stage1Entry(unit,id).word).join(' · ')}</p>}<p>{t('phonicsStage1.mapping')}: {slide.workbookPageIds.map(id=>unit.pages.findIndex(p=>p.id===id)+1).join(', ')||'—'}</p></aside>}
      </div>}
      {view==='slides'&&!slide&&<p role="alert">{t('phonicsStage1.invalidReference')}</p>}
      {view==='workbook'&&<><div className="s1-page-picker no-print"><h2>{t('phonicsStage1.selectPages')}</h2><div className="s1-actions"><button onClick={()=>setSelectedPages(unit.pages.map(p=>p.id))}>{t('phonicsStage1.all')}</button><button onClick={()=>setSelectedPages([])}>{t('phonicsStage1.clear')}</button><button disabled={!canPrint} onClick={async()=>{await document.fonts.ready;window.print();}}>{t('phonicsStage1.print')}</button></div>{unit.pages.map((p,i)=><label key={p.id}><input type="checkbox" checked={selectedPages.includes(p.id)} onChange={e=>setSelectedPages(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/>p.{i+1} {p.title}</label>)}</div>{ready(unit)&&<div className="print-sheet s1-book-preview">{unit.pages.filter(p=>selectedPages.includes(p.id)).map(p=><Stage1WorkbookPage key={p.id} unit={unit} page={p}/>)}</div>}</>}
      {view==='teacher'&&<><button className="s1-button no-print" onClick={()=>window.print()}>{t('phonicsStage1.teacherPrint')}</button><Stage1TeacherGuide unit={unit}/></>}
      {!large&&<aside className="no-print s1-course-footer"><div className="s1-actions"><button onClick={()=>start(1)} disabled={!ready(unit)}>{t('phonicsStage1.start',{n:1})}</button><button onClick={()=>start(2)} disabled={!ready(unit)}>{t('phonicsStage1.start',{n:2})}</button><button onClick={()=>start(2,true)} disabled={!ready(unit)}>{t('phonicsStage1.extra')}</button><button onClick={()=>go({view:'teacher'})}>{t('phonicsStage1.teacher')}</button></div><p>{t('phonicsStage1.optionalHint')}</p>{!unit.reader&&<p>{t('phonicsStage1.pendingReader')}</p>}{isStaff&&<button className="s1-button" disabled={saving} onClick={()=>void save()}>{t('phonicsStage1.lessonLibrary')}</button>}{savedId&&<p role="status">{t('phonicsStage1.saved')} <Link to="/curriculum" state={{reopenLessonId:savedId}}>{t('nav.curriculum')}</Link></p>}{saveError&&<p role="alert">{t('phonicsStage1.saveError')}</p>}</aside>}
    </>}
  </div>;
}
