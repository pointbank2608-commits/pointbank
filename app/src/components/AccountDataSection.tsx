import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  cancelAcademyDeletion,
  deletionDaysLeft,
  exportAcademyData,
  myDeletionRequest,
  requestAcademyDeletion,
} from '../lib/account';

const card = 'bg-surface-container-lowest rounded-xl p-5 shadow-card space-y-3';

export default function AccountDataSection() {
  const { t } = useTranslation();
  const { academy, profile } = useAuth();
  const { notify } = useToast();
  const isOwner = profile?.role === 'owner';
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void myDeletionRequest().then(setRequestedAt);
  }, []);

  if (!academy) return null;

  async function download() {
    if (!academy) return;
    setBusy(true);
    try {
      const blob = await exportAcademyData(academy.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `classbank-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify(t('account.exported'));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function requestDelete() {
    setBusy(true);
    try {
      setRequestedAt(await requestAcademyDeletion());
      setConfirmText('');
      notify(t('account.requested'));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await cancelAcademyDeletion();
      setRequestedAt(null);
      notify(t('account.cancelled'));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <h4 className="font-title-md text-title-md text-on-surface">{t('account.title')}</h4>

      <div className="space-y-1">
        <p className="font-caption text-caption text-on-surface-variant">{t('account.exportHint')}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void download()}
          className="rounded-full border border-primary px-4 py-1.5 font-label-md text-label-md text-primary disabled:opacity-50"
        >
          {t('account.export')}
        </button>
      </div>

      {isOwner && requestedAt && (
        <div className="space-y-2 rounded-lg border border-error/40 bg-error-container/40 p-3">
          <p className="font-label-md text-label-md font-bold text-error">
            {t('account.pending', { n: deletionDaysLeft(requestedAt) })}
          </p>
          <p className="font-caption text-caption text-on-surface-variant">{t('account.pendingHint')}</p>
          <button type="button" disabled={busy} onClick={() => void cancel()} className="rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-50">
            {t('account.cancel')}
          </button>
        </div>
      )}

      {isOwner && !requestedAt && (
        <div className="space-y-2 border-t border-outline-variant/40 pt-3">
          <p className="font-label-md text-label-md font-bold text-error">{t('account.deleteAcademy')}</p>
          <p className="whitespace-pre-line font-caption text-caption text-on-surface-variant">
            {t('account.deleteAcademyHint')}
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t('account.typeToConfirm', { text: academy.name })}
            className="w-full max-w-sm rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-error"
          />
          <div>
            <button
              type="button"
              disabled={busy || confirmText.trim() !== academy.name}
              onClick={() => void requestDelete()}
              className="rounded-full border border-error px-4 py-1.5 font-label-md text-label-md text-error disabled:opacity-40"
            >
              {t('account.requestDelete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
