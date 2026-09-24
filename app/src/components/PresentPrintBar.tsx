import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** 커리큘럼 발표 중 자료실 페이지 위에 편집 UI 대신 띄우는 작은 도구줄 — 인쇄(+ 있으면 다시 섞기,
 * 페이지별 추가 버튼)만 남긴다. 미리보기(print-sheet)는 페이지가 그대로 아래에 그린다. */
export default function PresentPrintBar({
  canPrint,
  emptyHint,
  onReshuffle,
  children,
}: {
  canPrint: boolean;
  /** canPrint 가 false 일 때 대신 보여줄 안내. */
  emptyHint?: string;
  onReshuffle?: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  if (!canPrint) {
    return <p className="no-print font-body-md text-body-md text-on-surface-variant">{emptyHint ?? t('materials.worksheet.needAtLeastOne')}</p>;
  }
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="px-6 py-3 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
      >
        {t('materials.printButton')}
      </button>
      {onReshuffle && (
        <button
          type="button"
          onClick={onReshuffle}
          className="inline-flex items-center gap-1 px-5 py-2.5 rounded-full border-2 border-primary text-primary hover:bg-primary/10 font-label-md text-label-md transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            shuffle
          </span>
          {t('materials.worksheet.reshuffle')}
        </button>
      )}
      {children}
    </div>
  );
}
