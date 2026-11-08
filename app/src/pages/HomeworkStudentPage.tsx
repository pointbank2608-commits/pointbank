import { hwSpellingHint } from '../lib/homework/studentApi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import HomeworkRunner from '../components/homework/HomeworkRunner';
import ClassNoticeBanner from '../components/solo/ClassNoticeBanner';
import { hwNotice } from '../lib/soloChat';
import { answerKey, type AnswerResult, type RunnerApi, type SaveState } from '../components/homework/runnerTypes';
import { savedToken } from '../lib/studentPortal';
import { uploadRecording } from '../lib/homework/blockApi';
import {
  enqueue,
  flush,
  forgetToken,
  HwError,
  hwFinish,
  hwOpenPersonal,
  hwState,
  hwWatchReport,
  hwWatchState,
  pendingCount,
  pendingOps,
  readToken,
} from '../lib/homework/studentApi';
import type { HwErrorKind, HwStudentState } from '../lib/homework/types';

type Screen =
  | { k: 'loading' }
  | { k: 'play'; token: string; state: HwStudentState }
  | { k: 'error'; kind: HwErrorKind; retry?: () => void };

const shell = 'flex min-h-[100dvh] flex-col bg-[#16213e] text-white';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

const kindOf = (e: unknown): HwErrorKind => (e instanceof HwError ? e.kind : 'unknown');

/**
 * 학생 숙제(Classbank Student) — 학생 포털(/s)에서 숙제 목록의 개인 링크(/hw/p/:access)로 열린다.
 * 이름 + PIN 으로 들어가는 반 숙제 번호·QR 입구는 없앴다(번호 주소는 이 기기에 열쇠가 있을 때만 이어서 열린다).
 * 채점은 서버가 하고, 답은 이 기기에 먼저 적어 둔 뒤 보낸다(인터넷이 끊겨도 이어서, 다시 연결되면 자동 전송).
 * 학생 이름·id 는 URL 에 넣지 않는다.
 */
export default function HomeworkStudentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { code = '', access = '' } = useParams();
  const [screen, setScreen] = useState<Screen>({ k: 'loading' });

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
      navigate('/s', { replace: true });
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
    // 이 기기에 열쇠가 없으면 학생 포털에서 다시 들어오게 한다
    navigate('/s', { replace: true });
  }, [access, code, enter, navigate]);

  useEffect(() => {
    void start();
  }, [start]);

  if (screen.k === 'loading') return <div className={`${shell} items-center justify-center text-lg text-white/75`}>{t('studentHw.loading')}</div>;
  if (screen.k === 'error') return <ErrorScreen kind={screen.kind} onRetry={screen.retry} onHome={() => navigate('/hw')} />;
  return (
    <PlayScreen
      key={screen.token}
      token={screen.token}
      state={screen.state}
      onFatal={(kind) => setScreen({ k: 'error', kind, retry: kind === 'network' ? () => void start() : undefined })}
      onHome={savedToken() ? () => navigate('/s') : undefined}
    />
  );
}

/* ---------- 오류 화면 ---------- */

const ERROR_ICON: Record<HwErrorKind, string> = {
  not_found: 'search_off',
  feature_closed: 'lock_clock',
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

function PlayScreen({ token, state, onFatal, onHome }: { token: string; state: HwStudentState; onFatal: (k: HwErrorKind) => void; onHome?: () => void }) {
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
      cacheScope: token,
      spellingHint: (item,index,level) => hwSpellingHint(token,item,index,level),
      sensor: { source: 'homework', credential: token, runs: state.sensor_runs },
      uploadRecording: (itemId, blob, duration) => uploadRecording(token, itemId, blob, duration),
      submit: (itemId, qIndex, response, ms) =>
        run(async () => {
          const r = await enqueue(token, { op: 'submit', runId: state.sensor_runs?.[itemId], clientId: newId(), itemId, qIndex, response, ms });
          if (r === 'queued' || !r) return { correct: null, answer: null };
          return { correct: r.correct, answer: r.answer };
        }),
      progress: (itemId, event, meta) =>
        run(async () => {
          await enqueue(token, { op: 'progress', clientId: newId(), itemId, event, meta });
        }),
      // 시청 기록은 5초마다 가는 작은 호출이라 저장 상태 표시(run)에 올리지 않는다
      watch: {
        report: (itemId, viewKey, durationSec, watchedSec) => hwWatchReport(token, itemId, viewKey, durationSec, watchedSec),
        state: () => hwWatchState(token),
      },
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
    [token, run, onFatal, state.sensor_runs],
  );

  return (
    <div className={shell}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="px-4 pt-3">
          <ClassNoticeBanner load={() => hwNotice(token)} />
        </div>
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
          onHome={onHome}
        />
      </div>
    </div>
  );
}
