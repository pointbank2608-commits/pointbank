import { useClassWordLists } from '../lib/useClassWordLists';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BANK_LEVELS, SENTENCE_BANK, bankSentences, type BankLevel } from '../data/sentenceBank';
import { createCurriculumLesson, createWordList } from '../lib/api';
import { curriculumFor, SCHOOLS, type SchoolId } from '../lib/curriculumGrammar';
import { getGameCatalogEntry } from '../lib/gameCatalog';
import { wordListToCards } from '../lib/gameFromWords';
import { grammarPoint } from '../lib/grammar';
import { LESSON_RECIPES, type RecipeContext } from '../lib/lessonRecipes';
import { LESSON_SETS, lessonSetName, pickSetWords } from '../lib/lessonSets';
import { loadPhonicsBank } from '../lib/phonicsFill';
import {
  QUICK_KINDS,
  ROLEPLAY_SITUATIONS,
  attachQuickGames,
  buildSentenceBankSlides,
  createQuickHelpers,
  parsePastedWords,
  planQuickLesson,
  quickRowsToSlides,
  quickGameChoices,
  setQuickGame,
  type QuickKind,
  type QuickMinutes,
  type QuickRow,
  type RoleplaySituation,
  type VocabStyle,
} from '../lib/quickLesson';
import { buildSongLesson, SONG_LESSONS } from '../lib/songLessons';
import type { ClassRow, CurriculumLesson, FullCardItem, LessonSlide, WordList } from '../lib/types';
import { clipLength, clipThumb, formatClipTime, useVideoClips } from '../lib/videoClips';
import { enrichCards, loadWordBank } from '../lib/wordBankCache';
import { useToast } from '../context/ToastContext';

type Source = 'paste' | 'mine' | 'topic';
export type QuickAction = 'start' | 'save' | 'edit';

interface Props {
  academyId: string;
  teacherId: string;
  classes: ClassRow[];
  defaultClassId: string | null;
  wordLists: WordList[];
  onClose: () => void;
  /** 만든 수업(과 새로 만든 단어장들). action 은 사용자가 고른 버튼 */
  onDone: (lesson: CurriculumLesson, lists: WordList[], action: QuickAction) => void;
}

const SLOT_COLOR: Record<QuickRow['slot'], string> = {
  warmup: 'bg-warm-yellow',
  learn: 'bg-sky-blue',
  practice: 'bg-secondary-fixed',
  recall: 'bg-primary-fixed',
  sentence: 'bg-sky-blue',
  team: 'bg-tertiary-fixed',
  wrapup: 'bg-primary-fixed',
  sheet: 'bg-surface-variant',
};

const uid = () => crypto.randomUUID();

/** 종류별 대략의 수업 시간(레시피·노래·영상 수업의 기본 분) */
const KIND_MINUTES: Record<string, number> = { grammar: 30, phonics: 40, bank: 25, video: 45, song: 40, contest: 40, review: 10 };

