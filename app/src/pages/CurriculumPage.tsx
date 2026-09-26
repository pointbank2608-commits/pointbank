import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ClassChipRow from '../components/ClassChipRow';
import LessonSlideSorter from '../components/LessonSlideSorter';
import { useAuth } from '../context/AuthContext';
import { useLessonRunner } from '../context/LessonRunnerContext';
import { useToast } from '../context/ToastContext';
import {
  createCurriculumLesson,
  createGameTemplate,
  createWordList,
  deleteCurriculumLesson,
  fetchCurriculumLessons,
  fetchWordLists,
  generateWordListFromVideo,
  updateCurriculumLesson,
} from '../lib/api';
import { useClasses } from '../lib/useClasses';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { buildGameContent, lessonGameTemplateName, wordListToCards } from '../lib/gameFromWords';
import { effectiveSlides } from '../lib/lessonSlides';
import { MATERIALS_CATALOG, WORKSHEET_TAB_CATALOG } from '../lib/materialsCatalog';
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
  /** null 이면 새로 만드는 중, 값이 있으면 그 레슨을 수정하는 중(2026-09-24 수정 기능 추가). */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [wordListId, setWordListId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [level, setLevel] = useState('');
  // 편집 중인 레슨의 반(없으면 지금 보고 있는 반) — 게임 내용(템플릿)을 이 반 것으로 고르고 만든다.
  const formClassId = (editingId ? lessons.find((l) => l.id === editingId)?.class_id : null) ?? staffClassId ?? null;
  const [playlist, setPlaylist] = useState<LessonSlide[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  // 편집을 연 순간의 내용 — 취소할 때 바뀐 게 있으면 한 번 묻는다.
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [reopenSlideId, setReopenSlideId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const formSnapshot = JSON.stringify({ name, wordListId, level, playlist });
  const dirty = showForm && formSnapshot !== savedSnapshot;

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
    setReopenSlideId(null);
    setEditingId(null);
    setName('');
    setWordListId('');
    setVideoUrl('');
    setLevel('');
    setPlaylist([]);
    setShowForm(false);
  }

  function openCreateForm() {
    resetForm();
    setSavedSnapshot(JSON.stringify({ name: '', wordListId: '', level: '', playlist: [] }));
    setShowForm(true);
  }

  function handleCancel() {
    if (dirty && !confirm(t('curriculum.discardConfirm'))) return;
    resetForm();
  }

  /** 레슨 카드의 "편집"을 누르면 그 레슨 내용을 폼에 채워서 연다. 영상은 예전엔 별도
   * 컬럼(video_url)이었을 수 있어 effectiveSlides()로 슬라이드 형태로 통일해서 불러온다. */
  function openEditForm(lesson: CurriculumLesson) {
    setEditingId(lesson.id);
    setName(lesson.name);
    setWordListId(lesson.word_list_id ?? '');
    setVideoUrl('');
    setLevel(lesson.level ?? '');
    setPlaylist(effectiveSlides(lesson));
    setSavedSnapshot(
      JSON.stringify({ name: lesson.name, wordListId: lesson.word_list_id ?? '', level: lesson.level ?? '', playlist: effectiveSlides(lesson) }),
    );
    setShowForm(true);
  }

  // "이 슬라이드부터 발표"로 시작한 수업을 마치면 편집 화면으로 돌아온다 — 마지막으로 보던 슬라이드를
  // 고른 채로 다시 연다(LessonRunnerContext.exit 가 state 로 넘겨줌).
  const reopenHandled = useRef<string | null>(null);
  useEffect(() => {
    const st = location.state as { reopenLessonId?: string; reopenSlideId?: string } | null;
    if (!st?.reopenLessonId || loading || reopenHandled.current === location.key) return;
    const lesson = lessons.find((l) => l.id === st.reopenLessonId);
    if (!lesson) return;
    reopenHandled.current = location.key;
    openEditForm(lesson);
    setReopenSlideId(st.reopenSlideId ?? null);
    navigate('/curriculum', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, loading, lessons]);

  /** 게임 슬라이드 중 아직 내용(템플릿)을 안 고른 것은 수업 단어장으로 게임 템플릿을 만들어 붙인다 —
   * "준비는 편집 화면에서 끝내고 발표 중엔 고르지 않는다"(2026-09-25). 저장할 때만 만들어서 편집을
   * 취소하면 아무것도 안 생긴다. 단어장으로 만들 수 없는 게임은 그대로 둔다(발표 땐 반의 첫 게임). */
  async function attachGameContent(slides: LessonSlide[]): Promise<LessonSlide[]> {
    if (!academy?.id || !profile) return slides;
    const wordList = wordLists.find((wl) => wl.id === wordListId) ?? null;
    const cards = wordListToCards(wordList);
    const out: LessonSlide[] = [];
    for (const slide of slides) {
      if (slide.kind !== 'game' || slide.templateId) {
        out.push(slide);
        continue;
      }
      const content = buildGameContent(slide.gameType, cards);
      if (!content) {
        out.push(slide);
        continue;
      }
      const tpl = await createGameTemplate({
        academyId: academy.id,
        classId: formClassId,
        gameType: slide.gameType,
        name: lessonGameTemplateName(name.trim(), wordList?.name),
        items: content.items,
        config: content.config,
        teacherId: profile.id,
      });
      out.push({ ...slide, templateId: tpl.id });
    }
    return out;
  }

  /** 저장만 하고 폼은 그대로 둔다 — 저장된 레슨을 돌려준다(실패하면 null). */
  async function saveLesson(): Promise<CurriculumLesson | null> {
    if (!academy?.id || !profile || !staffClassId) return null;
    if (!name.trim()) {
      notify(t('curriculum.nameRequiredError'), 'error');
      return null;
    }
    setSubmitting(true);
    let saved: CurriculumLesson | null = null;
    const ok = await run(async () => {
      const finalPlaylist = await attachGameContent(playlist);
      setPlaylist(finalPlaylist);
      if (editingId) {
        const patch = {
          name: name.trim(),
          word_list_id: wordListId || null,
          level: level.trim() || null,
          playlist: finalPlaylist,
        };
        await updateCurriculumLesson(editingId, patch);
        const base = lessons.find((l) => l.id === editingId);
        if (base) saved = { ...base, ...patch, updated_at: new Date().toISOString() };
        setLessons((prev) =>
          prev.map((l) => (l.id === editingId ? { ...l, ...patch, updated_at: new Date().toISOString() } : l)),
        );
      } else {
        const lesson = await createCurriculumLesson({
          academyId: academy.id,
          classId: staffClassId,
          name: name.trim(),
          wordListId: wordListId || null,
          // video_url 은 옛 컬럼 — 영상은 이제 playlist 안 슬라이드로 들어간다. 새 레슨은 항상 null.
          videoUrl: null,
          level: level.trim() || null,
          playlist: finalPlaylist,
          teacherId: profile.id,
        });
        setLessons((prev) => [...prev, lesson]);
        setEditingId(lesson.id);
        saved = lesson;
      }
      setSavedSnapshot(JSON.stringify({ name, wordListId, level, playlist: finalPlaylist }));
    }, editingId ? t('curriculum.updatedToast') : t('curriculum.createdToast'));
    setSubmitting(false);
    return ok ? saved : null;
  }

  async function handleSave() {
    const saved = await saveLesson();
    if (saved) resetForm();
  }

  /** 편집 화면의 "이 슬라이드부터 발표" — 저장하고 그 슬라이드부터 수업을 시작한다. 수업을 마치면
   * 편집 화면으로 돌아온다. */
  async function handlePresentFrom(slideId: string) {
    const saved = await saveLesson();
    if (!saved) return;
    const wordList = wordLists.find((wl) => wl.id === saved.word_list_id) ?? null;
    start(saved, wordList, saved.class_id ?? staffClassId ?? null, { startSlideId: slideId, returnToEdit: true });
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // 저장을 기다린 뒤라 브라우저가 전체화면을 막을 수 있다 — 진행바의 전체화면 버튼으로 켜면 된다.
    }
  }

  async function handleDelete(lesson: CurriculumLesson) {
    if (!confirm(t('curriculum.deleteConfirm', { name: lesson.name }))) return;
    const ok = await run(() => deleteCurriculumLesson(lesson.id), t('curriculum.deletedToast'));
    if (ok) setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
  }

  /** "발표하기" — 캔바의 "발표하기"처럼 슬라이드쇼 시작과 동시에 풀스크린으로 들어간다.
   * requestFullscreen 은 클릭 이벤트 핸들러 안에서(비동기 대기 없이) 바로 불러야 사용자 제스처로
   * 인정된다 — start() 가 내부에서 navigate 를 하지만 동기 호출이라 문제없다. */
  async function handleStart(lesson: CurriculumLesson, startSlideId?: string) {
    const wordList = wordLists.find((wl) => wl.id === lesson.word_list_id) ?? null;
    start(lesson, wordList, lesson.class_id ?? staffClassId ?? null, startSlideId ? { startSlideId } : undefined);
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
          onClick={openCreateForm}
          disabled={!staffClassId}
          className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors disabled:opacity-50"
        >
          + {t('curriculum.createButton')}
        </button>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
          <h3 className="font-title-md text-title-md text-on-surface">
            {t(editingId ? 'curriculum.editFormTitle' : 'curriculum.createFormTitle')}
          </h3>
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
                classId={formClassId}
                lessonName={name}
                slides={playlist}
                onChange={setPlaylist}
                wordListId={wordListId}
                wordLists={wordLists}
                onWordListChange={setWordListId}
                initialSelectedId={reopenSlideId}
                onPresentFrom={(id) => void handlePresentFrom(id)}
              />
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSave}
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting
                ? t(editingId ? 'curriculum.saving' : 'curriculum.creating')
                : t(editingId ? 'curriculum.saveSubmit' : 'curriculum.createSubmit')}
            </button>
            <button
              type="button"
              onClick={handleCancel}
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
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => openEditForm(lesson)}
                    className="text-on-surface-variant hover:text-primary"
                    aria-label={t('curriculum.editButton') ?? ''}
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  <button type="button" onClick={() => handleDelete(lesson)} className="text-on-surface-variant hover:text-error">
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              </div>

              {wl && (
                <div className="font-body-sm text-body-sm text-on-surface-variant">
                  {t('curriculum.wordListLabel')}: {wl.name} ({wl.items.length})
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {effectiveSlides(lesson).map((slide, i) => {
                  let icon = 'help';
                  if (slide.kind === 'image') icon = 'image';
                  else if (slide.kind === 'canvas') icon = 'dashboard_customize';
                  else if (slide.kind === 'study') icon = 'style';
                  else if (slide.kind === 'grammar') icon = 'rule';
                  else if (slide.kind === 'reading') icon = slide.mode === 'cloze' ? 'hearing' : 'lyrics';
                  else if (slide.kind === 'video') icon = 'smart_display';
                  else if (slide.kind === 'web') icon = slide.mode === 'window' ? 'menu_book' : 'language';
                  else if (slide.kind === 'game') icon = GAME_CATALOG.find((g) => g.type === slide.gameType)?.icon ?? 'sports_esports';
                  else if (slide.materialId === 'worksheet' && slide.worksheetTab)
                    icon = WORKSHEET_TAB_CATALOG.find((wt) => wt.tab === slide.worksheetTab)?.icon ?? 'description';
                  else icon = MATERIALS_CATALOG.find((m) => m.id === slide.materialId)?.icon ?? 'print';
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => void handleStart(lesson, slide.id)}
                      title={t('curriculum.startFromSlide', { n: i + 1 })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-primary-fixed hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-[18px]">{icon}</span>
                    </button>
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
