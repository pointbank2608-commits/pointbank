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
import StemFrameView from './stem/StemFrameView';
import {stemPlaylist} from '../lib/stem';
import VideoThumbnail from './VideoThumbnail';
import AccessibleDialog from './AccessibleDialog';
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
import type { TFunction } from 'i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createGameTemplate, fetchAllWordLists, fetchWordLists, uploadLessonSlideImage } from '../lib/api';
import { GAME_CATALOG, GAME_MOMENTS } from '../lib/gameCatalog';
import { buildGameContent, lessonGameTemplateName, lessonSlideWords, wordListToCards } from '../lib/gameFromWords';
import { isSentenceList, prepareClassroomGame } from '../lib/gameWorkspace';
import { enrichCards, loadWordBank, useWordBankEnriched } from '../lib/wordBankCache';
import SlideHelpersEditor from './SlideHelpersEditor';
import BlockOptionsPanel from './BlockOptionsPanel';
import LessonActivityPicker, { printSections, worksheetCards } from './LessonActivityPicker';
import { rememberActivity } from '../lib/lessonActivities';
import { blockOfSlide } from '../lib/blocks/registry';
import type { BlockDef } from '../lib/blocks/types';
import { newHelper, type HelperType } from '../lib/slideHelpers';
import { MATERIALS_CATALOG, WORKSHEET_TAB_CATALOG } from '../lib/materialsCatalog';
import { CvcUnitPicker } from './worksheets/CvcWorkbookSheets';
import PhonicsSlidePreview from './worksheets/PhonicsSlidePreview';
import Stage1LessonOptions from './phonicsStage1/Stage1LessonOptions';
import { PHONICS_TEACHING_PREVIEW } from '../data/phonicsTeachingCourse';
import { workbookOfMaterial, workbookNumbers, stableWorkbookRefs, resolveWorkbookSelection } from '../data/cvcWorkbook';
import { DEFAULT_COLORING_OPTIONS, type AskTemplate, type ColoringOptions } from '../lib/worksheetGenerators';
import type {
  FullCardItem,
  GameSlide,
  ImageSlide,
  LessonSlide,
  MaterialSlide,
  ShadowSlide,
  QnaSlide,
  DrillSlide,
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
import ShadowBoard, { SHADOW_REPEATS, SHADOW_SPEEDS, SHADOW_SUBTITLES } from './ShadowBoard';
import { parseShadowText, shadowSpeakers, toShadowSource } from '../lib/shadowLines';
import { useClipTakenDown, type VideoClip } from '../lib/videoClips';
import VideoClipLibrary from './VideoClipLibrary';
import QnaBoard from './QnaBoard';
import DrillBoard from './DrillBoard';
import RainbowSpeaking from './rainbow/RainbowSpeaking';
import RainbowStructure from './rainbow/RainbowStructure';
import RainbowSlideForm, { pickSpeaking, pickStructure } from './rainbow/RainbowSlideForm';
import { parseQnaText, qnaToText } from '../lib/qnaLines';
import { generateShadowScript } from '../lib/api';
import ReadingBoard from './ReadingBoard';
import { parseReadingText } from '../lib/readingLines';
import GrammarExplainCard from './GrammarExplainCard';
import { buildWordListSentences, GRAMMAR_LEVELS_BY_STAGE, GRAMMAR_POINTS, GRAMMAR_STAGES, grammarLevelTag, grammarPoint, sentencesForUnscramble, useGrammarCards, type GrammarStage } from '../lib/grammar';
import { GAME_PAGES } from '../lib/gamePages';
import CanvasSlideEditor, { BoardThemeChips } from './CanvasSlideEditor';
import CanvasSlideView from './CanvasSlideView';
import WorksheetOptionsFields from './worksheets/WorksheetOptionsFields';
import LessonPrintPreview, { dedicatedPrintMaterials, wordPrintMaterials, workbookStep } from './LessonPrintPreview';
import { activityMaterial, canvasExample, LessonWordThumbnail, LESSON_SAMPLE_WORDS, LESSON_BINGO_SAMPLE_WORDS, type CanvasExample } from './LessonActivityExample';
import LessonPdfView, { LessonPdfThumbnail } from './LessonPdfView';
import { gameAvailability, PHONICS_GAMES, phonicsGameUnits } from '../lib/phonicsGames';
import { PhonicsGameCover } from './PhonicsGameArt';
import { loadPhonicsBank } from '../lib/phonicsFill';
import { buildPhonicsWorkbook, workbookPrintable } from '../data/phonicsWorkbook';
import type { PhonicsBankEntry } from '../lib/types';

/** WorksheetOptionsFields 가 쓰는 "다루기 쉬운" 런타임 모양 — MaterialSlide.worksheetOptions(평탄화
 * 저장 모양)과 서로 변환한다. 기본값은 WorksheetPrintPage.tsx 의 각 useState 초기값과 동일. */
interface WorksheetOptionsState {
  listShow: { pos: boolean; example: boolean; image: boolean };
  tracingShow: { meaning: boolean; image: boolean };
  showAnswerKey: boolean;
  includeAnswers: boolean;
  askTemplate: AskTemplate;
  matchMeaning: boolean;
  coloring: ColoringOptions;
}

const DEFAULT_WORKSHEET_OPTIONS_STATE: WorksheetOptionsState = {
  listShow: { pos: true, example: false, image: false },
  tracingShow: { meaning: false, image: false },
  showAnswerKey: false,
  includeAnswers: true,
  askTemplate: 'like',
  matchMeaning: false,
  coloring: DEFAULT_COLORING_OPTIONS,
};

function optionsStateFromSlide(wo: WorksheetSlideOptions | undefined): WorksheetOptionsState {
  return {
    listShow: wo?.listShow ?? DEFAULT_WORKSHEET_OPTIONS_STATE.listShow,
    tracingShow: wo?.tracingShow ?? DEFAULT_WORKSHEET_OPTIONS_STATE.tracingShow,
    showAnswerKey: wo?.showAnswerKey ?? false,
    includeAnswers: wo?.includeAnswers ?? true,
    askTemplate: wo?.askTemplate ?? 'like',
    matchMeaning: wo?.matchMeaning ?? false,
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
    matchMeaning: o.matchMeaning,
    coloringTitle: o.coloring.title,
    coloringLabelMode: o.coloring.labelMode,
    coloringPerPage: o.coloring.perPage,
    coloringDecorTheme: o.coloring.decorTheme,
  };
}


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
  /** 단어 슬라이드의 낱말을 "내 단어장"으로 저장하고 수업 단어장으로 지정한다(CurriculumPage). */
  onSaveWordsAsList?: (words: FullCardItem[], name: string) => Promise<boolean>;
}

/** 게임 슬라이드가 발표 때 열 내용이 정해졌는지 — 템플릿을 골랐거나, 저장할 때 수업 단어장으로
 * 자동으로 만들 수 있으면 OK. */
function gameSlideReady(slide: GameSlide, cards: FullCardItem[]): boolean {
  return !!slide.templateId || (cards.length >= (GAME_CATALOG.find(g=>g.type===slide.gameType)?.minItems??1) && buildGameContent(slide.gameType, cards) !== null);
}

