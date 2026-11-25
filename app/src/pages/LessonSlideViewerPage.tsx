import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import LessonSlideContent from '../components/LessonSlideContent';
import { useAuth } from '../context/AuthContext';
import { useLessonRunner, usePresenting } from '../context/LessonRunnerContext';
import { useToast } from '../context/ToastContext';
import { fetchCurriculumLessonById, fetchWordListById } from '../lib/api';
import { wordListToCards } from '../lib/gameFromWords';
import { effectiveSlides } from '../lib/lessonSlides';
import { wordsFromLocationState } from '../lib/materialsHandoff';
import { restoreReadingCues } from '../lib/readingLines';
import { GRAMMAR_WORD_SHEET } from '../lib/grammarCoreWords';
import GrammarWordWorksheet from '../components/worksheets/GrammarWordWorksheet';
import type { CurriculumLesson, WordList } from '../lib/types';

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
  const { runner, recordSlideAudio, recordGrammarCue } = useLessonRunner();
  const runnerClassId = runner?.classId ?? null;
  // 카드로 외우기·단어 소개·문법 슬라이드의 단어 — 발표 러너가 수업 단어장을 navigation state 로 넘겨준다.
  const stateWords = useMemo(() => wordsFromLocationState(location.state), [location.state]);

  const [lesson, setLesson] = useState<CurriculumLesson | null>(null);
  const slides = useMemo(() => lesson ? effectiveSlides(lesson) : [], [lesson]);
  const slide = slides.find(candidate => candidate.id === slideId);
  const [loading, setLoading] = useState(true);
  const [directWordList, setDirectWordList] = useState<WordList | null>(null);
  const [checkedList, setCheckedList] = useState<string | null>(null);
  const directListId = !isPresenting && lesson?.id === id && slide?.kind === 'phonicsGame' && !slide.unitId
    ? lesson?.word_list_id : null;

  useEffect(() => {
    if (!directListId) return;
    let active = true;
    void fetchWordListById(directListId).then(list => { if (active) setDirectWordList(list); })
      .catch(() => { if (active) setDirectWordList(null); })
      .finally(() => { if (active) setCheckedList(directListId); });
    return () => { active = false; };
  }, [directListId]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchCurriculumLessonById(id)
      .then(setLesson)
      .catch((err) => notify(err instanceof Error ? err.message : String(err), 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || (directListId && checkedList !== directListId)) {
    return <div className="font-body-md text-body-md text-on-surface-variant">{t('common.loading')}</div>;
  }
  if (slide?.kind === 'material' && slide.materialId === GRAMMAR_WORD_SHEET && slide.grammarWords) {
    return <div className={isPresenting ? 'absolute inset-0 overflow-auto bg-white' : ''}><GrammarWordWorksheet selection={slide.grammarWords} /></div>;
  }
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

  const transcript = slide.kind === 'reading' && slide.mode === 'cloze' && slide.videoUrl
    ? slides.find(s => s.kind === 'shadow' && s.clipId && s.videoUrl === slide.videoUrl && s.title === slide.title)
    : undefined;
  const presentedSlide = slide.kind === 'reading' && transcript?.kind === 'shadow'
    ? { ...slide, source: restoreReadingCues(slide.source, transcript.source) }
    : slide;
  return (
    <LessonSlideContent
      slide={presentedSlide}
      words={directListId && directWordList?.id === directListId ? wordListToCards(directWordList) : stateWords}
      lessonSlides={slides}
      fill={isPresenting}
      lessonName={lesson.name}
      onCanvasAudio={runner?.lessonId === lesson.id && runner.steps[runner.stepIndex]?.slideId === slide.id ? recordSlideAudio : undefined}
      onGrammarCue={isPresenting && runner?.lessonId === lesson.id && runner.steps[runner.stepIndex]?.slideId === slide.id ? recordGrammarCue : undefined}
      grammarWordObservation={slide.kind === 'qna' && slide.grammarWordSource && runner?.lessonId === lesson.id
        && runner.steps[runner.stepIndex]?.slideId === slide.id
        ? { lessonId: lesson.id, position: runner.stepIndex } : undefined}
      phonicsObservation={slide.kind === 'phonicsGame' && isPresenting && runner?.lessonId === lesson.id
        && runner.steps[runner.stepIndex]?.slideId === slide.id
        ? { lessonId: lesson.id, position: runner.stepIndex } : undefined}
      attendance={{ academyId: academy?.id ?? '', classId: runnerClassId ?? lesson.class_id ?? null, teacherId: profile?.id ?? null }}
    />
  );
}
