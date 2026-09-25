import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createGameTemplate, deleteLessonSlideImage, fetchGameTemplates, uploadLessonSlideImage } from '../lib/api';
import { GAME_CATALOG, type GameCategory } from '../lib/gameCatalog';
import { buildGameContent, canBuildFromWords, lessonGameTemplateName, wordListToCards } from '../lib/gameFromWords';
import { MATERIALS_CATALOG, WORKSHEET_TAB_CATALOG } from '../lib/materialsCatalog';
import { DEFAULT_COLORING_OPTIONS, type AskTemplate, type ColoringOptions } from '../lib/worksheetGenerators';
import type {
  FullCardItem,
  GameSlide,
  GameTemplate,
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
}

/** 게임 슬라이드가 발표 때 열 내용이 정해졌는지 — 템플릿을 골랐거나, 저장할 때 수업 단어장으로
 * 자동으로 만들 수 있으면 OK. */
function gameSlideReady(slide: GameSlide, cards: FullCardItem[]): boolean {
  return !!slide.templateId || buildGameContent(slide.gameType, cards) !== null;
}

type AddMode = 'canvas' | 'image' | 'video' | 'web' | 'game' | 'material' | null;

/** 캔바 프레젠테이션 편집 화면처럼 — 왼쪽 세로 슬라이드 썸네일 레일(드래그로 순서 변경) +
 * 오른쪽 선택된 슬라이드 상세 패널. 이미지·유튜브·게임·수업 자료실 4종을 자유 순서로 섞어 배치한다. */
