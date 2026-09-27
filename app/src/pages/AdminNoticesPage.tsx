import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminAcademyRows, adminAnnouncementReadCount, adminCreateAnnouncement, adminEndAnnouncement, adminListAnnouncements, adminLog, type AdminAcademyRow, type Announcement, type AnnouncementAudience, type AnnouncementLevel } from '../lib/support';

/**
 * 관리자 공지 보내기(2026-09-27) — 대상(전체·유료·무료·특정 학원), 보이는 방식(알림함은 항상 + 첫 화면 팝업·상단 띠),
 * 게시 기간. 보낸 공지는 읽은 사람 수와 함께 보이고 "내리기"로 바로 끝낸다.
 */
export default function AdminNoticesPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<(Announcement & { reads?: number })[] | null>(null);
  const [academies, setAcademies] = useState<AdminAcademyRow[]>([]);
  const [form, setForm] = useState({
    title: '',
    body: '',
    level: 'info' as AnnouncementLevel,
    audience: 'all' as AnnouncementAudience,
    academy_id: '',
    popup: false,
    banner: false,
    starts_at: '',
    ends_at: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const rows = await adminListAnnouncements();
      const withReads = await Promise.all(rows.map(async (a) => ({ ...a, reads: await adminAnnouncementReadCount(a.id) })));
      setList(withReads);
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      setError(/announcements|relation/i.test(msg) ? t('adminOps.needSetup') : msg);
      setList([]);
    }
  };
  useEffect(() => {
    void load();
    adminAcademyRows().then(setAcademies).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    if (!form.title.trim()) return;
    if (form.audience === 'academy' && !form.academy_id) return;
    setBusy(true);
    setError(null);
    try {
      await adminCreateAnnouncement({
        title: form.title.trim(),
        body: form.body.trim(),
        level: form.level,
        audience: form.audience,
        academy_id: form.audience === 'academy' ? form.academy_id : null,
        popup: form.popup,
        banner: form.banner,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      });
      await adminLog(form.audience === 'academy' ? form.academy_id : null, 'announcement', { title: form.title.trim(), audience: form.audience });
      setForm((f) => ({ ...f, title: '', body: '', popup: false, banner: false, starts_at: '', ends_at: '' }));
      await load();
    } catch (e) {
      setError(String((e as { message?: string })?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary';
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 font-label-md text-label-md ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`;
  const active = (a: Announcement) => Date.parse(a.starts_at) <= Date.now() && (!a.ends_at || Date.parse(a.ends_at) > Date.now());

  return (
    <div className="space-y-5">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">{t('adminOps.noticesTitle')}</h1>
      <section className="space-y-3 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('adminOps.noticeTitle')} className={input} />
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} placeholder={t('adminOps.noticeBody')} className={input} />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-caption text-caption text-on-surface-variant">{t('adminOps.level')}</span>
          {(['info', 'important', 'maintenance'] as const).map((l) => (
            <button key={l} type="button" onClick={() => setForm({ ...form, level: l, popup: l === 'important' ? true : form.popup, banner: l === 'maintenance' ? true : form.banner })} className={chip(form.level === l)}>
              {t(`adminOps.level_${l}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-caption text-caption text-on-surface-variant">{t('adminOps.audience')}</span>
          {(['all', 'paid', 'free', 'academy'] as const).map((au) => (
            <button key={au} type="button" onClick={() => setForm({ ...form, audience: au })} className={chip(form.audience === au)}>
              {t(`adminOps.audience_${au}`)}
            </button>
          ))}
          {form.audience === 'academy' && (
            <select value={form.academy_id} onChange={(e) => setForm({ ...form, academy_id: e.target.value })} className="rounded-lg border border-outline-variant px-2 py-1.5 text-sm">
              <option value="">{t('adminOps.pickAcademy')}</option>
              {academies.map((a) => (
                <option key={a.academy_id} value={a.academy_id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 font-label-md text-label-md text-on-surface">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.popup} onChange={(e) => setForm({ ...form, popup: e.target.checked })} className="h-4 w-4 accent-primary" />
            {t('adminOps.popup')}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.banner} onChange={(e) => setForm({ ...form, banner: e.target.checked })} className="h-4 w-4 accent-primary" />
            {t('adminOps.banner')}
          </label>
          <label className="flex items-center gap-2">
            {t('adminOps.startsAt')}
            <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="rounded-lg border border-outline-variant px-2 py-1 text-sm" />
          </label>
          <label className="flex items-center gap-2">
            {t('adminOps.endsAt')}
            <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="rounded-lg border border-outline-variant px-2 py-1 text-sm" />
          </label>
        </div>
        <p className="font-caption text-caption text-on-surface-variant">{t('adminOps.noticeHint')}</p>
        {error && <p className="font-caption text-caption text-error">{error}</p>}
        <button
          type="button"
          disabled={busy || !form.title.trim() || (form.audience === 'academy' && !form.academy_id)}
          onClick={() => void send()}
          className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary disabled:opacity-40"
        >
          {busy ? t('common.loading') : t('adminOps.sendNotice')}
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="font-title-md text-title-md text-deep-navy">{t('adminOps.sentNotices')}</h2>
        {list === null && <p className="text-on-surface-variant">{t('common.loading')}</p>}
        {list?.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-lowest px-4 py-3 shadow-sm">
            <span className={`rounded-full px-2 py-0.5 font-caption text-caption ${active(a) ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}`}>
              {active(a) ? t('adminOps.live') : t('adminOps.ended')}
            </span>
            <span className="min-w-0 flex-1 truncate font-label-md text-label-md">{a.title}</span>
            <span className="font-caption text-caption text-on-surface-variant">
              {t(`adminOps.audience_${a.audience}`)} · {t(`adminOps.level_${a.level}`)}
              {a.popup ? ` · ${t('adminOps.popup')}` : ''}
              {a.banner ? ` · ${t('adminOps.banner')}` : ''} · {t('adminOps.reads', { n: a.reads ?? 0 })}
            </span>
            {active(a) && (
              <button
                type="button"
                onClick={() => void adminEndAnnouncement(a.id).then(load)}
                className="rounded-full border border-error px-3 py-0.5 font-label-md text-label-md text-error"
              >
                {t('adminOps.endNotice')}
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
