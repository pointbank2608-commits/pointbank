import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  clearGuardianPhone,
  fetchGuardianStatus,
  fetchStudentCode,
  formatPhone,
  resetStudentCode,
  studentLink,
  revealGuardianPhone,
  saveGuardianPhone,
  type GuardianStatus,
} from '../lib/studentPortal';
import { setRecordConsent } from '../lib/soloApi';
import type { Student } from '../lib/types';

/**
 * 학생관리의 "학생 로그인" 패널 — 학원 학생 코드, 학생별 학부모 전화번호 등록(원장만).
 * 학생은 /s 에서 학원 코드 + 이름 + 학부모 전화번호로 로그인한다. 번호는 서버에 암호화해서 저장되고,
 * 등록할 때 보호자 동의를 받았다는 확인을 남긴다.
 */
export default function StudentLoginPanel({ students }: { students: Student[] }) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { notify } = useToast();
  const isOwner = profile?.role === 'owner';
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Map<string, GuardianStatus>>(new Map());
  const [editing, setEditing] = useState<Student | null>(null);

  const reload = useCallback(async () => {
    try {
      const [c, st] = await Promise.all([fetchStudentCode(), fetchGuardianStatus()]);
      setCode(c);
      setStatus(new Map(st.map((x) => [x.student_id, x])));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    }
  }, [notify]);

  useEffect(() => {
    if (open && code === null) void reload();
  }, [open, code, reload]);

  const registered = students.filter((s) => status.has(s.id)).length;
  const link = code ? studentLink(code) : `${window.location.origin}/s`;
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!code) return;
    void QRCode.toDataURL(studentLink(code), { margin: 1, width: 240 }).then(setQr);
  }, [code]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(t('studentLogin.copied'));
    } catch {
      notify(text);
    }
  }

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="material-symbols-outlined text-[22px] text-primary">badge</span>
        <span className="font-label-md text-label-md font-bold text-deep-navy">{t('studentLogin.title')}</span>
        <span className="font-caption text-caption text-on-surface-variant">{t('studentLogin.subtitle')}</span>
        <span className="material-symbols-outlined ml-auto text-[20px] text-on-surface-variant">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-outline-variant/30 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="font-caption text-caption text-on-surface-variant">{t('studentLogin.codeLabel')}</div>
              <div className="font-mono text-2xl font-bold tracking-[0.2em] text-deep-navy">{code ?? '······'}</div>
            </div>
            <button
              type="button"
              disabled={!code}
              onClick={() => void copy(code ?? '')}
              className="rounded-full border border-primary px-3 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-40"
            >
              {t('studentLogin.copyCode')}
            </button>
            <button
              type="button"
              onClick={() => void copy(link)}
              className="rounded-full border border-primary px-3 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10"
            >
              {t('studentLogin.copyLink')}
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(t('studentLogin.resetConfirm'))) return;
                  try {
                    setCode(await resetStudentCode());
                    notify(t('studentLogin.resetDone'));
                  } catch (e) {
                    notify(e instanceof Error ? e.message : String(e), 'error');
                  }
                }}
                className="ml-auto font-caption text-caption text-on-surface-variant hover:text-primary"
              >
                {t('studentLogin.resetCode')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-primary-fixed/30 p-3">
            {qr && <img src={qr} alt={t('studentLogin.qrAlt')} className="h-28 w-28 rounded bg-white p-1" />}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="font-label-md text-label-md font-bold text-on-surface">{t('studentLogin.linkTitle')}</div>
              <div className="break-all font-mono text-sm text-on-surface-variant">{link}</div>
              <p className="font-caption text-caption text-on-surface-variant">{t('studentLogin.howTo')}</p>
            </div>
          </div>

          <div>
            <div className="mb-2 font-label-md text-label-md font-bold text-on-surface">
              {t('studentLogin.phoneTitle', { done: registered, total: students.length })}
            </div>
            {!isOwner && <p className="mb-2 font-caption text-caption text-on-surface-variant">{t('studentLogin.ownerOnly')}</p>}
            <ul className="divide-y divide-surface-container">
              {students.map((s) => {
                const st = status.get(s.id);
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-label-md text-label-md text-on-surface">{s.name}</span>
                    {st ? (
                      <span className="flex items-center gap-1.5">
                        <span className="rounded-full bg-secondary-container/60 px-2.5 py-0.5 font-caption text-caption text-on-surface">
                          {t('studentLogin.registered', { last4: st.last4 })}
                        </span>
                        {st.record_consent_at && (
                          <span className="rounded-full bg-primary-fixed/60 px-2.5 py-0.5 font-caption text-caption text-on-surface">{t('studentLogin.recordOn')}</span>
                        )}
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-caption text-caption text-on-surface-variant">{t('studentLogin.notRegistered')}</span>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        className="rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
                      >
                        {st ? t('studentLogin.edit') : t('studentLogin.register')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      {editing && (
        <GuardianModal
          student={editing}
          registered={status.has(editing.id)}
          recordConsent={!!status.get(editing.id)?.record_consent_at}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function GuardianModal({ student, registered, recordConsent, onClose, onChanged }: { student: Student; registered: boolean; recordConsent: boolean; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const digits = phone.replace(/\D/g, '');
  const ready = digits.length >= 10 && digits.length <= 11 && consent;

  async function reveal() {
    try {
      const v = await revealGuardianPhone(student.id);
      if (v) setPhone(formatPhone(v));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await saveGuardianPhone(student.id, phone, consent);
      notify(t('studentLogin.saved'));
      onChanged();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-primary">phone_iphone</span>
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('studentLogin.modalTitle', { name: student.name })}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <label className="block space-y-1">
          <span className="font-label-md text-label-md text-on-surface">{t('studentLogin.phoneLabel')}</span>
          <input
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-base outline-none focus:border-primary"
          />
        </label>
        {registered && (
          <button type="button" onClick={() => void reveal()} className="font-caption text-caption text-primary hover:underline">
            {t('studentLogin.reveal')}
          </button>
        )}
        <label className="flex items-start gap-2 rounded-lg bg-warm-yellow/20 p-3">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
          <span className="font-caption text-caption text-on-surface">{t('studentLogin.consent')}</span>
        </label>
        {registered && (
          <div className="space-y-1.5 rounded-lg border border-outline-variant/50 p-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">mic</span>
              <span className="flex-1 font-label-md text-label-md text-on-surface">{t('studentLogin.recordTitle')}</span>
              <button
                type="button"
                onClick={async () => {
                  const next = !recordConsent;
                  if (next ? !window.confirm(t('studentLogin.recordConfirmOn')) : !window.confirm(t('studentLogin.recordConfirmOff'))) return;
                  try {
                    await setRecordConsent(student.id, next);
                    notify(next ? t('studentLogin.recordOnToast') : t('studentLogin.recordOffToast'));
                    onChanged();
                  } catch (e) {
                    notify(e instanceof Error ? e.message : String(e), 'error');
                  }
                }}
                className={`rounded-full px-3 py-1 font-label-md text-label-md ${recordConsent ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'}`}
              >
                {recordConsent ? t('studentLogin.recordAgreed') : t('studentLogin.recordAgree')}
              </button>
            </div>
            <p className="font-caption text-caption text-on-surface-variant">{t('studentLogin.recordHint')}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!ready || busy}
            onClick={() => void save()}
            className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary disabled:opacity-40"
          >
            {t('common.save')}
          </button>
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
            {t('common.cancel')}
          </button>
          {registered && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(t('studentLogin.removeConfirm', { name: student.name }))) return;
                try {
                  await clearGuardianPhone(student.id);
                  onChanged();
                } catch (e) {
                  notify(e instanceof Error ? e.message : String(e), 'error');
                }
              }}
              className="ml-auto font-caption text-caption text-error hover:underline"
            >
              {t('studentLogin.remove')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
