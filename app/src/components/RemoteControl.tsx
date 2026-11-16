import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { useLessonRunner } from '../context/LessonRunnerContext';
import {
  createRemoteSession,
  deleteRemoteSession,
  fetchRemoteSession,
  getRemoteActions,
  getRemoteSecret,
  runRemoteAction,
  subscribeRemoteActions,
  publishRemoteState,
  remoteUrl,
  subscribeRemote,
  subscribeRemoteSecret,
  type RemoteCmd,
  type RemotePairing,
  type RemotePointer,
  type RemoteRow,
} from '../lib/remote';

/**
 * 칠판 쪽 다리(2026-10-14) — 켜져 있는 동안 지금 슬라이드·정답을 폰에 알리고, 폰의 명령(다음·이전·이동·마치기)을 실행한다.
 * 다음·이전은 클리커(PageDown/PageUp)와 똑같이 보내서, 슬라이드 안 단계(문법 예문 하나씩 등)가 먼저 반응한다.
 */
export function RemoteBridge({ id }: { id: string }) {
  const { runner, goTo, exit } = useLessonRunner();
  const secret = useSyncExternalStore(subscribeRemoteSecret, getRemoteSecret, getRemoteSecret);
  const actions = useSyncExternalStore(subscribeRemoteActions, getRemoteActions, getRemoteActions);
  const act = useRef({ goTo, exit });
  act.current = { goTo, exit };
  const lastSeq = useRef(0);
  const lastPointerSeq = useRef(0);
  const published = useRef(false);
  const [pointer, setPointer] = useState<RemotePointer | null>(null);
  const [pointerRoot, setPointerRoot] = useState(() => document.fullscreenElement ?? document.body);

  useEffect(() => {
    function syncPointerRoot() {
      setPointerRoot(document.fullscreenElement ?? document.body);
    }
    document.addEventListener('fullscreenchange', syncPointerRoot);
    return () => document.removeEventListener('fullscreenchange', syncPointerRoot);
  }, []);

  // 지금 상태를 폰에 알린다
  useEffect(() => {
    if (!runner) return;
    function publish() {
      if (!runner) return;
      published.current = true;
      void publishRemoteState(id, {
        lessonName: runner.lessonName,
        stepIndex: runner.stepIndex,
        steps: runner.steps.map((s) => ({ label: s.label, kind: s.kind, icon: s.icon })),
        secret,
        actions,
        classId: runner.classId ?? null,
        ended: false,
        at: Date.now(),
        pointerEnabled: true,
      });
    }
    const timer = window.setTimeout(publish, 120);
    const heartbeat = window.setInterval(publish, 30000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(heartbeat);
    };
  }, [id, runner, secret, actions]);

  // 수업이 끝나면 폰에도 알린다(이 컴포넌트가 사라질 때)
  useEffect(() => {
    return () => {
      if (published.current) {
        void publishRemoteState(id, { lessonName: '', stepIndex: 0, steps: [], secret: null, actions: [], classId: null, ended: true, at: Date.now() });
      }
    };
  }, [id]);

  // 폰의 명령을 받는다
  useEffect(() => {
    let alive = true;
    let hidePointer: number | undefined;
    function run(cmd: Partial<RemoteCmd> | undefined) {
      if (!cmd || typeof cmd.seq !== 'number' || !cmd.name) return;
      if (cmd.seq <= lastSeq.current) return;
      lastSeq.current = cmd.seq;
      if (cmd.name === 'next' || cmd.name === 'prev') {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: cmd.name === 'next' ? 'PageDown' : 'PageUp', bubbles: true, cancelable: true }));
      } else if (cmd.name === 'goto' && typeof cmd.arg === 'number') {
        act.current.goTo(cmd.arg);
      } else if (cmd.name === 'exit') {
        act.current.exit();
      } else if (cmd.name === 'action' && cmd.id) {
        runRemoteAction(cmd.id);
      }
    }
    function receive(row: RemoteRow | null) {
      if (!alive || !row) return;
      run(row.cmd);
      const point = row.pointer;
      if (!point || point.seq <= lastPointerSeq.current || row.state.ended) return;
      lastPointerSeq.current = point.seq;
      setPointer(point);
      window.clearTimeout(hidePointer);
      hidePointer = window.setTimeout(() => setPointer(null), 3000);
    }
    void fetchRemoteSession(id).then(receive);
    const stop = subscribeRemote(id, receive);
    return () => {
      alive = false;
      window.clearTimeout(hidePointer);
      stop();
    };
  }, [id]);

  return pointer && createPortal(
    <svg
      aria-hidden="true"
      data-remote-pointer
      className="pointer-events-none fixed z-[100] h-8 w-7 drop-shadow-md motion-safe:transition-[left,top] motion-safe:duration-100 motion-safe:ease-linear"
      style={{
        left: `min(${pointer.x / 10}%, calc(100% - 28px))`,
        top: `min(${pointer.y / 10}%, calc(100% - 32px))`,
      }}
      viewBox="0 0 28 32"
      fill="none"
    >
      <path d="M2 2v24l6-5 4 9 5-2-4-9h9L2 2Z" fill="#0869f7" stroke="white" strokeWidth="2" strokeLinejoin="round" />
    </svg>,
    pointerRoot,
  );
}

