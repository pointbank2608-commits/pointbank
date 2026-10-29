import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,useParams} from 'react-router-dom';
import StemReadyClassPage from '../../src/pages/StemReadyClassPage';
import VideoLibraryPage from '../../src/pages/VideoLibraryPage';
import PhonicsPage from '../../src/pages/PhonicsPage';
import LessonSlideContent from '../../src/components/LessonSlideContent';
import LessonRunnerBar from '../../src/components/LessonRunnerBar';
import AppLayout from '../../src/pages/AppLayout';
import {LessonRunnerProvider,useLessonRunner} from '../../src/context/LessonRunnerContext';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';
void i18n.changeLanguage('ko');
function Start(){const {start}=useLessonRunner();return <button onClick={()=>start((window as any).__v2.lessons[0],null,null)}>Start lesson</button>;}
function Slide(){const {slideId}=useParams();const lesson=(window as any).__v2.lessons[0];const slide=lesson.playlist.find((s:any)=>s.id===slideId);return <div style={{position:'relative',height:'75vh'}}><LessonSlideContent key={slideId} slide={slide} fill words={[]} lessonName={lesson.name} attendance={null}/></div>;}
const path=new URLSearchParams(location.search).get('go');if(path)history.replaceState({},'',path);
createRoot(document.getElementById('root')!).render(<BrowserRouter><LessonRunnerProvider><Routes><Route element={<AppLayout/>}><Route path="/stem" element={<StemReadyClassPage/>}/><Route path="/videos" element={<VideoLibraryPage/>}/><Route path="/phonics" element={<PhonicsPage/>}/><Route path="/start" element={<Start/>}/><Route path="/curriculum/:id/slide/:slideId" element={<Slide/>}/></Route></Routes></LessonRunnerProvider></BrowserRouter>);
