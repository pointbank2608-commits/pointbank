import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buildWordListSentences, grammarPoint, useGrammarCards } from '../lib/grammar';
import { usePhonicsFilled } from '../lib/phonicsFill';
import { extractYoutubeId } from '../lib/youtube';
import type { FullCardItem, LessonSlide } from '../lib/types';
import AttendanceBoard from './AttendanceBoard';
import CanvasSlideView from './CanvasSlideView';
import FlashcardStudy from './FlashcardStudy';
import GrammarBoard from './GrammarBoard';
import PhonicsMarkedWord from './PhonicsMarkedWord';
import ReadingBoard from './ReadingBoard';
import WebSlideView from './WebSlideView';
import WordShowBoard from './WordShowBoard';
import YoutubeShadowingPlayer from './YoutubeShadowingPlayer';

/**
 * 슬라이드 한 장의 화면(2026-09-27에 LessonSlideViewerPage 에서 뺌) — 발표 화면과 학생 따라보기(/watch)가
 * 같이 쓴다. 게임·자료실 슬라이드는 여기서 그리지 않는다(발표는 그 페이지로 가고, 학생 화면은 안내 카드).
 */
export default function LessonSlideContent({
  slide,
  words,
  fill,
  lessonName,
  attendance,
  student = false,
}: {
  slide: LessonSlide;
  /** 수업 단어(카드로 외우기·단어 소개·문법 "우리 단어장 예문") */
  words: FullCardItem[];
  /** true: 부모(position:relative)를 꽉 채운다(발표·학생 화면) */
  fill: boolean;
  lessonName: string;
  /** 출석 체크 슬라이드에 필요한 것 — 학생 화면에서는 null(이름을 보여 주지 않는다) */
  attendance: { academyId: string; classId: string | null; teacherId: string | null } | null;
  student?: boolean;
}) {
  const { t } = useTranslation();
  const grammarCards = useGrammarCards(words);
  const studyWords = usePhonicsFilled(words);
  // 새 배열을 매 렌더 넘기면 FlashcardStudy 가 처음 카드로 되돌아가므로 단어가 바뀔 때만 만든다.
  const studyCards = useMemo(
    () =>
      studyWords.map((w) => ({
        id: w.id,
        word: w.word,
        back: w.meaning,
        example: w.example ?? null,
        image_url: w.imageUrl,
        front: w.patternMarked ? (
          <PhonicsMarkedWord pattern={w.patternMarked} className="font-title-md text-[clamp(48px,9vw,112px)] font-bold text-deep-navy" />
        ) : undefined,
      })),
    [studyWords],
  );

  const boardBox = fill ? 'absolute inset-0 p-2 md:p-4' : 'h-[75vh]';

  if (slide.kind === 'reading') {
    return (
      <div className={boardBox}>
        <ReadingBoard
          key={slide.id}
          source={slide.source}
          title={slide.title}
          videoUrl={student ? undefined : slide.videoUrl}
          mode={slide.mode}
          themeId={slide.boardTheme ?? 'green'}
        />
      </div>
    );
  }

  if (slide.kind === 'grammar') {
    const point = grammarPoint(slide.grammarId);
    if (!point) return <div className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.play.notFound')}</div>;
    const extra = slide.useWordList ? buildWordListSentences(point, grammarCards, 6, slide.seed ?? 0) : [];
    return (
      <div className={boardBox}>
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

  if (slide.kind === 'wordshow') {
    return (
      <div className={fill ? 'absolute inset-0 p-2' : 'aspect-video w-full max-w-5xl'}>
        <WordShowBoard
          key={slide.id}
          words={words}
          themeId={slide.boardTheme ?? 'green'}
          interactive
          shuffle={!!slide.shuffle}
          autoSpeak={slide.autoSpeak !== false}
        />
      </div>
    );
  }

  if (slide.kind === 'attendance') {
    if (!attendance) {
      return (
        <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '64px' }}>
            how_to_reg
          </span>
          <div className="font-title-md text-title-md text-deep-navy">{t('curriculum.attendance.title')}</div>
        </div>
      );
    }
    return (
      <div className={fill ? 'absolute inset-0 p-2' : 'aspect-video w-full max-w-5xl'}>
        <AttendanceBoard
          academyId={attendance.academyId}
          classId={attendance.classId}
          teacherId={attendance.teacherId}
          themeId={slide.boardTheme ?? 'green'}
          interactive
        />
      </div>
    );
  }

  if (slide.kind === 'study') {
    if (studyCards.length === 0) {
      return <div className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.study.noWords')}</div>;
    }
    return (
      <div className={fill ? 'absolute inset-0' : 'relative h-[80vh] overflow-hidden rounded-2xl'}>
        <FlashcardStudy key={slide.id} inline startShuffled={!!slide.shuffle} title={t('curriculum.slides.kindStudy')} cards={studyCards} />
      </div>
    );
  }

  if (slide.kind === 'canvas') {
    return (
      <div className={boardBox}>
        <CanvasSlideView slide={slide} className="[&>div]:rounded-xl" />
      </div>
    );
  }

  if (slide.kind === 'web') {
    return <WebSlideView slide={slide} fill={fill} />;
  }

  if (slide.kind === 'video') {
    if (student) {
      // 학생 화면: 영상은 선생님 화면 공유로 보는 게 기본 — 혼자 다시 볼 수 있게 영상만 끼워 둔다.
      const vid = extractYoutubeId(slide.videoUrl);
      return (
        <div className={fill ? 'absolute inset-0 flex items-center justify-center p-3' : ''}>
          {vid ? (
            <iframe
              title="video"
              src={`https://www.youtube-nocookie.com/embed/${vid}`}
              className="aspect-video w-full max-w-5xl rounded-xl"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : null}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">{lessonName}</h2>
        <YoutubeShadowingPlayer videoUrl={slide.videoUrl} />
      </div>
    );
  }

  if (slide.kind === 'image') {
    // 발표 중엔 부모 전체를 채우고 이미지는 그 안에서 최대한 크게. 평소엔 부모 높이가 콘텐츠에 따라 달라서 vh 로.
    return (
      <div className={fill ? 'absolute inset-0 flex items-center justify-center p-3 md:p-5' : 'flex min-h-[70vh] items-center justify-center'}>
        <img
          src={slide.imageUrl}
          alt=""
          className={
            fill
              ? 'max-h-full max-w-full rounded-xl object-contain shadow-[0_8px_28px_rgba(0,0,0,0.15)]'
              : 'max-h-[80vh] max-w-full rounded-xl object-contain shadow-[0_8px_28px_rgba(0,0,0,0.15)]'
          }
        />
      </div>
    );
  }

  return null;
}
