import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {availableLessonSlides,type CourseUnit,type CourseSlide} from '../../data/phonicsLessons';
import {readyClassPages} from '../../data/readyClassWorkbook';
import PhonicsCourseSlide from './PhonicsCourseSlide';
import PhonicsSlideStage from './PhonicsSlideStage';
import PhonicsSongs from './PhonicsSongs';

export default function PhonicsLessonPreview({unit,ready,section:chosenSection,printLinks}:{unit:CourseUnit;ready:boolean;section?:1|2;printLinks?:ReactNode}){
 const {i18n}=useTranslation();const en=i18n.language.startsWith('en');const [section,setSection]=useState<CourseSlide['lesson']>(1);
 return <>{!chosenSection&&<nav className="pc-section-tabs" aria-label={en?'Lesson':'차시 선택'}>{([1,2,'extra'] as const).map(n=><button type="button" key={n} aria-pressed={section===n} onClick={()=>setSection(n)}>{n==='extra'?(en?'Extra practice':'추가 활동'):(en?`Lesson ${n}`:`${n}차시`)}</button>)}</nav>}<LessonPreview key={unit.id+':'+(chosenSection??section)} unit={unit} section={chosenSection??section} ready={ready} printLinks={printLinks}/></>;
}
function LessonPreview({unit:u,section,ready,printLinks}:{unit:CourseUnit;section:CourseSlide['lesson'];ready:boolean;printLinks?:ReactNode}){
 const {t,i18n}=useTranslation();const en=i18n.language.startsWith('en');const [index,setIndex]=useState(0);const rail=useRef<HTMLElement>(null);
 const slides=useMemo(()=>availableLessonSlides(u).filter(s=>s.lesson===section),[u,section]);const slide=slides[index];
 const pages=useMemo(()=>readyClassPages(u).filter(p=>p.slides.some(id=>slides.some(s=>s.id===id))),[u,slides]);
 const sequence=slides.filter((s,i)=>s.phase===0&&!['cover','lesson','finish','end','transition'].includes(s.kind)&&(!i||slides[i-1].title!==s.title));
 const lastWords=slides.filter(s=>s.kind==='readAlone').flatMap(s=>s.entryIds);const checks=(lastWords.length?u.entries.filter(e=>lastWords.includes(e.id)):u.groups.map(g=>g.entries[0])).slice(0,3);
 useEffect(()=>{rail.current?.querySelector('[aria-current="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});},[index]);
 if(!slide)return null;
 return <div className="pc-preparation" data-lesson-preview={section}>
  <nav ref={rail} className="pc-preview-rail" aria-label={en?'All slides':'전체 슬라이드'}>{slides.map((s,i)=><div role="button" tabIndex={0} key={s.id} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setIndex(i);}}} aria-current={index===i?'true':undefined} aria-label={`${i+1}. ${s.title}`} onClick={()=>setIndex(i)}><div inert aria-hidden="true"><PhonicsCourseSlide unit={u} slide={s} index={i} total={slides.length}/></div><span>{i+1}. {s.title}</span></div>)}</nav>
  <section className="pc-preview-center"><div className="pc-preview-heading"><h2>{section==='extra'?(en?'Extra practice':'추가 활동'):(en?`Lesson ${section}`:`${section}차시`)}</h2><span aria-live="polite">{index+1} / {slides.length}</span></div>
   <PhonicsSlideStage index={index} total={slides.length} onMove={setIndex}><PhonicsCourseSlide key={slide.id} unit={u} slide={slide} index={index} total={slides.length}/></PhonicsSlideStage>
   {ready?<Link className="pc-primary" to={`/phonics/lesson?unit=${u.id}&lesson=${section}`}>{en?'Start lesson':'수업 시작'}</Link>:<button className="pc-primary" disabled>{t('phonicsLesson.checking')}</button>}
  </section>
  <aside className="pc-preparation-notes"><section><h3>{en?'Today’s goal':'오늘의 목표'}</h3><p>{u.groups.map(g=>g.label).join(' · ')}{en?' — connect letters and sounds, then read words.':' 글자와 소리를 연결하고 단어를 읽어요.'}</p><p>{u.entries.map(e=>e.word).join(', ')}</p></section>
   <section><h3>{en?'Lesson order':'수업 순서'}</h3><ol>{sequence.map(s=><li key={s.id}><button type="button" onClick={()=>setIndex(slides.indexOf(s))}>{s.title}</button></li>)}</ol></section>
   <section><h3>{en?'Print materials':'인쇄 자료'}</h3><p>{en?'Optional paper practice. Complete the lesson on screen.':'종이 연습이 필요할 때 선택해요. 인쇄 없이도 수업을 마칠 수 있어요.'}</p><Link className="pc-button" to={`/phonics/workbook?unit=${u.id}&lesson=${section}`}>{en?'Lesson worksheets':'이 차시 활동지'} · {pages.length}{en?' pages':'쪽'}</Link><Link className="pc-button" to={`/phonics/workbook?unit=${u.id}`}>{t('readyMedia.workbook')}</Link>{printLinks}</section>
   <section><h3>{en?'Final check':'수업 끝 확인'}</h3><p>{checks.map(e=>e.word).join(', ')}{en?' — read without picture or audio help.':'을 그림·소리 도움 없이 혼자 읽어 봐요.'}</p></section>
   <PhonicsSongs unitId={u.id}/>
  </aside>
 </div>;
}
