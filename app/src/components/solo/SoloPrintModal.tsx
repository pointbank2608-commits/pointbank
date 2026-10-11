import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import type { SoloStep } from '../../lib/soloLessons';
import { buildSoloPrintHtml, isPrintableStep } from '../../lib/soloPrint';

/**
 * 개별수업 문제 인쇄 — 화면에서 푸는 것과 같은 문제로 A4 시트와 정답지를 보여 주고 인쇄한다.
 * 미리보기는 iframe, 인쇄는 새 창(같은 HTML)에서 한다.
 */
export default function SoloPrintModal({ steps, title, onClose }: { steps: SoloStep[]; title: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [showBank, setShowBank] = useState(true);
  const printable = useMemo(() => steps.filter(isPrintableStep), [steps]);
  const hasGap = printable.some((s) => s.t === 'gapType');
  const html = useMemo(
    () =>
      buildSoloPrintHtml(printable, { title: title || t('soloPrint.defaultTitle'), includeAnswers, showBank, origin: window.location.origin }, (k, v) =>
        t(k, v ?? {}) as string,
      ),
    [printable, title, includeAnswers, showBank, t],
  );

  function print() {
    if (!html) return;
    const w = window.open('', '_blank');
    if (!w) {
      notify(t('soloPrint.popupBlocked'), 'error');
      return;
    }
    w.document.write(html.replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body>'));
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-[68] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[24px] text-primary">print</span>
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('soloPrint.title')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {html ? (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
                <input type="checkbox" checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)} className="h-4 w-4" />
                {t('soloPrint.optAnswers')}
              </label>
              {hasGap && (
                <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
                  <input type="checkbox" checked={showBank} onChange={(e) => setShowBank(e.target.checked)} className="h-4 w-4" />
                  {t('soloPrint.optBank')}
                </label>
              )}
              <span className="font-caption text-caption text-on-surface-variant">{t('soloPrint.count', { count: printable.length })}</span>
              <button type="button" onClick={print} className="ml-auto flex items-center gap-1 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container">
                <span className="material-symbols-outlined text-[18px]">print</span>
                {t('soloPrint.printButton')}
              </button>
            </div>
            <iframe title={t('soloPrint.title')} srcDoc={html} className="h-[62vh] w-full rounded-xl border border-outline-variant bg-white" />
          </>
        ) : (
          <p className="py-10 text-center text-on-surface-variant">{t('soloPrint.empty')}</p>
        )}
      </div>
    </div>
  );
}
