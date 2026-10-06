import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BrandMark from '../components/BrandMark';
import {
  codeFromUrl,
  formatPhone,
  forgetStudentToken,
  PortalError,
  savedCode,
  savedToken,
  studentHome,
  studentLogin,
  studentLogout,
  type PortalErrorKind,
  type PortalHome,
} from '../lib/studentPortal';

const shell = 'flex min-h-[100dvh] flex-col bg-[#16213e] text-white';
const field =
  'min-h-12 w-full rounded-xl bg-white px-4 text-xl font-bold text-deep-navy outline-none focus:ring-4 focus:ring-warm-yellow';

/**
 * 학생용 페이지(/s) — 선생님 화면과 따로. 로그인(학원 코드 + 이름 + 학부모 전화번호) 후, 이 기기를 기억한다.
 * 오늘의 수업(새로 배우기)이 들어올 자리와 숙제 목록이 있다.
 */
export default function StudentPortalPage() {
  const [token, setToken] = useState<string | null>(() => savedToken());
  const [home, setHome] = useState<PortalHome | null>(null);
  const [error, setError] = useState<PortalErrorKind | null>(null);

  const load = useCallback(async (tk: string) => {
    setError(null);
    try {
      setHome(await studentHome(tk));
    } catch (e) {
      if (e instanceof PortalError && e.kind === 'expired') {
        forgetStudentToken();
        setToken(null);
        setHome(null);
      } else {
        setError(e instanceof PortalError ? e.kind : 'unknown');
      }
    }
  }, []);

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  if (!token) return <LoginView onDone={(tk) => setToken(tk)} />;
  return (
    <HomeView
      home={home}
      error={error}
      onRetry={() => void load(token)}
      onLogout={async () => {
        await studentLogout(token);
        setHome(null);
        setToken(null);
      }}
    />
  );
}

function Brand() {
  return (
    <div className="flex items-center justify-center gap-2 text-base text-white/70">
      <BrandMark className="h-7 w-7" />
      Classbank
    </div>
  );
}

function LoginView({ onDone }: { onDone: (token: string) => void }) {
  const { t } = useTranslation();
  // 선생님이 준 주소(?c=코드)로 들어오면 코드가 이미 적혀 있다 — 따로 치지 않는다
  const fromLink = useState(() => codeFromUrl())[0];
  const [code, setCode] = useState(() => fromLink || savedCode());
  const [editCode, setEditCode] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PortalErrorKind | null>(null);
  const ready = code.trim().length === 6 && name.trim().length > 0 && phone.replace(/\D/g, '').length >= 10;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await studentLogin(code, name, phone));
    } catch (e) {
      setError(e instanceof PortalError ? e.kind : 'unknown');
      setBusy(false);
    }
  }

  return (
    <form
      className={`${shell} items-center justify-center gap-4 p-6`}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Brand />
      <h1 className="text-center text-3xl font-bold">{t('studentPortal.loginTitle')}</h1>
      <p className="max-w-xs text-center text-base text-white/70">{t('studentPortal.loginHint')}</p>
      {code.length === 6 && !editCode ? (
        <div className="flex w-full max-w-xs items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5">
          <span className="material-symbols-outlined text-[22px] text-warm-yellow">check_circle</span>
          <span className="flex-1 text-base">
            {t('studentPortal.code')} <span className="font-bold tracking-[0.15em]">{code}</span>
          </span>
          <button type="button" onClick={() => setEditCode(true)} className="text-sm text-white/70 underline">
            {t('studentPortal.changeCode')}
          </button>
        </div>
      ) : (
      <label className="flex w-full max-w-xs flex-col gap-1">
        <span className="text-base font-bold">{t('studentPortal.code')}</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6))}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="ABC123"
          className={`${field} text-center tracking-[0.25em]`}
        />
      </label>
      )}
      <label className="flex w-full max-w-xs flex-col gap-1">
        <span className="text-base font-bold">{t('studentPortal.name')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={field} />
      </label>
      <label className="flex w-full max-w-xs flex-col gap-1">
        <span className="text-base font-bold">{t('studentPortal.phone')}</span>
        <input
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          placeholder="010-0000-0000"
          className={field}
        />
        <span className="text-sm text-white/60">{t('studentPortal.phoneHint')}</span>
      </label>
      {error && (
        <p className="max-w-xs text-center text-lg text-warm-yellow" role="alert">
          {t(`studentPortal.err_${error}`)}
        </p>
      )}
      <button type="submit" disabled={!ready || busy} className="min-h-14 rounded-full bg-warm-yellow px-10 text-xl font-bold text-deep-navy disabled:opacity-40">
        {busy ? t('common.loading') : t('studentPortal.login')}
      </button>
    </form>
  );
}

function HomeView({
  home,
  error,
  onRetry,
  onLogout,
}: {
  home: PortalHome | null;
  error: PortalErrorKind | null;
  onRetry: () => void;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  if (error) {
    return (
      <div className={`${shell} items-center justify-center gap-4 p-6 text-center`}>
        <Brand />
        <p className="text-xl font-bold">{t(`studentPortal.err_${error}`)}</p>
        <button type="button" onClick={onRetry} className="min-h-12 rounded-full bg-warm-yellow px-8 text-lg font-bold text-deep-navy">
          {t('studentPortal.retry')}
        </button>
      </div>
    );
  }
  if (!home) return <div className={`${shell} items-center justify-center text-lg text-white/70`}>{t('common.loading')}</div>;

  const open = home.homework.filter((h) => !h.done);
  const done = home.homework.filter((h) => h.done);
  return (
    <div className={`${shell} gap-5 p-5`}>
      <header className="mx-auto flex w-full max-w-xl items-center gap-3">
        <BrandMark className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-2xl font-bold">{t('studentPortal.hello', { name: home.name })}</div>
          <div className="truncate text-sm text-white/60">{[home.academy, home.class_name].filter(Boolean).join(' · ')}</div>
        </div>
        <button type="button" onClick={onLogout} className="rounded-full border border-white/30 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10">
          {t('studentPortal.logout')}
        </button>
      </header>

      <section className="mx-auto w-full max-w-xl rounded-3xl bg-white/10 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <span className="material-symbols-outlined text-[24px] text-warm-yellow">school</span>
          {t('studentPortal.todayLesson')}
        </h2>
        <p className="text-base text-white/70">{t('studentPortal.todayLessonEmpty')}</p>
      </section>

      <section className="mx-auto w-full max-w-xl rounded-3xl bg-white/10 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          <span className="material-symbols-outlined text-[24px] text-warm-yellow">edit_note</span>
          {t('studentPortal.homework')}
        </h2>
        {home.homework.length === 0 && <p className="text-base text-white/70">{t('studentPortal.homeworkEmpty')}</p>}
        <ul className="flex flex-col gap-3">
          {[...open, ...done].map((h) => (
            <li key={h.access}>
              <a
                href={`/hw/p/${h.access}`}
                className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 ${h.done ? 'bg-white/10 text-white/70' : 'bg-white text-deep-navy'}`}
              >
                <span className="material-symbols-outlined text-[26px]">{h.done ? 'task_alt' : 'play_circle'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold">{h.title || t('studentHw.defaultTitle')}</span>
                  {h.due_at && (
                    <span className="block text-sm opacity-70">
                      {t('studentHw.dueAt', { date: new Date(h.due_at).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })}
                    </span>
                  )}
                </span>
                <span className="text-base font-bold">{h.done ? t('studentPortal.done') : t('studentPortal.start')}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
