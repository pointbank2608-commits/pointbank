import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,useParams} from 'react-router-dom';
import AppLayout from '../../src/pages/AppLayout';
import StemReadyClassPage from '../../src/pages/StemReadyClassPage';
import LessonSlideViewerPage from '../../src/pages/LessonSlideViewerPage';
import {LessonRunnerProvider,useLessonRunner} from '../../src/context/LessonRunnerContext';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';
void i18n.changeLanguage('ko');
const go=new URLSearchParams(location.search).get('go');if(go)history.replaceState({},'',go);
function Run(){const {id}=useParams();const {start}=useLessonRunner();return <button onClick={()=>start((window as any).__stem.lessons.find((r:any)=>r.id===id),null,null)}>QA run saved lesson</button>;}
createRoot(document.getElementById('root')!).render(<BrowserRouter><LessonRunnerProvider><Routes><Route element={<AppLayout/>}><Route path="/stem" element={<StemReadyClassPage/>}/><Route path="/run/:id" element={<Run/>}/><Route path="/curriculum" element={<p>QA My Lessons</p>}/><Route path="/curriculum/:id/slide/:slideId" element={<LessonSlideViewerPage/>}/></Route></Routes></LessonRunnerProvider></BrowserRouter>);
