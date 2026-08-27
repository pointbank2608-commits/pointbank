import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const { session, signOut } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand">
            <div className="brand-mark">🐷</div>
            <div className="brand-text">
              <div className="name">클래스뱅크 관리자</div>
              <div className="sub">{session?.user.email}</div>
            </div>
          </div>
          <div className="topbar-user">
            <span className="role-pill">ADMIN</span>
            <button className="linkish" onClick={() => void signOut()}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
