import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { createStudent } from '../lib/api';
import { formatPhone, saveGuardianPhone } from '../lib/studentPortal';

/**
 * 학생 등록 창 — 이름 + (원장은) 보호자 전화번호. 전화번호는 학생이 /s 에서 로그인할 때 쓴다.
 * 선생님(원장이 아닌 경우)은 이름만 등록하고, 번호는 원장이 학생관리의 "학생 로그인"에서 나중에 넣는다.
 * 같은 이름의 학생이 이미 있으면 알려 주고(번호가 다르면 문제없음), 이름·번호가 모두 같으면 서버가 막는다.
 */
export default function AddStudentModal({
  academyId,
  classId,
  existingNames,
  onClose,
  onAdded,
}: {
  academyId: string;
  classId: string;
  /** 같은 학원 학생 이름들(동명이인 안내용) */
  existingNames: string[];
  onClose: () => void;
  onAdded: (name: string, phoneProblem: string | null) => void;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = phone.replace(/\D/g, '');
  const wantsPhone = isOwner && digits.length > 0;
  const phoneOk = !wantsPhone || (digits.length >= 10 && digits.length <= 11 && consent);
  const ready = name.trim().length > 0 && phoneOk;
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  const sameName = existingNames.some((n) => norm(n) === norm(name) && name.trim().length > 0);

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    let created;
    try {
      created = await createStudent(academyId, classId, name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      return;
    }
    let problem: string | null = null;
    if (wantsPhone) {
      try {
        await saveGuardianPhone(created.id, phone, consent);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        problem = msg.includes('duplicate_student') ? t('studentLogin.err_duplicate') : t('studentLogin.err_phone');
      }
    }
    onAdded(name.trim(), problem);
  }

  const input = 'w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-base outline-none focus:border-primary';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <form
        className="w-full max-w-md space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-primary">person_add</span>
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('addStudent.title')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <label className="block space-y-1">
          <span className="font-label-md text-label-md text-on-surface">{t('addStudent.name')}</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        {sameName && <p className="rounded-lg bg-warm-yellow/25 px-3 py-2 font-caption text-caption text-on-surface">{t('addStudent.sameName')}</p>}
        {isOwner ? (
          <>
            <label className="block space-y-1">
              <span className="font-label-md text-label-md text-on-surface">{t('addStudent.phone')}</span>
              <input
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                type="tel"
                inputMode="numeric"
                placeholder="010-0000-0000"
                className={input}
              />
              <span className="font-caption text-caption text-on-surface-variant">{t('addStudent.phoneHint')}</span>
            </label>
            {digits.length > 0 && (
              <label className="flex items-start gap-2 rounded-lg bg-warm-yellow/20 p-3">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
                <span className="font-caption text-caption text-on-surface">{t('studentLogin.consent')}</span>
              </label>
            )}
          </>
        ) : (
          <p className="font-caption text-caption text-on-surface-variant">{t('addStudent.ownerPhone')}</p>
        )}
        {error && (
          <p className="font-caption text-caption text-error" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={!ready || busy} className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary disabled:opacity-40">
            {t('addStudent.add')}
          </button>
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
