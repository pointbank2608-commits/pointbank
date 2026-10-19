// Synthetic local fixture. Never imported by the production entry point.
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { LessonRunnerProvider } from "../../src/context/LessonRunnerContext";
import { GAME_PAGES } from "../../src/lib/gamePages";
import GameWorkspace from "../../src/components/GameWorkspace";
import { gameClock } from "../../src/lib/gameClock";
import "../../src/tailwind.css";
import i18n from "../../src/i18n";
void i18n.changeLanguage(
  new URLSearchParams(location.search).get("lang") || "ko",
);
(window as unknown as { __clock: typeof gameClock }).__clock = gameClock;
import CurriculumPage from '../../src/pages/CurriculumPage';
import WordListsPage from '../../src/pages/WordListsPage';
import DashboardPage from '../../src/pages/DashboardPage';
import GamesPage from '../../src/pages/GamesPage';
import WorksheetPrintPage from '../../src/pages/WorksheetPrintPage';
export default function Fixture() {
  const location = useLocation();
  const path = location.pathname.startsWith("/games/")
    ? location.pathname
    : `/games/${new URLSearchParams(location.search).get("game") || "quiz"}`;
  if (location.pathname === '/dashboard') return <div className="mx-auto max-w-[1440px] p-5"><DashboardPage /></div>;
  if (location.pathname === '/wordlists') return <WordListsPage />;
  if (location.pathname === '/games') return <GamesPage />;
  if (location.pathname === '/materials/worksheet') return <WorksheetPrintPage />;
  if (location.pathname === '/curriculum') return <CurriculumPage />;
  const Page = GAME_PAGES[path];
  return (
    <GameWorkspace>
      <Page />
    </GameWorkspace>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <LessonRunnerProvider>
      <Fixture />
    </LessonRunnerProvider>
  </BrowserRouter>,
);
