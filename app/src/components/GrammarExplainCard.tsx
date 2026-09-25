import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { parseMarked, type GrammarPoint } from '../lib/grammar';
/** 초보자용 자세한 설명 — 이럴 때 써요 · 쉽게 이해하기 · 규칙 · 틀리기 쉬운 것 · 한 줄 정리.
 * 데이터에 있는 칸만 보여준다(초등 항목은 대부분 비어 있어 이 카드가 짧다). */
export default function GrammarExplainCard({ point, showTitle = true }: { point: GrammarPoint; showTitle?: boolean }) {
  const { t } = useTranslation();
  const hasAny = !!(point.usage?.length || point.detail?.length || point.rule?.length || point.pitfalls?.length || point.tip);
  if (!hasAny) return null;
  return (
    <div className="space-y-4 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
      {showTitle && (
        <div>
          <div className="font-title-md text-title-md font-bold text-deep-navy">{point.name}</div>
          <p className="mt-1 font-body-md text-body-md text-on-surface">{point.explain}</p>
        </div>
      )}
      {point.usage && point.usage.length > 0 && (
        <ExplainSection icon="lightbulb" title={t('grammar.usageTitle')}>
          <ul className="list-disc space-y-1 pl-5">
            {point.usage.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </ExplainSection>
      )}
      {point.detail && point.detail.length > 0 && (
        <ExplainSection icon="school" title={t('grammar.detailTitle')}>
          <ol className="space-y-1.5">
            {point.detail.map((d, i) => (
              <li key={i} className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-fixed font-caption text-caption font-bold text-primary">
                  {i + 1}
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </ExplainSection>
      )}
      {point.rule && point.rule.length > 0 && (
        <ExplainSection icon="rule" title={t('grammar.ruleTitle')}>
          <div className="space-y-1 rounded-lg bg-surface-container-low px-4 py-3 font-label-md text-label-md">
            {point.rule.map((r, i) => (
              <div key={i}>▸ {r}</div>
            ))}
          </div>
        </ExplainSection>
      )}
      {point.pitfalls && point.pitfalls.length > 0 && (
        <ExplainSection icon="error" title={t('grammar.pitfalls')}>
          <div className="space-y-2">
            {point.pitfalls.map((pf, i) => (
              <div key={i} className="rounded-lg border border-outline-variant/50 px-4 py-2.5">
                <div className="text-error line-through">✗ {pf.wrong}</div>
                <div>
                  ✓{' '}
                  {parseMarked(pf.right).map((seg, k) => (
                    <span key={k} className={seg.strong ? 'font-bold text-primary' : ''}>
                      {seg.text}
                    </span>
                  ))}
                </div>
                <div className="font-caption text-caption text-on-surface-variant">{pf.why}</div>
              </div>
            ))}
          </div>
        </ExplainSection>
      )}
      {point.tip && (
        <div className="flex gap-2 rounded-lg bg-warm-yellow/40 px-4 py-3 font-body-md text-body-md text-deep-navy">
          <span className="material-symbols-outlined text-[20px]">tips_and_updates</span>
          <span>
            <b>{t('grammar.tipTitle')}</b> {point.tip}
          </span>
        </div>
      )}
    </div>
  );
}

function ExplainSection({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 font-label-md text-label-md text-on-surface">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
        {title}
      </div>
      <div className="font-body-md text-body-md text-on-surface">{children}</div>
    </div>
  );
}
