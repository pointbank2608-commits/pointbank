import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminLayout from './pages/AdminLayout';
import AdminAcademiesPage from './pages/AdminAcademiesPage';
import AppLayout from './pages/AppLayout';
import AttendancePage from './pages/AttendancePage';
import AuthPage from './pages/AuthPage';
import ClassBoardPage from './pages/ClassBoardPage';
import GamesPage from './pages/GamesPage';
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';
import StudentPage from './pages/StudentPage';
import WheelPage from './pages/WheelPage';

export default function App() {
  const { loading, session, profile, isStaff, isAdmin } = useAuth();

  if (loading) {
    return <div className="page-loading">불러오는 중…</div>;
  }

  // 1) 로그인 전 — 첫 화면은 서비스 소개(랜딩), 로그인/가입은 /login
  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // 2) 로그인은 했지만 아직 학원에 소속되지 않음
  if (!profile) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    );
  }

  // 3) 플랫폼 관리자 — 학원 소속과 무관한 별도 화면
  if (isAdmin) {
    return (
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminAcademiesPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    );
  }

  // 4) 정상 이용
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {isStaff ? (
          <>
            <Route path="/board" element={<ClassBoardPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/games/wheel" element={<WheelPage />} />
            <Route path="*" element={<Navigate to="/board" replace />} />
          </>
        ) : (
          // 학생은 자기 통장과 게임만 본다. 순위/결과 화면은 노출하지 않는다.
          <>
            <Route path="/me" element={<StudentPage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/games/wheel" element={<WheelPage />} />
            <Route path="*" element={<Navigate to="/me" replace />} />
          </>
        )}
      </Route>
    </Routes>
  );
}
