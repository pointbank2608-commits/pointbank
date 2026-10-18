import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  GameWorkspaceContext,
  useGameWorkspace,
  type GameWorkspaceBridge,
} from "../context/GameWorkspaceContext";
import { GAME_CATALOG } from "../lib/gameCatalog";
import { prepareClassroomGame } from "../lib/gameWorkspace";
import { pauseGameClock } from "../lib/gameClock";
import TeamOrderPanel from "./TeamOrderPanel";
import { useAuth } from "../context/AuthContext";
import { isFreeTierGame } from "../lib/gameCatalog";
import { usePresenting } from '../context/LessonRunnerContext';
import { useNavigate } from 'react-router-dom';
import { useFeature } from '../lib/features';
import {
  isShowOrderOn,
  loadTeamOrder,
  saveTeamOrder,
  setShowOrderOn,
  TEAM_ORDER_EVENT,
} from "../lib/teamOrder";

const btn =
  "min-h-12 rounded-xl border border-outline-variant bg-white px-4 py-2 text-base font-bold text-deep-navy focus-visible:outline-4 focus-visible:outline-primary disabled:opacity-40";
export default function GameWorkspace({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const { hasFullAccess } = useAuth();
  const presenting = usePresenting();
  const navigate=useNavigate();const homeworkOpen=useFeature('homework');
  const en = i18n.language.startsWith("en");
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [info, setInfo] = useState<GameWorkspaceBridge | null>(null);
  const bridge = useRef<GameWorkspaceBridge | null>(null);
  const [panel, setPanel] = useState<"settings" | "content" | "games" | null>(
    null,
  );
  const [running, setRunning] = useState(false);
  const [teams, setTeams] = useState(false);
  const [absent, setAbsent] = useState<string[]>([]);
  const [, setTurnRevision] = useState(0);
  const [hasBoard, setHasBoard] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const owner = useRef(crypto.randomUUID());
  const identity = `${info?.academyId}:${info?.classId}`;
  const previous = useRef("");
  const publish = useCallback((next: GameWorkspaceBridge) => {
    bridge.current = next;
    setInfo((old) =>
      old &&
        old.gameType === next.gameType && old.sharedView === next.sharedView &&
      old.classId === next.classId &&
      old.selected === next.selected &&
      old.roster === next.roster &&
      old.lists === next.lists &&
      old.templates === next.templates &&
      old.loading === next.loading &&
      old.classes === next.classes
        ? old
        : next,
    );
  }, []);
  useEffect(() => {
    setRunning(false);
    setAbsent([]);
    setPanel(null);
  }, [identity]);
  useEffect(() => {
    const key = `${identity}:${info?.selected?.id}`;
    if (previous.current !== key) {
      previous.current = key;
      setRunning(false);
    }
  }, [identity, info?.selected?.id]);
  useEffect(() => {
    const token = owner.current;
    pauseGameClock(token, !running || !!panel || teams);
    return () => pauseGameClock(token, false);
  }, [running, panel, teams]);
  useEffect(() => {
    if (!stage) return;
    const check = () => setHasBoard(!!stage.querySelector("[data-game]"));
    const observer = new MutationObserver(check);
    observer.observe(stage, { childList: true, subtree: true });
    check();
    return () => observer.disconnect();
  }, [stage]);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (panel && !d.open) d.showModal();
    else if (!panel && d.open) d.close();
  }, [panel]);
  useEffect(() => {
    const update = () => setTurnRevision((n) => n + 1);
    window.addEventListener(TEAM_ORDER_EVENT, update);
    return () => window.removeEventListener(TEAM_ORDER_EVENT, update);
  }, []);
  useEffect(() => {
    if (running && !panel && !teams) return;
    const stop = (e: KeyboardEvent) => {
      if (e.key !== "Tab" && e.key !== "Escape") e.stopPropagation();
    };
    document.addEventListener("keydown", stop, true);
    return () => document.removeEventListener("keydown", stop, true);
  }, [panel, teams, running]);
  const roster = useMemo(
    () => (info?.roster || []).filter((r) => !absent.includes(r.id)),
    [info?.roster, absent],
  );
  const order = loadTeamOrder(roster);
  async function action(fn: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      setRunning(false);
      setPanel(null);
    } catch {
      setError(
        en
          ? "Could not save. Your original material is unchanged. Retry."
          : "구성을 저장하지 못했습니다. 원본 자료는 유지됩니다. 다시 시도해 주세요.",
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  const value = useMemo(
    () => ({
      stage,
      running,
      hasSource: !!info?.sourceCards,
      pause: () => setRunning(false),
      panel,
      publish,
      roster,
      openTeams: () => setTeams(true),
      open: setPanel,
      start: () => setRunning(true),
    }),
    [stage, running, panel, publish, roster, info?.sourceCards],
  );
  const className =
    info?.classes.find((c) => c.id === info.classId)?.name ||
    (en ? "Choose class" : "반 선택");
  const contentName =
    info?.selected?.config.classroomSource?.name ||
    info?.selected?.name ||
    (en ? "Sample game" : "샘플로 체험");
  const controls = (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-container-low p-3">
      <button className={btn} onClick={() => setPanel("content")}>
        📚 {contentName}
      </button>
      <button
        className={btn}
        onClick={() => {
          setPanel("content");
        }}
      >
        👥 {className}
      </button>
      <button
        className={btn}
        disabled={!info?.roster.length}
        onClick={() => setTeams(true)}
      >
        {en ? "Teams & turns" : "팀·순서"}
      </button>
      <button
        className={`${btn} bg-primary! text-white!`}
        disabled={info?.loading || !hasBoard}
        onClick={() => setRunning((v) => !v)}
      >
        {running
          ? info?.gameType === 'quizshow' ? (en ? 'Hide host screen' : '진행 화면 가리기') : en
            ? "Pause"
            : "잠깐 멈춤"
          : en
            ? "▶ Start / resume"
            : "▶ 시작·이어하기"}
      </button>
      <button className={btn} onClick={() => setPanel("settings")}>
        {en ? "Settings & save" : "설정·저장"}
      </button>
      {!!info?.sourceCards && (
        <button className={btn} onClick={() => setPanel("games")}>
          {en ? "Another game" : "같은 내용으로 다른 게임"}
        </button>
      )}
      {roster.length > 0 && running && isShowOrderOn() && (
        <div className="flex items-center gap-2">
          <strong>
            {en ? "Current turn" : "지금 차례"}:{" "}
            {order.mode === "team"
              ? `${en ? "Team" : "팀"} ${Number(order.order[order.turn]?.split("-")[1] || 0) + 1}`
              : roster.find((r) => r.id === order.order[order.turn])?.label}
          </strong>
          <button
            className={btn}
            onClick={() =>
              saveTeamOrder(roster, {
                ...order,
                turn: (order.turn + 1) % Math.max(1, order.order.length),
              })
            }
          >
            {en ? "Next" : "다음 차례"}
          </button>
        </div>
      )}
    </div>
  );
  return (
    <GameWorkspaceContext.Provider value={value}>
      <section
        className="game-workspace relative space-y-3"
        aria-label={en ? "Classroom game" : "수업 게임"}
      >
        {!presenting && controls}
        <div
          ref={setStage}
          style={presenting ? { height: 'calc(100dvh - 100px)', minHeight: 320 } : undefined}
          className={`game-workspace-stage relative min-h-[460px] ${!running || panel || teams ? "game-workspace-paused" : ""}`}
        >
          {!running && (
            <div className="absolute inset-x-0 top-24 z-30 mx-auto max-w-lg rounded-2xl bg-deep-navy/95 p-6 text-center text-white shadow-lg">
              <p className="text-xl font-bold">
                {en ? "Ready when you are" : "자료와 팀을 확인하고 시작하세요"}
              </p>
              <p className="my-3">
                {contentName} · {className}
              </p>
              <button className={btn} onClick={() => hasBoard ? setRunning(true) : setPanel('settings')}>
              {hasBoard ? (en ? "▶ Start / resume" : "▶ 시작·이어하기") : (en ? 'Prepare game content' : '내용 확인·게임 준비')}
              </button>
            </div>
          )}
        </div>
        <dialog
          ref={dialog}
          className="classroom-dialog game-workspace-dialog"
          aria-label={en ? "Teacher preparation" : "선생님 준비"}
          onCancel={(e) => {
            e.preventDefault();
            setPanel(null);
          }}
        >
          <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-deep-navy p-4 text-white">
            <div>
              <h2 className="text-xl font-bold">
                {en ? "Teacher preparation" : "선생님 준비 중"}
              </h2>
              <p>
                {en
                ? (info?.gameType === 'quizshow' ? 'Online participants continue on the server. This screen is visible on this display.' : "Game is paused. Content is visible on this display.")
                : (info?.gameType === 'quizshow' ? '온라인 대회는 서버에서 계속 진행됩니다. 이 설정 화면은 현재 화면에 표시됩니다.' : "게임은 멈춰 있습니다. 이 설정 화면은 현재 화면에 표시됩니다.")}
              </p>
            </div>
            <button className={btn} onClick={() => setPanel(null)}>
              {en ? "Done / back to game" : "닫고 게임으로"}
            </button>
          </header>
          {error && (
            <p
              role="alert"
              className="bg-error-container p-4 text-on-error-container"
            >
              {error}
            </p>
          )}
          {info?.sharedView && <p className="bg-amber-50 p-4 text-amber-950">{en ? 'Stop student follow-along before changing the lesson content or game.' : '학생 따라보기를 끈 뒤 자료·게임 구성을 변경해 주세요.'}</p>}
          {panel === "content" && !info?.sharedView && (
            <div className="space-y-4 p-4">
              <label className="block">
                {en ? "Class" : "수업할 반"}
                <select
                  className={btn}
                  value={info?.classId || ""}
                  disabled={
                    busy ||
                    (!hasFullAccess &&
                      !isFreeTierGame(info?.gameType || "wheel"))
                  }
                  onChange={(e) => {
                    setRunning(false);
                    bridge.current?.selectClass(e.target.value);
                  }}
                >
                  {info?.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {en
                  ? "Choose your vocabulary or sentence collection. Creates a game copy; does not edit the source."
                  : "내 단어장·문장 모음을 고르면 게임용 구성으로 저장합니다. 원본 자료는 바뀌지 않습니다."}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {info?.lists.map((list) => {
                  const ready = !!prepareClassroomGame(info.gameType, list);
                  return (
                    <button
                      key={list.id}
                      className={`${btn} text-left`}
                      disabled={busy || !ready}
                      onClick={() =>
                        void action(() => bridge.current!.useList(list))
                      }
                    >
                      {list.name} · {list.items.length}{" "}
                      {list.kind === "sentence"
                        ? en
                          ? "sentences"
                          : "문장"
                        : en
                          ? "words"
                          : "단어"}
                      {!ready && (
                        <small className="block">
                          {en
                            ? "Not compatible with this game"
                            : "이 게임에 맞는 자료가 아닙니다"}
                        </small>
                      )}
                    </button>
                  );
                })}
              </div>
              <h3 className="font-bold">
                {en ? "Saved game configurations" : "저장한 게임 구성"}
              </h3>
              {info?.templates.map((tpl) => (
                <button
                  key={tpl.id}
                  className={`${btn} mr-2 mb-2`}
                  onClick={() => {
                    bridge.current?.selectTemplate(tpl.id);
                    setPanel(null);
                  }}
                >
                  {tpl.name}
                </button>
              ))}
              {!info?.lists.length && (
                <p>
                  {en
                    ? "No materials yet. Use the sample, or add content in Settings & save."
                    : "아직 자료가 없습니다. 샘플을 체험하거나 설정·저장에서 내용을 직접 만들 수 있어요."}
                </p>
              )}
            </div>
          )}
          {panel === "games" && !info?.sharedView && (
            <div className="space-y-3 p-4">
              {!presenting && homeworkOpen && info?.sourceCards?.length && info.sourceCards.every(c=>/^[a-z][a-z'-]*$/i.test(c.word.trim())) ? <button className={`${btn} bg-primary! text-white!`} onClick={()=>navigate('/homework',{state:{fromClassId:info.classId,personalGame:{cards:info.sourceCards,name:contentName}}})}>{en?'Use this material for personal homework / lessons':'이 자료로 맞춤 게임 숙제·개별수업 만들기'}</button> : null}
              <p>
                {en
                  ? "Same content, class and teams. The next game starts a new round; scores are not merged."
                  : "내용·반·팀은 유지합니다. 새 게임은 새 판으로 시작하고 이전 게임 점수는 합산하지 않습니다."}
              </p>
              {GAME_CATALOG.filter(
                (g) =>
                  g.type !== info?.gameType &&
                  info?.sourceCards &&
                  prepareClassroomGame(
                    g.type,
                    info.sourceCards,
                    info.selected?.config.classroomSource?.kind,
                  ),
              ).map((g) => (
                <button
                  key={g.type}
                  className={`${btn} m-1`}
                  disabled={busy || (!hasFullAccess && !isFreeTierGame(g.type))}
                  onClick={() =>
                    void action(() => bridge.current!.switchGame(g.type))
                  }
                >
                  {i18n.t(g.nameKey)}
                </button>
              ))}
            </div>
          )}
          <div
            hidden={panel !== "settings" || !!info?.sharedView}
            className="p-4"
            data-game-existing-settings
          >
            {children}
          </div>
        </dialog>
        {teams && (
          <TeamOrderPanel
            key={roster.map((r) => r.id).join(",")}
            roster={roster}
            fixedTeams={
              info &&
              [
                "gameshowquiz",
                "winlosequiz",
                "connect4",
                "tictactoe",
                "twodice",
                "baskin31",
              ].includes(info.gameType)
                ? 2
                : undefined
            }
            onClose={async () => {
              const next = loadTeamOrder(roster);
              if (
                next.mode === "team" &&
                info?.teamCount !== undefined &&
                next.teamCount !== info.teamCount
              ) {
                if (
                  running &&
                  !window.confirm(
                    en
                      ? "Changing team count starts a new round. Continue?"
                      : "팀 수를 바꾸면 새 판으로 시작합니다. 계속할까요?",
                  )
                )
                  return;
                try {
                  await bridge.current?.configureTeams(next.teamCount);
                  setRunning(false);
                } catch {
                  setError(
                    en
                      ? "Could not save teams. Retry."
                      : "팀 설정 저장 실패. 다시 시도하세요.",
                  );
                  return;
                }
              }
              setShowOrderOn(true);
              window.dispatchEvent(new Event(TEAM_ORDER_EVENT));
              setTurnRevision((n) => n + 1);
              setTeams(false);
            }}
          >
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <button
              className={btn}
              onClick={() => {
                setShowOrderOn(false);
                window.dispatchEvent(new Event(TEAM_ORDER_EVENT));
                setTeams(false);
              }}
            >
              {en
                ? "Free participation (no turns)"
                : "자유 참여 · 차례 없이 진행"}
            </button>
            <p>
              {en
                ? "Exclude for this game session"
                : "이번 진행에서 빠지는 학생"}
            </p>
            {info?.roster.map((r) => (
              <label
                key={r.id}
                className="mr-3 inline-flex min-h-11 items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={absent.includes(r.id)}
                  onChange={(e) =>
                    setAbsent((old) =>
                      e.target.checked
                        ? [...old, r.id]
                        : old.filter((id) => id !== r.id),
                    )
                  }
                />
                {r.label}
              </label>
            ))}
          </TeamOrderPanel>
        )}
      </section>
    </GameWorkspaceContext.Provider>
  );
}

/** Appears inside fullscreen/presented frames where the outer preparation bar is not visible. */
export function GameWorkspaceFrameControls() {
  const workspace = useGameWorkspace();
  const { i18n } = useTranslation();
  if (!workspace) return null;
  const en = i18n.language.startsWith("en");
  return (
    <div className="relative z-30 flex flex-wrap gap-2 bg-white/95 p-2">
      <button className={btn} onClick={() => workspace.open("content")}>
        {en ? "Content / class" : "자료·반"}
      </button>
      <button className={btn} onClick={() => workspace.open("settings")}>
        {en ? "Settings & save" : "설정·저장"}
      </button>
      {workspace.hasSource && <button className={btn} onClick={() => workspace.open('games')}>{en ? 'Another game' : '다른 게임'}</button>}
      <button className={btn} onClick={workspace.running ? workspace.pause : workspace.start}>
        {workspace.running ? (en ? 'Pause' : '잠깐 멈춤') : (en ? "Start / resume" : "시작·이어하기")}
      </button>
    </div>
  );
}
