// Synthetic fixture, excluded from the production entry point.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LessonRunnerProvider } from "../../src/context/LessonRunnerContext";
import { GameEmbedContext } from "../../src/context/GameEmbedContext";
import GameWorkspace from "../../src/components/GameWorkspace";
import SentenceSplash from "../../src/components/SentenceSplash";
import SentenceSplashPage from "../../src/pages/SentenceSplashPage";
import GamesPage from "../../src/pages/GamesPage";
import { GAME_PAGES } from "../../src/lib/gamePages";
import { gameClock, pauseGameClock } from "../../src/lib/gameClock";
import { splashSampleItems } from "../../src/lib/sentenceSplash";
import i18n from "../../src/i18n";
import "../../src/tailwind.css";
void i18n.changeLanguage("ko");
declare global {
  interface Window {
    __splash: {
      shift: (ms: number) => void;
      pause: (value: boolean) => void;
      sample: () => void;
      duplicate: () => void;
    };
  }
}
function Fixture() {
  const [items, setItems] = useState([
    { id: "repeat", label: "He'd like to like them?" },
  ]);
  const mode = new URLSearchParams(location.search).get("mode");
  const nativeNow = gameClock.now;
  let extra = 0;
  // Install once; callback looks up the current state-independent base clock.
  if (!window.__splash) {
    gameClock.now = () => nativeNow() + extra;
    window.__splash = {
      shift: (ms) => {
        extra += ms;
      },
      pause: (value) => pauseGameClock("test", value),
      sample: () => setItems(splashSampleItems()),
      duplicate: () =>
        setItems([{ id: "duplicate", label: "I like it like this." }]),
    };
  }
  if (mode === "teacher")
    return (
      <GameWorkspace>
        <SentenceSplashPage />
      </GameWorkspace>
    );
  if (mode === 'teacher-native') return <SentenceSplashPage />;
  if (mode === "games") return <GamesPage />;
  if (mode === "embed") {
    const Page = GAME_PAGES["/games/sentencesplash"];
    return (
      <GameEmbedContext.Provider
        value={{
          classId: "class-a",
          templateId:
            new URLSearchParams(location.search).get("template") || undefined,
          onSelect: (id) => {
            document.documentElement.dataset.selectedTemplate = id || "";
          },
        }}
      >
        <Page />
      </GameEmbedContext.Provider>
    );
  }
  if (mode === "student") return <SentenceSplashPage />;
  return (
    <SentenceSplash
      items={items}
      seconds={30}
      onExit={() => {
        document.documentElement.dataset.exited = "yes";
      }}
    />
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <LessonRunnerProvider>
      <Fixture />
    </LessonRunnerProvider>
  </BrowserRouter>,
);
