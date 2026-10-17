import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Badge, DataState, PageHead, ReasonDialog } from '../components/admin/AdminUi';
import { IssueStatusBadge, JobHealthBadge } from '../components/admin/labels';
import {
  adminErrorGroups, adminIssueSet, adminJobSet, adminJobsStatus, adminLifecyclePreview, adminLifecycleRetry, adminLifecycleRun,
  adminLifecycleStop, errorText, fmtKst, fmtWait, useAdminQuery,
  type ErrorGroup, type JobRow, type LifecyclePreview,
} from '../lib/adminOps';

/**
 * 시스템 상태(2026-10-18) — 오류는 같은 오류끼리 묶어 영향 범위·재발 여부를 보여 주고(기록은 지우지 않고 처리 상태만 바꾼다),
 * 자동 작업은 켜짐/꺼짐·모의(dry-run)/실제 여부와 마지막 실행 결과를 숨기지 않고 보여 준다.
 * 외부 연동·비용은 실제로 읽을 수 있는 값이 없으면 "미연동"이라고 쓴다(없는 숫자를 만들지 않는다).
 */
export default function AdminSystemPage() {
  const { t } = useTranslation();
  useLocation(); // #errors / #jobs 해시 이동용
  return (
    <div className="space-y-10">
      <PageHead title={t('adminV2.system.title')} desc={t('adminV2.system.desc')} />
      <ErrorsSection />
      <JobsSection />
      <IntegrationsSection />
    </div>
  );
}

