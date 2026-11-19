import {useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {fetchPhonicsBank} from '../../lib/api';
import {curriculumEntries,unitById} from '../../data/phonicsCurriculum';
import {courseUnits,availableLessonSlides,type CourseUnit,type CourseSlide} from '../../data/phonicsLessons';
import {COURSE_TONES,readyClassPages} from '../../data/readyClassWorkbook';
import {useWorkbookImageChecks} from '../../lib/useWorkbookImageChecks';
import PhonicsLessonPreview from './PhonicsLessonPreview';
import PhonicsCourseSlide from './PhonicsCourseSlide';
import '../../phonicsStage1.css';
import '../../styles/phonics-teaching.css';
import '../../styles/ready-class-catalog.css';

type Period = 1 | 2;
const stages = [1, 2, 3, 4, 5];
const flowLabels: Partial<Record<CourseSlide['kind'], string>> = {
  sounds:'소리 듣기', letter:'글자와 소리 익히기', introduce:'소리 익히기', builder:'소리 합치기',
  word:'단어 읽기', group:'단어 읽기', match:'짝 연결하기', choose:'듣고 고르기', odd:'다른 소리 찾기',
  writeLetter:'글자 쓰기', write:'단어 쓰기', complete:'빈칸 채우기', sort:'소리별 분류',
  memory:'읽기 복습', read:'문장 읽기', readTogether:'함께 읽기', readAlone:'혼자 읽기',
};
function lessonDetails(unit:CourseUnit, period:Period) {
  const slides=availableLessonSlides(unit).filter(slide=>slide.lesson===period);
  const kinds=slides.filter(slide=>slide.phase===0).map(slide=>slide.kind);
  const unitOne=unit.step===2&&unit.number===1;
  const flow=unitOne ? (period===1?'듣기 → 소리 합치기 → 단어 읽기':'읽기 복습 → 쓰기 → 끝소리별 분류')
    : [...new Set(kinds.flatMap(kind=>flowLabels[kind]?[flowLabels[kind]]:[]))].join(' → ');
  const title=unitOne?(period===1?'소리를 합쳐 읽기':'읽은 단어를 쓰고 분류하기')
    : period===1 ? (kinds.includes('builder')?'소리를 합쳐 읽기':'글자와 소리 익히기')
    : kinds.includes('sort')?'읽은 단어를 쓰고 분류하기':'읽은 단어 복습하기';
  const representative=slides.find(slide=>slide.phase===0&&slide.kind===(period===1?'builder':'sort'))
    ?? slides.find(slide=>slide.phase===0&&slide.entryIds.length>0)??slides[0];
  const pages=readyClassPages(unit);
  const slideIds=new Set(slides.map(slide=>slide.id));
  const recommended=pages.flatMap((page,index)=>(unitOne
    ? period===1 ? index<5 : index>=5&&index<9
    : page.slides.some(id=>slideIds.has(id)))?[index+1]:[]);
  return {title,flow,representative,recommended,slides,kinds};
}

function LessonDetail({unit,period,onPeriod,onBack}:{unit:CourseUnit;period:Period;onPeriod:(period:Period)=>void;onBack:()=>void}) {
  const {t}=useTranslation();
  const {kinds}=lessonDetails(unit,period);
  const paths=useMemo(()=>[...new Set(unit.entries.flatMap(entry=>entry.image_url?[entry.image_url]:[]))],[unit]);
  const checks=useWorkbookImageChecks(paths);
  const ready=paths.every(path=>checks[path]===true)&&unit.entries.every(entry=>entry.image_url);
  const worksheetTypes=period===1?[['match','선 잇기']]:[
    ...(kinds.includes('complete')?[['phonicsBlank','규칙 글자 빈칸']]:[]),
    ...(kinds.includes('sort')?[['grouping','소리별 분류']]:[]),
  ];
  const curriculumUnit=unitById(unit.id);
  return <div className="rc-catalog-detail">
    <div className="flex flex-wrap items-center gap-2">
      <button className="pc-button" onClick={onBack}>{t('phonicsLesson.back')}</button>
      {([1,2] as const).map(n=><button key={n} className="pc-button" aria-pressed={period===n} onClick={()=>onPeriod(n)}>{n}차시</button>)}
    </div>
    <header className="rc-unit-band"><strong>Level {unit.step} · Unit {unit.number}</strong><h2>{unit.groups.map(group=>group.label).join(' · ')}</h2></header>
    <PhonicsLessonPreview unit={unit} ready={ready} section={period} printLinks={<>{(worksheetTypes.length?worksheetTypes:[['phonicsTracing','따라쓰기']]).map(([tab,label])=><Link key={tab} className="pc-button" to="/materials/phonics" state={{...(curriculumUnit?{phonicsUnitIds:[curriculumUnit.id]}:{phonicsWordIds:unit.entries.map(entry=>entry.id)}),materialsTab:tab}}>{label}</Link>)}</>}/>
  </div>;
}

export default function PhonicsCourseCatalog() {
  const {t}=useTranslation();
  const [params,setParams]=useSearchParams();
  const parsed=Number(params.get('level'));
  const step=stages.includes(parsed)?parsed:1;
  const [bank,setBank]=useState(()=>curriculumEntries(false));
  useEffect(()=>{let active=true;void fetchPhonicsBank().then(rows=>{if(active)setBank(rows);}).catch(()=>{});return()=>{active=false;};},[]);
  const units=useMemo(()=>courseUnits(bank),[bank]);
  const stageUnits=units.filter(unit=>unit.step===step);
  const unit=stageUnits.find(item=>item.id===params.get('unit'));
  const period=params.get('lesson')==='2'?2:1;
  const detail=Boolean(unit&&params.has('lesson'));
  const choose=(level:number,id?:string,lesson?:Period)=>setParams({
    tab:'course',level:String(level),...(id?{unit:id}:{}),...(lesson?{lesson:String(lesson)}:{}),
  });
  useEffect(()=>{
    if(detail||!unit)return;
    document.getElementById('ready-'+unit.id)?.scrollIntoView({block:'nearest'});
  },[detail,unit]);
  return <section className="pc-course-preview rc-course-catalog" data-phonics-teaching style={{'--rc-stage-tone':COURSE_TONES[step]} as React.CSSProperties}>
    <h1>{t('phonicsLesson.catalog')}</h1>
    <div className="rc-stage-tabs" role="group" aria-label={t('phonicsLesson.level')}>
      {stages.map(level=><button className="pc-button" key={level} aria-pressed={step===level} onClick={()=>choose(level)}>
        {level} · {t('phonicsTeaching.stage'+level)}
      </button>)}
    </div>
    {detail&&unit?<LessonDetail unit={unit} period={period} onPeriod={next=>choose(step,unit.id,next)} onBack={()=>choose(step,unit.id)}/>
      :stageUnits.map(item=><section key={item.id} id={'ready-'+item.id}>
        <header className="rc-unit-band"><h2>Unit {item.number} · {item.groups.map(group=>group.label).join(' · ')}</h2></header>
        <div className="rc-period-grid">
          {([1,2] as const).map(n=>{
            const lesson=lessonDetails(item,n);
            return <article className="rc-period-card" key={n}>
              <div className="rc-period-slide" inert aria-hidden="true">{lesson.representative&&<PhonicsCourseSlide unit={item} slide={lesson.representative} index={lesson.slides.indexOf(lesson.representative)} total={lesson.slides.length}/>}</div>
              <div className="rc-period-copy"><h3>{n}차시 · {lesson.title}</h3><p>{lesson.flow}</p>
                <button className="pc-primary" onClick={()=>choose(step,item.id,n)}>수업 보기</button>
              </div>
            </article>;
          })}
        </div>
      </section>)}
  </section>;
}
