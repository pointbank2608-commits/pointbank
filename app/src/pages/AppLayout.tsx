import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL: Record<string, string> = {
  owner: '원장',
  teacher: '선생님',
  student: '학생',
};

export default function AppLayout() {
  const { academy, profile, pointUnit, isStaff, signOut } = useAuth();

  const links = isStaff
    ? [
        { to: '/board', label: '반별 통장' },
        { to: '/games/wheel', label: '돌림판' },
        { to: '/results', label: '결과 보기' },
        { to: '/settings', label: '설정' },
      ]
    : [
        { to: '/me', label: '내 통장' },
        { to: '/games/wheel', label: '돌림판' },
      ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand">
            <div className="brand-mark">₩</div>
            <div className="brand-text">
              <div className="name">{academy?.name ?? '클래스뱅크'}</div>
              <div className="sub">클래스뱅크 · 포인트 단위 ‘{pointUnit}’</div>
            </div>
          </div>
          <div className="topbar-user">
            <span className="who">{profile?.display_name}</span>
            <span className="role-pill">{ROLE_LABEL[profile?.role ?? ''] ?? ''}</span>
            <button className="linkish" onClick={() => void signOut()}>
              로그아웃
            </button>
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
