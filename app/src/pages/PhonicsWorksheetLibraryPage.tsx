import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { PhonicsListCute, PhonicsTracingCute, ReaderCute, type ReaderImageMode } from '../components/worksheets/PhonicsCuteSheets';
import WorksheetSheets from '../components/worksheets/WorksheetSheets';
import { fetchPhonicsBank } from '../lib/api';
import { CVC_READERS, parseCustomReaders, readerCardFromBank, readerIdsForWords } from '../lib/cvcReaders';
import { handoffFromLocationState } from '../lib/materialsHandoff';
import { markedGroups, parsePattern } from '../lib/phonicsPattern';
import { worksheetSupport } from '../lib/topicWorksheets';
import {
  buildOddPages,
  buildRhymePages,
  buildWorksheet,
  chunk,
  DEFAULT_COLORING_OPTIONS,
  EMPTY_HINT_KEY,
  isWorksheetEmpty,
  makeRng,
  PHONICS_PER_PAGE,
  shuffled,
  type ColoringOptions,
  type NewWorksheetKind,
} from '../lib/worksheetGenerators';
import { PHONICS_STEPS } from '../lib/wordBankCategories';
import type { FullCardItem, PhonicsBankEntry } from '../lib/types';

const COUNT_OPTIONS = [6, 8, 10, 12];
const GRID_PAGE = 60;

function toCard(e: PhonicsBankEntry): FullCardItem {
  return { id: e.id, word: e.word, meaning: e.meaning ?? '', imageUrl: e.image_url, category: e.rule, patternMarked: e.pattern_marked };
}

/**
 * 소리 규칙을 골고루 섞어 추천한다: 규칙별로 묶어 그림 있는 단어를 앞세운 뒤 돌아가며 하나씩 뽑는다.
 * (한 규칙에 단어가 몰리면 "소리별 분류"·"다른 하나 찾기"가 안 나와서.) 같은 seed 면 같은 결과.
 */
