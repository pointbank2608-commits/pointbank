import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPhone } from '../lib/studentPortal';
import { loadParentAccount, type ParentAccount } from '../lib/parentPortal';
import { saveStudentInfo } from '../lib/studentInfo';
import type { Student } from '../lib/types';

/** Shared student registration and editing form, including parent portal access. */
export default function AddStudentModal({
  academyId, classId, existingNames, student, onClose, onAdded,
}: {
  academyId: string;
  classId: string;
  existingNames: string[];
  student?: Student;
  onClose: () => void;
  onAdded: (name: string, phoneProblem: string | null) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(student?.name ?? '');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [parent, setParent] = useState<ParentAccount | null>(null);
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentConsent, setParentConsent] = useState(false);
  const [parentEditing, setParentEditing] = useState(!student);
  const [loading, setLoading] = useState(!!student);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Preserve the same request after a lost response. Edited data gets a new request.
  const request = useRef({ body: '', id: crypto.randomUUID() });

  useEffect(() => {
    if (!student) return;
    let current = true;
    setLoading(true);
    setLoadFailed(false);
    loadParentAccount(student.id).then((account) => {
      if (!current) return;
      setParent(account);
      setParentName(account?.name ?? '');
      setParentEditing(!account);
    }).catch(() => { if (current) setLoadFailed(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [student, loadAttempt]);

  const digits = phone.replace(/\D/g, '');
  const parentDigits = parentPhone.replace(/\D/g, '');
  const wantsPhone = phone.trim().length > 0;
  const wantsParent = parentEditing && (parentName.trim().length > 0 || parentPhone.trim().length > 0 || !!parent);
  const phoneOk = !wantsPhone || (digits.length >= 10 && digits.length <= 11 && consent);
  const parentOk = !wantsParent || (!!parentName.trim() && parentDigits.length >= 10 && parentDigits.length <= 11 && parentConsent);
  const ready = !!name.trim() && phoneOk && parentOk && !loading && !loadFailed;
  const normalize = (value: string) => value.replace(/\s+/g, '').toLowerCase();
  const sameName = normalize(name) !== normalize(student?.name ?? '')
    && existingNames.some((existing) => normalize(existing) === normalize(name));

  async function submit() {
    if (!ready || busy) return;
    const input = {
      student: student?.id ?? null, classId, name: name.trim(),
      loginPhone: wantsPhone ? phone : null, loginConsent: consent,
      parentName: wantsParent ? parentName.trim() : null, parentPhone: wantsParent ? parentPhone : null,
      parentConsent,
    };
    const body = JSON.stringify({ academyId, ...input });
    if (request.current.body !== body) request.current = { body, id: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      await saveStudentInfo({ ...input, request: request.current.id });
      onAdded(name.trim(), null);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : '';
      setError(message.includes('duplicate_student') ? t('studentLogin.err_duplicate')
        : message.includes('not_owner') ? t('studentLogin.ownerOnly')
          : t('parentPortal.studentSaveFailed'));
      setBusy(false);
    }
  }

  const inputStyle = 'w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-base outline-none focus:border-primary';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="student-info-title">
      <form className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-surface-container-lowest p-5 shadow-xl"
        onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="flex items-center gap-2">
          <h3 id="student-info-title" className="flex-1 text-lg font-bold text-deep-navy">
            {t(student ? 'parentPortal.studentInfoTitle' : 'addStudent.title')}
          </h3>
          <button type="button" disabled={busy} onClick={onClose} aria-label={t('common.close')} className="rounded p-1 disabled:opacity-50">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-bold">{t('addStudent.name')}</span>
          <input autoFocus value={name} maxLength={100} onChange={(event) => setName(event.target.value)} disabled={busy} className={inputStyle} />
        </label>
        {sameName && <p className="rounded-lg bg-warm-yellow/25 p-3 text-sm">{t('addStudent.sameName')}</p>}
        <label className="block space-y-1">
          <span className="text-sm font-bold">{t(student ? 'parentPortal.studentLoginEdit' : 'addStudent.phone')}</span>
          <input type="tel" inputMode="numeric" value={phone} disabled={busy} className={inputStyle}
            onChange={(event) => setPhone(formatPhone(event.target.value))} />
          <span className="text-sm text-on-surface-variant">{t(student ? 'parentPortal.keepStudentPhone' : 'addStudent.phoneHint')}</span>
        </label>
        {wantsPhone && <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
          <span>{t('studentLogin.consent')}</span>
        </label>}
        <section className="space-y-3 rounded-xl border border-outline-variant p-3">
          <h4 className="font-bold text-deep-navy">{t('parentPortal.parentInfoTitle')}</h4>
          <p className="text-sm text-on-surface-variant">{t('parentPortal.siblingInfoHint')}</p>
          {loading ? <p role="status">{t('common.loading')}</p> : loadFailed ? (
            <div className="text-sm" role="alert">
              <p>{t('parentPortal.parentLoadFailed')}</p>
              <button type="button" className="min-h-10 underline" onClick={() => setLoadAttempt((n) => n + 1)}>{t('parentPortal.retry')}</button>
            </div>
          ) : parent && !parentEditing ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>{parent.name} · ···{parent.last4}</span>
              <button type="button" disabled={busy} className="min-h-10 px-2 text-primary underline" onClick={() => setParentEditing(true)}>
                {t('parentPortal.editAccount')}
              </button>
            </div>
          ) : (
            <>
              {parent && <p className="text-sm text-on-surface-variant">{t('parentPortal.accountEditHint')}</p>}
              <label className="block space-y-1">
                <span className="text-sm font-bold">{t('parentPortal.guardianName')}</span>
                <input value={parentName} maxLength={80} disabled={busy} className={inputStyle} onChange={(event) => setParentName(event.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-bold">{t('parentPortal.guardianPhone')}</span>
                <input type="tel" inputMode="numeric" value={parentPhone} disabled={busy} className={inputStyle}
                  onChange={(event) => setParentPhone(formatPhone(event.target.value))} />
              </label>
              {wantsParent && <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={parentConsent} disabled={busy} onChange={(event) => setParentConsent(event.target.checked)} className="mt-1" />
                <span>{t('parentPortal.guardianConsent')}</span>
              </label>}
              {parent && <button type="button" disabled={busy} className="min-h-10 text-sm underline" onClick={() => {
                setParentEditing(false); setParentName(parent.name); setParentPhone(''); setParentConsent(false);
              }}>{t('common.cancel')}</button>}
            </>
          )}
        </section>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!ready || busy} className="min-h-11 rounded-full bg-primary px-5 py-2 font-bold text-white disabled:opacity-40">
            {t(student ? 'common.save' : 'addStudent.add')}
          </button>
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-full px-4 py-2">{t('common.cancel')}</button>
        </div>
      </form>
    </div>
  );
}
