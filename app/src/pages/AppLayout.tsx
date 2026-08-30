import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL: Record<string, string> = {
  owner: '원장',
  teacher: '선생님',
  student: '학생',
};

export default function AppLayout() {
  const { academy, profile, pointUnit, isStaff, signOut } = useAuth();

  // 선생님은 홈(대시보드)에서 출석·통장·게임으로 들어간다.
  // 헤더에는 홈과, 가끔 쓰는 결과/설정만 남긴다.
  const links = isStaff
    ? [
        { to: '/dashboard', label: '홈' },
        { to: '/results', label: '결과 보기' },
        { to: '/settings', label: '설정' },
      ]
    : [
        { to: '/me', label: '내 통장' },
        { to: '/games', label: '게임' },
      ];

  const homeTo = isStaff ? '/dashboard' : '/me';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-row">
          <Link to={homeTo} className="brand">
            <div className="brand-mark">
              {academy?.logo_url ? (
                <img src={academy.logo_url} alt="" className="brand-mark-img" />
              ) : (
                '🐷'
              )}
            </div>
            <div className="brand-text">
              <div className="name">{academy?.name ?? '클래스뱅크'}</div>
              <div className="sub">클래스뱅크 · 포인트 단위 ‘{pointUnit}’</div>
            </div>
          </Link>
          <div className="topbar-user">
            <button type="button" className="topbar-out" onClick={() => void signOut()}>
              로그아웃
            </button>
            <div className="topbar-profile">
              <div className="topbar-profile-text">
                <div className="who">{profile?.display_name}</div>
                <div className="role-line">{ROLE_LABEL[profile?.role ?? ''] ?? ''}</div>
              </div>
              <div className="topbar-avatar" aria-hidden>
                {(profile?.display_name ?? '선').slice(0, 1)}
              </div>
            </div>
          </div>
        </div>
        {links.length > 0 && (
          <nav className="subnav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
