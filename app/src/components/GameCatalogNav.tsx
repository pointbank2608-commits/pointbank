import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const sections = [
  { path: '/games', label: 'classroomGamesTitle' },
  { path: '/phonics-games', label: 'phonicsGamesTitle' },
] as const;

export default function GameCatalogNav({ current }: { current: typeof sections[number]['path'] }) {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-wrap gap-3" aria-label={t('gameBrowse.categories')}>
      {sections.map(({ path, label }) => {
        const active = current === path;
        return <Link key={path} to={path} aria-current={active ? 'page' : undefined}
          className={`rounded-xl border px-5 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? 'border-deep-navy bg-deep-navy text-white' : 'border-outline-variant bg-white text-deep-navy hover:bg-surface-container-low'}`}>
          {t(label)}
        </Link>;
      })}
    </nav>
  );
}
