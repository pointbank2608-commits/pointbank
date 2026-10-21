// Synthetic backend fixture. Uses the real app shell, routes, editors and games.
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from '../../src/pages/AppLayout';
import DashboardPage from '../../src/pages/DashboardPage';
import MaterialsPage from '../../src/pages/MaterialsPage';
import GamesPage from '../../src/pages/GamesPage';
import WordListsPage from '../../src/pages/WordListsPage';
import WorksheetPrintPage from '../../src/pages/WorksheetPrintPage';
import CurriculumPage from '../../src/pages/CurriculumPage';
import GameWorkspace from '../../src/components/GameWorkspace';
import { GAME_PAGES } from '../../src/lib/gamePages';
import { gameClock } from '../../src/lib/gameClock';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';
void i18n.changeLanguage('ko');
(window as unknown as {__clock: typeof gameClock}).__clock=gameClock;
const params=new URLSearchParams(location.search);
history.replaceState({},'',params.get('start') || '/dashboard');
export default function Fixture(){return <BrowserRouter><Routes><Route element={<AppLayout />}><Route path="/dashboard" element={<DashboardPage />}/><Route path="/materials" element={<MaterialsPage />}/><Route path="/games" element={<GamesPage />}/><Route path="/wordlists" element={<WordListsPage />}/><Route path="/materials/worksheet" element={<WorksheetPrintPage />}/><Route path="/curriculum" element={<CurriculumPage />}/>{Object.entries(GAME_PAGES).map(([path,Page])=><Route key={path} path={path} element={<GameWorkspace><Page /></GameWorkspace>}/>)}</Route></Routes></BrowserRouter>}
createRoot(document.getElementById('root')!).render(<Fixture />);
