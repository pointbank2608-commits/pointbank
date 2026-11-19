import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  disconnectParent, loadParentAccount, removeParentAccount, publishParentFeedback, type ParentAccount,
} from '../lib/parentPortal';
import type { Student } from '../lib/types';

const primary = 'rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const secondary = 'rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-deep-navy disabled:opacity-50';

export default function ParentAccessPanel({ students, revision = 0, onEditStudent }: {
  students: Student[];
  revision?: number;
  onEditStudent: (student: Student) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState('');
  const student = students.find((entry) => entry.id === chosen) ?? students[0];
  if (!student) return null;
  return (
    <details className="rounded-xl border border-outline-variant bg-white p-4" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer font-bold text-deep-navy">{t('parentPortal.staffTitle')}</summary>
      {open && <div className="mt-3 space-y-3">
        <select aria-label={t('parentPortal.child')} value={student.id} onChange={(event) => setChosen(event.target.value)}
          className="max-w-full rounded-lg border border-outline-variant px-3 py-2">
          {students.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
        <AccountStatus key={student.id} student={student} revision={revision} onEdit={() => onEditStudent(student)} />
      </div>}
    </details>
  );
}

function AccountStatus({ student, revision, onEdit }: { student: Student; revision: number; onEdit: () => void }) {
  const { t } = useTranslation();
  const [account, setAccount] = useState<ParentAccount | null>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    loadParentAccount(student.id).then((value) => {
      if (current) { setAccount(value); setMessage(''); }
    }).catch(() => { if (current) setMessage('failed'); });
    return () => { current = false; };
  }, [student.id, revision, loadAttempt]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try { await action(); }
    catch { setMessage('failed'); }
    finally { setBusy(false); }
  }

  return <div className="max-w-xl space-y-3">
    {account === undefined ? (
      message ? <button type="button" className={secondary} onClick={() => {
        setMessage(''); setLoadAttempt((value) => value + 1);
      }}>{t('parentPortal.retry')}</button> : <p role="status">{t('common.loading')}</p>
    ) : !account ? (
      <>
        <p className="text-sm">{t('parentPortal.registerInStudentInfo')}</p>
        <button type="button" className={primary} onClick={onEdit}>{t('parentPortal.studentInfoTitle')}</button>
      </>
    ) : (
      <>
        <p className="font-bold">{account.name} · ···{account.last4}</p>
        <p className="text-sm text-on-surface-variant">{t('parentPortal.staffHint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={primary} onClick={async () => {
            try { await navigator.clipboard.writeText(`${location.origin}/p`); setMessage('loginLinkCopied'); }
            catch { setMessage('loginLinkManual'); }
          }}>{t('parentPortal.copyLoginLink')}</button>
          <button type="button" disabled={busy} className={secondary} onClick={onEdit}>{t('parentPortal.studentInfoTitle')}</button>
          <button type="button" disabled={busy} className="px-3 py-2 text-sm underline" onClick={() => {
            if (!window.confirm(t('parentPortal.revokeConfirm'))) return;
            void run(async () => { await disconnectParent(student.id); setMessage('revoked'); });
          }}>{t('parentPortal.revoke')}</button>
          <button type="button" disabled={busy} className="px-3 py-2 text-sm text-error underline" onClick={() => {
            if (!window.confirm(t('parentPortal.removeAccountConfirm'))) return;
            void run(async () => { await removeParentAccount(student.id); setAccount(null); setMessage('accountRemoved'); });
          }}>{t('parentPortal.removeAccount')}</button>
        </div>
        <FeedbackForm student={student.id} />
      </>
    )}
    {message && <p role="status" className="text-sm">{t(`parentPortal.${message}`)}</p>}
  </div>;
}

function FeedbackForm({ student }: { student: string }) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [request, setRequest] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  return <form className="space-y-2 border-t border-outline-variant pt-4" onSubmit={async (event) => {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setStatus('');
    try {
      await publishParentFeedback(student, body, request);
      setBody('');
      setRequest(crypto.randomUUID());
      setStatus('feedbackSent');
    } catch { setStatus('failed'); }
    finally { setBusy(false); }
  }}>
    <label className="block space-y-1 text-sm font-bold">
      <span>{t('parentPortal.feedbackLabel')}</span>
      <textarea className="w-full rounded-lg border border-outline-variant px-3 py-2" rows={4} maxLength={2000} value={body} disabled={busy} onChange={(event) => {
        setBody(event.target.value); setRequest(crypto.randomUUID()); setStatus('');
      }} />
    </label>
    <p className="text-sm text-on-surface-variant">{t('parentPortal.feedbackHint')}</p>
    <button type="submit" className={primary} disabled={busy || !body.trim()}>{t('parentPortal.sendFeedback')}</button>
    {status && <p role="status" className="text-sm">{t(`parentPortal.${status}`)}</p>}
  </form>;
}
