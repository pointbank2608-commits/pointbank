// 전자칠판 합성 검증 전용 — 운영 진입점에 포함하지 않는다. 로그인·서버 없이 칠판과 "나갔다 돌아오기" 흐름만 띄운다.
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import BoardReturnPill from "../../src/components/board/BoardReturnPill";
import WhiteboardPage from "../../src/pages/WhiteboardPage";
import i18n from "../../src/i18n";
import "../../src/tailwind.css";
void i18n.changeLanguage("ko");

function Probe({ name }: { name: string }) {
  const loc = useLocation();
  const state = (loc.state ?? {}) as { guideLaunch?: { kind: string; cards: unknown[] }; materialsWords?: unknown[] };
  return (
    <div data-probe={name} data-cards={state.guideLaunch?.cards.length ?? state.materialsWords?.length ?? 0} data-kind={state.guideLaunch?.kind ?? ""}>
      {name} 화면
    </div>
  );
}

function App() {
  const base = "/scripts/games/board.html";
  return (
    <BrowserRouter>
      <Routes>
        <Route path={base} element={<WhiteboardPage />} />
        <Route path="/whiteboard" element={<WhiteboardPage />} />
        <Route path="/games/:type" element={<Probe name="game" />} />
        <Route path="/materials/:kind" element={<Probe name="materials" />} />
        <Route path="/dashboard" element={<Probe name="dashboard" />} />
      </Routes>
      <BoardReturnPill />
    </BrowserRouter>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
