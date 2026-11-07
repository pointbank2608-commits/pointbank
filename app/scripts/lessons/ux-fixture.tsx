import {createRoot} from 'react-dom/client';
import {BrowserRouter,Link,Routes,Route,useLocation,useParams} from 'react-router-dom';
import CurriculumPage from '../../src/pages/CurriculumPage';
import GamesPage from '../../src/pages/GamesPage';
import PhonicsGamesPage from '../../src/pages/PhonicsGamesPage';
import GameWorkspace from '../../src/components/GameWorkspace';
import { GAME_PAGES } from '../../src/lib/gamePages';
import LessonSlideViewerPage from '../../src/pages/LessonSlideViewerPage';
import CvcWorkbookPage from '../../src/pages/CvcWorkbookPage';
import PhonicsWorkbookPage from '../../src/pages/PhonicsWorkbookPage';
import WorksheetPrintPage from '../../src/pages/WorksheetPrintPage';
import AppLayout from '../../src/pages/AppLayout';
import {LessonRunnerProvider} from '../../src/context/LessonRunnerContext';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';
const go=new URLSearchParams(location.search).get('go');if(go)history.replaceState({},'',go);
void i18n.changeLanguage('ko');
function HomeworkLinkProbe(){return <pre data-homework-link>{JSON.stringify(useLocation().state)}</pre>;}
function PreviewGame() {
  const { gameId } = useParams();
  const Game = gameId ? GAME_PAGES[`/games/${gameId}`] : undefined;
  return Game ? <GameWorkspace key={gameId}><Game /></GameWorkspace> : <p>게임을 찾을 수 없어요.</p>;
}
createRoot(document.getElementById('root')!).render(
  <BrowserRouter><LessonRunnerProvider><Routes><Route element={<AppLayout/>}>
    <Route path="/curriculum" element={<CurriculumPage/>}/>
    <Route path="/curriculum/:id/slide/:slideId" element={<LessonSlideViewerPage/>}/>
    <Route path="/games" element={<GamesPage/>}/>
    <Route path="/games/:gameId" element={<PreviewGame/>}/>
    <Route path="/phonics-games/:gameId?" element={<PhonicsGamesPage/>}/>
    <Route path="/materials/worksheet" element={<WorksheetPrintPage/>}/>
    <Route path="/materials/cvc-workbook" element={<CvcWorkbookPage/>}/>
    <Route path="/materials/long-vowel-workbook" element={<CvcWorkbookPage key="long" book="long"/>}/>
    <Route path="/materials/phonics-stage-1" element={<PhonicsWorkbookPage key="stage1" step={1}/>}/>
    <Route path="/materials/phonics-stage-4-workbook" element={<PhonicsWorkbookPage key="stage4" step={4}/>}/>
    <Route path="/materials/phonics-stage-5-workbook" element={<PhonicsWorkbookPage key="stage5" step={5}/>}/>
    <Route path="/homework" element={<HomeworkLinkProbe/>}/>
    <Route path="*" element={<p>이 화면은 수업 미리보기 범위에 포함되지 않아요. <Link className="text-primary underline" to="/curriculum">내 수업으로 돌아가기</Link></p>}/>
  </Route></Routes></LessonRunnerProvider></BrowserRouter>,
);
