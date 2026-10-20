// 컵 속 친구 찾기 페이지 합성 검증용 — 운영 진입점에 포함하지 않는다.
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LessonRunnerProvider } from "../../src/context/LessonRunnerContext";
import { GameEmbedContext } from "../../src/context/GameEmbedContext";
import GameWorkspace from "../../src/components/GameWorkspace";
import ShuffleFindPage from "../../src/pages/ShuffleFindPage";
import GamesPage from "../../src/pages/GamesPage";
import { GAME_PAGES } from "../../src/lib/gamePages";
import i18n from "../../src/i18n";
import "../../src/tailwind.css";
void i18n.changeLanguage("ko");
function Fixture() {
  const q = new URLSearchParams(location.search);
  const mode = q.get("mode");
  if (mode === "teacher") return <GameWorkspace><ShuffleFindPage /></GameWorkspace>;
  if (mode === "games") return <GamesPage />;
  if (mode === "student") return <ShuffleFindPage />;
  if (mode === "embed") {
    const Page = GAME_PAGES["/games/shufflefind"];
    return (
      <GameEmbedContext.Provider value={{ classId: "class-a", templateId: q.get("template") || undefined, onSelect: () => {} }}>
        <Page />
      </GameEmbedContext.Provider>
    );
  }
  return null;
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <LessonRunnerProvider>
      <Fixture />
    </LessonRunnerProvider>
  </BrowserRouter>,
);