type AddMode = 'library' | 'wordset' | null;

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
  onSaveWordsAsList,
}: Props) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const wordList = wordLists.find((wl) => wl.id === wordListId) ?? null;
  const cards = useMemo(() => wordListToCards(wordList), [wordList]);
  // 수업 단어장이 없으면 단어 슬라이드(영상 수업 등)의 낱말을 게임 재료로 쓴다. 그리고 게임 내용(문장 배열하기의 예문 등)은
  // 사전에서 보충한 카드로 만든다 — 단어장에는 예문이 저장돼 있지 않다
  const slideWords = useMemo(() => lessonSlideWords(slides), [slides]);
  const gameBase = cards.length > 0 ? cards : slideWords;
  const gameCards = useWordBankEnriched(gameBase);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId && slides.some((s) => s.id === initialSelectedId) ? initialSelectedId : slides[0]?.id ?? null,
  );
  const [addMode, setAddMode] = useState<AddMode>(null);
  const inputSession=useMemo(()=>({mode:addMode,active:true}),[addMode]);
  useEffect(()=>{inputSession.active=true;return()=>{inputSession.active=false;};},[inputSession]);
  const [pickerOpen,setPickerOpen]=useState(false);
  const [phonicsEntries, setPhonicsEntries] = useState<PhonicsBankEntry[]>([]);
  const [phonicsLoaded, setPhonicsLoaded] = useState(false);
  const pendingActivity=useRef<string|null>(null);
  const additionLock=useRef(false);
  const setLock=useRef(false);
  useEffect(()=>{
    if(!initialSelectedId)return;
    setSelectedId(initialSelectedId);
    let nextFrame=0;
    // The parent first reveals/focuses the edit form. Scroll to the appended
    // activity after that focus, so it cannot move the page back to the top.
    const frame=requestAnimationFrame(()=>{nextFrame=requestAnimationFrame(()=>{
      document.querySelector<HTMLElement>(`[data-slide-id="${window.CSS.escape(initialSelectedId)}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
      document.querySelector<HTMLElement>('[data-lesson-slide-detail]')?.scrollIntoView({block:'nearest'});
    });});
    return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(nextFrame);};
  },[initialSelectedId]);
  const { profile: teacher } = useAuth();
  const recentKey=`classbank.lessonActivities.v1.${academyId}.${teacher?.id??'staff'}`;
  // "단어장으로 단어 수업 더하기" — 수업 단어장은 그대로 두고, 고른 단어장으로 단어 소개·카드·게임 슬라이드를 묶음으로 넣는다
  const [setListId, setSetListId] = useState('');
  const [setBusy, setSetBusy] = useState(false);

  async function addWordSet() {
    const list = wordLists.find((wl) => wl.id === setListId);
    if (!list || isSentenceList(list) || !teacher || setBusy || setLock.current) return;
    setLock.current=true;
    const words = wordListToCards(list);
    if (words.length === 0) return;
    setSetBusy(true);
    try {
      const made: LessonSlide[] = [
        { id: uid(), kind: 'wordshow', boardTheme: 'green', words, ownWordListId: list.id },
        { id: uid(), kind: 'study', words, ownWordListId: list.id },
      ];
      // 게임은 이 단어장으로 내용을 만들어 붙인다(수업 단어장이 바뀌어도 건드리지 않게 ownWordListId 를 남긴다)
      if (teacher) {
        const enriched = enrichCards(words, await loadWordBank());
        if(['matchup','quiz'].some(type=>!buildGameContent(type as GameSlide['gameType'],enriched)))throw new Error(t('lessonUx.bundleNeed'));
        for (const gameType of ['matchup', 'quiz'] as const) {
          const content = buildGameContent(gameType, enriched);
          if (!content) continue;
          const tpl = await createGameTemplate({
            academyId,
            classId,
            gameType,
            name: lessonGameTemplateName(lessonName || t('curriculum.slides.gameContentDefaultName'), list.name),
            items: content.items,
            config: content.config,
            teacherId: teacher.id,
          });
          made.push({ id: uid(), kind: 'game', gameType, templateId: tpl.id, ownWordListId: list.id });
        }
      }
      if(!inputSession.active)return;
      placeSlides(made);
      setAddMode(null);
      notify(t('curriculum.slides.wordSet.addedToast', { count: made.length, name: list.name }));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSetBusy(false);
      setLock.current=false;
    }
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selected = slides.find((s) => s.id === selectedId) ?? null;
  const needsPhonics = pickerOpen || selected?.kind === 'material';
  useEffect(() => {
    if (!needsPhonics || phonicsLoaded) return;
    let active = true;
    void loadPhonicsBank().then(entries => {
      if (!active) return;
      setPhonicsEntries(entries);
      setPhonicsLoaded(true);
    });
    return () => { active = false; };
  }, [needsPhonics, phonicsLoaded]);

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
  const [worksheetReplacementId, setWorksheetReplacementId] = useState<string | null>(null);
  useEffect(() => {
    if (!addMode) setReplaceTargetId(null);
  }, [addMode]);

  function placeSlides(made: LessonSlide[]) {
    if (made.length === 0 || additionLock.current) return;
    additionLock.current=true;
    requestAnimationFrame(()=>{additionLock.current=false;});
    rememberActivity(recentKey,pendingActivity.current??blockOfSlide(made[0])?.id??'');
    pendingActivity.current=null;
    const idx = replaceTargetId ? slides.findIndex((sl) => sl.id === replaceTargetId) : -1;
    if (idx >= 0) {
      // 주 블록을 바꿔도 제목·타이머 같은 보조 블록은 그대로 남는다(BLOCK_SPEC §6)
      const kept = slides[idx].helpers;
      const first = kept && kept.length > 0 && !made[0].helpers?.length ? { ...made[0], helpers: kept } : made[0];
      onChange([...slides.slice(0, idx), first, ...made.slice(1), ...slides.slice(idx + 1)]);
      setReplaceTargetId(null);
      notify(t('curriculum.slides.replacedToast'));
    } else {
      onChange([...slides, ...made]);
    }
    // 방금 넣은 슬라이드가 열리며 스스로 채우는 값(게임 슬라이드가 고른 게임 내용 등)은 넣기와 한 번으로
    // 묶는다 — 안 그러면 되돌리기를 한 번 눌러도 그 자동 변경만 되돌아가 "안 되는 것"처럼 보인다.
    lastKeyRef.current = { key: `update:${made[0].id}`, at: Date.now(), win: 5000 };
    setSelectedId(made[0].id);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.querySelector<HTMLElement>(`[data-slide-id="${window.CSS.escape(made[0].id)}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
      document.querySelector<HTMLElement>('[data-lesson-slide-detail]')?.scrollIntoView({block:'nearest'});
    }));
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

  function pickBlock(block: BlockDef, layout?: CanvasExample, theme: string | null = null) {
    setPickerOpen(false);
    pendingActivity.current = block.id;
    if (block.category === 'helper') {
      // 보조 블록은 지금 고른 슬라이드에 붙인다
      const type = block.id.replace('helper.', '') as HelperType;
      const target = selectedId ? slides.find((s) => s.id === selectedId) : null;
      if (!target || !['title', 'timer', 'scoreboard'].includes(type)) return;
      rememberActivity(recentKey,block.id);
      updateSlide(target.id, { helpers: [...(target.helpers ?? []), newHelper(type)] });
      notify(t('curriculum.library.helperAdded', { name: t(`curriculum.helpers.name_${type}`) }));
      setAddMode(null);
      return;
    }
    const ref = block.slide;
    if (!ref) return;
    const id = uid();
    let slide: LessonSlide;
    switch (ref.kind) {
      case 'stem': return;
      case 'game':
        if (!ref.gameType) return;
        slide = { id, kind: 'game', gameType: ref.gameType };
        break;
      case 'phonicsGame': {
        const game = PHONICS_GAMES.find(candidate => candidate.id === ref.phonicsGameId);
        if (!game) return;
        const unit = phonicsGameUnits().find(candidate => !gameAvailability(game, candidate));
        if (!unit) return;
        slide = { id, kind: 'phonicsGame', gameId: game.id, unitId: unit.id };
        break;
      }
      case 'pdf': return; // Added only after the file and thumbnail are stored.
      case 'material':
        slide = { ...activityMaterial(block, selected), id, helpers: undefined };
        break;
      case 'canvas':
        slide = canvasExample(layout ?? 'title', theme, lessonName.trim() || t('lessonUx.sampleTitle'), cards[0] ?? LESSON_SAMPLE_WORDS[0]);
        break;
      case 'image':
        slide = selected?.kind === 'image'
          ? { id, kind: 'image', imageUrl: selected.imageUrl, imagePath: selected.imagePath }
          : { id, kind: 'image', imageUrl: '', imagePath: '' };
        break;
      case 'video':
        slide = { kind: 'video', id, videoUrl: selected?.kind === 'video' ? selected.videoUrl : '',
          ...(selected?.kind === 'video' ? { title: selected.title, startSec: selected.startSec, endSec: selected.endSec } : {}) };
        break;
      case 'web':
        slide = { id, kind: 'web', url: selected?.kind === 'web' ? selected.url : '', mode: selected?.kind === 'web' ? selected.mode : 'window', title: selected?.kind === 'web' ? selected.title : undefined };
        break;
      case 'wordshow': slide = { id, kind: 'wordshow', boardTheme: 'green' }; break;
      case 'study': slide = { id, kind: 'study' }; break;
      case 'attendance': slide = { id, kind: 'attendance', boardTheme: 'green' }; break;
      case 'grammar': slide = { id, kind: 'grammar', grammarId: '', useWordList: cards.length > 0, boardTheme: 'green' }; break;
      case 'reading': slide = { id, kind: 'reading', source: '', mode: ref.mode === 'cloze' ? 'cloze' : 'lines', boardTheme: 'green' }; break;
      case 'shadow': slide = { id, kind: 'shadow', source: '' }; break;
      case 'qna': slide = { id, kind: 'qna', questions: [], boardTheme: 'green' }; break;
      case 'drill': slide = { id, kind: 'drill', sentence: '', point: '', drills: [], boardTheme: 'green' }; break;
      case 'rainbow': slide = { id, kind: 'rainbow', mode: ref.mode === 'structure' ? 'structure' : 'speak' }; break;
    }
    addSlide(slide);
    setAddMode(null);
  }

  return (
    <WordListManageContext.Provider value={onManageWordList}>
    {pickerOpen&&<LessonActivityPicker storageKey={recentKey} cards={cards} gameCards={gameCards} selected={selected} sourceName={wordList?.name ?? ''} sourceKind={wordList&&isSentenceList(wordList)?'sentence':'word'} entries={phonicsEntries} lessonName={lessonName} academyId={academyId} canAttachHelper={!!selectedId&&!replaceTargetId}
      onClose={()=>{setPickerOpen(false);if(addMode==='library')setAddMode(null);}}
      onStem={lesson=>{
        pendingActivity.current='learn.stem';
        const frames=lesson.frames.map(frame=>({...frame,id:uid()}));
        placeSlides(stemPlaylist({...lesson,frames}));
        setPickerOpen(false);
        setAddMode(null);
      }}
      onPdf={asset=>{if(!inputSession.active)return;pendingActivity.current='media.pdf';addSlide({id:uid(),kind:'pdf',...asset});setPickerOpen(false);setAddMode(null);}}
      onPick={pickBlock} onBundle={()=>{pendingActivity.current='wordset';setPickerOpen(false);setAddMode('wordset');}}/>}

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
                cards={cards}
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
                needsContent={slide.kind === 'game' && !gameSlideReady(slide, gameCards)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={() => {
            setReplaceTargetId(null);
            setPickerOpen(true);
          }}
          aria-haspopup="dialog"
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-primary bg-white px-4 py-3 font-bold text-primary hover:bg-primary-fixed lg:w-full"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>add</span>
          {t('lessonUx.add')}
        </button>
      </div>

      {/* 오른쪽: 슬라이드 추가 패널 또는 선택된 슬라이드 상세 */}
      <div data-lesson-slide-detail className="min-w-0 flex-1 rounded-xl bg-surface-container-low p-4">
        {addMode === 'wordset' && (
          <div className="mb-4 space-y-3 rounded-lg bg-surface-container-lowest p-4 shadow-sm">
            <div className="font-title-md text-title-md font-bold text-deep-navy">
              {replaceTargetId
                ? t('curriculum.slides.replacePanelTitle', { n: slides.findIndex((sl) => sl.id === replaceTargetId) + 1 })
                : t('curriculum.slides.addPanelTitle', { n: slides.length + 1 })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-11 rounded-xl border px-4 text-primary" onClick={()=>setPickerOpen(true)}>{t('lessonUx.change')}</button>
              <button type="button" className="ml-auto min-h-11 px-4" onClick={()=>{setAddMode(null);pendingActivity.current=null;}}>{t('curriculum.slides.closeAddPanel')}</button>
            </div>

            {addMode === 'wordset' && (
              <div className="space-y-3">
                <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.slides.wordSet.intro')}</p>
                <select
                  value={setListId}
                  disabled={setBusy}
                  onChange={(e) => setSetListId(e.target.value)}
                  aria-label={t('curriculum.slides.wordSet.pick')}
                  className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                >
                  <option value="">{t('curriculum.slides.wordSet.pick')}</option>
                  {wordLists.filter((wl) => !isSentenceList(wl) && !wl.group_name).map((wl) => (
                    <option key={wl.id} value={wl.id}>
                      {wl.name} ({wl.items.length})
                    </option>
                  ))}
                  {[...new Set(wordLists.filter(wl => !isSentenceList(wl)).map((wl) => wl.group_name).filter((g): g is string => !!g))].map((g) => (
                    <optgroup key={g} label={g}>
                      {wordLists.filter((wl) => !isSentenceList(wl) && wl.group_name === g).map((wl) => (
                        <option key={wl.id} value={wl.id}>
                          {wl.name} ({wl.items.length})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="font-caption text-caption text-on-surface-variant">{t('lessonUx.bundleFlow')} · {t('lessonUx.bundleCount')}</p>
                <button
                  type="button"
                  disabled={!setListId || setBusy}
                  onClick={() => void addWordSet()}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  {setBusy ? t('common.loading') : t('lessonUx.bundle')}
                </button>
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
                  if (selected.kind === 'material' && !selected.phonicsStage1) {
                    setWorksheetReplacementId(selected.id);
                    return;
                  }
                  setReplaceTargetId(selected.id);
                  setAddMode('library');
                  setPickerOpen(true);
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
              key={selected.id}
              slide={selected}
              phonicsEntries={phonicsEntries}
              academyId={academyId}
              classId={classId}
              lessonName={lessonName}
              wordList={wordList}
              cards={cards}
              gameCards={gameBase}
              wordListId={wordListId}
              wordLists={wordLists}
              onWordListChange={onWordListChange}
              onSaveWordsAsList={onSaveWordsAsList}
              onUpdate={(patch) => updateSlide(selected.id, patch)}
              worksheetReplacementOpen={worksheetReplacementId === selected.id}
              onWorksheetReplacementChange={open => setWorksheetReplacementId(open ? selected.id : null)}
              onInsertAfter={(slide) => {
                const idx = slides.findIndex((s) => s.id === selected.id);
                onChange([...slides.slice(0, idx + 1), slide, ...slides.slice(idx + 1)]);
                setSelectedId(slide.id);
              }}
            />
            {selected.animationGuide&&<details className="mt-4 rounded-xl border bg-white p-3">
              <summary>교사용 진행 안내 · {selected.animationGuide.minutes}분</summary>
              <dl className="mt-2 space-y-1"><div><dt className="font-bold">첫 질문</dt><dd>{selected.animationGuide.question}</dd></div>
              <div><dt className="font-bold">예상 답</dt><dd>{selected.animationGuide.expected}</dd></div>
              <div><dt className="font-bold">힌트</dt><dd>{selected.animationGuide.hint}</dd></div>
              <div><dt className="font-bold">다음 단계</dt><dd>{selected.animationGuide.next}</dd></div></dl>
            </details>}
            <div className="mt-4 space-y-3">
              {!(selected.kind === 'material' && selected.materialId === 'phonicsstage1') && <BlockOptionsPanel
                slide={selected}
                academyId={academyId}
                classId={classId}
                lessonName={lessonName}
                lessonCards={cards}
                lessonListName={wordList?.name}
                wordLists={wordLists}
                onUpdate={(patch) => updateSlide(selected.id, patch)}
              />}
              <SlideHelpersEditor helpers={selected.helpers ?? []} onChange={(next) => updateSlide(selected.id, { helpers: next })} />
            </div>
            </>
          ))}
      </div>
    </div>
    </WordListManageContext.Provider>
  );
}

function slideThumbLabel(slide: LessonSlide, t: TFunction): { icon: string; label: string } {
  if (slide.kind === 'pdf') return { icon: 'picture_as_pdf', label: slide.title };
  if (slide.kind === 'phonicsGame') {
    const game = PHONICS_GAMES.find(candidate => candidate.id === slide.gameId);
    return { icon: 'hearing', label: game?.[t('lessonUx.language') === 'en' ? 'en' : 'ko'] ?? t('gameBrowse.phonics') };
  }
  if(slide.kind==='stem')return {icon:'science',label:slide.frame.title};
  if (slide.kind === 'image') return { icon: 'image', label: t('curriculum.slides.kindImage') };
  if (slide.kind === 'study') return { icon: 'style', label: t('curriculum.slides.kindStudy') };
  if (slide.kind === 'wordshow') return { icon: 'menu_book', label: t('curriculum.slides.kindWordShow') };
  if (slide.kind === 'attendance') return { icon: 'how_to_reg', label: t('curriculum.slides.kindAttendance') };
  if (slide.kind === 'drill') return { icon: 'swap_horiz', label: t('readyMedia.drill') };
  if (slide.kind === 'rainbow') return { icon: 'palette', label: t(slide.mode === 'structure' ? 'rainbow.mode_structure' : 'rainbow.mode_speak') };
  if (slide.kind === 'qna') return { icon: 'forum', label: t('qna.title') };
  if (slide.kind === 'shadow') return { icon: 'record_voice_over', label: t(slide.roleTeams ? 'mediaV2.rolesLabel' : 'curriculum.slides.kindVideo') };
  if (slide.kind === 'reading')
    return { icon: slide.mode === 'cloze' ? 'hearing' : 'lyrics', label: t(slide.mode === 'cloze' ? 'curriculum.reading.mode_cloze' : 'curriculum.reading.defaultTitle') };
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
  if (slide.materialId === 'phonicsstage1' && slide.phonicsStage1) {
    const ref = slide.phonicsStage1;
    const label = ref.view === 'workbook' ? t('phonicsStage1.workbook') : ref.optional ? t('phonicsStage1.extra') : t('phonicsStage1.lesson', { n: ref.lesson });
    return { icon: 'auto_stories', label: t('phonicsStage1.title') + ' · ' + label };
  }
  const entry = MATERIALS_CATALOG.find((m) => m.id === slide.materialId);
  return { icon: entry?.icon ?? 'print', label: entry ? t(entry.nameKey) : slide.materialId };
}

function SlideThumb({
  slide,
  cards,
  index,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  needsContent,
}: {
  slide: LessonSlide;
  cards: FullCardItem[];
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
  const videoId = slide.kind === 'video' || slide.kind === 'shadow' ? extractYoutubeId(slide.videoUrl ?? '') : null;
  const word = slide.kind === 'wordshow' || slide.kind === 'study' ? (slide.words?.length ? slide.words[0] : cards[0]) : undefined;
  const phonicsGame = slide.kind === 'phonicsGame' ? PHONICS_GAMES.find(game => game.id === slide.gameId) : undefined;
  const cover = slide.kind === 'material' ? MATERIALS_CATALOG.find(item => item.id === slide.materialId)?.cover : undefined;
  const reading = slide.kind === 'reading' ? parseReadingText(slide.source) : [];
  const readingLine = slide.kind === 'reading' && slide.mode === 'cloze' ? reading.find(line=>line.en.includes('**')) ?? reading[0] : reading[0];
  const excerpt = readingLine ? readingLine.en.replace(/\*\*([^*]+)\*\*/g, slide.kind === 'reading' && slide.mode === 'cloze' ? '____' : '$1')
    : slide.kind === 'drill' ? slide.sentence : slide.kind === 'qna' ? slide.questions[0]?.q : undefined;
  const speakers = slide.kind === 'shadow' && slide.roleTeams ? shadowSpeakers(parseShadowText(slide.source)).slice(0,3) : [];
  const speaking = slide.kind === 'rainbow' && slide.mode === 'speak' ? pickSpeaking(slide.itemIds)[0] : undefined;
  const structure = slide.kind === 'rainbow' && slide.mode === 'structure' ? pickStructure(slide.itemIds)[0] : undefined;

  return (
    <div
      data-slide-id={slide.id}
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
      <div className="absolute right-1 top-1 z-10 flex gap-0.5 opacity-100">
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
        {slide.kind === 'pdf' ? <LessonPdfThumbnail slide={slide} /> : phonicsGame ? <PhonicsGameCover game={phonicsGame} />
          : word ? <LessonWordThumbnail card={word} study={slide.kind === 'study'} />
          : slide.kind === 'stem' ? <StemFrameView frame={slide.frame} meta={slide.stemMeta} interactive={false}/> : slide.kind === 'canvas' ? (
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
        ) : slide.kind === 'image' && slide.imageUrl ? (
          <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : speakers.length ? (
          <div className="flex h-full w-full flex-wrap items-center justify-center gap-1 bg-sky-100 px-3">
            {speakers.map(speaker=><strong key={speaker} className="rounded-xl rounded-bl-sm bg-white px-2 py-1 text-xs text-deep-navy">{speaker}</strong>)}
          </div>
        ) : slide.kind === 'video' || slide.kind === 'shadow' ? (
          <VideoThumbnail id={videoId}/>
        ) : slide.kind === 'material' && slide.materialId === 'bingo' && (slide.words?.length || cards.length) ? (
          <div className="grid w-4/5 grid-cols-3 gap-px rounded border border-sky-300 bg-sky-300 text-center text-[9px] text-deep-navy">
            {(slide.words?.length ? slide.words : cards).slice(0,9).map(word=><span className="truncate bg-white px-1 py-0.5" key={word.id}>{word.word}</span>)}
          </div>
        ) : slide.kind === 'material' && slide.materialId === 'worksheet' ? (
          <div className="pointer-events-none h-full w-full overflow-hidden bg-white">
            <LessonPrintPreview slide={slide} cards={cards.length?cards:LESSON_SAMPLE_WORDS}/>
          </div>
        ) : cover ? (
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : excerpt ? (
          <div className="grid h-full w-full content-center bg-emerald-900 px-4 pt-3 text-center text-sm font-semibold text-white">
            <p className="line-clamp-2 break-words">{slide.kind === 'qna' && <b className="mr-1 text-yellow-200">Q</b>}{excerpt.trim().replace(/\*\*/g,'').split(/\r?\n|\|/)[0]}</p>
          </div>
        ) : speaking ? (
          <LessonWordThumbnail study={false} card={{id:speaking.id,word:speaking.englishAnswer,meaning:speaking.koreanPrompt,imageUrl:speaking.imageMain}} />
        ) : structure ? (
          <div className="flex flex-wrap justify-center gap-1 px-2 text-sm font-bold text-deep-navy">
            {structure.sentence.split(' ').slice(0, 6).map((part, i) => <span key={i} className={`rounded-md px-2 py-1 ${['bg-sky-200','bg-amber-200','bg-pink-200'][i%3]}`}>{part}</span>)}
          </div>
        ) : slide.kind === 'web' && slide.url ? (
          <div className="m-3 w-full rounded-lg border border-sky-200 bg-white text-center font-bold text-deep-navy">
            <span className="block rounded-t-lg bg-sky-100 px-2 py-1 text-xs">● ● ●</span>
            <p className="line-clamp-2 break-all p-2 text-xs">{webSlideHost(slide.url)}</p>
          </div>
        ) : (
          <span className="material-symbols-outlined text-3xl text-on-surface-variant">{icon}</span>
        )}
      </div>
      <div className="flex items-center gap-1 bg-surface-container-lowest px-2 py-1.5 text-left font-caption text-caption text-on-surface">
        <span title={label} className="min-w-0 flex-1 truncate">{label}</span>
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
  phonicsEntries,
  slide,
  academyId,
  classId,
  lessonName,
  wordList,
  cards,
  gameCards,
  wordListId,
  wordLists,
  onWordListChange,
  onSaveWordsAsList,
  onUpdate,
  onInsertAfter,
  worksheetReplacementOpen,
  onWorksheetReplacementChange,
}: {
  phonicsEntries: PhonicsBankEntry[];
  slide: LessonSlide;
  academyId: string;
  classId: string | null;
  lessonName: string;
  wordList: WordList | null;
  cards: FullCardItem[];
  /** 게임 슬라이드가 쓰는 낱말 — 수업 단어장이 없으면 단어 슬라이드의 낱말 */
  gameCards: FullCardItem[];
  wordListId: string;
  wordLists: WordList[];
  onWordListChange: (id: string) => void;
  onSaveWordsAsList?: (words: FullCardItem[], name: string) => Promise<boolean>;
  onUpdate: (patch: Partial<LessonSlide>) => void;
  /** 이 슬라이드 바로 뒤에 새 슬라이드를 넣는다(문법 → 문장 배열하기 게임). */
  onInsertAfter: (slide: LessonSlide) => void;
  worksheetReplacementOpen: boolean;
  onWorksheetReplacementChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  if (slide.kind === 'pdf') return <LessonPdfView key={slide.pdfPath} slide={slide} />;
  if (slide.kind === 'phonicsGame') {
    const game = PHONICS_GAMES.find(candidate => candidate.id === slide.gameId);
    if (!game) return null;
    return <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-2 font-bold">{t('lessonUx.needPhonicsUnit')}
        <select className="min-h-11 rounded-xl border border-outline-variant bg-white px-3" value={slide.unitId}
          onChange={event=>onUpdate({unitId:event.target.value})}>
          {phonicsGameUnits().filter(unit=>!gameAvailability(game,unit)).map(unit=><option key={unit.id} value={unit.id}>
            Level {unit.step} · Unit {unit.number} · {unit.groups.map(group=>group.label).join(' / ')}
          </option>)}
        </select>
      </label>
      <div className="mx-auto max-w-lg overflow-hidden rounded-xl"><PhonicsGameCover game={game} large /></div>
    </div>;
  }

  if (slide.kind === 'shadow') {
    return <ShadowSlideDetail key={slide.id} slide={slide} onUpdate={onUpdate} />;
  }

  if (slide.kind === 'rainbow') {
    return (
      <div className="space-y-3">
        <div className="relative aspect-video w-full max-w-3xl">
          {slide.mode === 'structure' ? (
            <RainbowStructure key={`s-${(slide.itemIds ?? []).join(',')}`} items={pickStructure(slide.itemIds)} interactive={false} />
          ) : (
            <RainbowSpeaking key={`p-${(slide.itemIds ?? []).join(',')}-${slide.showKo ? 1 : 0}`} items={pickSpeaking(slide.itemIds)} interactive={false} initialShowKo={!!slide.showKo} />
          )}
        </div>
        <RainbowSlideForm
          value={{ mode: slide.mode, itemIds: slide.itemIds ?? [], showKo: !!slide.showKo }}
          onChange={(d) => onUpdate({ mode: d.mode, itemIds: d.itemIds, showKo: d.showKo } as Partial<LessonSlide>)}
        />
      </div>
    );
  }

  if (slide.kind === 'drill') {
    return (
      <div className="space-y-3">
        <div className="aspect-video w-full max-w-3xl">
          <DrillBoard slide={slide} interactive={false} videoUrl={slide.videoUrl} />
        </div>
        <BoardThemeChips value={slide.boardTheme ?? 'green'} onChange={(th) => onUpdate({ boardTheme: th?.id ?? 'green' } as Partial<LessonSlide>)} />
        <DrillSlideForm initial={slide} onChange={(patch) => onUpdate(patch as Partial<LessonSlide>)} />
      </div>
    );
  }

  if (slide.kind === 'qna') {
    return (
      <div className="space-y-3">
        <div className="aspect-video w-full max-w-3xl">
          <QnaBoard key={slide.questions.map((q) => q.q).join('|')} questions={slide.questions} title={slide.title} videoUrl={slide.videoUrl} themeId={slide.boardTheme ?? 'green'} interactive={false} initialShowKo={!!slide.showKo} />
        </div>
        <BoardThemeChips value={slide.boardTheme ?? 'green'} onChange={(th) => onUpdate({ boardTheme: th?.id ?? 'green' } as Partial<LessonSlide>)} />
        <QnaSlideForm initial={slide} onChange={(patch) => onUpdate(patch as Partial<LessonSlide>)} />
      </div>
    );
  }

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
    if (!slide.grammarId) return <GrammarPickerPanel onPick={grammarId => onUpdate({ grammarId })} />;
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
          <WordShowBoard key={(slide.words ?? cards).map((w) => w.id).join(',')} words={slide.words?.length ? slide.words : cards} themeId={slide.boardTheme ?? 'green'} interactive={false} />
        </div>
        <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.wordShow.detailHint', { count: (slide.words?.length ? slide.words : cards).length })}</p>
        <SlideOwnWords cards={cards} wordLists={wordLists} value={slide.words} onChange={(words) => onUpdate({ words } as Partial<LessonSlide>)} />
        {slide.words?.length && onSaveWordsAsList ? (
          <SaveWordsAsList
            words={slide.words}
            name={t('curriculum.slides.savedWordListName', { name: lessonName || t('curriculum.shadow.defaultTitle') })}
            onSave={onSaveWordsAsList}
          />
        ) : null}
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
        <StudySlidePreview cards={slide.words?.length ? slide.words : cards} />
        <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.study.detailHint', { count: (slide.words?.length ? slide.words : cards).length })}</p>
        <SlideOwnWords cards={cards} wordLists={wordLists} value={slide.words} onChange={(words) => onUpdate({ words } as Partial<LessonSlide>)} />
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
          disabled={!slide.imageUrl}
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
          {slide.imageUrl ? <img src={slide.imageUrl} alt="" className="h-full w-full object-contain" /> : <p>{t('lessonUx.needImage')}</p>}
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
        <PreviewFrame title={slide.title || t('curriculum.slides.kindVideo')}>
          <VideoThumbnail id={videoId}/>
        </PreviewFrame>
        {!videoId && <p>{t('lessonUx.needVideo')}</p>}
        <label className="block">{t('lessonUx.videoTitle')}
          <input className="block w-full rounded-lg border p-2" value={slide.title ?? ''} onChange={e => onUpdate({ title: e.target.value })} />
        </label>
        <input
          type="text"
          aria-label={t('lessonUx.videoLink')}
          placeholder={t('lessonUx.videoLink')}
          value={slide.videoUrl}
          onChange={(e) => onUpdate({ videoUrl: e.target.value, title: undefined, startSec: undefined, endSec: undefined } as Partial<VideoSlide>)}
          className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <details>
          <summary className="cursor-pointer font-bold">{t('videoLibrary.tabLibrary')}</summary>
          <VideoClipLibrary pickLabel={t('lessonUx.useVideo')} onPick={clip => onUpdate({
            title: clip.title, videoUrl: `https://www.youtube.com/watch?v=${clip.youtube_id}`,
            startSec: clip.start_sec, endSec: clip.end_sec,
          })} />
        </details>
      </div>
    );
  }

  if (slide.kind === 'web') {
    return <WebSlideDetail slide={slide} onUpdate={(patch) => onUpdate(patch as Partial<LessonSlide>)} />;
  }

  if (slide.kind === 'game') {
    return (
      <GameSlideEditor
        key={`${slide.id}:${slide.ownWordListId ?? ''}`}
        slide={slide}
        academyId={academyId}
        classId={classId}
        lessonName={lessonName}
        wordList={wordList}
        cards={gameCards}
        wordListId={wordListId}
        wordLists={wordLists}
        onWordListChange={onWordListChange}
        onUpdate={(patch) => onUpdate(patch as Partial<LessonSlide>)}
      />
    );
  }

  if(slide.kind==='stem')return <div className="space-y-4"><StemFrameView frame={slide.frame} meta={slide.stemMeta} interactive={false}/><label className="block">{t('stem.titleLabel')}<input className="w-full rounded-xl border p-3" value={slide.frame.title} onChange={e=>onUpdate({frame:{...slide.frame,title:e.target.value}} as Partial<LessonSlide>)}/></label><label className="block">{t('stem.lines')}<textarea className="w-full rounded-xl border p-3" value={slide.frame.lines.join('\n')} onChange={e=>onUpdate({frame:{...slide.frame,mode:'text',lines:e.target.value.split('\n')}} as Partial<LessonSlide>)}/></label><p>{t('stem.existingEdit')}</p><a className="text-primary underline" href="/stem">{t('stem.openLessons')} · STEM</a></div>;

  // material slide
  if (slide.materialId === 'phonicsstage1' && slide.phonicsStage1) {
    return PHONICS_TEACHING_PREVIEW?<Stage1LessonOptions slide={slide} onUpdate={(patch) => onUpdate(patch as Partial<LessonSlide>)} />:<p>{t('phonicsTeaching.unavailable')}</p>;
  }

  return <MaterialSlideDetail key={slide.id} slide={slide.materialId==='library'?{...slide,materialId:'worksheet'}:slide} cards={cards} entries={phonicsEntries} onUpdate={onUpdate} replace={worksheetReplacementOpen} setReplace={onWorksheetReplacementChange}/>;
}

function WorkbookUnits({slide,entries,onUpdate}:{slide:MaterialSlide;entries:PhonicsBankEntry[];onUpdate:(patch:Partial<MaterialSlide>)=>void}) {
  const {t}=useTranslation();
  const book=workbookOfMaterial(slide.materialId);
  const step=workbookStep(slide.materialId);
  if(book)return <CvcUnitPicker book={book.id}
    selected={slide.phonicsUnitIds ? workbookNumbers(book.id,slide.phonicsUnitIds) : slide.cvcUnits??[]}
    onChange={cvcUnits=>onUpdate({cvcUnits,phonicsUnitIds:stableWorkbookRefs(book.id,cvcUnits)})}
    vowelLabel={vowel=>t(book.id==='cvc'?'materials.cvc.vowel':'materials.cvc.longVowel',{vowel})}/>;
  if(!step)return null;
  const units=buildPhonicsWorkbook(entries,step).filter(workbookPrintable);
  return <label className="grid gap-1 font-bold">{t('lessonUx.unit')}
    <select className="min-w-0 rounded-lg border bg-white p-2" value={slide.phonicsUnitIds?.[0]??''} onChange={event=>onUpdate({phonicsUnitIds:event.target.value?[event.target.value]:[]})}>
      <option value="">{t('lessonUx.needUnit')}</option>
      {units.map(unit=><option key={unit.id} value={unit.id}>{unit.family} · {unit.words.join(' / ')}</option>)}
    </select>
  </label>;
}

function MaterialSlideDetail({slide,cards,entries,onUpdate,replace,setReplace}:{slide:MaterialSlide;cards:FullCardItem[];entries:PhonicsBankEntry[];onUpdate:(patch:Partial<MaterialSlide>)=>void;replace:boolean;setReplace:(open:boolean)=>void}) {
  const {t}=useTranslation();
  const [settings,setSettings]=useState(false);
  const [scope,setScope]=useState<'same'|'all'>('same');
  const [query,setQuery]=useState('');
  const [candidate,setCandidate]=useState<MaterialSlide|null>(null);
  const title=slideThumbLabel(slide,t).label;
  const words=slide.words?.length?slide.words:cards;
  const printWords=words.length?words:slide.materialId==='bingo'?LESSON_BINGO_SAMPLE_WORDS:LESSON_SAMPLE_WORDS;
  const usesWords=slide.materialId==='worksheet'||slide.materialId==='phonics'||wordPrintMaterials.includes(slide.materialId);
  const workbook=workbookOfMaterial(slide.materialId);
  const unitBased=!!workbook||!!workbookStep(slide.materialId);
  const hasUnit=workbook?resolveWorkbookSelection(workbook.id,slide).units.length>0:!!slide.phonicsUnitIds?.length;
  const tab=WORKSHEET_TAB_CATALOG.find(item=>item.tab===(slide.worksheetTab??'list'));
  const options=optionsStateFromSlide(slide.worksheetOptions);
  const updateOptions=(patch:Partial<WorksheetOptionsState>)=>onUpdate({worksheetOptions:slideOptionsFromState({...options,...patch})});
  const optionFields=tab&&slide.materialId==='worksheet'&&<WorksheetOptionsFields
    tab={tab.tab} hasWords={words.length>0}
    listShow={options.listShow} onListShowChange={(key,value)=>updateOptions({listShow:{...options.listShow,[key]:value}})}
    tracingShow={options.tracingShow} onTracingShowChange={(key,value)=>updateOptions({tracingShow:{...options.tracingShow,[key]:value}})}
    showAnswerKey={options.showAnswerKey} onShowAnswerKeyChange={value=>updateOptions({showAnswerKey:value})}
    coloring={options.coloring} onColoringChange={patch=>updateOptions({coloring:{...options.coloring,...patch}})}
    askTemplate={options.askTemplate} onAskTemplateChange={value=>updateOptions({askTemplate:value})}
    matchMeaning={options.matchMeaning} onMatchMeaningChange={value=>updateOptions({matchMeaning:value})}
    includeAnswers={options.includeAnswers} onIncludeAnswersChange={value=>updateOptions({includeAnswers:value})}/>;
  const material=MATERIALS_CATALOG.find(item=>item.id===slide.materialId);
  const inlinePrint=unitBased||slide.materialId==='worksheet'||wordPrintMaterials.includes(slide.materialId)||dedicatedPrintMaterials.includes(slide.materialId)||slide.materialId==='elementary800-original';
  const source=usesWords?(words.length?t(slide.words?.length?'lessonUx.slideWordSource':'lessonUx.lessonWordSource',{count:words.length}):t('lessonUx.sample')+' · '+t('lessonUx.needWords')):
    unitBased&&!hasUnit?t('lessonUx.sample')+' · '+t('lessonUx.needUnit'):'';
  const sections=scope==='same'?[{key:'same',blocks:worksheetCards}]:printSections;
  const candidateBook=candidate&&workbookOfMaterial(candidate.materialId);
  const candidateNeedsUnit=candidate&&(candidateBook||workbookStep(candidate.materialId));
  const candidateReady=!candidateNeedsUnit||!!candidate?.phonicsUnitIds?.length||!!candidate?.cvcUnits?.length;
  const closeReplacement=()=>{
    setReplace(false);
    setCandidate(null);
    setScope('same');
    setQuery('');
  };

  return <div className="space-y-3">
    <header className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3">
      <div className="mr-auto"><h3 className="font-bold">{title}</h3>{source&&<p className="text-sm">{source}</p>}</div>
      <button type="button" className="rounded-lg border px-3 py-2" onClick={()=>setReplace(true)}>{t('lessonUx.replaceWorksheet')}</button>
      {(usesWords||unitBased)&&<button type="button" className="rounded-lg border px-3 py-2" aria-expanded={settings} onClick={()=>setSettings(!settings)}>{t('lessonUx.worksheetSettings')}</button>}
    </header>
    <div className={settings?'grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_280px]':''}>
      <div className="min-w-0 rounded-xl bg-white p-2">
        {inlinePrint?<LessonPrintPreview key={slide.materialId+':'+(slide.worksheetTab??'')} slide={slide} cards={printWords} entries={entries} large/>:
          slide.materialId==='phonics'?<PhonicsSlidePreview tab={slide.phonicsTab??'phonicsBlank'} words={printWords} options={slide.phonicsOptions??{}}/>:
          <PreviewFrame title={title}>{material?.cover?<img src={material.cover} alt="" className="h-full w-full object-contain"/>:null}</PreviewFrame>}
      </div>
      {settings&&<aside className="space-y-3 rounded-xl border bg-white p-3" aria-label={t('lessonUx.worksheetSettings')}>
        <WorkbookUnits slide={slide} entries={entries} onUpdate={onUpdate}/>
        {slide.materialId==='phonics'?<PhonicsSlideDetail slide={slide} cards={cards} onUpdate={onUpdate} settingsOnly/>:
          usesWords&&<WordSourcePicker kind="topic" lessonCount={cards.length} words={slide.words} topic={slide.topic} onChange={next=>onUpdate({words:next.words,topic:next.topic})}/>}
        {optionFields}
      </aside>}
    </div>
    {replace&&<AccessibleDialog label={t('lessonUx.replaceWorksheet')} onClose={closeReplacement}>
      <div className="worksheet-replacement">
        <header>
        <div className="flex items-start justify-between gap-2">
          <div><h3 className="text-lg font-bold">{t('lessonUx.replaceWorksheet')}</h3><p>{t('lessonUx.currentWorksheet')} · {title}</p></div>
          <button type="button" className="rounded-lg border px-3 py-2" onClick={closeReplacement}>× {t('mediaV2.close')}</button>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-pressed={scope==='same'} onClick={()=>{setScope('same');setCandidate(null);}}>{t('lessonUx.sameWorksheetWords')}</button>
          <button type="button" aria-pressed={scope==='all'} onClick={()=>{setScope('all');setCandidate(null);}}>{t('lessonUx.allWorksheets')}</button>
        </div>
        <input value={query} onChange={event=>setQuery(event.target.value)} placeholder={t('lessonUx.search')} aria-label={t('lessonUx.search')} className="w-full min-w-0 rounded-lg border p-2"/>
        </header>
        <div className="worksheet-replacement-scroll">
          {sections.map(section=>{
            const choices=section.blocks.filter(block=>(block.nameKey?t(block.nameKey):block.name?.ko??block.id).toLowerCase().includes(query.trim().toLowerCase()));
            return choices.length>0&&<section key={section.key}>
              {scope==='all'&&<h4 className="mb-1 font-bold">{t(`materials.group_${section.key}`)}</h4>}
              <div className="worksheet-replacement-grid">{choices.map(block=>{
                const next=activityMaterial(block,null);
                const cover=MATERIALS_CATALOG.find(item=>item.id===next.materialId)?.cover;
                const current=next.materialId===slide.materialId&&(next.materialId!=='worksheet'||next.worksheetTab===(slide.worksheetTab??'list'));
                const picked=candidate?.id===next.id;
                return <button key={block.id} type="button" className={`min-w-0 overflow-hidden rounded-lg border p-2 text-left font-semibold ${picked?'border-primary bg-sky-50 ring-1 ring-inset ring-primary':''}`} aria-pressed={picked}
                    onClick={()=>setCandidate(current?null:next)}>
                    {slideThumbLabel(next,t).label}{current&&<small className="block text-primary">{t('lessonUx.currentWorksheet')}</small>}
                  <div aria-hidden="true" className="mt-1 h-[118px] overflow-hidden bg-white">
                    {next.materialId==='worksheet'||wordPrintMaterials.includes(next.materialId)?
                      <LessonPrintPreview slide={next} cards={printWords} entries={entries}/>:cover&&
                      <img className="h-full w-full object-contain" src={cover} alt=""/>}
                  </div>
                </button>;
              })}</div>
            </section>;
          })}
        </div>
        <footer>
        {candidate&&<WorkbookUnits slide={candidate} entries={entries} onUpdate={patch=>setCandidate({...candidate,...patch})}/>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded-lg border px-3 py-2" onClick={closeReplacement}>{t('common.cancel')}</button>
          <button type="button" disabled={!candidate||!candidateReady} className="rounded-lg bg-primary px-3 py-2 text-white disabled:opacity-40" onClick={()=>{
            if(!candidate||!candidateReady)return;
            onUpdate({materialId:candidate.materialId,worksheetTab:candidate.worksheetTab,worksheetOptions:candidate.worksheetOptions,
              phonicsStage1:candidate.phonicsStage1,phonicsTab:candidate.phonicsTab,phonicsOptions:candidate.phonicsOptions,cvcUnits:candidate.cvcUnits,
              phonicsUnitIds:candidate.phonicsUnitIds,words:slide.words,topic:slide.topic,boardTheme:null});
            closeReplacement();setSettings(false);
          }}>{t('lessonUx.confirmWorksheet')}</button>
        </div>
        </footer>
      </div>
    </AccessibleDialog>}
  </div>;
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
  cards: rawCards,
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
  // 게임 내용을 새로 만들면 게임 화면을 다시 그려 그 템플릿을 연다.
  const [reloadKey, setReloadKey] = useState(0);
  const templateRef = useRef(slide.templateId);
  templateRef.current = slide.templateId;
  /** Both sentence-building games can use a saved sentence list. */
  const [sentenceLists, setSentenceLists] = useState<WordList[]>([]);
  const [sentenceDraft, setSentenceDraft] = useState('');
  const [sentenceEditorOpen, setSentenceEditorOpen] = useState(false);
  const game = GAME_CATALOG.find((g) => g.type === slide.gameType);
  const GamePage = game ? GAME_PAGES[game.path] : undefined;
  const cards = useWordBankEnriched(rawCards);

  const sentenceSource = !!wordList && isSentenceList(wordList);
  const content = useMemo(() => sentenceSource
    ? prepareClassroomGame(slide.gameType, cards, 'sentence')
    : buildGameContent(slide.gameType, cards), [slide.gameType, cards, sentenceSource]);

  /** 수업 단어장으로 이 게임의 내용을 만들어 슬라이드에 붙인다 — 슬라이드를 고르면 자동으로 한 번 하고, 단어장이 바뀌면 다시 한다. */
  async function createFromLesson(reason: 'first' | 'changed') {
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
      onUpdate({ templateId: tpl.id, autoWordListId: wordListId, ownWordListId: undefined });
      setReloadKey((k) => k + 1);
      notify(t(reason === 'changed' ? 'curriculum.slides.gameContentRemade' : 'curriculum.slides.gameContentCreated'));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setCreating(false);
    }
  }

  // Opening an existing lesson is read-only; creating/replacing game content is explicit.

  // Keep the lesson-level sentence picker consistent with both game pages.
  useEffect(() => {
    if (!['unscramble', 'sentencesplash', 'lightning'].includes(slide.gameType) || !academyId) {
      setSentenceLists([]);
      return;
    }
    let alive = true;
    (classId ? fetchWordLists(academyId, classId, 'sentence') : fetchAllWordLists(academyId, 'sentence'))
      .then((l) => alive && setSentenceLists(l))
      .catch(() => alive && setSentenceLists([]));
    return () => {
      alive = false;
    };
  }, [academyId, classId, slide.gameType]);

  async function applySentenceList(listId: string) {
    const list = sentenceLists.find((l) => l.id === listId);
    if (!list || !profile || creating) return;
    await applySentences(wordListToCards(list), list);
  }

  async function applySentences(cards: FullCardItem[], list?: WordList) {
    await applySlideSource(cards, 'sentence', list);
  }

  async function applySlideSource(cards: FullCardItem[], kind: 'word' | 'sentence', list?: WordList) {
    if (!profile || creating) return;
    const content = prepareClassroomGame(slide.gameType, cards, kind);
    if (!content) {
      notify(t('wordLists.sentence.needSentences'), 'error');
      return;
    }
    setCreating(true);
    try {
      const tpl = await createGameTemplate({
        academyId,
        classId,
        gameType: slide.gameType,
        name: lessonGameTemplateName(lessonName || t('curriculum.slides.gameContentDefaultName'), list?.name),
        items:content.items,
        config: list ? {...content.config,classroomSource:{id:list.id,name:list.name,version:list.updated_at,kind,cards}} : content.config,
        teacherId: profile.id,
      });
      onUpdate({ templateId: tpl.id, ownWordListId: list?.id, autoWordListId: !list && kind === 'word' ? wordListId : undefined });
      setReloadKey((k) => k + 1);
      setSentenceEditorOpen(false);
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
      onSelect: (id: string | null) => {
        // 우리가 방금 붙인 내용을 게임 화면이 다시 알려 주는 경우는 그대로 둔다
        if (id === (templateRef.current ?? null)) return;
        onUpdate({ templateId: id ?? undefined, autoWordListId: undefined });
      },
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
          {slide.gameType === 'lightning' && <select
            aria-label={t('curriculum.slides.gameSlideWords')} className="rounded-lg border px-2.5 py-2"
            value={wordLists.some(list => list.id === slide.ownWordListId && !isSentenceList(list)) ? slide.ownWordListId : ''}
            disabled={creating} onChange={event => {
              if (event.target.value === 'lesson') {
                if (cards.length && !sentenceSource) void applySlideSource(cards,'word');
                return;
              }
              const list = wordLists.find(list => list.id === event.target.value);
              if (list) void applySlideSource(wordListToCards(list),'word',list);
            }}>
            <option value="" disabled>{t('curriculum.slides.gameSlideWords')}</option>
            <option value="lesson" disabled={!cards.length || sentenceSource}>{t('curriculum.slides.gameLessonWords')}</option>
            {wordLists.filter(list => !isSentenceList(list) && list.items.length).map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>}
          {slide.gameType === 'lightning' && <button type="button" aria-expanded={sentenceEditorOpen} className="rounded-lg border px-3 py-2" onClick={() => setSentenceEditorOpen(open => !open)}>{t('curriculum.slides.enterGameSentences')}</button>}
          {creating && (
            <span className="inline-flex items-center gap-1 font-caption text-caption text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
              {t('curriculum.slides.gameContentCreating')}
            </span>
          )}
          {(sentenceLists.length > 0 || slide.gameType === 'lightning') && (
            <select
              value=""
              disabled={creating}
              onChange={(e) => e.target.value && void applySentenceList(e.target.value)}
              aria-label={t('curriculum.slides.useSentenceList')}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-sm text-on-surface outline-none focus:border-primary"
            >
              <option value="">{t('curriculum.slides.useSentenceList')}</option>
              {sentenceLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.items.length})
                </option>
              ))}
            </select>
          )}
        </div>
        {slide.gameType === 'lightning' && sentenceEditorOpen && <div className="w-full space-y-2">
          <label className="block">{t('curriculum.slides.enterGameSentences')}
            <textarea rows={4} className="mt-1 w-full rounded-lg border p-2" value={sentenceDraft} placeholder="Pete adds cheese." onChange={event => setSentenceDraft(event.target.value)} />
          </label>
          <button type="button" disabled={creating || !sentenceDraft.trim()} className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50"
            onClick={() => void applySentences(sentenceDraft.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(word => ({id:crypto.randomUUID(),word,meaning:'',imageUrl:null})))}>{t('curriculum.slides.applyGameSentences')}</button>
        </div>}
        {pickerOpen && (
          <div className="w-full space-y-2 border-t border-outline-variant/40 pt-3">
            {GAME_MOMENTS.map((cat) => (
              <div key={cat} className="flex flex-wrap gap-1.5">
                <span className="w-full font-caption text-caption text-on-surface-variant">{t(`gameMoment.${cat}`)}</span>
                {GAME_CATALOG.filter((g) => g.moment === cat).map((g) => (
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
      {content&&(!slide.templateId||(slide.autoWordListId&&slide.autoWordListId!==wordListId))&&<button type="button" className="min-h-11 rounded-xl border px-4 py-2" disabled={creating} onClick={()=>void createFromLesson(slide.templateId?'changed':'first')}>{t('curriculum.slides.gameContentCreateNow')}</button>}
      {GamePage ? (
        <div className="game-embed relative isolate rounded-xl bg-background p-3 md:p-4">
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

type ShadowDraft = Omit<ShadowSlide, 'id' | 'kind'>;

type DrillDraft = Omit<DrillSlide, 'id' | 'kind'>;

const drillsToText = (d: DrillDraft['drills']) => d.map((x) => `${x.cue} | ${x.answer}${x.answerKo ? ` | ${x.answerKo}` : ''}`).join('\n');
const parseDrills = (text: string): DrillDraft['drills'] =>
  text
    .split(/\r?\n/)
    .map((l) => l.split('|').map((x) => x.trim()))
    .filter(([cue, answer]) => cue && answer)
    .map(([cue, answer, answerKo]) => ({ cue: cue.replace(/^\((.*)\)$/, '$1'), answer, ...(answerKo ? { answerKo } : {}) }));

/** 바꿔 말하기 슬라이드 만들기·고치기 — 본보기 문장 + 설명 + "단서 | 정답 | 해석" 줄. 영상 라이브러리 장면의 문법 연습을 가져올 수 있다. */
function DrillSlideForm({ initial, onAdd, onChange }: { initial?: DrillDraft; onAdd?: (draft: DrillDraft) => void; onChange?: (patch: Partial<DrillDraft>) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DrillDraft>(initial ?? { title: '', sentence: '', sentenceKo: '', point: '', drills: [], videoUrl: '' });
  const [text, setText] = useState(() => drillsToText(initial?.drills ?? []));
  const [libraryOpen, setLibraryOpen] = useState(false);
  function set(patch: Partial<DrillDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    onChange?.(patch);
  }
  const input = 'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary';
  return (
    <div className="space-y-3">
      {onAdd && <p className="font-body-md text-body-md text-on-surface-variant">{t('drill.addIntro')}</p>}
      <button
        type="button"
        onClick={() => setLibraryOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border-2 border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10"
      >
        <span className="material-symbols-outlined text-[18px]">video_library</span>
        {t('drill.fromLibrary')}
      </button>
      {libraryOpen && (
        <VideoClipLibrary
          pickLabel={t('drill.useClip')}
          onPick={(clip) => {
            const g = clip.pack?.grammar;
            if (!g) return;
            setText(drillsToText(g.drills));
            set({ title: clip.title, sentence: g.sentence, sentenceKo: g.sentenceKo ?? '', point: g.point, drills: g.drills, time: g.time, videoUrl: `https://www.youtube.com/watch?v=${clip.youtube_id}`, clipId: clip.id });
            setLibraryOpen(false);
          }}
        />
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={input} value={draft.sentence} onChange={(e) => set({ sentence: e.target.value })} placeholder={t('drill.sentencePlaceholder')} />
        <input className={input} value={draft.sentenceKo ?? ''} onChange={(e) => set({ sentenceKo: e.target.value })} placeholder={t('drill.sentenceKoPlaceholder')} />
        <input className={input} value={draft.point} onChange={(e) => set({ point: e.target.value })} placeholder={t('drill.pointPlaceholder')} />
        <input className={input} value={draft.videoUrl ?? ''} onChange={(e) => set({ videoUrl: e.target.value })} placeholder={t('qna.videoPlaceholder')} />
      </div>
      <textarea
        className={`${input} min-h-[140px] font-mono`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          set({ drills: parseDrills(e.target.value) });
        }}
        placeholder={t('drill.drillsPlaceholder')}
      />
      <p className="font-caption text-caption text-on-surface-variant">{t('drill.formatHint', { count: draft.drills.length })}</p>
      {onAdd && (
        <button
          type="button"
          disabled={!draft.sentence.trim() || draft.drills.length === 0}
          onClick={() => onAdd({ ...draft, videoUrl: draft.videoUrl?.trim() || null })}
          className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          {t('curriculum.study.addButton')}
        </button>
      )}
    </div>
  );
}

type QnaDraft = Omit<QnaSlide, 'id' | 'kind'>;

/** Q&A 슬라이드 만들기·고치기 — "질문 | 답 | 질문 해석 | 답 해석", 앞에 [분:초]를 붙이면 장면 보기. 영상 라이브러리 장면의 질문을 가져올 수 있다. */
function QnaSlideForm({ initial, onAdd, onChange }: { initial?: QnaDraft; onAdd?: (draft: QnaDraft) => void; onChange?: (patch: Partial<QnaDraft>) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<QnaDraft>(initial ?? { title: '', questions: [], videoUrl: '', showKo: false });
  const [text, setText] = useState(() => qnaToText(initial?.questions ?? []));
  const [libraryOpen, setLibraryOpen] = useState(false);
  function set(patch: Partial<QnaDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    onChange?.(patch);
  }
  const input = 'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary';
  return (
    <div className="space-y-3">
      {onAdd && <p className="font-body-md text-body-md text-on-surface-variant">{t('qna.addIntro')}</p>}
      <button
        type="button"
        onClick={() => setLibraryOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border-2 border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10"
      >
        <span className="material-symbols-outlined text-[18px]">video_library</span>
        {t('qna.fromLibrary')}
      </button>
      {libraryOpen && (
        <VideoClipLibrary
          pickLabel={t('qna.useClip')}
          onPick={(clip) => {
            const questions = clip.pack?.questions ?? [];
            setText(qnaToText(questions));
            set({ title: clip.title, questions, videoUrl: `https://www.youtube.com/watch?v=${clip.youtube_id}`, clipId: clip.id });
            setLibraryOpen(false);
          }}
        />
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={input} value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder={t('qna.titlePlaceholder')} />
        <input className={input} value={draft.videoUrl ?? ''} onChange={(e) => set({ videoUrl: e.target.value })} placeholder={t('qna.videoPlaceholder')} />
      </div>
      <textarea
        className={`${input} min-h-[160px] font-mono`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          set({ questions: parseQnaText(e.target.value) });
        }}
        placeholder={t('qna.sourcePlaceholder')}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant">
          <input type="checkbox" checked={!!draft.showKo} onChange={(e) => set({ showKo: e.target.checked })} />
          {t('qna.showKoStart')}
        </label>
        <span className="font-caption text-caption text-on-surface-variant">{t('qna.count', { count: draft.questions.length })}</span>
      </div>
      <p className="font-caption text-caption text-on-surface-variant">{t('qna.formatHint')}</p>
      {onAdd && (
        <button
          type="button"
          disabled={draft.questions.length === 0}
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

/** 라이브러리 장면 → 쉐도잉 슬라이드 내용 */
function shadowDraftFromClip(clip: VideoClip): ShadowDraft {
  return {
    title: clip.title,
    source: clip.script,
    videoUrl: `https://www.youtube.com/watch?v=${clip.youtube_id}`,
    flow: 'video',
    repeat: 1,
    speed: 1,
    subtitle: 'both',
    roleTeams: 0,
    clipId: clip.id,
  };
}

/** 쉐도잉 슬라이드 추가 — 영상 라이브러리에서 고르기(기본) / 직접 만들기 */
function ShadowSlideDetail({ slide, onUpdate }: { slide: ShadowSlide; onUpdate: (patch: Partial<LessonSlide>) => void }) {
  const { t } = useTranslation();
  const down = useClipTakenDown(slide.clipId);
  return (
    <div className="space-y-3">
      {slide.clipId && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 font-caption text-caption ${down ? 'bg-error-container text-on-error-container' : 'bg-secondary-container/30 text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-[18px]">{down ? 'block' : 'video_library'}</span>
          {t(down ? 'videoLibrary.takenDown' : 'videoLibrary.fromLibrary')}
        </div>
      )}
      {!down && (
        <div className="h-[560px] w-full max-w-3xl">
          <ShadowBoard
            preparation
            source={slide.source}
            title={slide.title}
            videoUrl={slide.videoUrl}
            flow={slide.flow}
            repeat={slide.repeat}
            speed={slide.speed}
            subtitle={slide.subtitle}
            roleTeams={slide.roleTeams}
          />
        </div>
      )}
      {!down && <details>
        <summary className="cursor-pointer font-bold">{t('videoLibrary.tabLibrary')}</summary>
        <VideoClipLibrary pickLabel={t('lessonUx.useVideo')} onPick={clip => onUpdate(shadowDraftFromClip(clip))} />
      </details>}
      {!down && <ShadowSlideForm key={slide.clipId ?? slide.id} initial={slide} onChange={(patch) => onUpdate(patch as Partial<LessonSlide>)} />}
    </div>
  );
}

/** 쉐도잉 슬라이드 만들기·고치기 — 유튜브 주소 + 대사표. 유튜브 "스크립트 표시"를 그대로 붙여넣어도 시간표로 바꿔 준다. */
function ShadowSlideForm({ initial, onAdd, onChange }: { initial?: ShadowDraft; onAdd?: (draft: ShadowDraft) => void; onChange?: (patch: Partial<ShadowDraft>) => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [draft, setDraft] = useState<ShadowDraft>(initial ?? { title: '', source: '', videoUrl: '', flow: 'video', repeat: 1, speed: 1, subtitle: 'both', roleTeams: 0 });
  const [busy, setBusy] = useState(false);
  const lines = parseShadowText(draft.source);
  const speakers = shadowSpeakers(lines);
  function set(patch: Partial<ShadowDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    onChange?.(patch);
  }
  async function autoScript() {
    const id = extractYoutubeId(draft.videoUrl ?? '');
    if (!id || busy) return;
    setBusy(true);
    try {
      const script = await generateShadowScript(id, draft.source);
      set({ source: script });
      notify(t('curriculum.shadow.autoDone'));
    } catch {
      notify(t('curriculum.shadow.autoUnavailable'), 'error');
    } finally {
      setBusy(false);
    }
  }
  const input = 'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary';
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 font-label-md text-label-md ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`;
  return (
    <div className="space-y-3">
      {onAdd && <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.shadow.addIntro')}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={input} value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder={t('curriculum.shadow.titlePlaceholder')} />
        <input className={input} value={draft.videoUrl ?? ''} onChange={(e) => set({ videoUrl: e.target.value })} placeholder={t('curriculum.shadow.videoPlaceholder')} />
      </div>
      <details className="rounded-xl border border-outline-variant bg-white p-3" data-preparation-settings><summary className="min-h-11 cursor-pointer font-bold">{t('mediaV2.settings')}</summary>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-label-md text-label-md text-on-surface-variant">{t('curriculum.shadow.flowLabel')}</span>
        {(['video', 'auto', 'manual'] as const).map((f) => (
          <button key={f} type="button" onClick={() => set({ flow: f })} className={chip((draft.flow ?? 'auto') === f)}>
            {t(`curriculum.shadow.flow_${f}`)}
          </button>
        ))}
        <select value={draft.repeat ?? 1} onChange={(e) => set({ repeat: Number(e.target.value) })} className="rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm">
          {SHADOW_REPEATS.map((n) => <option key={n} value={n}>{t('curriculum.shadow.repeatN', { n })}</option>)}
        </select>
        <select value={draft.speed ?? 1} onChange={(e) => set({ speed: Number(e.target.value) })} className="rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm">
          {SHADOW_SPEEDS.map((n) => <option key={n} value={n}>{n}x</option>)}
        </select>
        <select value={draft.subtitle ?? 'both'} onChange={(e) => set({ subtitle: e.target.value as ShadowDraft['subtitle'] })} className="rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm">
          {SHADOW_SUBTITLES.map((n) => <option key={n} value={n}>{t(`curriculum.shadow.sub_${n}`)}</option>)}
        </select>
        {speakers.length > 1 && (
          <select value={draft.roleTeams ?? 0} onChange={(e) => set({ roleTeams: Number(e.target.value) })} className="rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm">
            {[0, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 0 ? t('curriculum.shadow.rolesOff') : t('curriculum.shadow.rolesN', { n })}</option>)}
          </select>
        )}
      </div>
      </details>
      <details className="rounded-xl border border-outline-variant bg-white p-3" data-script-editor><summary className="min-h-11 cursor-pointer font-bold">{t('prelaunchUx.script')}</summary>
      <textarea
        aria-label={t('prelaunchUx.script')}
        className={`${input} min-h-[200px] font-mono`}
        value={draft.source}
        onChange={(e) => set({ source: e.target.value })}
        onPaste={(e) => {
          // 유튜브 "스크립트 표시"·SRT 를 붙여넣으면 바로 대사표로 바꾼다(빈 칸에 붙여넣을 때만)
          if (draft.source.trim()) return;
          const text = e.clipboardData.getData('text');
          const converted = toShadowSource(text);
          if (converted !== text.trim()) {
            e.preventDefault();
            set({ source: converted });
          }
        }}
        placeholder={t('curriculum.shadow.sourcePlaceholder')}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void autoScript()}
          disabled={busy || !extractYoutubeId(draft.videoUrl ?? '')}
          className="flex items-center gap-1.5 rounded-full border-2 border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          <span className={`material-symbols-outlined text-[18px] ${busy ? 'animate-spin' : ''}`}>{busy ? 'progress_activity' : 'auto_awesome'}</span>
          {t('curriculum.shadow.autoButton')}
        </button>
        <button
          type="button"
          onClick={() => set({ source: toShadowSource(draft.source) })}
          className="flex items-center gap-1.5 rounded-full border border-outline-variant px-4 py-1.5 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined text-[18px]">schedule</span>
          {t('curriculum.shadow.convertButton')}
        </button>
        <span className="font-caption text-caption text-on-surface-variant">
          {t('curriculum.shadow.lineCount', { count: lines.length })}
          {speakers.length > 0 && ` · ${t('curriculum.shadow.speakers', { names: speakers.join(', ') })}`}
        </span>
      </div>
      <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.shadow.formatHint')}</p></details>
      {onAdd && (
        <button
          type="button"
          disabled={lines.length === 0 || !extractYoutubeId(draft.videoUrl ?? '')}
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

/**
 * 단어 소개·카드로 외우기 슬라이드의 "이 슬라이드 단어"(2026-10-03 제보: 복사한 슬라이드가 같이 바뀐다).
 * 기본은 수업 단어장 전체. "이 슬라이드만 고르기"를 켜면 수업 단어장(또는 다른 단어장)에서 골라 이 슬라이드에만 저장한다.
 */
/** 슬라이드가 자기 낱말만 갖고 있을 때(영상 수업 등) "내 단어장"으로 저장 — 게임 슬라이드가 같은 낱말을 쓰게 된다 */
function SaveWordsAsList({ words, name, onSave }: { words: FullCardItem[]; name: string; onSave: (words: FullCardItem[], name: string) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
      <button
        type="button"
        disabled={busy || done}
        onClick={async () => {
          setBusy(true);
          const ok = await onSave(words, name);
          setBusy(false);
          if (ok) setDone(true);
        }}
        className="flex items-center gap-1.5 rounded-full border-2 border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[18px]">{done ? 'check_circle' : 'bookmark_add'}</span>
        {done ? t('curriculum.slides.saveWordsAsListDone') : t('curriculum.slides.saveWordsAsList', { count: words.length })}
      </button>
      <span className="font-caption text-caption text-on-surface-variant">{t('curriculum.slides.saveWordsAsListHint')}</span>
    </div>
  );
}

function SlideOwnWords({
  cards,
  wordLists,
  value,
  onChange,
}: {
  cards: FullCardItem[];
  wordLists: WordList[];
  value: FullCardItem[] | undefined;
  onChange: (words: FullCardItem[] | undefined) => void;
}) {
  const { t } = useTranslation();
  const own = !!value && value.length > 0;
  const [pickOn, setPickOn] = useState(own);
  const [sourceId, setSourceId] = useState('');
  useEffect(() => setPickOn(own), [own]);
  const source = sourceId ? wordListToCards(wordLists.find((wl) => wl.id === sourceId) ?? null) : cards;
  const chosen = new Set((value ?? []).map((w) => `${w.word.toLowerCase()}::${w.meaning}`));
  const keyOf = (w: FullCardItem) => `${w.word.toLowerCase()}::${w.meaning}`;
  function toggle(w: FullCardItem) {
    const list = value ?? [];
    const next = chosen.has(keyOf(w)) ? list.filter((x) => keyOf(x) !== keyOf(w)) : [...list, w];
    onChange(next.length ? next : undefined);
  }
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 font-label-md text-label-md ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'}`;
  return (
    <div className="space-y-2 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
      <div className="font-label-md text-label-md text-on-surface">{t('curriculum.ownWords.title')}</div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={chip(!pickOn)}
          onClick={() => {
            setPickOn(false);
            onChange(undefined);
          }}
        >
          {t('curriculum.ownWords.useLesson', { count: cards.length })}
        </button>
        <button type="button" className={chip(pickOn)} onClick={() => setPickOn(true)}>
          {t('curriculum.ownWords.pick')}
        </button>
      </div>
      {pickOn && (
        <div className="space-y-2">
          <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.ownWords.hint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary"
            >
              <option value="">{t('curriculum.ownWords.fromLesson')}</option>
              {wordLists.map((wl) => (
                <option key={wl.id} value={wl.id}>
                  {wl.name} ({wl.items.length})
                </option>
              ))}
            </select>
            <button type="button" onClick={() => onChange([...(value ?? []), ...source.filter((w) => !chosen.has(keyOf(w)))])} className="font-label-md text-label-md text-primary hover:underline">
              {t('curriculum.ownWords.all')}
            </button>
            <button type="button" onClick={() => onChange(undefined)} className="font-label-md text-label-md text-on-surface-variant hover:underline">
              {t('curriculum.ownWords.clear')}
            </button>
            <span className="font-caption text-caption text-on-surface-variant">{t('curriculum.ownWords.count', { count: value?.length ?? 0 })}</span>
          </div>
          <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
            {source.map((w) => {
              const on = chosen.has(keyOf(w));
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => toggle(w)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors ${
                    on ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/50 bg-surface-container-lowest text-on-surface hover:border-primary'
                  }`}
                >
                  {w.imageUrl && <img src={w.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />}
                  {w.word}
                  {on && <span className="material-symbols-outlined text-[16px]">check</span>}
                </button>
              );
            })}
            {source.length === 0 && <span className="font-caption text-caption text-on-surface-variant">{t('curriculum.study.needWordList')}</span>}
          </div>
        </div>
      )}
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
        {wordLists.filter((wl) => !wl.group_name).map((wl) => (
          <option key={wl.id} value={wl.id}>
            {wl.name} ({wl.items.length})
          </option>
        ))}
        {[...new Set(wordLists.map((wl) => wl.group_name).filter((g): g is string => !!g))].map((g) => (
          <optgroup key={g} label={g}>
            {wordLists.filter((wl) => wl.group_name === g).map((wl) => (
              <option key={wl.id} value={wl.id}>
                {wl.name} ({wl.items.length})
              </option>
            ))}
          </optgroup>
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
  settingsOnly = false,
}: {
  slide: MaterialSlide;
  cards: FullCardItem[];
  onUpdate: (patch: Partial<MaterialSlide>) => void;
  settingsOnly?: boolean;
}) {
  const { t } = useTranslation();
  const tab = slide.phonicsTab ?? 'phonicsBlank';
  const own = slide.words && slide.words.length > 0;
  const lessonPhonics = cards.filter((c) => c.patternMarked).length;
  return (
    <div className="space-y-4">
      {!settingsOnly&&<PreviewFrame title={`${t('materials.phonicsLibraryName')} · ${phonicsTabLabel(tab, t)}`}>
        <PhonicsSlidePreview tab={tab} words={own ? slide.words! : cards} options={slide.phonicsOptions ?? {}} />
      </PreviewFrame>}
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
