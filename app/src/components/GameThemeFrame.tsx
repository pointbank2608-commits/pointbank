import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenting } from '../context/LessonRunnerContext';
import AccessibleDialog from './AccessibleDialog';
import TeamOrderPanel from './TeamOrderPanel';
import '../gameSkins.css';
import type { GameType, GameItem } from '../lib/types';

interface Props {
  gameType?: GameType;
  className?: string;
  children: ReactNode;
  /**
   * 반 명단(참가자 목록과 무관, 학생 이름). 넘기면 우측 상단에 "팀·순서 정하기" 버튼이
   * 떠서, 이 게임의 단어/문제 내용과는 별개로 학생을 팀으로 나누고 발표 순서를 정하는
   * 패널을 열 수 있다(TeamOrderPanel.tsx) — 결과는 저장하지 않는 진행 보조 도구.
   * 안 넘기거나 명단이 비어 있으면 버튼 자체가 안 보인다.
   */
  roster?: GameItem[];
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

const GamePlayContext = createContext({ fullscreen: false, itemsHidden: false });

export function useGamePlay() {
  return useContext(GamePlayContext);
}

/**
 * 게임 플레이 영역을 감싸서 전체화면·다시하기·되돌리기·팀순서 버튼을 우측 상단에 얹는다.
 * 34개 게임 페이지가 전부 이 컴포넌트로 플레이 영역을 감싸고 있어서, 여기 한 번만 손보면
 * 모든 게임에 동시 적용된다.
 */
export default function GameThemeFrame({ gameType, className, children, onRestart, onUndo, roster }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // 커리큘럼 "수업 시작하기" 중에는 게임이 발표 영역 전체를 채운다 — 이 컴포넌트 자신의 전체화면과
  // 같은 "채우기" 배치·확대 규칙(fill)을 쓰되, 브라우저 전체화면 대신 발표 영역(PresentZoomArea)을
  // absolute inset-0 으로 덮는다(2026-09-25 "수업 시작할 때 게임 화면도 전체 화면에 맞춰줘").
  const presenting = usePresenting();
  const fill = isFullscreen || presenting;
  const [scale, setScale] = useState(1);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [teamOrderOpen, setTeamOrderOpen] = useState(false);
  // 반 전체가 보는 화면(전체화면·발표 중)에선 정답이 미리 보이지 않게 항목 목록을 기본으로 숨긴다.
  const [itemsHidden, setItemsHidden] = useState(presenting);
  const [restartOpen, setRestartOpen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);

  useEffect(() => {
    function onChange() {
      const on = document.fullscreenElement === containerRef.current;
      setIsFullscreen(on);
      if (!on) setScale(1);
      // 전체화면으로 들어가면 반 전체가 보는 화면이 되니 항목 목록을 기본으로 숨긴다(정답이
      // 미리 보이지 않게). 전체화면을 나오면 다시 보이게 — 선생님은 버튼으로 언제든 뒤집을 수 있다.
      setItemsHidden(on);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useLayoutEffect(() => {
    // 전체화면이 아닌 일반 화면에서도, 화면(뷰포트)보다 콘텐츠가 크면 스크롤 없이 한
    // 화면에 다 보이도록 축소한다 — 사용을 어려워하는 선생님이 많아서(스크롤해서
    // 버튼/문제를 찾게 하면 안 됨) "화면에 다 보인다"가 "화면보다 커 보인다"보다 우선.
    // 다만 모바일 폭에서는 그대로 둔다 — 손가락 스크롤은 이미 익숙한 조작이라 억지로
    // 줄이면 글씨만 작아지고 얻는 게 없다.
    const DESKTOP_BREAKPOINT = 768;

    // wrap(.game-fs-scale) 자체를 재는 게 아니라 그 안의 실제 시각 요소들을 잰다. wrap과
    // 그 직계 자식들은 전부 CSS에서 width:100%로 고정해뒀다(tailwind.css
    // `.game-fs-scale > *`) — 게임 내부의 w-full/max-w-[Npx] 같은 상대 크기 클래스가
    // 기준(정해진 부모 폭)을 잃고 0에 가깝게 찌그러지는 걸 막기 위함이다. 다만 그 결과
    // 직계 자식(target) 자신의 offsetWidth는 이제 그 100%(=무대 폭)를 그대로 반영해버려
    // 실제 콘텐츠 크기로 못 쓴다.
    //
    // target의 "직계" 자식만 재던 예전 방식은, 게임 안쪽에 w-full div로 한 번 더 감싼
    // wrapper가 있으면(예: 항목 숨기기 토글이 생기면서 로또 기계·돌림판 안쪽에 폭 안정용
    // w-full wrapper를 추가함) 그 wrapper 자신의 offsetWidth가 이미 무대 폭 그대로라
    // "내용이 이미 꽉 찼다"고 착각해서 확대를 거의 안 하는 버그가 있었다 — 실제 화면엔
    // 작은 게임만 덩그러니 있고 나머지가 텅 비어 보이는 원인. div wrapper는 몇 겹이든
    // 계속 파고들어(비-div 요소, 즉 이미지·svg·버튼·입력창처럼 실제 시각 크기를 가진
    // "진짜 내용물"을 만날 때까지) 그 내용물들의 바운딩 박스 합집합으로 잰다.
    function contentNodesOf(el: HTMLElement): HTMLElement[] {
      const kids = Array.from(el.children).filter((k): k is HTMLElement => k instanceof HTMLElement);
      if (kids.length === 0) return [el];
      const out: HTMLElement[] = [];
      for (const k of kids) {
        if (k.tagName === 'DIV') out.push(...contentNodesOf(k));
        else out.push(k);
      }
      return out;
    }

    // offsetLeft/offsetWidth는 transform 영향을 안 받아서(getBoundingClientRect와 달리)
    // 이미 적용된 scale과 무관하게 안정적으로 잴 수 있다 — 다만 offsetParent 체인이 중간에
    // position:relative 같은 요소를 만나면 ancestor(target)를 그냥 지나쳐버릴 수 있어서,
    // 잠깐 target을 relative로 만들어 체인이 반드시 target에서 멈추게 한다.
    function relLeft(el: HTMLElement, ancestor: HTMLElement): number {
      let x = 0;
      let node: HTMLElement | null = el;
      let hops = 0;
      while (node && node !== ancestor && hops < 50) {
        x += node.offsetLeft;
        node = node.offsetParent as HTMLElement | null;
        hops++;
      }
      return x;
    }

    // 게임 페이지가 게임 컴포넌트 하나만이 아니라 그 옆에 형제 엘리먼트(체크박스, 최근
    // 결과 등)를 나란히 넘길 때도 있어서(예: 돌림판), wrap의 직계 자식이 여러 개일 수
    // 있다 — 폭은 그 중 가장 넓은 자식 기준(전부 같은 폭으로 가운데 정렬되니까), 높이는
    // (.game-fs-scale이 column이라 자연스럽게 위→아래로 쌓이므로) 전부 더한 값을 쓴다.
    function fit() {
      const stage = stageRef.current;
      const wrap = scaleRef.current;
      if (!stage || !wrap) return;

      if (!fill && window.innerWidth < DESKTOP_BREAKPOINT) {
        setScale(1);
        return;
      }

      const availW = stage.clientWidth;
      // 전체화면(·발표 중)에선 스테이지 자체가 채울 영역 전체라 clientHeight가 곧 가용 높이지만,
      // 일반 화면에선 스테이지가 문서 흐름 속 카드일 뿐이라 "뷰포트 아래쪽 끝까지 남은 높이"를
      // 따로 재야 한다(지금 스크롤 위치 기준 — 사용자가 이미 스크롤해서 보고 있는 상태를
      // 쫓아다니며 다시 축소하진 않는다, 새로고침·리사이즈 시점에만 재계산).
      const availH = fill
        ? stage.clientHeight
        : Math.max(240, window.innerHeight - stage.getBoundingClientRect().top - 24);
      const targets = (Array.from(wrap.children) as HTMLElement[]).length > 0 ? Array.from(wrap.children) as HTMLElement[] : [wrap];

      let w = 0;
      let h = 0;
      for (const target of targets) {
        const prevPosition = target.style.position;
        const wasStatic = getComputedStyle(target).position === 'static';
        if (wasStatic) target.style.position = 'relative';

        const nodes = contentNodesOf(target).filter((n) => n.offsetWidth > 0 || n.offsetHeight > 0);
        const kidW =
          nodes.length > 0
            ? Math.max(...nodes.map((n) => relLeft(n, target) + n.offsetWidth)) - Math.min(...nodes.map((n) => relLeft(n, target)))
            : target.offsetWidth;

        if (wasStatic) target.style.position = prevPosition;

        w = Math.max(w, kidW);
        // offsetHeight엔 자기 자신의 margin이 안 들어가는데, 형제끼리 쌓일 때(mt-4 등)
        // 그 margin도 실제로 세로 공간을 차지하므로 같이 더해줘야 총 높이가 안 밀린다.
        const cs = getComputedStyle(target);
        h += target.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
      }

      if (availW < 16 || availH < 16 || w < 16 || h < 16) return;
      // 저장은 "실제로 scaleRef가 렌더링되는 폭"(=무대 폭)으로 한다 — 안(w)은 화면보다
      // 콘텐츠가 얼마나 좁은지 잴 때만 쓰고, 축소 후 문서에 얼마만큼 공간을 예약할지는
      // scaleRef 자체의 폭(availW) 기준이어야 실제로 줄어드는 시각적 크기와 맞아떨어진다.
      setNaturalSize({ w: availW, h });
      const next = Math.min(availW / w, availH / h) * 0.96;
      // 전체화면에선 작은 콘텐츠를 키워서라도 화면을 채우지만(최대 5배), 일반 화면에선
      // 각 게임이 이미 자기 최대 크기를 스스로 정해뒀으므로 "화면보다 크면 줄이기"만
      // 하고 원래 크기보다 더 키우진 않는다(1배 상한).
      setScale(fill ? Math.min(5, Math.max(0.5, next)) : Math.min(1, Math.max(0.5, next)));
    }

    fit();
    const stage = stageRef.current;
    const wrap = scaleRef.current;
    if (!stage || !wrap) return;
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    ro.observe(wrap);
    // wrap의 각 target도 관찰한다 — 예를 들어 전체화면에 막 들어간 시점엔 아직 로그인/권한
    // 정보가 덜 로드돼 "바로 추가" 패널처럼 조건부로 나타나는 내용이 없다가 잠깐 뒤에
    // 나타나는 경우가 있는데, stage/wrap 자신의 크기는 안 바뀌니 ResizeObserver가 그 변화를
    // 못 잡는다 — target을 직접 관찰해야 내용이 늘어나는 순간 다시 재도록 잡을 수 있다.
    for (const target of Array.from(wrap.children) as HTMLElement[]) {
      ro.observe(target);
    }
    // 일반 화면에서는 위쪽에 있는 "게임 소개" 패널을 펼치고 접는 것처럼, 게임 자신의
    // 크기는 그대로인데 화면 속 위치(stage 위쪽 여백)만 바뀌는 경우가 있다 — 그런 경우도
    // 페이지 전체 높이가 같이 바뀌므로 body를 관찰해 다시 재도록 한다. 창 크기 자체가
    // 바뀔 때(회전, 창 리사이즈, 모바일↔데스크탑 폭 경계를 넘나들 때)도 다시 잰다.
    ro.observe(document.body);
    window.addEventListener('resize', fit);
    // 처음 잴 때 웹폰트·그림이 아직 안 불러와져 있으면 안쪽 글자·그림 크기가 나중에 바뀌는데, 그
    // 안쪽 요소들은 관찰 대상이 아니라 다시 재지 않아 배율이 엉뚱하게(예: 0.5) 굳어버렸다(발표 화면에서
    // 발견). 폰트 로드·그림 로드·잠깐 뒤 몇 번 더 잰다.
    const timers = [150, 600, 1500].map((ms) => window.setTimeout(fit, ms));
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (alive) fit();
    });
    wrap.addEventListener('load', fit, true);
    return () => {
      alive = false;
      timers.forEach((id) => window.clearTimeout(id));
      wrap.removeEventListener('load', fit, true);
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [fill]);

  async function toggleFullscreen() {
    setFullscreenError(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen();
      else setFullscreenError(true);
    } catch {
      setFullscreenError(true);
    }
  }

  const fullscreenStyle: CSSProperties = fill
    ? {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--color-background)',
        // 발표 중(브라우저 전체화면이 이 요소가 아닐 때)엔 발표 영역을 통째로 덮는다.
        ...(!isFullscreen ? { position: 'absolute', inset: 0, zIndex: 20 } : {}),
      }
    : {};

  return (
    <GamePlayContext.Provider value={{ fullscreen: fill, itemsHidden }}>
      <div
        ref={containerRef}
        data-game={gameType}
        className={`relative ${gameType ? 'classroom-play' : ''} ${fill ? 'game-fs' : ''} ${className ?? ''}`}
        style={fullscreenStyle}
      >
        <div className="game-play-toolbar relative z-10 mb-4 flex shrink-0 flex-wrap justify-end gap-2 p-2">
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
            <span aria-hidden className="material-symbols-outlined text-[20px]">{itemsHidden ? 'visibility_off' : 'visibility'}</span>
            {itemsHidden ? t('gamePlay.showItems') : t('gamePlay.hideItems')}
          </button>
          {roster && roster.length > 0 && (
            <button
              type="button"
              onClick={() => setTeamOrderOpen(true)}
              title={t('gamePlay.teamOrder')}
              aria-label={t('gamePlay.teamOrder')}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold bg-surface-container-lowest/90 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:bg-surface-container hover:text-primary"
            >
              <span aria-hidden className="material-symbols-outlined text-[20px]">groups</span>
              {t('gamePlay.teamOrder')}
            </button>
          )}
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              title={t('gamePlay.undo')}
              aria-label={t('gamePlay.undo')}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold bg-surface-container-lowest/90 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:bg-surface-container hover:text-primary"
            >
              <span aria-hidden className="material-symbols-outlined text-[20px]">undo</span>
              {t('gamePlay.undo')}
            </button>
          )}
          {onRestart && (
            <button
              type="button"
              onClick={() => setRestartOpen(true)}
              title={t('gamePlay.restart')}
              aria-label={t('gamePlay.restart')}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold bg-surface-container-lowest/90 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:bg-surface-container hover:text-primary"
            >
              <span aria-hidden className="material-symbols-outlined text-[20px]">refresh</span>
              {t('gamePlay.restart')}
            </button>
          )}
          {/* 발표 중엔 진행바의 전체화면 버튼 하나만 쓴다(게임만 따로 전체화면이 되면 진행바가 가려짐). */}
          {!presenting && (
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? t('gamePlay.exitFullscreen') : t('gamePlay.fullscreen')}
              aria-label={isFullscreen ? t('gamePlay.exitFullscreen') : t('gamePlay.fullscreen')}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold bg-surface-container-lowest/90 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:bg-surface-container hover:text-primary"
            >
              <span aria-hidden className="material-symbols-outlined text-[20px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
              {isFullscreen ? t('gamePlay.exitFullscreen') : t('gamePlay.fullscreen')}
            </button>
          )}
        </div>
        {fullscreenError && <p role="alert" className="mb-3 rounded-lg bg-error-container p-3 text-on-error-container">{t('classroomUx.fullscreenError')}</p>}
        {/* Keep the same parent chain so view changes never remount a running game. */}
        <div ref={stageRef} className={fill ? 'game-fs-stage' : undefined}>
          <div
            className={fill ? 'contents' : 'mx-auto'}
            style={!fill && naturalSize.h > 0
              ? { width: naturalSize.w * scale, height: naturalSize.h * scale }
              : undefined}
          >
            <div
              ref={scaleRef}
              className={fill ? 'game-fs-scale' : undefined}
              style={{
                width: fill ? '100%' : naturalSize.w > 0 ? naturalSize.w : '100%',
                transform: `scale(${scale})`,
                transformOrigin: fill ? 'center center' : 'top left',
              }}
            >
              {children}
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
                <button type="button" className="min-h-11 rounded-xl bg-primary px-5 text-on-primary" onClick={() => { setRestartOpen(false); onRestart?.(); }}>{t('gamePlay.restart')}</button>
              </div>
            </div>
          </AccessibleDialog>
        )}
      {teamOrderOpen && roster && (
        <TeamOrderPanel roster={roster} onClose={() => setTeamOrderOpen(false)} />
      )}
      </div>
    </GamePlayContext.Provider>
  );
}
