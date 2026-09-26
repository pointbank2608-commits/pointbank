import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import WordShowBoard from './WordShowBoard';
import AttendanceBoard from './AttendanceBoard';
import { PhonicsOptionsFields, phonicsTabLabel, WordSourcePicker } from './LessonWordSources';
import { PHONICS_SLIDE_TABS } from '../pages/PhonicsWorksheetLibraryPage';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createGameTemplate, uploadLessonSlideImage } from '../lib/api';
import { GAME_CATALOG, type GameCategory } from '../lib/gameCatalog';
import { buildGameContent, lessonGameTemplateName, wordListToCards } from '../lib/gameFromWords';
import { MATERIALS_CATALOG, WORKSHEET_TAB_CATALOG } from '../lib/materialsCatalog';
import { DEFAULT_COLORING_OPTIONS, type AskTemplate, type ColoringOptions } from '../lib/worksheetGenerators';
import type {
  FullCardItem,
  GameSlide,
  ImageSlide,
  LessonSlide,
  MaterialSlide,
  VideoSlide,
  WebSlide,
  WordList,
  WorksheetSlideOptions,
} from '../lib/types';
import { normalizeWebUrl, webSlideHost } from '../lib/webSlides';
import { extractYoutubeId } from '../lib/youtube';
import GameImagePicker from './GameImagePicker';
import WebSlideView from './WebSlideView';
import { GameEmbedContext } from '../context/GameEmbedContext';
import GrammarBoard from './GrammarBoard';
import ReadingBoard from './ReadingBoard';
import { parseReadingText } from '../lib/readingLines';
import GrammarExplainCard from './GrammarExplainCard';
import { buildWordListSentences, GRAMMAR_LEVELS_BY_STAGE, GRAMMAR_POINTS, GRAMMAR_STAGES, grammarLevelTag, grammarPoint, sentencesForUnscramble, useGrammarCards, type GrammarStage } from '../lib/grammar';
import { GAME_PAGES } from '../lib/gamePages';
import CanvasSlideEditor, { BoardThemeChips, newCanvasSlide, newTextElement, themeTextDefaults } from './CanvasSlideEditor';
import CanvasSlideView from './CanvasSlideView';
import WorksheetOptionsFields from './worksheets/WorksheetOptionsFields';
import WorksheetTypePreview from './WorksheetTypePreview';

/** WorksheetOptionsFields 가 쓰는 "다루기 쉬운" 런타임 모양 — MaterialSlide.worksheetOptions(평탄화
 * 저장 모양)과 서로 변환한다. 기본값은 WorksheetPrintPage.tsx 의 각 useState 초기값과 동일. */
interface WorksheetOptionsState {
  listShow: { pos: boolean; example: boolean; image: boolean };
  tracingShow: { meaning: boolean; image: boolean };
  showAnswerKey: boolean;
  includeAnswers: boolean;
  askTemplate: AskTemplate;
  coloring: ColoringOptions;
}

const DEFAULT_WORKSHEET_OPTIONS_STATE: WorksheetOptionsState = {
  listShow: { pos: true, example: false, image: false },
  tracingShow: { meaning: false, image: false },
  showAnswerKey: false,
  includeAnswers: true,
  askTemplate: 'like',
  coloring: DEFAULT_COLORING_OPTIONS,
};

function optionsStateFromSlide(wo: WorksheetSlideOptions | undefined): WorksheetOptionsState {
  return {
    listShow: wo?.listShow ?? DEFAULT_WORKSHEET_OPTIONS_STATE.listShow,
    tracingShow: wo?.tracingShow ?? DEFAULT_WORKSHEET_OPTIONS_STATE.tracingShow,
    showAnswerKey: wo?.showAnswerKey ?? false,
    includeAnswers: wo?.includeAnswers ?? true,
    askTemplate: wo?.askTemplate ?? 'like',
    coloring: {
      title: wo?.coloringTitle ?? DEFAULT_COLORING_OPTIONS.title,
      labelMode: wo?.coloringLabelMode ?? DEFAULT_COLORING_OPTIONS.labelMode,
      perPage: wo?.coloringPerPage ?? DEFAULT_COLORING_OPTIONS.perPage,
      decorTheme: wo?.coloringDecorTheme ?? DEFAULT_COLORING_OPTIONS.decorTheme,
    },
  };
}

function slideOptionsFromState(o: WorksheetOptionsState): WorksheetSlideOptions {
  return {
    listShow: o.listShow,
    tracingShow: o.tracingShow,
    showAnswerKey: o.showAnswerKey,
    includeAnswers: o.includeAnswers,
    askTemplate: o.askTemplate,
    coloringTitle: o.coloring.title,
    coloringLabelMode: o.coloring.labelMode,
    coloringPerPage: o.coloring.perPage,
    coloringDecorTheme: o.coloring.decorTheme,
  };
}

const CATEGORY_ORDER: GameCategory[] = ['simple', 'vocabulary', 'sentence', 'listening', 'reading', 'speaking'];

function uid(): string {
  return crypto.randomUUID();
}

interface Props {
  academyId: string;
  /** 이 수업을 하는 반 — 게임 내용(game_templates)을 이 반 기준으로 고르고 만든다. */
  classId: string | null;
  lessonName: string;
  slides: LessonSlide[];
  onChange: (slides: LessonSlide[]) => void;
  wordListId: string;
  wordLists: WordList[];
  onWordListChange: (id: string) => void;
  /** 처음 선택할 슬라이드 — 발표를 마치고 편집 화면으로 돌아올 때 마지막으로 보던 슬라이드. */
  initialSelectedId?: string | null;
  /** "이 슬라이드부터 발표" — 저장하고 그 슬라이드부터 수업을 시작한다(CurriculumPage). */
  onPresentFrom?: (slideId: string) => void;
  /** 수업 화면 안에서 단어장 만들기·고치기 창 열기(CurriculumPage 의 LessonWordListModal). */
  onManageWordList?: (mode: 'new' | 'edit') => void;
}

/** 게임 슬라이드가 발표 때 열 내용이 정해졌는지 — 템플릿을 골랐거나, 저장할 때 수업 단어장으로
 * 자동으로 만들 수 있으면 OK. */
function gameSlideReady(slide: GameSlide, cards: FullCardItem[]): boolean {
  return !!slide.templateId || buildGameContent(slide.gameType, cards) !== null;
}

type AddMode = 'canvas' | 'image' | 'video' | 'web' | 'study' | 'wordshow' | 'attendance' | 'grammar' | 'reading' | 'game' | 'material' | null;

/** 캔바 프레젠테이션 편집 화면처럼 — 왼쪽 세로 슬라이드 썸네일 레일(드래그로 순서 변경) +
 * 오른쪽 선택된 슬라이드 상세 패널. 이미지·유튜브·게임·수업 자료실 4종을 자유 순서로 섞어 배치한다. */
