import { useTranslation } from 'react-i18next';
import AdminMfaGate from '../components/AdminMfaGate';
import { Suspense } from 'react';
import PageLoading from '../components/PageLoading';
import { NavLink, Outlet } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import LanguageToggle from '../components/LanguageToggle';
import { useAuth } from '../context/AuthContext';

/** 관리자 메뉴(2026-10-18): 운영자가 하루에 보는 순서대로 8개. 하위 화면은 각 페이지 안의 탭으로 묶는다. */
const ITEMS = [
  ['/admin', 'today', 'task_alt'],
  ['/admin/academies', 'academies', 'school'],
  ['/admin/support', 'support', 'support_agent'],
  ['/admin/billing', 'billing', 'payments'],
  ['/admin/system', 'system', 'monitor_heart'],
  ['/admin/notices', 'notices', 'campaign'],
  ['/admin/videos', 'content', 'video_library'],
  ['/admin/settings', 'settings', 'settings'],
] as const;

export default function AdminLayout() {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();

  const link = (to: string, key: string, icon: string, mobile: boolean) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/admin'}
      className={({ isActive }) =>
        mobile
          ? `flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 font-label-md text-[14px] font-semibold ${isActive ? 'bg-primary text-white' : 'text-white/80'}`
          : `flex items-center gap-3 rounded-[12px] px-4 py-2.5 font-label-md text-[16px] font-semibold transition-colors ${
              isActive ? 'bg-primary text-white shadow-[0_6px_16px_rgb(8_102_255/35%)]' : 'text-white/80 hover:bg-white/10'
            }`
      }
    >
      <span className="material-symbols-outlined text-[22px]" aria-hidden>{icon}</span>
      {t(`adminV2.nav.${key}`)}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background md:flex">
      {/* 모바일 상단 */}
      <header className="sticky top-0 z-30 bg-deep-navy md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BrandMark className="h-8 w-10" />
            <span className="font-display-lg text-[17px] font-black text-white">{t('admin.brandTitle')}</span>
          </div>
          <button type="button" onClick={() => void signOut()} className="font-label-md text-[14px] text-white/80">{t('admin.logout')}</button>
        </div>
        <nav aria-label={t('admin.brandTitle')} className="flex gap-1 overflow-x-auto px-3 pb-3">
          {ITEMS.map(([to, key, icon]) => link(to, key, icon, true))}
        </nav>
      </header>

      {/* 데스크톱 사이드바 */}
      <aside className="sticky top-0 hidden h-[100dvh] w-[15.5rem] shrink-0 flex-col overflow-y-auto bg-deep-navy py-6 md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-5">
          <BrandMark className="h-9 w-11 shrink-0" />
          <div className="min-w-0">
            <div className="font-display-lg text-[18px] font-black leading-tight text-white">{t('admin.brandTitle')}</div>
            <div className="truncate font-caption text-[12px] text-white/60">{session?.user.email}</div>
          </div>
        </div>
        <nav aria-label={t('admin.brandTitle')} className="flex flex-col gap-1 px-3">
          {ITEMS.map(([to, key, icon]) => link(to, key, icon, false))}
        </nav>
        <div className="mt-auto space-y-3 px-4 pt-6">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-caption text-[11px] font-bold tracking-wider text-white">ADMIN</span>
            <LanguageToggle />
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left font-label-md text-[14px] text-white/75 hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>logout</span>
            {t('admin.logout')}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <AdminMfaGate>
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </AdminMfaGate>
        </div>
      </main>
    </div>
  );
}
