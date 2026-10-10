import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { grammarLevelTag } from '../../lib/grammar';
import { LESSON_SETS, pickSetWords } from '../../lib/lessonSets';
import { buildSoloScenarioLesson, SOLO_SCENARIOS } from '../../lib/soloScenarios';
import {
  buildSoloDayLessons,
  buildSoloGrammarLesson,
  buildSoloRainbowLesson,
  buildSoloSongLesson,
  buildSoloWordSteps,
  songTimedLineCount,
  SOLO_GRAMMAR_POINTS,
  type SoloStep,
  type SoloWordStyle,
} from '../../lib/soloLessons';
import { parseShadowText } from '../../lib/shadowLines';
import { loadWordBank } from '../../lib/wordBankCache';
import { extractYoutubeId } from '../../lib/youtube';

/**
 * 새 개별수업 만들기 — 세 갈래로 시작한다(2026-10-11 정돈).
 *  ① 목적별(단어·문법·말하기·무지개 문법·노래) ② 주제별(동물·음식·몸 … 단어와 대화를 주제로 묶음) ③ 처음부터 직접 만들기.
 * 위쪽 검색은 모든 수업을 한 번에 찾는다. 만들어진 수업은 이 반 것이 되고, "고치기"에서 단계를 마음대로 바꿀 수 있다.
 */
export type BatchLesson = { name: string; steps: SoloStep[]; minutes: number };

type View =
  | { id: 'home' }
  | { id: 'purposes' }
  | { id: 'purpose'; purpose: Purpose }
  | { id: 'topics' }
  | { id: 'scratch' };

type Purpose = 'word' | 'grammar' | 'talk' | 'rainbow' | 'video';

interface Entry {
  key: string;
  type: 'word' | 'talk' | 'grammar' | 'rainbow';
  icon: string;
  title: string;
  desc: string;
  minutes: number;
  /** 검색에 쓰는 글 */
  haystack: string;
  build: () => Promise<{ lessons: BatchLesson[]; level: string; source: string } | null>;
}

/** 주제 묶음 — 단어 수업(w-…)과 일상 대화(talk-…)를 한곳에 */
const TOPICS: { id: string; icon: string; refs: string[] }[] = [
  { id: 'animals', icon: 'pets', refs: ['w-farm', 'w-wild', 'w-sea'] },
  { id: 'food', icon: 'restaurant', refs: ['w-fruit', 'w-veg', 'w-snack', 'talk-market', 'talk-restaurant'] },
  { id: 'body', icon: 'face', refs: ['w-body', 'w-clothes', 'talk-doctor', 'talk-clothes'] },
  { id: 'people', icon: 'family_restroom', refs: ['w-family', 'w-feeling', 'talk-friend'] },
  { id: 'school', icon: 'school', refs: ['w-school', 'w-home'] },
  { id: 'nature', icon: 'partly_cloudy_day', refs: ['w-weather', 'w-color'] },
  { id: 'places', icon: 'signpost', refs: ['talk-directions'] },
  { id: 'action', icon: 'directions_run', refs: ['w-action'] },
];

const PURPOSES: { id: Purpose; icon: string }[] = [
  { id: 'word', icon: 'abc' },
  { id: 'grammar', icon: 'rule' },
  { id: 'talk', icon: 'forum' },
  { id: 'rainbow', icon: 'palette' },
  { id: 'video', icon: 'movie' },
];

