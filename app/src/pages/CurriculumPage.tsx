import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ClassChipRow from '../components/ClassChipRow';
import LessonSlideSorter from '../components/LessonSlideSorter';
import { useAuth } from '../context/AuthContext';
import { useLessonRunner } from '../context/LessonRunnerContext';
import { useToast } from '../context/ToastContext';
import {
  createCurriculumLesson,
  createWordList,
  deleteCurriculumLesson,
  fetchCurriculumLessons,
  fetchWordLists,
  generateWordListFromVideo,
} from '../lib/api';
import { useClasses } from '../lib/useClasses';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { effectiveSlides } from '../lib/lessonSlides';
import { extractYoutubeId } from '../lib/youtube';
import type { CurriculumLesson, LessonSlide, WordList } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

export default function CurriculumPage() {
  const { t } = useTranslation();
  const { start } = useLessonRunner();
  const { academy, profile } = useAuth();
  const { notify, run } = useToast();
  const { classes, selectedId: staffClassId, select: selectClass, reorder: reorderClasses } = useClasses(academy?.id);

  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [lessons, setLessons] = useState<CurriculumLesson[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    if (!academy?.id || !staffClassId) {
      setWordLists([]);
      setLessons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [wl, ls] = await Promise.all([
        fetchWordLists(academy.id, staffClassId),
        fetchCurriculumLessons(academy.id, staffClassId),
      ]);
      setWordLists(wl);
      setLessons(ls);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academy?.id, staffClassId]);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [wordListId, setWordListId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [level, setLevel] = useState('');
  const [playlist, setPlaylist] = useState<LessonSlide[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);

  async function handleExtractFromVideo() {
    if (!academy?.id || !profile) return;
    const videoId = extractYoutubeId(videoUrl);
    if (!videoId) {
      notify(t('curriculum.player.invalidUrl'), 'error');
      return;
    }
    setExtracting(true);
    try {
      const words = await generateWordListFromVideo(videoId);
      if (words.length === 0) {
        notify(t('curriculum.aiExtractEmpty'), 'error');
        return;
      }
      const list = await createWordList({
        academyId: academy.id,
        classId: staffClassId,
        name: t('curriculum.aiExtractedListName', { name: name.trim() || videoId }),
        items: words.map((w) => ({ id: uid(), word: w.word, meaning: w.meaning, image_url: null, category: null })),
        teacherId: profile.id,
      });
      setWordLists((prev) => [...prev, list]);
      setWordListId(list.id);
      notify(t('curriculum.aiExtractSuccess', { count: words.length }));
    } catch (err) {
      notify(t('curriculum.aiExtractNotReady'), 'error');
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setExtracting(false);
    }
  }

  function resetForm() {
    setName('');
    setWordListId('');
    setVideoUrl('');
    setLevel('');
    setPlaylist([]);
    setShowForm(false);
  }

  async function handleCreate() {
    if (!academy?.id || !profile || !staffClassId) return;
    if (!name.trim()) {
      notify(t('curriculum.nameRequiredError'), 'error');
      return;
    }
    setSubmitting(true);
    const ok = await run(async () => {
      const lesson = await createCurriculumLesson({
        academyId: academy.id,
        classId: staffClassId,
        name: name.trim(),
        wordListId: wordListId || null,
        // video_url 은 옛 컬럼 — 영상은 이제 playlist 안 슬라이드로 들어간다. 새 레슨은 항상 null.
        videoUrl: null,
        level: level.trim() || null,
        playlist,
        teacherId: profile.id,
      });
      setLessons((prev) => [...prev, lesson]);
    }, t('curriculum.createdToast'));
    setSubmitting(false);
    if (ok) resetForm();
  }

  async function handleDelete(lesson: CurriculumLesson) {
    if (!confirm(t('curriculum.deleteConfirm', { name: lesson.name }))) return;
    const ok = await run(() => deleteCurriculumLesson(lesson.id), t('curriculum.deletedToast'));
    if (ok) setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
  }

  /** "발표하기" — 캔바의 "발표하기"처럼 슬라이드쇼 시작과 동시에 풀스크린으로 들어간다.
   * requestFullscreen 은 클릭 이벤트 핸들러 안에서(비동기 대기 없이) 바로 불러야 사용자 제스처로
   * 인정된다 — start() 가 내부에서 navigate 를 하지만 동기 호출이라 문제없다. */
  async function handleStart(lesson: CurriculumLesson) {
    start(lesson);
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // 권한이 없거나(보안 컨텍스트 아님 등) 실패해도 슬라이드쇼 진행 자체는 막지 않는다.
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy mb-1.5">
          {t('curriculum.pageTitle')}
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.pageSubtitle')}</p>
      </div>

      <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          disabled={!staffClassId}
          className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors disabled:opacity-50"
        >
          + {t('curriculum.createButton')}
        </button>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
          <div>
            <label className="mb-1 block font-caption text-caption text-on-surface-variant">{t('curriculum.nameLabel')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('curriculum.namePlaceholder') ?? ''}
              className="w-full max-w-sm rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block font-caption text-caption text-on-surface-variant">
                {t('curriculum.wordListLabel')}
              </label>
              <select
                value={wordListId}
                onChange={(e) => setWordListId(e.target.value)}
                className="w-56 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">{t('curriculum.wordListPlaceholder')}</option>
                {wordLists.map((wl) => (
                  <option key={wl.id} value={wl.id}>
                    {wl.name} ({wl.items.length})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-caption text-caption text-on-surface-variant">{t('curriculum.levelLabel')}</label>
              <input
                type="text"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder={t('curriculum.levelPlaceholder') ?? ''}
                className="w-32 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-caption text-caption text-on-surface-variant">{t('curriculum.videoUrlLabel')}</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={t('curriculum.videoUrlPlaceholder') ?? ''}
                className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {videoUrl.trim() && (
                <button
                  type="button"
                  disabled={extracting}
                  onClick={handleExtractFromVideo}
                  className="whitespace-nowrap rounded-full border-2 border-secondary px-4 py-2 font-label-md text-label-md text-secondary transition-colors hover:bg-secondary-container/40 disabled:opacity-50"
                >
                  {extracting ? t('curriculum.aiExtracting') : `✨ ${t('curriculum.aiExtractButton')}`}
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 font-caption text-caption text-on-surface-variant">{t('curriculum.playlistLabel')}</div>
            {academy?.id && (
              <LessonSlideSorter
                academyId={academy.id}
                slides={playlist}
                onChange={setPlaylist}
                wordListId={wordListId}
                wordLists={wordLists}
                onWordListChange={setWordListId}
              />
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={handleCreate}
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting ? t('curriculum.creating') : t('curriculum.createSubmit')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-2.5 rounded-full border border-outline-variant text-on-surface-variant font-label-md text-label-md transition-colors hover:bg-surface-container-low"
            >
              {t('curriculum.cancel')}
            </button>
          </div>
        </div>
      )}

      {!loading && lessons.length === 0 && (
        <div className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.noLessons')}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {lessons.map((lesson) => {
          const wl = wordLists.find((w) => w.id === lesson.word_list_id);
          return (
            <div
              key={lesson.id}
              className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-title-md text-title-md text-on-surface">{lesson.name}</h3>
                  {lesson.level && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-caption text-caption">
                      {lesson.level}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => handleDelete(lesson)} className="text-on-surface-variant hover:text-error">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>

              {wl && (
                <div className="font-body-sm text-body-sm text-on-surface-variant">
                  {t('curriculum.wordListLabel')}: {wl.name} ({wl.items.length})
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {effectiveSlides(lesson).map((slide) => {
                  const icon =
                    slide.kind === 'image' ? 'image' : slide.kind === 'video' ? 'smart_display' : (GAME_CATALOG.find((g) => g.type === slide.gameType)?.icon ?? 'sports_esports');
                  return (
                    <span key={slide.id} className="material-symbols-outlined text-[18px] text-on-surface-variant" title={slide.kind}>
                      {icon}
                    </span>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => void handleStart(lesson)}
                className="w-full px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
              >
                ▶ {t('curriculum.startButton')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
