import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import LanguageToggle from '../components/LanguageToggle';
import { friendlyError, supabase } from '../lib/supabase';

type Mode = 'login' | 'signup';

export default function AuthPage() {
  const { t } = useTranslation();
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
          setInfo(t('auth.signupSentInfo'));
          setMode('login');
        }
      }
    } catch (err) {
      setError(friendlyError(err, t));
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
    <div className="min-h-screen flex items-center justify-center px-margin-mobile bg-background py-10">
      <div className="w-full max-w-[420px] space-y-4">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-[0_8px_30px_rgba(39,101,168,0.12)] border border-surface-container-highest p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🐷</span>
            <div>
              <div className="font-title-md text-title-md text-deep-navy">{t('common.brand')}</div>
              <div className="font-caption text-caption text-on-surface-variant">{t('auth.tagline')}</div>
            </div>
          </div>

          <div className="flex bg-surface-container-low rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 rounded-md font-label-md text-label-md transition-all ${
                mode === 'login' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('auth.login')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 rounded-md font-label-md text-label-md transition-all ${
                mode === 'signup' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('auth.signup')}
            </button>
          </div>

          {error && (
            <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 mb-4 font-body-md text-sm">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-secondary-container text-on-secondary-container rounded-lg px-4 py-3 mb-4 font-body-md text-sm">
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@example.com"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordHint')}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary font-title-md text-title-md py-3 rounded-lg shadow-sm transition-colors"
            >
              {busy ? t('auth.processing') : mode === 'login' ? t('auth.submitLogin') : t('auth.submitSignup')}
            </button>
          </form>

          <p className="font-caption text-caption text-on-surface-variant mt-4 leading-relaxed">
            {t('auth.footnote')}
            <br />
            {t('auth.footnoteBeta')}
          </p>

          <Link
            to="/"
            className="block text-center mt-4 font-caption text-caption text-on-surface-variant hover:text-primary transition-colors"
          >
            {t('auth.backToLanding')}
          </Link>
        </div>
      </div>
    </div>
  );
}
