import BackButton from '../components/BackButton';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import PresentPrintBar from '../components/PresentPrintBar';
import { CvcUnitPages, CvcUnitPicker } from '../components/worksheets/CvcWorkbookSheets';
import { usePresenting } from '../context/LessonRunnerContext';
import { WORKBOOKS, LONG_LEGACY_UNITS, resolveWorkbookSelection, stableWorkbookRefs, workbookNumbers, type WorkbookId } from '../data/cvcWorkbook';
import { curriculumEntries } from '../data/phonicsCurriculum';
import { withWorkbookWordMedia } from '../data/phonicsMedia';
import { fetchPhonicsBank } from '../lib/api';
import { useWorkbookImageChecks } from '../lib/useWorkbookImageChecks';
import WorkbookSelectionPanel from '../components/worksheets/WorkbookSelectionPanel';

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
  const [entries, setEntries] = useState(() => curriculumEntries(true));
  const [mediaLoaded, setMediaLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    fetchPhonicsBank({ includeExtensions: true }).then(data => { if (active) setEntries(data); })
      .catch(() => { /* The canonical static media remains available offline. */ })
      .finally(() => { if (active) setMediaLoaded(true); });
    return () => { active = false; };
  }, []);
  const available = useMemo(() => [...WORKBOOKS[book].units, ...(book === 'long' ? LONG_LEGACY_UNITS : [])].map(unit => withWorkbookWordMedia(unit, entries)), [book, entries]);
  const paths = useMemo(() => [...new Set(available.flatMap(unit => [...Object.values(unit.images), ...Object.values(unit.lineart)]))], [available]);
  const checked = useWorkbookImageChecks(paths);
  const units = available.filter((u) => selected.includes(u.id));
  const ready = units.filter(unit => mediaLoaded && unit.words.every(word => unit.images[word] && unit.lineart[word] && checked[unit.images[word]] === true && checked[unit.lineart[word]] === true));
  const canPrint = units.length > 0 && ready.length === units.length;
  const assetIssues = units.flatMap(unit => unit.words.flatMap(word => [
    ...(!unit.images[word] || checked[unit.images[word]] === false ? [{ word, unit: unit.unit, type: 'color' }] : []),
    ...(!unit.lineart[word] || checked[unit.lineart[word]] === false ? [{ word, unit: unit.unit, type: 'lineart' }] : []),
  ]));
  const vowelLabel = (vowel: string) => t(book === 'cvc' ? 'materials.cvc.vowel' : 'materials.cvc.longVowel', { vowel });

  return (
    <div className="space-y-6">
      {presenting ? (
        <PresentPrintBar canPrint={canPrint} emptyHint={t('materials.cvc.pickUnit')} />
      ) : (
        <div className="no-print space-y-4">
          <BackButton path="/materials" to={t('materials.backToMaterials')} />
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">{t(book === 'cvc' ? 'materials.cvcWorkbookName' : 'materials.longVowelWorkbookName')}</h1>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{t(book === 'cvc' ? 'materials.cvc.intro' : 'materials.cvc.longIntro')}</p>
          </div>

          <WorkbookSelectionPanel onSelectAll={() => setSelected(workbook.units.map((u) => u.id))} onClear={() => setSelected([])}>
            {fromSaved.missing.length > 0 && <p role="alert">{t('phonicsCourse.missingRef')}</p>}
            {units.some(u => u.id.startsWith('legacy-')) && <div><p>{t('phonicsCourse.legacy')}</p>{units.filter(u => u.id.startsWith('legacy-')).map(u => <label key={u.id} className="mr-3"><input type="checkbox" checked onChange={() => setSelected(selected.filter(id => id !== u.id))} />{u.unit}. {u.words.join(' · ')}</label>)}</div>}
            <CvcUnitPicker book={book} selected={workbookNumbers(book, selected)} onChange={numbers => setSelected(stableWorkbookRefs(book, numbers))} vowelLabel={vowelLabel} />
            {assetIssues.length > 0 && <details><summary>{t('workbook.assetStatus')}</summary><ul>{assetIssues.map(issue => <li key={`${issue.unit}-${issue.word}-${issue.type}`}>{issue.unit}. {t(`workbook.issue_${issue.type}`, { word: issue.word })}</li>)}</ul></details>}
          </WorkbookSelectionPanel>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => { await document.fonts.ready; window.print(); }}
              disabled={!canPrint}
              className="px-6 py-3 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors disabled:opacity-50"
            >
              {t('materials.printButton')}
            </button>
            <span className="font-body-md text-body-md text-on-surface-variant">
              {ready.length > 0 ? t('materials.cvc.pageCount', { units: ready.length, pages: ready.length * 2 }) : t('materials.cvc.pickUnit')}
            </span>
          </div>
        </div>
      )}

      <div className="print-sheet mx-auto space-y-8 print:space-y-0">
        {ready.map((u) => (
          <CvcUnitPages key={`${u.book}-${u.unit}`} unit={u} />
        ))}
      </div>
    </div>
  );
}
