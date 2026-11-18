import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createParentInvite, disconnectParent, loadParentAccount, removeParentAccount, saveParentAccount, type ParentAccount,
} from '../lib/parentPortal';
import { formatPhone } from '../lib/studentPortal';
import type { Student } from '../lib/types';

const input = 'w-full rounded-lg border border-outline-variant px-3 py-2';
const primary = 'rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const secondary = 'rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-deep-navy disabled:opacity-50';

export default function ParentAccessPanel({ students }: { students: Student[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState('');
  const student = students.find((s) => s.id === chosen) ?? students[0];
  if (!student) return null;
  return (
    <details className="rounded-xl border border-outline-variant bg-white p-4" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-bold text-deep-navy">{t('parentPortal.staffTitle')}</summary>
      {open && <div className="mt-3 space-y-3">
        <select aria-label={t('parentPortal.child')} value={student.id} onChange={(e) => setChosen(e.target.value)}
          className="max-w-full rounded-lg border border-outline-variant px-3 py-2">
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <AccountForm key={student.id} id={student.id} />
      </div>}
    </details>
  );
}

function AccountForm({ id }: { id: string }) {
  const { t } = useTranslation();
  const [account, setAccount] = useState<ParentAccount | null>();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    loadParentAccount(id).then((value) => {
      if (current) setAccount(value);
    }).catch(() => {
      if (current) setMessage('failed');
    });
    return () => { current = false; };
  }, [id, loadAttempt]);

  const digits = phone.replace(/\D/g, '');
  const ready = name.trim().length > 0 && digits.length >= 10 && consent;

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setInvite('');
    try { await action(); }
    catch { setMessage('failed'); }
    finally { setBusy(false); }
  }

  function edit() {
    setName(account?.name ?? '');
    setPhone('');
    setConsent(false);
    setInvite('');
    setEditing(true);
  }

  return <div className="max-w-xl space-y-3">
    {account === undefined ? (
      message ? <button type="button" className={secondary} onClick={() => {
        setMessage('');
        setLoadAttempt((n) => n + 1);
      }}>{t('parentPortal.retry')}</button>
        : <p role="status" className="text-sm">{t('common.loading')}</p>
    ) : (editing || !account) ? (
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        void run(async () => {
          await saveParentAccount(id, name.trim(), phone, consent);
          setAccount({ name: name.trim(), last4: digits.slice(-4) });
          setEditing(false);
          setPhone('');
          setConsent(false);
          setMessage('accountSaved');
        });
      }}>
        <p className="text-sm text-on-surface-variant">{t(account ? 'parentPortal.accountEditHint' : 'parentPortal.accountHint')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-bold">
            <span>{t('parentPortal.guardianName')}</span>
            <input className={input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </label>
          <label className="space-y-1 text-sm font-bold">
            <span>{t('parentPortal.guardianPhone')}</span>
            <input className={input} type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} disabled={busy} />
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />
          <span>{t('parentPortal.guardianConsent')}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primary} disabled={busy || !ready}>{t(account ? 'common.save' : 'parentPortal.makeAccount')}</button>
          {account && <button type="button" className={secondary} disabled={busy} onClick={() => { setEditing(false); setPhone(''); }}>{t('common.cancel')}</button>}
        </div>
      </form>
    ) : (
      <>
        <p className="font-bold text-deep-navy">{account.name} · ···{account.last4}</p>
        <p className="text-sm text-on-surface-variant">{t('parentPortal.staffHint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} className={primary}
            onClick={() => void run(async () => setInvite(await createParentInvite(id)))}>{t('parentPortal.makeInvite')}</button>
          <button type="button" disabled={busy} className={secondary} onClick={edit}>{t('parentPortal.editAccount')}</button>
          <button type="button" disabled={busy} className="px-3 py-2 text-sm underline"
            onClick={() => {
              if (!window.confirm(t('parentPortal.revokeConfirm'))) return;
              void run(async () => { await disconnectParent(id); setMessage('revoked'); });
            }}>{t('parentPortal.revoke')}</button>
          <button type="button" disabled={busy} className="px-3 py-2 text-sm text-error underline"
            onClick={() => {
              if (!window.confirm(t('parentPortal.removeAccountConfirm'))) return;
              void run(async () => {
                await removeParentAccount(id);
                setAccount(null);
                setName('');
                setPhone('');
                setConsent(false);
                setMessage('accountRemoved');
              });
            }}>{t('parentPortal.removeAccount')}</button>
        </div>
      </>
    )}
    {invite && <div className="flex flex-wrap gap-2">
      <input readOnly value={invite} aria-label={t('parentPortal.inviteLabel')} onFocus={(e) => e.target.select()}
        className="min-w-0 flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm" />
      <button type="button" className={secondary} onClick={async () => {
        try { await navigator.clipboard.writeText(invite); setMessage('copied'); }
        catch { setMessage('copyManually'); }
      }}>{t('parentPortal.copy')}</button>
    </div>}
    {message && <p role="status" className="text-sm">{t(`parentPortal.${message}`)}</p>}
  </div>;
}
