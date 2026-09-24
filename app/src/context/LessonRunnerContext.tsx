import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { effectiveSlides } from '../lib/lessonSlides';
import type { CurriculumLesson } from '../lib/types';

export interface RunnerStep {
  kind: 'image' | 'video' | 'game' | 'print';
  path: string;
  label: string;
  icon: string;
}

interface RunnerState {
  lessonId: string;
  lessonName: string;
  steps: RunnerStep[];
  stepIndex: number;
}

interface RunnerValue {
  runner: RunnerState | null;
  /** 수업 준비 화면의 "▶ 내 수업하기" 버튼이 호출한다 — PPT의 "슬라이드 쇼 시작"과 같다. */
  start: (lesson: CurriculumLesson) => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  exit: () => void;
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

  const start = useCallback(
    (lesson: CurriculumLesson) => {
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
        } else {
          const entry = GAME_CATALOG.find((g) => g.type === slide.gameType);
          if (!entry) continue;
          steps.push({ kind: 'game', path: entry.path, label: t(entry.nameKey), icon: entry.icon });
        }
      }
      steps.push({ kind: 'print', path: '/materials/worksheet', label: t('curriculum.play.stepPrint'), icon: 'print' });

      if (steps.length === 0) return;
      setRunner({ lessonId: lesson.id, lessonName: lesson.name, steps, stepIndex: 0 });
      navigate(steps[0].path);
    },
    [t, navigate],
  );

  const goTo = useCallback(
    (index: number) => {
      if (!runner) return;
      const clamped = Math.max(0, Math.min(runner.steps.length - 1, index));
      setRunner({ ...runner, stepIndex: clamped });
      navigate(runner.steps[clamped].path);
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
    setRunner(null);
    navigate('/curriculum');
  }, [navigate]);

  return (
    <LessonRunnerContext.Provider value={{ runner, start, next, prev, goTo, exit }}>{children}</LessonRunnerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLessonRunner(): RunnerValue {
  const ctx = useContext(LessonRunnerContext);
  if (!ctx) throw new Error('useLessonRunner 는 LessonRunnerProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