export default function LessonSlideSorter({
  academyId,
  classId,
  lessonName,
  slides,
  onChange,
  wordListId,
  wordLists,
  onWordListChange,
}: Props) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const wordList = wordLists.find((wl) => wl.id === wordListId) ?? null;
  const cards = useMemo(() => wordListToCards(wordList), [wordList]);
  const [selectedId, setSelectedId] = useState<string | null>(slides[0]?.id ?? null);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [videoDraft, setVideoDraft] = useState('');
  const [webDraft, setWebDraft] = useState({ url: '', title: '' });
  const [worksheetDraftTab, setWorksheetDraftTab] = useState(WORKSHEET_TAB_CATALOG[0]?.tab ?? 'list');
  const [worksheetDraftOptions, setWorksheetDraftOptions] = useState<WorksheetOptionsState>(DEFAULT_WORKSHEET_OPTIONS_STATE);
  // 새 워크시트 슬라이드의 발표 화면 바탕 — 앱 기본 파란 바탕은 글이 잘 안 읽혀서 화이트보드로 시작.
  const [worksheetDraftBoard, setWorksheetDraftBoard] = useState<string | null>('whiteboard');
  const [canvasDraftTheme, setCanvasDraftTheme] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selected = slides.find((s) => s.id === selectedId) ?? null;

  function addSlide(slide: LessonSlide) {
    onChange([...slides, slide]);
    setSelectedId(slide.id);
  }

  function updateSlide(id: string, patch: Partial<LessonSlide>) {
    onChange(slides.map((s) => (s.id === id ? ({ ...s, ...patch } as LessonSlide) : s)));
  }

  function removeSlide(id: string) {
    const target = slides.find((s) => s.id === id);
    const idx = slides.findIndex((s) => s.id === id);
    const next = slides.filter((s) => s.id !== id);
    onChange(next);
    if (selectedId === id) {
      setSelectedId(next[Math.min(idx, next.length - 1)]?.id ?? null);
    }
    // 복제한 슬라이드끼리는 같은 그림 파일을 쓰므로, 다른 슬라이드가 아직 쓰고 있으면 지우지 않는다.
    const stillUsed = (path: string) =>
      next.some((s) => (s.kind === 'image' && s.imagePath === path) || (s.kind === 'canvas' && s.backgroundImagePath === path));
    if (target?.kind === 'image' && !stillUsed(target.imagePath)) {
      void deleteLessonSlideImage(target.imagePath).catch(() => {
        /* 고아 이미지가 남아도 화면 진행은 막지 않는다 */
      });
    }
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

  function addCanvasSlide(layout: 'title' | 'word' | 'blank') {
    const slide = newCanvasSlide(canvasDraftTheme);
    if (layout === 'blank') slide.elements = [];
    if (layout === 'word') {
      const card = cards.find((c) => c.imageUrl) ?? cards[0];
      slide.elements = card?.imageUrl
        ? [
            { id: uid(), type: 'image', x: 32, y: 8, w: 36, h: 62, url: card.imageUrl, fit: 'contain' },
            newTextElement({ x: 15, y: 72, w: 70, h: 18, text: card.word, ...themeTextDefaults(canvasDraftTheme, 'title'), fontSize: 11 }),
          ]
        : [newTextElement({ x: 15, y: 35, w: 70, h: 24, text: card?.word ?? '', ...themeTextDefaults(canvasDraftTheme, 'title') })];
    }
    addSlide(slide);
    setAddMode(null);
  }

  function addGameSlide(gameType: GameSlide['gameType']) {
    addSlide({ id: uid(), kind: 'game', gameType });
  }

  function addMaterialSlide(materialId: string, worksheetTab?: string, worksheetOptions?: WorksheetSlideOptions, boardTheme?: string | null) {
    addSlide({
      id: uid(),
      kind: 'material',
      materialId,
      ...(worksheetTab ? { worksheetTab } : {}),
      ...(worksheetOptions ? { worksheetOptions } : {}),
      ...(boardTheme ? { boardTheme } : {}),
    });
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      {/* 왼쪽 슬라이드 레일 */}
      <div className="flex shrink-0 flex-row gap-2 overflow-x-auto pb-2 md:w-56 md:flex-col md:overflow-x-visible md:overflow-y-auto md:pb-0" style={{ maxHeight: '520px' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {slides.map((slide, i) => (
              <SlideThumb
                key={slide.id}
                slide={slide}
                index={i}
                selected={slide.id === selectedId}
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
          onClick={() => setAddMode((m) => (m ? null : 'canvas'))}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-outline-variant px-4 py-3 font-label-md text-label-md text-on-surface-variant transition-colors hover:border-primary hover:text-primary md:w-full"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('curriculum.slides.addSlide')}
        </button>
      </div>

      {/* 오른쪽: 슬라이드 추가 패널 또는 선택된 슬라이드 상세 */}
      <div className="min-w-0 flex-1 rounded-xl bg-surface-container-low p-4">
        {addMode && (
          <div className="mb-4 space-y-3 rounded-lg bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {(['canvas', 'image', 'video', 'web', 'game', 'material'] as const).map((m) => (
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
                {t('curriculum.slides.closeAddPanel')}
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

            {addMode === 'canvas' && (
              <div className="space-y-2">
                <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.canvas.addIntro')}</p>
                <div className="space-y-1">
                  <div className="font-caption text-caption font-bold text-on-surface-variant">{t('curriculum.board.pickTitle')}</div>
                  <BoardThemeChips value={canvasDraftTheme} onChange={(th) => setCanvasDraftTheme(th?.id ?? null)} noneLabel={t('curriculum.board.plainWhite')} />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(['title', 'word', 'blank'] as const).map((layout) => (
                    <button
                      key={layout}
                      type="button"
                      disabled={layout === 'word' && cards.length === 0}
                      onClick={() => addCanvasSlide(layout)}
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
                  {MATERIALS_CATALOG.filter((m) => m.id !== 'worksheet').map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addMaterialSlide(m.id)}
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
                          {t('curriculum.slides.previewWordCount', { count: cards.length })}
                        </span>
                      </div>
                      <WorksheetTypePreview
                        tab={worksheetDraftTab}
                        words={cards}
                        title={t(`materials.worksheet.${WORKSHEET_TAB_CATALOG.find((wt) => wt.tab === worksheetDraftTab)?.labelKey ?? 'tabList'}`)}
                        compact
                      />
                      {cards.length === 0 && <p className="mt-2 text-center font-caption text-caption text-on-surface-variant">{t('curriculum.slides.previewSampleWords')}</p>}
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
                      <div className="mt-3 space-y-1.5 border-t border-outline-variant/40 pt-3">
                        <div className="font-caption text-caption font-bold text-on-surface-variant">{t('curriculum.board.worksheetTitle')}</div>
                        <BoardThemeChips value={worksheetDraftBoard} onChange={(th) => setWorksheetDraftBoard(th?.id ?? null)} noneLabel={t('curriculum.board.none')} />
                        <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.board.worksheetHint')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addMaterialSlide('worksheet', worksheetDraftTab, slideOptionsFromState(worksheetDraftOptions), worksheetDraftBoard)}
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
            />
          ))}
      </div>
    </div>
  );
}

function slideThumbLabel(slide: LessonSlide, t: (key: string) => string): { icon: string; label: string } {
  if (slide.kind === 'image') return { icon: 'image', label: t('curriculum.slides.kindImage') };
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
      className={`group relative flex shrink-0 cursor-grab flex-col overflow-hidden rounded-xl border-2 transition-colors active:cursor-grabbing md:w-full ${
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
      <div className="flex h-24 w-40 shrink-0 items-center justify-center bg-surface-container md:w-full">
        {slide.kind === 'canvas' ? (
          <CanvasSlideView slide={slide} className="pointer-events-none" />
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
}) {
  const { t } = useTranslation();

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
            void deleteLessonSlideImage(slide.imagePath).catch(() => {});
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
    const game = GAME_CATALOG.find((g) => g.type === slide.gameType);
    return (
      <div className="space-y-4">
        <PreviewFrame title={game ? t(game.nameKey) : slide.gameType}>
          {game?.cover ? <img src={game.cover} alt="" className="h-full w-full object-cover" /> : <span className="material-symbols-outlined text-6xl text-primary">{game?.icon ?? 'sports_esports'}</span>}
        </PreviewFrame>
        <div>
          <div className="mb-1.5 font-label-md text-label-md text-on-surface-variant">{t('curriculum.slides.changeGame')}</div>
          <div className="space-y-2">
            {CATEGORY_ORDER.map((cat) => (
              <div key={cat} className="flex flex-wrap gap-1.5">
                {GAME_CATALOG.filter((g) => g.category === cat).map((g) => (
                  <button
                    key={g.type}
                    type="button"
                    onClick={() =>
                      // 게임 종류가 바뀌면 이전 게임의 내용(템플릿)은 맞지 않으니 비운다.
                      slide.gameType !== g.type && onUpdate({ gameType: g.type, templateId: undefined } as Partial<GameSlide>)
                    }
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
                      slide.gameType === g.type
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:bg-secondary-container/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{g.icon}</span>
                    {t(g.nameKey)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <WordListSelect wordListId={wordListId} wordLists={wordLists} onWordListChange={onWordListChange} />
        <GameContentPicker
          slide={slide}
          academyId={academyId}
          classId={classId}
          lessonName={lessonName}
          wordList={wordList}
          cards={cards}
          onPick={(templateId) => onUpdate({ templateId } as Partial<GameSlide>)}
        />
      </div>
    );
  }

  // material slide
  const material = MATERIALS_CATALOG.find((m) => m.id === slide.materialId);
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
            <span className="rounded-full bg-secondary-container px-2.5 py-1 font-caption text-caption text-on-secondary-container">{t('curriculum.slides.previewWordCount', { count: cards.length })}</span>
          </div>
          <WorksheetTypePreview tab={worksheet.tab} words={cards} title={t(`materials.worksheet.${worksheet.labelKey}`)} />
          {cards.length === 0 && <p className="mt-2 text-center font-caption text-caption text-on-surface-variant">{t('curriculum.slides.previewSampleWords')}</p>}
        </div>
      ) : (
        <PreviewFrame title={material ? t(material.nameKey) : slide.materialId}>
          {material?.cover ? <img src={material.cover} alt="" className="h-full w-full object-cover" /> : <span className="material-symbols-outlined text-6xl text-primary">{material?.icon ?? 'print'}</span>}
        </PreviewFrame>
      )}
      <div>
        <div className="mb-1.5 font-label-md text-label-md text-on-surface-variant">{t('curriculum.slides.changeMaterial')}</div>
        <div className="flex flex-wrap gap-1.5">
          {MATERIALS_CATALOG.filter((m) => m.id !== 'worksheet').map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onUpdate({ materialId: m.id, worksheetTab: undefined } as Partial<MaterialSlide>)}
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
            hasWords={cards.length > 0}
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
      {worksheet && (
        <div className="space-y-1.5 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
          <div className="font-label-md text-label-md text-on-surface">{t('curriculum.board.worksheetTitle')}</div>
          <BoardThemeChips
            value={slide.boardTheme ?? null}
            onChange={(th) => onUpdate({ boardTheme: th?.id ?? null } as Partial<MaterialSlide>)}
            noneLabel={t('curriculum.board.none')}
          />
          <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.board.worksheetHint')}</p>
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
function GameContentPicker({
  slide,
  academyId,
  classId,
  lessonName,
  wordList,
  cards,
  onPick,
}: {
  slide: GameSlide;
  academyId: string;
  classId: string | null;
  lessonName: string;
  wordList: WordList | null;
  cards: FullCardItem[];
  onPick: (templateId: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { notify } = useToast();
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!classId) {
      setTemplates([]);
      return;
    }
    let cancelled = false;
    fetchGameTemplates(academyId, classId, slide.gameType)
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [academyId, classId, slide.gameType]);

  const content = useMemo(() => buildGameContent(slide.gameType, cards), [slide.gameType, cards]);
  const canAuto = content !== null;

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
      setTemplates((prev) => [...prev, tpl]);
      onPick(tpl.id);
      notify(t('curriculum.slides.gameContentCreated'));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setCreating(false);
    }
  }

  const linkedMissing = !!slide.templateId && !templates.some((tpl) => tpl.id === slide.templateId);

  let hint: string;
  if (slide.templateId) hint = t('curriculum.slides.gameContentLinked');
  else if (canAuto) hint = t('curriculum.slides.gameContentAutoHint');
  else if (!canBuildFromWords(slide.gameType)) hint = t('curriculum.slides.gameContentNeedsCenter');
  else if (!wordList) hint = t('curriculum.slides.gameContentNeedsWordList');
  else hint = t('curriculum.slides.gameContentNotEnough');

  return (
    <div className="space-y-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3">
      <div className="font-label-md text-label-md text-on-surface">{t('curriculum.slides.gameContentTitle')}</div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={slide.templateId ?? ''}
          onChange={(e) => onPick(e.target.value || undefined)}
          className="w-64 max-w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="">
            {canAuto ? t('curriculum.slides.gameContentAutoOption') : t('curriculum.slides.gameContentNoneOption')}
          </option>
          {linkedMissing && <option value={slide.templateId}>{t('curriculum.slides.gameContentLinkedOther')}</option>}
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
        {canAuto && (
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
      <p
        className={`font-caption text-caption ${
          slide.templateId || canAuto ? 'text-on-surface-variant' : 'text-error'
        }`}
      >
        {hint}
      </p>
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
    </div>
  );
}
