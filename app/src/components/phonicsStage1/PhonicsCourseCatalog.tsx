import {useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {fetchPhonicsBank} from '../../lib/api';
import {curriculumEntries} from '../../data/phonicsCurriculum';
import {courseUnits,availableLessonSlides,pictureContext} from '../../data/phonicsLessons';
import {PHONICS_TEACHING_PREVIEW} from '../../data/phonicsTeachingCourse';
import {useWorkbookImageChecks} from '../../lib/useWorkbookImageChecks';
import PhonicsCourseSlide from './PhonicsCourseSlide';
import '../../phonicsStage1.css';
import '../../styles/phonics-teaching.css';

export default function PhonicsCourseCatalog(){
 const {t}=useTranslation();const [params,setParams]=useSearchParams();const parsed=Number(params.get('level'));const step=[1,2,3,4,5].includes(parsed)?parsed:1;
 const [bank,setBank]=useState(()=>curriculumEntries(false));useEffect(()=>{let active=true;void fetchPhonicsBank().then(rows=>{if(active)setBank(rows);}).catch(()=>{});return()=>{active=false;};},[]);
 const units=useMemo(()=>courseUnits(bank),[bank]);const u=units.find(x=>x.step===step&&x.id===params.get('unit'))??units.find(x=>x.step===step)!;const slides=useMemo(()=>availableLessonSlides(u),[u]);
 const paths=useMemo(()=>[...new Set([...u.entries,...u.reading.entries].flatMap(e=>e.image_url?[e.image_url]:[]))],[u]);const checked=useWorkbookImageChecks(paths);
 const missing=u.entries.filter(e=>!e.image_url||checked[e.image_url]===false);const ready=missing.length===0&&paths.every(p=>checked[p]===true);
 const choose=(level:number,id?:string)=>setParams({tab:'course',level:String(level),unit:id??units.find(x=>x.step===level)!.id});
 return <section className="pc-course-preview" data-phonics-teaching><p className="pc-private-note">{t(PHONICS_TEACHING_PREVIEW?'phonicsLesson.preview':'phonicsLesson.publishedHint')}</p><h1>{t('phonicsLesson.catalog')}</h1><p>{t('phonicsLesson.flow')}</p>
  <label>{t('phonicsLesson.level')}<select value={step} onChange={e=>choose(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option value={n} key={n}>{n} · {t('phonicsTeaching.stage'+n)}</option>)}</select></label>
  <label>{t('phonicsLesson.unit')}<select value={u.id} onChange={e=>choose(step,e.target.value)}>{units.filter(x=>x.step===step).map(x=><option key={x.id} value={x.id}>Unit {x.number} · {x.groups.map(g=>g.label).join(' · ')}</option>)}</select></label>
  <header className="pc-unit-summary"><p>{t('phonicsLesson.level')} {step} · {t('phonicsTeaching.stage'+step)}</p><h2>Unit {u.number} · {u.groups.map(g=>g.label).join(' · ')}</h2><p>{t('phonicsLesson.words',{count:u.entries.length})}</p><p data-teaching-words>{u.entries.map(e=>e.word).join(' · ')}</p><p className="pc-lesson-counts">{t('phonicsLesson.counts',{one:slides.filter(s=>s.lesson===1).length,two:slides.filter(s=>s.lesson===2).length,extra:slides.filter(s=>s.lesson==='extra').length})}</p><p>{t(u.reading.status==='approved'?'phonicsLesson.confirmedReader':'phonicsLesson.readDraft')}</p></header>
  <div className="pc-teaching-columns"><section className="pc-teaching-panel"><h2>{t('phonicsTeaching.slides')}</h2><div className="pc-slide-thumbnail" inert><PhonicsCourseSlide unit={u} slide={slides[0]} index={0} total={slides.length}/></div>{([1,2] as const).map(n=>ready?<Link key={n} className="pc-primary" to={`/phonics/lesson?unit=${u.id}&lesson=${n}`}>{t('phonicsLesson.lesson',{n})}</Link>:<button className="pc-primary" disabled key={n}>{t('phonicsLesson.lesson',{n})}</button>)}{!ready&&<p role="status">{missing.length?t('phonicsLesson.mediaPending',{words:missing.map(e=>e.word).join(', ')}):t('phonicsLesson.checking')}</p>}</section>
  <section className="pc-teaching-panel"><h2>{t('phonicsTeaching.extra')}</h2><p>{t('phonicsLesson.extraHint')}</p>{ready?<Link className="pc-button" to={`/phonics/lesson?unit=${u.id}&lesson=extra`}>{t('phonicsLesson.extra')}</Link>:<button className="pc-button" disabled>{t('phonicsLesson.extra')}</button>}<p>{t('phonicsLesson.audio')}</p>{u.entries.some(e=>pictureContext(e))&&<details><summary>{t('phonicsLesson.contextTitle')}</summary><p>{t('phonicsLesson.contextHint')}</p>{u.entries.filter(e=>pictureContext(e)).map(e=><p key={e.id}>{e.word}: {t('phonicsLesson.context.'+pictureContext(e))}</p>)}</details>}{u.reading.status==='draft'&&<p className="pc-status">{t('phonicsLesson.draftHint')}</p>}<p>{t('phonicsLesson.noNewBook')}</p>{PHONICS_TEACHING_PREVIEW&&u.reader==='abc'&&<Link className="pc-button" to="/phonics/stage-1?unit=stage1-abc&view=workbook">{t('phonicsLesson.oldBook')}</Link>}</section></div>
  <details className="pc-course-review"><summary>{t('phonicsLesson.list')}</summary>{units.map(unit=><div className="pc-unit-summary" key={unit.id}><strong>{t('phonicsLesson.level')} {unit.step} · Unit {unit.number} · {unit.groups.map(g=>g.label).join(' · ')}</strong><p>{t('phonicsLesson.words',{count:unit.entries.length})}</p>{unit.groups.map(g=><p key={g.id}>{g.label}: {g.entries.map(e=>e.word).join(' → ')}</p>)}</div>)}</details>
  <Link className="pc-old-workbook" to={step===1?'/materials/phonics-stage-1':step===2?'/materials/cvc-workbook':step===3?'/materials/long-vowel-workbook':`/materials/phonics-stage-${step}-workbook`}>{t('phonicsTeaching.yellowLink')}</Link>
 </section>;
}
