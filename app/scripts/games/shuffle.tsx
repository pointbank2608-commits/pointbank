// 컵 속 친구 찾기 합성 검증 전용 — 운영 진입점에 포함하지 않는다. 로그인·서버 없이 게임 컴포넌트만 띄운다.
import { createRoot } from "react-dom/client";
import ShuffleFind from "../../src/components/ShuffleFind";
import { normalizeShuffleConfig } from "../../src/lib/shuffleFind";
import i18n from "../../src/i18n";
import "../../src/tailwind.css";
void i18n.changeLanguage("ko");
const q = new URLSearchParams(location.search);
const count = Number(q.get("items") || 6);
const base = ["cat | 고양이", "dog | 강아지", "mouse | 쥐", "bird | 새", "fish | 물고기", "rabbit | 토끼", "I like apples. | 나는 사과를 좋아해요.", "She is playing the piano and singing a very long song today.", "tiger", "lion"];
const items = Array.from({ length: count }, (_, i) => ({ id: `i${i}`, label: base[i % base.length] }));
const cfg = normalizeShuffleConfig({
  shuffleTeams: q.get("teams") ? Number(q.get("teams")) : undefined,
  shuffleCups: q.get("cups") ? Number(q.get("cups")) : undefined,
  shuffleSpeed: q.get("speed") || "fast",
  shuffleRounds: q.get("rounds") ? Number(q.get("rounds")) : 2,
});
createRoot(document.getElementById("root")!).render(
  <div style={{ maxWidth: 1180, margin: "0 auto", padding: 16 }}>
    <ShuffleFind items={items} teams={cfg.teams} cups={cfg.cups} speed={cfg.speed} rounds={cfg.rounds} />
  </div>,
);
