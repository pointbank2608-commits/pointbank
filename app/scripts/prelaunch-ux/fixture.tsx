import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,useNavigate,useParams} from 'react-router-dom';
import {useState} from 'react';
import AppLayout from '../../src/pages/AppLayout';
import WheelPage from '../../src/pages/WheelPage';
import WordListsPage from '../../src/pages/WordListsPage';
import DashboardPage from '../../src/pages/DashboardPage';
import CurriculumPage from '../../src/pages/CurriculumPage';
import LessonSlideViewerPage from '../../src/pages/LessonSlideViewerPage';
import GameWorkspace from '../../src/components/GameWorkspace';
import LessonSlideSorter from '../../src/components/LessonSlideSorter';
import TeachingVideoFrame from '../../src/components/TeachingVideoFrame';
import VideoClipLibrary from '../../src/components/VideoClipLibrary';
import {LessonRunnerProvider,useLessonRunner} from '../../src/context/LessonRunnerContext';
import {wordListToCards} from '../../src/lib/gameFromWords';
import {lessonActivityLabel} from '../../src/lib/lessonActivityLabels';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';
void i18n.changeLanguage('ko');
const go=new URLSearchParams(location.search).get('go');if(go)history.replaceState({},'',go);
const db=()=> (window as any).__ux;
function Launch(){const navigate=useNavigate();return <><button onClick={()=>navigate('/games/wheel',{state:{quickSource:{ownerId:'teacher',academyId:'academy',id:'vocabulary',name:db().lists[0].name,kind:'word',cards:wordListToCards(db().lists[0])}}})}>QA launch list</button><button onClick={()=>navigate('/games/wheel')}>QA normal games</button><button onClick={()=>navigate('/games/wheel',{state:{quickSource:{ownerId:'teacher',academyId:'academy',id:'invalid',name:'Empty list',kind:'word',cards:[]}}})}>QA invalid list</button></>;}
function Editor(){const [slides,setSlides]=useState(db().lessons[1].playlist);return <LessonSlideSorter academyId="academy" classId={null} lessonName="QA video" wordListId="" wordLists={[]} slides={slides} onChange={next=>{setSlides(next);(window as any).__edited=next;}} onWordListChange={()=>{}}/>;}
function Video(){const [value,setValue]=useState(1);return <div style={{height:'calc(100dvh - 180px)',minHeight:560}}><TeachingVideoFrame title="QA settings geometry" playing={false} ready video={<div style={{height:'100%',background:'#416a88'}}/>} caption={<div><strong className="tv-en">It is delicious.</strong><span className="tv-ko">정말 맛있어요.</span></div>} onPlay={()=>{}} onReplay={()=>{}} progress={<span>0:10 / 1:00</span>} settings={()=> <><fieldset><legend>QA repeat</legend>{[1,2,3].map(n=><button key={n} aria-pressed={value===n} onClick={()=>setValue(n)}>{n}</button>)}</fieldset>{Array.from({length:7},(_,i)=><label key={i}>QA setting {i}<select defaultValue="1"><option>1</option><option>2</option></select></label>)}</>}/></div>;}
function Run(){const {start}=useLessonRunner();return <button onClick={()=>start(db().lessons[1],null,null)}>QA start lesson</button>;}
(window as any).__label=lessonActivityLabel;
createRoot(document.getElementById('root')!).render(<BrowserRouter><LessonRunnerProvider><Routes><Route element={<AppLayout/>}><Route path="/qa" element={<Launch/>}/><Route path="/wordlists" element={<WordListsPage/>}/><Route path="/dashboard" element={<DashboardPage/>}/><Route path="/curriculum" element={<CurriculumPage/>}/><Route path="/editor" element={<Editor/>}/><Route path="/video" element={<Video/>}/><Route path="/videos" element={<VideoClipLibrary onPick={()=>{}}/>}/><Route path="/run" element={<Run/>}/><Route path="/games/wheel" element={<GameWorkspace><WheelPage/></GameWorkspace>}/><Route path="/curriculum/:id/slide/:slideId" element={<LessonSlideViewerPage/>}/></Route></Routes></LessonRunnerProvider></BrowserRouter>);
