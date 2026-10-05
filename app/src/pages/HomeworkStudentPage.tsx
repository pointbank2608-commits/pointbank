import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import HomeworkRunner from '../components/homework/HomeworkRunner';
import { answerKey, type AnswerResult, type RunnerApi, type SaveState } from '../components/homework/runnerTypes';
import {
  enqueue,
  flush,
  forgetToken,
  HwError,
  hwFinish,
  hwLoginName,
  hwOpen,
  hwOpenPersonal,
  hwState,
  pendingCount,
  pendingOps,
  readToken,
} from '../lib/homework/studentApi';
import type { HwErrorKind, HwOpenInfo, HwStudentState } from '../lib/homework/types';

type Screen =
  | { k: 'code' }
  | { k: 'loading' }
  | { k: 'login'; info: HwOpenInfo }
  | { k: 'play'; token: string; state: HwStudentState }
  | { k: 'error'; kind: HwErrorKind; retry?: () => void };

const shell = 'flex min-h-[100dvh] flex-col bg-[#16213e] text-white';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

const kindOf = (e: unknown): HwErrorKind => (e instanceof HwError ? e.kind : 'unknown');

/**
 * 학생 숙제(Classbank Student, 2026-10-05 v2) — 가입 없이:
 * ① 반 숙제 번호(/hw/:code) → 내 이름 + PIN 4자리 (명단은 보여 주지 않는다), 또는
 * ② 개인 QR·링크(/hw/p/:access) → 바로 시작.
 * 채점은 서버가 하고, 답은 이 기기에 먼저 적어 둔 뒤 보낸다(인터넷이 끊겨도 이어서, 다시 연결되면 자동 전송).
 * 학생 이름·id 는 URL 에 넣지 않는다.
 */
export default function HomeworkStudentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { code = '', access = '' } = useParams();
  const [screen, setScreen] = useState<Screen>(code || access ? { k: 'loading' } : { k: 'code' });
  const [codeError, setCodeError] = useState<HwErrorKind | null>(null);

  const enter = useCallback(async (tok: string) => {
    const s = await hwState(tok);
    setScreen({ k: 'play', token: tok, state: s });
  }, []);

  const start = useCallback(async () => {
    setScreen({ k: 'loading' });
    // 개인 링크: 열쇠를 받아 반 숙제 주소로 옮긴다(개인 열쇠가 주소창에 남지 않게)
    if (access) {
      try {
        const r = await hwOpenPersonal(access);
        navigate(`/hw/${r.code}`, { replace: true });
      } catch (e) {
        const k = kindOf(e);
        setScreen({ k: 'error', kind: k, retry: k === 'network' ? () => void start() : undefined });
      }
      return;
    }
    if (!code) {
      setScreen({ k: 'code' });
      return;
    }
    const saved = readToken(code);
    if (saved) {
      try {
        await enter(saved);
        return;
      } catch (e) {
        const k = kindOf(e);
        if (k === 'network' || k === 'closed' || k === 'past_due') {
          setScreen({ k: 'error', kind: k, retry: k === 'network' ? () => void start() : undefined });
          return;
        }
        forgetToken(code);
      }
    }
    try {
      const info = await hwOpen(code);
      if (info.closed) setScreen({ k: 'error', kind: 'closed' });
      else if (info.past_due) setScreen({ k: 'error', kind: 'past_due' });
      else setScreen({ k: 'login', info });
    } catch (e) {
      const k = kindOf(e);
      if (k === 'not_found') {
        setCodeError('not_found');
        navigate('/hw', { replace: true });
        setScreen({ k: 'code' });
      } else setScreen({ k: 'error', kind: k, retry: () => void start() });
    }
  }, [access, code, enter, navigate]);

  useEffect(() => {
    void start();
  }, [start]);

  if (screen.k === 'code')
    return (
      <CodeStep
        error={codeError}
        onGo={(c) => {
          setCodeError(null);
          navigate(`/hw/${c}`);
        }}
      />
    );
  if (screen.k === 'loading') return <div className={`${shell} items-center justify-center text-lg text-white/75`}>{t('studentHw.loading')}</div>;
  if (screen.k === 'error') return <ErrorScreen kind={screen.kind} onRetry={screen.retry} onHome={() => navigate('/hw')} />;
  if (screen.k === 'login')
    return (
      <LoginStep
        info={screen.info}
        onLogin={async (name, pin) => {
          const tok = await hwLoginName(code, name, pin);
          await enter(tok);
        }}
      />
    );
  return (
    <PlayScreen
      key={screen.token}
      token={screen.token}
      state={screen.state}
      onFatal={(kind) => setScreen({ k: 'error', kind, retry: kind === 'network' ? () => void start() : undefined })}
      onSwitch={() => {
        forgetToken(code);
        void start();
      }}
    />
  );
}

/* ---------- 숙제 번호 ---------- */

