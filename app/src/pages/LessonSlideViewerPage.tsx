import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import LessonSlideContent from '../components/LessonSlideContent';
import { useAuth } from '../context/AuthContext';
import { useLessonRunner, usePresenting } from '../context/LessonRunnerContext';
import { useToast } from '../context/ToastContext';
import { fetchCurriculumLessonById } from '../lib/api';
import { effectiveSlides } from '../lib/lessonSlides';
import { wordsFromLocationState } from '../lib/materialsHandoff';
import type { CurriculumLesson } from '../lib/types';

/**
 * 수업 슬라이드(그림·직접 만들기·문법·노래·단어 소개·출석·카드·영상·웹페이지)의 실제 화면. 단계 이동(◀ ▶)·풀스크린은
 * AppLayout에 항상 떠 있는 LessonRunnerBar가 담당하므로, 여기서는 이 슬라이드 하나만 꽉 채워 보여주면 된다.
 * 게임 슬라이드는 이 페이지를 거치지 않고 그 게임의 실제 라우트로 바로 이동한다. 그리는 건 LessonSlideContent
 * (학생 따라보기 화면과 같이 쓴다).
 */
export default function LessonSlideViewerPage() {
  const { t } = useTranslation();
  const { id, slideId } = useParams<{ id: string; slideId: string }>();
  const { notify } = useToast();
  const isPresenting = usePresenting();
  const location = useLocation();
  const { academy, profile } = useAuth();
  const runnerClassId = useLessonRunner().runner?.classId ?? null;
  // 카드로 외우기·단어 소개·문법 슬라이드의 단어 — 발표 러너가 수업 단어장을 navigation state 로 넘겨준다.
  const stateWords = useMemo(() => wordsFromLocationState(location.state), [location.state]);

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
  const slide = lesson ? effectiveSlides(lesson).find((s) => s.id === slideId) : undefined;
  if (!lesson || !slide || slide.kind === 'game' || slide.kind === 'material') {
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
    <LessonSlideContent
      slide={slide}
      words={stateWords}
      fill={isPresenting}
      lessonName={lesson.name}
      attendance={{ academyId: academy?.id ?? '', classId: runnerClassId ?? lesson.class_id ?? null, teacherId: profile?.id ?? null }}
    />
  );
}
