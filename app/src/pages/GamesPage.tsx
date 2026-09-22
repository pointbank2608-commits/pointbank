import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import { useAuth } from '../context/AuthContext';
import { fetchClassLibraryTypes, fetchMyStudentRow } from '../lib/api';
import { useClasses } from '../lib/useClasses';
import { GAME_CATALOG, isFreeTierGame, type GameCategory } from '../lib/gameCatalog';

const CATEGORIES: GameCategory[] = ['simple', 'vocabulary', 'sentence', 'listening', 'reading', 'speaking'];

type ViewMode = 'library' | 'all';

export default function GamesPage() {
  const { t } = useTranslation();
  const { academy, isStaff, session, isPaid } = useAuth();
  const [activeCategory, setActiveCategory] = useState<GameCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('library');
  const [query, setQuery] = useState('');
  const [libraryError, setLibraryError] = useState(false);
  const [retry, setRetry] = useState(0);

  const { classes, selectedId: staffClassId, select: selectClass, reorder: reorderClasses } = useClasses(academy?.id);
  const [studentClassId, setStudentClassId] = useState<string | null>(null);

  useEffect(() => {
    if (isStaff || !session?.user.id) return;
    fetchMyStudentRow(session.user.id)
      .then((s) => setStudentClassId(s?.class_id ?? null))
      .catch(() => setStudentClassId(null));
  }, [isStaff, session?.user.id]);

  const classId = isStaff ? staffClassId : studentClassId;

  const [libraryTypes, setLibraryTypes] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    setLibraryTypes(null);
    setLibraryError(false);
    if (!academy?.id || !classId) return;
    fetchClassLibraryTypes(academy.id, classId)
      .then((types) => { if (active) setLibraryTypes(types); })
      .catch(() => { if (active) setLibraryError(true); });
    return () => { active = false; };
  }, [academy?.id, classId, retry]);

  const libraryLoaded = libraryTypes !== null;
  const showLibrary = !isStaff || viewMode === 'library';
  const librarySet = new Set(libraryTypes ?? []);

  const byCategory = GAME_CATALOG.filter((g) =>
    (activeCategory === 'all' || g.category === activeCategory) &&
    `${t(g.nameKey)} ${t(g.descKey)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const games = showLibrary ? byCategory.filter((g) => librarySet.has(g.type)) : byCategory;
  const usedCategories = CATEGORIES.filter((cat) =>
    (showLibrary ? GAME_CATALOG.filter((g) => librarySet.has(g.type)) : GAME_CATALOG).some(
      (g) => g.category === cat,
    ),
  );

  const libraryEmpty = showLibrary && libraryLoaded && (libraryTypes?.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
          {t('gamesList.title')}
        </h2>

        {isStaff && (
          <div className="flex bg-surface-container-low rounded-lg p-1">
            <button
              type="button"
              onClick={() => { setViewMode('library'); setActiveCategory('all'); }}
              aria-pressed={viewMode === 'library'}
              className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                viewMode === 'library' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('gamesList.libraryTab')}
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('all'); setActiveCategory('all'); }}
              className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                viewMode === 'all' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('gamesList.allTab')}
            </button>
          </div>
        )}
      </div>

      {isStaff && showLibrary && (
        <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />
      )}

      <label className="block max-w-xl">
        <span className="mb-2 block font-semibold text-on-surface">{t('classroomUx.searchGames')}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 text-base focus:outline-primary" />
      </label>

      {showLibrary && libraryError ? (
        <div role="alert" className="rounded-xl bg-error-container p-6 text-on-error-container">
          <p>{t('classroomUx.libraryFailed')}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 min-h-11 rounded-lg bg-surface-container-lowest px-4">{t('classroomUx.reload')}</button>
        </div>
      ) : showLibrary && !classId ? (
        <p className="rounded-xl bg-surface-container-lowest p-6">{t('classroomUx.noClass')}</p>
      ) : showLibrary && !libraryLoaded ? (
        <p role="status" className="py-16 text-center text-on-surface-variant">{t('common.loading')}</p>
      ) : libraryEmpty ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
          <div className="text-5xl mb-3">📚</div>
          <div className="font-body-md text-body-md text-on-surface-variant mb-4">{t('gamesList.libraryEmpty')}</div>
          {isStaff && (
            <button
              type="button"
              onClick={() => { setViewMode('all'); setActiveCategory('all'); }}
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors"
            >
              {t('gamesList.libraryEmptyCta')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-full font-label-md text-label-md transition-all ${
                activeCategory === 'all'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low'
              }`}
            >
              {t('gameCategory.all')}
            </button>
            {usedCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full font-label-md text-label-md transition-all ${
                  activeCategory === cat
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low'
                }`}
              >
                {t(`gameCategory.${cat}`)}
              </button>
            ))}
          </div>

          {games.length === 0 && <div className="rounded-xl bg-surface-container-lowest p-8 text-center">
            <p>{t('classroomUx.noGames')}</p>
            <button type="button" onClick={() => { setQuery(''); setActiveCategory('all'); }} className="mt-3 min-h-11 rounded-lg px-4 text-primary underline">{t('classroomUx.clearFilters')}</button>
          </div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {games.map((g) => {
              const locked = isStaff && !isPaid && !isFreeTierGame(g.type);
              // 왕관 배지: 유료 전용 게임이면 항상 붙인다(유료 회원도 "이건 유료 기능이구나"를 느끼도록 —
              // 캔바 프리미엄 템플릿의 왕관 표시와 같은 목적). locked 여부와 별개로, 무료 4종만 안 붙는다.
              const isPremiumGame = !isFreeTierGame(g.type);
              return (
                <Link
                  key={g.type}
                  to={locked ? '/settings/billing' : g.path}
                  className="group relative bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all"
                >
                  <div className="relative h-36 overflow-hidden">
                    {g.cover ? (
                      <img
                        src={g.cover}
                        alt=""
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${locked ? 'grayscale opacity-60' : ''}`}
                      />
                    ) : (
                      <div
                        className={`w-full h-full bg-gradient-to-br from-primary-container to-secondary-container flex items-center justify-center group-hover:scale-105 transition-transform duration-300 ${locked ? 'grayscale opacity-60' : ''}`}
                      >
                        <span className="material-symbols-outlined text-6xl text-on-primary-container opacity-80">{g.icon}</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 w-10 h-10 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm flex items-center justify-center text-primary shadow-sm">
                      <span className="material-symbols-outlined">{g.icon}</span>
                    </div>
                    {locked ? (
                      <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-inverse-surface/70 backdrop-blur-sm flex items-center justify-center">
                        <span className="material-symbols-outlined text-[16px] text-inverse-on-surface">lock</span>
                      </div>
                    ) : (
                      <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-inverse-surface/70 backdrop-blur-sm flex items-center justify-center">
                        <span className="font-caption text-caption text-inverse-on-surface tabular-nums">{g.number}</span>
                      </div>
                    )}
                    {isPremiumGame && (
                      <div
                        className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-inverse-surface/70 text-[13px] leading-none backdrop-blur-sm"
                        title={t('gamesList.premiumBadge')}
                      >
                        👑
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="min-w-0 font-title-md text-title-md text-on-surface">{t(g.nameKey)}</h3>
                      {locked && (
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-tertiary-container px-2 py-0.5 font-caption text-caption text-on-tertiary-container">
                          {t('gamesList.lockedBadge')}
                        </span>
                      )}
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant">{t(g.descKey)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