function CodeStep({ error, onGo }: { error: HwErrorKind | null; onGo: (code: string) => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  return (
    <form
      className={`${shell} items-center justify-center gap-5 p-6`}
      onSubmit={(e) => {
        e.preventDefault();
        if (value.length === 6) onGo(value);
      }}
    >
      <Brand />
      <label htmlFor="hw-code" className="text-center text-2xl font-bold">
        {t('studentHw.enterCodeTitle')}
      </label>
      <input
        id="hw-code"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="off"
        placeholder="000000"
        className="w-64 max-w-full rounded-2xl bg-white px-4 py-4 text-center text-4xl font-bold tracking-[0.3em] text-deep-navy outline-none focus:ring-4 focus:ring-warm-yellow"
      />
      {error && (
        <p className="text-center text-lg text-warm-yellow" role="alert">
          {t(`studentHw.err_${error}`)}
        </p>
      )}
      <button type="submit" disabled={value.length !== 6} className="min-h-14 rounded-full bg-warm-yellow px-10 text-xl font-bold text-deep-navy disabled:opacity-40">
        {t('studentHw.start')}
      </button>
    </form>
  );
}

function Brand() {
  return (
    <div className="flex items-center justify-center gap-2 text-base text-white/60">
      <span className="material-symbols-outlined text-[20px]">edit_note</span>
      Classbank
    </div>
  );
}

/* ---------- 이름 + PIN ---------- */

function LoginStep({ info, onLogin }: { info: HwOpenInfo; onLogin: (name: string, pin: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<HwErrorKind | null>(null);
  const ready = name.trim().length > 0 && pin.length === 4;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onLogin(name.trim(), pin);
    } catch (e) {
      setError(kindOf(e));
      setPin('');
      setBusy(false);
    }
  }

  const press = (d: string) => setPin((p) => (p.length < 4 ? p + d : p));
  const key =
    'flex min-h-14 items-center justify-center rounded-2xl bg-white text-3xl font-bold text-deep-navy shadow-[0_4px_0_#9aa3b5] active:translate-y-0.5 active:shadow-none disabled:opacity-50 [touch-action:manipulation]';
  return (
    <form
      className={`${shell} items-center gap-4 p-5`}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Brand />
      <div className="text-center">
        <div className="text-2xl font-bold">{info.title || t('studentHw.defaultTitle')}</div>
        <div className="mt-1 text-base text-white/70">
          {[info.class_name, info.due_at ? t('studentHw.dueAt', { date: new Date(info.due_at).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }) : null]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <label className="flex w-full max-w-xs flex-col gap-1">
        <span className="text-base font-bold">{t('studentHw.myName')}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          className="min-h-12 rounded-xl bg-white px-4 text-xl font-bold text-deep-navy outline-none focus:ring-4 focus:ring-warm-yellow"
        />
      </label>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <span className="text-base font-bold">{t('studentHw.enterPin')}</span>
        {/* 실물 키보드로도 칠 수 있게 숨은 입력칸을 둔다 */}
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          autoComplete="off"
          aria-label={t('studentHw.enterPin')}
          className="min-h-12 rounded-xl bg-white/10 px-4 text-center text-3xl tracking-[0.6em] text-white outline-none focus:ring-4 focus:ring-warm-yellow"
          type="password"
        />
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className={key} onClick={() => press(d)} disabled={busy}>
              {d}
            </button>
          ))}
          <span />
          <button type="button" className={key} onClick={() => press('0')} disabled={busy}>
            0
          </button>
          <button type="button" className={`${key} flex-col gap-0 text-base`} onClick={() => setPin((p) => p.slice(0, -1))} disabled={busy}>
            <span className="material-symbols-outlined">backspace</span>
            {t('studentHw.erase')}
          </button>
        </div>
      </div>
      {error && (
        <p className="max-w-xs text-center text-lg text-warm-yellow" role="alert">
          {t(`studentHw.err_${error}`)}
        </p>
      )}
      <button type="submit" disabled={!ready || busy} className="min-h-14 w-full max-w-xs rounded-full bg-warm-yellow text-xl font-bold text-deep-navy disabled:opacity-40">
        {busy ? t('studentHw.loading') : t('studentHw.start')}
      </button>
      <p className="max-w-xs text-center text-sm text-white/60">{t('studentHw.pinHelp')}</p>
    </form>
  );
}

/* ---------- 오류 화면 ---------- */

const ERROR_ICON: Record<HwErrorKind, string> = {
  not_found: 'search_off',
  closed: 'lock',
  past_due: 'event_busy',
  bad_login: 'person_off',
  locked: 'hourglass_top',
  network: 'wifi_off',
  incomplete: 'pending',
  unknown: 'error',
};

