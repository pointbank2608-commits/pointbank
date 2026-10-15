import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { buildDiagnostics } from '../lib/errorReporter';
import { createTicket } from '../lib/support';

/**
 * 원클릭 SOS(2026-10-16) — "이거 이상해요". 한 줄만 적어도(안 적어도) 지금 보던 페이지·브라우저·화면 크기·
 * 최근 오류가 자동으로 붙어 문의(오류 분류)로 접수된다. 글 쓰기·캡처가 부담스러운 선생님을 위한 지름길.
 */
export default function SosButton() {
  const { t, i18n } = useTranslation();
  const { isPaid, profile } = useAuth();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const diagnostics = buildDiagnostics({
        plan: isPaid ? 'paid' : 'free',
        role: profile?.role,
        lang: i18n.language,
      });
      const text = note.trim();
      await createTicket({
        category: 'bug',
        subject: text ? text.slice(0, 60) : t('sos.defaultSubject'),
        body: `${text || t('sos.noNote')}\n\n--- ${t('sos.diagnosticsHeading')} ---\n${diagnostics}`,
        attachmentPath: null,
      });
      notify(t('sos.sent'));
      setNote('');
      setOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : t('sos.failed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('sos.button')}
        aria-label={t('sos.button')}
        className="no-print flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
      >
        <span className="material-symbols-outlined">bug_report</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-inverse-surface/40 p-4" onClick={() => !busy && setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md space-y-3 rounded-2xl bg-surface-container-lowest p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-title-md text-title-md text-deep-navy">{t('sos.title')}</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t('sos.intro')}</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={t('sos.placeholder')}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <details className="font-caption text-caption text-on-surface-variant">
              <summary className="cursor-pointer">{t('sos.whatIsSent')}</summary>
              <p className="mt-1 whitespace-pre-line">{t('sos.whatIsSentBody')}</p>
            </details>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void send()}
                className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary disabled:opacity-60"
              >
                {busy ? t('sos.sending') : t('sos.send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
