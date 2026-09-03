import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getGameTheme } from '../lib/gameThemes';

interface Props {
  themeId?: string | null;
  className?: string;
  children: ReactNode;
  /**
   * "다시하기" 버튼을 누르면 호출된다. 게임마다 내부 상태 모양이 다 달라서, 페이지 쪽에서
   * key를 바꿔 게임 컴포넌트를 통째로 다시 마운트시키는 방식으로 구현하는 걸 전제로 한다
   * (예: `<SpinWheel key={roundKey} .../>` + `onRestart={() => setRoundKey((k) => k + 1)}`).
   * 안 넘기면 다시하기 버튼 자체가 안 보인다.
   */
  onRestart?: () => void;
  /**
   * "되돌리기" 버튼을 누르면 호출된다. 게임마다 되돌릴 수 있는 "한 수"의 의미가 달라서
   * (예: 틱택토는 마지막 칸 표시, 게임쇼 퀴즈는 마지막 정답 판정) 게임 컴포넌트 안에서
   * `forwardRef`로 `undo()`를 노출하고, 페이지에서 그 ref를 그대로 여기 연결하는 걸 전제로
   * 한다. 되돌릴 게 없으면 게임 쪽에서 조용히 무시한다. 안 넘기면 버튼 자체가 안 보인다
   * (턴제로 점수/상태가 누적되는 일부 게임에만 있음 — 대부분은 무작위 1회성이라 해당 없음).
   */
  onUndo?: () => void;
}

const GamePlayContext = createContext({ fullscreen: false });

export function useGamePlay() {
  return useContext(GamePlayContext);
}

/**
 * 게임 플레이 영역을 감싸서 선택된 테마를 입히고, 전체화면·다시하기 버튼을 우측 상단에
 * 얹는다. 34개 게임 페이지가 전부 이 컴포넌트로 플레이 영역을 감싸고 있어서, 여기 한 번만
 * 손보면 전체화면/다시하기가 모든 게임에 동시 적용된다.
 */
export default function GameThemeFrame({ themeId, className, children, onRestart, onUndo }: Props) {
  const { t } = useTranslation();
  const theme = getGameTheme(themeId);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function onChange() {
      const on = document.fullscreenElement === containerRef.current;
      setIsFullscreen(on);
      if (!on) setScale(1);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useLayoutEffect(() => {
    if (!isFullscreen) return;

    // wrap 자체를 재는 게 아니라 그 안의 실제 게임 루트(children 이 그리는 첫 엘리먼트)를
    // 잰다. wrap 을 shrink-to-fit(width:fit-content)으로 재려고 하면 게임 내부의
    // w-full/max-w-[Npx] 같은 상대 크기 클래스들이 기준을 잃고 찌그러지는 문제가 있었다 —
    // wrap 은 무대(stage) 폭 100%를 그대로 주고, 그 안에서 게임이 스스로 정한 자연스러운
    // 크기(offsetWidth/Height, transform 영향 안 받음)를 읽는 게 안전하다.
    function fit() {
      const stage = stageRef.current;
      const wrap = scaleRef.current;
      if (!stage || !wrap) return;
      const target = (wrap.firstElementChild as HTMLElement | null) ?? wrap;
      const availW = stage.clientWidth;
      const availH = stage.clientHeight;
      const w = target.offsetWidth;
      const h = target.offsetHeight;
      if (availW < 16 || availH < 16 || w < 16 || h < 16) return;
      const next = Math.min(availW / w, availH / h) * 0.96;
      setScale(Math.min(5, Math.max(0.5, next)));
    }

    fit();
    const stage = stageRef.current;
    const wrap = scaleRef.current;
    if (!stage || !wrap) return;
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [isFullscreen]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen().catch(() => {});
    }
  }

  const fullscreenStyle: CSSProperties = isFullscreen
    ? {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--color-background)',
      }
    : {};

  return (
    <GamePlayContext.Provider value={{ fullscreen: isFullscreen }}>
      <div
        ref={containerRef}
        className={`relative ${isFullscreen ? 'game-fs' : ''} ${className ?? ''}`}
        style={{ ...(theme?.colors as CSSProperties | undefined), ...fullscreenStyle }}
      >
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              title={t('gamePlay.undo')}
              aria-label={t('gamePlay.undo')}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:bg-surface-container hover:text-primary"
            >
              <span className="material-symbols-outlined text-[20px]">undo</span>
            </button>
          )}
          {onRestart && (
            <button
              type="button"
              onClick={onRestart}
              title={t('gamePlay.restart')}
              aria-label={t('gamePlay.restart')}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:bg-surface-container hover:text-primary"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? t('gamePlay.exitFullscreen') : t('gamePlay.fullscreen')}
            aria-label={isFullscreen ? t('gamePlay.exitFullscreen') : t('gamePlay.fullscreen')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:bg-surface-container hover:text-primary"
          >
            <span className="material-symbols-outlined text-[20px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
        </div>
        {isFullscreen ? (
          <div ref={stageRef} className="game-fs-stage">
            <div
              ref={scaleRef}
              className="game-fs-scale"
              style={{ transform: `scale(${scale})` }}
            >
              {children}
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </GamePlayContext.Provider>
  );
}
