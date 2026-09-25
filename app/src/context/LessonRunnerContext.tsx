import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { wordListToCards } from '../lib/gameFromWords';
import { effectiveSlides } from '../lib/lessonSlides';
import { MATERIALS_CATALOG } from '../lib/materialsCatalog';
import { grammarPoint } from '../lib/grammar';
import type { CurriculumLesson, WordList } from '../lib/types';

export interface RunnerStep {
  kind: 'image' | 'canvas' | 'study' | 'grammar' | 'video' | 'web' | 'game' | 'material' | 'print';
  path: string;
  label: string;
  icon: string;
  /** 이동할 때 같이 넘길 router state — 워크시트 탭 미리 지정 등(materialsHandoff.ts 의
   * MaterialsHandoffState 모양). */
  navState?: Record<string, unknown>;
  /** 이 단계를 만든 슬라이드 — "이 슬라이드부터 발표", 수업을 마친 뒤 편집 화면의 같은 슬라이드로 돌아가기에 쓴다. */
  slideId?: string;
}

export interface StartOptions {
  /** 이 슬라이드부터 시작(없으면 처음부터) */
  startSlideId?: string;
  /** 편집 화면에서 발표를 시작함 — "수업 마치기"를 누르면 편집 화면(마지막으로 본 슬라이드)으로 돌아간다. */
  returnToEdit?: boolean;
}

interface RunnerState {
  lessonId: string;
  lessonName: string;
  /** 이 수업을 하는 반 — 발표 중 포인트 주기, 게임 페이지 반 맞추기에 쓴다. */
  classId: string | null;
  steps: RunnerStep[];
  stepIndex: number;
  returnToEdit?: boolean;
}

interface RunnerValue {
  runner: RunnerState | null;
  /** 수업 준비 화면의 "▶ 내 수업하기" 버튼이 호출한다 — PPT의 "슬라이드 쇼 시작"과 같다.
   * wordList 는 lesson.word_list_id 로 미리 찾아둔 실제 단어장(호출부가 이미 목록을 들고 있어
   * 여기서 새로 fetch 하지 않음 — fetch를 넣으면 비동기가 껴서 풀스크린 진입에 필요한 "클릭
   * 이벤트 핸들러 안에서 동기 호출"조건이 깨질 수 있다). */
  start: (lesson: CurriculumLesson, wordList: WordList | null, classId: string | null, opts?: StartOptions) => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  exit: () => void;
  /** 브라우저 Fullscreen API 상태 — LessonRunnerBar(버튼)와 AppLayout(사이드바·상단바를 진짜
   * 전체화면일 때만 감추는 용도) 둘 다 같은 값을 봐야 해서 여기 한 곳에서만 구독한다
   * (2026-09-25, 이전엔 LessonRunnerBar 안에 로컬 state로 따로 있었음). */
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  /** 발표 화면 확대·축소(두 손가락 핀치·Ctrl+휠·진행바 버튼). 슬라이드를 넘기면 100%로 돌아간다.
   * PresentZoomArea 가 화면에 적용하고, LessonRunnerBar 가 버튼으로 조절한다. */
  zoom: PresentZoom;
  setZoom: (next: PresentZoom | ((prev: PresentZoom) => PresentZoom)) => void;
}

export interface PresentZoom {
  scale: number;
  x: number;
  y: number;
}

