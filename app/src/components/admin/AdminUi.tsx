import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { LoadState } from '../../lib/adminOps';

/** 관리자 화면 공통 부품(2026-10-18): 상태 배지·불러오기 상태·사유 입력 창·요약 카드. 색만으로 구분하지 않고 글자를 함께 쓴다. */

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'mute';
const TONE: Record<Tone, string> = {
  ok: 'bg-[#e0f5ea] text-[#0f6b3e]',
  warn: 'bg-[#fff1c2] text-[#7a5400]',
  bad: 'bg-[#ffe1de] text-[#a0201a]',
  info: 'bg-primary-fixed text-[#0a47a6]',
  mute: 'bg-surface-container text-on-surface-variant',
};

export function Badge({ tone = 'mute', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 font-caption text-[12px] font-bold ${TONE[tone]}`}>
      {children}
    </span>
  );
}

export function PageHead({ title, desc, right }: { title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display-lg text-[clamp(1.6rem,2.8vw,2.2rem)] font-black leading-tight tracking-[-0.02em] text-deep-navy">{title}</h1>
        {desc && <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

/** 로딩 / 실패 / 실제 비어 있음을 서로 다르게 보여 준다(실패를 "문제 없음"으로 표시하지 않는다). */
export function DataState<T>({
  state, empty, isEmpty, children, compact = false,
}: {
  state: LoadState<T> & { reload: () => void };
  empty: string;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  if (state.status === 'error' && !state.data) {
    return (
      <div role="alert" className="rounded-xl border border-error/40 bg-error-container/40 p-4">
        <div className="font-label-md text-label-md font-bold text-on-error-container">{t('adminV2.common.loadFailed')}</div>
        <p className="mt-1 break-words font-caption text-caption text-on-error-container">{state.error}</p>
        {state.setupNeeded && <p className="mt-1 font-caption text-caption text-on-error-container">{t('adminV2.common.setupNeeded')}</p>}
        <button type="button" onClick={state.reload} className="mt-2 rounded-full border border-error px-3 py-1 font-label-md text-label-md text-error hover:bg-error/5">
          {t('adminV2.common.retry')}
        </button>
      </div>
    );
  }
  if (state.status === 'loading' && !state.data) {
    return <div role="status" className={`animate-pulse rounded-xl bg-surface-container ${compact ? 'h-12' : 'h-24'}`} aria-label={t('adminV2.common.loading')} />;
  }
  const data = state.data as T;
  const stale = state.status === 'error';
  if (isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0) {
    return <p className="rounded-xl bg-surface-container-low p-4 font-body-md text-body-md text-on-surface-variant">{empty}</p>;
  }
  return (
    <div className={state.status === 'loading' ? 'opacity-70 transition-opacity' : undefined}>
      {stale && (
        <p role="alert" className="mb-2 rounded-lg bg-error-container/40 px-3 py-2 font-caption text-caption text-on-error-container">
          {t('adminV2.common.staleData')}{' '}
          <button type="button" onClick={state.reload} className="font-bold underline">
            {t('adminV2.common.retry')}
          </button>
        </p>
      )}
      {children(data)}
    </div>
  );
}

export function StatCard({
  label, value, to, hint, tone = 'mute',
}: { label: string; value: ReactNode; to?: string; hint?: string; tone?: Tone }) {
  const body = (
    <div className={`h-full rounded-xl border bg-white p-4 shadow-card transition-transform ${to ? 'hover:-translate-y-0.5' : ''} ${tone === 'bad' ? 'border-error/40' : 'border-outline-variant'}`}>
      <div className="font-caption text-[13px] text-on-surface-variant">{label}</div>
      <div className="mt-1 font-display-lg text-[28px] font-extrabold tabular-nums leading-tight text-deep-navy">{typeof value === 'number' ? value.toLocaleString('ko-KR') : value}</div>
      {hint && <div className="mt-0.5 font-caption text-[12px] text-on-surface-variant">{hint}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

/** 사유를 받고 확인하는 창. 사유는 서버 조치 기록에 남는다. */
export function ReasonDialog({
  title, body, confirmLabel, danger = false, minLength = 2, label, onConfirm, onClose, children,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  minLength?: number;
  label?: string;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  const ok = reason.trim().length >= minLength;
  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/50 p-4" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="reason-title" className="w-full max-w-[480px] rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="reason-title" className="font-title-md text-[20px] font-extrabold text-deep-navy">{title}</h2>
        {body && <div className="mt-2 font-body-md text-body-md text-on-surface-variant">{body}</div>}
        {children}
        <label htmlFor="reason-input" className="mt-4 block font-label-md text-label-md font-bold text-deep-navy">{label ?? t('adminV2.common.reasonLabel')}</label>
        <textarea
          id="reason-input"
          ref={ref}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder={t('adminV2.common.reasonPlaceholder')}
          className="mt-1 w-full rounded-lg border border-outline-variant bg-white px-3 py-2 font-body-md text-body-md outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
        />
        {err && <p role="alert" className="mt-2 font-caption text-caption text-error">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-full border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!ok || busy}
            onClick={() => void go()}
            className={`rounded-full px-5 py-2 font-label-md text-label-md font-bold text-white disabled:opacity-50 ${danger ? 'bg-error hover:opacity-90' : 'bg-primary hover:bg-primary-container'}`}
          >
            {busy ? t('adminV2.common.working') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
