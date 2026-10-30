import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchCurriculumLessons, fetchStudentsOfClass, fetchWordLists } from '../../../lib/api';
import { wordListToCards } from '../../../lib/gameFromWords';
import { createHomework, fetchAdFlags, setAdFlag, teacherErrorKey } from '../../../lib/homework';
import { fetchClassWrongCards, useBuildLabels } from '../../../lib/homework/teacherHelpers';
import { buildItems, buildKidsItems, buildWatchItems, countQuestions, EMPTY_PLAN, estimateMinutes, presetPlan, type ClipSource, type HwDuration } from '../../../lib/homework/build';
import type { HwPlan, HwItemDraft } from '../../../lib/homework/types';
import type { CurriculumLesson, FullCardItem, Student, WordList } from '../../../lib/types';
import type { VideoClip } from '../../../lib/videoClips';
import { parseShadowText } from '../../../lib/shadowLines';
import { extractYoutubeId } from '../../../lib/youtube';
import { enrichCards, loadWordBank } from '../../../lib/wordBankCache';
import VideoClipLibrary from '../../VideoClipLibrary';
import { MAX_MEMORY_COUNT, MEMORY_METHODS, MEMORY_METHOD_LIST, memoryItemFromCards, type MemoryMethod } from '../../../lib/homework/memory';
import HomeworkPreview from './HomeworkPreview';

type Source = 'lesson' | 'wordlist' | 'video' | 'wrong' | 'picked' | 'watch';

const STEPS = ['target', 'source', 'time', 'confirm'] as const;

/**
 * 숙제 만들기 4단계(2026-10-05): ① 누구에게 ② 무엇으로(최근 수업·단어장·영상·지난 오답) ③ 몇 분(5·10·15, 직접 설정은 접어 둠)
 * ④ 학생 화면 그대로 미리보기 → 만들기. 40~50대 선생님도 한 화면에 하나만 결정하게.
 */
