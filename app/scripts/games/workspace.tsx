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
export default function Fixture() {
  const location = useLocation();
  const path = location.pathname.startsWith("/games/")
    ? location.pathname
    : `/games/${new URLSearchParams(location.search).get("game") || "quiz"}`;
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
