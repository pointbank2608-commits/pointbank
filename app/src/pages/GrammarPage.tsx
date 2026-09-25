import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BoardThemeChips } from '../components/CanvasSlideEditor';
import ClassChipRow from '../components/ClassChipRow';
import GrammarBoard from '../components/GrammarBoard';
import GrammarExplainCard from '../components/GrammarExplainCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createGameTemplate } from '../lib/api';
import { wordListToCards } from '../lib/gameFromWords';
import {
  buildWordListSentences,
  cardUsableForGrammar,
  GRAMMAR_LEVELS_BY_STAGE,
  GRAMMAR_POINTS,
  GRAMMAR_STAGES,
  grammarLevelTag,
  type GrammarStage,
  parseMarked,
  sentencesForUnscramble,
  useGrammarCards,
  type GrammarPoint,
} from '../lib/grammar';
import { speak } from '../lib/speech';
import { useMaterialsWordLists } from '../lib/useMaterialsWordLists';

/**
 * 문법(/grammar) — 초등 영문법 43개를 Language Level 1~4 로 정리해 두고, 고르면 칠판 화면으로
 * 문장 틀·예문을 보여주고 읽어준다. 수업 단어장 낱말로 예문을 바꿔 보거나, 예문으로 문장 배열하기
 * 게임을 바로 만들 수 있다. 커리큘럼 "문법" 슬라이드와 같은 GrammarBoard 를 쓴다.
 */
