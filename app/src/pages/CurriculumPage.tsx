import { useEffect, useRef, useState } from 'react';
import LessonWordListModal from '../components/LessonWordListModal';
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
import { copyLessonToClass } from '../lib/copyLesson';
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
  // 수업 화면 안에서 단어장 만들기·고치기(LessonWordListModal). listId 가 있으면 그 단어장 편집.
  const [wordListModal, setWordListModal] = useState<{ listId: string | null } | null>(null);
  function openWordListModal(mode: 'new' | 'edit') {
    setWordListModal({ listId: mode === 'edit' && wordListId ? wordListId : null });
  }
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

  /* ---------- 자동 임시저장(초안, 2026-09-26) ----------
   * 뒤로가기·다른 메뉴·새로고침·탭 닫기로 편집 화면을 떠나도 만들던 내용이 날아가지 않게, 바뀔 때마다
   * 이 브라우저에 초안을 저장한다(학원당 하나). 다시 들어오면 "이어서 만들기 / 버리기"를 묻는다.
   * 서버에는 선생님이 "저장"을 눌렀을 때만 반영한다(새 수업이 저절로 생기거나 게임 내용이 자동으로
   * 만들어지지 않게). 저장하면 초안은 지운다. */
  const draftKey = academy?.id ? `classbank.lessonDraft.${academy.id}` : null;
  interface LessonDraft {
    editingId: string | null;
    classId: string | null;
    name: string;
    wordListId: string;
    level: string;
    videoUrl: string;
    playlist: LessonSlide[];
    savedAt: number;
  }
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [pendingRestore, setPendingRestore] = useState<LessonDraft | null>(null);

  function readDraft(): LessonDraft | null {
    if (!draftKey) return null;
    try {
      const raw = localStorage.getItem(draftKey);
      return raw ? (JSON.parse(raw) as LessonDraft) : null;
    } catch {
      return null;
    }
  }
  function clearDraft() {
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* 저장소를 못 쓰면 초안 기능만 빠진다 */
    }
    setDraft(null);
  }

  // 바뀐 내용을 잠깐 모았다가 저장(타자 칠 때마다 쓰지 않게). 바뀐 게 없으면(방금 저장함) 초안을 지운다.
  useEffect(() => {
    if (!draftKey || !showForm) return;
    if (!dirty) {
      // 방금 저장했거나 바꾼 게 없음 — 단, 지금 여는 수업의 초안일 때만 지운다(다른 수업 초안은 남긴다).
      const current = readDraft();
      if (current && (current.editingId ?? null) === (editingId ?? null)) clearDraft();
      return;
    }
    const timer = window.setTimeout(() => {
      const data: LessonDraft = { editingId, classId: formClassId, name, wordListId, level, videoUrl, playlist, savedAt: Date.now() };
      try {
        localStorage.setItem(draftKey, JSON.stringify(data));
      } catch {
        /* 용량 초과 등 — 초안만 못 남긴다 */
      }
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, showForm, dirty, name, wordListId, level, videoUrl, playlist, editingId]);

  // 편집 화면이 닫혀 있을 때 남은 초안이 있으면 알려 준다.
  useEffect(() => {
    if (showForm || loading) return;
    setDraft(readDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, loading, draftKey]);

  // 저장하지 않고 탭을 닫거나 새로고침하려 하면 브라우저가 한 번 묻는다.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function applyDraft(d: LessonDraft) {
    const lesson = d.editingId ? lessons.find((l) => l.id === d.editingId) : null;
    if (lesson) openEditForm(lesson);
    else {
      resetForm();
      setSavedSnapshot(JSON.stringify({ name: '', wordListId: '', level: '', playlist: [] }));
      setShowForm(true);
    }
    setName(d.name);
    setWordListId(d.wordListId);
    setLevel(d.level);
    setVideoUrl(d.videoUrl);
    setPlaylist(d.playlist);
    setDraft(null);
  }

  function continueDraft() {
    if (!draft) return;
    // 다른 반에서 만들던 초안이면 그 반으로 옮긴 뒤(목록을 다시 불러온 뒤) 연다.
    if (draft.classId && draft.classId !== staffClassId) {
      setPendingRestore(draft);
      selectClass(draft.classId);
      return;
    }
    applyDraft(draft);
  }

  useEffect(() => {
    if (!pendingRestore || loading || pendingRestore.classId !== staffClassId) return;
    applyDraft(pendingRestore);
    setPendingRestore(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRestore, loading, staffClassId, lessons]);

  function discardDraft() {
    if (!confirm(t('curriculum.draft.discardConfirm'))) return;
    clearDraft();
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
    if (dirty && !confirm(t('curriculum.discardConfirm'))) return;
    resetForm();
    setSavedSnapshot(JSON.stringify({ name: '', wordListId: '', level: '', playlist: [] }));
    setShowForm(true);
  }

  function handleCancel() {
    if (dirty && !confirm(t('curriculum.discardConfirm'))) return;
    clearDraft();
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
      clearDraft(); // 서버에 저장했으니 임시저장 초안은 필요 없다
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

  // "다른 반으로 복사" — 고른 반마다 수업을 복사한다(A반 전용 게임 내용·단어장도 같이 복사, lib/copyLesson.ts).
  const [copyLesson, setCopyLesson] = useState<CurriculumLesson | null>(null);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);

  async function handleCopy() {
    if (!copyLesson || !academy?.id || !profile || copyTargets.length === 0) return;
    setCopying(true);
    const ok = await run(async () => {
      for (const classId of copyTargets) {
        await copyLessonToClass({ lesson: copyLesson, targetClassId: classId, academyId: academy.id, teacherId: profile.id, wordLists });
      }
    }, t('curriculum.copy.done', { count: copyTargets.length }));
    setCopying(false);
    if (ok) {
      setCopyLesson(null);
      setCopyTargets([]);
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

      {!showForm && draft && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-warm-yellow bg-warm-yellow/20 px-4 py-3">
          <span className="material-symbols-outlined text-[22px] text-deep-navy">edit_note</span>
          <div className="min-w-0 flex-1">
            <div className="font-label-md text-label-md text-deep-navy">
              {t('curriculum.draft.title', { name: draft.name.trim() || t('curriculum.draft.untitled') })}
            </div>
            <div className="font-caption text-caption text-on-surface-variant">
              {t('curriculum.draft.desc', {
                when: new Date(draft.savedAt).toLocaleString(),
                cls: classes.find((c) => c.id === draft.classId)?.name ?? '',
                count: draft.playlist.length,
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={continueDraft}
            className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container"
          >
            <span className="material-symbols-outlined text-[18px]">restore</span>
            {t('curriculum.draft.continue')}
          </button>
          <button
            type="button"
            onClick={discardDraft}
            className="rounded-full border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low"
          >
            {t('curriculum.draft.discard')}
          </button>
        </div>
      )}

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
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => openWordListModal('new')}
                  className="flex items-center gap-1 rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary-fixed"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  {t('curriculum.wordListTools.newButton')}
                </button>
                <button
                  type="button"
                  disabled={!wordListId}
                  onClick={() => openWordListModal('edit')}
                  className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  {t('curriculum.wordListTools.editButton')}
                </button>
              </div>
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
                onManageWordList={openWordListModal}
                initialSelectedId={reopenSlideId}
                onPresentFrom={(id) => void handlePresentFrom(id)}
              />
            )}
            {wordListModal && academy?.id && profile && (
              <LessonWordListModal
                academyId={academy.id}
                classId={formClassId ?? staffClassId}
                teacherId={profile.id}
                list={wordLists.find((wl) => wl.id === wordListModal.listId) ?? null}
                defaultName={t('curriculum.wordListTools.defaultName', { name: name.trim() || t('curriculum.wordListTools.untitled') })}
                onClose={() => setWordListModal(null)}
                onCreated={(list) => {
                  setWordLists((prev) => [...prev, list]);
                  setWordListId(list.id);
                  setWordListModal({ listId: list.id });
                }}
                onItemsChange={(listId, items) =>
                  setWordLists((prev) => prev.map((wl) => (wl.id === listId ? { ...wl, items } : wl)))
                }
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

      {copyLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !copying && setCopyLesson(null)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface-container-lowest p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="font-title-md text-title-md font-bold text-on-surface">{t('curriculum.copy.title', { name: copyLesson.name })}</h3>
              <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{t('curriculum.copy.desc')}</p>
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {classes.filter((c) => c.id !== (copyLesson.class_id ?? staffClassId)).map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant/60 px-3 py-2.5 hover:border-primary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={copyTargets.includes(c.id)}
                    onChange={(e) => setCopyTargets((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))}
                  />
                  <span className="font-label-md text-label-md text-on-surface">{c.name}</span>
                </label>
              ))}
              {classes.length <= 1 && <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.copy.noOtherClass')}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={copying}
                onClick={() => setCopyLesson(null)}
                className="rounded-full border border-outline-variant px-5 py-2.5 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low"
              >
                {t('curriculum.cancel')}
              </button>
              <button
                type="button"
                disabled={copying || copyTargets.length === 0}
                onClick={() => void handleCopy()}
                className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                {copying ? t('curriculum.copy.copying') : t('curriculum.copy.confirm', { count: copyTargets.length })}
              </button>
            </div>
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
                  <button
                    type="button"
                    onClick={() => setCopyLesson(lesson)}
                    className="text-on-surface-variant hover:text-primary"
                    aria-label={t('curriculum.copy.button')}
                    title={t('curriculum.copy.button')}
                  >
                    <span className="material-symbols-outlined text-[20px]">content_copy</span>
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
                  else if (slide.kind === 'wordshow') icon = 'menu_book';
                  else if (slide.kind === 'attendance') icon = 'how_to_reg';
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