function pickBalanced(entries: PhonicsBankEntry[], count: number, seed: number): PhonicsBankEntry[] {
  const rng = makeRng(seed);
  const byRule = new Map<string, PhonicsBankEntry[]>();
  const seenWord = new Set<string>();
  for (const e of shuffled(entries, rng)) {
    const key = `${e.rule}|${e.word.toLowerCase()}`;
    if (seenWord.has(key)) continue;
    seenWord.add(key);
    if (!byRule.has(e.rule)) byRule.set(e.rule, []);
    byRule.get(e.rule)!.push(e);
  }
  const lists = [...byRule.values()].map((l) => [...l].sort((a, b) => Number(!!b.image_url) - Number(!!a.image_url)));
  const out: PhonicsBankEntry[] = [];
  for (let i = 0; out.length < count; i++) {
    let added = false;
    for (const list of lists) {
      if (list[i] && out.length < count) {
        out.push(list[i]);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

function Pattern({ pattern }: { pattern: string }) {
  return (
    <span className="font-title-md text-lg font-bold text-deep-navy">
      {parsePattern(pattern).map((p, i) =>
        p.marked ? (
          <span key={i} className="rounded bg-warm-yellow px-0.5 font-extrabold">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

interface TypeCard {
  tab: string;
  icon: string;
  name: string;
  desc: string;
  /** 쓸 수 있는 개수(0 이면 막는다) */
  count: number;
  unit: 'words' | 'problems' | 'cards';
}

/** 파닉스 워크시트 페이지가 직접 그리는 유형(나머지는 WorksheetSheets 가 그린다). */
const OWN_TABS = ['phonicsList', 'phonicsTracing', 'phonicsReader'] as const;

function chip(active: boolean): string {
  return `rounded-full px-4 py-1.5 font-label-md text-label-md transition-colors ${
    active ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container-low'
  }`;
}

/**
 * 파닉스 워크시트 — 단계·소리 규칙을 고르고, 단어를 고치고, 워크시트를 골라 **이 페이지에서 바로** 미리보기·인쇄한다.
 * 일반 단어·숙어 워크시트(/materials/worksheet)와는 화면·코드를 나눠서 개발한다(파닉스 전용 유형, 귀여운 스타일 등).
 */
export default function PhonicsWorksheetLibraryPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [entries, setEntries] = useState<PhonicsBankEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1);
  const [rules, setRules] = useState<string[]>([]);
  const [count, setCount] = useState(8);
  const [seed, setSeed] = useState(1);
  const [chosen, setChosen] = useState<string[]>([]);
  const [gridLimit, setGridLimit] = useState(GRID_PAGE);

  // 워크시트 작업 영역
  const [tab, setTab] = useState<string | null>(null);
  const [sheetSeed, setSheetSeed] = useState(1);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [cuteColor, setCuteColor] = useState(true);
  const [showMeaning, setShowMeaning] = useState(false);
  const [showImage, setShowImage] = useState(true);
  const [coloringTitle, setColoringTitle] = useState('');
  // I Can Read 읽기 카드: 고른 카드 번호(CVC 67개), 직접 입력한 문장, 그림 칸 방식
  const [readerIds, setReaderIds] = useState<number[]>([]);
  const [customText, setCustomText] = useState('');
  const [readerImage, setReaderImage] = useState<ReaderImageMode>('draw');
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPhonicsBank()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const stepEntries = useMemo(() => (entries ?? []).filter((e) => e.step === step), [entries, step]);
  const stepRules = useMemo(() => {
    const seen: string[] = [];
    for (const e of stepEntries) if (!seen.includes(e.rule)) seen.push(e.rule);
    return seen;
  }, [stepEntries]);
  const candidates = useMemo(
    () => (rules.length === 0 ? stepEntries : stepEntries.filter((e) => rules.includes(e.rule))),
    [stepEntries, rules],
  );

  const byId = useMemo(() => new Map((entries ?? []).map((e) => [e.id, e])), [entries]);
  const chosenEntries = useMemo(() => chosen.map((id) => byId.get(id)).filter((e): e is PhonicsBankEntry => !!e), [chosen, byId]);
  const words = useMemo(() => chosenEntries.map(toCard), [chosenEntries]);

  function recommend(list: PhonicsBankEntry[], cnt: number, sd: number) {
    setChosen(pickBalanced(list, cnt, sd).map((e) => e.id));
    setGridLimit(GRID_PAGE);
  }

  // 단계를 고르면 그 단계의 첫 두 소리 규칙을 기본으로 켜고 추천 단어를 뽑는다(규칙 2~3개가 분류·다른 하나 찾기에 알맞다).
  function selectStep(s: number) {
    if (!entries) return;
    const inStep = entries.filter((e) => e.step === s);
    const firstRules: string[] = [];
    for (const e of inStep) if (!firstRules.includes(e.rule) && firstRules.length < 2) firstRules.push(e.rule);
    setStep(s);
    setRules(firstRules);
    setSeed(1);
    recommend(inStep.filter((e) => firstRules.includes(e.rule)), count, 1);
  }

  // 데이터가 처음 올 때: 파닉스 선택 바에서 넘어왔으면 그 단어로, 아니면 1단계 추천으로 시작한다.
  useEffect(() => {
    if (!entries || chosen.length > 0 || rules.length > 0) return;
    const ids = handoffFromLocationState(location.state).phonicsWordIds ?? [];
    const picked = ids.map((id) => entries.find((e) => e.id === id)).filter((e): e is PhonicsBankEntry => !!e);
    if (picked.length > 0) {
      setStep(picked[0].step);
      setRules([...new Set(picked.map((e) => e.rule))]);
      setChosen(picked.map((e) => e.id));
    } else {
      selectStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  // 단계가 바뀌면 색칠 제목 기본값도 따라간다(직접 고친 뒤에는 건드리지 않는다).
  useEffect(() => {
    setColoringTitle((prev) => (prev === '' || /^Phonics \d$/.test(prev) ? `Phonics ${step}` : prev));
  }, [step]);

  function toggleRule(rule: string) {
    const next = rules.includes(rule) ? rules.filter((r) => r !== rule) : [...rules, rule];
    setRules(next);
    recommend(next.length === 0 ? stepEntries : stepEntries.filter((e) => next.includes(e.rule)), count, seed);
  }

  function changeCount(cnt: number) {
    setCount(cnt);
    recommend(candidates, cnt, seed);
  }

  function reroll() {
    const next = seed + 1;
    setSeed(next);
    recommend(candidates, count, next);
  }

  function toggleWord(id: string) {
    setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const support = useMemo(() => worksheetSupport(words), [words]);
  const cards: TypeCard[] = useMemo(() => {
    const withPattern = words.filter((w) => markedGroups(w.patternMarked).length > 0).length;
    const ruleSet = new Set(words.map((w) => w.category).filter(Boolean));
    const odd = buildOddPages(words, makeRng(1)).flat().length;
    const rhyme = buildRhymePages(words, makeRng(1)).reduce((n, p) => n + p.left.length, 0);
    const name = (key: string) => t(`materials.worksheet.${key}`);
    const desc = (key: string) => t(`materials.phonicsLibrary.desc.${key}`);
    return [
      { tab: 'phonicsBlank', icon: 'edit', name: name('tabPhonicsBlank'), desc: desc('blank'), count: withPattern, unit: 'words' },
      { tab: 'phonicsCircle', icon: 'radio_button_checked', name: name('tabPhonicsCircle'), desc: desc('circle'), count: withPattern, unit: 'words' },
      { tab: 'grouping', icon: 'category', name: t('materials.phonicsLibrary.sortName'), desc: desc('sort'), count: ruleSet.size >= 2 ? words.length : 0, unit: 'words' },
      { tab: 'phonicsOdd', icon: 'filter_alt', name: name('tabPhonicsOdd'), desc: desc('odd'), count: odd, unit: 'problems' },
      { tab: 'phonicsRhyme', icon: 'music_note', name: name('tabPhonicsRhyme'), desc: desc('rhyme'), count: rhyme, unit: 'problems' },
      { tab: 'match', icon: 'link', name: name('tabMatch'), desc: desc('match'), count: support.match, unit: 'words' },
      { tab: 'wordSearch', icon: 'search', name: name('tabWordSearch'), desc: desc('wordSearch'), count: support.wordSearch, unit: 'words' },
      { tab: 'unscramble', icon: 'shuffle', name: name('tabUnscramble'), desc: desc('unscramble'), count: support.unscramble, unit: 'words' },
      { tab: 'phonicsReader', icon: 'menu_book', name: name('tabPhonicsReader'), desc: desc('reader'), count: CVC_READERS.length, unit: 'cards' },
      { tab: 'phonicsTracing', icon: 'draw', name: name('tabTracing'), desc: desc('tracing'), count: words.length, unit: 'words' },
      { tab: 'coloring', icon: 'palette', name: name('tabColoring'), desc: desc('coloring'), count: support.coloring, unit: 'words' },
      { tab: 'phonicsList', icon: 'list_alt', name: name('tabList'), desc: desc('list'), count: words.length, unit: 'words' },
    ];
  }, [words, support, t]);

  function openTab(next: string) {
    if (next === 'phonicsReader' && readerIds.length === 0) {
      // 고른 파닉스 단어 중 읽기 카드가 있는 것으로 시작하고, 없으면 -at 가족 앞 4장으로 시작한다.
      const fromWords = readerIdsForWords(words.map((w) => w.word));
      setReaderIds(fromWords.length > 0 ? fromWords : [1, 2, 3, 4]);
    }
    setTab(next);
    setSheetSeed(1);
    // 작업 영역으로 부드럽게 내려간다.
    setTimeout(() => workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  const coloring: ColoringOptions = useMemo(
    () => ({ ...DEFAULT_COLORING_OPTIONS, title: coloringTitle || `Phonics ${step}` }),
    [coloringTitle, step],
  );
  const isOwn = (OWN_TABS as readonly string[]).includes(tab ?? '');
  const generated = useMemo(
    () => (tab && !isOwn ? buildWorksheet(tab as NewWorksheetKind, words, sheetSeed, { coloring }) : null),
    [tab, isOwn, words, sheetSeed, coloring],
  );
  const readerCards = useMemo(
    () => [
      ...CVC_READERS.filter((r) => readerIds.includes(r.n)).map(readerCardFromBank),
      ...parseCustomReaders(customText),
    ],
    [readerIds, customText],
  );
  const hasWork = !!tab && (tab === 'phonicsReader' || words.length > 0);
  const canPreview = hasWork && (tab === 'phonicsReader' ? readerCards.length > 0 : isOwn ? true : generated ? !isWorksheetEmpty(generated) : false);
  // 그림 칸에 보여줄 파닉스 그림(단어가 사전에 있으면 그 그림, 없으면 규칙 이름으로 추정한 경로)
  const imageOf = (word: string | null): string | null => {
    if (!word) return null;
    const hit = (entries ?? []).find((e) => e.word.toLowerCase() === word.toLowerCase() && e.image_url);
    return hit?.image_url ?? `/phonics-images/${word.toLowerCase()}.webp`;
  };
  // 그림이 들어가면 한 줄이 높아져서 한 장에 들어가는 개수가 줄어든다.
  const listPerPage = showImage ? PHONICS_PER_PAGE.list : PHONICS_PER_PAGE.list + 2;
  const usesCute = tab === 'phonicsTracing' || tab === 'phonicsList' || (tab ?? '').startsWith('phonics');

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <Link
          to="/materials"
          className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary"
        >
          {t('materials.backToMaterials')}
        </Link>

        <div>
          <h2 className="mb-1.5 font-headline-lg-mobile text-headline-lg-mobile text-deep-navy md:font-headline-lg md:text-headline-lg">
            {t('materials.phonicsLibraryName')}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('materials.phonicsLibrary.subtitle')}</p>
        </div>

        {error && <div className="rounded-lg bg-error-container p-3 font-body-md text-on-error-container">{error}</div>}
        {!entries && !error && <div className="font-body-md text-on-surface-variant">{t('materials.phonicsLibrary.loading')}</div>}

        {entries && (
          <>
            <section className="space-y-4 rounded-xl bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div>
                <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('phonics.stepLabel')}</div>
                <div className="flex flex-wrap gap-2">
                  {PHONICS_STEPS.map((s) => (
                    <button key={s} type="button" onClick={() => selectStep(s)} className={chip(step === s)}>
                      {t('phonics.stepName', { step: s })}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('materials.phonicsLibrary.ruleHelp')}</div>
                <div className="flex flex-wrap gap-2">
                  {stepRules.map((r) => (
                    <button key={r} type="button" onClick={() => toggleRule(r)} aria-pressed={rules.includes(r)} className={chip(rules.includes(r))}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-label-md text-label-md text-on-surface">{t('materials.library.selectedCount', { count: chosen.length })}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
                    {t('materials.library.countLabel')}
                    <select
                      value={count}
                      onChange={(e) => changeCount(Number(e.target.value))}
                      className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-on-surface"
                    >
                      {COUNT_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {t('materials.library.countOption', { count: n })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={reroll}
                    className="inline-flex items-center gap-1 rounded-full border-2 border-primary px-4 py-1.5 font-label-md text-label-md text-primary transition-colors hover:bg-primary/10"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden>
                      shuffle
                    </span>
                    {t('materials.library.reroll')}
                  </button>
                  {chosen.length > 0 && (
                    <button type="button" onClick={() => setChosen([])} className="font-label-md text-label-md text-on-surface-variant hover:text-error">
                      {t('materials.library.clearAll')}
                    </button>
                  )}
                </div>
              </div>

              {/* 고른 단어: 흰 바탕에 진한 글씨로 — 소리 규칙 글자만 노랗게 강조한다. */}
              <div className="flex flex-wrap gap-1.5">
                {chosenEntries.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleWord(e.id)}
                    title={t('materials.library.removeWord', { word: e.word })}
                    className="inline-flex items-center gap-1 rounded-full border-2 border-primary/40 bg-surface px-3 py-1 hover:border-error"
                  >
                    <Pattern pattern={e.pattern_marked} />
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant" aria-hidden>
                      close
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-title-md text-title-md text-on-surface">{t('materials.library.typesTitle')}</h3>
              {words.length === 0 ? (
                <div className="font-body-md text-on-surface-variant">{t('materials.library.noWords')}</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cards.map((card) => {
                    const disabled = card.count === 0;
                    const active = tab === card.tab;
                    return (
                      <button
                        key={card.tab}
                        type="button"
                        disabled={disabled}
                        aria-pressed={active}
                        onClick={() => openTab(card.tab)}
                        className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none ${
                          active ? 'border-primary bg-primary-container/30' : 'border-outline-variant bg-surface-container-lowest hover:border-primary disabled:hover:border-outline-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined mt-0.5 text-3xl text-primary" aria-hidden>
                          {card.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-title-md text-title-md text-on-surface">{card.name}</span>
                          <span className="block font-body-sm text-body-sm text-on-surface-variant">{card.desc}</span>
                          <span className={`mt-1 block font-caption text-caption ${disabled ? 'text-error' : 'text-primary'}`}>
                            {disabled
                              ? t('materials.library.typeNone')
                              : t(card.unit === 'problems' ? 'materials.phonicsLibrary.typeReadyProblems' : card.unit === 'cards' ? 'materials.phonicsLibrary.typeReadyCards' : 'materials.library.typeReady', { count: card.count })}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-3 font-title-md text-title-md text-on-surface">{t('materials.phonicsLibrary.pickWordsTitle')}</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {candidates.slice(0, gridLimit).map((e) => {
                  const on = chosen.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleWord(e.id)}
                      aria-pressed={on}
                      className={`relative rounded-lg border-2 p-1.5 text-center transition-colors ${
                        on ? 'border-primary bg-primary-container/40' : 'border-outline-variant bg-surface-container-lowest hover:border-primary/50'
                      }`}
                    >
                      {e.image_url ? (
                        <img src={e.image_url} alt="" className="aspect-square w-full rounded-md bg-surface-container-low object-contain" />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center rounded-md bg-surface-container-low text-xl">🔤</div>
                      )}
                      <div className="mt-1 truncate">
                        <Pattern pattern={e.pattern_marked} />
                      </div>
                      {on && (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-on-primary">
                          <span className="material-symbols-outlined text-[14px]" aria-hidden>
                            check
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {candidates.length > gridLimit && (
                <button
                  type="button"
                  onClick={() => setGridLimit((n) => n + GRID_PAGE)}
                  className="mt-4 rounded-full border-2 border-primary px-5 py-2 font-label-md text-label-md text-primary hover:bg-primary/10"
                >
                  {t('materials.library.more', { count: candidates.length - gridLimit })}
                </button>
              )}
            </section>
          </>
        )}
      </div>

      {/* 작업 영역: 고른 워크시트의 옵션·미리보기·인쇄 */}
      <div ref={workspaceRef} className="scroll-mt-4">
        {hasWork && (
          <div className="no-print mb-4 space-y-3 rounded-xl bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
            <h3 className="font-title-md text-title-md text-deep-navy">
              {t('materials.phonicsLibrary.printTitle')} · {cards.find((c) => c.tab === tab)?.name}
            </h3>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-label-md text-label-md text-on-surface-variant">
              {!isOwn && (
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
                  {t('materials.worksheet.includeAnswerPage')}
                </label>
              )}
              {usesCute && (
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={cuteColor} onChange={(e) => setCuteColor(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
                  {t('materials.worksheet.cuteColorLabel')}
                </label>
              )}
              {isOwn && tab !== 'phonicsReader' && (
                <>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={showImage} onChange={(e) => setShowImage(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
                    {t('materials.phonicsLibrary.optImage')}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={showMeaning} onChange={(e) => setShowMeaning(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
                    {t('materials.phonicsLibrary.optMeaning')}
                  </label>
                </>
              )}
              {tab === 'coloring' && (
                <label className="flex items-center gap-2">
                  {t('materials.worksheet.coloringTitleLabel')}
                  <input
                    value={coloringTitle}
                    onChange={(e) => setColoringTitle(e.target.value)}
                    maxLength={40}
                    className="w-48 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 font-body-md text-body-md text-on-surface"
                  />
                </label>
              )}
              {!isOwn && (
                <button
                  type="button"
                  onClick={() => setSheetSeed((n) => n + 1)}
                  className="inline-flex items-center gap-1 rounded-full border-2 border-primary px-4 py-1.5 text-primary transition-colors hover:bg-primary/10"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden>
                    shuffle
                  </span>
                  {t('materials.worksheet.reshuffle')}
                </button>
              )}
            </div>
            {tab === 'phonicsReader' && (
              <div className="space-y-4 rounded-lg border border-outline-variant/50 p-3">
                <div className="flex flex-wrap items-center gap-2 font-label-md text-label-md text-on-surface-variant">
                  <span>{t('materials.phonicsLibrary.readerImageLabel')}</span>
                  {(['draw', 'clay', 'none'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setReaderImage(m)} aria-pressed={readerImage === m} className={chip(readerImage === m)}>
                      {t(`materials.phonicsLibrary.readerImage_${m}`)}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <span className="font-label-md text-label-md text-on-surface">
                      {t('materials.phonicsLibrary.readerPickTitle', { count: readerIds.length })}
                    </span>
                    <button type="button" onClick={() => setReaderIds(CVC_READERS.map((r) => r.n))} className="font-label-md text-label-md text-primary hover:underline">
                      {t('materials.phonicsLibrary.readerSelectAll')}
                    </button>
                    <button type="button" onClick={() => setReaderIds([])} className="font-label-md text-label-md text-on-surface-variant hover:text-error">
                      {t('materials.library.clearAll')}
                    </button>
                  </div>
                  {[...new Set(CVC_READERS.map((r) => r.vowel))].map((vowel) => (
                    <div key={vowel} className="mb-2">
                      <div className="mb-1 font-caption text-caption text-on-surface-variant">{vowel}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {CVC_READERS.filter((r) => r.vowel === vowel).map((r) => {
                          const on = readerIds.includes(r.n);
                          return (
                            <button
                              key={r.n}
                              type="button"
                              aria-pressed={on}
                              title={r.sentence}
                              onClick={() => setReaderIds((prev) => (prev.includes(r.n) ? prev.filter((x) => x !== r.n) : [...prev, r.n]))}
                              className={`rounded-full px-3 py-1 font-label-md text-label-md transition-colors ${
                                on ? 'bg-primary text-on-primary' : 'border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                              }`}
                            >
                              {r.word}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <label className="block font-label-md text-label-md text-on-surface-variant">
                  {t('materials.phonicsLibrary.readerCustomLabel')}
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    rows={3}
                    placeholder={t('materials.phonicsLibrary.readerCustomPlaceholder')}
                    className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md text-on-surface"
                  />
                  <span className="font-caption text-caption">{t('materials.phonicsLibrary.readerCustomHint')}</span>
                </label>
              </div>
            )}
            {canPreview ? (
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container"
              >
                {t('materials.printButton')}
              </button>
            ) : (
              <div className="font-body-md text-body-md text-on-surface-variant">
                {generated ? t(`materials.worksheet.${EMPTY_HINT_KEY[generated.kind]}`) : t('materials.worksheet.needAtLeastOne')}
              </div>
            )}
          </div>
        )}
        {!hasWork && words.length > 0 && <div className="no-print font-body-md text-on-surface-variant">{t('materials.phonicsLibrary.pickTypeHint')}</div>}

        {canPreview && (
          <div className="print-sheet mx-auto">
            {generated && <WorksheetSheets data={generated} includeAnswers={includeAnswers} cuteColor={cuteColor} />}
            {tab === 'phonicsReader' &&
              chunk(readerCards, PHONICS_PER_PAGE.reader).map((rows, i) => (
                <ReaderCute
                  key={i}
                  cards={rows}
                  color={cuteColor}
                  startIndex={i * PHONICS_PER_PAGE.reader}
                  imageMode={readerImage}
                  imageOf={imageOf}
                />
              ))}
            {tab === 'phonicsList' &&
              chunk(words, listPerPage).map((rows, i) => (
                <PhonicsListCute key={i} rows={rows} color={cuteColor} startIndex={i * listPerPage} showImage={showImage} showMeaning={showMeaning} />
              ))}
            {tab === 'phonicsTracing' &&
              chunk(words, PHONICS_PER_PAGE.tracing).map((rows, i) => (
                <PhonicsTracingCute key={i} rows={rows} color={cuteColor} startIndex={i * PHONICS_PER_PAGE.tracing} showImage={showImage} showMeaning={showMeaning} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
