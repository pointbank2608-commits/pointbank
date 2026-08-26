import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { friendlyError, supabase } from '../lib/supabase';

type Mode = 'login' | 'signup';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // 로그인 성공 시 AuthContext 가 세션을 감지해 화면을 전환한다.
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setInfo(
            '가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 인증한 뒤 로그인해 주세요.',
          );
          setMode('login');
        }
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">🐷</div>
          <div>
            <div className="title">클래스뱅크</div>
            <div className="sub">학원용 포인트 통장</div>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => switchMode('login')}
          >
            로그인
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => switchMode('signup')}
          >
            회원가입
          </button>
        </div>

        {error && <div className="alert error">{error}</div>}
        {info && <div className="alert info">{info}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@example.com"
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
            />
          </div>
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? '처리 중…' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>

        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 16, lineHeight: 1.6 }}>
          선생님·원장님은 회원가입 후 학원을 만들거나 초대 코드로 합류할 수 있어요.
          <br />
          (베타 기간 동안은 원장·선생님만 로그인할 수 있습니다.)
        </p>

        <Link
          to="/"
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: 14,
            fontSize: 13.5,
            color: 'var(--ink-soft)',
          }}
        >
          ← 서비스 소개로 돌아가기
        </Link>
      </div>
    </div>
  );
}
