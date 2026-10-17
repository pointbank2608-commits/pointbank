import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge, DataState, PageHead, StatCard } from '../components/admin/AdminUi';
import { adminBillingOverview, adminBillingReconcile, adminOverview, fmtKst, useAdminQuery } from '../lib/adminOps';

/**
 * 결제·구독(2026-10-18) — 지금 데이터로 확인할 수 있는 것만 보여 준다.
 *  · 구독(카드)으로 유료가 된 학원과 관리자가 열어 준 유료를 분리(유료 권한 ≠ 매출 고객).
 *  · 실패·해지 예정, 최근 30일 청구 결과, 웹훅 이벤트와 청구 기록의 대조.
 * 환불은 기록하는 곳이 아직 없고 포트원 웹훅도 연결 전이라, 그런 숫자는 만들어 내지 않고 "미연동"으로 적는다.
 */
const won = (n: number | null | undefined) => (n == null ? '–' : `${Math.round(n).toLocaleString('ko-KR')}원`);

export default function AdminBillingPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'ko';
  const ov = useAdminQuery(() => adminOverview(true), []);
  const bill = useAdminQuery(() => adminBillingOverview(), []);
  const rec = useAdminQuery(() => adminBillingReconcile(), []);
  const o = ov.data;

  return (
    <div className="space-y-8">
      <PageHead title={t('adminV2.billing.title')} desc={t('adminV2.billing.desc')} />

      <section aria-labelledby="bill-sum" className="space-y-3">
        <h2 id="bill-sum" className="font-display-lg text-[20px] font-black text-deep-navy">{t('adminV2.billing.sumTitle')}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t('adminV2.source.subscription')} value={o ? o.source.subscription : '…'} to="/admin/academies?filter=subscription" hint={t('adminV2.billing.subHint')} />
          <StatCard label={t('adminV2.today.grants')} value={o ? o.source.admin + o.source.event : '…'} to="/admin/academies?filter=grant" hint={t('adminV2.billing.grantHint')} />
          <StatCard label={t('adminV2.source.unclassified')} value={o ? o.source.unclassified : '…'} to="/admin/academies?filter=unclassified" hint={t('adminV2.billing.unclassifiedHint')} tone={o && o.source.unclassified > 0 ? 'bad' : 'mute'} />
          <StatCard label={t('adminV2.billingState.failed')} value={o ? o.billing.failed : '…'} to="/admin/academies?filter=billing" tone={o && o.billing.failed > 0 ? 'bad' : 'mute'} />
          <StatCard label={t('adminV2.billingState.cancel_scheduled')} value={o ? o.billing.cancel_scheduled : '…'} to="/admin/academies?filter=billing" />
          <StatCard label={t('adminV2.today.grants') + ' · ' + t('adminV2.billing.expiring')} value={o ? o.grants_expiring_7d : '…'} to="/admin/academies?filter=expiring" />
        </div>
        {ov.status === 'error' && !o && <DataState state={ov} empty="" isEmpty={() => false}>{() => null}</DataState>}
      </section>

      <section aria-labelledby="bill-30" className="space-y-3">
        <h2 id="bill-30" className="font-display-lg text-[20px] font-black text-deep-navy">{t('adminV2.billing.thirtyTitle')}</h2>
        <DataState state={bill} empty={t('adminV2.billing.noData')} isEmpty={(d) => !d}>
          {(d) => (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label={t('adminV2.billing.okCount')} value={d!.billed_ok_30d} />
                <StatCard label={t('adminV2.billing.failCount')} value={d!.billed_failed_30d} tone={d!.billed_failed_30d > 0 ? 'bad' : 'mute'} />
                <StatCard label={t('adminV2.billing.amount30')} value={won(d!.amount_ok_30d_krw)} hint={t('adminV2.billing.amountHint')} />
                <StatCard label={t('adminV2.billing.amountMonth')} value={won(d!.amount_ok_month_krw)} hint={t('adminV2.billing.monthHint')} />
              </div>
              <div className="flex flex-wrap items-center gap-2 font-caption text-[13px] text-on-surface-variant">
                <Badge tone={d!.refunds_recorded ? 'ok' : 'warn'}>{d!.refunds_recorded ? t('adminV2.billing.refundOn') : t('adminV2.billing.refundOff')}</Badge>
                <Badge tone={d!.webhook_events_30d > 0 ? 'ok' : 'warn'}>{t('adminV2.billing.webhook', { n: d!.webhook_events_30d })}</Badge>
              </div>
              {d!.failures.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-outline-variant bg-white shadow-card">
                  <table className="w-full min-w-[560px] text-left font-body-md text-[14px]">
                    <caption className="sr-only">{t('adminV2.billing.failTable')}</caption>
                    <thead className="bg-surface-container-low text-[13px] text-on-surface-variant">
                      <tr>
                        <th scope="col" className="px-3 py-2">{t('adminV2.academies.colName')}</th>
                        <th scope="col" className="px-3 py-2">{t('adminV2.billing.when')}</th>
                        <th scope="col" className="px-3 py-2 text-right">{t('adminV2.billing.amount')}</th>
                        <th scope="col" className="px-3 py-2">{t('adminV2.billing.reason')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d!.failures.map((f, i) => (
                        <tr key={i} className="border-t border-outline-variant/50">
                          <td className="px-3 py-2"><Link to={`/admin/academies/${f.academy_id}`} className="font-bold text-primary hover:underline">{f.name}</Link></td>
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtKst(f.billed_at, lang)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{won(f.amount_krw)}</td>
                          <td className="break-words px-3 py-2 text-on-surface-variant">{f.reason ?? '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </DataState>
      </section>

      <section aria-labelledby="bill-rec" className="space-y-3">
        <h2 id="bill-rec" className="font-display-lg text-[20px] font-black text-deep-navy">{t('adminV2.billing.reconTitle')}</h2>
        <p className="font-caption text-[13px] text-on-surface-variant">{t('adminV2.billing.reconDesc')}</p>
        <DataState state={rec} empty={t('adminV2.billing.reconEmpty')}>
          {(rows) => (
            <ul className="space-y-2">
              {rows.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-3 font-caption text-[13px] shadow-card">
                  <Badge tone="warn">{t(`adminV2.billing.recon_${r.kind}`)}</Badge>
                  <span className="font-bold text-deep-navy">{r.academy_name ?? '–'}</span>
                  <span className="tabular-nums text-on-surface-variant">{fmtKst(r.billed_at, lang)}</span>
                  <span className="tabular-nums">{won(r.amount_krw)}</span>
                  <span className="break-all text-on-surface-variant">{r.payment_id ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </section>

      <section className="rounded-xl border border-outline-variant bg-surface-container-low p-4 font-caption text-[13px] text-on-surface-variant">
        <h2 className="font-label-md text-[15px] font-bold text-deep-navy">{t('adminV2.billing.limitsTitle')}</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>{t('adminV2.billing.limit1')}</li>
          <li>{t('adminV2.billing.limit2')}</li>
          <li>{t('adminV2.billing.limit3')}</li>
        </ul>
      </section>
    </div>
  );
}
