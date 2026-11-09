import GameCreateButton from '../components/GameCreateButton';
import { GAME_BROWSE_GROUPS, gameBrowseGroups, type GameBrowseGroup } from '../lib/gameBrowse';
import { prepareClassroomGame, classroomGameRequirement } from '../lib/gameWorkspace';
import { ownedQuickSource, type QuickActivitySource } from '../lib/quickActivity';
import { GAME_META } from '../lib/gameMeta';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import { useAuth } from '../context/AuthContext';
import { fetchClassLibraryTypes, fetchMyStudentRow } from '../lib/api';
import { useClasses } from '../lib/useClasses';
import { GAME_CATALOG, isFreeTierGame, type GameCatalogEntry } from '../lib/gameCatalog';
import { PHONICS_GAMES, gameAvailability, gameName, phonicsGameUnits } from '../lib/phonicsGames';
import { gameVisual, worldBackground } from '../lib/phonicsGameVisuals';

type ViewMode = 'library' | 'all';

const phonicsUnits = phonicsGameUnits();
const phonicsCards = PHONICS_GAMES.map(game => ({
  game,
  unit: phonicsUnits.find(unit => !gameAvailability(game, unit)) ?? phonicsUnits.find(unit => game.stages.includes(unit.step)),
}));

export default function GamesPage() {
  const { t, i18n } = useTranslation();

  const { academy, isStaff, session, hasFullAccess } = useAuth();
  const [activeCategory, setActiveCategory] = useState<GameBrowseGroup | 'all'>('all');
  // Main navigation always opens the complete catalogue. Saved games remain an explicit tab.
  const [viewMode, setViewMode] = useState<ViewMode>('all');
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
    if (!academy?.id) { setLibraryTypes([]); return; }
    fetchClassLibraryTypes(academy.id, classId || '')
      .then((types) => { if (active) setLibraryTypes(types); })
      .catch(() => { if (active) setLibraryError(true); });
    return () => { active = false; };
  }, [academy?.id, classId, retry]);

  const libraryLoaded = libraryTypes !== null;
  const showLibrary = !isStaff || viewMode === 'library';
  const librarySet = new Set(libraryTypes ?? []);

  const search = query.trim().toLocaleLowerCase();
  const en = i18n.resolvedLanguage?.startsWith('en') ?? false;
  const byCategory = GAME_CATALOG.filter((g) =>
    (activeCategory === 'all' || gameBrowseGroups(g).includes(activeCategory)) &&
    `${t(g.nameKey)} ${t(g.descKey)}`.toLocaleLowerCase().includes(search));
  const games = showLibrary ? byCategory.filter((g) => librarySet.has(g.type)) : byCategory;
  const phonics = !showLibrary && (activeCategory === 'all' || activeCategory === 'phonics')
    ? phonicsCards.filter(({game}) => `${game.ko} ${game.en} ${game.goal.join(' ')}`.toLocaleLowerCase().includes(search))
    : [];
  const pool = showLibrary ? GAME_CATALOG.filter((g) => librarySet.has(g.type)) : GAME_CATALOG;
  const categoryCount = (category: GameBrowseGroup) => category === 'phonics'
    ? showLibrary ? 0 : phonicsCards.length
    : pool.filter(game => gameBrowseGroups(game).includes(category)).length;

  const libraryEmpty = showLibrary && libraryLoaded && (libraryTypes?.length ?? 0) === 0;

  return (
    <div className="teacher-games-catalog space-y-6">
      {isStaff && <nav className="flex flex-wrap gap-3" aria-label={t('phonicsGamesTitle')}><Link className="rounded-xl bg-deep-navy px-5 py-3 font-bold text-white" to="/games" aria-current="page">{t('classroomGamesTitle')}</Link><Link className="rounded-xl border border-outline-variant bg-white px-5 py-3 font-bold text-deep-navy" to="/phonics-games">{t('phonicsGamesTitle')}</Link></nav>}
      {isStaff && <p className="rounded-xl bg-white p-4 text-lg font-semibold text-deep-navy">{t('teacherGame.browseHint')}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
          {t('gamesList.title')}
        </h2>
        <GameCreateButton />

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
      ) : showLibrary && !classId && !isStaff ? (
        <p className="rounded-xl bg-surface-container-lowest p-6">{t('classroomUx.noClass')}</p>
      ) : showLibrary && !libraryLoaded ? (
        <p role="status" className="py-16 text-center text-on-surface-variant">{t('common.loading')}</p>
      ) : libraryEmpty ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-xl shadow-card">
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
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('gameBrowse.categories')}>
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              aria-pressed={activeCategory === 'all'}
              className={`px-4 min-h-11 rounded-full font-label-md text-label-md transition-all ${
                activeCategory === 'all'
                  ? 'bg-warm-yellow text-deep-navy shadow-sm'
                  : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low'
              }`}
            >
              {t('gameCategory.all')}
            </button>
            {GAME_BROWSE_GROUPS.filter(cat => !showLibrary || categoryCount(cat) > 0).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                aria-pressed={activeCategory === cat}
                className={`px-4 min-h-11 rounded-full font-label-md text-label-md transition-all ${
                  activeCategory === cat
                    ? 'bg-warm-yellow text-deep-navy shadow-sm'
                    : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low'
                }`}
              >
                {t(`gameBrowse.${cat}`)} {categoryCount(cat)}
              </button>
            ))}
          </div>

          {games.length === 0 && phonics.length === 0 && <div className="rounded-xl bg-surface-container-lowest p-8 text-center">
            <p>{t('classroomUx.noGames')}</p>
            <button type="button" onClick={() => { setQuery(''); setActiveCategory('all'); }} className="mt-3 min-h-11 rounded-lg px-4 text-primary underline">{t('classroomUx.clearFilters')}</button>
          </div>}
          {(games.length > 0 || phonics.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {games.map((g) => (
                <GameCard key={g.type} g={g} locked={isStaff && !hasFullAccess && !isFreeTierGame(g.type)} />
              ))}
              {phonics.map(({game, unit}) => (
                <Link key={game.id} to={`/phonics-games/${game.id}${unit ? `?unit=${encodeURIComponent(unit.id)}` : ''}`} state={{phonicsQuickPlay:true}} className="group overflow-hidden rounded-xl bg-surface-container-lowest shadow-card transition hover:-translate-y-1 hover:shadow-lg">
                  <img className="h-36 w-full object-cover" loading="lazy" src={worldBackground(gameVisual(game).world)} alt="" />
                  <div className="p-5">
                    <h3 className="font-title-md text-title-md text-on-surface">{gameName(game, en)}</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">{game.goal[en ? 1 : 0]}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GameCard({ g, locked }: { g: GameCatalogEntry; locked: boolean }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { session, academy } = useAuth();
  const source = ownedQuickSource((location.state as { quickSource?: QuickActivitySource } | null)?.quickSource, session?.user.id, academy?.id);
  const compatible = !source || !!prepareClassroomGame(g.type, source.cards, source.kind);
  const meta = GAME_META[g.type];
  return (
    <Link
      to={locked ? '/settings/billing' : g.path}
      state={source && compatible && !locked ? { quickSource: source, guideLaunch: {
        kind: source.kind, cards: source.cards, ownerId: source.ownerId, academyId: source.academyId,
      } } : undefined}
      aria-disabled={!compatible}
      onClick={e => { if (!compatible) e.preventDefault(); }}
      tabIndex={compatible ? 0 : -1}
      className="group relative bg-surface-container-lowest rounded-xl shadow-card overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all"
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
        {locked && (
          <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-inverse-surface/70 backdrop-blur-sm flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px] text-inverse-on-surface">lock</span>
          </div>
        )}
      </div>
      <div className="p-5">
        {!compatible && <p className="mb-2 text-sm text-error">{t(classroomGameRequirement(g.type, source?.kind).key, { count: classroomGameRequirement(g.type, source?.kind).count })}</p>}
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 font-title-md text-title-md text-on-surface">{t(g.nameKey)}</h3>
          {locked && (
            <span className="shrink-0 whitespace-nowrap rounded-full bg-tertiary-container px-2 py-0.5 font-caption text-caption text-on-tertiary-container">
              {t('gamesList.lockedBadge')}
            </span>
          )}
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">{t(g.descKey)}</p>
        {(['team', 'warmup', 'wrapup'] as const).some(moment => moment === g.moment) &&
          <span className="mt-2 inline-block rounded-full bg-surface-container px-2 py-0.5 text-sm text-on-surface-variant">{t(`gameMoment.${g.moment}`)}</span>}
        {meta && (
          <div className="mt-3 flex flex-wrap gap-1.5 font-caption text-caption">
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-on-surface-variant">{t('gameMeta.minutes', { n: meta.minutes })}</span>
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-on-surface-variant">{t(`gameMeta.play_${meta.play}`)}</span>
            {meta.paper && <span className="rounded-full bg-tertiary-container/60 px-2 py-0.5 text-on-tertiary-container">{t('gameMeta.paper')}</span>}
            {meta.phone && <span className="rounded-full bg-tertiary-container/60 px-2 py-0.5 text-on-tertiary-container">{t('gameMeta.phone')}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
