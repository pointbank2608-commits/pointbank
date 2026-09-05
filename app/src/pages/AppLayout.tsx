import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import LanguageToggle from '../components/LanguageToggle';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

export default function AppLayout() {
  const { academy, profile, pointUnit, isStaff, signOut } = useAuth();
  const { notify } = useToast();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const ROLE_LABEL: Record<string, string> = {
    owner: t('nav.roleOwner'),
    teacher: t('nav.roleTeacher'),
    student: t('nav.roleStudent'),
  };

  // 선생님은 대시보드에서 출석부·포인트 뱅크·게임·리포트로 들어간다. 학생은 자기 통장과 게임만.
  const navItems: NavItem[] = isStaff
    ? [
        { to: '/dashboard', label: t('nav.dashboard'), icon: 'dashboard' },
        { to: '/attendance', label: t('nav.attendance'), icon: 'calendar_today' },
        { to: '/board', label: t('nav.board'), icon: 'payments' },
        { to: '/games', label: t('nav.gameCenter'), icon: 'sports_esports' },
        { to: '/dictionary', label: t('nav.dictionary'), icon: 'menu_book' },
        { to: '/phonics', label: t('nav.phonics'), icon: 'spellcheck' },
        { to: '/wordlists', label: t('nav.wordLists'), icon: 'library_books' },
        { to: '/results', label: t('nav.reports'), icon: 'assessment' },
      ]
    : [
        { to: '/me', label: t('nav.myBoard'), icon: 'account_balance_wallet' },
        { to: '/games', label: t('nav.games'), icon: 'sports_esports' },
      ];

  const homeTo = isStaff ? '/dashboard' : '/me';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg font-label-md text-label-md transition-all ${
      isActive
        ? 'bg-secondary-container text-on-secondary-container font-bold'
        : 'text-on-surface-variant hover:bg-soft-mint/20'
    }`;

  const sidebarContent = (
    <>
      <Link to={homeTo} className="flex items-center gap-3 px-4 py-2 mb-6" onClick={() => setMobileOpen(false)}>
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
          {academy?.logo_url ? (
            <img src={academy.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <BrandMark className="h-10 w-10" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="font-title-md text-title-md text-deep-navy leading-tight truncate">
            {academy?.name ?? t('common.brand')}
          </h1>
          <p className="font-caption text-caption text-on-surface-variant">
            {t('nav.pointUnitLabel', { unit: pointUnit })}
          </p>
        </div>
      </Link>

      {isStaff && (
        <Link
          to="/board"
          onClick={() => setMobileOpen(false)}
          className="mb-6 mx-4 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3 px-4 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          {t('nav.addPoints')}
        </Link>
      )}

      <ul className="flex-1 flex flex-col gap-1 px-2">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} onClick={() => setMobileOpen(false)} className={navLinkClass}>
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="mt-auto px-2 pb-2 pt-4 border-t border-outline-variant/30 flex flex-col gap-2">
        {isStaff && (
          <NavLink to="/settings" onClick={() => setMobileOpen(false)} className={navLinkClass}>
            <span className="material-symbols-outlined">settings</span>
            {t('nav.settings')}
          </NavLink>
        )}
        <div className="px-4 py-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md text-sm shrink-0">
            {(profile?.display_name ?? t('common.avatarInitialFallback')).slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="font-label-md text-label-md text-on-surface truncate">{profile?.display_name}</p>
            <p className="font-caption text-caption text-on-surface-variant">
              {ROLE_LABEL[profile?.role ?? ''] ?? ''}
            </p>
          </div>
        </div>
        <div className="px-4">
          <LanguageToggle />
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-soft-mint/20 transition-all text-left"
        >
          <span className="material-symbols-outlined">logout</span>
          {t('nav.signOut')}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background font-body-md text-on-background">
      {/* 모바일 상단바 */}
      {/* iOS PWA(홈 화면 추가, viewport-fit=cover + black-translucent 상태 바)에서는 상태 바 영역이
          웹뷰 위에 겹쳐 그려지고 그 영역의 터치는 시스템이 가로채 버려서, 헤더가 화면 맨 위(y=0)에서
          시작하면 왼쪽 메뉴 버튼이 그 영역에 걸려 눌리지 않는다. safe-area-inset-top 만큼 아래로
          밀어서 실제 탭 영역이 상태 바 밖으로 나오게 한다. */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 bg-surface-container-lowest shadow-sm flex items-center justify-between px-margin-mobile z-40 pt-[env(safe-area-inset-top,0px)]"
        style={{ height: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 text-on-surface-variant"
          aria-label={t('nav.openMenu')}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="font-title-md text-title-md text-primary truncate">
          {academy?.name ?? t('common.brand')}
        </span>
        <div className="w-9" aria-hidden />
      </header>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-inverse-surface/40 z-50" onClick={() => setMobileOpen(false)}>
          <nav
            className="h-full w-72 max-w-[80vw] bg-surface-container-low flex flex-col pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </nav>
        </div>
      )}

      {/* 데스크톱 사이드바 */}
      <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant/30 py-6 z-30">
        {sidebarContent}
      </nav>

      <main className="flex-1 min-w-0 md:ml-64 pt-[calc(4rem+env(safe-area-inset-top,0px))] md:pt-0 min-h-screen">
        {/* 데스크톱 상단바 */}
        <header className="hidden md:flex items-center justify-end gap-3 h-20 px-margin-desktop bg-surface-container-lowest sticky top-0 z-20 shadow-sm">
          <LanguageToggle />
          <button
            type="button"
            onClick={() => notify(t('nav.notificationsComingSoon'))}
            className="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors"
            aria-label={t('nav.notifications')}
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <Link
            to={isStaff ? '/settings' : homeTo}
            className="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors"
            aria-label={t('nav.settings')}
          >
            <span className="material-symbols-outlined">settings</span>
          </Link>
          <Link
            to={isStaff ? '/settings' : homeTo}
            className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md text-sm border border-outline-variant/30 shrink-0"
            aria-label={t('nav.myProfile')}
          >
            {(profile?.display_name ?? t('common.avatarInitialFallback')).slice(0, 1)}
          </Link>
        </header>
        <div className="p-margin-mobile md:p-margin-desktop max-w-[1280px] mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
