import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import CanvasSlideView from '../components/CanvasSlideView';
import FlashcardStudy from '../components/FlashcardStudy';
import GrammarBoard from '../components/GrammarBoard';
import { buildWordListSentences, grammarPoint, useGrammarCards } from '../lib/grammar';
import { wordsFromLocationState } from '../lib/materialsHandoff';
import WebSlideView from '../components/WebSlideView';
import YoutubeShadowingPlayer from '../components/YoutubeShadowingPlayer';
import { usePresenting } from '../context/LessonRunnerContext';
import { useToast } from '../context/ToastContext';
import { fetchCurriculumLessonById } from '../lib/api';
import { effectiveSlides } from '../lib/lessonSlides';
import type { CurriculumLesson } from '../lib/types';

/**
 * "이미지/영상/웹페이지" 슬라이드의 실제 화면. 단계 이동(◀ ▶)·풀스크린은 AppLayout에 항상 떠 있는
 * LessonRunnerBar가 담당하므로, 여기서는 이 슬라이드 하나만 꽉 채워 보여주면 된다.
 * 게임 슬라이드는 이 페이지를 거치지 않고 그 게임의 실제 라우트로 바로 이동한다.
 */
export default function LessonSlideViewerPage() {
  const { t } = useTranslation();
  const { id, slideId } = useParams<{ id: string; slideId: string }>();
  const { notify } = useToast();
  const isPresenting = usePresenting();
  const location = useLocation();
  // "카드로 외우기" 슬라이드의 카드 — 발표 러너가 수업 단어장을 navigation state 로 넘겨준다.
  const stateWords = useMemo(() => wordsFromLocationState(location.state), [location.state]);
  const grammarCards = useGrammarCards(stateWords);
  // 새 배열을 매 렌더 넘기면 FlashcardStudy 가 처음 카드로 되돌아가므로 state 가 바뀔 때만 만든다.
  const studyCards = useMemo(
    () =>
      wordsFromLocationState(location.state).map((w) => ({
        id: w.id,
        word: w.word,
        back: w.meaning,
        example: w.example ?? null,
        image_url: w.imageUrl,
      })),
    [location.state],
  );

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

  if (slide.kind === 'grammar') {
    const point = grammarPoint(slide.grammarId);
    if (!point) return <div className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.play.notFound')}</div>;
    const extra = slide.useWordList ? buildWordListSentences(point, grammarCards, 6, slide.seed ?? 0) : [];
    return (
      <div className={isPresenting ? 'absolute inset-0 p-2 md:p-4' : 'h-[75vh]'}>
        <GrammarBoard
          key={slide.id}
          point={point}
          extra={extra}
          themeId={slide.boardTheme ?? 'green'}
          initialShowKo={!!slide.showKo}
          initialRevealAll={!!slide.revealAll}
        />
      </div>
    );
  }

  if (slide.kind === 'study') {
    if (studyCards.length === 0) {
      return <div className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.study.noWords')}</div>;
    }
    return (
      <div className={isPresenting ? 'absolute inset-0' : 'relative h-[80vh] overflow-hidden rounded-2xl'}>
        <FlashcardStudy
          key={slide.id}
          inline
          startShuffled={!!slide.shuffle}
          title={t('curriculum.slides.kindStudy')}
          cards={studyCards}
        />
      </div>
    );
  }

  if (slide.kind === 'canvas') {
    return (
      <div className={isPresenting ? 'absolute inset-0 p-2 md:p-4' : 'h-[75vh]'}>
        <CanvasSlideView slide={slide} className="[&>div]:rounded-xl" />
      </div>
    );
  }

  if (slide.kind === 'web') {
    return <WebSlideView slide={slide} fill={isPresenting} />;
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

  // 발표 중엔 PresentZoomArea(position:relative) 전체를 absolute inset-0 으로 채우고 이미지는 그 안에서
  // 최대한 크게. 평소엔 부모 높이가 콘텐츠에 따라 달라져 %가 의미 없으므로 기존 vh 값을 그대로 쓴다.
  return (
    <div className={isPresenting ? 'absolute inset-0 flex items-center justify-center p-3 md:p-5' : 'flex min-h-[70vh] items-center justify-center'}>
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
