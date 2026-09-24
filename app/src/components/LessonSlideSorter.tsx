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
import type { FullCardItem, GameSlide, GameTemplate, ImageSlide, LessonSlide, MaterialSlide, VideoSlide, WordList } from '../lib/types';
import { extractYoutubeId } from '../lib/youtube';
import GameImagePicker from './GameImagePicker';
import WorksheetTypePreview from './WorksheetTypePreview';

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

type AddMode = 'image' | 'video' | 'game' | 'material' | null;

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
  const [worksheetDraftTab, setWorksheetDraftTab] = useState(WORKSHEET_TAB_CATALOG[0]?.tab ?? 'list');

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
    if (target?.kind === 'image') {
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

  function addGameSlide(gameType: GameSlide['gameType']) {
    addSlide({ id: uid(), kind: 'game', gameType });
  }

  function addMaterialSlide(materialId: string, worksheetTab?: string) {
    addSlide({ id: uid(), kind: 'material', materialId, ...(worksheetTab ? { worksheetTab } : {}) });
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
                onSelect={() => setSelectedId(slide.id)}
                onDelete={() => removeSlide(slide.id)}
                onDuplicate={() => duplicateSlide(slide.id)}
                needsContent={slide.kind === 'game' && !gameSlideReady(slide, cards)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={() => setAddMode((m) => (m ? null : 'image'))}
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
              {(['image', 'video', 'game', 'material'] as const).map((m) => (
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
                }}
              />
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
                      <button
                        type="button"
                        onClick={() => addMaterialSlide('worksheet', worksheetDraftTab)}
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
  if (slide.kind === 'video') return { icon: 'smart_display', label: t('curriculum.slides.kindVideo') };
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
        {slide.kind === 'image' ? (
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

  if (slide.kind === 'image') {
    return (
      <div className="space-y-3">
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
      <WordListSelect wordListId={wordListId} wordLists={wordLists} onWordListChange={onWordListChange} />
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
