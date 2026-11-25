import { useAuth } from '../context/AuthContext';
import { recordFreeGamePlay } from '../lib/api';
import {GameTurnProvider,GameTurnDisplay} from './GameTurnDisplay';
import {GameTurnContext} from '../context/GameTurnContext';
import { useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGameWorkspace } from '../context/GameWorkspaceContext';
import { GRAMMAR_GAME_TYPES } from '../lib/grammarGames';
import { instantStart, itemsAlwaysHidden } from '../lib/gamePreparation';
import { GamePlayContext, useGamePlay } from '../context/GamePlayContext';
import { GameWorkspaceFrameControls, GameWorkspaceValidation } from './GameWorkspace';
import GameStartCard from './GameStartCard';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { clearBoardReturn, hasBoardReturn } from '../lib/boardMaterial';
import { usePresenting } from '../context/LessonRunnerContext';
import { useGameEmbed } from '../context/GameEmbedContext';
import AccessibleDialog from './AccessibleDialog';
import TeamOrderPanel from './TeamOrderPanel';
import { PictureWordTurnProvider } from './PictureWordTurn';
import GameHistoryRegion from './GameHistoryRegion';
import GameHistoryButtons from './GameHistoryButtons';
import {GameHistoryBoundary,useGameHistory} from '../context/GameHistoryContext';
import { pictureWordModeKind } from '../lib/pictureWordQuestions';
import { useGameViewportFit } from '../lib/gameViewportFit';
import '../gameSkins.css';
import type { GameTemplate, GameType, GameItem } from '../lib/types';
import { COMMON_SFX, playSfx, setGameSoundOn, useGameSoundOn } from '../lib/gameSfx';
import { ROUND_DONE_EVENT, TEAM_ORDER_EVENT, isAutoTurnOn, isShowOrderOn, loadTeamOrder, saveTeamOrder, setShowOrderOn, type TeamOrderState } from '../lib/teamOrder';

interface Props {
  gameType?: GameType;
  /**
   * 공용 배경만 따로 지정(2026-10-14). 옛 게임 9종은 gameType 을 주면 classroom-play 스타일이 같이 입혀져
   * 모양이 바뀌므로, 배경만 붙이고 싶을 때 이 값을 쓴다.
   */
  bg?: GameType;
  className?: string;
  children: ReactNode;
  /**
   * 반 명단(참가자 목록과 무관, 학생 이름). 넘기면 우측 상단에 "팀·순서 정하기" 버튼이
   * 떠서, 이 게임의 단어/문제 내용과는 별개로 학생을 팀으로 나누고 발표 순서를 정하는
   * 패널을 열 수 있다(TeamOrderPanel.tsx) — 결과는 저장하지 않는 진행 보조 도구.
   * 안 넘기거나 명단이 비어 있으면 버튼 자체가 안 보인다.
   */
  roster?: GameItem[];
  /** Share the class's turn order between the game's own page and lesson play. */
  lessonTurnScope?: string;
  template?: GameTemplate | null;
  /**
   * "다시하기" 버튼을 누르면 호출된다. 게임마다 내부 상태 모양이 다 달라서, 페이지 쪽에서
   * key를 바꿔 게임 컴포넌트를 통째로 다시 마운트시키는 방식으로 구현하는 걸 전제로 한다
   * (예: `<SpinWheel key={roundKey} .../>` + `onRestart={() => setRoundKey((k) => k + 1)}`).
   * 안 넘기면 다시하기 버튼 자체가 안 보인다.
   */
  onRestart?: () => void;
  autoStartForSelection?: boolean;
  /**
   * "되돌리기" 버튼을 누르면 호출된다. 게임마다 되돌릴 수 있는 "한 수"의 의미가 달라서
   * (예: 틱택토는 마지막 칸 표시, 게임쇼 퀴즈는 마지막 정답 판정) 게임 컴포넌트 안에서
   * `forwardRef`로 `undo()`를 노출하고, 페이지에서 그 ref를 그대로 여기 연결하는 걸 전제로
   * 한다. 되돌릴 게 없으면 게임 쪽에서 조용히 무시한다. 안 넘기면 버튼 자체가 안 보인다
   * (턴제로 점수/상태가 누적되는 일부 게임에만 있음 — 대부분은 무작위 1회성이라 해당 없음).
   */
  onUndo?: () => void;
}

