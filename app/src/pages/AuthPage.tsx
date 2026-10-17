import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import BrandMark from '../components/BrandMark';
import LanguageToggle from '../components/LanguageToggle';
import { friendlyError, supabase } from '../lib/supabase';

type Mode = 'login' | 'signup';

/** 삽화 가장자리를 바탕에 녹인다(위·왼쪽·오른쪽은 흐리게, 아래는 화면 끝까지) */
const SCENE_MASK = {
  maskImage: 'linear-gradient(to right, transparent 0, #000 16%, #000 86%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 22%, #000 100%)',
  WebkitMaskImage: 'linear-gradient(to right, transparent 0, #000 16%, #000 86%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 22%, #000 100%)',
  maskComposite: 'intersect',
  WebkitMaskComposite: 'source-in',
} as const;

const INPUT =
  'w-full rounded-[12px] border border-outline-variant bg-surface-container-lowest px-4 py-4 font-body-md text-[17px] text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/25 outline-none';

/** 로그인·회원가입 — 시안(01_login_selected): 왼쪽 브랜드 문구·삽화, 오른쪽 흰 카드. 인증 흐름은 그대로다. */
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

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      aria-pressed={mode === m}
      className={`flex-1 rounded-[10px] py-3.5 font-title-md text-[18px] transition-all ${
        mode === m ? 'bg-primary text-on-primary shadow-sm' : 'text-deep-navy hover:bg-primary/5'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fcfbf7]">
      {/* 은은한 바탕 — 왼쪽은 따뜻한 크림, 오른쪽은 연한 하늘색 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_20%_30%,#fff6e0_0%,transparent_70%),radial-gradient(50%_60%_at_95%_10%,#e8f3ff_0%,transparent_70%)]"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-5 pb-8 pt-5 sm:px-8 lg:px-[6.2%] lg:pb-0">
        <header className="flex items-center justify-between">
          <BrandLogo className="h-10 w-auto sm:h-12" />
          <LanguageToggle className="!bg-white/80 !p-1 shadow-sm [&_button]:!px-4 [&_button]:!py-1.5 [&_button]:!text-[15px] [&_button]:!font-bold" />
        </header>

        <div className="mt-8 grid flex-1 items-stretch gap-8 lg:mt-6 lg:grid-cols-[1fr_minmax(420px,0.78fr)] lg:gap-10">
          {/* 왼쪽: 브랜드 문구 + 삽화 */}
          <section className="relative order-2 lg:order-1 lg:min-h-[560px] lg:pt-6">
            <h1 className="font-display-lg text-[clamp(2.1rem,5.2vw,4.1rem)] font-black leading-[1.18] tracking-[-0.03em] text-deep-navy [word-break:keep-all]">
              {t('auth.heroLine1')}
              <br />
              <span className="text-primary">{t('auth.heroBrand')}</span>
              {t('auth.heroLine2Rest')}
            </h1>
            <p className="mt-4 font-body-lg text-[clamp(1.05rem,1.6vw,1.45rem)] text-on-surface-variant">{t('auth.heroSub')}</p>
            <img
              src="/ui2/login-scene.webp"
              alt=""
              aria-hidden
              width={1264}
              height={848}
              draggable={false}
              style={SCENE_MASK}
              className="pointer-events-none mt-6 w-full max-w-[860px] select-none object-cover lg:absolute lg:bottom-0 lg:left-[-9%] lg:mt-0 lg:w-[112%] lg:max-w-none"
            />
          </section>

          {/* 오른쪽: 로그인 카드 */}
          <section className="relative z-10 order-1 flex items-start lg:order-2 lg:items-center">
            <div className="mx-auto w-full max-w-[560px] rounded-[26px] border border-primary-fixed/80 bg-white p-6 shadow-[0_18px_60px_rgb(16_43_80/9%)] sm:p-10 lg:ml-auto lg:py-12">
              <div className="mb-9 flex items-center gap-4">
                <BrandMark className="h-10 w-auto shrink-0 sm:h-14" />
                <div className="min-w-0">
                  <h2 className="font-headline-lg-mobile text-[clamp(1.25rem,2vw,1.7rem)] font-extrabold leading-tight text-deep-navy [word-break:keep-all]">
                    {t('auth.welcome')}
                  </h2>
                  <p className="mt-0.5 font-body-md text-body-md text-on-surface-variant [word-break:keep-all]">
                    {mode === 'login' ? t('auth.welcomeSub') : t('auth.welcomeSignup')}
                  </p>
                </div>
              </div>

              <div className="mb-8 flex rounded-[12px] bg-primary-fixed p-1.5">
                {tab('login', t('auth.login'))}
                {tab('signup', t('auth.signup'))}
              </div>

              {error && (
                <div role="alert" className="mb-4 rounded-lg bg-error-container px-4 py-3 font-body-md text-sm text-on-error-container">
                  {error}
                </div>
              )}
              {info && (
                <div role="status" className="mb-4 rounded-lg bg-primary-fixed px-4 py-3 font-body-md text-sm text-deep-navy">
                  {info}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="mb-2.5 block font-label-md text-[16px] font-bold text-deep-navy">
                    {t('auth.email')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="mb-2.5 block font-label-md text-[16px] font-bold text-deep-navy">
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
                    placeholder={mode === 'login' ? t('auth.passwordPlaceholderLogin') : t('auth.passwordHint')}
                    className={INPUT}
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 w-full rounded-[12px] bg-primary py-[1.15rem] font-title-md text-[21px] font-extrabold text-on-primary shadow-[0_8px_20px_rgb(8_102_255/28%)] transition-colors hover:bg-primary-container disabled:opacity-60"
                >
                  {busy ? t('auth.processing') : mode === 'login' ? t('auth.submitLogin') : t('auth.submitSignup')}
                </button>
              </form>

              <p className="mt-8 max-w-[30rem] font-body-md text-[16px] leading-relaxed text-deep-navy [word-break:keep-all]">
                {t('auth.footnote')}
                <br />
                <span className="text-on-surface-variant">{t('auth.footnoteBeta')}</span>
              </p>

              <Link to="/" className="mt-9 block text-center font-body-md text-[16px] text-on-surface-variant transition-colors hover:text-primary">
                {t('auth.backToLanding')}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
