import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchPhonicsBank } from '../../lib/api';
import { curriculumEntries, PHONICS_STAGES } from '../../data/phonicsCurriculum';
import { teachingUnits } from '../../data/phonicsTeachingCourse';
import { buildStage1Course } from '../../data/phonicsStage1';
import { useWorkbookImageChecks } from '../../lib/useWorkbookImageChecks';
import Stage1SlideView from './Stage1SlideView';
import { Stage1WorkbookPage } from './Stage1Workbook';
import '../../phonicsStage1.css';
import '../../styles/phonics-teaching.css';

export default function PhonicsTeachingPreview(){
 const {t}=useTranslation();
 const [bank,setBank]=useState(()=>curriculumEntries(false)),[step,setStep]=useState(1),[selected,setSelected]=useState('stage1-abc');
 useEffect(()=>{let active=true;void fetchPhonicsBank().then(rows=>{if(active)setBank(rows);}).catch(()=>{});return()=>{active=false;};},[]);
 const units=useMemo(()=>teachingUnits(bank),[bank]),unit=units.find(u=>u.id===selected&&u.step===step);
 const course=useMemo(()=>buildStage1Course(bank),[bank]),content=course.find(u=>u.id===unit?.stage1Id);
 const [pages,setPages]=useState<string[]>([]),[showBook,setShowBook]=useState(false),[scale,setScale]=useState(1);
 const viewport=useRef<HTMLDivElement>(null),pageIds=content?.pages.map(p=>p.id).join('\n')||'';
 useEffect(()=>{setPages(pageIds?pageIds.split('\n'):[]);setShowBook(false);},[pageIds]);
 useLayoutEffect(()=>{const el=viewport.current;if(!el)return;const update=()=>setScale(Math.min(1,el.clientWidth/704));update();const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();},[showBook]);
 const paths=useMemo(()=>unit?.entries.flatMap(e=>e.image_url?[e.image_url]:[])||[],[unit]);
 const checked=useWorkbookImageChecks(paths);
 const ready=!!content&&unit!.entries.every(e=>!!e.image_url&&checked[e.image_url]===true);
 const href=(lesson:1|2,optional=false)=>`/phonics/stage-1?unit=${encodeURIComponent(content!.id)}&view=slides&lesson=${lesson}${optional?'&optional=1':''}`;
 const bookHref=content?`/phonics/stage-1?unit=${encodeURIComponent(content.id)}&view=workbook&pages=${encodeURIComponent(pages.join(','))}`:'#';
 return <section className="pc-course-preview" data-phonics-teaching>
  <p className="pc-private-note">{t('phonicsTeaching.private')}</p>
  <h1>{t('phonicsTeaching.course')}</h1><p>{t('phonicsTeaching.flow')}</p>
  <label>{t('phonics.stepLabel')}<select value={step} onChange={e=>{const next=Number(e.target.value);setStep(next);setSelected(units.find(u=>u.step===next)?.id||'');}}>{PHONICS_STAGES.map(s=><option value={s.number} key={s.id}>{t('phonics.stepName',{step:s.number})}</option>)}</select></label>
  <label>{t('phonicsTeaching.unit')}<select value={selected} onChange={e=>setSelected(e.target.value)} disabled={!units.some(u=>u.step===step)}>{units.filter(u=>u.step===step).map(u=><option value={u.id} key={u.id}>{u.title}</option>)}{!units.some(u=>u.step===step)&&<option value="">{t('phonicsTeaching.pending')}</option>}</select></label>
  {unit?<><header className="pc-unit-summary"><p>{t('phonics.stepName',{step})} · {t(`phonicsTeaching.stage${step}`)}</p><h2>{unit.title}</h2><p>{t('phonicsTeaching.sounds')}: {unit.sounds}</p><p data-teaching-words>{unit.entries.map(e=>e.word).join(' · ')}</p></header>
   <div className="pc-teaching-columns">
    <section className="pc-teaching-panel"><h2>{t('phonicsTeaching.slides')}</h2>
     {content?<div className="pc-slide-thumbnail" inert><Stage1SlideView unit={content} slide={content.slides[0]} position={1} total={content.slides.length}/></div>:<p>{t('phonicsTeaching.pending')}</p>}
     {([1,2] as const).map(n=>ready?<Link className="pc-primary" key={n} to={href(n)}>{t('phonicsStage1.start',{n})}</Link>:<button className="pc-primary" key={n} disabled>{t('phonicsStage1.start',{n})}</button>)}
     <aside className="pc-extra"><h3>{t('phonicsTeaching.extra')}</h3><p>{t('phonicsTeaching.extraHint')}</p>{ready?<Link className="pc-button" to={href(2,true)}>{t('phonicsTeaching.openExtra')}</Link>:<button className="pc-button" disabled>{t('phonicsTeaching.openExtra')}</button>}</aside>
    </section>
    <section className="pc-teaching-panel"><h2>{t('phonicsTeaching.workbook')}</h2><p>{t('phonicsTeaching.linkedHint')}</p>
     {content?<>
      <div className="pc-page-actions"><button className="pc-button" onClick={()=>setPages(content.pages.map(p=>p.id))}>{t('phonicsTeaching.allPages')}</button><button className="pc-button" onClick={()=>setPages([])}>{t('phonicsStage1.clear')}</button></div>
      <fieldset className="pc-page-options"><legend>{t('phonicsTeaching.pickPages')}</legend>{content.pages.map((p,i)=><label key={p.id}><input type="checkbox" checked={pages.includes(p.id)} onChange={e=>setPages(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/>p.{i+1} {p.title}</label>)}</fieldset>
      <button className="pc-button" onClick={()=>setShowBook(v=>!v)} aria-expanded={showBook}>{t('phonicsTeaching.previewBook')}</button>
      {ready&&pages.length?<Link className="pc-primary" to={bookHref}>{t('phonicsTeaching.printBook',{count:pages.length})}</Link>:<button className="pc-primary" disabled>{t('phonicsTeaching.printBook',{count:pages.length})}</button>}
      {showBook&&<div ref={viewport} className="pc-book-viewport"><div style={{width:'186mm',zoom:scale}}>{content.pages.filter(p=>pages.includes(p.id)).map(p=><Stage1WorkbookPage key={p.id} unit={content} page={p}/>)}</div></div>}
     </>:<p>{t('phonicsTeaching.pending')}</p>}
     {content&&!ready&&<p role="status">{t('phonicsStage1.mediaChecking')}</p>}
    </section>
   </div>
  </>:<p>{t('phonicsTeaching.pending')}</p>}
  <Link className="pc-old-workbook" to={step===1?'/materials/phonics-stage-1':step===2?'/materials/cvc-workbook':step===3?'/materials/long-vowel-workbook':`/materials/phonics-stage-${step}-workbook`}>{t('phonicsTeaching.yellowLink')}</Link>
 </section>;
}
