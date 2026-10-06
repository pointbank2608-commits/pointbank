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
import { useToast } from '../context/ToastContext';
import { generateShadowScript } from '../lib/api';
import { fetchVideoClips } from '../lib/videoClips';
import { parseShadowText, toShadowSource } from '../lib/shadowLines';
import { extractYoutubeId } from '../lib/youtube';

/**
 * 새 수업 만들기의 "레시피로 시작하기"(2026-09-27). 수업 종류를 고르면 슬라이드가 순서대로 채워진다.
 * 문법 레시피는 문법 항목을, 노래·지문 레시피는 원문을 먼저 받는다.
 */
export default function LessonRecipePicker({
  hasWords,
  onManageWordList,
  makeUnscramble,
  makeWordList,
  makeUnscrambleFromSentences,
  onApply,
  autoClip,
}: {
  hasWords: boolean;
  onManageWordList: (mode: 'new' | 'edit') => void;
  makeUnscramble: RecipeContext['makeUnscramble'];
  makeWordList?: RecipeContext['makeWordList'];
  makeUnscrambleFromSentences?: RecipeContext['makeUnscrambleFromSentences'];
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
  // 기본은 펼침, 접으면 제목 줄만 남아 화면을 덜 차지한다(2026-09-27 사용자 요청)
  const [open, setOpen] = useState(true);

  async function apply(recipe: LessonRecipe, clip?: VideoClip) {
    setBusy(true);
    try {
      const slides = await recipe.build({
        t,
        hasWords,
        grammarId: grammarId ?? undefined,
        reading: { source: reading.source, title: reading.title.trim() || undefined, videoUrl: reading.videoUrl.trim() || null },
        makeUnscramble,
        video: clip
          ? { source: clip.script, title: clip.title, videoUrl: `https://www.youtube.com/watch?v=${clip.youtube_id}`, clip }
          : { source: video.source, title: video.title.trim() || undefined, videoUrl: video.videoUrl.trim() },
        makeWordList,
        makeUnscrambleFromSentences,
      });
      if (slides.length === 0) return;
      const extra = recipe.id === 'grammar' && grammarId ? grammarPoint(grammarId)?.name : recipe.id === 'reading' ? reading.title.trim() : recipe.id === 'video' ? (clip ? `${clip.series} · ${clip.title}` : video.title.trim()) : '';
      onApply(slides, extra ? `${t(`recipes.${recipe.id}Name`)} · ${extra}` : t(`recipes.${recipe.id}Name`));
    } finally {
      setBusy(false);
    }
  }

  /** 수업 세트: 미리 만들어 둔 수업 — 단어 세트는 단어장을 같이 만들고, 문법·영상 세트는 해당 레시피에 내용을 끼워 넣는다. */
  async function applySet(set: LessonSet) {
    setBusy(true);
    try {
      const name = lessonSetName(set, i18n.language);
      const common = { t, makeUnscramble, makeWordList, makeUnscrambleFromSentences, reading: undefined, video: undefined };
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
          {(['word', 'grammar', 'video'] as const).map((kind) => (
            <div key={kind} className="space-y-2">
              <div className="font-label-md text-label-md font-bold text-deep-navy">{t(`recipes.setsGroup_${kind}`)}</div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {LESSON_SETS.filter((s) => s.kind === kind).map((s) => (
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
          {LESSON_RECIPES.map((r) => {
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