function ErrorScreen({ kind, onRetry, onHome }: { kind: HwErrorKind; onRetry?: () => void; onHome: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={`${shell} items-center justify-center gap-4 p-6 text-center`} role="alert">
      <span className="material-symbols-outlined text-[64px] text-warm-yellow">{ERROR_ICON[kind]}</span>
      <p className="max-w-sm text-2xl font-bold">{t(`studentHw.err_${kind}`)}</p>
      <p className="max-w-sm text-base text-white/70">{t(`studentHw.errHelp_${kind}`)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-14 rounded-full bg-warm-yellow px-10 text-lg font-bold text-deep-navy">
          {t('studentHw.tryAgain')}
        </button>
      )}
      <button type="button" onClick={onHome} className="min-h-12 rounded-full bg-white/15 px-8 text-base font-bold">
        {t('studentHw.otherCode')}
      </button>
    </div>
  );
}

/* ---------- 푸는 화면 ---------- */

function PlayScreen({ token, state, onFatal, onSwitch }: { token: string; state: HwStudentState; onFatal: (k: HwErrorKind) => void; onSwitch: () => void }) {
  const { t } = useTranslation();
  const [saveState, setSaveState] = useState<SaveState>(() => (pendingCount(token) ? 'offline' : 'saved'));
  const finishedRef = useRef(state.finished);

  const initialAnswers = useMemo(() => {
    const m = new Map<string, AnswerResult>();
    for (const a of state.answers) m.set(answerKey(a.item_id, a.q_index), { correct: a.correct, answer: a.answer });
    // 아직 못 보낸 답도 "낸 답"으로(같은 문제를 두 번 묻지 않게)
    for (const op of pendingOps(token)) if (op.op === 'submit' && !m.has(answerKey(op.itemId, op.qIndex))) m.set(answerKey(op.itemId, op.qIndex), { correct: null, answer: null });
    return m;
  }, [state, token]);
  const finishedItems = useMemo(() => new Set(state.item_attempts.filter((x) => x.finished).map((x) => x.item_id)), [state]);
  const shadowLinesDone = useMemo(() => new Map(state.item_attempts.map((x) => [x.item_id, x.meta?.lines ?? 0])), [state]);

  const syncState = useCallback(() => setSaveState(pendingCount(token) ? (navigator.onLine === false ? 'offline' : 'saving') : 'saved'), [token]);

  // 다시 연결되면, 또 밀린 게 있으면 15초마다 보낸다
  useEffect(() => {
    const retry = async () => {
      if (!pendingCount(token)) return;
      setSaveState('saving');
      const r = await flush(token);
      if (!r.ok && r.error && r.error.kind !== 'network' && !finishedRef.current) onFatal(r.error.kind);
      setSaveState(r.ok ? 'saved' : 'offline');
    };
    const onOnline = () => void retry();
    const onOffline = () => pendingCount(token) && setSaveState('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const id = window.setInterval(() => void retry(), 15000);
    void retry();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(id);
    };
  }, [token, onFatal]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      setSaveState('saving');
      try {
        const r = await fn();
        syncState();
        return r;
      } catch (e) {
        const k = kindOf(e);
        setSaveState('error');
        if (!finishedRef.current && k !== 'network') onFatal(k);
        throw e;
      }
    },
    [onFatal, syncState],
  );

  const api = useMemo<RunnerApi>(
    () => ({
      submit: (itemId, qIndex, response, ms) =>
        run(async () => {
          const r = await enqueue(token, { op: 'submit', clientId: newId(), itemId, qIndex, response, ms });
          if (r === 'queued' || !r) return { correct: null, answer: null };
          return { correct: r.correct, answer: r.answer };
        }),
      progress: (itemId, event, meta) =>
        run(async () => {
          await enqueue(token, { op: 'progress', clientId: newId(), itemId, event, meta });
        }),
      finish: async () => {
        setSaveState('saving');
        try {
          const r = await hwFinish(token);
          finishedRef.current = true;
          setSaveState('saved');
          const s = await hwState(token).catch(() => null);
          const answers = s ? new Map(s.answers.map((a) => [answerKey(a.item_id, a.q_index), { correct: a.correct, answer: a.answer } as AnswerResult])) : undefined;
          return { ...r, answers };
        } catch (e) {
          const k = kindOf(e);
          setSaveState(k === 'network' ? 'offline' : 'error');
          if (k !== 'network' && k !== 'incomplete' && !finishedRef.current) onFatal(k);
          throw e;
        }
      },
    }),
    [token, run, onFatal],
  );

  return (
    <div className={shell}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <HomeworkRunner
          title={state.title}
          studentName={state.name}
          items={state.items}
          initialAnswers={initialAnswers}
          finishedItems={finishedItems}
          shadowLinesDone={shadowLinesDone}
          alreadyFinished={state.finished}
          api={api}
          saveState={saveState}
        />
        <div className="flex justify-center pb-4">
          <button type="button" onClick={onSwitch} className="min-h-11 rounded-full px-4 text-sm text-white/60 underline">
            {t('studentHw.switchUser')}
          </button>
        </div>
      </div>
    </div>
  );
}
