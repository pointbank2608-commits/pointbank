import type { VideoClip } from '../lib/videoClips';
import VideoClipLibrary from './VideoClipLibrary';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { grammarPoint } from '../lib/grammar';
import { LESSON_RECIPES, type LessonRecipe, type RecipeContext } from '../lib/lessonRecipes';
import { findSetClip, LESSON_SETS, lessonSetDesc, lessonSetName, pickSetWords, type LessonSet } from '../lib/lessonSets';
import { loadWordBank } from '../lib/wordBankCache';
import type { LessonSlide } from '../lib/types';
import { GrammarPickerPanel } from './LessonSlideSorter';
import CurriculumGrammarSets from './CurriculumGrammarSets';
import CurriculumWordSets from './CurriculumWordSets';
import { setToCards } from '../lib/curriculumWords';
import type { WordBankEntry } from '../lib/types';
import { GRAMMAR_POINTS } from '../lib/grammar';
import { useToast } from '../context/ToastContext';
import { generateShadowScript } from '../lib/api';
import { fetchVideoClips } from '../lib/videoClips';
import { parseShadowText, toShadowSource } from '../lib/shadowLines';
import { extractYoutubeId } from '../lib/youtube';
import { LESSON_LEVELS, levelMatches, useLessonLevel } from '../lib/lessonLevel';
import { buildSongLesson, SONG_LESSONS, type SongLesson } from '../lib/songLessons';
import SongLessonPicker from './SongLessonPicker';

/**
 * 새 수업 만들기의 "레시피로 시작하기"(2026-09-27). 수업 종류를 고르면 슬라이드가 순서대로 채워진다.
 * 문법 레시피는 문법 항목을, 노래·지문 레시피는 원문을 먼저 받는다.
 */