export default function LessonSlideSorter({
  academyId,
  classId,
  lessonName,
  slides,
  onChange: emitChange,
  wordListId,
  wordLists,
  onWordListChange,
  initialSelectedId,
  onPresentFrom,
  onManageWordList,
}: Props) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const wordList = wordLists.find((wl) => wl.id === wordListId) ?? null;
  const cards = useMemo(() => wordListToCards(wordList), [wordList]);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId && slides.some((s) => s.id === initialSelectedId) ? initialSelectedId : slides[0]?.id ?? null,
  );
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [videoDraft, setVideoDraft] = useState('');
  const [webDraft, setWebDraft] = useState({ url: '', title: '' });
  const [worksheetDraftTab, setWorksheetDraftTab] = useState(WORKSHEET_TAB_CATALOG[0]?.tab ?? 'list');
  const [worksheetDraftOptions, setWorksheetDraftOptions] = useState<WorksheetOptionsState>(DEFAULT_WORKSHEET_OPTIONS_STATE);
  // 새 워크시트 슬라이드의 발표 화면 바탕 — 앱 기본 파란 바탕은 글이 잘 안 읽혀서 화이트보드로 시작.
  const [worksheetDraftBoard, setWorksheetDraftBoard] = useState<string | null>('whiteboard');
  const [canvasDraftTheme, setCanvasDraftTheme] = useState<string | null>(null);
  // 새 워크시트 슬라이드의 단어 — 비어 있으면 수업 단어장, 있으면 주제에서 고른 단어(2026-09-27)
  const [worksheetDraftWords, setWorksheetDraftWords] = useState<{ words?: FullCardItem[]; topic?: string }>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selected = slides.find((s) => s.id === selectedId) ?? null;

  /* ---------- 되돌리기·다시하기(수업 편집 전체, 2026-09-26) ----------
   * 슬라이드 추가·삭제·순서·종류 바꾸기·내용 수정을 모두 기록한다. 글자 입력·끌기처럼 같은 슬라이드를
   * 연달아 고치는 건(1.2초 안) 한 번으로 묶는다. 바깥(초안 불러오기 등)에서 슬라이드가 통째로 바뀌면 비운다.
   * 직접 만들기 슬라이드 안의 Ctrl+Z 는 그 편집기가 먼저 처리한다(글상자 하나하나 되돌리기). */
  const pastRef = useRef<LessonSlide[][]>([]);
  const futureRef = useRef<LessonSlide[][]>([]);
  const lastEmitRef = useRef<LessonSlide[]>(slides);
  const lastKeyRef = useRef<{ key: string; at: number; win?: number } | null>(null);
  if (slides !== lastEmitRef.current) {
    // 빈 수업을 레시피로 채운 경우는 되돌리기로 빈 수업(레시피 고르기)으로 돌아갈 수 있게 남긴다.
    const fromEmpty = lastEmitRef.current.length === 0 && slides.length > 0;
    pastRef.current = fromEmpty ? [[]] : [];
    futureRef.current = [];
    lastKeyRef.current = null;
    lastEmitRef.current = slides;
  }
  // 고른 슬라이드가 없어졌거나(레시피로 통째로 채움·되돌리기) 아직 없으면 첫 슬라이드를 고른다.
  useEffect(() => {
    if (!addMode && slides.length > 0 && !slides.some((sl) => sl.id === selectedId)) setSelectedId(slides[0].id);
  }, [slides, selectedId, addMode]);

  function onChange(next: LessonSlide[], coalesceKey?: string) {
    const now = Date.now();
    const last = lastKeyRef.current;
    const merge = !!coalesceKey && !!last && last.key === coalesceKey && now - last.at < (last.win ?? 1200);
    if (!merge) {
      pastRef.current.push(slides);
      if (pastRef.current.length > 80) pastRef.current.shift();
    }
    futureRef.current = [];
    lastKeyRef.current = coalesceKey ? { key: coalesceKey, at: now } : null;
    lastEmitRef.current = next;
    emitChange(next);
  }

  function restore(list: LessonSlide[]) {
    lastKeyRef.current = null;
    lastEmitRef.current = list;
    emitChange(list);
    setAddMode(null);
    if (!list.some((sl) => sl.id === selectedId)) {
      const idx = Math.max(0, slides.findIndex((sl) => sl.id === selectedId));
      setSelectedId(list[Math.min(idx, list.length - 1)]?.id ?? null);
    }
  }
  function undoSlides() {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(slides);
    restore(prev);
  }
  function redoSlides() {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(slides);
    restore(next);
  }
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const historyKeysRef = useRef({ undoSlides, redoSlides });
  historyKeysRef.current = { undoSlides, redoSlides };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        historyKeysRef.current.undoSlides();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        historyKeysRef.current.redoSlides();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ---------- 종류 바꾸기(2026-09-26) ----------
   * 슬라이드 상세의 "종류 바꾸기" → 추가 패널을 "바꾸기"로 연다. 고른 슬라이드가 새로 붙지 않고 그 자리에
   * 들어간다(워크시트 → 게임처럼, 지우고 다시 만들 필요 없이). 잘못 바꿨으면 되돌리기. */
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  useEffect(() => {
    if (!addMode) setReplaceTargetId(null);
  }, [addMode]);

  function placeSlides(made: LessonSlide[]) {
    if (made.length === 0) return;
    const idx = replaceTargetId ? slides.findIndex((sl) => sl.id === replaceTargetId) : -1;
    if (idx >= 0) {
      onChange([...slides.slice(0, idx), ...made, ...slides.slice(idx + 1)]);
      setReplaceTargetId(null);
      notify(t('curriculum.slides.replacedToast'));
    } else {
      onChange([...slides, ...made]);
    }
    // 방금 넣은 슬라이드가 열리며 스스로 채우는 값(게임 슬라이드가 고른 게임 내용 등)은 넣기와 한 번으로
    // 묶는다 — 안 그러면 되돌리기를 한 번 눌러도 그 자동 변경만 되돌아가 "안 되는 것"처럼 보인다.
    lastKeyRef.current = { key: `update:${made[0].id}`, at: Date.now(), win: 5000 };
    setSelectedId(made[0].id);
  }

  function addSlide(slide: LessonSlide) {
    placeSlides([slide]);
  }

  function updateSlide(id: string, patch: Partial<LessonSlide>) {
    onChange(
      slides.map((s) => (s.id === id ? ({ ...s, ...patch } as LessonSlide) : s)),
      `update:${id}`,
    );
  }

  function removeSlide(id: string) {
    const idx = slides.findIndex((s) => s.id === id);
    const next = slides.filter((s) => s.id !== id);
    onChange(next);
    if (selectedId === id) {
      setSelectedId(next[Math.min(idx, next.length - 1)]?.id ?? null);
    }
    // 올린 그림 파일은 지우지 않는다 — 슬라이드 복제·다른 반으로 복사한 수업이 같은 파일을 쓰고,
    // 편집을 취소하면 지운 슬라이드가 되살아나기 때문(2026-09-26). 남는 파일은 해가 없다.
  }

  function duplicateSlide(id: string) {
    const idx = slides.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const clone: LessonSlide = { ...slides[idx], id: uid() };
    const next = [...slides.slice(0, idx + 1), clone, ...slides.slice(idx + 1)];
    onChange(next);
    setSelectedId(clone.id);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(slides, oldIndex, newIndex));
  }

  function addVideoSlide() {
    const id = extractYoutubeId(videoDraft);
    if (!id) {
      notify(t('curriculum.slides.invalidVideoUrl'), 'error');
      return;
    }
    const slide: VideoSlide = { id: uid(), kind: 'video', videoUrl: videoDraft.trim() };
    addSlide(slide);
    setVideoDraft('');
    setAddMode(null);
  }

  function addWebSlide() {
    const normalized = normalizeWebUrl(webDraft.url);
    if (!normalized) {
      notify(t('curriculum.web.invalidUrl'), 'error');
      return;
    }
    const slide: WebSlide = {
      id: uid(),
      kind: 'web',
      url: normalized.url,
      mode: normalized.mode,
      ...(webDraft.title.trim() ? { title: webDraft.title.trim() } : {}),
    };
    addSlide(slide);
    setWebDraft({ url: '', title: '' });
    setAddMode(null);
  }

  function addCanvasSlide(layout: 'title' | 'blank') {
    const slide = newCanvasSlide(canvasDraftTheme);
    if (layout === 'blank') slide.elements = [];
    addSlide(slide);
    setAddMode(null);
  }

  /** "단어 카드" — 고른 단어마다 한 장씩(그림 + 단어). 예전엔 단어장의 첫 단어만 매번 들어갔다(2026-09-26 피드백). */
  const [wordCardPicking, setWordCardPicking] = useState(false);
  const [wordCardSelected, setWordCardSelected] = useState<string[]>([]);
  // 이미 단어 카드로 만든 단어(직접 만들기 슬라이드 글상자에 그 단어가 있으면) — "있음" 표시
  const usedWords = useMemo(() => {
    const set = new Set<string>();
    for (const sl of slides) {
      if (sl.kind !== 'canvas') continue;
      for (const el of sl.elements) if (el.type === 'text') set.add(el.text.trim().toLowerCase());
    }
    return set;
  }, [slides]);

  function addWordCardSlides() {
    const picked = cards.filter((c) => wordCardSelected.includes(c.id));
    if (picked.length === 0) return;
    const made: LessonSlide[] = picked.map((card) => {
      const slide = newCanvasSlide(canvasDraftTheme);
      slide.elements = card.imageUrl
        ? [
            { id: uid(), type: 'image', x: 32, y: 8, w: 36, h: 62, url: card.imageUrl, fit: 'contain' },
            newTextElement({ x: 15, y: 72, w: 70, h: 18, text: card.word, ...themeTextDefaults(canvasDraftTheme, 'title'), fontSize: 11 }),
          ]
        : [newTextElement({ x: 15, y: 35, w: 70, h: 24, text: card.word, ...themeTextDefaults(canvasDraftTheme, 'title') })];
      return slide;
    });
    placeSlides(made);
    setWordCardSelected([]);
    setWordCardPicking(false);
    setAddMode(null);
  }

  function addGameSlide(gameType: GameSlide['gameType']) {
    addSlide({ id: uid(), kind: 'game', gameType });
    // 추가하자마자 그 게임의 설정 화면을 보여준다(게임 내용을 바로 고르고 고칠 수 있게).
    setAddMode(null);
  }

  function addMaterialSlide(
    materialId: string,
    worksheetTab?: string,
    worksheetOptions?: WorksheetSlideOptions,
    boardTheme?: string | null,
    extra?: Partial<MaterialSlide>,
  ) {
    addSlide({
      id: uid(),
      kind: 'material',
      materialId,
      ...(worksheetTab ? { worksheetTab } : {}),
      ...(worksheetOptions ? { worksheetOptions } : {}),
      ...(boardTheme ? { boardTheme } : {}),
      ...(extra ?? {}),
    });
  }

  return (
    <WordListManageContext.Provider value={onManageWordList}>
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* 왼쪽 슬라이드 레일 */}
      <div className="flex shrink-0 flex-row gap-2 overflow-x-auto pb-2 lg:w-56 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start">
        <div className="flex shrink-0 flex-col justify-center gap-1 self-center lg:w-full lg:flex-row lg:self-auto">
          <button
            type="button"
            onClick={undoSlides}
            disabled={!canUndo}
            title={t('curriculum.slides.undoHint')}
            className="flex items-center justify-center gap-1 whitespace-nowrap rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-label-md text-label-md text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-35 lg:flex-1"
          >
            <span className="material-symbols-outlined text-[18px]">undo</span>
            {t('curriculum.slides.undo')}
          </button>
          <button
            type="button"
            onClick={redoSlides}
            disabled={!canRedo}
            title={t('curriculum.slides.redoHint')}
            className="flex items-center justify-center gap-1 whitespace-nowrap rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-label-md text-label-md text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-35 lg:flex-1"
          >
            <span className="material-symbols-outlined text-[18px]">redo</span>
            {t('curriculum.slides.redo')}
          </button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.id)} strategy={rectSortingStrategy}>
            {slides.map((slide, i) => (
              <SlideThumb
                key={slide.id}
                slide={slide}
                index={i}
                // 새 슬라이드를 추가하는 동안에는 기존 슬라이드를 선택 표시하지 않는다(그 슬라이드를 고치는
                // 중인 것처럼 보이지 않게).
                selected={addMode ? slide.id === replaceTargetId : slide.id === selectedId}
                onSelect={() => {
                  // 추가 패널이 열려 있어도 썸네일을 누르면 바로 그 슬라이드 미리보기·편집으로.
                  setSelectedId(slide.id);
                  setAddMode(null);
                }}
                onDelete={() => removeSlide(slide.id)}
                onDuplicate={() => duplicateSlide(slide.id)}
                needsContent={slide.kind === 'game' && !gameSlideReady(slide, cards)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          type="button"
          // 누를 때마다 열었다 닫았다(토글) 하면, 두 번째 클릭에 패널이 닫히며 이전 슬라이드 화면이 떠서
          // 헷갈린다(2026-09-26 사용자 피드백) — 항상 "추가 중" 상태로 연다. 닫기는 패널의 닫기 버튼으로.
          onClick={() => {
            setReplaceTargetId(null);
            setAddMode((m) => m ?? 'canvas');
          }}
          aria-pressed={!!addMode && !replaceTargetId}
          className={`flex shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-3 font-label-md text-label-md transition-colors lg:w-full ${
            addMode && !replaceTargetId
              ? 'border-primary bg-primary-fixed text-primary'
              : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">{addMode && !replaceTargetId ? 'edit_square' : 'add'}</span>
          {addMode && !replaceTargetId ? t('curriculum.slides.addingSlide', { n: slides.length + 1 }) : t('curriculum.slides.addSlide')}
        </button>
      </div>

      {/* 오른쪽: 슬라이드 추가 패널 또는 선택된 슬라이드 상세 */}
      <div className="min-w-0 flex-1 rounded-xl bg-surface-container-low p-4">
        {addMode && (
          <div className="mb-4 space-y-3 rounded-lg bg-surface-container-lowest p-4 shadow-sm">
            <div className="font-title-md text-title-md font-bold text-deep-navy">
              {replaceTargetId
                ? t('curriculum.slides.replacePanelTitle', { n: slides.findIndex((sl) => sl.id === replaceTargetId) + 1 })
                : t('curriculum.slides.addPanelTitle', { n: slides.length + 1 })}
            </div>
            <div className="flex flex-wrap gap-2">
              {(['canvas', 'image', 'video', 'web', 'reading', 'wordshow', 'study', 'grammar', 'game', 'material', 'attendance'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAddMode(m)}
                  className={`rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
                    addMode === m ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  {t(`curriculum.slides.addMode.${m}`)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAddMode(null)}
                className="ml-auto font-label-md text-label-md text-on-surface-variant hover:text-error"
              >
                {replaceTargetId ? t('curriculum.slides.cancelReplace') : t('curriculum.slides.closeAddPanel')}
              </button>
            </div>

            {addMode === 'image' && (
              <GameImagePicker
                academyId={academyId}
                value={null}
                onChange={() => {}}
                uploadFn={uploadLessonSlideImage}
                onUploaded={(img) => {
                  const slide: ImageSlide = { id: uid(), kind: 'image', imagePath: img.path, imageUrl: img.url };
                  addSlide(slide);
                  setAddMode(null);
                }}
              />
            )}

            {addMode === 'reading' && (
              <ReadingSlideForm
                onAdd={(draft) => {
                  addSlide({ id: uid(), kind: 'reading', boardTheme: 'green', ...draft });
                  setAddMode(null);
                }}
              />
            )}

            {addMode === 'grammar' && (
              <GrammarPickerPanel
                onPick={(grammarId) => {
                  addSlide({ id: uid(), kind: 'grammar', grammarId, useWordList: cards.length > 0, boardTheme: 'green' });
                  setAddMode(null);
                }}
              />
            )}

            {addMode === 'wordshow' && (
              <div className="space-y-3">
                <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.wordShow.addIntro')}</p>
                <div className="aspect-video w-full max-w-2xl">
                  <WordShowBoard words={cards} themeId={canvasDraftTheme ?? 'green'} interactive={false} />
                </div>
                <BoardThemeChips value={canvasDraftTheme ?? 'green'} onChange={(th) => setCanvasDraftTheme(th?.id ?? null)} />
                <div className="flex flex-wrap items-center gap-3">
                  <WordListSelect wordListId={wordListId} wordLists={wordLists} onWordListChange={onWordListChange} />
                  <button
                    type="button"
                    disabled={cards.length === 0}
                    onClick={() => {
                      addSlide({ id: uid(), kind: 'wordshow', boardTheme: canvasDraftTheme ?? 'green' });
                      setAddMode(null);
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    {t('curriculum.wordShow.addButton')}
                  </button>
                </div>
                {cards.length === 0 && <p className="font-caption text-caption text-error">{t('curriculum.study.needWordList')}</p>}
              </div>
            )}

            {addMode === 'attendance' && (
              <div className="space-y-3">
                <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.attendance.addIntro')}</p>
                <div className="aspect-video w-full max-w-2xl">
                  <AttendanceBoard academyId={academyId} classId={classId} teacherId={null} themeId={canvasDraftTheme ?? 'green'} interactive={false} />
                </div>
                <BoardThemeChips value={canvasDraftTheme ?? 'green'} onChange={(th) => setCanvasDraftTheme(th?.id ?? null)} />
                <button
                  type="button"
                  onClick={() => {
                    addSlide({ id: uid(), kind: 'attendance', boardTheme: canvasDraftTheme ?? 'green' });
                    setAddMode(null);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  {t('curriculum.attendance.addButton')}
                </button>
              </div>
            )}

            {addMode === 'study' && (
              <div className="space-y-3">
                <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.study.addIntro')}</p>
                <StudySlidePreview cards={cards} />
                <div className="flex flex-wrap items-center gap-3">
                  <WordListSelect wordListId={wordListId} wordLists={wordLists} onWordListChange={onWordListChange} />
                  <button
                    type="button"
                    disabled={cards.length === 0}
                    onClick={() => {
                      addSlide({ id: uid(), kind: 'study' });
                      setAddMode(null);
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    {t('curriculum.study.addButton')}
                  </button>
                </div>
                {cards.length === 0 && <p className="font-caption text-caption text-error">{t('curriculum.study.needWordList')}</p>}
              </div>
            )}

            {addMode === 'canvas' && (
              <div className="space-y-2">
                <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.canvas.addIntro')}</p>
                <div className="space-y-1">
                  <div className="font-caption text-caption font-bold text-on-surface-variant">{t('curriculum.board.pickTitle')}</div>
                  <BoardThemeChips value={canvasDraftTheme} onChange={(th) => setCanvasDraftTheme(th?.id ?? null)} noneLabel={t('curriculum.board.plainWhite')} />
                </div>
                {wordCardPicking ? (
                  <div className="space-y-3 rounded-xl border-2 border-primary/40 bg-surface-container-lowest p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-label-md text-label-md text-on-surface">{t('curriculum.canvas.pickWordsTitle')}</span>
                      <button
                        type="button"
                        onClick={() => setWordCardSelected((sel) => (sel.length === cards.length ? [] : cards.map((c) => c.id)))}
                        className="rounded-full border border-outline-variant px-3 py-1 font-caption text-caption text-on-surface-variant hover:border-primary hover:text-primary"
                      >
                        {wordCardSelected.length === cards.length ? t('curriculum.canvas.selectNone') : t('curriculum.canvas.selectAll')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWordCardPicking(false);
                          setWordCardSelected([]);
                        }}
                        className="ml-auto font-label-md text-label-md text-on-surface-variant hover:text-error"
                      >
                        {t('curriculum.canvas.backToLayouts')}
                      </button>
                    </div>
                    <div className="grid max-h-[320px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6">
                      {cards.map((card) => {
                        const on = wordCardSelected.includes(card.id);
                        const used = usedWords.has(card.word.trim().toLowerCase());
                        return (
                          <button
                            key={card.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setWordCardSelected((sel) => (on ? sel.filter((id) => id !== card.id) : [...sel, card.id]))}
                            className={`relative flex flex-col items-center gap-1 rounded-lg border-2 p-1.5 transition-colors ${
                              on ? 'border-primary bg-primary-fixed' : 'border-outline-variant/50 hover:border-primary/60'
                            }`}
                          >
                            {on && (
                              <span className="material-symbols-outlined absolute left-1 top-1 rounded-full bg-primary text-[16px] text-on-primary">check</span>
                            )}
                            {used && (
                              <span className="absolute right-1 top-1 rounded-full bg-secondary-container px-1.5 font-caption text-[10px] text-on-secondary-container">
                                {t('curriculum.canvas.alreadyMade')}
                              </span>
                            )}
                            <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded bg-surface-container">
                              {card.imageUrl ? (
                                <img src={card.imageUrl} alt="" className="h-full w-full object-contain" />
                              ) : (
                                <span className="material-symbols-outlined text-on-surface-variant">text_fields</span>
                              )}
                            </span>
                            <span className="w-full truncate text-center font-label-md text-label-md text-on-surface">{card.word}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={wordCardSelected.length === 0}
                      onClick={addWordCardSlides}
                      className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                      {t('curriculum.canvas.makeWordCards', { count: wordCardSelected.length })}
                    </button>
                  </div>
                ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(['title', 'word', 'blank'] as const).map((layout) => (
                    <button
                      key={layout}
                      type="button"
                      disabled={layout === 'word' && cards.length === 0}
                      title={layout === 'word' && cards.length === 0 ? t('curriculum.study.needWordList') : undefined}
                      onClick={() => (layout === 'word' ? setWordCardPicking(true) : addCanvasSlide(layout))}
                      className="flex flex-col items-center gap-2 rounded-xl border-2 border-outline-variant/50 bg-surface-container-lowest p-3 transition-colors hover:border-primary disabled:opacity-40"
                    >
                      <span className="flex aspect-video w-full items-center justify-center rounded-lg bg-surface-container">
                        <span className="material-symbols-outlined text-3xl text-on-surface-variant">
                          {layout === 'title' ? 'title' : layout === 'word' ? 'style' : 'crop_landscape'}
                        </span>
                      </span>
                      <span className="font-label-md text-label-md text-on-surface">{t(`curriculum.canvas.layout_${layout}`)}</span>
                    </button>
                  ))}
                </div>
                )}
              </div>
            )}

            {addMode === 'video' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={videoDraft}
                  onChange={(e) => setVideoDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addVideoSlide();
                  }}
                  placeholder={t('curriculum.videoUrlPlaceholder') ?? ''}
                  className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={addVideoSlide}
                  className="whitespace-nowrap rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container"
                >
                  {t('curriculum.slides.addSlide')}
                </button>
              </div>
            )}

            {addMode === 'web' && (
              <WebSlideAddForm
                url={webDraft.url}
                title={webDraft.title}
                onChange={(patch) => setWebDraft((d) => ({ ...d, ...patch }))}
                onAdd={addWebSlide}
              />
            )}

            {addMode === 'game' && (
              <div className="space-y-2">
                {CATEGORY_ORDER.map((cat) => (
                  <div key={cat} className="flex flex-wrap gap-1.5">
                    {GAME_CATALOG.filter((g) => g.category === cat).map((g) => (
                      <button
                        key={g.type}
                        type="button"
                        onClick={() => addGameSlide(g.type)}
                        className="flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1.5 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-secondary-container/40"
                      >
                        <span className="material-symbols-outlined text-[16px]">{g.icon}</span>
                        {t(g.nameKey)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {addMode === 'material' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => addGameSlide('flashcards')}
                  className="flex items-center gap-1 rounded-full bg-secondary-container px-3 py-1.5 font-label-md text-label-md text-on-secondary-container transition-colors hover:opacity-80"
                >
                  <span className="material-symbols-outlined text-[16px]">flip</span>
                  {t('curriculum.slides.onScreenFlashcards')}
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {MATERIALS_CATALOG.filter((m) => m.id !== 'worksheet' && m.id !== 'library').map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        if (m.id === 'phonics') {
                          // 파닉스 워크시트는 유형·단어를 슬라이드에서 정한다 — 바로 설정 화면으로
                          addMaterialSlide('phonics', undefined, undefined, null, { phonicsTab: 'phonicsBlank' });
                          setAddMode(null);
                        } else addMaterialSlide(m.id);
                      }}
                      className="flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1.5 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-secondary-container/40"
                    >
                      <span className="material-symbols-outlined text-[16px]">{m.icon}</span>
                      {t(m.nameKey)}
                    </button>
                  ))}
                </div>
                <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
                  <div className="mb-3">
                    <div className="font-label-md text-label-md text-on-surface">{t('curriculum.slides.worksheetTabsTitle')}</div>
                    <p className="mt-0.5 font-caption text-caption text-on-surface-variant">{t('curriculum.slides.worksheetPreviewHint')}</p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(250px,0.8fr)_minmax(360px,1.2fr)]">
                    <div className="grid max-h-[360px] grid-cols-2 content-start gap-2 overflow-y-auto pr-1">
                      {WORKSHEET_TAB_CATALOG.map((wt) => {
                        const active = worksheetDraftTab === wt.tab;
                        return (
                          <button
                            key={wt.tab}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setWorksheetDraftTab(wt.tab)}
                            className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left font-label-md text-label-md transition-colors ${active ? 'border-primary bg-primary text-on-primary shadow-sm' : 'border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:border-primary/50 hover:bg-secondary-container/30'}`}
                          >
                            <span className="material-symbols-outlined text-[19px]">{wt.icon}</span>
                            <span>{t(`materials.worksheet.${wt.labelKey}`)}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="rounded-xl bg-surface-container-lowest p-3 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-caption text-caption text-on-surface-variant">{t('curriculum.slides.previewTitle')}</div>
                          <div className="font-title-sm text-title-sm font-bold text-on-surface">
                            {t(`materials.worksheet.${WORKSHEET_TAB_CATALOG.find((wt) => wt.tab === worksheetDraftTab)?.labelKey ?? 'tabList'}`)}
                          </div>
                        </div>
                        <span className="rounded-full bg-secondary-container px-2.5 py-1 font-caption text-caption text-on-secondary-container">
                          {t('curriculum.slides.previewWordCount', { count: (worksheetDraftWords.words?.length ? worksheetDraftWords.words : cards).length })}
                        </span>
                      </div>
                      <WorksheetTypePreview
                        tab={worksheetDraftTab}
                        words={(worksheetDraftWords.words?.length ? worksheetDraftWords.words : cards)}
                        title={t(`materials.worksheet.${WORKSHEET_TAB_CATALOG.find((wt) => wt.tab === worksheetDraftTab)?.labelKey ?? 'tabList'}`)}
                        compact
                        boardTheme={worksheetDraftBoard}
                      />
                      {(worksheetDraftWords.words?.length ? worksheetDraftWords.words : cards).length === 0 && <p className="mt-2 text-center font-caption text-caption text-on-surface-variant">{t('curriculum.slides.previewSampleWords')}</p>}
                      <div className="mt-3">
                        <WordSourcePicker
                          kind="topic"
                          lessonCount={cards.length}
                          words={worksheetDraftWords.words}
                          topic={worksheetDraftWords.topic}
                          onChange={setWorksheetDraftWords}
                        />
                      </div>
                      <div className="mt-3 space-y-1.5 border-t border-outline-variant/40 pt-3">
                        <div className="font-caption text-caption font-bold text-on-surface-variant">{t('curriculum.board.worksheetTitle')}</div>
                        <BoardThemeChips value={worksheetDraftBoard} onChange={(th) => setWorksheetDraftBoard(th?.id ?? null)} noneLabel={t('curriculum.board.none')} />
                        <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.board.worksheetHint')}</p>
                      </div>
                      <div className="mt-3 space-y-2 border-t border-outline-variant/40 pt-3">
                        <div className="font-caption text-caption font-bold text-on-surface-variant">
                          {t('curriculum.slides.worksheetOptionsTitle')}
                        </div>
                        <WorksheetOptionsFields
                          tab={worksheetDraftTab}
                          hasWords={cards.length > 0}
                          listShow={worksheetDraftOptions.listShow}
                          onListShowChange={(key, value) => setWorksheetDraftOptions((prev) => ({ ...prev, listShow: { ...prev.listShow, [key]: value } }))}
                          tracingShow={worksheetDraftOptions.tracingShow}
                          onTracingShowChange={(key, value) => setWorksheetDraftOptions((prev) => ({ ...prev, tracingShow: { ...prev.tracingShow, [key]: value } }))}
                          showAnswerKey={worksheetDraftOptions.showAnswerKey}
                          onShowAnswerKeyChange={(value) => setWorksheetDraftOptions((prev) => ({ ...prev, showAnswerKey: value }))}
                          coloring={worksheetDraftOptions.coloring}
                          onColoringChange={(patch) => setWorksheetDraftOptions((prev) => ({ ...prev, coloring: { ...prev.coloring, ...patch } }))}
                          askTemplate={worksheetDraftOptions.askTemplate}
                          onAskTemplateChange={(value) => setWorksheetDraftOptions((prev) => ({ ...prev, askTemplate: value }))}
                          includeAnswers={worksheetDraftOptions.includeAnswers}
                          onIncludeAnswersChange={(value) => setWorksheetDraftOptions((prev) => ({ ...prev, includeAnswers: value }))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          addMaterialSlide(
                            'worksheet',
                            worksheetDraftTab,
                            slideOptionsFromState(worksheetDraftOptions),
                            worksheetDraftBoard,
                            worksheetDraftWords.words?.length ? { words: worksheetDraftWords.words, topic: worksheetDraftWords.topic } : undefined,
                          );
                          setWorksheetDraftWords({});
                        }}
                        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-lg text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
                      >
                        <span className="material-symbols-outlined text-[20px]">add_circle</span>
                        {t('curriculum.slides.addSelectedWorksheet')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 추가 패널이 열려있는 동안은 상세(바꾸기) 패널을 같이 보여주지 않는다 — 방금 추가한
            슬라이드가 자동 선택되면서 "게임 고르기"와 "게임 바꾸기"가 똑같은 그리드로 중복돼
            보이던 것을 없앤다(2026-09-24 사용자 피드백). 패널을 닫으면 그때 상세가 보인다. */}
        {!addMode &&
          (!selected ? (
            <div className="py-10 text-center font-body-md text-body-md text-on-surface-variant">
              {t('curriculum.slides.empty')}
            </div>
          ) : (
            <>
            <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-outline-variant/40 pb-3">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-inverse-surface px-2 font-label-md text-label-md text-inverse-on-surface">
                {slides.findIndex((s) => s.id === selected.id) + 1}
              </span>
              <span className="material-symbols-outlined text-[20px] text-primary">{slideThumbLabel(selected, t).icon}</span>
              <span className="min-w-0 flex-1 truncate font-label-md text-label-md text-on-surface">{slideThumbLabel(selected, t).label}</span>
              <button
                type="button"
                onClick={() => {
                  setReplaceTargetId(selected.id);
                  setAddMode(selected.kind as Exclude<AddMode, null>);
                }}
                title={t('curriculum.slides.replaceKindHint')}
                className="flex items-center gap-1 rounded-full border border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary-fixed"
              >
                <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                {t('curriculum.slides.replaceKind')}
              </button>
              {onPresentFrom && (
                <button
                  type="button"
                  onClick={() => onPresentFrom(selected.id)}
                  title={t('curriculum.slides.presentFromHint')}
                  className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container"
                >
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  {t('curriculum.slides.presentFrom')}
                </button>
              )}
            </div>
            <SlideDetail
              slide={selected}
              academyId={academyId}
              classId={classId}
              lessonName={lessonName}
              wordList={wordList}
              cards={cards}
              wordListId={wordListId}
              wordLists={wordLists}
              onWordListChange={onWordListChange}
              onUpdate={(patch) => updateSlide(selected.id, patch)}
              onInsertAfter={(slide) => {
                const idx = slides.findIndex((s) => s.id === selected.id);
                onChange([...slides.slice(0, idx + 1), slide, ...slides.slice(idx + 1)]);
                setSelectedId(slide.id);
              }}
            />
            </>
          ))}
      </div>
    </div>
    </WordListManageContext.Provider>
  );
}

function slideThumbLabel(slide: LessonSlide, t: (key: string) => string): { icon: string; label: string } {
  if (slide.kind === 'image') return { icon: 'image', label: t('curriculum.slides.kindImage') };
  if (slide.kind === 'study') return { icon: 'style', label: t('curriculum.slides.kindStudy') };
  if (slide.kind === 'wordshow') return { icon: 'menu_book', label: t('curriculum.slides.kindWordShow') };
  if (slide.kind === 'attendance') return { icon: 'how_to_reg', label: t('curriculum.slides.kindAttendance') };
  if (slide.kind === 'reading')
    return { icon: slide.mode === 'cloze' ? 'hearing' : 'lyrics', label: slide.title?.trim() || t('curriculum.reading.defaultTitle') };
  if (slide.kind === 'grammar') return { icon: 'rule', label: grammarPoint(slide.grammarId)?.name ?? t('curriculum.slides.kindGrammar') };
  if (slide.kind === 'canvas') {
    const firstText = slide.elements.find((el) => el.type === 'text' && el.text.trim());
    return {
      icon: 'dashboard_customize',
      label: firstText && firstText.type === 'text' ? firstText.text.trim().split(/\r?\n/)[0] : t('curriculum.slides.kindCanvas'),
    };
  }
  if (slide.kind === 'video') return { icon: 'smart_display', label: t('curriculum.slides.kindVideo') };
  if (slide.kind === 'web') {
    return {
      icon: slide.mode === 'window' ? 'menu_book' : 'language',
      label: slide.title?.trim() || webSlideHost(slide.url),
    };
  }
  if (slide.kind === 'game') {
    const entry = GAME_CATALOG.find((g) => g.type === slide.gameType);
    return { icon: entry?.icon ?? 'sports_esports', label: entry ? t(entry.nameKey) : slide.gameType };
  }
  if (slide.materialId === 'worksheet' && slide.worksheetTab) {
    const wt = WORKSHEET_TAB_CATALOG.find((w) => w.tab === slide.worksheetTab);
    if (wt) return { icon: wt.icon, label: t(`materials.worksheet.${wt.labelKey}`) };
  }
  const entry = MATERIALS_CATALOG.find((m) => m.id === slide.materialId);
  return { icon: entry?.icon ?? 'print', label: entry ? t(entry.nameKey) : slide.materialId };
}

function SlideThumb({
  slide,
  index,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  needsContent,
}: {
  slide: LessonSlide;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  /** 게임 슬라이드인데 발표 때 열 내용이 없음 — 썸네일에 경고 표시. */
  needsContent: boolean;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const { icon, label } = slideThumbLabel(slide, t);
  const videoId = slide.kind === 'video' ? extractYoutubeId(slide.videoUrl) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`group relative flex shrink-0 cursor-grab flex-col overflow-hidden rounded-xl border-2 transition-colors active:cursor-grabbing lg:w-full ${
        selected ? 'border-primary' : 'border-outline-variant/40'
      }`}
    >
      <div className="absolute left-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-inverse-surface/80 font-caption text-caption text-inverse-on-surface">
        {index + 1}
      </div>
      <div className="absolute right-1 top-1 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title={t('curriculum.slides.duplicate')}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-inverse-surface/80 text-inverse-on-surface hover:bg-inverse-surface"
        >
          <span className="material-symbols-outlined text-[14px]">content_copy</span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title={t('curriculum.slides.delete')}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-inverse-surface/80 text-inverse-on-surface hover:bg-error"
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>
      <div className="flex h-24 w-40 shrink-0 items-center justify-center bg-surface-container lg:w-full">
        {slide.kind === 'canvas' ? (
          <CanvasSlideView slide={slide} className="pointer-events-none" />
        ) : slide.kind === 'grammar' && grammarPoint(slide.grammarId) ? (
          <GrammarBoard
            point={grammarPoint(slide.grammarId)!}
            themeId={slide.boardTheme ?? 'green'}
            interactive={false}
            className="pointer-events-none"
          />
        ) : slide.kind === 'game' && GAME_CATALOG.find((g) => g.type === slide.gameType)?.cover ? (
          <img src={GAME_CATALOG.find((g) => g.type === slide.gameType)!.cover ?? undefined} alt="" className="h-full w-full object-cover" />
        ) : slide.kind === 'image' ? (
          <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : slide.kind === 'video' && videoId ? (
          <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-3xl text-on-surface-variant">{icon}</span>
        )}
      </div>
      <div className="flex items-center gap-1 bg-surface-container-lowest px-2 py-1.5 text-left font-caption text-caption text-on-surface">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {needsContent && (
          <span className="material-symbols-outlined shrink-0 text-[16px] text-error" title={t('curriculum.slides.gameContentMissing')}>
            error
          </span>
        )}
      </div>
    </div>
  );
}

function SlideDetail({
  slide,
  academyId,
  classId,
  lessonName,
  wordList,
  cards,
  wordListId,
  wordLists,
  onWordListChange,
  onUpdate,
  onInsertAfter,
}: {
  slide: LessonSlide;
  academyId: string;
  classId: string | null;
  lessonName: string;
  wordList: WordList | null;
  cards: FullCardItem[];
  wordListId: string;
  wordLists: WordList[];
  onWordListChange: (id: string) => void;
  onUpdate: (patch: Partial<LessonSlide>) => void;
  /** 이 슬라이드 바로 뒤에 새 슬라이드를 넣는다(문법 → 문장 배열하기 게임). */
  onInsertAfter: (slide: LessonSlide) => void;
}) {
  const { t } = useTranslation();

  if (slide.kind === 'reading') {
    return (
      <div className="space-y-3">
        <div className="aspect-video w-full max-w-3xl">
          <ReadingBoard
            source={slide.source}
            title={slide.title}
            videoUrl={slide.videoUrl}
            mode={slide.mode}
            themeId={slide.boardTheme ?? 'green'}
            interactive={false}
          />
        </div>
        <ReadingSlideForm
          initial={slide}
          onChange={(patch) => onUpdate(patch as Partial<LessonSlide>)}
        />
        <div className="space-y-1.5 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
          <div className="font-label-md text-label-md text-on-surface">{t('grammar.boardTitle')}</div>
          <BoardThemeChips value={slide.boardTheme ?? 'green'} onChange={(th) => onUpdate({ boardTheme: th?.id ?? 'green' } as Partial<LessonSlide>)} />
        </div>
      </div>
    );
  }

  if (slide.kind === 'grammar') {
    return (
      <GrammarSlideDetail
        slide={slide}
        academyId={academyId}
        classId={classId}
        cards={cards}
        wordListId={wordListId}
        wordLists={wordLists}
        onWordListChange={onWordListChange}
        onUpdate={(patch) => onUpdate(patch as Partial<LessonSlide>)}
        onInsertAfter={onInsertAfter}
      />
    );
  }

  if (slide.kind === 'wordshow') {
    return (
      <div className="space-y-3">
        <div className="aspect-video w-full max-w-3xl">
          <WordShowBoard words={cards} themeId={slide.boardTheme ?? 'green'} interactive={false} />
        </div>
        <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.wordShow.detailHint', { count: cards.length })}</p>
        <BoardThemeChips value={slide.boardTheme ?? 'green'} onChange={(th) => onUpdate({ boardTheme: th?.id ?? 'green' } as Partial<LessonSlide>)} />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
            <input type="checkbox" checked={!!slide.shuffle} onChange={(e) => onUpdate({ shuffle: e.target.checked } as Partial<LessonSlide>)} className="h-4 w-4 accent-primary" />
            {t('curriculum.study.shuffle')}
          </label>
          <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
            <input
              type="checkbox"
              checked={slide.autoSpeak !== false}
              onChange={(e) => onUpdate({ autoSpeak: e.target.checked } as Partial<LessonSlide>)}
              className="h-4 w-4 accent-primary"
            />
            {t('curriculum.wordShow.autoSpeak')}
          </label>
        </div>
        <WordListSelect wordListId={wordListId} wordLists={wordLists} onWordListChange={onWordListChange} />
        {cards.length === 0 && <p className="font-caption text-caption text-error">{t('curriculum.study.needWordList')}</p>}
      </div>
    );
  }

  if (slide.kind === 'attendance') {
    return (
      <div className="space-y-3">
        <div className="aspect-video w-full max-w-3xl">
          <AttendanceBoard academyId={academyId} classId={classId} teacherId={null} themeId={slide.boardTheme ?? 'green'} interactive={false} />
        </div>
        <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.attendance.detailHint')}</p>
        <BoardThemeChips value={slide.boardTheme ?? 'green'} onChange={(th) => onUpdate({ boardTheme: th?.id ?? 'green' } as Partial<LessonSlide>)} />
      </div>
    );
  }

  if (slide.kind === 'study') {
    return (
      <div className="space-y-3">
        <StudySlidePreview cards={cards} />
        <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.study.detailHint', { count: cards.length })}</p>
        <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
          <input
            type="checkbox"
            checked={!!slide.shuffle}
            onChange={(e) => onUpdate({ shuffle: e.target.checked } as Partial<LessonSlide>)}
            className="h-4 w-4 accent-primary"
          />
          {t('curriculum.study.shuffle')}
        </label>
        <WordListSelect wordListId={wordListId} wordLists={wordLists} onWordListChange={onWordListChange} />
        {cards.length === 0 && <p className="font-caption text-caption text-error">{t('curriculum.study.needWordList')}</p>}
      </div>
    );
  }

  if (slide.kind === 'canvas') {
    return (
      <CanvasSlideEditor
        slide={slide}
        academyId={academyId}
        cards={cards}
        onUpdate={(patch) => onUpdate(patch as Partial<LessonSlide>)}
      />
    );
  }

  if (slide.kind === 'image') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() =>
            // 그림은 배경으로 깔고 그 위에 글상자·그림을 얹을 수 있는 "직접 만들기" 슬라이드로 바꾼다.
            onUpdate({
              kind: 'canvas',
              background: '#ffffff',
              backgroundImageUrl: slide.imageUrl,
              backgroundImagePath: slide.imagePath,
              elements: [],
              imageUrl: undefined,
              imagePath: undefined,
            } as unknown as Partial<LessonSlide>)
          }
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container"
        >
          <span className="material-symbols-outlined text-[18px]">edit_note</span>
          {t('curriculum.canvas.convertImage')}
        </button>
        <PreviewFrame title={t('curriculum.slides.kindImage')}>
          <img src={slide.imageUrl} alt="" className="h-full w-full object-contain" />
        </PreviewFrame>
        <GameImagePicker
          academyId={academyId}
          value={slide.imageUrl}
          onChange={() => {}}
          uploadFn={uploadLessonSlideImage}
          onUploaded={(img) => {
            onUpdate({ imagePath: img.path, imageUrl: img.url } as Partial<ImageSlide>);
          }}
        />
      </div>
    );
  }

  if (slide.kind === 'video') {
    const videoId = extractYoutubeId(slide.videoUrl);
    return (
      <div className="space-y-3">
        <PreviewFrame title={t('curriculum.slides.kindVideo')}>
          {videoId ? <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" /> : <span className="material-symbols-outlined text-6xl text-on-surface-variant">smart_display</span>}
        </PreviewFrame>
        <input
          type="text"
          value={slide.videoUrl}
          onChange={(e) => onUpdate({ videoUrl: e.target.value } as Partial<VideoSlide>)}
          className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>
    );
  }

  if (slide.kind === 'web') {
    return <WebSlideDetail slide={slide} onUpdate={(patch) => onUpdate(patch as Partial<LessonSlide>)} />;
  }

  if (slide.kind === 'game') {
    return (
      <GameSlideEditor
        slide={slide}
        academyId={academyId}
        classId={classId}
        lessonName={lessonName}
        wordList={wordList}
        cards={cards}
        wordListId={wordListId}
        wordLists={wordLists}
        onWordListChange={onWordListChange}
        onUpdate={(patch) => onUpdate(patch as Partial<LessonSlide>)}
      />
    );
  }

  // material slide
  if (slide.materialId === 'phonics') {
    return <PhonicsSlideDetail slide={slide} cards={cards} onUpdate={(patch) => onUpdate(patch as Partial<LessonSlide>)} />;
  }
  const material = MATERIALS_CATALOG.find((m) => m.id === slide.materialId);
  // 이 슬라이드만의 단어(주제에서 고른 것)가 있으면 그걸로 미리보기
  const wsWords = slide.words && slide.words.length > 0 ? slide.words : cards;
  const worksheet = slide.materialId === 'worksheet'
    ? WORKSHEET_TAB_CATALOG.find((wt) => wt.tab === slide.worksheetTab) ?? WORKSHEET_TAB_CATALOG[0]
    : null;
  const worksheetOptionsState = optionsStateFromSlide(slide.worksheetOptions);
  function updateWorksheetOptions(patch: Partial<WorksheetOptionsState>) {
    const next = { ...worksheetOptionsState, ...patch };
    onUpdate({ worksheetOptions: slideOptionsFromState(next) } as Partial<MaterialSlide>);
  }
  return (
    <div className="space-y-4">
      {worksheet ? (
        <div className="rounded-xl bg-surface-container-lowest p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="font-caption text-caption text-on-surface-variant">{t('curriculum.slides.previewTitle')}</div>
              <div className="font-title-sm text-title-sm font-bold text-on-surface">{t(`materials.worksheet.${worksheet.labelKey}`)}</div>
            </div>
            <span className="rounded-full bg-secondary-container px-2.5 py-1 font-caption text-caption text-on-secondary-container">{t('curriculum.slides.previewWordCount', { count: wsWords.length })}</span>
          </div>
          <WorksheetTypePreview
            tab={worksheet.tab}
            words={wsWords}
            title={t(`materials.worksheet.${worksheet.labelKey}`)}
            boardTheme={slide.boardTheme ?? null}
          />
          {wsWords.length === 0 && <p className="mt-2 text-center font-caption text-caption text-on-surface-variant">{t('curriculum.slides.previewSampleWords')}</p>}
          <div className="mt-3">
            <WordSourcePicker
              kind="topic"
              lessonCount={cards.length}
              words={slide.words}
              topic={slide.topic}
              onChange={(next) => onUpdate({ words: next.words, topic: next.topic } as Partial<MaterialSlide>)}
            />
          </div>
          <div className="mt-3 space-y-1.5 border-t border-outline-variant/40 pt-3">
            <div className="font-caption text-caption font-bold text-on-surface-variant">{t('curriculum.board.worksheetTitle')}</div>
            <BoardThemeChips
              value={slide.boardTheme ?? null}
              onChange={(th) => onUpdate({ boardTheme: th?.id ?? null } as Partial<MaterialSlide>)}
              noneLabel={t('curriculum.board.none')}
            />
            <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.board.worksheetHint')}</p>
          </div>
        </div>
      ) : (
        <PreviewFrame title={material ? t(material.nameKey) : slide.materialId}>
          {material?.cover ? <img src={material.cover} alt="" className="h-full w-full object-cover" /> : <span className="material-symbols-outlined text-6xl text-primary">{material?.icon ?? 'print'}</span>}
        </PreviewFrame>
      )}
      <div>
        <div className="mb-1.5 font-label-md text-label-md text-on-surface-variant">{t('curriculum.slides.changeMaterial')}</div>
        <div className="flex flex-wrap gap-1.5">
          {MATERIALS_CATALOG.filter((m) => m.id !== 'worksheet' && m.id !== 'library').map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                onUpdate(
                  (m.id === 'phonics'
                    ? { materialId: m.id, worksheetTab: undefined, phonicsTab: slide.phonicsTab ?? 'phonicsBlank', words: undefined, topic: undefined }
                    : { materialId: m.id, worksheetTab: undefined }) as Partial<MaterialSlide>,
                )
              }
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
                slide.materialId === m.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-secondary-container/40'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{m.icon}</span>
              {t(m.nameKey)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 font-label-md text-label-md text-on-surface-variant">
          {t('curriculum.slides.worksheetTabsTitle')}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WORKSHEET_TAB_CATALOG.map((wt) => (
            <button
              key={wt.tab}
              type="button"
              onClick={() => onUpdate({ materialId: 'worksheet', worksheetTab: wt.tab } as Partial<MaterialSlide>)}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
                slide.materialId === 'worksheet' && slide.worksheetTab === wt.tab
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-secondary-container/40'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{wt.icon}</span>
              {t(`materials.worksheet.${wt.labelKey}`)}
            </button>
          ))}
        </div>
      </div>
      {worksheet && (
        <div className="space-y-2 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
          <div className="font-label-md text-label-md text-on-surface">{t('curriculum.slides.worksheetOptionsTitle')}</div>
          <WorksheetOptionsFields
            tab={worksheet.tab}
            hasWords={wsWords.length > 0}
            listShow={worksheetOptionsState.listShow}
            onListShowChange={(key, value) => updateWorksheetOptions({ listShow: { ...worksheetOptionsState.listShow, [key]: value } })}
            tracingShow={worksheetOptionsState.tracingShow}
            onTracingShowChange={(key, value) => updateWorksheetOptions({ tracingShow: { ...worksheetOptionsState.tracingShow, [key]: value } })}
            showAnswerKey={worksheetOptionsState.showAnswerKey}
            onShowAnswerKeyChange={(value) => updateWorksheetOptions({ showAnswerKey: value })}
            coloring={worksheetOptionsState.coloring}
            onColoringChange={(patch) => updateWorksheetOptions({ coloring: { ...worksheetOptionsState.coloring, ...patch } })}
            askTemplate={worksheetOptionsState.askTemplate}
            onAskTemplateChange={(value) => updateWorksheetOptions({ askTemplate: value })}
            includeAnswers={worksheetOptionsState.includeAnswers}
            onIncludeAnswersChange={(value) => updateWorksheetOptions({ includeAnswers: value })}
          />
        </div>
      )}
      <WordListSelect wordListId={wordListId} wordLists={wordLists} onWordListChange={onWordListChange} />
    </div>
  );
}

/** 슬라이드 안에 띄우기 / 새 창으로 열기 선택 — 선생님이 결과를 보고 바꿀 수 있게. */
function WebModeToggle({ mode, onChange }: { mode: WebSlide['mode']; onChange: (mode: WebSlide['mode']) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {(['embed', 'window'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onChange(m)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md transition-colors ${
              mode === m ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-secondary-container/40'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{m === 'embed' ? 'web_asset' : 'open_in_new'}</span>
            {t(`curriculum.web.mode_${m}`)}
          </button>
        ))}
      </div>
      <p className="font-caption text-caption text-on-surface-variant">{t(`curriculum.web.modeHint_${mode}`)}</p>
    </div>
  );
}

/** 추가 패널의 웹페이지 입력 — 주소를 넣는 순간 어떤 방식으로 보일지(캔바=슬라이드 안, 로그인 E-book=새
 * 창) 미리 알려준다. */
function WebSlideAddForm({
  url,
  title,
  onChange,
  onAdd,
}: {
  url: string;
  title: string;
  onChange: (patch: { url?: string; title?: string }) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const normalized = url.trim() ? normalizeWebUrl(url) : null;
  return (
    <div className="space-y-3">
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t('curriculum.web.addIntro')}</p>
      <input
        type="text"
        value={url}
        onChange={(e) => onChange({ url: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onAdd();
        }}
        placeholder={t('curriculum.web.urlPlaceholder') ?? ''}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      <input
        type="text"
        value={title}
        onChange={(e) => onChange({ title: e.target.value })}
        maxLength={40}
        placeholder={t('curriculum.web.titlePlaceholder') ?? ''}
        className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      {normalized && (
        <div className="rounded-lg bg-secondary-container/30 px-3 py-2 font-body-sm text-body-sm text-on-surface">
          <span className="material-symbols-outlined mr-1 align-middle text-[18px]">
            {normalized.mode === 'embed' ? 'web_asset' : 'open_in_new'}
          </span>
          {t(`curriculum.web.detected_${normalized.provider}_${normalized.mode}`, {
            defaultValue: t(`curriculum.web.detected_other_${normalized.mode}`),
          })}
        </div>
      )}
      {url.trim() && !normalized && <p className="font-caption text-caption text-error">{t('curriculum.web.invalidUrl')}</p>}
      <button
        type="button"
        disabled={!normalized}
        onClick={onAdd}
        className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-50"
      >
        {t('curriculum.slides.addSlide')}
      </button>
      <details className="rounded-lg bg-surface-container-low px-3 py-2 font-caption text-caption text-on-surface-variant">
        <summary className="cursor-pointer font-label-md text-label-md text-on-surface">{t('curriculum.web.howToTitle')}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t('curriculum.web.howToCanva')}</li>
          <li>{t('curriculum.web.howToEbook')}</li>
        </ul>
      </details>
    </div>
  );
}

function WebSlideDetail({ slide, onUpdate }: { slide: WebSlide; onUpdate: (patch: Partial<WebSlide>) => void }) {
  const { t } = useTranslation();
  const [urlDraft, setUrlDraft] = useState(slide.url);
  useEffect(() => setUrlDraft(slide.url), [slide.id, slide.url]);

  function commitUrl() {
    const normalized = normalizeWebUrl(urlDraft);
    if (!normalized) {
      setUrlDraft(slide.url);
      return;
    }
    if (normalized.url !== slide.url) onUpdate({ url: normalized.url, mode: normalized.mode });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-container-lowest p-3 shadow-sm">
        <div className="mb-2 font-caption text-caption text-on-surface-variant">{t('curriculum.slides.previewTitle')}</div>
        <WebSlideView slide={slide} fill={false} />
      </div>
      <label className="block">
        <span className="mb-1 block font-label-md text-label-md text-on-surface-variant">{t('curriculum.web.urlLabel')}</span>
        <input
          type="text"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onBlur={commitUrl}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitUrl();
          }}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-label-md text-label-md text-on-surface-variant">{t('curriculum.web.titleLabel')}</span>
        <input
          type="text"
          value={slide.title ?? ''}
          maxLength={40}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder={webSlideHost(slide.url)}
          className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </label>
      <WebModeToggle mode={slide.mode} onChange={(mode) => onUpdate({ mode })} />
    </div>
  );
}

function PreviewFrame({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl bg-surface-container-lowest p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="font-caption text-caption text-on-surface-variant">{t('curriculum.slides.previewTitle')}</div>
          <div className="font-title-sm text-title-sm font-bold text-on-surface">{title}</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-caption text-caption text-primary">
          <span className="material-symbols-outlined text-[15px]">visibility</span>
          {t('curriculum.slides.previewBadge')}
        </span>
      </div>
      <div className="flex aspect-video max-h-[360px] w-full items-center justify-center overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container-low">{children}</div>
    </div>
  );
}

/** 게임 슬라이드가 발표 때 열 "게임 내용"(game_templates) — 이 반에 이미 만든 것 중 고르거나,
 * 수업 단어장으로 지금 새로 만든다. 아무것도 안 고르면 저장할 때 수업 단어장으로 자동으로 만든다
 * (CurriculumPage.handleSave). */
/**
 * 게임 슬라이드 상세 — 게임 센터의 그 게임 설정 화면을 그대로 띄운다(2026-09-26 사용자 피드백:
 * 표지 그림 + 게임 목록 + 내용 드롭다운이 따로 있으면 헷갈린다). 게임 페이지 35종이 모두 쓰는
 * useGameTemplates 가 GameEmbedContext 를 읽어, 반은 레슨의 반으로 고정하고, 선생님이 화면에서
 * 고르거나 새로 만든 게임 내용(템플릿)을 이 슬라이드의 templateId 로 되돌려 준다.
 */
function GameSlideEditor({
  slide,
  academyId,
  classId,
  lessonName,
  wordList,
  cards,
  wordListId,
  wordLists,
  onWordListChange,
  onUpdate,
}: {
  slide: GameSlide;
  academyId: string;
  classId: string | null;
  lessonName: string;
  wordList: WordList | null;
  cards: FullCardItem[];
  wordListId: string;
  wordLists: WordList[];
  onWordListChange: (id: string) => void;
  onUpdate: (patch: Partial<GameSlide>) => void;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { notify } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  // "지금 단어장으로 만들기"로 템플릿을 새로 만들면 게임 화면을 다시 그려 그 템플릿을 연다.
  const [reloadKey, setReloadKey] = useState(0);
  const game = GAME_CATALOG.find((g) => g.type === slide.gameType);
  const GamePage = game ? GAME_PAGES[game.path] : undefined;

  const content = useMemo(() => buildGameContent(slide.gameType, cards), [slide.gameType, cards]);

  async function createNow() {
    if (!profile || !content || creating) return;
    setCreating(true);
    try {
      const tpl = await createGameTemplate({
        academyId,
        classId,
        gameType: slide.gameType,
        name: lessonGameTemplateName(lessonName || t('curriculum.slides.gameContentDefaultName'), wordList?.name),
        items: content.items,
        config: content.config,
        teacherId: profile.id,
      });
      onUpdate({ templateId: tpl.id });
      setReloadKey((k) => k + 1);
      notify(t('curriculum.slides.gameContentCreated'));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setCreating(false);
    }
  }

  // 슬라이드의 templateId 는 onSelect 로만 바뀐다 — 매 렌더 새 객체를 만들어도 useGameTemplates 는
  // 바뀐 값만 보고하므로 되먹임 반복이 없다.
  const embed = useMemo(
    () => ({
      classId,
      templateId: slide.templateId,
      onSelect: (id: string | null) => onUpdate({ templateId: id ?? undefined }),
    }),
    // templateId 는 처음 열 때만 쓴다 — 선택할 때마다 새 값으로 다시 그리지 않게 뺀다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classId, slide.id, slide.gameType, reloadKey],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-lowest p-3 shadow-sm">
        <span className="material-symbols-outlined text-[22px] text-primary">{game?.icon ?? 'sports_esports'}</span>
        <span className="font-title-md text-title-md font-bold text-on-surface">{game ? t(game.nameKey) : slide.gameType}</span>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1.5 font-label-md text-label-md text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
        >
          <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
          {t('curriculum.slides.changeGame')}
          <span className="material-symbols-outlined text-[18px]">{pickerOpen ? 'expand_less' : 'expand_more'}</span>
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <WordListSelect wordListId={wordListId} wordLists={wordLists} onWordListChange={onWordListChange} />
          {content && (
            <button
              type="button"
              disabled={creating}
              onClick={() => void createNow()}
              className="inline-flex items-center gap-1 rounded-full border-2 border-primary px-4 py-1.5 font-label-md text-label-md text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              {creating ? t('curriculum.slides.gameContentCreating') : t('curriculum.slides.gameContentCreateNow')}
            </button>
          )}
        </div>
        {pickerOpen && (
          <div className="w-full space-y-2 border-t border-outline-variant/40 pt-3">
            {CATEGORY_ORDER.map((cat) => (
              <div key={cat} className="flex flex-wrap gap-1.5">
                {GAME_CATALOG.filter((g) => g.category === cat).map((g) => (
                  <button
                    key={g.type}
                    type="button"
                    onClick={() => {
                      // 게임 종류가 바뀌면 이전 게임의 내용(템플릿)은 맞지 않으니 비운다.
                      if (slide.gameType !== g.type) onUpdate({ gameType: g.type, templateId: undefined });
                      setPickerOpen(false);
                    }}
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
                      slide.gameType === g.type
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-secondary-container/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{g.icon}</span>
                    {t(g.nameKey)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="flex items-center gap-1 px-1 font-caption text-caption text-on-surface-variant">
        <span className="material-symbols-outlined text-[16px] text-primary">info</span>
        {t('curriculum.slides.gameEmbedHint')}
      </p>
      {GamePage ? (
        <div className="game-embed rounded-xl bg-background p-3 md:p-4">
          <GameEmbedContext.Provider value={embed}>
            <GamePage key={`${slide.id}:${slide.gameType}:${reloadKey}`} />
          </GameEmbedContext.Provider>
        </div>
      ) : null}
    </div>
  );
}

type ReadingDraft = { title?: string; source: string; videoUrl?: string | null; mode: 'lines' | 'cloze' };

/** 노래·지문 슬라이드 입력 — 추가 패널(onAdd)과 상세(onChange, 바로 반영) 둘 다 쓴다. */
function ReadingSlideForm({
  initial,
  onAdd,
  onChange,
}: {
  initial?: ReadingDraft;
  onAdd?: (draft: ReadingDraft) => void;
  onChange?: (patch: Partial<ReadingDraft>) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ReadingDraft>(initial ?? { title: '', source: '', videoUrl: '', mode: 'lines' });
  const lineCount = parseReadingText(draft.source).length;
  function set(patch: Partial<ReadingDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    onChange?.(patch);
  }
  const input = 'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary';
  return (
    <div className="space-y-3">
      {onAdd && <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.reading.addIntro')}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={input} value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder={t('curriculum.reading.titlePlaceholder')} />
        <input className={input} value={draft.videoUrl ?? ''} onChange={(e) => set({ videoUrl: e.target.value })} placeholder={t('curriculum.reading.videoPlaceholder')} />
      </div>
      <div className="flex flex-wrap gap-2">
        {(['lines', 'cloze'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => set({ mode: m })}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 font-label-md text-label-md ${draft.mode === m ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[18px]">{m === 'cloze' ? 'hearing' : 'lyrics'}</span>
            {t(`curriculum.reading.mode_${m}`)}
          </button>
        ))}
      </div>
      <textarea
        className={`${input} min-h-[180px] font-mono`}
        value={draft.source}
        onChange={(e) => set({ source: e.target.value })}
        placeholder={t('curriculum.reading.sourcePlaceholder')}
      />
      <p className="font-caption text-caption text-on-surface-variant">
        {t('curriculum.reading.formatHint')} · {t('curriculum.reading.lineCount', { count: lineCount })}
      </p>
      {onAdd && (
        <button
          type="button"
          disabled={lineCount === 0}
          onClick={() => onAdd({ ...draft, title: draft.title?.trim() || undefined, videoUrl: draft.videoUrl?.trim() || null })}
          className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          {t('curriculum.study.addButton')}
        </button>
      )}
    </div>
  );
}

/** 문법 고르기(슬라이드 추가 패널) — 레벨 칩 + 목록, 누르면 바로 슬라이드가 된다. */
export function GrammarPickerPanel({ onPick }: { onPick: (grammarId: string) => void }) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<GrammarStage>('elementary');
  const [level, setLevel] = useState<number>(1);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  // 검색어가 있으면 과정·레벨과 상관없이 전체 127개에서 찾는다.
  const list = q
    ? GRAMMAR_POINTS.filter((g) => g.name.toLowerCase().includes(q) || g.pattern.toLowerCase().includes(q) || g.explain.includes(q))
    : GRAMMAR_POINTS.filter((g) => g.level === level);
  return (
    <div className="space-y-3">
      <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.grammarSlide.addIntro')}</p>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('grammar.searchPlaceholder')}
        className="w-full max-w-sm rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      <div className={`flex flex-wrap gap-1.5 ${q ? 'hidden' : ''}`}>
        {GRAMMAR_STAGES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => {
              setStage(st);
              setLevel(GRAMMAR_LEVELS_BY_STAGE[st][0]);
            }}
            className={`rounded-lg border px-3 py-1.5 font-label-md text-label-md ${
              stage === st ? 'border-primary bg-primary-fixed text-primary' : 'border-outline-variant text-on-surface-variant'
            }`}
          >
            {t(`grammar.stage_${st}`)}
          </button>
        ))}
      </div>
      <div className={`flex flex-wrap gap-1.5 ${!q && GRAMMAR_LEVELS_BY_STAGE[stage].length > 1 ? '' : 'hidden'}`}>
        {GRAMMAR_LEVELS_BY_STAGE[stage].map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => setLevel(lv)}
            className={`rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
              level === lv ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
            }`}
          >
            {stage === 'elementary' ? `Lv.${lv} ${t(`grammar.level${lv}`)}` : t(`grammar.level${lv}`)}
          </button>
        ))}
      </div>
      <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {list.length === 0 && <p className="font-caption text-caption text-on-surface-variant">{t('grammar.noResults')}</p>}
        {list.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onPick(g.id)}
            className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-left transition-colors hover:border-primary hover:bg-secondary-container/30"
          >
            <div className="font-label-md text-label-md text-on-surface">{g.name}</div>
            <div className="font-caption text-caption text-on-surface-variant">
              {q ? `${t(`grammar.stage_${g.stage}`)} · ` : ''}
              {grammarLevelTag(g)} · {g.pattern.replace(/\*\*/g, '')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 문법 슬라이드 상세 — 칠판 미리보기, 문법 바꾸기, 수업 단어장 예문, 배경, 문장 배열하기 게임 붙이기. */
function GrammarSlideDetail({
  slide,
  academyId,
  classId,
  cards: rawCards,
  wordListId,
  wordLists,
  onWordListChange,
  onUpdate,
  onInsertAfter,
}: {
  slide: Extract<LessonSlide, { kind: 'grammar' }>;
  academyId: string;
  classId: string | null;
  cards: FullCardItem[];
  wordListId: string;
  wordLists: WordList[];
  onWordListChange: (id: string) => void;
  onUpdate: (patch: Partial<Extract<LessonSlide, { kind: 'grammar' }>>) => void;
  onInsertAfter: (slide: LessonSlide) => void;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { notify } = useToast();
  const [creating, setCreating] = useState(false);
  const cards = useGrammarCards(rawCards);
  const point = grammarPoint(slide.grammarId) ?? GRAMMAR_POINTS[0];
  const generated = useMemo(
    () => (slide.useWordList ? buildWordListSentences(point, cards, 6, slide.seed ?? 0) : []),
    [point, cards, slide.useWordList, slide.seed],
  );
  const possible = useMemo(() => buildWordListSentences(point, cards, 1, 0).length > 0, [point, cards]);

  async function addUnscrambleSlide() {
    if (!profile || creating) return;
    const sentences = sentencesForUnscramble(point, generated);
    if (sentences.length === 0) {
      notify(t('grammar.noSentencesForGame'), 'error');
      return;
    }
    setCreating(true);
    try {
      const tpl = await createGameTemplate({
        academyId,
        classId,
        gameType: 'unscramble',
        name: t('grammar.gameTemplateName', { name: point.name }),
        items: sentences.map((label) => ({ id: uid(), label })),
        teacherId: profile.id,
      });
      onInsertAfter({ id: uid(), kind: 'game', gameType: 'unscramble', templateId: tpl.id });
      notify(t('curriculum.grammarSlide.gameAdded'));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="aspect-video w-full max-w-3xl">
        <GrammarBoard
          point={point}
          extra={generated}
          themeId={slide.boardTheme ?? 'green'}
          interactive={false}
          initialShowKo={!!slide.showKo}
        />
      </div>
      <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.grammarSlide.previewHint')}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
        <div className="w-full font-label-md text-label-md text-on-surface">{t('curriculum.grammarSlide.startTitle')}</div>
        <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface">
          <input type="checkbox" checked={!!slide.revealAll} onChange={(e) => onUpdate({ revealAll: e.target.checked })} className="h-4 w-4 accent-primary" />
          {t('curriculum.grammarSlide.revealAll')}
        </label>
        <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface">
          <input type="checkbox" checked={!!slide.showKo} onChange={(e) => onUpdate({ showKo: e.target.checked })} className="h-4 w-4 accent-primary" />
          {t('curriculum.grammarSlide.showKo')}
        </label>
      </div>
      <details className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest">
        <summary className="cursor-pointer px-4 py-3 font-label-md text-label-md text-primary">
          {t('curriculum.grammarSlide.explainToggle', { name: point.name })}
        </summary>
        <div className="px-1 pb-1">
          <GrammarExplainCard point={point} />
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={point.id}
          onChange={(e) => onUpdate({ grammarId: e.target.value })}
          className="w-80 max-w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
        >
          {GRAMMAR_STAGES.flatMap((st) => GRAMMAR_LEVELS_BY_STAGE[st].map((lv) => ({ st, lv }))).map(({ st, lv }) => (
            <optgroup key={lv} label={st === 'elementary' ? `Lv.${lv} ${t(`grammar.level${lv}`)}` : `${t(`grammar.stage_${st}`)} · ${t(`grammar.level${lv}`)}`}>
              {GRAMMAR_POINTS.filter((g) => g.level === lv).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          disabled={creating}
          onClick={() => void addUnscrambleSlide()}
          className="flex items-center gap-1.5 rounded-full border-2 border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">reorder</span>
          {creating ? t('grammar.creatingGame') : t('curriculum.grammarSlide.addUnscramble')}
        </button>
      </div>
      <div className="space-y-2 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
        <div className="font-label-md text-label-md text-on-surface">{t('grammar.wordListTitle')}</div>
        {!point.slots ? (
          <p className="font-caption text-caption text-on-surface-variant">{t('grammar.noSlots')}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface">
                <input
                  type="checkbox"
                  checked={!!slide.useWordList}
                  onChange={(e) => onUpdate({ useWordList: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                {t('grammar.showOnBoard')}
              </label>
              {slide.useWordList && generated.length > 0 && (
                <button
                  type="button"
                  onClick={() => onUpdate({ seed: (slide.seed ?? 0) + 1 })}
                  className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">shuffle</span>
                  {t('grammar.reshuffle')}
                </button>
              )}
            </div>
            {slide.useWordList && !possible && (
              <p className="font-caption text-caption text-on-surface-variant">
                {cards.length === 0 ? t('curriculum.study.needWordList') : t('grammar.noMatchingWords')}
              </p>
            )}
            <p className="font-caption text-caption text-on-surface-variant">{t('grammar.wordListHint')}</p>
          </>
        )}
        <WordListSelect wordListId={wordListId} wordLists={wordLists} onWordListChange={onWordListChange} />
      </div>
      <div className="space-y-1.5 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
        <div className="font-label-md text-label-md text-on-surface">{t('grammar.boardTitle')}</div>
        <BoardThemeChips value={slide.boardTheme ?? 'green'} onChange={(th) => onUpdate({ boardTheme: th?.id ?? 'green' })} />
      </div>
    </div>
  );
}

/** "카드로 외우기" 슬라이드 미리보기 — 발표 때 보일 첫 카드(그림 + 단어)를 작게. */
function StudySlidePreview({ cards }: { cards: FullCardItem[] }) {
  const { t } = useTranslation();
  const first = cards[0];
  return (
    <div className="flex aspect-video w-full max-w-xl flex-col rounded-xl bg-inverse-surface p-3">
      <div className="font-caption text-caption text-inverse-on-surface">
        {t('curriculum.slides.kindStudy')} · 1/{cards.length}
      </div>
      <div className="flex flex-1 items-center justify-center py-2">
        <div className="flex h-full w-4/5 flex-col items-center justify-center gap-2 rounded-2xl bg-surface-container-lowest p-3">
          {first?.imageUrl && <img src={first.imageUrl} alt="" className="max-h-[55%] rounded-lg object-contain" />}
          <span className="font-title-md text-[28px] font-bold text-deep-navy">{first?.word ?? 'apple'}</span>
        </div>
      </div>
    </div>
  );
}

function WordListSelect({
  wordListId,
  wordLists,
  onWordListChange,
}: {
  wordListId: string;
  wordLists: WordList[];
  onWordListChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const onManage = useContext(WordListManageContext);
  return (
    <div>
      <label className="mb-1.5 block font-label-md text-label-md text-on-surface-variant">
        {t('curriculum.slides.lessonWordList')}
      </label>
      <select
        value={wordListId}
        onChange={(e) => onWordListChange(e.target.value)}
        className="w-64 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      >
        <option value="">{t('curriculum.wordListPlaceholder')}</option>
        {wordLists.map((wl) => (
          <option key={wl.id} value={wl.id}>
            {wl.name} ({wl.items.length})
          </option>
        ))}
      </select>
      {onManage && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onManage('new')}
            className="flex items-center gap-1 rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary-fixed"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            {t('curriculum.wordListTools.newButton')}
          </button>
          <button
            type="button"
            disabled={!wordListId}
            onClick={() => onManage('edit')}
            className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            {t('curriculum.wordListTools.editButton')}
          </button>
        </div>
      )}
    </div>
  );
}

/** 슬라이드 패널 곳곳의 단어장 고르기 옆 "새 단어장·단어 고치기" 버튼이 쓰는 창 열기 함수. */
const WordListManageContext = createContext<((mode: 'new' | 'edit') => void) | undefined>(undefined);

/** 파닉스 워크시트 슬라이드 설정(2026-09-27) — 유형·단어(수업 단어장 또는 파닉스 단계)·옵션을 미리 정해 두면
 * 발표 중엔 파닉스 워크시트 페이지가 고르는 화면 없이 이대로 보여 준다. */
function PhonicsSlideDetail({
  slide,
  cards,
  onUpdate,
}: {
  slide: MaterialSlide;
  cards: FullCardItem[];
  onUpdate: (patch: Partial<MaterialSlide>) => void;
}) {
  const { t } = useTranslation();
  const tab = slide.phonicsTab ?? 'phonicsBlank';
  const own = slide.words && slide.words.length > 0;
  const lessonPhonics = cards.filter((c) => c.patternMarked).length;
  return (
    <div className="space-y-4">
      <PreviewFrame title={`${t('materials.phonicsLibraryName')} · ${phonicsTabLabel(tab, t)}`}>
        <span className="material-symbols-outlined text-6xl text-primary">abc</span>
      </PreviewFrame>
      <div>
        <div className="mb-1.5 font-label-md text-label-md text-on-surface-variant">{t('curriculum.wordSource.phonicsType')}</div>
        <div className="flex flex-wrap gap-1.5">
          {PHONICS_SLIDE_TABS.map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => onUpdate({ phonicsTab: pt })}
              className={`rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
                tab === pt ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-secondary-container/40'
              }`}
            >
              {phonicsTabLabel(pt, t)}
            </button>
          ))}
        </div>
      </div>
      <WordSourcePicker
        kind="phonics"
        lessonCount={cards.length}
        words={slide.words}
        onChange={(next) => onUpdate({ words: next.words, topic: undefined })}
      />
      {!own && cards.length > 0 && lessonPhonics === 0 && (
        <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.wordSource.lessonNotPhonics')}</p>
      )}
      <div className="space-y-2 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
        <div className="font-label-md text-label-md text-on-surface">{t('curriculum.slides.worksheetOptionsTitle')}</div>
        <PhonicsOptionsFields value={slide.phonicsOptions ?? {}} onChange={(phonicsOptions) => onUpdate({ phonicsOptions })} />
      </div>
      <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.wordSource.phonicsPresentHint')}</p>
    </div>
  );
}
