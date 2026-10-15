import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createCurriculumLesson, createGameTemplate } from '../lib/api';
import { LESSON_LIBRARY, type LibraryLesson } from '../lib/lessonLibrary';
import { LESSON_RECIPES } from '../lib/lessonRecipes';
import { buildGameContent, wordListToCards } from '../lib/gameFromWords';
import { useToast } from '../context/ToastContext';
import type { ClassRow, CurriculumLesson, LessonSlide, WordList } from '../lib/types';

/**
 * 수업 라이브러리 창(2026-10-15) — 완성된 수업을 골라 "내 수업에 저장하기"로 내 반 수업으로 복사한다.
 * 저장 뒤엔 "수정하기"(평소 수업 편집 화면)와 "수업 시작하기"(바로 발표)가 나온다. 원본은 그대로라 고쳐도 다른 선생님에게 영향이 없다.
 */
interface Props {
  academyId: string;
  teacherId: string;
  classes: ClassRow[];
  defaultClassId: string | null;
  wordLists: WordList[];
  onClose: () => void;
  /** 저장된 수업을 내 수업 목록에 반영 */
  onSaved: (lesson: CurriculumLesson) => void;
  onEdit: (lesson: CurriculumLesson) => void;
  onStart: (lesson: CurriculumLesson) => void;
}

