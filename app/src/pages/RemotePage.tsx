import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchBalancesOfClass, fetchPresets, fetchSettlement, fetchTransactionsSince, givePoints } from '../lib/api';
import { dateKey, todayStart } from '../lib/format';
import { fetchRemoteSession, sendRemoteCmd, subscribeRemote, type RemoteAction, type RemoteState } from '../lib/remote';
import type { Preset, StudentBalance } from '../lib/types';

const TONE: Record<RemoteAction['tone'], string> = {
  good: 'bg-[#10b981] text-white',
  bad: 'bg-[#f43f5e] text-white',
  primary: 'bg-[#6366f1] text-white',
  neutral: 'bg-surface-container-low text-deep-navy',
  team: 'text-white',
};

/** 포인트 주기 — 칠판의 "포인트 주기"(LessonPointsPanel)와 같은 프리셋·같은 지급 함수를 폰에서 쓴다 */
function PointsSection({ classId }: { classId: string }) {
  const { t } = useTranslation();
  const { academy, profile, pointUnit } = useAuth();
  const [students, setStudents] = useState<StudentBalance[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [today, setToday] = useState<Record<string, number>>({});
  const [locked, setLocked] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!academy?.id) return;
    let alive = true;
    void Promise.all([fetchBalancesOfClass(classId), fetchPresets(academy.id), fetchTransactionsSince(classId, todayStart()), fetchSettlement(classId, dateKey())])
      .then(([bal, pre, txs, settlement]) => {
        if (!alive) return;
        setStudents(bal);
        setPresets(pre);
        const sums: Record<string, number> = {};
        for (const tx of txs) sums[tx.student_id] = (sums[tx.student_id] ?? 0) + tx.delta;
        setToday(sums);
        setLocked(settlement !== null);
      })
      .catch(() => alive && setMsg(t('remote.pointsFailed')));
    return () => {
      alive = false;
    };
  }, [academy?.id, classId, t]);

  function toggle(id: string) {
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function give(p: Preset) {
    if (!academy?.id || !profile || locked || sel.size === 0 || busy) return;
    const targets = [...sel];
    setBusy(true);
    const results = await Promise.allSettled(
      targets.map((studentId) =>
        givePoints({ academyId: academy.id, classId, studentId, delta: p.delta, reason: p.label, teacherId: profile.id, teacherName: profile.display_name, isHomework: p.is_homework }),
      ),
    );
    const ok = targets.filter((_, i) => results[i].status === 'fulfilled');
    setToday((prev) => {
      const n = { ...prev };
      for (const id of ok) n[id] = (n[id] ?? 0) + p.delta;
      return n;
    });
    setMsg(
      ok.length === targets.length
        ? t('remote.pointsGiven', { names: students.filter((s) => sel.has(s.student_id)).map((s) => s.name).join(', '), delta: `${p.delta > 0 ? '+' : ''}${p.delta}${pointUnit}` })
        : t('remote.pointsFailed'),
    );
    if (ok.length === targets.length) setSel(new Set());
    setBusy(false);
    try {
      navigator.vibrate?.(25);
    } catch {
      /* 진동 안 되는 기기 */
    }
  }

  const allOn = students.length > 0 && sel.size === students.length;
  return (
    <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
      <p className="font-caption text-caption text-on-surface-variant">{t('remote.pointsIntro')}</p>
      {locked && <p className="rounded-lg bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">{t('remote.pointsLocked')}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setSel(allOn ? new Set() : new Set(students.map((s) => s.student_id)))} className="rounded-full border border-outline-variant px-3 py-1.5 font-label-md text-label-md text-on-surface-variant">
          {allOn ? t('remote.pointsClear') : t('remote.pointsAll')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {students.map((s) => {
          const on = sel.has(s.student_id);
          return (
            <button
              key={s.student_id}
              type="button"
              disabled={locked}
              onClick={() => toggle(s.student_id)}
              className={`flex items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left font-label-md text-label-md active:scale-95 ${on ? 'border-primary bg-primary-container/40 text-deep-navy' : 'border-outline-variant/50 bg-surface-container-low text-on-surface'}`}
            >
              <span className="truncate">{s.name}</span>
              <span className="ml-2 shrink-0 font-caption text-caption text-on-surface-variant">{t('remote.pointsToday', { n: today[s.student_id] ?? 0 })}</span>
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
  const [pointsOpen, setPointsOpen] = useState(false);
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

  function send(name: 'next' | 'prev' | 'goto' | 'exit' | 'action', arg?: number, actionId?: string) {
    try {
      navigator.vibrate?.(15);
    } catch {
      /* 진동 안 되는 기기 */
    }
    void sendRemoteCmd(id, name, arg, actionId);
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
              {pointsOpen && <PointsSection classId={state.classId} />}
            </>
          ) : null}

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
