import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createCurriculumLesson, createWordList } from '../lib/api';
import { wordListToCards } from '../lib/gameFromWords';
import { getGameCatalogEntry } from '../lib/gameCatalog';
import { LESSON_SETS, lessonSetName, pickSetWords } from '../lib/lessonSets';
import {
  attachQuickGames,
  parsePastedWords,
  planQuickLesson,
  quickRowsToSlides,
  swapQuickGame,
  type QuickMinutes,
  type QuickRow,
} from '../lib/quickLesson';
import type { ClassRow, CurriculumLesson, FullCardItem, WordList } from '../lib/types';
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
  /** 만든 수업(과 새로 만든 단어장). action 은 사용자가 고른 버튼 */
  onDone: (lesson: CurriculumLesson, list: WordList | null, action: QuickAction) => void;
}

const SLOT_COLOR: Record<QuickRow['slot'], string> = {
  warmup: 'bg-warm-yellow',
  learn: 'bg-sky-blue',
  practice: 'bg-secondary-fixed',
  team: 'bg-tertiary-fixed',
  wrapup: 'bg-primary-fixed',
  sheet: 'bg-surface-variant',
};

const uid = () => crypto.randomUUID();

/** 질문 3개(반 · 무엇을 · 몇 분)로 수업 구성을 만든다. 구성은 "바꾸기"로 고치고, 시작·저장·자세히 편집 중 고른다. */
export default function QuickLessonWizard({ academyId, teacherId, classes, defaultClassId, wordLists, onClose, onDone }: Props) {
  const { t, i18n } = useTranslation();
  const { notify } = useToast();
  const [classId, setClassId] = useState<string>(defaultClassId ?? classes[0]?.id ?? '');
  const [source, setSource] = useState<Source>('paste');
  const [pasted, setPasted] = useState('');
  const [listId, setListId] = useState('');
  const [setId, setSetId] = useState(LESSON_SETS.find((s) => s.kind === 'word')?.id ?? '');
  const [minutes, setMinutes] = useState<QuickMinutes>(40);
  const [rows, setRows] = useState<QuickRow[]>(() => planQuickLesson(40));
  const [busy, setBusy] = useState(false);

  const wordSets = useMemo(() => LESSON_SETS.filter((s) => s.kind === 'word').slice(0, 12), []);
  const myLists = wordLists.filter((l) => (l.kind ?? 'word') === 'word' && (!l.class_id || l.class_id === classId));
  const pastedCount = useMemo(() => parsePastedWords(pasted, []).length, [pasted]);

  function chooseMinutes(m: QuickMinutes) {
    setMinutes(m);
    setRows(planQuickLesson(m));
  }

  const ready =
    !!classId && (source === 'paste' ? pastedCount >= 4 : source === 'mine' ? !!listId : !!setId);

  async function make(action: QuickAction) {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const bank = await loadWordBank();
      let list: WordList | null = null;
      let cards: FullCardItem[];
      let listName: string;
      let created: WordList | null = null;
      if (source === 'mine') {
        list = wordLists.find((l) => l.id === listId) ?? null;
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
        created = await createWordList({
          academyId,
          classId,
          name: listName,
          items: parsed.map((w) => ({
            id: uid(),
            word: w.word,
            meaning: w.meaning,
            image_url: w.imageUrl,
            category: w.category ?? null,
            partOfSpeech: w.partOfSpeech ?? null,
            patternMarked: w.patternMarked ?? null,
          })),
          teacherId,
        });
        list = created;
        cards = parsed;
      }
      const lessonName = t('quickLesson.lessonName', { list: listName });
      const slides = await attachQuickGames({
        slides: quickRowsToSlides(rows),
        cards,
        academyId,
        classId,
        teacherId,
        lessonName,
        listName,
      });
      const lesson = await createCurriculumLesson({
        academyId,
        classId,
        name: lessonName,
        wordListId: list.id,
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
  const total = rows.reduce((n, r) => n + r.minutes, 0);

  return (
    <div role="dialog" aria-modal="true" aria-label={t('quickLesson.title')} className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/50 p-4">
      <div className="max-h-[92dvh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
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
              <button key={c.id} type="button" aria-pressed={classId === c.id} onClick={() => setClassId(c.id)} className={chip(classId === c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-title-md text-title-md text-on-surface">2. {t('quickLesson.q2')}</h3>
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
                rows={6}
                placeholder={t('quickLesson.pastePlaceholder')}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 font-body-md text-body-md"
              />
              <p className="font-caption text-caption text-on-surface-variant">{t('quickLesson.pasteHint', { count: pastedCount })}</p>
            </div>
          )}
          {source === 'mine' &&
            (myLists.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">{t('quickLesson.noLists')}</p>
            ) : (
              <select value={listId} onChange={(e) => setListId(e.target.value)} className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3">
                <option value="">{t('quickLesson.pickList')}</option>
                {myLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.items.length})
                  </option>
                ))}
              </select>
            ))}
          {source === 'topic' && (
            <div className="flex flex-wrap gap-2">
              {wordSets.map((s) => (
                <button key={s.id} type="button" aria-pressed={setId === s.id} onClick={() => setSetId(s.id)} className={chip(setId === s.id)}>
                  {lessonSetName(s, i18n.language)}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="font-title-md text-title-md text-on-surface">3. {t('quickLesson.q3')}</h3>
          <div className="flex flex-wrap gap-2">
            {([20, 40, 50] as const).map((m) => (
              <button key={m} type="button" aria-pressed={minutes === m} onClick={() => chooseMinutes(m)} className={chip(minutes === m)}>
                {m}
                {t('quickLesson.min')}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-xl bg-surface-container-low p-4">
          <h3 className="font-title-md text-title-md text-on-surface">{t('quickLesson.planTitle', { minutes: total })}</h3>
          <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
            {rows.map((r, i) => (
              <div key={i} className={SLOT_COLOR[r.slot]} style={{ flex: r.minutes }} />
            ))}
          </div>
          <ul className="space-y-1">
            {rows.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-1">
                <span className={`h-3 w-3 shrink-0 rounded-full ${SLOT_COLOR[r.slot]}`} aria-hidden />
                <span className="w-20 shrink-0 font-label-md text-label-md text-on-surface">{t(`quickLesson.slot_${r.slot}`)}</span>
                <span className="min-w-0 flex-1 font-body-md text-body-md text-on-surface-variant">
                  {r.slot === 'learn'
                    ? t('quickLesson.learnDesc')
                    : r.slot === 'sheet'
                      ? t('quickLesson.sheetDesc')
                      : r.games.map((g) => t(getGameCatalogEntry(g)?.nameKey ?? '')).join(' → ')}
                </span>
                <span className="font-caption text-caption text-on-surface-variant">
                  {r.minutes}
                  {t('quickLesson.min')}
                </span>
                {r.games.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRows((cur) => cur.map((x, j) => (j === i ? swapQuickGame(x, x.games.length - 1) : x)))}
                    className="min-h-11 rounded-full border border-outline-variant px-3 font-label-md text-label-md text-primary hover:bg-primary/10"
                  >
                    {t('quickLesson.swap')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

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
