import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { GAME_CATALOG, type GameCategory } from '../lib/gameCatalog';

const CATEGORIES: GameCategory[] = ['simple', 'vocabulary', 'sentence', 'listening', 'reading', 'speaking'];

export default function GamesPage() {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<GameCategory | 'all'>('all');

  const usedCategories = CATEGORIES.filter((cat) => GAME_CATALOG.some((g) => g.category === cat));
  const games = GAME_CATALOG.filter((g) => activeCategory === 'all' || g.category === activeCategory);

  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('gamesList.title')}
      </h2>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {games.map((g) => (
          <Link
            key={g.type}
            to={g.path}
            className="group relative bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all"
          >
            <div className="relative h-36 overflow-hidden">
              {g.cover ? (
                <img
                  src={g.cover}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-container to-secondary-container flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                  <span className="material-symbols-outlined text-6xl text-on-primary-container opacity-80">{g.icon}</span>
                </div>
              )}
              <div className="absolute top-3 left-3 w-10 h-10 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined">{g.icon}</span>
              </div>
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-inverse-surface/70 backdrop-blur-sm flex items-center justify-center">
                <span className="font-caption text-caption text-inverse-on-surface tabular-nums">{g.number}</span>
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-title-md text-title-md text-on-surface mb-1">{t(g.nameKey)}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">{t(g.descKey)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