/** 진행바 "리모컨" 창 — 켜면 QR이 뜨고, 폰으로 찍으면 연결된다. */
export function RemotePanel({ pair, classId, onChange, onClose }: {
  pair: RemotePairing | null;
  classId: string | null;
  onChange: (pair: RemotePairing | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setQr(null);
    if (!pair) return;
    let active = true;
    void QRCode.toDataURL(remoteUrl(pair), { margin: 1, width: 360 }).then((value) => {
      if (active) setQr(value);
    }).catch(() => {
      if (active) setError(t('remote.needSetup'));
    });
    return () => { active = false; };
  }, [pair, t]);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      onChange(await createRemoteSession(classId));
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      setError(/remote_|relation|schema cache/i.test(msg) ? t('remote.needSetup') : msg);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!pair) return;
    setBusy(true);
    setError(null);
    try {
      await deleteRemoteSession(pair.id);
      onChange(null);
    } catch {
      setError(t('remote.connectionError'));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!pair) return;
    try {
      await navigator.clipboard.writeText(remoteUrl(pair));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 주소 칸에서 직접 복사 */
    }
  }

  return (
    <div className="no-print fixed inset-0 z-40 flex items-start justify-end p-4 pt-16" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-surface-container-lowest p-5 text-on-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-primary">phone_iphone</span>
          <h2 className="font-title-md text-title-md text-deep-navy">{t('remote.title')}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-full p-1 hover:bg-surface-container" aria-label={t('curriculum.play.keysClose')}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {!pair ? (
          <section className="space-y-3">
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t('remote.intro')}</p>
            <ul className="list-disc space-y-1 pl-5 font-body-sm text-body-sm text-on-surface-variant">
              <li>{t('remote.f1')}</li>
              <li>{t('remote.f2')}</li>
              <li>{t('remote.f3')}</li>
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={() => void turnOn()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
              {busy ? t('common.loading') : t('remote.on')}
            </button>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center gap-4">
              {qr && <img src={qr} alt="QR" className="h-36 w-36 rounded-lg border border-outline-variant/40" />}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="font-label-md text-label-md text-primary">{t('remote.scanTitle')}</div>
                <ol className="list-decimal space-y-1 pl-5 font-body-sm text-body-sm text-on-surface-variant">
                  <li>{t('remote.scan1')}</li>
                  <li>{t('remote.scan2')}</li>
                </ol>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void copy()} className="flex-1 rounded-full bg-secondary-container py-2 font-label-md text-label-md text-on-secondary-container">
                {copied ? t('online.copied') : t('remote.copyLink')}
              </button>
              <button type="button" disabled={busy} onClick={() => void turnOff()} className="rounded-full border border-error px-4 py-2 font-label-md text-label-md text-error hover:bg-error/10 disabled:opacity-50">
                {t('remote.off')}
              </button>
            </div>
            <p className="font-caption text-caption text-on-surface-variant">{t('remote.hint')}</p>
          </section>
        )}
        {error && <p className="font-caption text-caption text-error">{error}</p>}
      </div>
    </div>
  );
}
