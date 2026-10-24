import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/workbook-selection.css';

/** The same compact selection panel for CVC, magic e, and Stage 4/5 workbooks. */
export default function WorkbookSelectionPanel({children,onSelectAll,onClear}:{children:ReactNode;onSelectAll:()=>void;onClear:()=>void}) {
  const {t}=useTranslation();
  return <section className="workbook-selection-panel rounded-xl bg-surface-container-lowest p-5 shadow-card space-y-3" data-unit-picker-panel aria-label={t('materials.cvc.pickTitle')}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-title-md text-title-md text-on-surface">{t('materials.cvc.pickTitle')}</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSelectAll} className="rounded-full border-2 border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{t('materials.cvc.selectAll')}</button>
        <button type="button" onClick={onClear} className="rounded-full border-2 border-outline-variant px-4 py-1.5 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{t('materials.cvc.clear')}</button>
      </div>
    </div>
    {children}
  </section>;
}
