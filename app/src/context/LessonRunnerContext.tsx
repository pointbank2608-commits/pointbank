import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { effectiveSlides } from '../lib/lessonSlides';
import { MATERIALS_CATALOG } from '../lib/materialsCatalog';
import type { CurriculumLesson, FullCardItem, WordList } from '../lib/types';

/** word_lists 저장 모양(WordListItem)을 자료실 페이지들이 받는 모양(FullCardItem)으로 바꾼다.
 * materialsHandoff.ts 의 materialsWords 로 넘길 때 씀. */
function toFullCardItems(wordList: WordList | null | undefined): FullCardItem[] {
  if (!wordList) return [];
  return wordList.items.map((item) => ({
    id: item.id,
    word: item.word,
    meaning: item.meaning,
    imageUrl: item.image_url,
    category: item.category,
    partOfSpeech: item.partOfSpeech ?? null,
  }));
}

export interface RunnerStep {
  kind: 'image' | 'video' | 'game' | 'material' | 'print';
  path: string;
  label: string;
  icon: string;
  /** 이동할 때 같이 넘길 router state — 워크시트 탭 미리 지정 등(materialsHandoff.ts 의
   * MaterialsHandoffState 모양). */
  navState?: Record<string, unknown>;
}

interface RunnerState {
  lessonId: string;
  lessonName: string;
  steps: RunnerStep[];
  stepIndex: number;
}

interface RunnerValue {
  runner: RunnerState | null;
  /** 수업 준비 화면의 "▶ 내 수업하기" 버튼이 호출한다 — PPT의 "슬라이드 쇼 시작"과 같다.
   * wordList 는 lesson.word_list_id 로 미리 찾아둔 실제 단어장(호출부가 이미 목록을 들고 있어
   * 여기서 새로 fetch 하지 않음 — fetch를 넣으면 비동기가 껴서 풀스크린 진입에 필요한 "클릭
   * 이벤트 핸들러 안에서 동기 호출"조건이 깨질 수 있다). */
  start: (lesson: CurriculumLesson, wordList?: WordList | null) => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  exit: () => void;
  /** 브라우저 Fullscreen API 상태 — LessonRunnerBar(버튼)와 AppLayout(사이드바·상단바를 진짜
   * 전체화면일 때만 감추는 용도) 둘 다 같은 값을 봐야 해서 여기 한 곳에서만 구독한다
   * (2026-09-25, 이전엔 LessonRunnerBar 안에 로컬 state로 따로 있었음). */
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

const STORAGE_KEY = 'classbank.lessonRunner';

const LessonRunnerContext = createContext<RunnerValue | null>(null);

export function LessonRunnerProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [runner, setRunner] = useState<RunnerState | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as RunnerState) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (runner) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(runner));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // 저장 실패해도(프라이빗 모드 등) 진행에는 지장 없다 — 새로고침 복원만 안 될 뿐.
    }
  }, [runner]);

  const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement != null);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement != null);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
    // 권한 없음 등으로 실패해도(catch로 삼킴) 진행바 자체는 계속 동작해야 한다.
  }, []);

  const start = useCallback(
    (lesson: CurriculumLesson, wordList?: WordList | null) => {
      const materialsWords = toFullCardItems(wordList);
      const steps: RunnerStep[] = [];
      for (const slide of effectiveSlides(lesson)) {
        if (slide.kind === 'image') {
          steps.push({
            kind: 'image',
            path: `/curriculum/${lesson.id}/slide/${slide.id}`,
            label: t('curriculum.slides.kindImage'),
            icon: 'image',
          });
        } else if (slide.kind === 'video') {
          steps.push({
            kind: 'video',
            path: `/curriculum/${lesson.id}/slide/${slide.id}`,
            label: t('curriculum.play.stepVideo'),
            icon: 'smart_display',
          });
        } else if (slide.kind === 'game') {
          const entry = GAME_CATALOG.find((g) => g.type === slide.gameType);
          if (!entry) continue;
          steps.push({ kind: 'game', path: entry.path, label: t(entry.nameKey), icon: entry.icon });
        } else {
          const entry = MATERIALS_CATALOG.find((m) => m.id === slide.materialId);
          if (!entry) continue;
          const navState: Record<string, unknown> = {};
          if (slide.worksheetTab) navState.materialsTab = slide.worksheetTab;
          if (materialsWords.length > 0) navState.materialsWords = materialsWords;
          steps.push({
            kind: 'material',
            path: entry.path,
            label: t(entry.nameKey),
            icon: entry.icon,
            navState: Object.keys(navState).length > 0 ? navState : undefined,
          });
        }
      }
      steps.push({
        kind: 'print',
        path: '/materials/worksheet',
        label: t('curriculum.play.stepPrint'),
        icon: 'print',
        navState: materialsWords.length > 0 ? { materialsWords } : undefined,
      });

      if (steps.length === 0) return;
      setRunner({ lessonId: lesson.id, lessonName: lesson.name, steps, stepIndex: 0 });
      navigate(steps[0].path, steps[0].navState ? { state: steps[0].navState } : undefined);
    },
    [t, navigate],
  );

  const goTo = useCallback(
    (index: number) => {
      if (!runner) return;
      const clamped = Math.max(0, Math.min(runner.steps.length - 1, index));
      setRunner({ ...runner, stepIndex: clamped });
      const step = runner.steps[clamped];
      navigate(step.path, step.navState ? { state: step.navState } : undefined);
    },
    [runner, navigate],
  );

  const next = useCallback(() => {
    if (!runner) return;
    goTo(runner.stepIndex + 1);
  }, [runner, goTo]);

  const prev = useCallback(() => {
    if (!runner) return;
    goTo(runner.stepIndex - 1);
  }, [runner, goTo]);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setRunner(null);
    navigate('/curriculum');
  }, [navigate]);

  return (
    <LessonRunnerContext.Provider value={{ runner, start, next, prev, goTo, exit, isFullscreen, toggleFullscreen }}>
      {children}
    </LessonRunnerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLessonRunner(): RunnerValue {
  const ctx = useContext(LessonRunnerContext);
  if (!ctx) throw new Error('useLessonRunner 는 LessonRunnerProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