/** 자기 장면을 이미 그리는 게임(새 게임·장보기)은 공용 배경을 깔지 않는다 */
const OWN_SCENE: GameType[] = ['balloonpop','wordtrain','wordfishing','sentencerocket','grammardetective','treasurehunt','wordclaw','feedmonster', 'sentencebridge', 'sentencetower', 'sentencesplash', 'shopping', 'treasuredig', 'fourclues', 'catchsentence', 'lastbox', 'mysterybox', 'airport', 'restaurant', 'icecream', 'doctor', 'lightning', 'shufflefind', 'telepathy', 'wordhoops', 'tugofwar'];

/** 글자가 많은 게임은 배경 위에 흰 막을 더 두껍게 덮는다(읽기 쉽게) */
const BG_VEIL: Partial<Record<GameType, number>> = {
  quiz: 0.4, truefalse: 0.4, spellword: 0.35, wordsearch: 0.4, mathgen: 0.4,
  unscramble: 0.35, anagram: 0.3, groupsort: 0.35, rankorder: 0.3, gameshowquiz: 0.3, winlosequiz: 0.3, watermelon: 0.3,
  // 가운데가 어두운 편인 배경(분석: 가운데 평균 밝기 170 이하)은 막을 더 두껍게
  imagequiz: 0.55, crossword: 0.5, typeanswer: 0.5, twodice: 0.4, popcorn: 0.4, passball: 0.35, mazechase: 0.35, matchup: 0.3, labeleddiagram: 0.15,
};

/**
 * 게임 배경(2026-10-14) — /skins/bg/<게임>.webp 가 있으면 게임 화면 뒤에 깐다. 파일이 없으면 아무것도 안 한다
 * (CURSOR_GAME_BACKGROUNDS.md 참고). 있는지는 이미지를 미리 받아 보고 안다.
 */
function useGameBackground(gameType?: GameType): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!gameType || OWN_SCENE.includes(gameType)) {
      setUrl(null);
      return;
    }
    let alive = true;
    const u = `/skins/bg/${gameType}.webp?v=1`;
    const img = new Image();
    img.onload = () => alive && setUrl(u);
    img.onerror = () => alive && setUrl(null);
    img.src = u;
    return () => {
      alive = false;
    };
  }, [gameType]);
  return url;
}

export { useGamePlay } from '../context/GamePlayContext';

export function GameManagement({ children }: { children: ReactNode }) {
  const { itemsHidden } = useGamePlay();
  const workspace = useGameWorkspace();
  if (workspace && (workspace.playing || workspace.fullscreen) && workspace.teacherToolsTarget) return createPortal(<div data-game-management className="rounded-xl border p-3">{children}</div>, workspace.teacherToolsTarget);
  return <div hidden={itemsHidden} data-game-management style={itemsHidden ? { display: 'none' } : { display: 'contents' }}>{children}</div>;
}

/**
 * 게임 플레이 영역을 감싸서 전체화면·다시하기·되돌리기·팀순서 버튼을 우측 상단에 얹는다.
 * 34개 게임 페이지가 전부 이 컴포넌트로 플레이 영역을 감싸고 있어서, 여기 한 번만 손보면
 * 모든 게임에 동시 적용된다.
 */
