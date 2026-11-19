import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {fetchPhonicsBank} from '../lib/api';
import {curriculumEntries} from '../data/phonicsCurriculum';
import {courseUnits,availableLessonSlides,pictureContext} from '../data/phonicsLessons';
import {PHONICS_TEACHING_VISIBLE} from '../data/phonicsTeachingCourse';
import {useWorkbookImageChecks} from '../lib/useWorkbookImageChecks';
import {stopPhoneme} from '../lib/phonicsPhonemes';
import LessonAnnotationLayer from '../components/LessonAnnotationLayer';
import {useAuth} from '../context/AuthContext';
import PhonicsCourseSlide from '../components/phonicsStage1/PhonicsCourseSlide';
import PhonicsSlideStage from '../components/phonicsStage1/PhonicsSlideStage';
import '../phonicsStage1.css';
import '../styles/phonics-teaching.css';

export default function PhonicsLessonPage(){const {t}=useTranslation();return PHONICS_TEACHING_VISIBLE?<LessonPlayer/>:<p role="status">{t('phonicsLesson.unavailable')} <Link to="/phonics">{t('phonicsTeaching.words')}</Link></p>;}
function LessonPlayer(){
 const {t,i18n}=useTranslation();const en=i18n.language.startsWith('en');const {profile,academy}=useAuth();const [params,setParams]=useSearchParams();const [bank,setBank]=useState(()=>curriculumEntries(false));
 useEffect(()=>{let active=true;void fetchPhonicsBank().then(rows=>{if(active)setBank(rows);}).catch(()=>{});return()=>{active=false;};},[]);
 const units=useMemo(()=>courseUnits(bank),[bank]);const u=units.find(unit=>unit.id===params.get('unit'));const section=params.get('lesson')==='extra'?'extra':params.get('lesson')==='2'?2:1;
 const slides=useMemo(()=>u?availableLessonSlides(u).filter(s=>s.lesson===section):[],[u,section]);const id=params.get('slide');const index=id?slides.findIndex(s=>s.id===id):0;const slide=slides[index];
 const root=useRef<HTMLDivElement>(null);const [large,setLarge]=useState(false),[guide,setGuide]=useState(false),[fullscreenError,setFullscreenError]=useState(false);
 const [drawing,setDrawing]=useState(false),[drawingTools,setDrawingTools]=useState<HTMLDivElement|null>(null);
 const paths=useMemo(()=>u?[...new Set([...u.entries,...u.reading.entries].flatMap(e=>e.image_url?[e.image_url]:[]))]:[],[u]);const checked=useWorkbookImageChecks(paths);
 const missing=u?.entries.filter(e=>!e.image_url||checked[e.image_url]===false)??[];
 const move=useCallback((n:number)=>{if(!slides[n])return;setParams(old=>{const p=new URLSearchParams(old);p.set('slide',slides[n].id);return p;},{replace:true});},[slides,setParams]);
 useEffect(()=>{const changed=()=>setLarge(document.fullscreenElement===root.current);document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
 async function fullscreen(){setFullscreenError(false);try{if(document.fullscreenElement===root.current)await document.exitFullscreen();else await root.current?.requestFullscreen();}catch{setFullscreenError(true);}}
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(drawing)setDrawing(false);return;}if((e.target as HTMLElement).closest('input,select,textarea,[contenteditable=true]'))return;if(['ArrowRight','ArrowLeft','PageDown','PageUp'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();move(index+(['ArrowRight','PageDown'].includes(e.key)?1:-1));}else if(e.key===' '&&!(e.target as HTMLElement).closest('button,a')){e.preventDefault();move(index+1);}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[index,move,drawing]);
 useEffect(()=>()=>{window.speechSynthesis?.cancel();stopPhoneme();},[slide?.id]);
 if(!u||!slide)return <p role="alert">{t('phonicsLesson.invalid')} <Link to="/phonics?tab=course">{t('phonicsLesson.back')}</Link></p>;
 const replay=()=>{let first=index;while(first>0&&slides[first].phase>0)first--;move(first);};
 return <div ref={root} className={'s1-course pc-player '+(large?'pc-player-full':'')} data-course-player={u.id}>
  <nav className="pc-player-controls"><Link className="pc-button" to={'/phonics?tab=course&level='+u.step+'&unit='+u.id+'&lesson='+(section===2?2:1)}>{en?'Prepare lesson':'수업 준비'}</Link><button className="pc-button" aria-pressed={drawing} onClick={()=>setDrawing(v=>!v)}>{t('curriculum.play.annotation')}</button><label className="pc-slide-select"><span>{en?'Contents':'목차'}</span><select aria-label={t('phonicsLesson.list')} value={slide.id} onChange={e=>move(slides.findIndex(s=>s.id===e.target.value))}>{slides.map((s,i)=><option key={s.id} value={s.id}>{i+1}. {s.title}{s.phase>0?' · '+t('phonicsLesson.reveal'):''}</option>)}</select></label><button className="pc-button" onClick={()=>root.current?.querySelector<HTMLButtonElement>('.pc-stage-canvas .s1-speaker:not(:disabled)')?.click()} disabled={!slide.entryIds.length&&!slide.groupIds.length&&!slide.text}>{en?'Audio':'음성'}</button><button className="pc-button" onClick={()=>void fullscreen()}>{t('phonicsLesson.'+(large?'exitFullscreen':'fullscreen'))}</button><span className="pc-current-page" aria-live="polite">{index+1} / {slides.length}</span></nav>
  {fullscreenError&&<p role="alert">{en?'The browser could not open full screen. Try again.':'브라우저에서 전체화면을 열지 못했어요. 전체화면 버튼을 다시 눌러 주세요.'}</p>}
  <PhonicsSlideStage index={index} total={slides.length} onMove={move}><div className="pc-annotated-slide"><PhonicsCourseSlide key={slide.id} unit={u} slide={slide} index={index} total={slides.length}/>{drawing&&<LessonAnnotationLayer key={slide.id} contained toolbarTarget={drawingTools} persistKey={'classbank:phonics-drawing:'+academy?.id+':'+profile?.id+':'+slide.id} onClose={()=>setDrawing(false)}/>}</div></PhonicsSlideStage>
  {missing.length>0&&<p className="pc-status" role="alert">{t('phonicsLesson.mediaPending',{words:missing.map(e=>e.word).join(', ')})}</p>}
  <div ref={setDrawingTools} className="pc-drawing-tools no-print" hidden={!drawing}/>
  <nav className="pc-player-bottom"><button className="pc-button" onClick={replay}>{t('phonicsLesson.restart')}</button><button className="pc-button" onClick={()=>setGuide(v=>!v)} aria-expanded={guide}>{t('phonicsLesson.'+(guide?'closeTeacher':'teacher'))}</button>{([1,2,'extra'] as const).map(n=><Link key={n} className="pc-button" aria-current={section===n?'page':undefined} to={'/phonics/lesson?unit='+u.id+'&lesson='+n}>{n==='extra'?(en?'Extra':'추가 활동'):(en?'Lesson '+n:n+'차시')}</Link>)}</nav>
  {guide&&<aside className="pc-teacher-note"><p>{t('phonicsLesson.turn')}</p><p>{u.groups.map(g=>g.label+': '+g.entries.map(e=>e.word).join(', ')).join(' / ')}</p>{u.reading.status==='draft'&&<p>{t('phonicsLesson.draftHint')}</p>}{u.entries.filter(e=>pictureContext(e)).map(e=><p key={e.id}>{e.word}: {t('phonicsLesson.context.'+pictureContext(e))}</p>)}</aside>}
 </div>;
}
