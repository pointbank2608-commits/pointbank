import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL: Record<string, string> = {
  owner: '원장',
  teacher: '선생님',
  student: '학생',
};

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

export default function AppLayout() {
  const { academy, profile, pointUnit, isStaff, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // 선생님은 대시보드에서 출석부·포인트 뱅크·게임·리포트로 들어간다. 학생은 자기 통장과 게임만.
  const navItems: NavItem[] = isStaff
    ? [
        { to: '/dashboard', label: '대시보드', icon: 'dashboard' },
        { to: '/attendance', label: '출석부', icon: 'calendar_today' },
        { to: '/board', label: '포인트 뱅크', icon: 'payments' },
        { to: '/games', label: '게임 센터', icon: 'sports_esports' },
        { to: '/results', label: '리포트', icon: 'assessment' },
      ]
    : [
        { to: '/me', label: '내 통장', icon: 'account_balance_wallet' },
        { to: '/games', label: '게임', icon: 'sports_esports' },
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
        <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center text-xl overflow-hidden shrink-0">
          {academy?.logo_url ? (
            <img src={academy.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            '🐷'
          )}
        </div>
        <div className="min-w-0">
          <h1 className="font-title-md text-title-md text-deep-navy leading-tight truncate">
            {academy?.name ?? '클래스뱅크'}
          </h1>
          <p className="font-caption text-caption text-on-surface-variant">포인트 단위 '{pointUnit}'</p>
        </div>
      </Link>

      {isStaff && (
        <Link
          to="/board"
          onClick={() => setMobileOpen(false)}
          className="mb-6 mx-4 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3 px-4 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          포인트 지급
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

      <div className="mt-auto px-2 pb-2 pt-4 border-t border-outline-variant/30 flex flex-col gap-1">
        {isStaff && (
          <NavLink to="/settings" onClick={() => setMobileOpen(false)} className={navLinkClass}>
            <span className="material-symbols-outlined">settings</span>
            설정
          </NavLink>
        )}
        <div className="px-4 py-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md text-sm shrink-0">
            {(profile?.display_name ?? '선').slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="font-label-md text-label-md text-on-surface truncate">{profile?.display_name}</p>
            <p className="font-caption text-caption text-on-surface-variant">
              {ROLE_LABEL[profile?.role ?? ''] ?? ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-soft-mint/20 transition-all text-left"
        >
          <span className="material-symbols-outlined">logout</span>
          로그아웃
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background font-body-md text-on-background">
      {/* 모바일 상단바 */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-surface-container-lowest shadow-sm flex items-center justify-between px-margin-mobile z-40">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 text-on-surface-variant"
          aria-label="메뉴 열기"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="font-title-md text-title-md text-primary truncate">{academy?.name ?? '클래스뱅크'}</span>
        <div className="w-9" aria-hidden />
      </header>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-inverse-surface/40 z-50" onClick={() => setMobileOpen(false)}>
          <nav
            className="h-full w-72 max-w-[80vw] bg-surface-container-low flex flex-col py-6"
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

      <main className="flex-1 min-w-0 md:ml-64 pt-16 md:pt-0 min-h-screen">
        <div className="p-margin-mobile md:p-margin-desktop max-w-[1280px] mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
