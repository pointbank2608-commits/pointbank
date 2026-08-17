import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './pages/AppLayout';
import AuthPage from './pages/AuthPage';
import ClassBoardPage from './pages/ClassBoardPage';
import OnboardingPage from './pages/OnboardingPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';
import StudentPage from './pages/StudentPage';
import WheelPage from './pages/WheelPage';

export default function App() {
  const { loading, session, profile, isStaff } = useAuth();

  if (loading) {
    return <div className="page-loading">불러오는 중…</div>;
  }

  // 1) 로그인 전
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
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

  // 3) 정상 이용
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {isStaff ? (
          <>
            <Route path="/board" element={<ClassBoardPage />} />
            <Route path="/games/wheel" element={<WheelPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/board" replace />} />
          </>
        ) : (
          // 학생은 자기 통장과 돌림판만 본다. 순위/결과 화면은 노출하지 않는다.
          <>
            <Route path="/me" element={<StudentPage />} />
            <Route path="/games/wheel" element={<WheelPage />} />
            <Route path="*" element={<Navigate to="/me" replace />} />
          </>
        )}
      </Route>
    </Routes>
  );
}
