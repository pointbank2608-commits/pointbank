import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useTranslation } from "react-i18next";
import { gameClock } from "../lib/gameClock";
import { playSfx, useGameSfx } from "../lib/gameSfx";
import {
  canClaimBrick,
  layoutSplashBricks,
  makeSplashBricks,
  sentenceWords,
  splashProgress,
  splashSeconds,
} from "../lib/sentenceSplash";
import type { GameItem } from "../lib/types";
import "./SentenceSplash.css";

const colors = [
  "#ffd0df",
  "#ffe6a6",
  "#d5edb3",
  "#ddccfa",
  "#c4e9ff",
  "#ffd7b6",
];
type Phase = "ready" | "playing" | "success" | "failed" | "finished";
interface Round {
  phase: Phase;
  index: number;
  picked: string[];
  started: number;
  progress: number;
  wrong: string | null;
  successes: number;
}
const initialRound = (): Round => ({
  phase: "ready",
  index: 0,
  picked: [],
  started: 0,
  progress: 0,
  wrong: null,
  successes: 0,
});

/** Pure game surface: no auth, editor, backend or AI requests. */
export default function SentenceSplash({
  items,
  seconds = 45,
  onExit,
}: {
  items: GameItem[];
  seconds?: number;
  onExit?: () => void;
}) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith("en");
  const text = (ko: string, english: string) => (en ? english : ko);
  const playable = useMemo(
    () => items.filter((i) => sentenceWords(i.label).length >= 2),
    [items],
  );
  const duration = splashSeconds(seconds);
  const [round, setRound] = useState<Round>(initialRound);
  const roundRef = useRef(round);
  roundRef.current = round;
  const [bricks, setBricks] = useState(() =>
    makeSplashBricks(playable[0] || { id: "", label: "" }),
  );
  const sfx = useGameSfx("sentencesplash");
  // 소리는 상태 변화를 따라 낸다(claim·begin 로직은 건드리지 않는다).
  const soundPrev = useRef({ phase: round.phase, picked: round.picked.length, wrong: round.wrong });
  useEffect(() => {
    const prev = soundPrev.current;
    if (round.phase === "playing" && prev.phase !== "playing") playSfx(sfx.start);
    else if (round.phase === "playing" && round.picked.length > prev.picked) playSfx(sfx.pick);
    if (round.wrong && round.wrong !== prev.wrong) playSfx(sfx.wrong);
    if (round.phase !== prev.phase) {
      // 문장 완성(다음 문장으로 넘어가는 순간) 멜로디는 다른 소리보다 커서 절반 정도로 낮춘다. 전체 완료는 그대로.
      if (round.phase === "success") playSfx(sfx.done, 0.4);
      else if (round.phase === "finished") playSfx(sfx.done);
      else if (round.phase === "failed") playSfx(sfx.splash);
    }
    soundPrev.current = { phase: round.phase, picked: round.picked.length, wrong: round.wrong };
  }, [round.phase, round.picked.length, round.wrong, sfx]);
  const [width, setWidth] = useState(640);
  // The shared frame fits the whole surface; avoid a second width-only zoom.
  const shell = useRef<HTMLDivElement>(null);
  const [shellSize, setShellSize] = useState({ w: 1000, h: 800 });
  const stage = useRef<HTMLDivElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const words = sentenceWords(playable[round.index]?.label || "");
  const layout = useMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) ctx.font = "800 18px sans-serif";
    return layoutSplashBricks(
      bricks,
      width,
      (s) => ctx?.measureText(s).width ?? s.length * 12,
      // 화면이 넓으면 무대도 높여 가로로만 길쭉해지지 않게 한다(확대 전 단위).
      Math.min(shellSize.h * 0.48, shellSize.w * 0.46),
    );
  }, [bricks, width, shellSize]);
  const key = JSON.stringify([items, duration]);
  useEffect(() => {
    const next = initialRound();
    roundRef.current = next;
    setRound(next);
    setBricks(makeSplashBricks(playable[0] || { id: "", label: "" }));
    // Content/config edits restart the game; resizing never does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    const el = shell.current;
    if (!el) return;
    const read = () => setShellSize({ w: el.clientWidth, h: window.innerHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, []);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (round.phase !== "playing") return;
    let frame: number;
    const tick = () => {
      const current = roundRef.current;
      if (current.phase !== "playing") return;
      const progress = splashProgress(
        current.started,
        gameClock.now(),
        duration,
      );
      const next: Round = {
        ...current,
        progress,
        phase: progress >= 1 ? "failed" : "playing",
      };
      roundRef.current = next;
      setRound(next);
      if (next.phase === "playing")
        frame = gameClock.requestAnimationFrame(tick);
    };
    frame = gameClock.requestAnimationFrame(tick);
    return () => gameClock.cancelAnimationFrame(frame);
  }, [round.phase, duration]);
  useEffect(() => {
    if (round.phase !== "playing")
      action.current?.focus({ preventScroll: true });
  }, [round.phase]);
  useLayoutEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    if (
      round.phase === "playing" &&
      focused?.dataset.brickId &&
      round.picked.includes(focused.dataset.brickId)
    ) {
      stage.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus({ preventScroll: true });
    }
  }, [round.picked, round.phase]);

  function begin(index: number, successes = roundRef.current.successes) {
    const item = playable[index];
    if (!item) return;
    setBricks(makeSplashBricks(item));
    const next: Round = {
      phase: "playing",
      index,
      picked: [],
      started: gameClock.now(),
      progress: 0,
      wrong: null,
      successes,
    };
    roundRef.current = next;
    setRound(next);
  }
  function claim(id: string) {
    const current = roundRef.current;
    if (current.phase !== "playing") return;
    const progress = splashProgress(current.started, gameClock.now(), duration);
    const brick = bricks.find((b) => b.id === id);
    if (!brick || current.picked.includes(id)) return;
    // Re-check elapsed time on input as well as animation frames (background tabs / slow devices).
    if (progress >= 1) {
      const next: Round = { ...current, progress: 1, phase: "failed" };
      roundRef.current = next;
      setRound(next);
      return;
    }
    if (!canClaimBrick(words, current.picked, brick, bricks)) {
      const next = { ...current, wrong: id };
      roundRef.current = next;
      setRound(next);
      return;
    }
    const picked = [...current.picked, id];
    const complete = picked.length === words.length;
    const next: Round = {
      ...current,
      picked,
      wrong: null,
      progress,
      phase: complete ? "success" : "playing",
      successes: current.successes + (complete ? 1 : 0),
    };
    roundRef.current = next;
    setRound(next);
  }
  if (!playable.length)
    return (
      <div className="splash-game" role="status">
        {text(
          "두 단어 이상인 문장을 추가해 주세요.",
          "Add a sentence with at least two words.",
        )}
      </div>
    );
  const left = Math.max(0, Math.ceil(duration * (1 - round.progress)));
  const message = round.wrong
    ? text(
        "아직 이 단어 차례가 아니에요. 다시 골라보세요!",
        "Not this word yet. Try another!",
      )
    : round.picked.length
      ? text(
          "잘했어요! 다음 단어도 찾아볼까요? ✓",
          "Great! Find the next word. ✓",
        )
      : text(
          "단어 벽돌을 문장 순서대로 눌러보세요!",
          "Tap the word bricks in sentence order!",
        );
  const overlay = round.phase !== "playing";
  return (
    <div ref={shell} className="splash-shell">
    <div
      className="splash-game"
      data-splash-phase={round.phase}
    >
      <header className="splash-header">
        <div>
          <h2>🧱 Sentence Splash!</h2>
          <p>
            {text(
              "떨어지는 단어 벽돌로 영어 문장 완성하기",
              "Build sentences with falling word bricks",
            )}
          </p>
        </div>
        <div className="splash-pills">
          <span>
            {round.index + 1} / {playable.length}
          </span>
          <span>
            {duration}
            {text("초 / 문장", "s / sentence")}
          </span>
        </div>
      </header>
      <p className="splash-message" role="status" aria-live="polite">
        {message}
      </p>
      <div className="splash-play">
        <div
          ref={stage}
          className="splash-stage"
          style={{ height: layout.height }}
          aria-label={text("떨어지는 단어", "Falling words")}
        >
          <div className="splash-sun" aria-hidden="true">
            ☀
          </div>
          <div className="splash-cloud" aria-hidden="true">
            ☁
          </div>
          {layout.positions.map((brick, i) => (
            <button
              type="button"
              key={brick.id}
              data-brick-id={brick.id}
              aria-label={brick.word}
              disabled={overlay || round.picked.includes(brick.id)}
              onClick={() => claim(brick.id)}
              onAnimationEnd={() => {
                if (roundRef.current.wrong === brick.id) {
                  const next = { ...roundRef.current, wrong: null };
                  roundRef.current = next;
                  setRound(next);
                }
              }}
              className={`splash-brick ${round.wrong === brick.id ? "splash-wrong" : ""} ${round.phase === "failed" ? "splash-drowned" : ""}`}
              style={
                {
                  "--brick": colors[i % colors.length],
                  left: brick.x,
                  top: brick.y + round.progress * layout.fall,
                  width: brick.width,
                  height: brick.height,
                  visibility: round.picked.includes(brick.id)
                    ? "hidden"
                    : "visible",
                } as CSSProperties
              }
            >
              {brick.word}
            </button>
          ))}
          <div className="splash-sea" aria-hidden="true">
            <span>🐠</span>
            <span>🐚</span>
            <span>🐟</span>
            <i>○</i>
          </div>
          {overlay && (
            <div className="splash-overlay">
              <section
                className="splash-modal"
                aria-label={text("라운드 안내", "Round information")}
              >
                <div className="splash-result-icon" aria-hidden="true">
                  {round.phase === "success"
                    ? "🎉"
                    : round.phase === "failed"
                      ? "💦"
                      : "🌊"}
                </div>
                <h3>
                  {round.phase === "success"
                    ? text("문장 완성!", "Sentence complete!")
                    : round.phase === "failed"
                      ? text("다시 도전해요!", "Try again!")
                      : round.phase === "finished"
                        ? text("모든 라운드 완료!", "All rounds complete!")
                        : text("준비됐나요?", "Ready?")}
                </h3>
                {round.phase === "success" && (
                  <p className="splash-answer" lang="en">
                    {playable[round.index].label}
                  </p>
                )}
                {round.phase === "failed" && (
                  <p>
                    {text(
                      "단어가 바다에 빠졌어요. 같은 문장에 다시 도전해요.",
                      "The words reached the sea. Try this sentence again.",
                    )}
                  </p>
                )}
                {round.phase === "ready" && (
                  <p>
                    {text(
                      "바다에 빠지기 전에 순서대로 단어를 골라요!",
                      "Choose words in order before they reach the sea!",
                    )}
                  </p>
                )}
                {round.phase === "finished" && (
                  <p>
                    {text("성공한 문장", "Completed sentences")}:{" "}
                    {round.successes} / {playable.length}
                  </p>
                )}
                <button
                  ref={action}
                  type="button"
                  className="splash-primary"
                  onClick={() => {
                    if (round.phase === "success") {
                      if (round.index + 1 < playable.length)
                        begin(round.index + 1);
                      else {
                        const next: Round = {
                          ...roundRef.current,
                          phase: "finished",
                        };
                        roundRef.current = next;
                        setRound(next);
                      }
                    } else
                      begin(
                        round.phase === "finished" ? 0 : round.index,
                        round.phase === "finished" ? 0 : round.successes,
                      );
                  }}
                >
                  {round.phase === "success"
                    ? round.index + 1 < playable.length
                      ? text("다음 문장", "Next sentence")
                      : text("전체 결과 보기", "Show results")
                    : round.phase === "failed"
                      ? text("다시 도전하기", "Try again")
                      : round.phase === "finished"
                        ? text("다시 플레이하기", "Play again")
                        : text("게임 시작!", "Start game!")}
                </button>
                {round.phase === "finished" && onExit && (
                  <button
                    type="button"
                    className="splash-secondary"
                    onClick={onExit}
                  >
                    {text("게임 종료하기", "Exit game")}
                  </button>
                )}
              </section>
            </div>
          )}
        </div>
        <aside
          className={`splash-timer ${left <= 10 ? "splash-urgent" : ""}`}
          aria-label={text("남은 시간", "Time remaining")}
        >
          <strong>{text("남은 시간", "Time left")}</strong>
          <b role="timer" aria-label={`${left}${text("초", " seconds")}`}>
            {left}
          </b>
          <span>{text("초", "sec")}</span>
          <div
            className="splash-track"
            role="progressbar"
            aria-label={text("남은 시간 게이지", "Remaining time")}
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={left}
          >
            <div style={{ height: `${(1 - round.progress) * 100}%` }} />
          </div>
          <span aria-hidden="true">⏳</span>
        </aside>
      </div>
      <section
        className="splash-sentence"
        aria-label={text("완성 중인 문장", "Your sentence")}
      >
        <h3>
          ✏️ {text("내가 만드는 문장", "My sentence")}{" "}
          <small>
            {round.picked.length} / {words.length}
          </small>
        </h3>
        <div className="splash-slots">
          {words.map((_, i) => (
            <span
              key={i}
              className={
                i < round.picked.length
                  ? "splash-filled"
                  : i === round.picked.length
                    ? "splash-next"
                    : ""
              }
            >
              {i < round.picked.length ? (
                words[i]
              ) : (
                <span aria-label={text(`${i + 1}번째 빈칸`, `Blank ${i + 1}`)}>
                  ···
                </span>
              )}
            </span>
          ))}
        </div>
      </section>
      <p className="splash-note">
        {text(
          "틀려도 괜찮아요. 다시 골라보세요!",
          "Mistakes are okay. Try again!",
        )}
      </p>
    </div>
    </div>
  );
}