export default function GrammarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { academy, profile } = useAuth();
  const { notify } = useToast();
  const { classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading } = useMaterialsWordLists();

  const [stage, setStage] = useState<GrammarStage>('elementary');
  const [level, setLevel] = useState<number | null>(null);
  const levels = GRAMMAR_LEVELS_BY_STAGE[stage];
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(GRAMMAR_POINTS[0].id);
  const [themeId, setThemeId] = useState<string | null>('green');
  const [wordListId, setWordListId] = useState('');
  const [seed, setSeed] = useState(0);
  const [showMine, setShowMine] = useState(true);
  const [big, setBig] = useState(false);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GRAMMAR_POINTS.filter(
      (g) =>
        g.stage === stage &&
        (level === null || g.level === level) &&
        (!q || g.name.toLowerCase().includes(q) || g.pattern.toLowerCase().includes(q) || g.explain.includes(q)),
    );
  }, [stage, level, query]);

  const point = GRAMMAR_POINTS.find((g) => g.id === selectedId) ?? GRAMMAR_POINTS[0];
  const wordList = wordLists.find((wl) => wl.id === wordListId) ?? null;
  const rawCards = useMemo(() => wordListToCards(wordList), [wordList]);
  // 품사 저장 전에 만든 단어장도 쓸 수 있게 사전에서 품사·카테고리를 채운다.
  const cards = useGrammarCards(rawCards);
  const generated = useMemo(() => buildWordListSentences(point, cards, 6, seed), [point, cards, seed]);
  const usableCount = cards.filter(cardUsableForGrammar).length;

  async function openUnscramble() {
    if (!academy?.id || !profile || !staffClassId || creating) return;
    const sentences = sentencesForUnscramble(point, showMine ? generated : []);
    if (sentences.length === 0) {
      notify(t('grammar.noSentencesForGame'), 'error');
      return;
    }
    setCreating(true);
    try {
      const tpl = await createGameTemplate({
        academyId: academy.id,
        classId: staffClassId,
        gameType: 'unscramble',
        name: t('grammar.gameTemplateName', { name: point.name }),
        items: sentences.map((label) => ({ id: crypto.randomUUID(), label })),
        teacherId: profile.id,
      });
      navigate('/games/unscramble', { state: { openTemplateId: tpl.id } });
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setCreating(false);
    }
  }

  const extra = showMine ? generated : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy md:font-headline-lg md:text-headline-lg">
          {t('grammar.title')}
        </h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{t('grammar.subtitle')}</p>
      </div>

      <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-2xl bg-surface-container-low p-1">
        {GRAMMAR_STAGES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => {
              setStage(st);
              setLevel(null);
              const first = GRAMMAR_POINTS.find((g) => g.stage === st);
              if (first) setSelectedId(first.id);
            }}
            className={`rounded-full px-5 py-2 font-label-md text-label-md transition-colors ${
              stage === st ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            {t(`grammar.stage_${st}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {levels.length > 1 && (
        <>
        <LevelChip active={level === null} onClick={() => setLevel(null)} label={t('grammar.levelAll')} />
        {levels.map((lv) => (
          <LevelChip
            key={lv}
            active={level === lv}
            onClick={() => setLevel(lv)}
            label={stage === 'elementary' ? `Lv.${lv} ${t(`grammar.level${lv}`)}` : t(`grammar.level${lv}`)}
          />
        ))}
        </>
        )}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('grammar.searchPlaceholder')}
          className="ml-auto w-56 max-w-full rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* 문법 목록 */}
        <div className="flex shrink-0 flex-col gap-4 lg:max-h-[calc(100vh-220px)] lg:w-80 lg:overflow-y-auto lg:pr-1">
          {levels.filter((lv) => filtered.some((g) => g.level === lv)).map((lv) => (
            <div key={lv}>
              <div className="mb-1.5 font-label-md text-label-md text-on-surface-variant">
                {stage === 'elementary' ? `Lv.${lv} · ${t(`grammar.level${lv}`)}` : t(`grammar.level${lv}`)}{' '}
                <span className="font-caption text-caption">{t(`grammar.level${lv}Hint`)}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {filtered
                  .filter((g) => g.level === lv)
                  .map((g) => (
                    <GrammarListItem key={g.id} point={g} active={g.id === point.id} onClick={() => setSelectedId(g.id)} />
                  ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">{t('grammar.noResults')}</p>}
        </div>

        {/* 선택한 문법 */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="aspect-video w-full">
            <GrammarBoard key={`${point.id}:${seed}:${extra.length}`} point={point} extra={extra} themeId={themeId} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBig(true)}
              className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">fullscreen</span>
              {t('grammar.showBig')}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => void openUnscramble()}
              className="flex items-center gap-1.5 rounded-full border-2 border-primary px-5 py-2 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">reorder</span>
              {creating ? t('grammar.creatingGame') : t('grammar.toUnscramble')}
            </button>
          </div>
          <div className="space-y-1.5 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
            <div className="font-label-md text-label-md text-on-surface">{t('grammar.boardTitle')}</div>
            <BoardThemeChips value={themeId} onChange={(th) => setThemeId(th?.id ?? 'green')} />
          </div>

          <GrammarExplainCard point={point} />

          <div className="space-y-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
            <div className="font-label-md text-label-md text-on-surface">{t('grammar.examplesTitle')}</div>
            <ul className="space-y-1">
              {point.examples.map((ex, i) => (
                <li key={i} className="flex items-center gap-2 font-body-md text-body-md text-on-surface">
                  <button
                    type="button"
                    onClick={() => speak(ex.replace(/\*\*/g, ''))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                    aria-label={t('grammar.read')}
                  >
                    <span className="material-symbols-outlined text-[20px]">volume_up</span>
                  </button>
                  <span>
                    {parseMarked(ex).map((seg, k) => (
                      <span key={k} className={seg.strong ? 'font-bold text-primary' : ''}>
                        {seg.text}
                      </span>
                    ))}
                    {point.translations?.[i] && (
                      <span className="block font-caption text-caption text-on-surface-variant">{point.translations[i]}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
            <div className="font-label-md text-label-md text-on-surface">{t('grammar.wordListTitle')}</div>
            {!point.slots ? (
              <p className="font-caption text-caption text-on-surface-variant">{t('grammar.noSlots')}</p>
            ) : (
              <>
                <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={wordListId}
                    onChange={(e) => setWordListId(e.target.value)}
                    className="w-64 max-w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                  >
                    <option value="">{wordListsLoading ? t('common.loading') : t('grammar.pickWordList')}</option>
                    {wordLists.map((wl) => (
                      <option key={wl.id} value={wl.id}>
                        {wl.name} ({wl.items.length})
                      </option>
                    ))}
                  </select>
                  {generated.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSeed((s) => s + 1)}
                      className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-[18px]">shuffle</span>
                      {t('grammar.reshuffle')}
                    </button>
                  )}
                  <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface">
                    <input type="checkbox" checked={showMine} onChange={(e) => setShowMine(e.target.checked)} className="h-4 w-4 accent-primary" />
                    {t('grammar.showOnBoard')}
                  </label>
                </div>
                {wordList && generated.length === 0 && (
                  <p className="font-caption text-caption text-on-surface-variant">
                    {usableCount === 0 ? t('grammar.noUsableWords') : t('grammar.noMatchingWords')}
                  </p>
                )}
                {generated.length > 0 && (
                  <ul className="space-y-1">
                    {generated.map((g, i) => (
                      <li key={i} className="flex items-center gap-2 font-body-md text-body-md text-on-surface">
                        <button
                          type="button"
                          onClick={() => speak(g.text)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                          aria-label={t('grammar.read')}
                        >
                          <span className="material-symbols-outlined text-[20px]">volume_up</span>
                        </button>
                        <span>
                          {parseMarked(g.marked).map((seg, k) => (
                            <span key={k} className={seg.strong ? 'font-bold text-secondary underline decoration-dotted underline-offset-4' : ''}>
                              {seg.text}
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="font-caption text-caption text-on-surface-variant">{t('grammar.wordListHint')}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {big && (
        <div className="fixed inset-0 z-50 flex flex-col bg-inverse-surface/95 p-3 sm:p-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setBig(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-inverse-on-surface hover:bg-inverse-on-surface/10"
              aria-label={t('common.cancel')}
            >
              <span className="material-symbols-outlined text-[26px]">close</span>
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <GrammarBoard point={point} extra={extra} themeId={themeId} />
          </div>
        </div>
      )}
    </div>
  );
}

function LevelChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 font-label-md text-label-md transition-colors ${
        active ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant shadow-sm hover:bg-secondary-container/40'
      }`}
    >
      {label}
    </button>
  );
}

function GrammarListItem({ point, active, onClick }: { point: GrammarPoint; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
        active ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/50 bg-surface-container-lowest text-on-surface hover:border-primary/60'
      }`}
    >
      <div className="font-label-md text-label-md">{point.name}</div>
      <div className={`font-caption text-caption ${active ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
        {grammarLevelTag(point)} · {point.pattern.replace(/\*\*/g, '')}
      </div>
    </button>
  );
}

