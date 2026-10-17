import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DataState, PageHead } from '../components/admin/AdminUi';
import { useAuth } from '../context/AuthContext';
import { changeMyPassword } from '../lib/api';
import { errorText, useAdminQuery, type TicketPriority } from '../lib/adminOps';
import AdminBrandPage from './AdminBrandPage';
import { loadSla, saveSla, type SlaHours } from './AdminSupportPage';

const DEFAULT_SLA: SlaHours = { urgent: 2, high: 8, normal: 24, low: 72 };
const PRIORITIES: TicketPriority[] = ['urgent', 'high', 'normal', 'low'];

/** 설정(2026-10-18): 내 계정(비밀번호) · 문의 응답 기한 · 로고. 비밀번호는 예전 학원 목록 화면에서 옮겼다. */
export default function AdminSettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <PageHead title={t('adminV2.settings.title')} desc={t('adminV2.settings.desc')} />
      <AccountSection />
      <SlaSection />
      <section aria-labelledby="set-test" className="space-y-2 rounded-xl border border-outline-variant bg-white p-5 shadow-card">
        <h2 id="set-test" className="font-title-md text-[18px] font-extrabold text-deep-navy">{t('adminV2.settings.testTitle')}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('adminV2.settings.testDesc')}</p>
        <Link to="/admin/academies?filter=test" className="inline-block rounded-full border border-primary px-4 py-1.5 font-label-md text-label-md font-bold text-primary hover:bg-primary-fixed">{t('adminV2.settings.testLink')}</Link>
      </section>
      <section aria-labelledby="set-logo" className="space-y-3">
        <h2 id="set-logo" className="font-title-md text-[18px] font-extrabold text-deep-navy">{t('adminV2.settings.logoTitle')}</h2>
        <AdminBrandPage />
      </section>
    </div>
  );
}

function AccountSection() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setMsg(null);
    if (pw.length < 12 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return setMsg({ ok: false, text: t('admin.passwordTooShort') });
    if (pw !== pw2) return setMsg({ ok: false, text: t('admin.passwordMismatch') });
    setBusy(true);
    try {
      await changeMyPassword(pw);
      setPw('');
      setPw2('');
      setMsg({ ok: true, text: t('admin.passwordChangedToast') });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }
  const input = 'w-full rounded-lg border border-outline-variant bg-white px-3 py-2 font-body-md text-body-md outline-none focus:border-primary focus:ring-2 focus:ring-primary/25';
  return (
    <section aria-labelledby="set-acc" className="space-y-3 rounded-xl border border-outline-variant bg-white p-5 shadow-card">
      <h2 id="set-acc" className="font-title-md text-[18px] font-extrabold text-deep-navy">{t('admin.changePasswordTitle')}</h2>
      <p className="font-caption text-[13px] text-on-surface-variant">{session?.user.email}</p>
      <div className="grid max-w-xl gap-3 md:grid-cols-2">
        <label className="block font-label-md text-label-md font-bold text-deep-navy">
          {t('admin.newPasswordLabel')}
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t('admin.newPasswordPlaceholder')} className={`${input} mt-1 font-normal`} />
        </label>
        <label className="block font-label-md text-label-md font-bold text-deep-navy">
          {t('admin.confirmPasswordLabel')}
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={`${input} mt-1 font-normal`} />
        </label>
      </div>
      <button type="button" disabled={busy || !pw} onClick={() => void submit()} className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md font-bold text-white disabled:opacity-50">{t('admin.changePasswordButton', { defaultValue: t('common.save') })}</button>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`font-caption text-[13px] ${msg.ok ? 'text-[#0f6b3e]' : 'text-error'}`}>{msg.text}</p>}
    </section>
  );
}

function SlaSection() {
  const { t } = useTranslation();
  const state = useAdminQuery(async () => ({ ...DEFAULT_SLA, ...((await loadSla()) ?? {}) }), []);
  const [draft, setDraft] = useState<SlaHours | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(v: SlaHours) {
    setMsg(null);
    if (PRIORITIES.some((p) => !(v[p] >= 1 && v[p] <= 720))) return setMsg({ ok: false, text: t('adminV2.settings.slaRange') });
    try {
      await saveSla(v);
      setMsg({ ok: true, text: t('adminOps.saved') });
      setDraft(null);
      state.reload();
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  }
  return (
    <section aria-labelledby="set-sla" className="space-y-3 rounded-xl border border-outline-variant bg-white p-5 shadow-card">
      <h2 id="set-sla" className="font-title-md text-[18px] font-extrabold text-deep-navy">{t('adminV2.settings.slaTitle')}</h2>
      <p className="font-body-md text-body-md text-on-surface-variant">{t('adminV2.settings.slaDesc')}</p>
      <DataState state={state} empty="" isEmpty={() => false}>
        {(cur) => {
          const v = draft ?? cur;
          return (
            <div className="space-y-3">
              <div className="grid max-w-xl grid-cols-2 gap-3 md:grid-cols-4">
                {PRIORITIES.map((p) => (
                  <label key={p} className="block font-label-md text-label-md font-bold text-deep-navy">
                    {t(`adminV2.priority.${p}`)}
                    <div className="mt-1 flex items-center gap-1 font-normal">
                      <input type="number" min={1} max={720} value={v[p]} onChange={(e) => setDraft({ ...v, [p]: Number(e.target.value) })} className="w-20 rounded-lg border border-outline-variant px-2 py-1.5 tabular-nums" />
                      <span className="text-on-surface-variant">{t('adminV2.settings.hours')}</span>
                    </div>
                  </label>
                ))}
              </div>
              <button type="button" disabled={!draft} onClick={() => void save(v)} className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md font-bold text-white disabled:opacity-50">{t('common.save')}</button>
              {msg && <p role={msg.ok ? 'status' : 'alert'} className={`font-caption text-[13px] ${msg.ok ? 'text-[#0f6b3e]' : 'text-error'}`}>{msg.text}</p>}
            </div>
          );
        }}
      </DataState>
    </section>
  );
}
