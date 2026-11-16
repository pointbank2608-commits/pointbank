import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import RemoteTouchpad from '../components/RemoteTouchpad';
import {
  fetchRemotePhoneState, fetchRemotePoints, giveRemotePoints, sendRemoteCmd,
  type RemoteAction, type RemotePairing, type RemotePoints, type RemoteState,
} from '../lib/remote';

const TONE: Record<RemoteAction['tone'], string> = {
  good: 'bg-[#10b981] text-white',
  bad: 'bg-[#f43f5e] text-white',
  primary: 'bg-[#6366f1] text-white',
  neutral: 'bg-surface-container-low text-deep-navy',
  team: 'text-white',
};

function PointsSection({ pair }: { pair: RemotePairing }) {
  const { t } = useTranslation();
  const [points, setPoints] = useState<RemotePoints | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchRemotePoints(pair)
      .then((value) => {
        if (alive) setPoints(value);
      })
      .catch(() => alive && setMsg(t('remote.pointsFailed')));
    return () => {
      alive = false;
    };
  }, [pair, t]);

  function toggle(id: string) {
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function give(p: RemotePoints['presets'][number]) {
    if (!points || points.locked || sel.size === 0 || busy) return;
    const targets = [...sel];
    setBusy(true);
    try {
      await giveRemotePoints(pair, crypto.randomUUID(), p.id, targets);
      setPoints({
        ...points,
        students: points.students.map((s) => sel.has(s.id) ? { ...s, today: s.today + p.delta } : s),
      });
      setMsg(t('remote.pointsGiven', {
        names: points.students.filter((s) => sel.has(s.id)).map((s) => s.name).join(', '),
        delta: `${p.delta > 0 ? '+' : ''}${p.delta}${points.unit || t('common.pointsFallback')}`,
      }));
      setSel(new Set());
    } catch {
      setMsg(t('remote.pointsFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (!points) return <p role="status">{msg ?? t('common.loading')}</p>;
  const { students, presets, locked } = points;
  const allOn = students.length > 0 && sel.size === students.length;
  return (
    <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
      <p className="font-caption text-caption text-on-surface-variant">{t('remote.pointsIntro')}</p>
      {locked && <p className="rounded-lg bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">{t('remote.pointsLocked')}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={locked || busy} onClick={() => setSel(allOn ? new Set() : new Set(students.map((s) => s.id)))} className="rounded-full border border-outline-variant px-3 py-1.5 font-label-md text-label-md text-on-surface-variant">
          {allOn ? t('remote.pointsClear') : t('remote.pointsAll')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {students.map((s) => {
          const on = sel.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              disabled={locked || busy}
              onClick={() => toggle(s.id)}
              className={`flex items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left font-label-md text-label-md active:scale-95 ${on ? 'border-primary bg-primary-container/40 text-deep-navy' : 'border-outline-variant/50 bg-surface-container-low text-on-surface'}`}
            >
              <span className="truncate">{s.name}</span>
              <span className="ml-2 shrink-0 font-caption text-caption text-on-surface-variant">{t('remote.pointsToday', { n: s.today })}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={locked || sel.size === 0 || busy}
            onClick={() => void give(p)}
            className={`rounded-full px-4 py-2.5 font-label-md text-label-md shadow-sm active:scale-95 disabled:opacity-40 ${p.delta >= 0 ? 'bg-warm-yellow text-deep-navy' : 'bg-error-container text-on-error-container'}`}
          >
            {p.label} {p.delta > 0 ? '+' : ''}
            {p.delta}
          </button>
        ))}
      </div>
      {msg && <p className="font-body-sm text-body-sm text-primary">{msg}</p>}
    </section>
  );
}

/**
 * 칠판의 QR로 해당 발표의 리모컨을 연다.
 * 지금 슬라이드·다음 슬라이드를 보면서 앞/뒤로 넘기고, 칠판에는 안 보이는 정답을 혼자 확인한다.
 */
export default function RemotePage() {
  const { id = '' } = useParams();
  const { hash } = useLocation();
  const key = hash.slice(1);
  return <PairedRemote key={`${id}:${key}`} id={id} pairingKey={key} />;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PairedRemote({ id, pairingKey }: { id: string; pairingKey: string }) {
  const { t } = useTranslation();
  const [pair] = useState<RemotePairing>({ id, key: pairingKey });
  const [state, setState] = useState<Partial<RemoteState> | null>(null);
  const [missing, setMissing] = useState(() => !uuid.test(id) || !uuid.test(pairingKey));
  const [connectionError, setConnectionError] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const hide = useRef<number | null>(null);

  useEffect(() => {
    if (missing) return;
    const controller = new AbortController();
    let timer: number;
    async function poll() {
      try {
        const next = await fetchRemotePhoneState(pair, controller.signal);
        if (controller.signal.aborted) return;
        if (next === null) {
          setMissing(true);
          return;
        }
        setState(next);
        setConnectionError(false);
        if (next.ended) return;
      } catch {
        if (controller.signal.aborted) return;
        setConnectionError(true);
      }
      timer = window.setTimeout(poll, 1000);
    }
    void poll();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [pair, missing]);

  // 폰 화면이 꺼지지 않게(되는 기기만)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    void nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => {
      void lock?.release().catch(() => {});
    };
  }, []);

  // 슬라이드나 정답이 바뀌면 정답은 다시 가린다
  const secretKey = state?.secret ? `${state.secret.text}|${state.stepIndex}` : '';
  useEffect(() => {
    setShowSecret(false);
    setConfirmExit(false);
  }, [secretKey, state?.stepIndex]);

  function peek() {
    setShowSecret(true);
    if (hide.current) window.clearTimeout(hide.current);
    hide.current = window.setTimeout(() => setShowSecret(false), 8000);
  }

  function send(name: 'next' | 'prev' | 'goto' | 'exit' | 'action', arg?: number, actionId?: string) {
    try {
      navigator.vibrate?.(15);
    } catch {
      /* 진동 안 되는 기기 */
    }
    setSendError(false);
    void sendRemoteCmd(pair, name, arg, actionId).catch(() => setSendError(true));
  }

  const steps = state?.steps ?? [];
  const idx = state?.stepIndex ?? 0;
  const cur = steps[idx];
  const nextStep = steps[idx + 1];
  const live = state && !state.ended && !connectionError && steps.length > 0;
  const fresh = state && !state.ended && !connectionError;

  if (missing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant">link_off</span>
        <h1 className="font-title-md text-title-md text-deep-navy">{t('remote.missingTitle')}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('remote.missingDesc')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-background p-4">
      <header className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[22px] text-primary">phone_iphone</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-title-md text-title-md text-deep-navy">{state?.lessonName || t('remote.title')}</div>
        </div>
        <span className={`flex items-center gap-1 font-caption text-caption ${fresh ? 'text-[#2e9e5b]' : 'text-on-surface-variant'}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${fresh ? 'bg-[#2e9e5b]' : 'bg-outline'}`} />
          {fresh ? t('remote.connected') : t('remote.waiting')}
        </span>
      </header>
      {(connectionError || sendError) && (
        <p role="status" className="text-center font-body-sm text-body-sm text-on-error-container">{t('remote.connectionError')}</p>
      )}

      {!live ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-surface-container-lowest p-6 text-center shadow-sm">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant">{state?.ended ? 'task_alt' : 'hourglass_top'}</span>
          <div className="font-title-md text-title-md text-deep-navy">{state?.ended ? t('remote.ended') : t('remote.waitingStart')}</div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{state?.ended ? t('remote.endedDesc') : t('remote.waitingStartDesc')}</p>
        </div>
      ) : (
        <>
          {/* 지금 슬라이드 */}
          <section className="rounded-2xl bg-deep-navy p-4 text-white shadow-md">
            <div className="flex items-center gap-2 font-caption text-caption text-white/70">
              <span className="material-symbols-outlined text-[18px]">{cur?.icon}</span>
              {t('remote.now')} · {idx + 1} / {steps.length}
            </div>
            <div className="mt-1 break-words text-2xl font-bold leading-snug">{cur?.label}</div>
            <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 font-body-sm text-body-sm text-white/85">
              {nextStep ? (
                <>
                  <span className="text-white/60">{t('remote.next')}</span> {nextStep.label}
                </>
              ) : (
                t('remote.last')
              )}
            </div>
          </section>

          {/* 정답 — 칠판에는 안 보인다 */}
          {state?.secret && (
            <section className="rounded-2xl border-2 border-warm-yellow bg-surface-container-lowest p-4 shadow-sm">
              <div className="font-label-md text-label-md text-amber-700">{state.secret.title}</div>
              {showSecret ? (
                <div className="mt-1">
                  <div className="break-words text-3xl font-black text-deep-navy">{state.secret.text}</div>
                  {state.secret.sub && <div className="mt-1 text-lg text-on-surface-variant">{state.secret.sub}</div>}
                  <button type="button" onClick={() => setShowSecret(false)} className="mt-2 font-label-md text-label-md text-on-surface-variant underline">
                    {t('remote.hide')}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={peek} className="mt-2 w-full rounded-full bg-warm-yellow py-3 font-title-md text-title-md text-deep-navy shadow-sm active:scale-95">
                  👀 {t('remote.peek')}
                </button>
              )}
            </section>
          )}

          {/* 지금 화면(게임) 조작 — 맞았어요·아니에요·다음 … */}
          {state?.actions && state.actions.length > 0 && (
            <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-3 shadow-sm">
              <div className="font-caption text-caption text-on-surface-variant">{t('remote.actions')}</div>
              <div className="grid grid-cols-2 gap-2">
                {state.actions.map((a, i, arr) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => send('action', undefined, a.id)}
                    className={`min-h-14 rounded-2xl px-3 py-3 font-title-md text-title-md shadow-sm active:scale-95 ${TONE[a.tone]} ${arr.length % 2 === 1 && i === arr.length - 1 ? 'col-span-2' : ''}`}
                    style={a.tone === 'team' ? { background: a.color } : undefined}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 포인트 주기 */}
          {state?.classId ? (
            <>
              <button type="button" onClick={() => setPointsOpen((v) => !v)} className="w-full rounded-full bg-warm-yellow py-3 font-title-md text-title-md text-deep-navy shadow-sm active:scale-95">
                {pointsOpen ? t('remote.pointsClose') : t('remote.pointsOpen')}
              </button>
              {pointsOpen && <PointsSection pair={pair} />}
            </>
          ) : null}

          {state?.pointerEnabled && (
            <RemoteTouchpad pair={pair} step={idx} clickEnabled={state.pointerClickEnabled === true} />
          )}

          {/* 넘기기 */}
          <div className="mt-auto grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => send('prev')}
              className="flex h-28 flex-col items-center justify-center gap-1 rounded-2xl bg-surface-container-low font-title-md text-title-md text-deep-navy shadow-sm active:scale-95 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[36px]">chevron_left</span>
              {t('remote.prev')}
            </button>
            <button
              type="button"
              disabled={idx >= steps.length - 1}
              onClick={() => send('next')}
              className="flex h-28 flex-col items-center justify-center gap-1 rounded-2xl bg-primary font-title-md text-title-md text-on-primary shadow-md active:scale-95 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[36px]">chevron_right</span>
              {t('remote.nextBtn')}
            </button>
          </div>

          {/* 목록·마치기 */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setListOpen((v) => !v)} className="flex-1 rounded-full bg-secondary-container py-2.5 font-label-md text-label-md text-on-secondary-container">
              {listOpen ? t('remote.closeList') : t('remote.openList')}
            </button>
            {confirmExit ? (
              <button type="button" onClick={() => send('exit')} className="rounded-full bg-error px-4 py-2.5 font-label-md text-label-md text-on-error">
                {t('remote.exitYes')}
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmExit(true)} className="rounded-full border border-error px-4 py-2.5 font-label-md text-label-md text-error">
                {t('remote.exit')}
              </button>
            )}
          </div>

          {listOpen && (
            <ol className="max-h-[40vh] space-y-1 overflow-y-auto rounded-2xl bg-surface-container-lowest p-2 shadow-sm">
              {steps.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => send('goto', i)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-body-sm text-body-sm ${i === idx ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}
                  >
                    <span className="w-6 shrink-0 text-center font-bold tabular-nums">{i + 1}</span>
                    <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
