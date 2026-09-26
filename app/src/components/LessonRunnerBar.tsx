import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRESENT_ZOOM_IDENTITY, PRESENT_ZOOM_MAX, PRESENT_ZOOM_MIN, useLessonRunner } from '../context/LessonRunnerContext';
import LessonPointsPanel from './LessonPointsPanel';
import LessonAnnotationLayer from './LessonAnnotationLayer';
import { PRESENT_FIT_EVENT, zoomAt } from './PresentZoomArea';

/**
 * "슬라이드 쇼 진행바" — 레슨 러너가 켜져 있는 동안 AppLayout 안에서 화면이 어디로 이동하든
 * (게임 페이지, 워크시트 페이지, 영상 페이지 전부) 계속 떠 있는 상시 바. PPT의 슬라이드 쇼
 * 하단 컨트롤과 같은 역할 — ◀ ▶ 로 다음/이전 실제 화면으로 이동만 시키고, 그 화면 자체는
 * 평소와 똑같이(단어장 담기 포함) 그대로 쓰면 된다.
 *
 * 풀스크린 토글은 슬라이드쇼 전체에 딱 하나만 여기 둔다(게임 슬라이드마다 GameThemeFrame이
 * 갖고 있는 개별 풀스크린 버튼과는 별개) — document.documentElement 를 풀스크린으로 올리므로
 * 슬라이드가 이미지든 영상이든 게임 라우트로 넘어가든 브라우저 레벨 상태라 그대로 유지된다.
 * 매 슬라이드마다 다시 눌러야 하면 캔바 발표 모드의 매끄러운 느낌과 어긋난다.
 */
export default function LessonRunnerBar() {
  const { t } = useTranslation();
  const { runner, next, prev, exit, isFullscreen, toggleFullscreen, zoom, setZoom } = useLessonRunner();

  // 버튼 확대·축소는 화면 가운데를 기준으로.
  function zoomBy(factor: number) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setZoom((z) => zoomAt(z, z.scale * factor, cx, cy));
  }
  const [pointsOpen, setPointsOpen] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(false);

  useEffect(() => {
    setAnnotationOpen(false);
  }, [runner?.stepIndex]);

  if (!runner) return null;

  const current = runner.steps[runner.stepIndex];
  const canAnnotate = current.kind === 'image' || current.kind === 'canvas' || current.kind === 'grammar' || current.kind === 'reading' || current.kind === 'web' || current.path === '/materials/worksheet';

  return (
    <>
    <div className="no-print sticky top-0 z-30 flex items-center gap-3 bg-deep-navy px-4 py-2.5 text-white shadow-md md:pl-[calc(1rem)]">
      <span className="material-symbols-outlined text-[20px] shrink-0">{current.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-label-md text-label-md font-bold">{runner.lessonName}</div>
        <div className="truncate font-caption text-caption text-white/75">{current.label}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          disabled={runner.stepIndex === 0}
          onClick={prev}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-30"
          aria-label={t('curriculum.play.prev')}
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <span className="font-caption text-caption tabular-nums text-white/90">
          {runner.stepIndex + 1} / {runner.steps.length}
        </span>
        <button
          type="button"
          disabled={runner.stepIndex === runner.steps.length - 1}
          onClick={next}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-30"
          aria-label={t('curriculum.play.next')}
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>
      {runner.classId && (
        <button
          type="button"
          onClick={() => setPointsOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-warm-yellow px-3 py-1.5 font-label-md text-label-md text-deep-navy transition-opacity hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">payments</span>
          <span className="hidden sm:inline">{t('curriculum.play.pointsButton')}</span>
        </button>
      )}
      {canAnnotate && (
        <button
          type="button"
          onClick={() => setAnnotationOpen((open) => !open)}
          className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 transition-colors ${annotationOpen ? 'bg-white text-deep-navy' : 'hover:bg-white/15'}`}
          aria-label={t('curriculum.play.annotation')}
          aria-pressed={annotationOpen}
        >
          <span className="material-symbols-outlined text-[20px]">draw</span>
          <span className="hidden sm:inline font-label-md text-label-md">{t('curriculum.play.annotation')}</span>
        </button>
      )}
      <div className="flex shrink-0 items-center rounded-full bg-white/10">
        <button
          type="button"
          disabled={zoom.scale <= PRESENT_ZOOM_MIN}
          onClick={() => zoomBy(1 / 1.25)}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-30"
          aria-label={t('curriculum.play.zoomOut')}
          title={t('curriculum.play.zoomOut')}
        >
          <span className="material-symbols-outlined text-[20px]">zoom_out</span>
        </button>
        <button
          type="button"
          onClick={() => setZoom(PRESENT_ZOOM_IDENTITY)}
          className="min-w-[3rem] rounded-full px-1 font-caption text-caption tabular-nums text-white/90 hover:bg-white/15"
          aria-label={t('curriculum.play.zoomReset')}
          title={t('curriculum.play.zoomHint')}
        >
          {Math.round(zoom.scale * 100)}%
        </button>
        <button
          type="button"
          disabled={zoom.scale >= PRESENT_ZOOM_MAX}
          onClick={() => zoomBy(1.25)}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-30"
          aria-label={t('curriculum.play.zoomIn')}
          title={t('curriculum.play.zoomIn')}
        >
          <span className="material-symbols-outlined text-[20px]">zoom_in</span>
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(PRESENT_FIT_EVENT))}
          className="flex h-8 items-center gap-1 rounded-full px-2 transition-colors hover:bg-white/15"
          aria-label={t('curriculum.play.fitScreen')}
          title={t('curriculum.play.fitScreenHint')}
        >
          <span className="material-symbols-outlined text-[20px]">fit_screen</span>
          <span className="hidden font-caption text-caption lg:inline">{t('curriculum.play.fitScreen')}</span>
        </button>
      </div>
      <button
        type="button"
        onClick={toggleFullscreen}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/15"
        aria-label={t(isFullscreen ? 'curriculum.play.exitFullscreen' : 'curriculum.play.enterFullscreen')}
      >
        <span className="material-symbols-outlined text-[20px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
      </button>
      <button
        type="button"
        onClick={exit}
        className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 font-label-md text-label-md transition-colors hover:bg-white/20"
      >
        {t('curriculum.play.finish')}
      </button>
    </div>
    {pointsOpen && runner.classId && (
      <LessonPointsPanel classId={runner.classId} onClose={() => setPointsOpen(false)} />
    )}
    {annotationOpen && canAnnotate && (
      <LessonAnnotationLayer key={`${runner.lessonId}:${runner.stepIndex}`} onClose={() => setAnnotationOpen(false)} />
    )}
    </>
  );
}