export default function HomeworkWizard({
  academyId,
  classId,
  className,
  initialStudentIds,
  initialCards,
  initialTitle,
  initialLessonId,
  pickedCards,
  onCancel,
  onCreated,
  onEdit,
}: {
  academyId: string;
  classId: string;
  className: string;
  /** 결과 화면에서 "이 학생 오답으로" 등으로 열 때 */
  initialStudentIds?: string[];
  initialCards?: FullCardItem[];
  initialTitle?: string;
  /** 내 수업 카드의 "숙제 내기"에서 넘어올 때: 이 수업의 단어장으로 미리 채운다 */
  initialLessonId?: string;
  /** 단어 사전·파닉스에서 고른 낱말로 바로 숙제를 낼 때 */
  pickedCards?: FullCardItem[];
  onCancel: () => void;
  onCreated: (hw: { id: string; code: string }) => void;
  onEdit?: (items: HwItemDraft[], title: string, studentIds: string[] | null, due: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const l = (ko: string, e: string) => (en ? e : ko);
  const labels = useBuildLabels();
  const [step, setStep] = useState(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [everyone, setEveryone] = useState(!initialStudentIds?.length);
  const [picked, setPicked] = useState<Set<string>>(new Set(initialStudentIds ?? []));
  const [title, setTitle] = useState(initialTitle ?? '');
  const [due, setDue] = useState('');

  const [source, setSource] = useState<Source>(pickedCards?.length ? 'picked' : initialCards?.length ? 'wrong' : 'lesson');
  const [lessons, setLessons] = useState<CurriculumLesson[]>([]);
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [wrongCards, setWrongCards] = useState<FullCardItem[] | null>(initialCards ?? null);
  const [lessonId, setLessonId] = useState('');
  const [wordListId, setWordListId] = useState('');
  const [clip, setClip] = useState<VideoClip | null>(null);
  // 내 유튜브 링크 + 대사표(선생님이 붙여 넣은 글 — 이 숙제 안에만 저장된다)
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customScript, setCustomScript] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  // 유치원 영상 보기: 유튜브 링크 3~6개
  const [watchRows, setWatchRows] = useState<{ url: string; title: string }[]>([
    { url: '', title: '' },
    { url: '', title: '' },
    { url: '', title: '' },
  ]);
  const watchVideos = useMemo(
    () => watchRows.flatMap((r) => {
      const id = extractYoutubeId(r.url);
      return id ? [{ id, title: r.title }] : [];
    }),
    [watchRows],
  );
  // 한 영상을 몇 번 끝까지 보게 할지(093 서버가 시청 기록으로 센다)
  const [watchViews, setWatchViews] = useState(1);
  // "광고가 나와요"로 표시해 둔 영상(학원 단위로 기억, 093 전에는 빈 목록)
  const [adFlags, setAdFlags] = useState<Set<string>>(new Set());
  const watchIdsKey = watchVideos.map((v) => v.id).join(',');
  useEffect(() => {
    let alive = true;
    void fetchAdFlags(watchVideos.map((v) => v.id)).then((s) => alive && setAdFlags(s));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchIdsKey]);
  function toggleAd(videoId: string) {
    const next = !adFlags.has(videoId);
    setAdFlags((s) => {
      const n = new Set(s);
      if (next) n.add(videoId);
      else n.delete(videoId);
      return n;
    });
    void setAdFlag(academyId, videoId, next).catch(() => {
      setAdFlags((s) => {
        const n = new Set(s);
        if (next) n.delete(videoId);
        else n.add(videoId);
        return n;
      });
    });
  }
  const [cards, setCards] = useState<FullCardItem[]>(initialCards ?? pickedCards ?? []);
  const [sourceName, setSourceName] = useState(initialTitle ?? '');
  const [missingLessonWords, setMissingLessonWords] = useState(false);

  const [minutes, setMinutes] = useState<HwDuration | null>(10);
  // 유치원 친구용: 큰 버튼·목소리 안내·도장, 문장을 듣고 따라 읽기만 한다
  const [kids, setKids] = useState(false);
  /** 암기 방식으로 구성: 시간(5·10·15분) 대신 방식과 문항 수를 고른다 */
  const [memMode, setMemMode] = useState(false);
  const [memMethods, setMemMethods] = useState<MemoryMethod[]>(['meaning', 'listen', 'fade', 'spell']);
  const [memCount, setMemCount] = useState(10);
  const [kidsLines, setKidsLines] = useState(5);
  const [custom, setCustom] = useState(false);
  const [plan, setPlan] = useState<HwPlan>(EMPTY_PLAN);
  const [seed, setSeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const createLock = useRef(false);
  const createRequest = useRef({ key: '', id: crypto.randomUUID() });

  useEffect(() => {
    void fetchStudentsOfClass(classId).then(setStudents).catch(() => setStudents([]));
    void Promise.all([fetchCurriculumLessons(academyId, classId).catch(() => []), fetchWordLists(academyId, classId).catch(() => [])]).then(([ls, wl]) => {
      const withWords = ls.filter((l) => l.word_list_id);
      const recent = withWords.slice(0, 8);
      // 수업 카드에서 넘어온 수업은 8개 밖이어도 목록에 넣고 미리 고른다
      const target = initialLessonId ? withWords.find((l) => l.id === initialLessonId) : undefined;
      setLessons(target && !recent.some((l) => l.id === target.id) ? [target, ...recent] : recent);
      setWordLists(wl);
      if (initialLessonId) {
        const l = ls.find((x) => x.id === initialLessonId);
        const list = l ? wl.find((w) => w.id === l.word_list_id) : undefined;
        if (l && list) {
          setSource('lesson');
          setLessonId(l.id);
          setTitle((cur) => cur || l.name);
          void applyWordList(list, l.name);
        } else {
          setMissingLessonWords(true);
        }
      }
    });
  }, [academyId, classId]);

  useEffect(() => {
    if (source === 'wrong' && wrongCards === null) void fetchClassWrongCards(classId).then(setWrongCards).catch(() => setWrongCards([]));
  }, [source, wrongCards, classId]);

  async function applyWordList(wl: WordList | undefined, name: string) {
    if (!wl) return;
    const bank = await loadWordBank().catch(() => []);
    setCards(enrichCards(wordListToCards(wl), bank));
    setSourceName(name);
    setClip(null);
  }

  const clipSource: ClipSource | null = clip ? { id: clip.id, youtube_id: clip.youtube_id, title: clip.title, script: clip.script, pack: clip.pack } : null;

  // 영상: 장면 핵심 낱말을 카드로(퀴즈·매치업 재료)
  function pickClip(c: VideoClip) {
    setClip(c);
    setSourceName(c.title);
    setCards(
      (c.pack?.words ?? []).map((w, i) => ({ id: `clip-${i}`, word: w.word, meaning: w.meaning, imageUrl: null, example: w.example, exampleKo: w.exampleKo ?? null })),
    );
  }

  function applyCustomVideo() {
    const id = extractYoutubeId(customUrl);
    if (!id) {
      setCustomError(t('studentHw.customVideoBadUrl'));
      return;
    }
    // 시간이 적힌 줄이 있어야 문장마다 그 구간을 틀 수 있다(유튜브 "스크립트 표시"·SRT 를 붙여 넣으면 시간이 같이 온다)
    const lines = parseShadowText(customScript).filter((l) => l.en.trim().split(/\s+/).length >= 2 && l.end > l.start);
    if (lines.length < 2) {
      setCustomError(t('studentHw.customVideoBadScript'));
      return;
    }
    setCustomError(null);
    const name = customTitle.trim() || t('studentHw.customVideoDefaultName');
    // id 를 비워 두면 숙제에 "라이브러리 장면" 표시가 안 붙는다(관리자가 내려도 영향 없음)
    setClip({
      id: '',
      series: '',
      title: name,
      summary: '',
      youtube_id: id,
      channel: '',
      start_sec: 0,
      end_sec: 0,
      level: 1,
      tags: [],
      script: customScript,
      words: [],
      pack: {} as VideoClip['pack'],
      sort_order: 0,
      hidden: false,
      hidden_reason: null,
      hidden_at: null,
      created_at: '',
    });
    setSourceName(name);
    setCards([]);
  }

  useEffect(() => {
    if (minutes && !custom) setPlan(presetPlan(minutes, cards, !!clip));
  }, [minutes, custom, cards, clip]);

  const items = useMemo(() => {
    if (source === 'watch') return buildWatchItems(watchVideos, t('studentHw.watchItemLabel'), watchViews);
    let s = seed * 9301 + 49297;
    const rng = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    if (memMode) return MEMORY_METHOD_LIST.filter((m) => memMethods.includes(m)).map((m) => memoryItemFromCards(cards, m, memCount, en, rng)).filter((x): x is HwItemDraft => !!x);
    if (kids) return buildKidsItems(cards, kidsLines, labels.shadowing, clipSource, rng);
    return buildItems(cards, plan, labels, clipSource, rng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, plan, labels, clip, seed, kids, kidsLines, source, watchVideos, watchViews, memMode, memMethods, memCount, en]);

  const targetIds = everyone ? students.map((s) => s.id) : [...picked];
  const sourceOk = source === 'watch' ? watchVideos.length >= 1 : cards.length >= 2 || !!clip;
  const canNext = [targetIds.length > 0, sourceOk, items.length > 0, items.length > 0][step];
  const finalTitle = title.trim() || sourceName || t('studentHw.defaultTitle');

  async function create() {
    if (createLock.current) return;
    createLock.current = true;
    setBusy(true);
    setErr(null);
    try {
      const key = JSON.stringify([classId, finalTitle, items, everyone, targetIds, due]);
      if (createRequest.current.key !== key) createRequest.current = { key, id: crypto.randomUUID() };
      const hw = await createHomework({
        requestId: createRequest.current.id,
        classId,
        title: finalTitle,
        items,
        studentIds: everyone ? null : targetIds,
        dueAt: due ? new Date(due).toISOString() : null,
        kind: everyone ? 'class' : 'selected',
      });
      onCreated(hw);
    } catch (e) {
      setErr(t(teacherErrorKey(e)));
    } finally {
      createLock.current = false;
      setBusy(false);
    }
  }

  const big = 'flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-left font-body-md text-body-md';
  const on = (v: boolean) => (v ? 'border-primary bg-primary/10 text-deep-navy' : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary/50');
  const input = 'min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-base outline-none focus:border-primary';

  return (
    <section className="space-y-5 rounded-2xl border-2 border-primary/30 bg-surface-container-lowest p-4 shadow-sm sm:p-6" aria-labelledby="hw-wizard-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="hw-wizard-title" className="font-title-md text-title-md text-deep-navy">
          {t('studentHw.newTitle')} · {className}
        </h2>
        <button type="button" onClick={onCancel} className="flex min-h-11 items-center gap-1 rounded-full px-3 text-on-surface-variant hover:bg-surface-container-low">
          <span className="material-symbols-outlined">close</span>
          {t('common.cancel')}
        </button>
      </div>

      {/* 단계 표시 */}
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className={`flex min-h-12 w-full flex-col items-center justify-center rounded-xl px-1 text-center text-sm font-bold sm:flex-row sm:gap-1.5 sm:text-base ${
                i === step ? 'bg-primary text-on-primary' : i < step ? 'bg-primary/15 text-deep-navy' : 'bg-surface-container-low text-on-surface-variant'
              }`}
            >
              <span>{i < step ? '✓' : i + 1}</span>
              <span>{s === 'time' && memMode ? l('방식', 'Method') : t(`studentHw.step_${s}`)}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className={big + ' ' + on(everyone)} onClick={() => setEveryone(true)} aria-pressed={everyone}>
              <span className="material-symbols-outlined">groups</span>
              {t('studentHw.targetAll', { count: students.length })}
            </button>
            <button type="button" className={big + ' ' + on(!everyone)} onClick={() => setEveryone(false)} aria-pressed={!everyone}>
              <span className="material-symbols-outlined">person_check</span>
              {t('studentHw.targetSome')}
            </button>
          </div>
          {!everyone && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {students.map((s) => {
                const sel = picked.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={sel}
                    onClick={() =>
                      setPicked((p) => {
                        const n = new Set(p);
                        if (sel) n.delete(s.id);
                        else n.add(s.id);
                        return n;
                      })
                    }
                    className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 text-base ${on(sel)}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{sel ? 'check_box' : 'check_box_outline_blank'}</span>
                    <span className="truncate">{s.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          {students.length === 0 && <p className="text-base text-on-surface-variant">{t('studentHw.noStudentsTeacher')}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="font-label-md text-label-md text-on-surface-variant">{t('studentHw.titleLabel')}</span>
              <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('studentHw.titlePlaceholder')} />
            </label>
            <label className="space-y-1">
              <span className="font-label-md text-label-md text-on-surface-variant">{t('studentHw.dueLabel')}</span>
              <input className={input} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className={`grid grid-cols-2 gap-2 ${pickedCards?.length ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
            {((pickedCards?.length ? ['picked', 'lesson', 'wordlist', 'video', 'wrong', 'watch'] : ['lesson', 'wordlist', 'video', 'wrong', 'watch']) as Source[]).map((s) => (
              <button key={s} type="button" className={`${big} flex-col text-center ${on(source === s)}`} onClick={() => { setSource(s); if (s === 'watch') setSourceName(t('studentHw.watchDefaultName')); }} aria-pressed={source === s}>
                <span className="material-symbols-outlined">{{ lesson: 'co_present', wordlist: 'menu_book', video: 'movie', wrong: 'replay', picked: 'checklist', watch: 'smart_display' }[s]}</span>
                {t(`studentHw.src_${s}`)}
              </button>
            ))}
          </div>

          {source === 'lesson' && missingLessonWords && <p className="rounded-lg bg-warm-yellow/25 px-3 py-2 text-base text-on-surface">{t('studentHw.lessonNoWords')}</p>}
          {source === 'lesson' &&
            (lessons.length === 0 ? (
              <p className="text-base text-on-surface-variant">{t('studentHw.noLessons')}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {lessons.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`${big} justify-start ${on(lessonId === l.id)}`}
                    onClick={() => {
                      setLessonId(l.id);
                      void applyWordList(
                        wordLists.find((w) => w.id === l.word_list_id),
                        l.name,
                      );
                    }}
                  >
                    <span className="material-symbols-outlined">co_present</span>
                    <span className="min-w-0 flex-1 truncate">{l.name}</span>
                    <span className="text-sm text-on-surface-variant">{new Date(l.updated_at).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
                  </button>
                ))}
              </div>
            ))}

          {source === 'wordlist' &&
            (wordLists.length === 0 ? (
              <p className="text-base text-on-surface-variant">{t('studentHw.noWordLists')}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {wordLists.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`${big} justify-start ${on(wordListId === w.id)}`}
                    onClick={() => {
                      setWordListId(w.id);
                      void applyWordList(w, w.name);
                    }}
                  >
                    <span className="material-symbols-outlined">menu_book</span>
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    <span className="text-sm text-on-surface-variant">{t('studentHw.wordsN', { count: w.items.length })}</span>
                  </button>
                ))}
              </div>
            ))}

          {source === 'picked' && pickedCards && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {pickedCards.slice(0, 40).map((c) => (
                  <span key={c.id} className="rounded-full bg-primary/10 px-3 py-1 text-base text-deep-navy">
                    {c.word}
                  </span>
                ))}
                {pickedCards.length > 40 && <span className="text-base text-on-surface-variant">+{pickedCards.length - 40}</span>}
              </div>
              <button
                type="button"
                className={`${big} ${on(sourceName === (initialTitle ?? '') && cards === pickedCards)}`}
                onClick={() => {
                  setCards(pickedCards);
                  setSourceName(initialTitle ?? '');
                  setClip(null);
                }}
              >
                <span className="material-symbols-outlined">checklist</span>
                {t('studentHw.usePickedWords', { count: pickedCards.length })}
              </button>
            </div>
          )}

          {source === 'watch' && (
            <div className="space-y-3">
              <p className="rounded-xl bg-primary/10 px-4 py-3 text-base text-deep-navy">{t('studentHw.watchIntro')}</p>
              {watchRows.map((r, i) => {
                const ok = !!extractYoutubeId(r.url);
                return (
                  <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <label className="relative block">
                      <input
                        className={`${input} pr-10`}
                        value={r.url}
                        onChange={(e) => setWatchRows((rows) => rows.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                        placeholder={t('studentHw.watchUrl', { n: i + 1 })}
                      />
                      {r.url.trim() && (
                        <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 ${ok ? 'text-emerald-600' : 'text-error'}`}>{ok ? 'check_circle' : 'error'}</span>
                      )}
                    </label>
                    <input
                      className={input}
                      value={r.title}
                      onChange={(e) => setWatchRows((rows) => rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                      placeholder={t('studentHw.watchTitleOptional')}
                    />
                    {ok && (
                      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                        <button
                          type="button"
                          aria-pressed={adFlags.has(extractYoutubeId(r.url) ?? '')}
                          onClick={() => toggleAd(extractYoutubeId(r.url) ?? '')}
                          className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-bold ${adFlags.has(extractYoutubeId(r.url) ?? '') ? 'border-error bg-error-container/50 text-on-error-container' : 'border-outline-variant text-on-surface-variant'}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">{adFlags.has(extractYoutubeId(r.url) ?? '') ? 'campaign' : 'check'}</span>
                          {adFlags.has(extractYoutubeId(r.url) ?? '') ? t('studentHw.watchAdFlagged') : t('studentHw.watchAdFlag')}
                        </button>
                        {adFlags.has(extractYoutubeId(r.url) ?? '') && <span className="text-sm text-error">{t('studentHw.watchAdFlaggedNote')}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
                <div className="mb-2 font-label-md text-label-md text-on-surface">{t('studentHw.watchViews')}</div>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('studentHw.watchViews')}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={watchViews === n}
                      onClick={() => setWatchViews(n)}
                      className={`min-h-11 min-w-14 rounded-full border px-4 text-base font-bold ${watchViews === n ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant bg-white text-on-surface'}`}
                    >
                      {t('studentHw.watchViewsN', { n })}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-on-surface-variant">{t('studentHw.watchViewsHint')}</p>
              </div>
              {watchRows.length < 6 && (
                <button type="button" onClick={() => setWatchRows((rows) => [...rows, { url: '', title: '' }])} className="flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant px-4 font-label-md text-label-md">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {t('studentHw.watchAdd')}
                </button>
              )}
              <p className="text-sm text-on-surface-variant">{t('studentHw.watchAdNote')}</p>
            </div>
          )}

          {source === 'video' && (
            <div className="space-y-2">
              {clip && (
                <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-base text-deep-navy">
                  <span className="material-symbols-outlined">check_circle</span>
                  {t('studentHw.clipPicked', { title: clip.title })}
                </div>
              )}
              <VideoClipLibrary onPick={pickClip} pickLabel={t('studentHw.pickClip')} />
              <details className="rounded-xl border border-outline-variant" open={!!customUrl || !!customScript}>
                <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-label-md text-label-md text-on-surface">
                  <span className="material-symbols-outlined">add_link</span>
                  {t('studentHw.customVideoTitle')}
                </summary>
                <div className="space-y-2 p-4 pt-0">
                  <p className="text-sm text-on-surface-variant">{t('studentHw.customVideoHint')}</p>
                  <input className={input} value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder={t('studentHw.customVideoUrl')} />
                  <input className={input} value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder={t('studentHw.customVideoName')} />
                  <textarea
                    className={`${input} min-h-36 py-2 font-mono text-sm`}
                    value={customScript}
                    onChange={(e) => setCustomScript(e.target.value)}
                    placeholder={t('studentHw.customVideoScript')}
                    rows={6}
                  />
                  {customError && (
                    <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
                      {customError}
                    </p>
                  )}
                  <p className="text-sm text-on-surface-variant">{t('studentHw.customVideoCopyright')}</p>
                  <button
                    type="button"
                    disabled={!customUrl.trim() || !customScript.trim()}
                    onClick={applyCustomVideo}
                    className="flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined">movie</span>
                    {t('studentHw.customVideoUse')}
                  </button>
                </div>
              </details>
            </div>
          )}

          {source === 'wrong' &&
            (wrongCards === null ? (
              <p className="text-base text-on-surface-variant">{t('common.loading')}</p>
            ) : wrongCards.length < 2 ? (
              <p className="text-base text-on-surface-variant">{t('studentHw.noWrongYet')}</p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {wrongCards.slice(0, 20).map((c) => (
                    <span key={c.id} className="rounded-full bg-error-container/50 px-3 py-1 text-base text-on-error-container">
                      {c.word}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className={`${big} ${on(sourceName === t('studentHw.wrongReviewTitle'))}`}
                  onClick={() => {
                    setCards(wrongCards.slice(0, 20));
                    setSourceName(t('studentHw.wrongReviewTitle'));
                    setClip(null);
                  }}
                >
                  <span className="material-symbols-outlined">replay</span>
                  {t('studentHw.useWrongWords', { count: Math.min(20, wrongCards.length) })}
                </button>
              </div>
            ))}

          {(cards.length > 0 || clip) && (
            <p className="rounded-xl bg-surface-container-low px-3 py-2 text-base text-on-surface">
              {t('studentHw.sourceReady', { name: sourceName, count: cards.length })}
            </p>
          )}
        </div>
      )}

      {step === 2 && source === 'watch' && (
        <div className="space-y-3">
          <p className="rounded-2xl bg-primary/10 px-4 py-4 text-lg font-bold text-deep-navy">{t('studentHw.watchStep3', { count: watchVideos.length })}</p>
          <ItemSummary items={items} />
        </div>
      )}

      {step === 2 && source !== 'watch' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={!memMode} onClick={() => setMemMode(false)} className={`${big} flex-col text-center ${on(!memMode)}`}>
              <span className="material-symbols-outlined">timer</span>
              {l('추천 분량으로 구성', 'By suggested amount')}
            </button>
            <button type="button" aria-pressed={memMode} onClick={() => { setMemMode(true); setKids(false); }} className={`${big} flex-col text-center ${on(memMode)}`}>
              <span className="material-symbols-outlined">psychology</span>
              {l('암기 방식으로 구성', 'By memorize method')}
            </button>
          </div>
          {memMode && (
            <div className="space-y-3 rounded-2xl border border-outline-variant p-4">
              <p className="text-base text-on-surface-variant">{l('외우게 할 방식을 고르면 쉬운 방식부터 차례로 이어져요. 시간 제한은 없어요.', 'Pick methods; they run from easy to hard. No time limit.')}</p>
              <div className="flex flex-wrap gap-2">
                {MEMORY_METHOD_LIST.map((m) => (
                  <button
                    key={m}
                    type="button"
                    title={MEMORY_METHODS[m].help[en ? 1 : 0]}
                    aria-pressed={memMethods.includes(m)}
                    onClick={() => setMemMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))}
                    className={`min-h-11 rounded-full border-2 px-4 text-base font-bold ${on(memMethods.includes(m))}`}
                  >
                    {MEMORY_METHODS[m].name[en ? 1 : 0]}
                  </button>
                ))}
              </div>
              <label className="flex flex-wrap items-center gap-2 text-base">
                {l('방식마다 낱말 수', 'Words per method')}
                <input type="number" min={1} max={MAX_MEMORY_COUNT} value={memCount} onChange={(e) => setMemCount(Math.max(1, Math.min(Number(e.target.value) || 1, MAX_MEMORY_COUNT)))} className="min-h-11 w-24 rounded-xl border border-outline-variant px-3" />
                <button type="button" className="min-h-11 rounded-full border border-outline-variant px-4 font-bold" onClick={() => setMemCount(Math.min(cards.length || 1, MAX_MEMORY_COUNT))}>
                  {l(`전부(${Math.min(cards.length, MAX_MEMORY_COUNT)}개)`, `All (${Math.min(cards.length, MAX_MEMORY_COUNT)})`)}
                </button>
              </label>
              {cards.length > MAX_MEMORY_COUNT && <p className="text-sm text-on-surface-variant">{l(`낱말이 ${cards.length}개예요. 한 방식에 최대 ${MAX_MEMORY_COUNT}개까지 넣을 수 있어요.`, `${cards.length} words; up to ${MAX_MEMORY_COUNT} per method.`)}</p>}
              {memMethods.length === 0 && <p className="text-sm text-error">{l('방식을 하나 이상 고르세요.', 'Pick at least one method.')}</p>}
              <ItemSummary items={items} />
            </div>
          )}
          {!memMode && (<>
          <button
            type="button"
            aria-pressed={kids}
            onClick={() => setKids((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left ${on(kids)}`}
          >
            <span className="material-symbols-outlined text-[36px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              {kids ? 'check_circle' : 'child_care'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-title-md text-title-md font-bold text-deep-navy">{t('studentHw.kidsOption')}</span>
              <span className="block text-base text-on-surface-variant">{t('studentHw.kidsOptionDesc')}</span>
            </span>
          </button>
          {kids && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-deep-navy">{t('studentHw.kidsLinesLabel')}</span>
              {[3, 5, 8, 10].map((n) => (
                <button key={n} type="button" aria-pressed={kidsLines === n} onClick={() => setKidsLines(n)} className={`min-h-11 rounded-full border-2 px-4 text-base font-bold ${on(kidsLines === n)}`}>
                  {t('studentHw.kidsLinesN', { n })}
                </button>
              ))}
              {!clip && cards.length > 0 && !cards.some((c) => c.example) && <p className="w-full text-sm text-on-surface-variant">{t('studentHw.kidsNoExamples')}</p>}
            </div>
          )}
          {!kids && (
          <div className="grid grid-cols-3 gap-2">
            {([5, 10, 15] as HwDuration[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={!custom && minutes === m}
                onClick={() => {
                  setCustom(false);
                  setMinutes(m);
                }}
                className={`flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 ${on(!custom && minutes === m)}`}
              >
                <span className="text-2xl font-bold">{t(`studentHw.amount_${m}`)}</span>
                <span className="text-sm text-on-surface-variant">{t(`studentHw.preset_${m}`)}</span>
              </button>
            ))}
          </div>
          )}
          <ItemSummary items={items} />
          {!kids && (
          <details
            open={custom}
            onToggle={(e) => {
              const open = (e.target as HTMLDetailsElement).open;
              if (open !== custom) setCustom(open);
            }}
            className="rounded-xl border border-outline-variant"
          >
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-label-md text-label-md text-on-surface">
              <span className="material-symbols-outlined">tune</span>
              {t('studentHw.customize')}
            </summary>
            <div className="grid gap-2 p-4 pt-0 sm:grid-cols-2">
              {(
                [
                  ['quizMeaning', 15],
                  ['quizListen', 15],
                  ['quizPicture', 15],
                  ['sheetChoose', 15],
                  ['sheetBlank', 15],
                  ['sheetOrder', 15],
                  ['gameMatchup', 15],
                  ['gameAnagram', 15],
                  ['gameSpelling', 15],
                  ...(clip ? ([['shadowLines', 30]] as const) : []),
                ] as const
              ).map(([k, max]) => (
                <Stepper key={k} label={t(`studentHw.plan_${k}`)} value={plan[k] as number} max={max} onChange={(v) => setPlan((p) => ({ ...p, [k]: v }))} />
              ))}
              {clip && (
                <label className="flex min-h-12 items-center gap-2 rounded-xl bg-surface-container-low px-3 text-base">
                  <input type="checkbox" className="h-5 w-5" checked={plan.contentCheck} onChange={(e) => setPlan((p) => ({ ...p, contentCheck: e.target.checked }))} />
                  {t('studentHw.plan_contentCheck')}
                </label>
              )}
            </div>
          </details>
          )}
          </>)}
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
              <dt className="text-on-surface-variant">{t('studentHw.titleLabel')}</dt>
              <dd className="font-bold text-deep-navy">{finalTitle}</dd>
              <dt className="text-on-surface-variant">{t('studentHw.step_target')}</dt>
              <dd>{everyone ? t('studentHw.targetAll', { count: students.length }) : t('studentHw.targetN', { count: targetIds.length })}</dd>
              <dt className="text-on-surface-variant">{t('studentHw.dueLabel')}</dt>
              <dd>{due ? new Date(due).toLocaleString() : t('studentHw.noDue')}</dd>
            </dl>
            <ItemSummary items={items} />
            <button type="button" onClick={() => setSeed((s) => s + 1)} className="flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant px-4 font-label-md text-label-md">
              <span className="material-symbols-outlined text-[18px]">shuffle</span>
              {t('studentHw.reshuffle')}
            </button>
            <p className="text-sm text-on-surface-variant">{t('studentHw.previewNote')}</p>
          </div>
          {onEdit && <button type="button" className="min-h-12 rounded-xl bg-warm-yellow px-5 font-bold text-deep-navy" onClick={() => onEdit(items, finalTitle, everyone ? null : targetIds, due)}>{t('studentHw.editBlocks')}</button>}
          <HomeworkPreview title={finalTitle} items={items} />
        </div>
      )}

      {err && (
        <p className="rounded-xl bg-error-container px-4 py-2 text-base text-on-error-container" role="alert">
          {err}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2 border-t border-outline-variant/40 pt-4">
        <button
          type="button"
          onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}
          className="flex min-h-12 items-center gap-1 rounded-full border border-outline-variant px-6 font-label-md text-label-md text-on-surface"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          {step === 0 ? t('common.cancel') : t('studentHw.back')}
        </button>
        {step < 3 ? (
          <button type="button" disabled={!canNext} onClick={() => setStep(step + 1)} className="flex min-h-12 items-center gap-1 rounded-full bg-primary px-8 font-label-md text-label-md text-on-primary disabled:opacity-40">
            {t('studentHw.nextStep')}
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        ) : (
          <button type="button" disabled={busy || items.length === 0} onClick={() => void create()} className="flex min-h-12 items-center gap-1 rounded-full bg-primary px-8 font-label-md text-label-md text-on-primary disabled:opacity-40">
            <span className="material-symbols-outlined">send</span>
            {busy ? t('common.loading') : t('studentHw.createButton')}
          </button>
        )}
      </div>
    </section>
  );
}

export function ItemSummary({ items }: { items: ReturnType<typeof buildItems> }) {
  const { t } = useTranslation();
  if (items.length === 0) return <p className="rounded-xl bg-surface-container-low px-3 py-2 text-base text-on-surface-variant">{t('studentHw.noItemsYet')}</p>;
  return (
    <div className="space-y-1.5 rounded-xl bg-surface-container-low p-3">
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2 text-base">
            <span className="material-symbols-outlined text-[20px] text-primary">{{ quiz: 'quiz', worksheet: 'description', game: 'sports_esports', shadowing: 'record_voice_over' }[it.kind]}</span>
            <span className="flex-1">{it.title}</span>
            <span className="tabular-nums text-on-surface-variant">
              {it.config.watch ? t('studentHw.watchOne') : it.kind === 'shadowing' ? t('studentHw.linesN', { n: it.content.lines?.length ?? 0 }) : ''}
              {it.kind === 'shadowing' && it.content.questions.length ? ' + ' : ''}
              {it.content.questions.length ? t('studentHw.questionCount', { count: it.content.questions.length }) : ''}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-outline-variant/40 pt-1.5 text-base font-bold text-deep-navy">
        {items.every((it) => it.config.watch)
          ? t('studentHw.watchTotal', { count: items.length, minutes: estimateMinutes(items) })
          : t('studentHw.totalSummary', { count: countQuestions(items), minutes: estimateMinutes(items) })}
      </div>
    </div>
  );
}

function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  const btn = 'flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant text-xl disabled:opacity-30';
  return (
    <div className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-surface-container-low px-3">
      <span className="text-base">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" className={btn} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} aria-label={t('studentHw.less', { label })}>
          −
        </button>
        <span className="w-7 text-center text-base font-bold tabular-nums">{value}</span>
        <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label={t('studentHw.more', { label })}>
          +
        </button>
      </span>
    </div>
  );
}
