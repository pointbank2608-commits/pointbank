import BackButton from '../components/BackButton';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import PresentPrintBar from '../components/PresentPrintBar';
import { CvcUnitPages, CvcUnitPicker } from '../components/worksheets/CvcWorkbookSheets';
import { usePresenting } from '../context/LessonRunnerContext';
import { WORKBOOKS, LONG_LEGACY_UNITS, resolveWorkbookSelection, stableWorkbookRefs, workbookNumbers, type WorkbookId } from '../data/cvcWorkbook';

/** 수업 슬라이드에서 넘어올 때 미리 정해 둔 유닛(navState.cvcUnits). */

/**
 * 파닉스 CVC 워크북 — 미리 만들어 둔 워크시트. 유닛(낱말 2~3개)을 고르면 유닛마다 A4 두 장이 그대로 나온다.
 * 단어를 고르거나 옵션을 맞출 필요가 없는 "바로 쓰는" 자료다.
 */
export default function CvcWorkbookPage({ book = 'cvc' }: { book?: WorkbookId }) {
  const workbook = WORKBOOKS[book];
  const { t } = useTranslation();
  const location = useLocation();
  const presenting = usePresenting();
  const fromSaved = resolveWorkbookSelection(book, location.state);
  const initialIds = () => fromSaved.requested ? fromSaved.units.map(u => u.id) : workbook.units.slice(0, 1).map(u => u.id);
  const [selected, setSelected] = useState<string[]>(initialIds);
  useEffect(() => {
    const saved = resolveWorkbookSelection(book, location.state);
    setSelected(saved.requested ? saved.units.map(u => u.id) : WORKBOOKS[book].units.slice(0, 1).map(u => u.id));
  }, [location.key, location.state, book]);
  const available = [...workbook.units, ...(book === 'long' ? LONG_LEGACY_UNITS : [])];
  const units = available.filter((u) => selected.includes(u.id));
  const vowelLabel = (vowel: string) => t(book === 'cvc' ? 'materials.cvc.vowel' : 'materials.cvc.longVowel', { vowel });

  return (
    <div className="space-y-6">
      {presenting ? (
        <PresentPrintBar canPrint={units.length > 0} emptyHint={t('materials.cvc.pickUnit')} />
      ) : (
        <div className="no-print space-y-4">
          <BackButton path="/materials" to={t('materials.backToMaterials')} />
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">{t(book === 'cvc' ? 'materials.cvcWorkbookName' : 'materials.longVowelWorkbookName')}</h1>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{t(book === 'cvc' ? 'materials.cvc.intro' : 'materials.cvc.longIntro')}</p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-title-md text-title-md text-on-surface">{t('materials.cvc.pickTitle')}</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(workbook.units.map((u) => u.id))}
                  className="rounded-full border-2 border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10 transition-colors"
                >
                  {t('materials.cvc.selectAll')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="rounded-full border-2 border-outline-variant px-4 py-1.5 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  {t('materials.cvc.clear')}
                </button>
              </div>
            </div>
            {fromSaved.missing.length > 0 && <p role="alert">{t('phonicsCourse.missingRef')}</p>}
            {units.some(u => u.id.startsWith('legacy-')) && <div><p>{t('phonicsCourse.legacy')}</p>{units.filter(u => u.id.startsWith('legacy-')).map(u => <label key={u.id} className="mr-3"><input type="checkbox" checked onChange={() => setSelected(selected.filter(id => id !== u.id))} />{u.unit}. {u.words.join(' · ')}</label>)}</div>}
            <CvcUnitPicker book={book} selected={workbookNumbers(book, selected)} onChange={numbers => setSelected(stableWorkbookRefs(book, numbers))} vowelLabel={vowelLabel} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={units.length === 0}
              className="px-6 py-3 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors disabled:opacity-50"
            >
              {t('materials.printButton')}
            </button>
            <span className="font-body-md text-body-md text-on-surface-variant">
              {units.length > 0 ? t('materials.cvc.pageCount', { units: units.length, pages: units.length * 2 }) : t('materials.cvc.pickUnit')}
            </span>
          </div>
        </div>
      )}

      <div className="print-sheet mx-auto space-y-8 print:space-y-0">
        {units.map((u) => (
          <CvcUnitPages key={`${u.book}-${u.unit}`} unit={u} />
        ))}
      </div>
    </div>
  );
}
