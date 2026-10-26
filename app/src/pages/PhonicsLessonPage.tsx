import {useCallback,useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {fetchPhonicsBank} from '../lib/api';
import {curriculumEntries} from '../data/phonicsCurriculum';
import {courseUnits,availableLessonSlides,pictureContext} from '../data/phonicsLessons';
import {PHONICS_TEACHING_VISIBLE} from '../data/phonicsTeachingCourse';
import {useWorkbookImageChecks} from '../lib/useWorkbookImageChecks';
import PhonicsCourseSlide from '../components/phonicsStage1/PhonicsCourseSlide';
import '../phonicsStage1.css';
import '../styles/phonics-teaching.css';

export default function PhonicsLessonPage(){const {t}=useTranslation();return PHONICS_TEACHING_VISIBLE?<LessonPlayer/>:<p role="status">{t('phonicsLesson.unavailable')} <Link to="/phonics">{t('phonicsTeaching.words')}</Link></p>;}
function LessonPlayer(){
 const {t}=useTranslation();const [params,setParams]=useSearchParams();const [bank,setBank]=useState(()=>curriculumEntries(false));
 useEffect(()=>{let active=true;void fetchPhonicsBank().then(rows=>{if(active)setBank(rows);}).catch(()=>{});return()=>{active=false;};},[]);
 const units=useMemo(()=>courseUnits(bank),[bank]);const u=units.find(unit=>unit.id===params.get('unit'));const section=params.get('lesson')==='extra'?'extra':params.get('lesson')==='2'?2:1;
 const all=useMemo(()=>u?availableLessonSlides(u):[],[u]);const slides=useMemo(()=>all.filter(s=>s.lesson===section),[all,section]);const id=params.get('slide');const index=id?slides.findIndex(s=>s.id===id):0;const slide=slides[index];
 const [large,setLarge]=useState(false),[guide,setGuide]=useState(false);
 const paths=useMemo(()=>u?[...new Set([...u.entries,...u.reading.entries].flatMap(e=>e.image_url?[e.image_url]:[]))]:[],[u]);const checked=useWorkbookImageChecks(paths);
 const missing=u?.entries.filter(e=>!e.image_url||checked[e.image_url]===false)??[];
 const checking=u?.entries.some(e=>e.image_url&&checked[e.image_url]===undefined);
 const move=useCallback((n:number)=>{if(!slides[n])return;setParams(old=>{const p=new URLSearchParams(old);p.set('slide',slides[n].id);return p;},{replace:true});},[slides,setParams]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setLarge(false);return;}if((e.target as HTMLElement).closest('input,select,textarea,[contenteditable=true]'))return;if(['PageDown','PageUp'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();move(index+(e.key==='PageDown'?1:-1));return;}if((e.target as HTMLElement).closest('button,a'))return;if(['ArrowRight',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();move(index+1);}if(e.key==='ArrowLeft'){e.preventDefault();e.stopImmediatePropagation();move(index-1);}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[index,move]);
 useEffect(()=>()=>{window.speechSynthesis?.cancel();},[slide?.id]);
 useEffect(()=>{if(!large)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[large]);
 if(!u||!slide)return <p role="alert">{t('phonicsLesson.invalid')} <Link to="/phonics?tab=course">{t('phonicsLesson.back')}</Link></p>;
 const replay=()=>{let first=index;while(first>0&&slides[first].phase>0)first--;move(first);};
 const label=slide.kind==='puzzle'&&slide.phase===0?'gather':slide.kind==='memory'&&slide.phase===0?'hide':['puzzle','memory'].includes(slide.kind)&&slide.phase===1?'reveal':slide.phase===0&&['match','choose','odd','complete','sort','readChoose','sentenceBuild'].includes(slide.kind)?'reveal':'next';
 return <div className={'s1-course pc-player '+(large?'pc-player-full':'')} data-course-player={u.id}>
  <nav className="pc-player-controls"><Link className="pc-button" to={`/phonics?tab=course&level=${u.step}&unit=${u.id}`}>{t('phonicsLesson.back')}</Link><button className="pc-button" onClick={()=>setLarge(v=>!v)}>{t('phonicsLesson.'+(large?'exitFullscreen':'fullscreen'))}</button><button className="pc-button" onClick={()=>setGuide(v=>!v)} aria-expanded={guide}>{t('phonicsLesson.'+(guide?'closeTeacher':'teacher'))}</button></nav>
  {missing.length>0?<p className="pc-status" role="alert">{t('phonicsLesson.mediaPending',{words:missing.map(e=>e.word).join(', ')})}</p>:checking?<p role="status">{t('phonicsLesson.checking')}</p>:<PhonicsCourseSlide unit={u} slide={slide} index={all.indexOf(slide)} total={all.length}/>}
  <nav className="pc-player-controls"><button className="pc-button" disabled={index<=0} onClick={()=>move(index-1)}>{t('phonicsLesson.previous')}</button><select aria-label={t('phonicsLesson.list')} value={slide.id} onChange={e=>move(slides.findIndex(s=>s.id===e.target.value))}>{slides.map((s,i)=><option key={s.id} value={s.id}>{i+1}. {s.title}{s.phase>0?' · '+t('phonicsLesson.reveal'):''}</option>)}</select><button className="pc-primary" disabled={index>=slides.length-1} data-course-next onClick={()=>move(index+1)}>{t('phonicsLesson.'+label)}</button><button className="pc-button" onClick={replay}>{t('phonicsLesson.restart')}</button></nav>
  <nav className="pc-player-controls">{([1,2,'extra'] as const).map(n=><Link key={n} className="pc-button" aria-current={section===n?'page':undefined} to={`/phonics/lesson?unit=${u.id}&lesson=${n}`}>{t(n==='extra'?'phonicsLesson.extra':'phonicsLesson.lesson',{n})}</Link>)}</nav>
  {guide&&<aside className="pc-teacher-note"><p>{t('phonicsLesson.turn')}</p><p>{t('phonicsLesson.audio')}</p>{u.reading.status==='draft'&&<p>{t('phonicsLesson.draftHint')}</p>}<p>{u.groups.map(g=>`${g.label}: ${g.entries.map(e=>e.word).join(', ')}`).join(' / ')}</p>{(u.reading.status==='approved'||import.meta.env.DEV)&&<p>{u.reading.sentences.join(' / ')}</p>}{u.entries.some(e=>pictureContext(e))&&<><p>{t('phonicsLesson.contextHint')}</p>{u.entries.filter(e=>pictureContext(e)).map(e=><p key={e.id}>{e.word}: {t('phonicsLesson.context.'+pictureContext(e))}</p>)}</>}</aside>}
 </div>;
}
