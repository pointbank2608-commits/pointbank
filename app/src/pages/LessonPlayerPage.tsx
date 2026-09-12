import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import YoutubeShadowingPlayer from '../components/YoutubeShadowingPlayer';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchAllWordLists, fetchCurriculumLessonById } from '../lib/api';
import { GAME_CATALOG } from '../lib/gameCatalog';
import type { CurriculumLesson, WordList } from '../lib/types';

type Step = { kind: 'video' } | { kind: 'game'; gameType: CurriculumLesson['playlist'][number]['gameType'] } | { kind: 'print' };

export default function LessonPlayerPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { academy } = useAuth();
  const { notify } = useToast();

  const [lesson, setLesson] = useState<CurriculumLesson | null>(null);
  const [wordList, setWordList] = useState<WordList | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchCurriculumLessonById(id)
      .then(async (l) => {
        setLesson(l);
        if (l.word_list_id && academy?.id) {
          const lists = await fetchAllWordLists(academy.id);
          setWordList(lists.find((w) => w.id === l.word_list_id) ?? null);
        }
      })
      .catch((err) => notify(err instanceof Error ? err.message : String(err), 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, academy?.id]);

  if (loading) {
    return <div className="font-body-md text-body-md text-on-surface-variant">{t('common.loading')}</div>;
  }
  if (!lesson) {
    return (
      <div className="space-y-4">
        <div className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.play.notFound')}</div>
        <Link to="/curriculum" className="font-label-md text-label-md text-primary hover:underline">
          {t('curriculum.play.backToList')}
        </Link>
      </div>
    );
  }

  const steps: Step[] = [
    ...(lesson.video_url ? ([{ kind: 'video' }] as Step[]) : []),
    ...lesson.playlist.map((s) => ({ kind: 'game', gameType: s.gameType }) as Step),
    { kind: 'print' },
  ];
  const current = steps[stepIndex];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/curriculum" className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
            {t('curriculum.play.backToList')}
          </Link>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy mt-1">
            {lesson.name}
          </h2>
        </div>
        <div className="font-caption text-caption text-on-surface-variant">
          {stepIndex + 1} / {steps.length}
        </div>
      </div>

      {/* 진행 단계 표시줄 — 클릭으로 바로 이동 가능 */}
      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStepIndex(i)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-label-md text-label-md transition-colors ${
              i === stepIndex ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-secondary-container/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {s.kind === 'video' ? 'smart_display' : s.kind === 'print' ? 'print' : GAME_CATALOG.find((g) => g.type === s.gameType)?.icon}
            </span>
            {s.kind === 'video'
              ? t('curriculum.play.stepVideo')
              : s.kind === 'print'
                ? t('curriculum.play.stepPrint')
                : t(GAME_CATALOG.find((g) => g.type === s.gameType)?.nameKey ?? '')}
          </button>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        {current.kind === 'video' && lesson.video_url && <YoutubeShadowingPlayer videoUrl={lesson.video_url} />}

        {current.kind === 'game' &&
          (() => {
            const entry = GAME_CATALOG.find((g) => g.type === current.gameType);
            if (!entry) return null;
            return (
              <div className="space-y-4 text-center py-8">
                <span className="material-symbols-outlined text-6xl text-primary">{entry.icon}</span>
                <h3 className="font-title-lg text-title-lg text-on-surface">{t(entry.nameKey)}</h3>
                {wordList && (
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    {t('curriculum.play.openGameHint', { name: wordList.name })}
                  </p>
                )}
                <a
                  href={entry.path}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-6 py-3 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
                >
                  {t('curriculum.play.openGame')} ↗
                </a>
              </div>
            );
          })()}

        {current.kind === 'print' && (
          <div className="space-y-4 text-center py-8">
            <span className="material-symbols-outlined text-6xl text-primary">print</span>
            <h3 className="font-title-lg text-title-lg text-on-surface">{t('curriculum.play.stepPrint')}</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.play.printHint')}</p>
            <a
              href="/materials/worksheet"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-6 py-3 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
            >
              {t('curriculum.play.openWorksheets')} ↗
            </a>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          className="px-5 py-2.5 rounded-full border border-outline-variant text-on-surface-variant font-label-md text-label-md transition-colors hover:bg-surface-container-low disabled:opacity-40"
        >
          ← {t('curriculum.play.prev')}
        </button>
        {stepIndex < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('curriculum.play.next')} →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/curriculum')}
            className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('curriculum.play.finish')}
          </button>
        )}
      </div>
    </div>
  );
}
