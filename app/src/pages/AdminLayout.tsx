import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background">
      <header className="bg-surface-container-lowest shadow-sm sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <div>
              <div className="font-title-md text-title-md text-deep-navy">{t('admin.brandTitle')}</div>
              <div className="font-caption text-caption text-on-surface-variant">{session?.user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-caption text-caption font-bold tracking-wider bg-tertiary-container/20 text-tertiary-container rounded-full px-3 py-1">
              ADMIN
            </span>
            <button
              onClick={() => void signOut()}
              className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
            >
              {t('admin.logout')}
            </button>
          </div>
        </div>
      </header>
      <nav className="bg-surface-container-lowest border-t border-outline-variant/30">
        <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop flex gap-1 overflow-x-auto">
          {(
            [
              ['/admin', 'today', 'task_alt'],
              ['/admin/academies', 'academies', 'school'],
              ['/admin/support', 'support', 'support_agent'],
              ['/admin/notices', 'notices', 'campaign'],
            ] as const
          ).map(([to, key, icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 font-label-md text-label-md transition-colors ${
                  isActive ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
              {t(`adminOps.tab_${key}`)}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop py-margin-desktop">
        <Outlet />
      </main>
    </div>
  );
}
