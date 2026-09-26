import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadPhonicsBank } from '../lib/phonicsFill';
import { loadWordBank } from '../lib/wordBankCache';
import { pickRecommended, toCard, topicEntries, TOPIC_TITLES } from '../lib/topicWorksheets';
import { isIdiomEntry, WORD_BANK_CATEGORIES } from '../lib/wordBankCategories';
import type { FullCardItem, PhonicsBankEntry, PhonicsSlideOptions, WordBankEntry } from '../lib/types';
import PhonicsMarkedWord from './PhonicsMarkedWord';

/**
 * 수업 자료실 슬라이드의 "단어는 어디서?" 고르기(2026-09-27).
 * - 수업 단어장(기본)
 * - 주제에서 고르기: 사전 카테고리(동물·음식 …) → 추천 단어(그림·선화 있는 단어 먼저, 주제별 워크시트 라이브러리와 같은 규칙)
 * - 파닉스 단계에서 고르기: 단계 → 소리 규칙 → 골고루 섞어 추천
 * 고른 단어는 슬라이드에 그대로 저장한다(MaterialSlide.words) — 발표 때 다시 고르지 않게.
 */


const chip = (on: boolean) =>
  `rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
    on ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-secondary-container/40'
  }`;

export type WordSource = 'lesson' | 'topic' | 'phonics';

/** 단어 출처 칩 + 고른 출처의 고르기 화면. */
export function WordSourcePicker({
  kind,
  lessonCount,
  words,
  topic,
  onChange,
}: {
  /** 'topic' = 일반 워크시트(사전 주제), 'phonics' = 파닉스 워크시트(파닉스 단계) */
  kind: 'topic' | 'phonics';
  lessonCount: number;
  words: FullCardItem[] | undefined;
  topic?: string;
  onChange: (next: { words?: FullCardItem[]; topic?: string }) => void;
}) {
  const { t } = useTranslation();
  const own = !!words && words.length > 0;
  const [source, setSource] = useState<WordSource>(own ? kind : 'lesson');
  useEffect(() => {
    setSource(own ? kind : 'lesson');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own]);

  return (
    <div className="space-y-2 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
      <div className="font-label-md text-label-md text-on-surface">{t('curriculum.wordSource.title')}</div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={chip(source === 'lesson')}
          onClick={() => {
            setSource('lesson');
            if (own) onChange({ words: undefined, topic: undefined });
          }}
        >
          {t('curriculum.wordSource.lesson', { count: lessonCount })}
        </button>
        <button type="button" className={chip(source === kind)} onClick={() => setSource(kind)}>
          {kind === 'topic' ? t('curriculum.wordSource.topic') : t('curriculum.wordSource.phonics')}
        </button>
      </div>
      {source === 'topic' && kind === 'topic' && <TopicWordsPicker words={words} topic={topic} onChange={onChange} />}
      {source === 'phonics' && kind === 'phonics' && <PhonicsWordsPicker words={words} onChange={(w) => onChange({ words: w, topic: undefined })} />}
    </div>
  );
}

