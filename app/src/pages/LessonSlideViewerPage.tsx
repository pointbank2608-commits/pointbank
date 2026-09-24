import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import YoutubeShadowingPlayer from '../components/YoutubeShadowingPlayer';
import { useLessonRunner } from '../context/LessonRunnerContext';
import { useToast } from '../context/ToastContext';
import { fetchCurriculumLessonById } from '../lib/api';
import { effectiveSlides } from '../lib/lessonSlides';
import type { CurriculumLesson } from '../lib/types';

/**
 * "이미지/영상" 슬라이드의 실제 화면. 단계 이동(◀ ▶)·풀스크린은 AppLayout에 항상 떠 있는
 * LessonRunnerBar가 담당하므로, 여기서는 이 슬라이드 하나만 꽉 채워 보여주면 된다.
 * 게임 슬라이드는 이 페이지를 거치지 않고 그 게임의 실제 라우트로 바로 이동한다.
 */
export default function LessonSlideViewerPage() {
  const { t } = useTranslation();
  const { id, slideId } = useParams<{ id: string; slideId: string }>();
  const { notify } = useToast();
  const { runner, isFullscreen } = useLessonRunner();
  // AppLayout.tsx 의 isPresenting 조건(runner && isFullscreen)과 반드시 같아야 한다 — 그래야
  // 부모가 실제로 h-[100dvh] 진짜 높이를 주는 경우에만 이쪽도 h-full/max-h-full 을 쓴다.
  const isPresenting = runner != null && isFullscreen;

  const [lesson, setLesson] = useState<CurriculumLesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchCurriculumLessonById(id)
      .then(setLesson)
      .catch((err) => notify(err instanceof Error ? err.message : String(err), 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="font-body-md text-body-md text-on-surface-variant">{t('common.loading')}</div>;
  }
  if (!lesson) {
    return (
      <div className="space-y-4">
        <div className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.play.notFound')}</div>
        <Link to="/curriculum" className="font-label-md text-label-md text-primary hover:underline">
          {t('curriculum.play.backToList')}
        </Link>
      </div>
    );
  }

  const slide = effectiveSlides(lesson).find((s) => s.id === slideId);
  if (!slide || slide.kind === 'game' || slide.kind === 'material') {
    return (
      <div className="space-y-4">
        <div className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.play.notFound')}</div>
        <Link to="/curriculum" className="font-label-md text-label-md text-primary hover:underline">
          {t('curriculum.play.backToList')}
        </Link>
      </div>
    );
  }

  if (slide.kind === 'video') {
    return (
      <div className="space-y-4">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
          {lesson.name}
        </h2>
        <YoutubeShadowingPlayer videoUrl={slide.videoUrl} />
      </div>
    );
  }

  // AppLayout이 진짜 전체화면일 때(isPresenting)만 사이드바·여백 없이 h-[100dvh] 를 그대로 주므로,
  // 그때는 이 래퍼도 h-full 로 그 높이를 다 채우고 이미지는 max-h-full 로 그 안에서 최대한 크게.
  // 평소(전체화면 아님)엔 부모 높이가 콘텐츠에 따라 달라져 %가 의미 없으므로 기존 vh 값을 그대로 쓴다.
  return (
    <div className={isPresenting ? 'flex h-full items-center justify-center' : 'flex min-h-[70vh] items-center justify-center'}>
      <img
        src={slide.imageUrl}
        alt=""
        className={
          isPresenting
            ? 'max-h-full max-w-full rounded-xl object-contain shadow-[0_8px_28px_rgba(0,0,0,0.15)]'
            : 'max-h-[80vh] max-w-full rounded-xl object-contain shadow-[0_8px_28px_rgba(0,0,0,0.15)]'
        }
      />
    </div>
  );
}