export const PRESENT_ZOOM_IDENTITY: PresentZoom = { scale: 1, x: 0, y: 0 };
export const PRESENT_ZOOM_MIN = 0.5;
export const PRESENT_ZOOM_MAX = 4;

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

  const [zoom, setZoom] = useState<PresentZoom>(PRESENT_ZOOM_IDENTITY);
  // 다음/이전 슬라이드로 가거나 수업을 새로 시작·마치면 확대는 풀고 100%로.
  useEffect(() => {
    setZoom(PRESENT_ZOOM_IDENTITY);
  }, [runner?.lessonId, runner?.stepIndex]);

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
    (lesson: CurriculumLesson, wordList: WordList | null, classId: string | null, opts?: StartOptions) => {
      const materialsWords = wordListToCards(wordList);
      const steps: RunnerStep[] = [];
      let currentSlideId: string | undefined;
      const push = (step: RunnerStep) => steps.push({ ...step, slideId: currentSlideId });
      for (const slide of effectiveSlides(lesson)) {
        currentSlideId = slide.id;
        if (slide.kind === 'image') {
          push({
            kind: 'image',
            path: `/curriculum/${lesson.id}/slide/${slide.id}`,
            label: t('curriculum.slides.kindImage'),
            icon: 'image',
          });
        } else if (slide.kind === 'canvas') {
          const firstText = slide.elements.find((el) => el.type === 'text' && el.text.trim());
          push({
            kind: 'canvas',
            path: `/curriculum/${lesson.id}/slide/${slide.id}`,
            label: firstText && firstText.type === 'text' ? firstText.text.trim().split(/\r?\n/)[0] : t('curriculum.slides.kindCanvas'),
            icon: 'dashboard_customize',
          });
        } else if (slide.kind === 'grammar') {
          const point = grammarPoint(slide.grammarId);
          push({
            kind: 'grammar',
            path: `/curriculum/${lesson.id}/slide/${slide.id}`,
            label: point?.name ?? t('curriculum.slides.kindGrammar'),
            icon: 'rule',
            navState: slide.useWordList ? { materialsWords } : undefined,
          });
        } else if (slide.kind === 'study') {
          // 카드는 수업 단어장으로 — 슬라이드 화면이 navigation state 의 materialsWords 를 읽는다.
          push({
            kind: 'study',
            path: `/curriculum/${lesson.id}/slide/${slide.id}`,
            label: t('curriculum.slides.kindStudy'),
            icon: 'style',
            navState: { materialsWords },
          });
        } else if (slide.kind === 'video') {
          push({
            kind: 'video',
            path: `/curriculum/${lesson.id}/slide/${slide.id}`,
            label: t('curriculum.play.stepVideo'),
            icon: 'smart_display',
          });
        } else if (slide.kind === 'web') {
          push({
            kind: 'web',
            path: `/curriculum/${lesson.id}/slide/${slide.id}`,
            label: slide.title?.trim() || t('curriculum.slides.kindWeb'),
            icon: slide.mode === 'window' ? 'menu_book' : 'language',
          });
        } else if (slide.kind === 'game') {
          const entry = GAME_CATALOG.find((g) => g.type === slide.gameType);
          if (!entry) continue;
          // 편집 화면에서 미리 만들어 둔 게임 콘텐츠(game_templates)를 그대로 연다 —
          // useGameTemplates 가 openTemplateId/openClassId 를 읽어 그 템플릿을 고른다.
          const navState: Record<string, unknown> = {};
          if (slide.templateId) navState.openTemplateId = slide.templateId;
          if (classId) navState.openClassId = classId;
          push({
            kind: 'game',
            path: entry.path,
            label: t(entry.nameKey),
            icon: entry.icon,
            navState: Object.keys(navState).length > 0 ? navState : undefined,
          });
        } else {
          const entry = MATERIALS_CATALOG.find((m) => m.id === slide.materialId);
          if (!entry) continue;
          const navState: Record<string, unknown> = {};
          if (slide.worksheetTab) navState.materialsTab = slide.worksheetTab;
          if (slide.worksheetOptions) navState.materialsWorksheetOptions = slide.worksheetOptions;
          if (slide.boardTheme) navState.materialsBoardTheme = slide.boardTheme;
          if (materialsWords.length > 0) navState.materialsWords = materialsWords;
          push({
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
      const found = opts?.startSlideId ? steps.findIndex((s) => s.slideId === opts.startSlideId) : -1;
      const startIndex = found >= 0 ? found : 0;
      setRunner({ lessonId: lesson.id, lessonName: lesson.name, classId, steps, stepIndex: startIndex, returnToEdit: !!opts?.returnToEdit });
      const first = steps[startIndex];
      navigate(first.path, first.navState ? { state: first.navState } : undefined);
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
    // 편집 화면에서 시작한 발표면, 마지막으로 보던 슬라이드가 선택된 편집 화면으로 돌아간다.
    const back = runner?.returnToEdit
      ? { reopenLessonId: runner.lessonId, reopenSlideId: runner.steps[runner.stepIndex]?.slideId }
      : undefined;
    setRunner(null);
    navigate('/curriculum', back ? { state: back } : undefined);
  }, [navigate, runner]);

  // 발표 리모컨(클리커)·키보드: PageDown/PageUp 으로 다음/이전 슬라이드. 슬라이드 안에서 단계가 있는
  // 화면(문법 예문 하나씩 보기, 카드로 외우기)은 capture 단계에서 먼저 받아 처리하고 전파를 막는다 —
  // 그 화면의 단계를 다 넘기면 여기까지 와서 다음 슬라이드로 넘어간다(PPT 애니메이션처럼).
  useEffect(() => {
    if (!runner) return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.key === 'PageDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runner, next, prev]);

  return (
    <LessonRunnerContext.Provider
      value={{ runner, start, next, prev, goTo, exit, isFullscreen, toggleFullscreen, zoom, setZoom }}
    >
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

/** "발표하기"를 누른 뒤 "수업 마치기" 전까지 true — 이 동안엔 어떤 화면에서도 편집 UI를 숨긴다
 * (EditOnly). 전체화면 여부와는 무관하다. Provider 밖(로그인 전 화면 등)에서는 항상 false. */
// eslint-disable-next-line react-refresh/only-export-components
export function usePresenting(): boolean {
  const ctx = useContext(LessonRunnerContext);
  return ctx?.runner != null;
}