/** 질문 3개(반 · 무엇을 · 몇 분)로 수업 구성을 만든다. 종류(단어·문법·파닉스·상황 표현·영상·노래)마다 있는 수업 구성을 그대로 쓴다. */
export default function QuickLessonWizard({ academyId, teacherId, classes, defaultClassId, onClose, onDone }: Props) {
  const { t, i18n } = useTranslation();
  const { notify } = useToast();
  const ko = i18n.language.startsWith('ko');
  const [classId, setClassId] = useState<string>(defaultClassId ?? classes[0]?.id ?? '');
  const [kind, setKind] = useState<QuickKind>('vocab');
  // 단어
  const [source, setSource] = useState<Source>('paste');
  const [vocabStyle, setVocabStyle] = useState<VocabStyle>('normal');
  const [pasted, setPasted] = useState('');
  const [listId, setListId] = useState('');
  const [wordRoles, setWordRoles] = useState<Record<string,'new'|'review'|'skip'>>({});
  const [setId, setSetId] = useState(LESSON_SETS.find((s) => s.kind === 'word')?.id ?? '');
  const [minutes, setMinutes] = useState<QuickMinutes>(40);
  const [rows, setRows] = useState<QuickRow[]>(() => planQuickLesson(40));
  // 문법
  const [school, setSchool] = useState<SchoolId>('elementary');
  const [grammarId, setGrammarId] = useState('');
  // 파닉스
  const [phStep, setPhStep] = useState(1);
  // 상황 표현
  const [sit, setSit] = useState<{ type: 'role'; id: RoleplaySituation } | { type: 'bank'; id: string } | null>(null);
  const [bankLevel, setBankLevel] = useState<BankLevel>('elem');
  // 영상
  const [videoMode, setVideoMode] = useState<'library' | 'own'>('library');
  const [clipId, setClipId] = useState('');
  const [clipQuery, setClipQuery] = useState('');
  const [clipLevel, setClipLevel] = useState(0);
  const [ownUrl, setOwnUrl] = useState('');
  const [ownScript, setOwnScript] = useState('');
  const [ownTitle, setOwnTitle] = useState('');
  // 노래
  const [songId, setSongId] = useState('');
  const [busy, setBusy] = useState(false);
  const [swapRow, setSwapRow] = useState<number | null>(null);

  const { clips } = useVideoClips();
  const wordSets = useMemo(() => LESSON_SETS.filter((s) => s.kind === 'word').slice(0, 12), []);
  const {lists:myLists,loading:listsLoading,error:listsError,reload:reloadLists}=useClassWordLists(academyId,classId);
  const selectedList = myLists.find(list => list.id === listId);
  const assignWords = source === 'mine' && vocabStyle === 'normal' && !!selectedList?.items.length;
  const roleFor = (id: string) => wordRoles[id] ?? 'new';
  useEffect(()=>{setListId('');setWordRoles({});},[classId]);
  const pastedCount = useMemo(() => parsePastedWords(pasted, []).length, [pasted]);
  const grades = useMemo(() => curriculumFor(school), [school]);
  const clipLevels = useMemo(() => [...new Set((clips ?? []).map((c) => c.level))].sort((a, b) => a - b), [clips]);
  const shownClips = useMemo(() => {
    const q = clipQuery.trim().toLowerCase();
    return (clips ?? []).filter((c) => (!clipLevel || c.level === clipLevel) && (!q || `${c.series} ${c.title} ${c.tags.join(' ')}`.toLowerCase().includes(q)));
  }, [clips, clipQuery, clipLevel]);

  function chooseMinutes(m: QuickMinutes) {
    setMinutes(m);
    setRows(planQuickLesson(m));
  }

  const wordsReady = source === 'paste' ? pastedCount >= 4 : source === 'mine'
    ? !listsLoading && !listsError && !!selectedList?.items.some(item => !assignWords || roleFor(item.id) === 'new')
    : !!setId;
  const ready =
    !!classId &&
    (kind === 'vocab'
      ? wordsReady
      : kind === 'grammar'
        ? !!grammarId
        : kind === 'phonics'
          ? true
          : kind === 'situation'
            ? !!sit
            : kind === 'video'
              ? videoMode === 'library'
                ? !!clipId
                : ownUrl.trim().length > 5 && ownScript.trim().length > 10
              : !!songId);

  const sitName = (id: string) => {
    const s = SENTENCE_BANK.find((x) => x.id === id);
    return s ? (ko ? s.ko : s.en) : id;
  };

  async function make(action: QuickAction) {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const bank = await loadWordBank();
      const helpers = createQuickHelpers({ academyId, classId, teacherId, t });
      const ctx = (extra: Partial<RecipeContext> = {}): RecipeContext => ({
        t,
        hasWords: false,
        makeUnscramble: helpers.makeUnscramble,
        makeGrammarGames: helpers.makeGrammarGames,
        makeWordList: helpers.makeWordList,
        makeUnscrambleFromSentences: helpers.makeUnscrambleFromSentences,
        makeGameFromWords: helpers.makeGameFromWords,
        ...extra,
      });
      const recipe = (id: string) => LESSON_RECIPES.find((r) => r.id === id);
      let slides: LessonSlide[] = [];
      let lessonName = '';
      let list: WordList | null = null; // 이 수업의 단어장
      const created: WordList[] = [];
      let cards: FullCardItem[] = [];

      async function listFromCards(parsed: FullCardItem[], name: string): Promise<WordList> {
        const l = await createWordList({
          academyId,
          classId,
          name,
          items: parsed.map((w) => ({ id: uid(), word: w.word, meaning: w.meaning, image_url: w.imageUrl, category: w.category ?? null, partOfSpeech: w.partOfSpeech ?? null, patternMarked: w.patternMarked ?? null })),
          teacherId,
        });
        created.push(l);
        return l;
      }

      const gameCards = new Map<string,FullCardItem[]>();
      if (kind === 'vocab') {
        let listName: string;
        if (source === 'mine') {
          list = myLists.find((l) => l.id === listId) ?? null;
          if (!list) throw new Error('list');
          listName = list.name;
          cards = enrichCards(wordListToCards(list), bank);
        } else {
          const set = LESSON_SETS.find((s) => s.id === setId);
          const parsed = source === 'paste' ? parsePastedWords(pasted, bank) : pickSetWords(set!, bank);
          listName =
            source === 'paste'
              ? t('quickLesson.pastedName', { date: new Date().toLocaleDateString(i18n.language, { month: 'numeric', day: 'numeric' }) })
              : lessonSetName(set!, i18n.language);
          list = await listFromCards(parsed, listName);
          cards = parsed;
        }
        if (vocabStyle === 'normal' || vocabStyle === 'review') {
          const newWords = assignWords ? cards.filter(card => roleFor(card.id) === 'new') : cards;
          const reviewWords = assignWords ? cards.filter(card => roleFor(card.id) === 'review') : [];
          slides = quickRowsToSlides(vocabStyle === 'review' ? planQuickLesson(10) : rows,newWords,reviewWords,gameCards);
          lessonName = t('quickLesson.lessonName', { list: listName });
          if (vocabStyle === 'review') lessonName = t('quickLesson.nameReview', {list:listName});
        } else {
          slides = (await recipe(vocabStyle)!.build(ctx({ hasWords: true }))) as LessonSlide[];
          lessonName = t(vocabStyle === 'contest' ? 'quickLesson.nameContest' : 'quickLesson.nameReview', { list: listName });
        }
      } else if (kind === 'grammar') {
        const point = grammarPoint(grammarId);
        if (!point) throw new Error('grammar');
        slides = await recipe('grammar')!.build(ctx({ grammarId }));
        lessonName = t('quickLesson.lessonName', { list: point.name });
      } else if (kind === 'phonics') {
        const all = (await loadPhonicsBank()).filter((e) => e.step === phStep).sort((a, b) => a.sort_order - b.sort_order);
        // 소리 규칙을 골고루: 규칙별로 돌아가며 10개
        const byRule = new Map<string, typeof all>();
        for (const e of all) byRule.set(e.rule, [...(byRule.get(e.rule) ?? []), e]);
        const picked: typeof all = [];
        for (let round = 0; picked.length < 10; round += 1) {
          let any = false;
          for (const arr of byRule.values()) {
            if (arr[round] && picked.length < 10) {
              picked.push(arr[round]);
              any = true;
            }
          }
          if (!any) break;
        }
        if (picked.length < 4) throw new Error('phonics');
        cards = picked.map((e) => ({ id: uid(), word: e.word, meaning: e.meaning ?? '', imageUrl: e.image_url, patternMarked: e.pattern_marked, category: e.rule }));
        const listName = t('quickLesson.phonicsName', { n: phStep });
        list = await listFromCards(cards, listName);
        slides = await recipe('phonics')!.build(ctx({ hasWords: true }));
        lessonName = t('quickLesson.lessonName', { list: listName });
      } else if (kind === 'situation' && sit) {
        if (sit.type === 'role') {
          const entry = getGameCatalogEntry(sit.id);
          const r = sit.id === 'shopping' ? null : recipe(sit.id);
          slides = r
            ? await r.build(ctx())
            : [
                { id: uid(), kind: 'attendance', boardTheme: 'green' },
                { id: uid(), kind: 'game', gameType: sit.id },
              ];
          lessonName = t('quickLesson.lessonName', { list: t(entry?.nameKey ?? '') });
        } else {
          const sentences = bankSentences(sit.id, bankLevel);
          const label = `${sitName(sit.id)} · ${t(`quickLesson.bankLevel_${bankLevel}`)}`;
          slides = await buildSentenceBankSlides({ sentences, academyId, classId, teacherId, name: label });
          lessonName = t('quickLesson.lessonName', { list: label });
        }
      } else if (kind === 'video') {
        const clip = clips?.find((c) => c.id === clipId) ?? null;
        slides = await recipe('video')!.build(
          ctx(
            clip
              ? { video: { source: clip.script, title: clip.title, videoUrl: `https://www.youtube.com/watch?v=${clip.youtube_id}`, clip } }
              : { video: { source: ownScript, title: ownTitle.trim() || undefined, videoUrl: ownUrl.trim() } },
          ),
        );
        lessonName = clip ? `${clip.series} · ${clip.title}` : ownTitle.trim() || t('quickLesson.videoOwnName');
      } else if (kind === 'song') {
        const song = SONG_LESSONS.find((s) => s.id === songId);
        if (!song) throw new Error('song');
        slides = await buildSongLesson(song, { makeWordList: helpers.makeWordList, makeUnscrambleFromSentences: helpers.makeUnscrambleFromSentences, makeGameFromWords: helpers.makeGameFromWords });
        lessonName = `${song.title} · ${song.artist}`;
      }
      if (slides.length === 0) throw new Error('empty');

      // 레시피가 만든 단어장(영상·노래)이 있으면 그것을 수업 단어장으로
      const made = helpers.createdLists();
      for (const l of made) created.push(l);
      if (!list && made.length > 0) list = made[made.length - 1];
      if (cards.length === 0 && list) cards = enrichCards(wordListToCards(list), bank);

      slides = await attachQuickGames({ slides, cards, gameCards, academyId, classId, teacherId, lessonName, listName: list?.name ?? lessonName });
      const lesson = await createCurriculumLesson({
        academyId,
        classId,
        name: lessonName,
        wordListId: list?.id ?? null,
        videoUrl: null,
        level: null,
        playlist: slides,
        teacherId,
      });
      onDone(lesson, created, action);
    } catch {
      notify(t('quickLesson.failed'), 'error');
      setBusy(false);
    }
  }

  const chip = (on: boolean) =>
    `min-h-11 rounded-full px-4 font-label-md text-label-md ${on ? 'bg-primary text-on-primary' : 'border border-outline-variant bg-surface-container-lowest text-on-surface-variant'}`;
  const reviewTimeline = kind === 'vocab' && vocabStyle === 'review';
  const timelineRows = reviewTimeline ? planQuickLesson(10) : rows;
  const total = timelineRows.reduce((n, r) => n + r.minutes, 0);
  const flowKey = kind === 'vocab' ? (vocabStyle === 'normal' ? null : vocabStyle) : kind === 'situation' ? (sit?.type === 'bank' ? 'bank' : sit ? 'role' : null) : kind;
  const approx = flowKey ? KIND_MINUTES[flowKey] : null;
  const showTimeline = kind === 'vocab' && vocabStyle !== 'contest';

  return (
    <div role="dialog" aria-modal="true" aria-label={t('quickLesson.title')} className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/50 p-4">
      <div className="max-h-[92dvh] w-full max-w-3xl space-y-5 overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">{t('quickLesson.title')}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">{t('quickLesson.subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 rounded-full px-4 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container">
            {t('quickLesson.close')}
          </button>
        </div>

        <section className="space-y-2">
          <h3 className="font-title-md text-title-md text-on-surface">1. {t('quickLesson.q1')}</h3>
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <button key={c.id} type="button" disabled={busy} aria-pressed={classId === c.id} onClick={() => setClassId(c.id)} className={chip(classId === c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-title-md text-title-md text-on-surface">2. {t('quickLesson.q2')}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {QUICK_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
                className={`flex min-h-[84px] flex-col items-start gap-0.5 rounded-2xl border p-3 text-left transition ${
                  kind === k.id ? 'border-primary bg-primary-fixed/40' : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                }`}
              >
                <span className="flex items-center gap-1.5 font-label-md text-label-md font-bold text-deep-navy">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden>
                    {k.icon}
                  </span>
                  {t(`quickLesson.kind_${k.id}`)}
                </span>
                <span className="text-[13px] leading-4 text-on-surface-variant">{t(`quickLesson.kindDesc_${k.id}`)}</span>
              </button>
            ))}
          </div>

          {kind === 'vocab' && (
            <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
              <div className="flex flex-wrap gap-2">
                {(['paste', 'mine', 'topic'] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={source === s} onClick={() => setSource(s)} className={chip(source === s)}>
                    {t(`quickLesson.source_${s}`)}
                  </button>
                ))}
              </div>
              {source === 'paste' && (
                <div className="space-y-1">
                  <textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    rows={5}
                    placeholder={t('quickLesson.pastePlaceholder')}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 font-body-md text-body-md"
                  />
                  <p className="font-caption text-caption text-on-surface-variant">{t('quickLesson.pasteHint', { count: pastedCount })}</p>
                </div>
              )}
              {source === 'mine' &&
                (listsLoading ? <p role="status">{t('lessonUx.loading')}</p> : listsError ? <div role="alert">{t('lessonUx.failed')} <button type="button" className="min-h-11 rounded-xl border px-4 text-primary" onClick={reloadLists}>{t('lessonUx.retry')}</button></div> : myLists.length === 0 ? (
                  <p className="font-body-md text-body-md text-on-surface-variant">{t('quickLesson.noLists')}</p>
                ) : (
                  <select value={listId} onChange={(e) => {setListId(e.target.value);setWordRoles({});}} className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3">
                    <option value="">{t('quickLesson.pickList')}</option>
                    {myLists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.items.length})
                      </option>
                    ))}
                  </select>
                ))}
              {assignWords && selectedList && <details className="rounded-xl border border-outline-variant p-3">
                <summary className="cursor-pointer font-bold">{t('quickLesson.chooseWordRoles')} · {t('quickLesson.wordRoleCounts',{fresh:selectedList.items.filter(item=>roleFor(item.id)==='new').length,review:selectedList.items.filter(item=>roleFor(item.id)==='review').length})}</summary>
                <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto">
                  {selectedList.items.map(item => <label key={item.id} className="flex items-center justify-between gap-2">
                    <span>{item.word}</span>
                    <select aria-label={item.word} className="rounded-md border p-1" value={roleFor(item.id)} onChange={event=>setWordRoles(previous=>({...previous,[item.id]:event.target.value as 'new'|'review'|'skip'}))}>
                      {(['new','review','skip'] as const).map(role=><option key={role} value={role}>{t('quickLesson.wordRole_'+role)}</option>)}
                    </select>
                  </label>)}
                </div>
              </details>}
              {source === 'topic' && (
                <div className="flex flex-wrap gap-2">
                  {wordSets.map((s) => (
                    <button key={s.id} type="button" aria-pressed={setId === s.id} onClick={() => setSetId(s.id)} className={chip(setId === s.id)}>
                      {lessonSetName(s, i18n.language)}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="font-label-md text-label-md text-on-surface-variant">{t('quickLesson.styleLabel')}</span>
                {(['normal', 'contest', 'review'] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={vocabStyle === s} onClick={() => setVocabStyle(s)} className={chip(vocabStyle === s)}>
                    {t(`quickLesson.vocabStyle_${s}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {kind === 'grammar' && (
            <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
              <div className="flex flex-wrap gap-2">
                {SCHOOLS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={school === s.id}
                    onClick={() => {
                      setSchool(s.id);
                      setGrammarId('');
                    }}
                    className={chip(school === s.id)}
                  >
                    {ko ? s.ko : s.en}
                  </button>
                ))}
              </div>
              <select value={grammarId} onChange={(e) => setGrammarId(e.target.value)} className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3">
                <option value="">{t('quickLesson.pickGrammar')}</option>
                {grades.map((g) =>
                  g.units.map((u) => (
                    <optgroup key={`${g.grade}-${u.unit.id}`} label={`${g.grade} · ${ko ? u.unit.ko : u.unit.en}`}>
                      {u.points.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )),
                )}
              </select>
            </div>
          )}

          {kind === 'phonics' && (
            <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-pressed={phStep === n} onClick={() => setPhStep(n)} className={chip(phStep === n)}>
                    {t('quickLesson.phonicsStep', { n })}
                  </button>
                ))}
              </div>
              <p className="font-caption text-caption text-on-surface-variant">{t('quickLesson.phonicsHint')}</p>
            </div>
          )}

          {kind === 'situation' && (
            <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
              <div className="space-y-1.5">
                <div className="font-label-md text-label-md text-on-surface-variant">{t('quickLesson.situationRole')}</div>
                <div className="flex flex-wrap gap-2">
                  {ROLEPLAY_SITUATIONS.map((id) => (
                    <button key={id} type="button" aria-pressed={sit?.type === 'role' && sit.id === id} onClick={() => setSit({ type: 'role', id })} className={chip(sit?.type === 'role' && sit.id === id)}>
                      {t(getGameCatalogEntry(id)?.nameKey ?? '')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="font-label-md text-label-md text-on-surface-variant">{t('quickLesson.situationBank')}</div>
                <div className="flex flex-wrap gap-2">
                  {SENTENCE_BANK.map((s) => (
                    <button key={s.id} type="button" aria-pressed={sit?.type === 'bank' && sit.id === s.id} onClick={() => setSit({ type: 'bank', id: s.id })} className={chip(sit?.type === 'bank' && sit.id === s.id)}>
                      {ko ? s.ko : s.en}
                    </button>
                  ))}
                </div>
                {sit?.type === 'bank' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="font-label-md text-label-md text-on-surface-variant">{t('quickLesson.bankLevel')}</span>
                    {BANK_LEVELS.map((lv) => (
                      <button key={lv} type="button" aria-pressed={bankLevel === lv} onClick={() => setBankLevel(lv)} className={chip(bankLevel === lv)}>
                        {t(`quickLesson.bankLevel_${lv}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {kind === 'video' && (
            <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={videoMode === 'library'} onClick={() => setVideoMode('library')} className={chip(videoMode === 'library')}>
                  {t('quickLesson.videoLib')}
                </button>
                <button type="button" aria-pressed={videoMode === 'own'} onClick={() => setVideoMode('own')} className={chip(videoMode === 'own')}>
                  {t('quickLesson.videoOwn')}
                </button>
              </div>
              {videoMode === 'library' ? (
                <div className="space-y-2">
                  <input
                    type="search"
                    value={clipQuery}
                    onChange={(e) => setClipQuery(e.target.value)}
                    placeholder={t('quickLesson.videoSearch')}
                    className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 font-body-md text-body-md"
                  />
                  {clipLevels.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-label-md text-label-md text-on-surface-variant">{t('quickLesson.videoLevel')}</span>
                      <button type="button" aria-pressed={clipLevel === 0} onClick={() => setClipLevel(0)} className={chip(clipLevel === 0)}>
                        {t('videoLibrary.allLevels')}
                      </button>
                      {clipLevels.map((l) => (
                        <button key={l} type="button" aria-pressed={clipLevel === l} onClick={() => setClipLevel(l)} className={chip(clipLevel === l)}>
                          Lv.{l}
                        </button>
                      ))}
                    </div>
                  )}
                  {clips === null ? (
                    <p className="font-body-md text-body-md text-on-surface-variant">{t('common.loading')}</p>
                  ) : shownClips.length === 0 ? (
                    <p className="font-body-md text-body-md text-on-surface-variant">{t('quickLesson.videoNone')}</p>
                  ) : (
                    <div className="max-h-[340px] overflow-y-auto rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-2">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {shownClips.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={clipId === c.id}
                            onClick={() => setClipId(c.id)}
                            className={`overflow-hidden rounded-xl border-2 bg-surface-container-lowest text-left transition-colors ${clipId === c.id ? 'border-primary' : 'border-transparent hover:border-primary/40'}`}
                          >
                            <div className="relative aspect-video bg-surface-container-high">
                              <img src={clipThumb(c.youtube_id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                              <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">{formatClipTime(clipLength(c))}</span>
                              <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-deep-navy">Lv.{c.level}</span>
                            </div>
                            <div className="space-y-0.5 p-2">
                              <div className="truncate font-caption text-caption text-on-surface-variant">{c.series}</div>
                              <div className="line-clamp-2 font-label-md text-label-md text-on-surface">{c.title}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <input value={ownUrl} onChange={(e) => setOwnUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 font-body-md text-body-md" />
                  <input value={ownTitle} onChange={(e) => setOwnTitle(e.target.value)} placeholder={t('quickLesson.videoTitle')} className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 font-body-md text-body-md" />
                  <textarea value={ownScript} onChange={(e) => setOwnScript(e.target.value)} rows={4} placeholder={t('quickLesson.videoScript')} className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 font-body-md text-body-md" />
                </div>
              )}
            </div>
          )}

          {kind === 'song' && (
            <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
              <div className="flex flex-wrap gap-2">
                {SONG_LESSONS.map((s) => (
                  <button key={s.id} type="button" aria-pressed={songId === s.id} onClick={() => setSongId(s.id)} className={`${chip(songId === s.id)} text-left`}>
                    {s.title} · {s.artist}
                  </button>
                ))}
              </div>
              <p className="font-caption text-caption text-on-surface-variant">{t('quickLesson.songHint')}</p>
            </div>
          )}
        </section>

        {showTimeline ? (
          <>
            {!reviewTimeline && <section className="space-y-2">
              <h3 className="font-title-md text-title-md text-on-surface">3. {t('quickLesson.q3')}</h3>
              <div className="flex flex-wrap gap-2">
                {([20, 40, 50] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={minutes === m} onClick={() => chooseMinutes(m)} className={chip(minutes === m)}>
                    {m}
                    {t('quickLesson.min')}
                  </button>
                ))}
              </div>
            </section>}
            <section className="space-y-2 rounded-xl bg-surface-container-low p-4">
              <h3 className="font-title-md text-title-md text-on-surface">{t('quickLesson.planTitle', { minutes: total })}</h3>
              <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
                {timelineRows.map((r, i) => (
                  <div key={i} className={SLOT_COLOR[r.slot]} style={{ flex: r.minutes }} />
                ))}
              </div>
              <ul className="space-y-1">
                {timelineRows.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 py-1">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${SLOT_COLOR[r.slot]}`} aria-hidden />
                    <span className="w-20 shrink-0 font-label-md text-label-md text-on-surface">{t(`quickLesson.slot_${r.slot}`)}</span>
                    <span className="min-w-0 flex-1 font-body-md text-body-md text-on-surface-variant">
                      <strong className="block">{r.games.length ? r.games.map((g) => t(getGameCatalogEntry(g)?.nameKey ?? '')).join(' → ') : t(reviewTimeline && r.slot === 'learn' ? 'curriculum.slides.kindStudy' : `quickLesson.activity_${r.slot}`)}</strong>
                      <span className="block text-sm">{t(reviewTimeline && r.slot === 'learn' ? 'quickLesson.action_review_cards' : `quickLesson.action_${r.slot}`, {defaultValue:''})}</span>
                    </span>
                    <span className="font-caption text-caption text-on-surface-variant">
                      {r.minutes}
                      {t('quickLesson.min')}
                    </span>
                    {!reviewTimeline && r.games.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSwapRow(i)}
                        className="min-h-11 rounded-full border border-outline-variant px-3 font-label-md text-label-md text-primary hover:bg-primary/10"
                      >
                        {t('quickLesson.swap')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            {swapRow !== null && rows[swapRow] && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t('quickLesson.swap')} onClick={() => setSwapRow(null)}>
                <div className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <h3 className="font-title-md text-title-md text-on-surface">{t(`quickLesson.slot_${rows[swapRow].slot}`)} · {t('quickLesson.swap')}</h3>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {quickGameChoices(rows[swapRow]).map((g) => {
                      const row = rows[swapRow];
                      const current = row.games[row.games.length - 1] === g;
                      const entry = getGameCatalogEntry(g);
                      return (
                        <li key={g}>
                          <button
                            type="button"
                            aria-pressed={current}
                            onClick={() => { setRows((cur) => cur.map((x, j) => (j === swapRow ? setQuickGame(x, x.games.length - 1, g) : x))); setSwapRow(null); }}
                            className={`h-full w-full overflow-hidden rounded-xl border-2 text-left ${current ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary/50'}`}
                          >
                            {entry?.cover && <img src={entry.cover} alt="" loading="lazy" className="h-28 w-full object-cover" />}
                            <span className="block space-y-1 p-3">
                              <span className="block font-label-md text-label-md font-bold text-on-surface">{t(entry?.nameKey ?? '')}{current ? ' ✓' : ''}</span>
                              <span className="block font-caption text-caption text-on-surface-variant">{t(entry?.descKey ?? '')}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button type="button" onClick={() => setSwapRow(null)} className="min-h-11 w-full rounded-xl border border-outline-variant font-label-md text-label-md">{t('common.close')}</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <section className="space-y-1 rounded-xl bg-surface-container-low p-4">
            <h3 className="font-title-md text-title-md text-on-surface">
              {t('quickLesson.flowTitle')}
              {approx ? ` · ${t('quickLesson.approxMin', { n: approx })}` : ''}
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant">{flowKey ? t(`quickLesson.flow_${flowKey}`) : t('quickLesson.flowPick')}</p>
            <p className="font-caption text-caption text-on-surface-variant">{t('quickLesson.flowNote')}</p>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!ready || busy} onClick={() => void make('start')} className="min-h-12 rounded-full bg-primary px-6 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-50">
            {busy ? t('quickLesson.making') : `▶ ${t('quickLesson.startNow')}`}
          </button>
          <button type="button" disabled={!ready || busy} onClick={() => void make('save')} className="min-h-12 rounded-full border border-primary px-6 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-50">
            {t('quickLesson.saveOnly')}
          </button>
          <button type="button" disabled={!ready || busy} onClick={() => void make('edit')} className="min-h-12 rounded-full border border-outline-variant px-6 font-label-md text-label-md text-on-surface-variant disabled:opacity-50">
            {t('quickLesson.editMore')}
          </button>
        </div>
      </div>
    </div>
  );
}