export default function LessonLibraryModal({ academyId, teacherId, classes, defaultClassId, wordLists, onClose, onSaved, onEdit, onStart }: Props) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [picked, setPicked] = useState<LibraryLesson | null>(null);
  const [classId, setClassId] = useState<string>(defaultClassId ?? classes[0]?.id ?? '');
  const [wordListId, setWordListId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<CurriculumLesson | null>(null);

  const listsForClass = wordLists.filter((w) => w.class_id == null || w.class_id === classId);
  const steps = picked ? (t(`lessonLibrary.${picked.key}Steps`, { returnObjects: true }) as string[]) : [];

  async function save() {
    if (!picked || !classId || saving) return;
    if (picked.needsWords && !wordListId) {
      notify(t('lessonLibrary.needWordList'), 'error');
      return;
    }
    setSaving(true);
    try {
      const recipe = LESSON_RECIPES.find((r) => r.id === picked.recipeId);
      if (!recipe) throw new Error('recipe');
      const wordList = wordLists.find((w) => w.id === wordListId) ?? null;
      const name = t(`lessonLibrary.${picked.key}Name`);
      const slides: LessonSlide[] = await recipe.build({ t, hasWords: !!wordList, makeUnscramble: async () => null });
      const cards = wordList ? wordListToCards(wordList) : [];
      // 게임 블록은 내용(game_templates)을 같이 만들어 연결한다 — 그래야 수정·복사해도 그대로 열린다
      const withGames: LessonSlide[] = [];
      for (const slide of slides) {
        if (slide.kind !== 'game' || slide.templateId) {
          withGames.push(slide);
          continue;
        }
        const content = buildGameContent(slide.gameType, cards);
        if (!content) {
          withGames.push(slide);
          continue;
        }
        const tpl = await createGameTemplate({
          academyId,
          classId,
          gameType: slide.gameType,
          name,
          items: content.items,
          config: content.config,
          teacherId,
        });
        withGames.push({ ...slide, templateId: tpl.id });
      }
      const lesson = await createCurriculumLesson({
        academyId,
        classId,
        name,
        wordListId: wordList?.id ?? null,
        videoUrl: null,
        level: null,
        playlist: withGames,
        teacherId,
      });
      setSaved(lesson);
      onSaved(lesson);
      notify(t('lessonLibrary.savedToast'));
    } catch (err) {
      notify(err instanceof Error ? err.message : t('lessonLibrary.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('lessonLibrary.title')}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-outline-variant/40 px-5 py-3">
          <span className="material-symbols-outlined text-primary">local_library</span>
          <h2 className="flex-1 font-title-md text-title-md text-deep-navy">{t('lessonLibrary.title')}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-surface-container" aria-label={t('common.close')}>
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {!picked ? (
            <>
              <p className="mb-4 font-body-md text-body-md text-on-surface-variant">{t('lessonLibrary.intro')}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {LESSON_LIBRARY.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setPicked(l)}
                    className="overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                  >
                    <div className="aspect-[3/2] w-full overflow-hidden bg-surface-container">
                      <img src={l.cover} alt="" className="h-full w-full object-cover" draggable={false} />
                    </div>
                    <div className="space-y-1.5 p-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[22px] text-primary">{l.icon}</span>
                        <span className="flex-1 font-label-md text-label-md font-bold text-on-surface">{t(`lessonLibrary.${l.key}Name`)}</span>
                        <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">
                          {t('recipes.minutes', { n: l.minutes })}
                        </span>
                      </div>
                      <div className="font-caption text-caption text-on-surface-variant">{t(`lessonLibrary.${l.key}Desc`)}</div>
                      <div className="flex flex-wrap gap-1">
                        {l.levels.map((lv) => (
                          <span key={lv} className="rounded-full bg-primary-container/40 px-2 py-0.5 font-caption text-caption text-on-primary-container">
                            {t(`lessonLibrary.level_${lv}`)}
                          </span>
                        ))}
                        {l.games.map((g) => (
                          <span key={g} className="rounded-full bg-secondary-container px-2 py-0.5 font-caption text-caption text-on-secondary-container">
                            {t(`gamesList.${g}Name`)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="space-y-3">
                <div className="aspect-[3/2] overflow-hidden rounded-xl bg-surface-container">
                  <img src={picked.cover} alt="" className="h-full w-full object-cover" draggable={false} />
                </div>
                <div className="font-title-md text-title-md text-deep-navy">{t(`lessonLibrary.${picked.key}Name`)}</div>
                <p className="font-body-md text-body-md text-on-surface-variant">{t(`lessonLibrary.${picked.key}Desc`)}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 font-label-md text-label-md text-primary">{t('lessonLibrary.stepsTitle')}</div>
                  <ol className="space-y-1 rounded-xl bg-surface-container-low p-3 font-body-sm text-body-sm text-on-surface">
                    {steps.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="w-5 shrink-0 text-right font-bold tabular-nums text-on-surface-variant">{i + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {!saved ? (
                  <>
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <label className="mb-1 block font-caption text-caption text-on-surface-variant">{t('lessonLibrary.classLabel')}</label>
                        <select
                          value={classId}
                          onChange={(e) => {
                            setClassId(e.target.value);
                            setWordListId('');
                          }}
                          className="w-48 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                        >
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {picked.needsWords && (
                        <div>
                          <label className="mb-1 block font-caption text-caption text-on-surface-variant">{t('lessonLibrary.wordListLabel')}</label>
                          <select
                            value={wordListId}
                            onChange={(e) => setWordListId(e.target.value)}
                            className="w-56 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                          >
                            <option value="">{t('curriculum.wordListPlaceholder')}</option>
                            {listsForClass.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} ({w.items.length})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void save()}
                        disabled={saving || !classId}
                        className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
                        {saving ? t('common.loading') : t('lessonLibrary.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPicked(null)}
                        className="rounded-full border border-outline-variant px-5 py-2.5 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low"
                      >
                        {t('lessonLibrary.back')}
                      </button>
                    </div>
                    <p className="font-caption text-caption text-on-surface-variant">{t('lessonLibrary.saveHint')}</p>
                  </>
                ) : (
                  <div className="space-y-3 rounded-xl border-2 border-primary/40 bg-primary-container/20 p-4">
                    <div className="font-label-md text-label-md text-deep-navy">
                      ✓ {t('lessonLibrary.savedTitle', { name: saved.name })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onStart(saved);
                        }}
                        className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container"
                      >
                        <span className="material-symbols-outlined text-[18px]">slideshow</span>
                        {t('lessonLibrary.start')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onEdit(saved);
                        }}
                        className="flex items-center gap-1.5 rounded-full border-2 border-primary px-5 py-2 font-label-md text-label-md text-primary hover:bg-primary/10"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                        {t('lessonLibrary.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSaved(null);
                          setPicked(null);
                        }}
                        className="rounded-full border border-outline-variant px-5 py-2.5 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low"
                      >
                        {t('lessonLibrary.more')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