export default function LessonRecipePicker({
  hasWords,
  wordListName,
  onManageWordList,
  makeUnscramble,
  makeWordList,
  makeUnscrambleFromSentences,
  makeGameFromWords,
  makeBulkLists,
  onApply,
  autoClip,
}: {
  hasWords: boolean;
  /** 지금 고른 수업 단어장 이름(영상 수업을 만들 때 계속 쓸지 고르는 안내에 보인다) */
  wordListName?: string;
  onManageWordList: (mode: 'new' | 'edit') => void;
  makeUnscramble: RecipeContext['makeUnscramble'];
  makeWordList?: RecipeContext['makeWordList'];
  makeUnscrambleFromSentences?: RecipeContext['makeUnscrambleFromSentences'];
  makeGameFromWords?: RecipeContext['makeGameFromWords'];
  /** 교과과정 단어를 정렬·개수로 나눠 단어장 여러 개를 그룹에 저장한다 */
  makeBulkLists?: (lists: { name: string; entries: WordBankEntry[] }[], group: string) => Promise<number>;
  onApply: (slides: LessonSlide[], suggestedName: string) => void;
  /** 영상 라이브러리 메뉴에서 "이 장면으로 수업 만들기"로 왔을 때 — 열리자마자 그 장면으로 영상 레시피를 채운다 */
  autoClip?: VideoClip | null;
}) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<'sets' | 'recipes'>('sets');
  const [picked, setPicked] = useState<LessonRecipe | null>(null);
  const [grammarId, setGrammarId] = useState<string | null>(null);
  const [reading, setReading] = useState({ source: '', title: '', videoUrl: '' });
  const [video, setVideo] = useState({ source: '', title: '', videoUrl: '' });
  const [scripting, setScripting] = useState(false);
  const [videoTab, setVideoTab] = useState<'library' | 'own'>('library');
  const videoTabChip = (on: boolean) => `flex items-center gap-1.5 rounded-full px-4 py-1.5 font-label-md text-label-md ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`;
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  // 교과과정 단어·문법은 길어서 기본은 접어 두고, 분류 이름 옆의 펼치기 버튼으로 연다
  const [curOpen, setCurOpen] = useState<{ word: boolean; grammar: boolean }>({ word: false, grammar: false });
  // 영상 수업: 이미 단어장을 골라 뒀을 때 그 단어장을 계속 쓸지(기본은 영상 낱말로 새로 만든다)
  const [keepMyList, setKeepMyList] = useState(false);
  // 기본은 펼침, 접으면 제목 줄만 남아 화면을 덜 차지한다(2026-09-27 사용자 요청)
  const [open, setOpen] = useState(true);
  // 수업 대상(초등·중등·고등) — 처음에 고르면 그 대상의 세트·레시피·노래만 보인다
  const [level, setLevel] = useLessonLevel();
  const upper = level === 'middle' || level === 'high';
  useEffect(() => {
    // 중·고등은 미리 만든 초등 세트가 없으니 교과과정 단어·문법을 바로 펼쳐 둔다
    if (upper) setCurOpen({ word: true, grammar: true });
  }, [upper]);

  async function apply(recipe: LessonRecipe, clip?: VideoClip) {
    setBusy(true);
    try {
      const slides = await recipe.build({
        t,
        hasWords,
        keepWordList: hasWords && keepMyList,
        grammarId: grammarId ?? undefined,
        reading: { source: reading.source, title: reading.title.trim() || undefined, videoUrl: reading.videoUrl.trim() || null },
        makeUnscramble,
        video: clip
          ? { source: clip.script, title: clip.title, videoUrl: `https://www.youtube.com/watch?v=${clip.youtube_id}`, clip }
          : { source: video.source, title: video.title.trim() || undefined, videoUrl: video.videoUrl.trim() },
        makeWordList,
        makeUnscrambleFromSentences,
        makeGameFromWords,
      });
      if (slides.length === 0) return;
      const extra = recipe.id === 'grammar' && grammarId ? grammarPoint(grammarId)?.name : recipe.id === 'reading' ? reading.title.trim() : recipe.id === 'video' ? (clip ? `${clip.series} · ${clip.title}` : video.title.trim()) : '';
      onApply(slides, extra ? `${t(`recipes.${recipe.id}Name`)} · ${extra}` : t(`recipes.${recipe.id}Name`));
    } finally {
      setBusy(false);
    }
  }

  /** 교과과정 단어: 고른 묶음의 낱말로 단어장을 만들고 단어 수업을 채운다 */
  async function applyWordEntries(title: string, entries: WordBankEntry[]) {
    setBusy(true);
    try {
      const cards = setToCards(entries);
      if (cards.length < 5 || !makeWordList || !(await makeWordList(cards, title))) {
        notify(t('recipes.setFailed'), 'error');
        return;
      }
      const recipe = LESSON_RECIPES.find((r) => r.id === 'vocab');
      const common = { t, makeUnscramble, makeWordList, makeUnscrambleFromSentences, makeGameFromWords, reading: undefined, video: undefined };
      const slides = recipe ? await recipe.build({ ...common, hasWords: true }) : [];
      if (slides.length) onApply(slides, `${t('recipes.vocabName')} · ${title}`);
    } finally {
      setBusy(false);
    }
  }

  /** 수업 세트: 미리 만들어 둔 수업 — 단어 세트는 단어장을 같이 만들고, 문법·영상 세트는 해당 레시피에 내용을 끼워 넣는다. */
  async function applySet(set: LessonSet) {
    setBusy(true);
    try {
      const name = lessonSetName(set, i18n.language);
      const common = { t, makeUnscramble, makeWordList, makeUnscrambleFromSentences, makeGameFromWords, reading: undefined, video: undefined };
      if (set.kind === 'word') {
        const cards = pickSetWords(set, await loadWordBank());
        if (cards.length < 5 || !makeWordList || !(await makeWordList(cards, name))) {
          notify(t('recipes.setFailed'), 'error');
          return;
        }
        const recipe = LESSON_RECIPES.find((r) => r.id === 'vocab');
        const slides = recipe ? await recipe.build({ ...common, hasWords: true }) : [];
        if (slides.length) onApply(slides, `${t('recipes.vocabName')} · ${name}`);
      } else if (set.kind === 'grammar' && set.grammarId) {
        const recipe = LESSON_RECIPES.find((r) => r.id === 'grammar');
        const slides = recipe ? await recipe.build({ ...common, hasWords: hasWords, grammarId: set.grammarId }) : [];
        if (slides.length) onApply(slides, `${t('recipes.grammarName')} · ${name}`);
      } else if (set.kind === 'video') {
        const clip = findSetClip(set, await fetchVideoClips());
        const recipe = LESSON_RECIPES.find((r) => r.id === 'video');
        if (!clip || !recipe) {
          notify(t('recipes.setFailed'), 'error');
          return;
        }
        const slides = await recipe.build({
          ...common,
          hasWords,
          video: { source: clip.script, title: clip.title, videoUrl: `https://www.youtube.com/watch?v=${clip.youtube_id}`, clip },
        });
        if (slides.length) onApply(slides, name);
      }
    } finally {
      setBusy(false);
    }
  }

  /** 팝송 수업: 우리가 쓴 소개·단어·문법·활동으로 슬라이드를 채운다(가사는 선생님이 붙여 넣은 때만, 그 수업 안에서만) */
  async function applySong(song: SongLesson, lyrics: string) {
    setBusy(true);
    try {
      const slides = await buildSongLesson(song, { makeWordList, makeUnscrambleFromSentences, makeGameFromWords }, lyrics);
      if (slides.length) onApply(slides, `${song.title} · ${song.artist}`);
      else notify(t('recipes.setFailed'), 'error');
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const autoDone = useRef<string | null>(null);
  useEffect(() => {
    if (!autoClip || autoDone.current === autoClip.id) return;
    const recipe = LESSON_RECIPES.find((r) => r.id === 'video');
    if (!recipe) return;
    autoDone.current = autoClip.id;
    setPicked(recipe);
    void apply(recipe, autoClip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoClip]);

  function choose(recipe: LessonRecipe) {
    if (recipe.needsWords && !hasWords) return;
    if (recipe.input) {
      setPicked(recipe);
      return;
    }
    void apply(recipe);
  }

  return (
    <div className="space-y-3 rounded-xl border-2 border-primary/20 bg-primary-fixed/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="material-symbols-outlined text-[22px] text-primary">restaurant_menu</span>
        <div className="font-title-md text-title-md font-bold text-deep-navy">{t('recipes.title')}</div>
        {open && <span className="font-caption text-caption text-on-surface-variant">{t('recipes.subtitle')}</span>}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
        >
          {open ? t('recipes.collapse') : t('recipes.expand')}
          <span className="material-symbols-outlined text-[18px]">{open ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>
      {open && (
      <>
      {!hasWords && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-warm-yellow/25 px-3 py-2 font-caption text-caption text-on-surface">
          <span className="material-symbols-outlined text-[18px]">info</span>
          {t('recipes.needWords')}
          <button type="button" onClick={() => onManageWordList('new')} className="rounded-full bg-primary px-3 py-1 font-label-md text-label-md text-on-primary">
            + {t('curriculum.wordListTools.newButton')}
          </button>
        </div>
      )}

      {(() => {
        const sample = LESSON_SETS.find((x) => x.kind === 'word');
        if (!sample) return null;
        return (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warm-yellow bg-warm-yellow/20 p-4">
            <span className="material-symbols-outlined text-[28px] text-deep-navy" aria-hidden>
              bolt
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-label-md text-label-md font-bold text-deep-navy">{t('recipes.sampleTitle')}</div>
              <div className="font-caption text-caption text-on-surface-variant">{t('recipes.sampleDesc')}</div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void applySet(sample)}
              className="min-h-12 rounded-full bg-primary px-5 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-50"
            >
              {t('recipes.sampleButton')}
            </button>
          </div>
        );
      })()}

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-label-md text-label-md font-bold text-deep-navy">{t('recipes.levelLabel')}</span>
          {LESSON_LEVELS.map((l) => (
            <button key={l.id} type="button" onClick={() => setLevel(l.id)} aria-pressed={level === l.id} className={videoTabChip(level === l.id)}>
              {i18n.language.startsWith('ko') ? l.ko : l.en}
            </button>
          ))}
        </div>
        <p className="font-caption text-caption text-on-surface-variant">{t(upper ? 'recipes.levelHintUpper' : 'recipes.levelHint')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab('sets')} className={videoTabChip(tab === 'sets')}>
          <span className="material-symbols-outlined text-[18px]">inventory_2</span>
          {t('recipes.setsTab')}
        </button>
        <button type="button" onClick={() => setTab('recipes')} className={videoTabChip(tab === 'recipes')}>
          <span className="material-symbols-outlined text-[18px]">tune</span>
          {t('recipes.recipesTab')}
        </button>
      </div>

      {tab === 'sets' && !picked && (
        <div className="space-y-4">
          <p className="font-caption text-caption text-on-surface-variant">{t('recipes.setsHint')}</p>
          {(upper ? (['song', 'grammar', 'word', 'video'] as const) : (['word', 'grammar', 'song', 'video'] as const)).map((kind) => (
            <div key={kind} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-label-md text-label-md font-bold text-deep-navy">{t(`recipes.setsGroup_${kind}`)}</div>
                {(kind === 'word' || kind === 'grammar') && (
                  <button
                    type="button"
                    aria-expanded={curOpen[kind]}
                    onClick={() => setCurOpen((o) => ({ ...o, [kind]: !o[kind] }))}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1 font-label-md text-label-md transition-colors ${curOpen[kind] ? 'border-primary bg-primary text-on-primary' : 'border-primary text-primary hover:bg-primary/10'}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{curOpen[kind] ? 'expand_less' : 'expand_more'}</span>
                    {t(curOpen[kind] ? `recipes.cur_collapse_${kind}` : `recipes.cur_expand_${kind}`)}
                  </button>
                )}
              </div>
              {kind === 'grammar' && curOpen.grammar && (
                <CurriculumGrammarSets
                  key={`g-${level}`}
                  initialSchool={level === 'all' ? 'elementary' : level}
                  disabled={busy}
                  onPick={(grammarId) => {
                    const p = GRAMMAR_POINTS.find((g) => g.id === grammarId);
                    if (!p) return;
                    // 교과과정 문법 항목 → 문법 수업 세트와 같은 방식으로 만든다
                    void applySet({ id: `cg-${p.id}`, kind: 'grammar', icon: 'rule', minutes: 30, ko: p.name, en: p.name, koDesc: p.explain, enDesc: p.explain, grammarId: p.id });
                  }}
                />
              )}
              {kind === 'word' && curOpen.word && (
                <CurriculumWordSets
                  key={`w-${level}`}
                  initialSchool={level === 'all' ? 'elementary' : level}
                  disabled={busy}
                  onBulk={makeBulkLists}
                  onPick={(title, entries) => void applyWordEntries(title, entries)}
                />
              )}
              {kind === 'song' ? (
                <SongLessonPicker
                  key={`s-${level}`}
                  songs={SONG_LESSONS.filter((s) => levelMatches(level, s.levels, ['middle']))}
                  busy={busy}
                  onBuild={(song, lyrics) => void applySong(song, lyrics)}
                />
              ) : level !== 'all' && LESSON_SETS.filter((s) => s.kind === kind && levelMatches(level, s.levels)).length === 0 ? (
                kind !== 'grammar' && <p className="font-caption text-caption text-on-surface-variant">{t('recipes.levelNoSets')}</p>
              ) : null}
              <div className={`grid gap-2 sm:grid-cols-2 xl:grid-cols-4 ${kind === 'song' ? 'hidden' : ''}`}>
                {LESSON_SETS.filter((s) => s.kind === kind && levelMatches(level, s.levels)).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void applySet(s)}
                    className="flex flex-col gap-1 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[22px] text-primary">{s.icon}</span>
                      <span className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-surface">{lessonSetName(s, i18n.language)}</span>
                      <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{t('recipes.minutes', { n: s.minutes })}</span>
                    </div>
                    <div className="font-caption text-caption text-on-surface-variant">{lessonSetDesc(s, i18n.language)}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'recipes' && !picked ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {LESSON_RECIPES.filter((r) => levelMatches(level, r.levels, ['elementary', 'middle', 'high'])).map((r) => {
            const locked = r.needsWords && !hasWords;
            return (
              <button
                key={r.id}
                type="button"
                disabled={locked || busy}
                onClick={() => choose(r)}
                className="flex flex-col gap-1.5 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[24px] text-primary">{r.icon}</span>
                  <span className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-surface">{t(`recipes.${r.id}Name`)}</span>
                  <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">
                    {t('recipes.minutes', { n: r.minutes })}
                  </span>
                </div>
                <div className="font-caption text-caption text-on-surface-variant">{t(`recipes.${r.id}Desc`)}</div>
                <div className="flex flex-wrap items-center gap-0.5 text-on-surface-variant">
                  {r.preview.map((ic, i) => (
                    <span key={i} className="flex items-center">
                      {i > 0 && <span className="material-symbols-outlined text-[12px] opacity-50">chevron_right</span>}
                      <span className="material-symbols-outlined text-[16px]">{ic}</span>
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      ) : picked ? (
        <div className="space-y-3 rounded-xl bg-surface-container-lowest p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">{picked.icon}</span>
            <span className="flex-1 font-label-md text-label-md font-bold">{t(`recipes.${picked.id}Name`)}</span>
            <button type="button" onClick={() => setPicked(null)} className="font-label-md text-label-md text-on-surface-variant hover:text-primary">
              {t('recipes.back')}
            </button>
          </div>
          {picked.input === 'grammar' && (
            <>
              {grammarId ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-fixed/40 px-3 py-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">rule</span>
                  <span className="font-label-md text-label-md">{grammarPoint(grammarId)?.name}</span>
                  <button type="button" onClick={() => setGrammarId(null)} className="ml-auto font-caption text-caption text-on-surface-variant hover:text-primary">
                    {t('recipes.changeGrammar')}
                  </button>
                </div>
              ) : (
                <GrammarPickerPanel onPick={setGrammarId} />
              )}
            </>
          )}
          {picked.input === 'video' && hasWords && (
            <div className="space-y-1.5 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
              <div className="font-label-md text-label-md text-on-surface">{t('recipes.wordListChoiceTitle')}</div>
              <label className="flex cursor-pointer items-start gap-2 font-body-md text-body-md text-on-surface">
                <input type="radio" name="video-wordlist" checked={!keepMyList} onChange={() => setKeepMyList(false)} className="mt-1 h-4 w-4 accent-primary" />
                <span>{t('recipes.wordListChoiceVideo')}</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 font-body-md text-body-md text-on-surface">
                <input type="radio" name="video-wordlist" checked={keepMyList} onChange={() => setKeepMyList(true)} className="mt-1 h-4 w-4 accent-primary" />
                <span>{t('recipes.wordListChoiceMine', { name: wordListName || t('curriculum.slides.lessonWordList') })}</span>
              </label>
              <p className="font-caption text-caption text-on-surface-variant">{t(keepMyList ? 'recipes.wordListChoiceMineHint' : 'recipes.wordListChoiceVideoHint')}</p>
            </div>
          )}
          {picked.input === 'video' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setVideoTab('library')} className={videoTabChip(videoTab === 'library')}>
                  <span className="material-symbols-outlined text-[18px]">video_library</span>
                  {t('videoLibrary.tabLibrary')}
                </button>
                <button type="button" onClick={() => setVideoTab('own')} className={videoTabChip(videoTab === 'own')}>
                  <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  {t('videoLibrary.tabOwn')}
                </button>
              </div>
              {videoTab === 'library' && <VideoClipLibrary pickLabel={t('recipes.videoUseClip')} onPick={(clip) => void apply(picked, clip)} />}
            </div>
          )}
          {picked.input === 'video' && videoTab === 'own' && (
            <div className="space-y-2">
              <p className="font-caption text-caption text-on-surface-variant">{t('recipes.videoHint')}</p>
              <input
                value={video.title}
                onChange={(e) => setVideo((r) => ({ ...r, title: e.target.value }))}
                placeholder={t('curriculum.shadow.titlePlaceholder')}
                className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={video.videoUrl}
                onChange={(e) => setVideo((r) => ({ ...r, videoUrl: e.target.value }))}
                placeholder={t('curriculum.shadow.videoPlaceholder')}
                className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <textarea
                value={video.source}
                onChange={(e) => setVideo((r) => ({ ...r, source: e.target.value }))}
                onPaste={(e) => {
                  if (video.source.trim()) return;
                  const text = e.clipboardData.getData('text');
                  const converted = toShadowSource(text);
                  if (converted !== text.trim()) {
                    e.preventDefault();
                    setVideo((r) => ({ ...r, source: converted }));
                  }
                }}
                rows={7}
                placeholder={t('curriculum.shadow.sourcePlaceholder')}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={scripting || !extractYoutubeId(video.videoUrl)}
                  onClick={async () => {
                    const id = extractYoutubeId(video.videoUrl);
                    if (!id) return;
                    setScripting(true);
                    try {
                      const script = await generateShadowScript(id, video.source);
                      setVideo((r) => ({ ...r, source: script }));
                    } catch {
                      notify(t('curriculum.shadow.autoUnavailable'), 'error');
                    } finally {
                      setScripting(false);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-full border-2 border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-40"
                >
                  <span className={`material-symbols-outlined text-[18px] ${scripting ? 'animate-spin' : ''}`}>{scripting ? 'progress_activity' : 'auto_awesome'}</span>
                  {t('curriculum.shadow.autoButton')}
                </button>
                <span className="font-caption text-caption text-on-surface-variant">{t('curriculum.shadow.lineCount', { count: parseShadowText(video.source).length })}</span>
              </div>
            </div>
          )}
          {picked.input === 'reading' && (
            <div className="space-y-2">
              <p className="font-caption text-caption text-on-surface-variant">{t('recipes.readingHint')}</p>
              <input
                value={reading.title}
                onChange={(e) => setReading((r) => ({ ...r, title: e.target.value }))}
                placeholder={t('recipes.readingTitle')}
                className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={reading.videoUrl}
                onChange={(e) => setReading((r) => ({ ...r, videoUrl: e.target.value }))}
                placeholder={t('recipes.readingVideo')}
                className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <textarea
                value={reading.source}
                onChange={(e) => setReading((r) => ({ ...r, source: e.target.value }))}
                rows={6}
                placeholder={t('recipes.readingSource')}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
            </div>
          )}
          {busy && picked.input === 'video' && videoTab === 'library' && <div className="font-caption text-caption text-on-surface-variant">{t('common.loading')}</div>}
          {!(picked.input === 'video' && videoTab === 'library') && <button
            type="button"
            disabled={busy || (picked.input === 'grammar' && !grammarId) || (picked.input === 'reading' && !reading.source.trim()) || (picked.input === 'video' && (!video.source.trim() || !extractYoutubeId(video.videoUrl)))}
            onClick={() => void apply(picked)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            {busy ? t('common.loading') : t('recipes.apply')}
          </button>}
        </div>
      ) : null}
      </>
      )}
    </div>
  );
}
