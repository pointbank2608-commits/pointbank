import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const { session, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background">
      <header className="bg-surface-container-lowest shadow-sm sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐷</span>
            <div>
              <div className="font-title-md text-title-md text-deep-navy">클래스뱅크 관리자</div>
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
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop py-margin-desktop">
        <Outlet />
      </main>
    </div>
  );
}
