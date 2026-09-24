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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { deleteLessonSlideImage, uploadLessonSlideImage } from '../lib/api';
import { GAME_CATALOG, type GameCategory } from '../lib/gameCatalog';
import type { GameSlide, ImageSlide, LessonSlide, VideoSlide, WordList } from '../lib/types';
import { extractYoutubeId } from '../lib/youtube';
import GameImagePicker from './GameImagePicker';

const CATEGORY_ORDER: GameCategory[] = ['simple', 'vocabulary', 'sentence', 'listening', 'reading', 'speaking'];

function uid(): string {
  return crypto.randomUUID();
}

interface Props {
  academyId: string;
  slides: LessonSlide[];
  onChange: (slides: LessonSlide[]) => void;
  wordListId: string;
  wordLists: WordList[];
  onWordListChange: (id: string) => void;
}

type AddMode = 'image' | 'video' | 'game' | null;

/** 캔바 프레젠테이션 편집 화면처럼 — 왼쪽 세로 슬라이드 썸네일 레일(드래그로 순서 변경) +
 * 오른쪽 선택된 슬라이드 상세 패널. 이미지·유튜브·게임 3종을 자유 순서로 섞어 배치한다. */
export default function LessonSlideSorter({ academyId, slides, onChange, wordListId, wordLists, onWordListChange }: Props) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(slides[0]?.id ?? null);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [videoDraft, setVideoDraft] = useState('');

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
              {(['image', 'video', 'game'] as const).map((m) => (
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
          </div>
        )}

        {!selected ? (
          <div className="py-10 text-center font-body-md text-body-md text-on-surface-variant">
            {t('curriculum.slides.empty')}
          </div>
        ) : (
          <SlideDetail
            slide={selected}
            academyId={academyId}
            wordListId={wordListId}
            wordLists={wordLists}
            onWordListChange={onWordListChange}
            onUpdate={(patch) => updateSlide(selected.id, patch)}
          />
        )}
      </div>
    </div>
  );
}

function slideThumbLabel(slide: LessonSlide, t: (key: string) => string): { icon: string; label: string } {
  if (slide.kind === 'image') return { icon: 'image', label: t('curriculum.slides.kindImage') };
  if (slide.kind === 'video') return { icon: 'smart_display', label: t('curriculum.slides.kindVideo') };
  const entry = GAME_CATALOG.find((g) => g.type === slide.gameType);
  return { icon: entry?.icon ?? 'sports_esports', label: entry ? t(entry.nameKey) : slide.gameType };
}

function SlideThumb({
  slide,
  index,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
}: {
  slide: LessonSlide;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
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
      <div className="truncate bg-surface-container-lowest px-2 py-1.5 text-left font-caption text-caption text-on-surface">
        {label}
      </div>
    </div>
  );
}

function SlideDetail({
  slide,
  academyId,
  wordListId,
  wordLists,
  onWordListChange,
  onUpdate,
}: {
  slide: LessonSlide;
  academyId: string;
  wordListId: string;
  wordLists: WordList[];
  onWordListChange: (id: string) => void;
  onUpdate: (patch: Partial<LessonSlide>) => void;
}) {
  const { t } = useTranslation();

  if (slide.kind === 'image') {
    return (
      <div className="space-y-3">
        <div className="font-label-md text-label-md text-on-surface-variant">{t('curriculum.slides.kindImage')}</div>
        <img src={slide.imageUrl} alt="" className="max-h-64 rounded-lg border border-outline-variant/40 object-contain" />
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
        <div className="font-label-md text-label-md text-on-surface-variant">{t('curriculum.slides.kindVideo')}</div>
        <input
          type="text"
          value={slide.videoUrl}
          onChange={(e) => onUpdate({ videoUrl: e.target.value } as Partial<VideoSlide>)}
          className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        {videoId && (
          <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt="" className="max-h-64 rounded-lg border border-outline-variant/40" />
        )}
      </div>
    );
  }

  // game slide
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 font-label-md text-label-md text-on-surface-variant">{t('curriculum.slides.changeGame')}</div>
        <div className="space-y-2">
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat} className="flex flex-wrap gap-1.5">
              {GAME_CATALOG.filter((g) => g.category === cat).map((g) => (
                <button
                  key={g.type}
                  type="button"
                  onClick={() => onUpdate({ gameType: g.type } as Partial<GameSlide>)}
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
    </div>
  );
}
