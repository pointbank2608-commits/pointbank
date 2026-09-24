import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLessonRunner } from '../context/LessonRunnerContext';
import LessonPointsPanel from './LessonPointsPanel';

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
  const { runner, next, prev, exit, isFullscreen, toggleFullscreen } = useLessonRunner();
  const [pointsOpen, setPointsOpen] = useState(false);

  if (!runner) return null;

  const current = runner.steps[runner.stepIndex];

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
    </>
  );
}