export default function SoloCatalogModal({
  onClose,
  onBatch,
  onScratch,
}: {
  onClose: () => void;
  onBatch: (lessons: BatchLesson[], level: string, source: string) => Promise<void>;
  /** 빈 수업으로 시작(편집기가 바로 열린다) */
  onScratch: (name: string, withPaste: boolean) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const { notify } = useToast();
  const ko = i18n.language.startsWith('ko');
  const [view, setView] = useState<View>({ id: 'home' });
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  /* ---------- 수업 항목(검색·주제·목적이 같은 목록을 쓴다) ---------- */
  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    for (const set of LESSON_SETS.filter((s) => s.kind === 'word')) {
      const title = ko ? `${set.ko} 단어` : `${set.en} words`;
      list.push({
        key: set.id,
        type: 'word',
        icon: set.icon,
        title,
        desc: ko ? set.koDesc : set.enDesc,
        minutes: 15,
        haystack: `${set.ko} ${set.en} ${set.koDesc} ${set.enDesc}`,
        build: async () => {
          const words = pickSetWords(set, await loadWordBank());
          if (words.length < 4) return null;
          return { lessons: [{ name: title, steps: buildSoloWordSteps(title, words), minutes: 15 }], level: 'Level 1', source: set.id };
        },
      });
    }
    for (const sc of SOLO_SCENARIOS) {
      list.push({
        key: sc.id,
        type: 'talk',
        icon: sc.icon,
        title: ko ? sc.ko : sc.en,
        desc: ko ? sc.koDesc : sc.enDesc,
        minutes: 20,
        haystack: `${sc.ko} ${sc.en} ${sc.koDesc} ${sc.enDesc}`,
        build: async () => {
          const lesson = buildSoloScenarioLesson(sc, await loadWordBank(), i18n.language);
          if (!lesson) return null;
          return { lessons: [lesson], level: t('solo.talkLevel'), source: sc.id };
        },
      });
    }
    for (const k of ['speak', 'structure'] as const) {
      list.push({
        key: `rainbow-${k}`,
        type: 'rainbow',
        icon: k === 'speak' ? 'palette' : 'account_tree',
        title: t(`rainbow.mode_${k}`),
        desc: t(`rainbow.modeHint_${k}`),
        minutes: 10,
        haystack: `무지개 rainbow ${t(`rainbow.mode_${k}`)}`,
        build: async () => ({ lessons: [buildSoloRainbowLesson(k, t(`rainbow.mode_${k}`))], level: t('solo.rainbowLevel'), source: `rainbow-${k}` }),
      });
    }
    for (const p of SOLO_GRAMMAR_POINTS) {
      list.push({
        key: `g-${p.id}`,
        type: 'grammar',
        icon: 'rule',
        title: p.name,
        desc: grammarLevelTag(p),
        minutes: 15,
        haystack: `${p.name} ${p.pattern ?? ''} ${grammarLevelTag(p)}`,
        build: async () => ({ lessons: [buildSoloGrammarLesson(p)], level: grammarLevelTag(p), source: `solo-grammar-${p.id}` }),
      });
    }
    return list;
  }, [ko, i18n.language, t]);

  const byKey = useMemo(() => new Map(entries.map((e) => [e.key, e])), [entries]);

  async function run(entry: Entry) {
    if (busy) return;
    setBusy(entry.key);
    try {
      const r = await entry.build();
      if (!r) {
        notify(t('solo.buildFailed'), 'error');
        return;
      }
      await onBatch(r.lessons, r.level, r.source);
    } finally {
      setBusy(null);
    }
  }

  /* ---------- 단어 DAY 만들기 ---------- */
  const [day, setDay] = useState(1);
  const [per, setPer] = useState(10);
  const [style, setStyle] = useState<SoloWordStyle>('writing');
  async function makeDay() {
    setBusy('moe800');
    try {
      const lessons = buildSoloDayLessons(await loadWordBank(), { day, perLesson: per, style, baseName: t('solo.moe800Name', { day }) });
      if (lessons.length === 0) {
        notify(t('solo.moe800Missing'), 'error');
        return;
      }
      await onBatch(lessons, t('solo.moe800Level'), `solo-moe800-d${day}-${style}-${per}`);
    } finally {
      setBusy(null);
    }
  }

  /* ---------- 노래 수업 ---------- */
  const [songUrl, setSongUrl] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [songText, setSongText] = useState('');
  const songLines = useMemo(() => parseShadowText(songText).length, [songText]);
  const songTimed = useMemo(() => songTimedLineCount(songText), [songText]);
  async function makeSong() {
    const videoId = extractYoutubeId(songUrl);
    if (!videoId || !songTitle.trim()) return;
    setBusy('song');
    try {
      const lesson = buildSoloSongLesson({ title: songTitle.trim(), videoId, source: songText }, await loadWordBank());
      if (!lesson) {
        notify(t('solo.songTooShort'), 'error');
        return;
      }
      await onBatch([lesson], t('solo.songLevel'), 'solo-song');
    } finally {
      setBusy(null);
    }
  }

  /* ---------- 문법 묶음 ---------- */
  const grammarGroups = useMemo(() => {
    const map = new Map<string, typeof SOLO_GRAMMAR_POINTS>();
    for (const p of SOLO_GRAMMAR_POINTS) {
      const key = p.stage === 'elementary' ? `L${p.level}` : `G${p.level}`;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, []);
  async function makeGrammarAll(points: typeof SOLO_GRAMMAR_POINTS, label: string) {
    setBusy(label);
    try {
      await onBatch(points.map(buildSoloGrammarLesson), label, `solo-grammar-${points[0]?.id ?? ''}`);
    } finally {
      setBusy(null);
    }
  }

  /* ---------- 처음부터 ---------- */
  const [scratchName, setScratchName] = useState('');
  const [scratchStart, setScratchStart] = useState<'blank' | 'paste'>('blank');

  const chip = (on: boolean) => `rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`;
  const field = 'rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary';

  const typeTag = (type: Entry['type']) => t(`solo.type_${type}`);

  function EntryCard({ e }: { e: Entry }) {
    return (
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void run(e)}
        className="flex flex-col gap-1 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-primary">{e.icon}</span>
          <span className="min-w-0 flex-1 truncate font-label-md text-label-md font-bold text-on-surface">{e.title}</span>
          <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{t('recipes.minutes', { n: e.minutes })}</span>
        </div>
        <div className="line-clamp-2 font-caption text-caption text-on-surface-variant">{e.desc}</div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-caption text-caption text-primary">{typeTag(e.type)}</span>
          {busy === e.key && <span className="font-caption text-caption text-primary">{t('common.loading')}</span>}
        </div>
      </button>
    );
  }

  function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    return (
      <section className="space-y-2">
        <div>
          <h4 className="font-label-md text-label-md font-bold text-deep-navy">{title}</h4>
          {hint && <p className="font-caption text-caption text-on-surface-variant">{hint}</p>}
        </div>
        {children}
      </section>
    );
  }

  const grid = 'grid gap-2 sm:grid-cols-2';

  /* ---------- 화면 ---------- */
  const q = query.trim().toLowerCase();
  const results = q ? entries.filter((e) => `${e.title} ${e.haystack}`.toLowerCase().includes(q)) : [];

  let body: ReactNode;
  if (q) {
    body = results.length === 0 ? (
      <p className="py-8 text-center font-body-md text-on-surface-variant">{t('solo.cat_searchEmpty')}</p>
    ) : (
      <div className={grid}>
        {results.slice(0, 40).map((e) => (
          <EntryCard key={e.key} e={e} />
        ))}
      </div>
    );
  } else if (view.id === 'home') {
    const big = [
      { id: 'purposes' as const, icon: 'category', title: t('solo.cat_byPurpose'), desc: t('solo.cat_byPurposeDesc') },
      { id: 'topics' as const, icon: 'interests', title: t('solo.cat_byTopic'), desc: t('solo.cat_byTopicDesc') },
      { id: 'scratch' as const, icon: 'construction', title: t('solo.cat_scratch'), desc: t('solo.cat_scratchDesc') },
    ];
    body = (
      <div className="grid gap-3">
        {big.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setView({ id: b.id })}
            className="flex items-center gap-4 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
          >
            <span className="material-symbols-outlined flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[28px] text-primary">{b.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-title-md text-title-md font-bold text-deep-navy">{b.title}</span>
              <span className="block font-caption text-caption text-on-surface-variant">{b.desc}</span>
            </span>
            <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
          </button>
        ))}
      </div>
    );
  } else if (view.id === 'purposes') {
    body = (
      <div className={grid}>
        {PURPOSES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setView({ id: 'purpose', purpose: p.id })}
            className="flex items-start gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
          >
            <span className="material-symbols-outlined mt-0.5 text-[26px] text-primary">{p.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-label-md text-label-md font-bold text-on-surface">{t(`solo.purpose_${p.id}`)}</span>
              <span className="block font-caption text-caption text-on-surface-variant">{t(`solo.purposeDesc_${p.id}`)}</span>
            </span>
          </button>
        ))}
      </div>
    );
  } else if (view.id === 'purpose') {
    const p = view.purpose;
    if (p === 'word') {
      body = (
        <div className="space-y-5">
          <div className="space-y-3 rounded-xl border border-primary/30 bg-primary-fixed/20 p-3">
            <div className="font-label-md text-label-md font-bold text-on-surface">{t('solo.moe800Title')}</div>
            <p className="font-caption text-caption text-on-surface-variant">{t('solo.moe800Hint')}</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 16 }, (_, i) => i + 1).map((d) => (
                <button key={d} type="button" onClick={() => setDay(d)} className={chip(day === d)}>
                  DAY {d}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="space-y-1">
                <span className="block font-caption text-caption text-on-surface-variant">{t('solo.perLesson')}</span>
                <select value={per} onChange={(e) => setPer(Number(e.target.value))} className={field}>
                  {[5, 10, 15, 20, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {t('solo.perLessonOption', { n, lessons: Math.ceil(50 / n) })}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-1">
                <span className="block font-caption text-caption text-on-surface-variant">{t('solo.styleLabel')}</span>
                <div className="flex gap-1.5">
                  {(['writing', 'picture'] as const).map((st) => (
                    <button key={st} type="button" onClick={() => setStyle(st)} className={chip(style === st)}>
                      {t(`solo.style_${st}`)}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void makeDay()}
                className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
              >
                {busy === 'moe800' ? t('common.loading') : t('solo.makeDay', { day })}
              </button>
            </div>
            <p className="font-caption text-caption text-on-surface-variant">{t(`solo.styleHint_${style}`)}</p>
          </div>
          <Section title={t('solo.cat_wordTopics')} hint={t('solo.cat_wordTopicsHint')}>
            <div className={grid}>
              {entries.filter((e) => e.type === 'word').map((e) => (
                <EntryCard key={e.key} e={e} />
              ))}
            </div>
          </Section>
        </div>
      );
    } else if (p === 'grammar') {
      body = (
        <div className="space-y-2">
          <p className="font-caption text-caption text-on-surface-variant">{t('solo.grammarHint')}</p>
          {grammarGroups.map(([key, points]) => {
            const label = grammarLevelTag(points[0]);
            return (
              <details key={key} className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest">
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 font-label-md text-label-md text-on-surface">
                  <span className="flex-1">
                    {label} <span className="font-caption text-caption text-on-surface-variant">· {t('solo.grammarCount', { count: points.length })}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={(e) => {
                      e.preventDefault();
                      if (window.confirm(t('solo.makeAllConfirm', { count: points.length, label }))) void makeGrammarAll(points, label);
                    }}
                    className="rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {busy === label ? t('common.loading') : t('solo.makeAll')}
                  </button>
                </summary>
                <div className="grid gap-1.5 px-3 pb-3 sm:grid-cols-2">
                  {points.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        const e = byKey.get(`g-${pt.id}`);
                        if (e) void run(e);
                      }}
                      className="truncate rounded-lg border border-outline-variant/50 px-3 py-2 text-left font-body-sm text-body-sm text-on-surface transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                    >
                      {pt.name}
                    </button>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      );
    } else if (p === 'talk') {
      body = (
        <Section title={t('solo.purpose_talk')} hint={t('solo.talkHint')}>
          <div className={grid}>
            {entries.filter((e) => e.type === 'talk').map((e) => (
              <EntryCard key={e.key} e={e} />
            ))}
          </div>
        </Section>
      );
    } else if (p === 'rainbow') {
      body = (
        <Section title={t('solo.purpose_rainbow')} hint={t('solo.rainbowHint')}>
          <div className={grid}>
            {entries.filter((e) => e.type === 'rainbow').map((e) => (
              <EntryCard key={e.key} e={e} />
            ))}
          </div>
        </Section>
      );
    } else {
      body = (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary-fixed/20 p-3">
          <div className="font-label-md text-label-md font-bold text-on-surface">{t('solo.songTitle')}</div>
          <p className="font-caption text-caption text-on-surface-variant">{t('solo.songHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder={t('solo.songNamePlaceholder')} className={`${field} w-full`} />
            <input value={songUrl} onChange={(e) => setSongUrl(e.target.value)} placeholder={t('solo.songUrlPlaceholder')} className={`${field} w-full`} />
          </div>
          <textarea value={songText} onChange={(e) => setSongText(e.target.value)} rows={7} placeholder={t('solo.songTextPlaceholder')} className={`${field} w-full font-mono`} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy !== null || !extractYoutubeId(songUrl) || !songTitle.trim() || songLines < 4}
              onClick={() => void makeSong()}
              className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
            >
              {busy === 'song' ? t('common.loading') : t('solo.makeSong')}
            </button>
            <span className="font-caption text-caption text-on-surface-variant">{t('solo.songLineCount', { lines: songLines, timed: songTimed })}</span>
          </div>
          {songLines > 0 && songTimed < songLines / 2 && <p className="rounded-lg bg-warm-yellow/25 px-3 py-2 font-caption text-caption text-on-surface">{t('solo.songNoTimes')}</p>}
          <p className="font-caption text-caption text-on-surface-variant">{t('solo.songCopyright')}</p>
        </div>
      );
    }
  } else if (view.id === 'topics') {
    body = (
      <div className="space-y-5">
        {TOPICS.map((tp) => {
          const items = tp.refs.map((r) => byKey.get(r)).filter((e): e is Entry => !!e);
          if (items.length === 0) return null;
          return (
            <Section key={tp.id} title={t(`solo.topic_${tp.id}`)}>
              <div className={grid}>
                {items.map((e) => (
                  <EntryCard key={e.key} e={e} />
                ))}
              </div>
            </Section>
          );
        })}
      </div>
    );
  } else {
    body = (
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="font-label-md text-label-md font-bold text-on-surface">{t('solo.cat_scratchName')}</span>
          <input value={scratchName} onChange={(e) => setScratchName(e.target.value)} placeholder={t('solo.cat_scratchNamePlaceholder')} className={`${field} w-full`} />
        </label>
        <div className="space-y-2" role="radiogroup" aria-label={t('solo.cat_scratchStart')}>
          <span className="font-label-md text-label-md font-bold text-on-surface">{t('solo.cat_scratchStart')}</span>
          {(['blank', 'paste'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scratchStart === s}
              onClick={() => setScratchStart(s)}
              className={`block w-full rounded-xl border-2 p-3 text-left ${scratchStart === s ? 'border-primary bg-primary/10' : 'border-outline-variant hover:bg-surface-container-low'}`}
            >
              <span className="block font-label-md text-label-md font-bold text-deep-navy">{t(`solo.cat_scratch_${s}`)}</span>
              <span className="block font-caption text-caption text-on-surface-variant">{t(`solo.cat_scratch_${s}Desc`)}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy !== null || !scratchName.trim()}
          onClick={async () => {
            setBusy('scratch');
            try {
              await onScratch(scratchName.trim(), scratchStart === 'paste');
            } finally {
              setBusy(null);
            }
          }}
          className="rounded-full bg-primary px-6 py-2.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
        >
          {busy === 'scratch' ? t('common.loading') : t('solo.cat_scratchMake')}
        </button>
      </div>
    );
  }

  const title =
    q
      ? t('solo.cat_searchResults', { count: results.length })
      : view.id === 'home'
        ? t('solo.catalogTitle')
        : view.id === 'purposes'
          ? t('solo.cat_byPurpose')
          : view.id === 'purpose'
            ? t(`solo.purpose_${view.purpose}`)
            : view.id === 'topics'
              ? t('solo.cat_byTopic')
              : t('solo.cat_scratch');

  const canBack = !q && view.id !== 'home';
  const goBack = () => setView(view.id === 'purpose' ? { id: 'purposes' } : { id: 'home' });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="my-6 w-full max-w-3xl space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center gap-2">
          {canBack ? (
            <button type="button" onClick={goBack} aria-label={t('solo.cat_back')} className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-low">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          ) : (
            <span className="material-symbols-outlined text-[24px] text-primary">route</span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-title-md text-title-md font-bold text-deep-navy">{title}</h3>
            {view.id === 'home' && !q && <p className="font-caption text-caption text-on-surface-variant">{t('solo.catalogHint')}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="relative">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('solo.cat_search')}
            className={`${field} w-full pl-10`}
          />
        </div>

        {body}
      </div>
    </div>
  );
}