function WordChips({ words, onRemove }: { words: FullCardItem[]; onRemove?: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {words.map((w) => (
        <span key={w.id} className="flex items-center gap-1 rounded-full bg-surface-container-lowest py-1 pl-3 pr-1.5 font-label-md text-label-md text-on-surface shadow-sm">
          {w.patternMarked ? <PhonicsMarkedWord pattern={w.patternMarked} /> : w.word}
          {onRemove && (
            <button type="button" onClick={() => onRemove(w.id)} className="flex h-5 w-5 items-center justify-center rounded-full text-on-surface-variant hover:bg-error/10 hover:text-error" aria-label="remove">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function CountSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-1.5 font-caption text-caption text-on-surface-variant">
      {t('curriculum.wordSource.count')}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 text-sm text-on-surface outline-none focus:border-primary"
      >
        {[4, 6, 8, 10, 12].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

function TopicWordsPicker({
  words,
  topic,
  onChange,
}: {
  words: FullCardItem[] | undefined;
  topic?: string;
  onChange: (next: { words?: FullCardItem[]; topic?: string }) => void;
}) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<WordBankEntry[] | null>(null);
  const [count, setCount] = useState(Math.max(4, words?.length || 8));
  const [seed, setSeed] = useState(1);
  useEffect(() => {
    void loadWordBank().then(setEntries);
  }, []);
  const wordEntries = useMemo(() => (entries ?? []).filter((e) => !isIdiomEntry(e)), [entries]);
  const topics = useMemo(
    () => WORD_BANK_CATEGORIES.map((name) => ({ name, total: topicEntries(wordEntries, name, 'all').length })).filter((tp) => tp.total >= 4),
    [wordEntries],
  );

  function pick(name: string, cnt: number, sd: number) {
    const chosen = pickRecommended(topicEntries(wordEntries, name, 'all'), cnt, sd).map(toCard);
    onChange({ words: chosen, topic: name });
  }

  if (!entries) return <div className="font-caption text-caption text-on-surface-variant">{t('common.loading')}</div>;
  return (
    <div className="space-y-2">
      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {topics.map((tp) => (
          <button key={tp.name} type="button" className={chip(topic === tp.name)} onClick={() => pick(tp.name, count, seed)}>
            {tp.name}
            <span className="ml-1 opacity-70">{TOPIC_TITLES[tp.name] ?? ''}</span>
          </button>
        ))}
      </div>
      {topic && (
        <div className="flex flex-wrap items-center gap-2">
          <CountSelect
            value={count}
            onChange={(n) => {
              setCount(n);
              pick(topic, n, seed);
            }}
          />
          <button
            type="button"
            onClick={() => {
              const next = seed + 1;
              setSeed(next);
              pick(topic, count, next);
            }}
            className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-[16px]">shuffle</span>
            {t('curriculum.wordSource.reroll')}
          </button>
        </div>
      )}
      {words && words.length > 0 && (
        <WordChips
          words={words}
          onRemove={words.length > 2 ? (id) => onChange({ words: words.filter((w) => w.id !== id), topic }) : undefined}
        />
      )}
    </div>
  );
}

function phonicsCard(e: PhonicsBankEntry): FullCardItem {
  return { id: e.id, word: e.word, meaning: e.meaning ?? '', imageUrl: e.image_url, category: e.rule, patternMarked: e.pattern_marked };
}

/** 소리 규칙을 골고루 섞어 추천(파닉스 워크시트 라이브러리와 같은 생각 — 한 규칙만 잔뜩 나오지 않게). */
function pickBalanced(entries: PhonicsBankEntry[], count: number, seed: number): PhonicsBankEntry[] {
  let x = seed * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280), x / 233280);
  const byRule = new Map<string, PhonicsBankEntry[]>();
  for (const e of entries) byRule.set(e.rule, [...(byRule.get(e.rule) ?? []), e]);
  const lists = [...byRule.values()].map((l) => [...l].sort(() => rnd() - 0.5));
  const out: PhonicsBankEntry[] = [];
  for (let i = 0; out.length < count && lists.some((l) => l.length > i); i++) {
    for (const l of lists) if (l[i] && out.length < count) out.push(l[i]);
  }
  return out;
}

function PhonicsWordsPicker({ words, onChange }: { words: FullCardItem[] | undefined; onChange: (words: FullCardItem[]) => void }) {
  const { t } = useTranslation();
  const [bank, setBank] = useState<PhonicsBankEntry[] | null>(null);
  const [step, setStep] = useState(1);
  const [rules, setRules] = useState<string[]>([]);
  const [count, setCount] = useState(Math.max(4, words?.length || 8));
  const [seed, setSeed] = useState(1);
  useEffect(() => {
    void loadPhonicsBank().then(setBank);
  }, []);
  const steps = useMemo(() => [...new Set((bank ?? []).map((e) => e.step))].sort((a, b) => a - b), [bank]);
  const stepEntries = useMemo(() => (bank ?? []).filter((e) => e.step === step), [bank, step]);
  const stepRules = useMemo(() => [...new Set(stepEntries.map((e) => e.rule))], [stepEntries]);

  function pick(nextRules: string[], cnt: number, sd: number, list = stepEntries) {
    const pool = nextRules.length === 0 ? list : list.filter((e) => nextRules.includes(e.rule));
    onChange(pickBalanced(pool, cnt, sd).map(phonicsCard));
  }

  if (!bank) return <div className="font-caption text-caption text-on-surface-variant">{t('common.loading')}</div>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {steps.map((s) => (
          <button
            key={s}
            type="button"
            className={chip(step === s)}
            onClick={() => {
              setStep(s);
              setRules([]);
              const list = bank.filter((e) => e.step === s);
              pick([], count, seed, list);
            }}
          >
            {t('curriculum.wordSource.phonicsStep', { step: s })}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {stepRules.map((r) => (
          <button
            key={r}
            type="button"
            className={chip(rules.includes(r))}
            onClick={() => {
              const next = rules.includes(r) ? rules.filter((x) => x !== r) : [...rules, r];
              setRules(next);
              pick(next, count, seed);
            }}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CountSelect
          value={count}
          onChange={(n) => {
            setCount(n);
            pick(rules, n, seed);
          }}
        />
        <button
          type="button"
          onClick={() => {
            const next = seed + 1;
            setSeed(next);
            pick(rules, count, next);
          }}
          className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
        >
          <span className="material-symbols-outlined text-[16px]">shuffle</span>
          {t('curriculum.wordSource.reroll')}
        </button>
      </div>
      {words && words.length > 0 && (
        <WordChips words={words} onRemove={words.length > 2 ? (id) => onChange(words.filter((w) => w.id !== id)) : undefined} />
      )}
    </div>
  );
}

/** 파닉스 워크시트 유형 이름(파닉스 워크시트 페이지와 같은 문구). */
export function phonicsTabLabel(tab: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    phonicsBlank: 'materials.worksheet.tabPhonicsBlank',
    phonicsCircle: 'materials.worksheet.tabPhonicsCircle',
    grouping: 'materials.phonicsLibrary.sortName',
    phonicsOdd: 'materials.worksheet.tabPhonicsOdd',
    phonicsRhyme: 'materials.worksheet.tabPhonicsRhyme',
    match: 'materials.worksheet.tabMatch',
    wordSearch: 'materials.worksheet.tabWordSearch',
    unscramble: 'materials.worksheet.tabUnscramble',
    phonicsReader: 'materials.worksheet.tabPhonicsReader',
    phonicsTracing: 'materials.worksheet.tabTracing',
    coloring: 'materials.worksheet.tabColoring',
    phonicsList: 'materials.worksheet.tabList',
  };
  return map[tab] ? t(map[tab]) : tab;
}

/** 파닉스 워크시트 슬라이드 옵션 체크박스(파닉스 워크시트 페이지의 옵션과 같은 뜻). */
export function PhonicsOptionsFields({ value, onChange }: { value: PhonicsSlideOptions; onChange: (next: PhonicsSlideOptions) => void }) {
  const { t } = useTranslation();
  const rows: [keyof PhonicsSlideOptions, string, boolean][] = [
    ['includeAnswers', t('materials.worksheet.includeAnswerPage'), value.includeAnswers ?? true],
    ['cuteColor', t('curriculum.wordSource.cuteColor'), value.cuteColor ?? true],
    ['showImage', t('curriculum.wordSource.showImage'), value.showImage ?? true],
    ['showMeaning', t('curriculum.wordSource.showMeaning'), value.showMeaning ?? false],
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {rows.map(([key, label, checked]) => (
        <label key={key} className="flex cursor-pointer items-center gap-2 font-label-md text-label-md text-on-surface-variant">
          <input type="checkbox" checked={checked} onChange={(e) => onChange({ ...value, [key]: e.target.checked })} className="h-4 w-4 rounded accent-primary" />
          {label}
        </label>
      ))}
    </div>
  );
}