export default function GameThemeFrame(props: Props) { return <GameHistoryBoundary><GameTurnProvider><GameThemeFrameContent {...props} /></GameTurnProvider></GameHistoryBoundary>; }
function GameThemeFrameContent({ gameType, bg, className, children, onRestart, roster: suppliedRoster, lessonTurnScope, template: suppliedTemplate, autoStartForSelection }: Props) {
  const history=useGameHistory();
  const nativeTurn = useContext(GameTurnContext)?.turn;
  const started = useRef<string | null>(null);

  const workspace = useGameWorkspace();
  const template = suppliedTemplate ?? workspace?.info?.selected;
  const frameGame = gameType ?? bg;
  const pictureModeTemplate = template?.config.pictureWordMode && template.game_type === frameGame && pictureWordModeKind(frameGame) !== null ? template : null;
  const selection = autoStartForSelection ? template?.id ?? '' : '';
  useEffect(() => {
    if (!workspace?.running) {
      if (!workspace?.playing) started.current = null;
      return;
    }
    if (started.current === selection) return;
    started.current = selection;
    containerRef.current?.querySelector<HTMLButtonElement>('[data-initial-game-start]:not(:disabled),[data-initial-game-start-container] button:not(:disabled)')?.click();
  }, [workspace?.running, workspace?.playing, selection]);

  const { t } = useTranslation();
  const catalogGame = workspace?.waitingForSampleStart
    ? GAME_CATALOG.find(game => game.type === workspace.info?.gameType)
    : undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const paused = !!workspace?.playing && !workspace.running;
  useEffect(() => {
    if (!paused || typeof CSSTransition === 'undefined') return;
    // CSS animation-play-state already handles keyframes, but not transitions (e.g. wheel spins).
    const transitions = stageRef.current?.getAnimations({ subtree: true })
      .filter(animation => animation instanceof CSSTransition && animation.playState === 'running') ?? [];
    transitions.forEach(animation => animation.pause());
    return () => {
      transitions.forEach(animation => {
        if (animation.playState === 'paused') animation.play();
      });
    };
  }, [paused]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // 커리큘럼 "수업 시작하기" 중에는 게임이 발표 영역 전체를 채운다 — 이 컴포넌트 자신의 전체화면과
  // 같은 "채우기" 배치·확대 규칙(fill)을 쓰되, 브라우저 전체화면 대신 발표 영역(PresentZoomArea)을
  // absolute inset-0 으로 덮는다(2026-09-25 "수업 시작할 때 게임 화면도 전체 화면에 맞춰줘").
  const presenting = usePresenting();
  const embed = useGameEmbed();
  const activityPreview = !!embed?.preview;
  const { profile, hasFullAccess } = useAuth();
  const visit = useRef<{ scope: string; id: string; recorded: boolean } | null>(null);
  function recordInteraction() {
    if (hasFullAccess || !workspace?.running || workspace.panel || activityPreview || !frameGame ||
        !profile?.free_game_choices?.includes(frameGame) || profile.free_game_choices.length !== 3) return;
    const scope = profile.id + ':' + frameGame;
    if (visit.current?.scope !== scope) visit.current = { scope, id: crypto.randomUUID(), recorded: false };
    const current = visit.current;
    if (current.recorded) return;
    current.recorded = true;
    void recordFreeGamePlay(frameGame, current.id).catch(() => { current.recorded = false; });
  }
  const lessonClassTurns = !!lessonTurnScope && (presenting || (!!embed && !embed.slideId && !activityPreview));
  const turnScope = lessonClassTurns ? lessonTurnScope : '';
  const roster = lessonClassTurns ? suppliedRoster : (workspace?.roster ?? suppliedRoster);
  const soundOn = useGameSoundOn();
  // 아이폰 사파리는 웹 페이지 요소의 전체화면(Fullscreen API)을 지원하지 않는다(아이패드·컴퓨터만) — 그럴 땐
  // 오류를 띄우는 대신 앱 안에서 화면 전체를 덮는 "화면 가득" 모드로 대신한다(2026-09-27).
  const [pseudoFs, setPseudoFs] = useState(false);
  const fullOn = isFullscreen || pseudoFs;
  const fill = fullOn || presenting || (!!workspace?.playing && !embed?.slideId);
  const reportFullscreen=workspace?.setFullscreen;
  useEffect(()=>{reportFullscreen?.(fullOn);return ()=>reportFullscreen?.(false);},[fullOn,reportFullscreen]);
  const [teamOrderOpen, setTeamOrderOpen] = useState(false);
  // 순서 보여주기: 팀·순서 정하기에서 정한 순서를 게임 위에 한 줄로 띄우고 지금 차례를 표시한다. 끄면 아무나.
  const [showOrder, setShowOrder] = useState(isShowOrderOn);
  const [teamOrder, setTeamOrder] = useState<TeamOrderState | null>(null);
  const rosterKey = (roster ?? []).map((r) => r.id).join(',');
  useEffect(() => {
    if (!roster || roster.length === 0) {
      setTeamOrder(null);
      return;
    }
    const read = () => { setTeamOrder(loadTeamOrder(roster, turnScope)); setShowOrder(isShowOrderOn()); };
    read();
    window.addEventListener(TEAM_ORDER_EVENT, read);
    return () => window.removeEventListener(TEAM_ORDER_EVENT, read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey, turnScope]);
  function setTurn(turn: number) {
    if (!roster || !teamOrder || teamOrder.order.length === 0) return;
    const n = teamOrder.order.length;
    saveTeamOrder(roster, { ...teamOrder, turn: ((turn % n) + n) % n }, turnScope);
  }
  useEffect(() => {
    if (!lessonClassTurns || !roster?.length) return;
    const advance = () => {
      if (!isShowOrderOn() || !isAutoTurnOn()) return;
      const order = loadTeamOrder(roster, turnScope);
      saveTeamOrder(roster, { ...order, turn: (order.turn + 1) % order.order.length }, turnScope);
    };
    window.addEventListener(ROUND_DONE_EVENT, advance);
    return () => window.removeEventListener(ROUND_DONE_EVENT, advance);
  }, [lessonClassTurns, roster, turnScope]);
  // 반 전체가 보는 화면(전체화면·발표 중)에선 정답이 미리 보이지 않게 항목 목록을 기본으로 숨긴다.
  const [itemsHidden, setItemsHidden] = useState(presenting);
  // 새 도구줄을 쓰는 게임은 들어오자마자 시작되므로(playing) 항목을 자동으로 숨기면 선생님이 항목을 못 고친다 — 도구줄의 "항목 숨기기"로 직접 숨긴다.
  const playHides = !!workspace?.playing && !(workspace.info && instantStart(workspace.info.gameType));
  useEffect(() => { if (playHides) setItemsHidden(true); }, [playHides]);
  const lockHidden = !!workspace?.info && itemsAlwaysHidden(workspace.info.gameType);
  const [restartOpen, setRestartOpen] = useState(false);
  const bgType = bg ?? (gameType === 'twodice' ? undefined : gameType);
  const bgUrl = useGameBackground(bgType);
  const veil = (bgType && BG_VEIL[bgType]) ?? 0.2;
  const [fullscreenError, setFullscreenError] = useState(false);

  useEffect(() => {
    function onChange() {
      const on = document.fullscreenElement === containerRef.current;
      setIsFullscreen(on);
      // 전체화면으로 들어가면 반 전체가 보는 화면이 되니 항목 목록을 기본으로 숨긴다(정답이
      // 미리 보이지 않게). 전체화면을 나오면 다시 보이게 — 선생님은 버튼으로 언제든 뒤집을 수 있다.
      setItemsHidden(on || playHides || presenting);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [workspace?.playing, presenting]);

  useEffect(() => {
    if (!isFullscreen) return;
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      event.stopPropagation();
      if (document.fullscreenElement === containerRef.current) void document.exitFullscreen().catch(()=>setFullscreenError(true));
    };
    document.addEventListener('keydown',exitOnEscape,true);
    return ()=>document.removeEventListener('keydown',exitOnEscape,true);
  },[isFullscreen]);

  useGameViewportFit({stage: stageRef, canvas: scaleRef, backdrop: frameGame && OWN_SCENE.includes(frameGame) ? backdropRef : undefined, fill, identity: frameGame});

  function enterPseudo() {
    setPseudoFs(true);
    setItemsHidden(true);
  }

  async function toggleFullscreen() {
    setFullscreenError(false);
    if (pseudoFs) {
      setPseudoFs(false);
      setItemsHidden(playHides || presenting);
      return;
    }
    try {
      if (!fullOn && workspace?.panel) workspace.open(null);
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen();
      else enterPseudo();
    } catch {
      if (fullOn) setFullscreenError(true);
      else enterPseudo();
    }
  }

  // 화면 가득 모드: 뒤 페이지가 스크롤되지 않게, Esc 로도 나가게
  useEffect(() => {
    if (!pseudoFs) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) {
        setPseudoFs(false);
        setItemsHidden(playHides || presenting);
        }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [pseudoFs, workspace?.playing, presenting]);

  useEffect(()=>{
    const exit = () => {
      if(document.fullscreenElement===containerRef.current) void document.exitFullscreen().catch(()=>{});
      setPseudoFs(false);
    };
    window.addEventListener('classbank:exit-game-fullscreen',exit);
    return ()=>window.removeEventListener('classbank:exit-game-fullscreen',exit);
  },[]);

  const fullscreenStyle: CSSProperties = fill
    ? {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--color-background)',
        // 화면 가득(아이폰): 화면 전체를 고정으로 덮는다. 발표 중(브라우저 전체화면이 이 요소가 아닐 때)엔
        // 발표 영역을 통째로 덮는다.
        ...(pseudoFs
          ? { position: 'fixed', inset: 0, zIndex: 60, height: '100dvh' }
          : !isFullscreen
            ? { position: 'absolute', inset: 0, zIndex: 20 }
            : {}),
      }
    : // 돌림판처럼 도는 게임은 네모 상자의 모서리가 옆으로 삐져나가 페이지 폭이 계속 바뀌었다 — 아이폰 사파리가
      // 그 폭에 맞춰 화면을 확대·축소해서 돌릴 때 게임이 커졌다 작아졌다 흔들렸다(2026-09-27). 옆으로 삐져나간
      // 부분만 잘라 페이지 폭을 고정한다(위아래 그림자는 그대로).
      { overflowX: 'clip' };

  const toolbar = (
<div className="game-play-toolbar relative z-10 mb-4 flex shrink-0 flex-wrap justify-end gap-2 p-2">
          <GameHistoryButtons/>
          <button
            type="button"
            onClick={() => setItemsHidden((v) => !v)}
            title={itemsHidden ? t('gamePlay.showItems') : t('gamePlay.hideItems')}
            aria-label={itemsHidden ? t('gamePlay.showItems') : t('gamePlay.hideItems')}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold shadow-sm backdrop-blur transition-colors ${
              itemsHidden
                ? 'bg-primary text-on-primary hover:bg-primary-container'
                : 'bg-surface-container-lowest/90 text-on-surface-variant hover:bg-surface-container hover:text-primary'
            }`}
          >
            {itemsHidden ? t('gamePlay.showItems') : t('gamePlay.hideItems')}
          </button>
          {!lessonClassTurns && roster && roster.length > 0 && (
            <button
              type="button"
              onClick={() => workspace ? workspace.openTeams() : setTeamOrderOpen(true)}
              title={t('gamePlay.teamOrder')}
              aria-label={t('gamePlay.teamOrder')}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold bg-surface-container-lowest/90 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:bg-surface-container hover:text-primary"
            >
              {t('gamePlay.teamOrder')}
            </button>
          )}
          {!lessonClassTurns && roster && roster.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowOrderOn(!showOrder);
                setShowOrder(!showOrder);
              }}
              title={showOrder ? t('gamePlay.hideOrder') : t('gamePlay.showOrder')}
              aria-pressed={showOrder}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold shadow-sm backdrop-blur transition-colors ${
                showOrder
                  ? 'bg-primary text-on-primary hover:bg-primary-container'
                  : 'bg-surface-container-lowest/90 text-on-surface-variant hover:bg-surface-container hover:text-primary'
              }`}
            >
              {showOrder ? t('gamePlay.hideOrder') : t('gamePlay.showOrder')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setGameSoundOn(!soundOn)}
            title={soundOn ? t('gamePlay.soundOff') : t('gamePlay.soundOn')}
            aria-label={soundOn ? t('gamePlay.soundOff') : t('gamePlay.soundOn')}
            aria-pressed={!soundOn}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold shadow-sm backdrop-blur transition-colors ${
              soundOn
                ? 'bg-surface-container-lowest/90 text-on-surface-variant hover:bg-surface-container hover:text-primary'
                : 'bg-primary text-on-primary hover:bg-primary-container'
            }`}
          >
            {soundOn ? t('gamePlay.soundLabelOn') : t('gamePlay.soundLabelOff')}
          </button>
          {onRestart && (
            <button
              type="button"
              onClick={() => setRestartOpen(true)}
              title={t('gamePlay.restart')}
              aria-label={t('gamePlay.restart')}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold bg-surface-container-lowest/90 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:bg-surface-container hover:text-primary"
            >
              {t('gamePlay.restart')}
            </button>
          )}
          {/* 발표 중엔 진행바의 전체화면 버튼 하나만 쓴다(게임만 따로 전체화면이 되면 진행바가 가려짐). */}
          {!presenting && (
            <button
              type="button"
              onClick={toggleFullscreen}
              title={fullOn ? t('gamePlay.exitFullscreen') : t('gamePlay.fullscreen')}
              aria-label={fullOn ? t('gamePlay.exitFullscreen') : t('gamePlay.fullscreen')}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold bg-surface-container-lowest/90 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:bg-surface-container hover:text-primary"
            >
              {fullOn ? t('gamePlay.exitFullscreen') : t('gamePlay.fullscreen')}
            </button>
          )}
        </div>
  );
  const frame = (
    <GamePlayContext.Provider value={{ fullscreen: fill, fullscreenControl: { active: fullOn, toggle: presenting ? undefined : toggleFullscreen }, itemsHidden: itemsHidden || lockHidden, itemsLocked: lockHidden, toggleItems: () => { if (!lockHidden) setItemsHidden((v) => !v); } }}>
      <div
        ref={containerRef}
        data-game={gameType ?? bg}
        data-game-fullscreen={fullOn ? "true" : "false"}
        data-game-view={presenting ? "presentation" : fullOn ? "fullscreen" : "normal"}
        className={`relative ${gameType ? 'classroom-play' : ''} ${fill ? 'game-fs' : ''} ${className ?? ''}`}
        style={fullscreenStyle}
      >
        {fullOn && !presenting && hasBoardReturn() && (
          <button
            type="button"
            data-board-return-in-game
            className="no-print fixed bottom-4 left-4 z-[60] min-h-11 rounded-full bg-primary px-5 text-base font-bold text-white shadow-xl focus-visible:outline-4 focus-visible:outline-white"
            onClick={() => {
              clearBoardReturn();
              if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
              navigate('/whiteboard');
            }}
          >
            {t('whiteboard.returnPill')}
          </button>
        )}
        {workspace && <GameWorkspaceFrameControls participants={!!gameType && GRAMMAR_GAME_TYPES.includes(gameType as never)} onRestart={onRestart ? () => setRestartOpen(true) : undefined} fullscreen={fullOn} presenting={presenting} onFullscreen={()=>void toggleFullscreen()} onExitFullscreen={()=>void toggleFullscreen()} />}
        <div ref={backdropRef} aria-hidden="true" data-game-backdrop className="pointer-events-none absolute inset-0 z-0" style={{borderRadius: 'inherit', backgroundSize: 'cover', backgroundPosition: 'center'}} />
        {bgUrl && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              borderRadius: 'inherit',
              backgroundImage: `linear-gradient(rgba(255,252,243,${veil}), rgba(255,252,243,${veil})), url(${bgUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        {!activityPreview && (workspace ? workspace.teacherToolsTarget ? createPortal(toolbar, workspace.teacherToolsTarget) : null : toolbar)}
        {lessonClassTurns && !!roster?.length && <div className="relative z-10 mb-2 flex shrink-0 flex-wrap gap-2" data-play-controls>
          <button type="button" className="min-h-11 rounded-xl border border-outline-variant bg-white px-3 font-bold" onClick={() => setTeamOrderOpen(true)}>{t('gamePlay.teamOrder')}</button>
          <button type="button" className="min-h-11 rounded-xl border border-outline-variant bg-white px-3 font-bold" onClick={() => setShowOrderOn(!showOrder)}>{t(showOrder ? 'gamePlay.hideOrder' : 'gamePlay.showOrder')}</button>
        </div>}
        {gameType !== 'lightning' && (lessonClassTurns || (!nativeTurn && !workspace)) && showOrder && roster && teamOrder && teamOrder.order.length > 0 && (
          <div data-class-turn-strip className="game-order-strip relative z-10 mb-3 flex shrink-0 items-center gap-2 rounded-2xl bg-surface-container-lowest/95 px-2 py-2 shadow-sm">
            <button
              type="button"
              onClick={() => setTurn(teamOrder.turn - 1)}
              aria-label={t('gamePlay.prevTurn')}
              title={t('gamePlay.prevTurn')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container"
            >
              <span aria-hidden className="material-symbols-outlined">chevron_left</span>
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
              {teamOrder.order.map((id, i) => {
                const isTeam = teamOrder.mode === 'team';
                const teamIndex = isTeam ? Number(id.split('-')[1]) : -1;
                const label = isTeam ? t('teamOrder.teamLabel', { n: teamIndex + 1 }) : (roster.find((r) => r.id === id)?.label ?? '');
                const members = isTeam ? roster.filter((r) => (teamOrder.teamOf[r.id] ?? 0) === teamIndex).map((r) => r.label).join(', ') : '';
                const now = i === teamOrder.turn;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTurn(i)}
                    title={members || label}
                    aria-current={now ? 'step' : undefined}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-all ${
                      now ? 'scale-110 bg-warm-yellow text-deep-navy shadow-md ring-2 ring-deep-navy/20' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${now ? 'bg-deep-navy text-white' : 'bg-surface-container-lowest text-on-surface-variant'}`}>{i + 1}</span>
                    {label}
                    {isTeam && now && members && <span className="font-medium opacity-80">· {members}</span>}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setTurn(teamOrder.turn + 1)}
              className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-primary px-4 text-sm font-bold text-on-primary shadow-sm hover:bg-primary-container"
            >
              {t('gamePlay.nextTurn')}
              <span aria-hidden className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        )}
        {gameType !== 'twodice' && !(lessonClassTurns && showOrder && teamOrder?.order.length) && <GameTurnDisplay />}
        {fullscreenError && <p role="alert" className="mb-3 rounded-lg bg-error-container p-3 text-on-error-container">{t('classroomUx.fullscreenError')}</p>}
        {/* Keep the same parent chain so view changes never remount a running game. */}
        <div className="relative flex min-h-0 flex-1 flex-col" data-game-preview>
        <GameWorkspaceValidation />
        {catalogGame && workspace?.canStart && !workspace.panel && (
          <GameStartCard name={t(catalogGame.nameKey)} description={t(catalogGame.descKey)} onStart={workspace.start} />
        )}
        {paused && !workspace?.panel && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-deep-navy/25">
            <p role="status" className="rounded-2xl bg-white px-6 py-3 text-xl font-bold text-deep-navy shadow-lg">{t('teacherGame.paused')}</p>
          </div>
        )}
        <div ref={stageRef} onPointerDownCapture={recordInteraction} onKeyDownCapture={event => { if (event.key !== 'Tab' && !event.repeat) recordInteraction(); }} data-game-stage data-game-fit="contain" inert={!!workspace && (!workspace.running || !!workspace.panel)} className="game-fs-stage game-fit-stage" style={{position: 'relative', zIndex: 1}}>
          <div className="game-viewport-box">
            <div ref={scaleRef} data-game-canvas className="game-fs-scale game-fit-canvas">
              <GameHistoryRegion containerRef={scaleRef} identity={`${frameGame}:${template?.id??''}:${JSON.stringify(template?.config)}:${JSON.stringify(template?.items)}`}><PictureWordTurnProvider key={pictureModeTemplate?.id ?? 'standard'} config={pictureModeTemplate?.config}>{children}</PictureWordTurnProvider></GameHistoryRegion>
            </div>
          </div>
        </div>
        </div>
        {restartOpen && (
          <AccessibleDialog label={t('classroomUx.restartTitle')} onClose={() => setRestartOpen(false)}>
            <div className="p-6">
              <h2 className="text-xl font-bold text-deep-navy">{t('classroomUx.restartTitle')}</h2>
              <p className="mt-3 text-on-surface-variant">{t('classroomUx.restartHint')}</p>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button autoFocus type="button" className="min-h-11 rounded-xl border border-outline-variant px-5" onClick={() => setRestartOpen(false)}>{t('classroomUx.keepPlaying')}</button>
                <button type="button" className="min-h-11 rounded-xl bg-primary px-5 text-on-primary" onClick={() => { setRestartOpen(false); history?.clear(); onRestart?.(); playSfx(COMMON_SFX.start); }}>{t('gamePlay.restart')}</button>
              </div>
            </div>
          </AccessibleDialog>
        )}
      {teamOrderOpen && roster && (
        <TeamOrderPanel roster={roster} scope={turnScope} onApply={lessonClassTurns ? () => setShowOrderOn(true) : undefined} onClose={() => {setTeamOrderOpen(false);history?.clear();}} />
      )}
      </div>
    </GamePlayContext.Provider>
  );
  return workspace?.stage ? createPortal(frame, workspace.stage) : workspace ? null : frame;
}