function ErrorsSection() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'ko';
  const [hours, setHours] = useState(168);
  const [open, setOpen] = useState<string | null>(null);
  const [resolving, setResolving] = useState<ErrorGroup | null>(null);
  const groups = useAdminQuery(() => adminErrorGroups(hours), [hours]);

  return (
    <section id="errors" aria-labelledby="err-h" className="scroll-mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="err-h" className="font-display-lg text-[22px] font-black text-deep-navy">{t('adminV2.system.errorsTitle')}</h2>
        <div className="flex gap-1.5" role="group" aria-label={t('adminV2.system.range')}>
          {[24, 168, 720].map((h) => (
            <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)} className={`rounded-full px-3 py-1 font-label-md text-[13px] ${hours === h ? 'bg-primary font-bold text-white' : 'border border-outline-variant text-on-surface-variant'}`}>
              {t(`adminV2.system.range_${h}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="font-caption text-[13px] text-on-surface-variant">{t('adminV2.system.errorsDesc')}</p>
      <DataState state={groups} empty={t('adminV2.system.errorsEmpty')}>
        {(rows) => (
          <ul className="space-y-2">
            {rows.map((g) => {
              const recurred = g.events_after_resolved > 0 && g.status === 'resolved';
              return (
                <li key={g.fingerprint} className="rounded-xl border border-outline-variant bg-white p-4 shadow-card">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[14rem] flex-1">
                      <div className="break-words font-label-md text-[15px] font-bold text-deep-navy">{g.message}</div>
                      <div className="mt-1 break-all font-caption text-[12px] text-on-surface-variant">{g.page ?? '–'}</div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-caption text-[12px] text-on-surface-variant">
                        <span>{t('adminV2.system.events', { n: g.events })}</span>
                        <span>{t('adminV2.system.users', { n: g.users })}</span>
                        <span>{t('adminV2.system.academies', { n: g.academies })}</span>
                        <span>{t('adminV2.issue.firstSeen')} {fmtKst(g.first_seen, lang)}</span>
                        <span>{t('adminV2.issue.lastSeen')} {fmtKst(g.last_seen, lang)}</span>
                        {g.recurrence_count > 0 && <span className="font-bold text-error">{t('adminV2.issue.recurCount', { n: g.recurrence_count })}</span>}
                        {recurred && <span className="font-bold text-error">{t('adminV2.system.afterResolved', { n: g.events_after_resolved })}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <IssueStatusBadge value={g.status} recurred={recurred} />
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button type="button" onClick={() => setOpen(open === g.fingerprint ? null : g.fingerprint)} aria-expanded={open === g.fingerprint} className="rounded-full border border-outline-variant px-3 py-1 font-label-md text-[13px] text-on-surface-variant hover:bg-surface-container-low">{t('adminV2.system.stack')}</button>
                        {g.issue_id && g.status === 'open' && (
                          <button type="button" onClick={() => void adminIssueSet(g.issue_id!, 'acknowledged', null).then(groups.reload)} className="rounded-full border border-outline-variant px-3 py-1 font-label-md text-[13px] text-on-surface-variant hover:bg-surface-container-low">{t('adminV2.issue.ack')}</button>
                        )}
                        {g.issue_id && g.status !== 'resolved' && (
                          <button type="button" onClick={() => setResolving(g)} className="rounded-full bg-primary px-3 py-1 font-label-md text-[13px] font-bold text-white">{t('adminV2.issue.resolve')}</button>
                        )}
                      </div>
                    </div>
                  </div>
                  {open === g.fingerprint && <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-surface-container-low p-3 text-[12px]">{g.sample_stack ?? t('adminV2.system.noStack')}</pre>}
                </li>
              );
            })}
          </ul>
        )}
      </DataState>
      {resolving?.issue_id && (
        <ReasonDialog
          title={t('adminV2.issue.resolveTitle')}
          body={<span className="break-words">{resolving.message}</span>}
          label={t('adminV2.issue.resolveReason')}
          confirmLabel={t('adminV2.issue.resolve')}
          onClose={() => setResolving(null)}
          onConfirm={async (note) => {
            await adminIssueSet(resolving.issue_id!, 'resolved', note);
            setResolving(null);
            groups.reload();
          }}
        />
      )}
    </section>
  );
}

function JobsSection() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'ko';
  const jobs = useAdminQuery(() => adminJobsStatus(), []);
  const [edit, setEdit] = useState<JobRow | null>(null);
  const [prev, setPrev] = useState<{ key: string; data: LifecyclePreview | null } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      jobs.reload();
    } catch (e) {
      setErr(errorText(e));
    }
  }

  return (
    <section id="jobs" aria-labelledby="job-h" className="scroll-mt-4 space-y-3">
      <h2 id="job-h" className="font-display-lg text-[22px] font-black text-deep-navy">{t('adminV2.system.jobsTitle')}</h2>
      <p className="font-caption text-[13px] text-on-surface-variant">{t('adminV2.system.jobsDesc')}</p>
      {msg && <p role="status" className="rounded-lg bg-[#e0f5ea] px-3 py-2 font-label-md text-label-md text-[#0f6b3e]">{msg}</p>}
      {err && <p role="alert" className="rounded-lg bg-error-container/40 px-3 py-2 font-label-md text-label-md text-on-error-container">{err}</p>}
      <DataState state={jobs} empty={t('adminV2.system.jobsEmpty')}>
        {(rows) => (
          <ul className="space-y-2">
            {rows.map((j) => (
              <li key={j.job_key} className="rounded-xl border border-outline-variant bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[14rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-label-md text-[15px] font-bold text-deep-navy">{j.title}</span>
                      <JobHealthBadge value={j.health} />
                      <Badge tone="mute">{j.managed === 'internal' ? t('adminV2.system.internal') : t('adminV2.system.external')}</Badge>
                      {j.managed === 'internal' && <Badge tone={j.mode === 'live' ? 'warn' : 'info'}>{j.mode === 'live' ? t('adminV2.system.modeLive') : t('adminV2.system.modeDry')}</Badge>}
                    </div>
                    {j.description && <p className="mt-1 break-words font-caption text-[13px] text-on-surface-variant">{j.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-caption text-[12px] text-on-surface-variant">
                      <span>{t('adminV2.system.lastRun')} {j.last_run_at ? fmtKst(j.last_run_at, lang) : t('adminV2.system.never')}</span>
                      <span>{t('adminV2.system.lastSuccess')} {j.last_success_at ? fmtKst(j.last_success_at, lang) : '–'}</span>
                      {j.expected_interval_minutes != null && <span>{t('adminV2.system.interval', { time: fmtWait(j.expected_interval_minutes, lang) })}</span>}
                      {j.managed === 'internal' && <span>{t('adminV2.system.msgs', { planned: j.msg_planned, sent: j.msg_sent, failed: j.msg_failed })}</span>}
                    </div>
                    {j.last_error && <p className="mt-1 break-words font-caption text-[12px] text-error">{j.last_error}</p>}
                    {j.managed === 'external' && <p className="mt-1 font-caption text-[12px] text-on-surface-variant">{t('adminV2.system.externalNote')}</p>}
                  </div>
                  {j.managed === 'internal' && (
                    <div className="flex flex-wrap justify-end gap-1.5 md:shrink-0">
                      <button type="button" onClick={() => void adminLifecyclePreview(j.job_key).then((d) => setPrev({ key: j.job_key, data: d })).catch((e) => setErr(errorText(e)))} className="rounded-full border border-outline-variant px-3 py-1 font-label-md text-[13px] hover:bg-surface-container-low">{t('adminV2.system.preview')}</button>
                      <button type="button" onClick={() => void act(() => adminLifecycleRun(j.job_key, true), t('adminV2.system.dryDone'))} className="rounded-full border border-primary px-3 py-1 font-label-md text-[13px] font-bold text-primary hover:bg-primary-fixed">{t('adminV2.system.dryRun')}</button>
                      {j.msg_failed > 0 && <button type="button" onClick={() => void act(() => adminLifecycleRetry(j.job_key), t('adminV2.system.retryDone'))} className="rounded-full border border-outline-variant px-3 py-1 font-label-md text-[13px]">{t('adminV2.system.retry')}</button>}
                      {(j.msg_planned > 0 || j.msg_failed > 0) && <button type="button" onClick={() => void act(() => adminLifecycleStop(j.job_key), t('adminV2.system.stopDone'))} className="rounded-full border border-error px-3 py-1 font-label-md text-[13px] text-error">{t('adminV2.system.stop')}</button>}
                      <button type="button" onClick={() => setEdit(j)} className="rounded-full bg-deep-navy px-3 py-1 font-label-md text-[13px] font-bold text-white">{t('adminV2.system.settings')}</button>
                    </div>
                  )}
                </div>
                {prev?.key === j.job_key && (
                  <div className="mt-3 rounded-lg bg-primary-fixed/40 p-3 font-caption text-[13px]">
                    {prev.data ? (
                      <>
                        <div className="font-bold text-deep-navy">{t('adminV2.system.previewResult', { n: prev.data.new, dup: prev.data.skipped_duplicate })}</div>
                        <ul className="mt-1 space-y-0.5">
                          {prev.data.sample.map((s, i) => <li key={i} className="break-words">{s.academy} · {s.email.replace(/^(.).*(@.*)$/, '$1***$2')}</li>)}
                        </ul>
                      </>
                    ) : t('adminV2.system.previewNone')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DataState>
      {edit && <JobDialog job={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); jobs.reload(); }} />}
    </section>
  );
}

function JobDialog({ job, onClose, onSaved }: { job: JobRow; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(job.enabled);
  const [mode, setMode] = useState<'dry_run' | 'live'>(job.mode);
  const [channel, setChannel] = useState<'none' | 'email' | 'in_app'>(job.channel);
  return (
    <ReasonDialog
      title={job.title}
      confirmLabel={t('common.save')}
      onClose={onClose}
      onConfirm={async (reason) => {
        await adminJobSet(job.job_key, enabled, mode, channel, reason);
        onSaved();
      }}
    >
      <div className="mt-3 space-y-3 font-body-md text-body-md">
        <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />{t('adminV2.system.enabled')}</label>
        <label className="flex items-center gap-2">{t('adminV2.system.mode')}
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="rounded-lg border border-outline-variant px-2 py-1">
            <option value="dry_run">{t('adminV2.system.modeDry')}</option>
            <option value="live">{t('adminV2.system.modeLive')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2">{t('adminV2.system.channel')}
          <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className="rounded-lg border border-outline-variant px-2 py-1">
            <option value="none">{t('adminV2.system.channel_none')}</option>
            <option value="email">{t('adminV2.system.channel_email')}</option>
            <option value="in_app">{t('adminV2.system.channel_in_app')}</option>
          </select>
        </label>
        {mode === 'live' && <p className="rounded-lg bg-[#fff1c2] px-3 py-2 font-caption text-[13px] text-[#7a5400]">{t('adminV2.system.liveWarn')}</p>}
      </div>
    </ReasonDialog>
  );
}

/** 연동·비용 — 지금 서버에서 읽을 수 있는 값이 없으므로 숫자를 보여 주지 않고 상태만 정직하게 적는다. */
function IntegrationsSection() {
  const { t } = useTranslation();
  const rows: Array<[string, 'warn' | 'mute']> = [
    ['payments', 'warn'], ['email', 'warn'], ['hosting', 'mute'], ['database', 'mute'], ['ai', 'mute'],
  ];
  return (
    <section aria-labelledby="int-h" className="space-y-3">
      <h2 id="int-h" className="font-display-lg text-[22px] font-black text-deep-navy">{t('adminV2.system.intTitle')}</h2>
      <p className="font-caption text-[13px] text-on-surface-variant">{t('adminV2.system.intDesc')}</p>
      <ul className="grid gap-2 md:grid-cols-2">
        {rows.map(([k, tone]) => (
          <li key={k} className="rounded-xl border border-outline-variant bg-white p-4 shadow-card">
            <div className="flex items-center gap-2">
              <span className="font-label-md text-[15px] font-bold text-deep-navy">{t(`adminV2.system.int_${k}`)}</span>
              <Badge tone={tone}>{t('adminV2.system.notConnected')}</Badge>
            </div>
            <p className="mt-1 font-caption text-[13px] text-on-surface-variant">{t(`adminV2.system.int_${k}_note`)}</p>
          </li>
        ))}
      </ul>
      <p className="font-caption text-[12px] text-on-surface-variant">
        <Link to="/admin/billing" className="text-primary underline">{t('adminV2.system.toBilling')}</Link>
      </p>
    </section>
  );
}
