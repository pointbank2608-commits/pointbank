import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,useSearchParams,useParams} from 'react-router-dom';
import ReadyClassWorkbookPage from '../../src/pages/ReadyClassWorkbookPage';
import PhonicsPage from '../../src/pages/PhonicsPage';
import VideoLibraryPage from '../../src/pages/VideoLibraryPage';
import VideoWorksheetPage from '../../src/pages/VideoWorksheetPage';
import Popcorn from '../../src/components/Popcorn';
import {courseUnits,lessonSlides} from '../../src/data/phonicsLessons';
import {readyClassPages,workbookTargets,matchOrder} from '../../src/data/readyClassWorkbook';
import {popcornDeck,popcornCount} from '../../src/lib/popcorn';
import {validatePhonicsSong} from '../../src/lib/phonicsSongs';
import {buildSelectedClipLesson} from '../../src/lib/lessonRecipes';
import {LessonRunnerProvider,useLessonRunner} from '../../src/context/LessonRunnerContext';
import LessonRunnerBar from '../../src/components/LessonRunnerBar';
import LessonSlideContent from '../../src/components/LessonSlideContent';
import {useVideoClips} from '../../src/lib/videoClips';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';
void i18n.changeLanguage('ko');
Object.assign(window,{__models:{courseUnits,lessonSlides,readyClassPages,workbookTargets,matchOrder,popcornDeck,popcornCount,validatePhonicsSong,buildSelectedClipLesson}});
function Saved(){const [params]=useSearchParams();return <div data-saved-state>{JSON.stringify(params.get('dummy'))}</div>;}
function Lesson(){const {clips}=useVideoClips();const [page,setPage]=useState(0);return <><button onClick={()=>setPage(p=>1-p)}>Switch activity</button><div style={{height:'80vh',position:'relative'}}>{page===0&&clips&&<LessonSlideContent slide={{id:'qa-video-slide',kind:'shadow',source:clips[0].script,videoUrl:'https://www.youtube.com/watch?v=abcdefghijk',flow:'video'}} words={[]} fill lessonName="Synthetic" attendance={null}/>}</div></>;}
function StartRunner(){const {start}=useLessonRunner();const {clips}=useVideoClips();return <button onClick={()=>{const clip=clips![0];const lesson={id:'qa-lesson',name:'Synthetic lesson',academy_id:'qa-only',class_id:null,word_list_id:null,video_url:null,playlist:[{id:'video-one',kind:'shadow',title:'Video activity',source:clip.script,videoUrl:'https://www.youtube.com/watch?v=abcdefghijk',flow:'video'},{id:'questions-two',kind:'qna',title:'Questions activity',questions:clip.pack.questions,boardTheme:'green'}],updated_at:'now'};Object.assign(window,{__qaLesson:lesson});start(lesson as never,null,null);}}>Start actual lesson</button>;}
function RunnerSlide(){const {slideId}=useParams();const lesson=(window as unknown as {__qaLesson:import('../../src/lib/types').CurriculumLesson}).__qaLesson;const slide=lesson?.playlist?.find((s:unknown)=>(s as {id:string}).id===slideId);return <div style={{height:'75vh',position:'relative'}}>{slide&&<LessonSlideContent key={slideId} slide={slide as import('../../src/lib/types').LessonSlide} words={[]} fill lessonName="Synthetic lesson" attendance={null}/>}</div>;}
function App(){return <LessonRunnerProvider><Routes><Route path="/start-runner" element={<StartRunner/>}/><Route path="/curriculum/:id/slide/:slideId" element={<RunnerSlide/>}/><Route path="/phonics" element={<PhonicsPage/>}/><Route path="/phonics/workbook" element={<ReadyClassWorkbookPage/>}/><Route path="/materials/videos" element={<VideoLibraryPage/>}/><Route path="/materials/video-worksheet" element={<VideoWorksheetPage/>}/><Route path="/lesson-memory" element={<Lesson/>}/><Route path="/curriculum" element={<Saved/>}/><Route path="/popcorn" element={<Popcorn items={[{id:'a',label:'apple'},{id:'b',label:'bag'}]} popCount={3}/>}/></Routes><LessonRunnerBar/></LessonRunnerProvider>;}
const path=new URLSearchParams(location.search).get('go');if(path)history.replaceState({},'',path);
createRoot(document.getElementById('root')!).render(<BrowserRouter><App/></BrowserRouter>);
