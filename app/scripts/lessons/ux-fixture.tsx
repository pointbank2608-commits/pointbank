import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,useLocation} from 'react-router-dom';
import CurriculumPage from '../../src/pages/CurriculumPage';
import AppLayout from '../../src/pages/AppLayout';
import {LessonRunnerProvider} from '../../src/context/LessonRunnerContext';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';
const go=new URLSearchParams(location.search).get('go');if(go)history.replaceState({},'',go);
void i18n.changeLanguage('ko');
function HomeworkLinkProbe(){return <pre data-homework-link>{JSON.stringify(useLocation().state)}</pre>;}
createRoot(document.getElementById('root')!).render(<BrowserRouter><LessonRunnerProvider><Routes><Route element={<AppLayout/>}><Route path="/curriculum" element={<CurriculumPage/>}/><Route path="/homework" element={<HomeworkLinkProbe/>}/></Route></Routes></LessonRunnerProvider></BrowserRouter>);
