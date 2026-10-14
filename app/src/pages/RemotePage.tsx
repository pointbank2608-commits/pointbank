import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { fetchRemoteSession, sendRemoteCmd, subscribeRemote, type RemoteState } from '../lib/remote';

/**
 * 선생님 폰 리모컨 화면(2026-10-14, 1단계) — /remote/:id. 칠판 화면의 "리모컨" QR로 들어온다(같은 선생님 계정 로그인 필요).
 * 지금 슬라이드·다음 슬라이드를 보면서 앞/뒤로 넘기고, 칠판에는 안 보이는 정답을 혼자 확인한다.
 */
export default function RemotePage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [state, setState] = useState<Partial<RemoteState> | null>(null);
  const [missing, setMissing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const hide = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchRemoteSession(id).then((row) => {
      if (!alive) return;
      if (!row) setMissing(true);
      else {
        setState(row.state);
        setLastSeen(Date.now());
      }
    });
    const stop = subscribeRemote(
      id,
      (row) => {
        setMissing(false);
        setState(row.state);
        setLastSeen(Date.now());
      },
      () => setMissing(true),
    );
    return () => {
      alive = false;
      stop();
    };
  }, [id]);

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

  function send(name: 'next' | 'prev' | 'goto' | 'exit', arg?: number) {
    try {
      navigator.vibrate?.(15);
    } catch {
      /* 진동 안 되는 기기 */
    }
    void sendRemoteCmd(id, name, arg);
  }

  const steps = state?.steps ?? [];
  const idx = state?.stepIndex ?? 0;
  const cur = steps[idx];
  const nextStep = steps[idx + 1];
  const live = state && !state.ended && steps.length > 0;
  const fresh = Date.now() - lastSeen < 8000;

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
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-background p-4">
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
