import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import YoutubeShadowingPlayer from '../components/YoutubeShadowingPlayer';
import { useToast } from '../context/ToastContext';
import { fetchCurriculumLessonById } from '../lib/api';
import type { CurriculumLesson } from '../lib/types';

/**
 * "영상·쉐도잉" 단계의 실제 화면. 단계 이동(◀ ▶)은 AppLayout에 항상 떠 있는
 * LessonRunnerBar가 담당하므로, 여기서는 이 레슨의 영상만 보여주면 된다.
 */
export default function LessonPlayerPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { notify } = useToast();

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

  return (
    <div className="space-y-4">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {lesson.name}
      </h2>
      {lesson.video_url ? (
        <YoutubeShadowingPlayer videoUrl={lesson.video_url} />
      ) : (
        <div className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.player.invalidUrl')}</div>
      )}
    </div>
  );
}
