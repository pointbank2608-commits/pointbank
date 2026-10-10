import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchCurriculumLessons, fetchStudentsOfClass, fetchWordLists } from '../../../lib/api';
import { wordListToCards } from '../../../lib/gameFromWords';
import { createHomework, teacherErrorKey } from '../../../lib/homework';
import { fetchClassWrongCards, useBuildLabels } from '../../../lib/homework/teacherHelpers';
import { buildItems, countQuestions, EMPTY_PLAN, estimateMinutes, presetPlan, type ClipSource, type HwDuration } from '../../../lib/homework/build';
import type { HwPlan } from '../../../lib/homework/types';
import type { CurriculumLesson, FullCardItem, Student, WordList } from '../../../lib/types';
import type { VideoClip } from '../../../lib/videoClips';
import { enrichCards, loadWordBank } from '../../../lib/wordBankCache';
import VideoClipLibrary from '../../VideoClipLibrary';
import HomeworkPreview from './HomeworkPreview';

type Source = 'lesson' | 'wordlist' | 'video' | 'wrong';

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
  onCancel,
  onCreated,
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
  onCancel: () => void;
  onCreated: (hw: { id: string; code: string }) => void;
}) {
  const { t } = useTranslation();
  const labels = useBuildLabels();
  const [step, setStep] = useState(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [everyone, setEveryone] = useState(!initialStudentIds?.length);
  const [picked, setPicked] = useState<Set<string>>(new Set(initialStudentIds ?? []));
  const [title, setTitle] = useState(initialTitle ?? '');
  const [due, setDue] = useState('');

  const [source, setSource] = useState<Source>(initialCards?.length ? 'wrong' : 'lesson');
  const [lessons, setLessons] = useState<CurriculumLesson[]>([]);
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [wrongCards, setWrongCards] = useState<FullCardItem[] | null>(initialCards ?? null);
  const [lessonId, setLessonId] = useState('');
  const [wordListId, setWordListId] = useState('');
  const [clip, setClip] = useState<VideoClip | null>(null);
  const [cards, setCards] = useState<FullCardItem[]>(initialCards ?? []);
  const [sourceName, setSourceName] = useState(initialTitle ?? '');
  const [missingLessonWords, setMissingLessonWords] = useState(false);

  const [minutes, setMinutes] = useState<HwDuration | null>(10);
  const [custom, setCustom] = useState(false);
  const [plan, setPlan] = useState<HwPlan>(EMPTY_PLAN);
  const [seed, setSeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  useEffect(() => {
    if (minutes && !custom) setPlan(presetPlan(minutes, cards, !!clip));
  }, [minutes, custom, cards, clip]);

  const items = useMemo(() => {
    let s = seed * 9301 + 49297;
    const rng = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    return buildItems(cards, plan, labels, clipSource, rng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, plan, labels, clip, seed]);

  const targetIds = everyone ? students.map((s) => s.id) : [...picked];
  const canNext = [targetIds.length > 0, cards.length >= 2 || !!clip, items.length > 0, items.length > 0][step];
  const finalTitle = title.trim() || sourceName || t('studentHw.defaultTitle');

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const hw = await createHomework({
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
              <span>{t(`studentHw.step_${s}`)}</span>
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
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {(['lesson', 'wordlist', 'video', 'wrong'] as Source[]).map((s) => (
              <button key={s} type="button" className={`${big} flex-col text-center ${on(source === s)}`} onClick={() => setSource(s)} aria-pressed={source === s}>
                <span className="material-symbols-outlined">{{ lesson: 'co_present', wordlist: 'menu_book', video: 'movie', wrong: 'replay' }[s]}</span>
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

          {source === 'video' && (
            <div className="space-y-2">
              {clip && (
                <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-base text-deep-navy">
                  <span className="material-symbols-outlined">check_circle</span>
                  {t('studentHw.clipPicked', { title: clip.title })}
                </div>
              )}
              <VideoClipLibrary onPick={pickClip} pickLabel={t('studentHw.pickClip')} />
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

      {step === 2 && (
        <div className="space-y-4">
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
                <span className="text-2xl font-bold">{t('studentHw.minutesN', { n: m })}</span>
                <span className="text-sm text-on-surface-variant">{t(`studentHw.preset_${m}`)}</span>
              </button>
            ))}
          </div>
          <ItemSummary items={items} />
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
              {it.kind === 'shadowing' ? t('studentHw.linesN', { n: it.content.lines?.length ?? 0 }) : ''}
              {it.kind === 'shadowing' && it.content.questions.length ? ' + ' : ''}
              {it.content.questions.length ? t('studentHw.questionCount', { count: it.content.questions.length }) : ''}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-outline-variant/40 pt-1.5 text-base font-bold text-deep-navy">
        {t('studentHw.totalSummary', { count: countQuestions(items), minutes: estimateMinutes(items) })}
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
