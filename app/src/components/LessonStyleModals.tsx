import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../i18n/lessonStyleLocales';
import { createCurriculumLesson, fetchAllWordLists } from '../lib/api';
import { applyStyle, deleteStyle, loadStyles, planStyle, renameStyle, saveStyle, styleFromLesson, styleSummary, type LessonStyle } from '../lib/lessonStyles';
import { effectiveSlides } from '../lib/lessonSlides';
import { useToast } from '../context/ToastContext';
import type { ClassRow, CurriculumLesson, WordList } from '../lib/types';

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 p-4" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex shrink-0 items-center gap-3 border-b border-outline-variant/40 px-5 py-3">
          <span className="material-symbols-outlined text-primary">dashboard_customize</span>
          <h2 className="flex-1 font-title-md text-title-md text-deep-navy">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-surface-container" aria-label={t('common.close')}>
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** 수업 카드의 "더보기 → 내 수업 틀로 저장" */
export function SaveStyleModal({ academyId, lesson, onClose }: { academyId: string; lesson: CurriculumLesson; onClose: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [name, setName] = useState(lesson.name);
  const slides = useMemo(() => effectiveSlides(lesson), [lesson]);
  function save() {
    const style = styleFromLesson(name, lesson.name, slides);
    if (saveStyle(academyId, style)) { notify(t('lessonStyle.saved')); onClose(); } else notify(t('lessonStyle.saveFailed'), 'error');
  }
  const summary = styleSummary(styleFromLesson(name, lesson.name, slides));
  return (
    <Shell title={t('lessonStyle.saveTitle')} onClose={onClose}>
      <p className="mb-3 font-body-md text-body-md text-on-surface-variant">{t('lessonStyle.saveLead')}</p>
      <label className="mb-1 block font-label-md text-label-md text-on-surface" htmlFor="style-name">{t('lessonStyle.nameLabel')}</label>
      <input id="style-name" value={name} onChange={(e) => setName(e.target.value)} className="mb-3 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md" maxLength={60} />
      <p className="mb-1 font-caption text-caption text-on-surface-variant">{t('lessonStyle.summary', summary)}</p>
      <p className="mb-4 font-caption text-caption text-on-surface-variant">{t('lessonStyle.localNote')}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-outline-variant px-4 font-label-md text-label-md">{t('common.cancel')}</button>
        <button type="button" onClick={save} disabled={slides.length === 0} className="min-h-11 rounded-lg bg-primary px-5 font-label-md text-label-md font-bold text-on-primary disabled:opacity-50">{t('lessonStyle.save')}</button>
      </div>
    </Shell>
  );
}

/** 새 수업 만들기 → "내 틀로 시작": 틀 + 단어장/문장 모음 → 같은 모양의 새 수업 */
export function StartFromStyleModal({ academyId, teacherId, classes, defaultClassId, wordLists, onClose, onCreated, onEdit, onStart }: {
  academyId: string; teacherId: string; classes: ClassRow[]; defaultClassId: string | null; wordLists: WordList[];
  onClose: () => void;
  onCreated: (lesson: CurriculumLesson) => void;
  onEdit: (lesson: CurriculumLesson) => void;
  onStart: (lesson: CurriculumLesson) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [styles, setStyles] = useState<LessonStyle[]>(() => loadStyles(academyId));
  const [styleId, setStyleId] = useState(styles[0]?.id ?? '');
  const [classId, setClassId] = useState(defaultClassId ?? classes[0]?.id ?? '');
  const [listId, setListId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<CurriculumLesson | null>(null);

  const style = styles.find((s) => s.id === styleId) ?? null;
  // 수업 화면은 단어장만 갖고 있으므로 문장 모음까지 이 창이 따로 불러온다
  const [allLists, setAllLists] = useState<WordList[]>(wordLists);
  useEffect(() => {
    let alive = true;
    void fetchAllWordLists(academyId, 'all').then((rows) => { if (alive) setAllLists(rows); }).catch(() => {});
    return () => { alive = false; };
  }, [academyId]);
  const lists = allLists.filter((w) => w.class_id == null || w.class_id === classId);
  const list = lists.find((w) => w.id === listId) ?? null;
  const plan = useMemo(() => (style && list ? planStyle(style, list.kind === 'sentence' ? 'sentence' : 'word') : []), [style, list]);
  const skipCount = plan.filter((p) => p.action === 'skip').length;

  async function make() {
    if (!style || busy) return;
    if (!list) { notify(t('lessonStyle.needList'), 'error'); return; }
    if (list.items.length === 0) { notify(t('lessonStyle.emptyList'), 'error'); return; }
    setBusy(true);
    try {
      const lessonName = name.trim() || `${style.name} · ${list.name}`;
      const result = await applyStyle({ style, list, lessonName, academyId, classId: classId || null, teacherId });
      const lesson = await createCurriculumLesson({ academyId, classId: classId || null, name: lessonName, wordListId: list.kind === 'sentence' ? null : list.id, videoUrl: null, level: null, playlist: result.slides, teacherId });
      onCreated(lesson);
      setDone(lesson);
      notify(t('lessonStyle.made', { count: result.made }) + (result.skipped.length ? ' ' + t('lessonStyle.skippedNote', { count: result.skipped.length }) : ''));
    } catch (err) {
      notify(err instanceof Error ? err.message : t('lessonStyle.makeFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  function describe(p: (typeof plan)[number]): string {
    const s = p.slide;
    const game = s.kind === 'game' ? t(`gamesList.${s.gameType}Name`, s.gameType) : '';
    if (p.action === 'words') return t('lessonStyle.planWords', { name: list?.name ?? '' });
    if (p.action === 'game') return t('lessonStyle.planGame', { game });
    if (p.action === 'keep') return s.kind === 'material' ? t('lessonStyle.planMaterial', { name: s.materialId }) : t('lessonStyle.planKeep', { kind: s.kind });
    return p.reason === 'sentenceList' ? t('lessonStyle.planSkipSentence') : p.reason === 'wordGameOnSentences' ? t('lessonStyle.planSkipWordGame', { game }) : t('lessonStyle.planSkipCannot', { game });
  }

  return (
    <Shell title={t('lessonStyle.startTitle')} onClose={onClose}>
      {styles.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">{t('lessonStyle.none')}</p>
      ) : done ? (
        <div className="space-y-3">
          <p className="font-body-md text-body-md text-on-surface">{t('lessonStyle.made', { count: done.playlist.length })}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => onStart(done)} className="min-h-11 flex-1 rounded-lg bg-primary font-label-md text-label-md font-bold text-on-primary">{t('lessonStyle.start')}</button>
            <button type="button" onClick={() => onEdit(done)} className="min-h-11 flex-1 rounded-lg border border-outline-variant font-label-md text-label-md">{t('lessonStyle.edit')}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 font-label-md text-label-md text-primary">{t('lessonStyle.pickStyle')}</div>
            <ul className="space-y-1.5">
              {styles.map((s) => (
                <li key={s.id} className={'flex items-center gap-2 rounded-xl border px-3 py-2 ' + (s.id === styleId ? 'border-primary bg-primary-fixed/50' : 'border-outline-variant/60')}>
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input type="radio" name="lesson-style" checked={s.id === styleId} onChange={() => setStyleId(s.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-label-md text-label-md font-bold text-on-surface">{s.name}</span>
                      <span className="block font-caption text-caption text-on-surface-variant">{t('lessonStyle.slides', { count: s.slides.length })} · {t('lessonStyle.from', { name: s.fromLesson })}</span>
                    </span>
                  </label>
                  <button type="button" className="rounded-lg px-2 py-1 font-caption text-caption text-on-surface-variant hover:bg-surface-container" onClick={() => {
                    const next = window.prompt(t('lessonStyle.rename'), s.name);
                    if (next) setStyles(renameStyle(academyId, s.id, next));
                  }}>{t('lessonStyle.rename')}</button>
                  <button type="button" className="rounded-lg px-2 py-1 font-caption text-caption text-error hover:bg-error-container/40" onClick={() => {
                    const next = deleteStyle(academyId, s.id);
                    setStyles(next);
                    if (s.id === styleId) setStyleId(next[0]?.id ?? '');
                    notify(t('lessonStyle.deleted'));
                  }}>{t('lessonStyle.delete')}</button>
                </li>
              ))}
            </ul>
            {style && <p className="mt-1 font-caption text-caption text-on-surface-variant">{t('lessonStyle.summary', styleSummary(style))}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block font-label-md text-label-md text-on-surface">{t('lessonStyle.pickClass')}</span>
              <select value={classId} onChange={(e) => { setClassId(e.target.value); setListId(''); }} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-label-md text-label-md text-primary">{t('lessonStyle.pickList')}</span>
              <select value={listId} onChange={(e) => setListId(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md">
                <option value="">—</option>
                {lists.map((w) => <option key={w.id} value={w.id}>{w.kind === 'sentence' ? t('lessonStyle.sentences') : t('lessonStyle.words')} · {w.name} ({w.items.length})</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block font-label-md text-label-md text-on-surface">{t('lessonStyle.lessonName')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={style && list ? `${style.name} · ${list.name}` : ''} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md" maxLength={80} />
          </label>

          {plan.length > 0 && (
            <div>
              <div className="mb-1.5 font-label-md text-label-md text-primary">{t('lessonStyle.willMake')}</div>
              <ol className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-surface-container-low p-3 font-body-sm text-body-sm text-on-surface">
                {plan.map((p, i) => (
                  <li key={i} className={'flex gap-2 ' + (p.action === 'skip' ? 'text-on-surface-variant line-through' : '')}>
                    <span className="w-5 shrink-0 text-right text-primary">{i + 1}</span>
                    <span>{describe(p)}</span>
                  </li>
                ))}
              </ol>
              {skipCount > 0 && <p className="mt-1 font-caption text-caption text-on-surface-variant">{t('lessonStyle.skippedNote', { count: skipCount })}</p>}
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" onClick={() => void make()} disabled={busy || !style || !list} className="min-h-11 rounded-lg bg-primary px-5 font-label-md text-label-md font-bold text-on-primary disabled:opacity-50">
              {busy ? t('lessonStyle.making') : t('lessonStyle.make')}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
