import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchPhonicsBank } from '../lib/api';
import type { PhonicsBankEntry } from '../lib/types';
import { buildPhonicsWorkbook } from '../data/phonicsWorkbook';
import { CvcUnitPages } from '../components/worksheets/CvcWorkbookSheets';

export default function PhonicsWorkbookPage({ step }: { step: 4 | 5 }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<PhonicsBankEntry[]>([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<number[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let active = true;
    fetchPhonicsBank().then(data => { if (active) { setEntries(data); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [attempt]);
  const units = useMemo(() => buildPhonicsWorkbook(entries, step), [entries, step]);
  const complete = units.filter(u => !u.issues.length);
  const selectedIds = selected ?? complete.slice(0, 1).map(u => u.unit);
  const printUnits = complete.filter(u => selectedIds.includes(u.unit));
  const paths = useMemo(() => [...new Set(units.flatMap(u => [...Object.values(u.images), ...Object.values(u.lineart)]))], [units]);
  useEffect(() => {
    let active = true;
    setChecked({});
    for (const src of paths) {
      const img = new Image(); img.src = src;
      img.decode().then(() => { if (active) setChecked(prev => ({ ...prev, [src]: true })); })
        .catch(() => { if (active) setChecked(prev => ({ ...prev, [src]: false })); });
    }
    return () => { active = false; };
  }, [paths]);
  const verified = (u: typeof units[number]) => [...Object.values(u.images), ...Object.values(u.lineart)].every(src => checked[src] === true);
  const canPrint = printUnits.length > 0 && printUnits.every(verified);
  const toggle = (id: number) => setSelected(selectedIds.includes(id) ? selectedIds.filter(n => n !== id) : [...selectedIds, id]);
  const title = t(step === 4 ? 'workbook.stage4' : 'workbook.stage5');
  return <div className="space-y-6">
    <div className="no-print space-y-4">
      <Link to="/materials">← {t('materials.backToMaterials')}</Link>
      <h1 className="text-2xl font-bold text-deep-navy">{title}</h1>
      <p>{t('workbook.intro')}</p>
      {status === 'loading' && <p role="status">{t('workbook.loading')}</p>}
      {status === 'error' && <div role="alert">{t('workbook.error')} <button onClick={() => { setStatus('loading'); setAttempt(n => n + 1); }}>{t('workbook.retry')}</button></div>}
      {status === 'ready' && !units.length && <p role="alert">{t('workbook.empty')}</p>}
      {!!units.length && <>
        <p>{t('workbook.counts', { units: units.length, words: units.reduce((sum, u) => sum + u.words.length, 0), ready: complete.length })}</p>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-full border px-4 py-2" onClick={() => setSelected(complete.map(u => u.unit))}>{t('materials.cvc.selectAll')}</button>
          <button className="rounded-full border px-4 py-2" onClick={() => setSelected([])}>{t('materials.cvc.clear')}</button>
        </div>
        <div className="space-y-3 rounded-xl bg-surface-container-lowest p-5">
          {[...new Set(units.map(u => u.family))].map(rule => <fieldset key={rule} className="space-y-2">
            <legend className="font-bold">{rule}</legend>
            <div className="flex flex-wrap gap-2">{units.filter(u => u.family === rule).map(u => <label key={u.unit} className="rounded-xl border p-3">
              <input type="checkbox" disabled={!!u.issues.length} checked={!u.issues.length && selectedIds.includes(u.unit)} onChange={() => toggle(u.unit)} /> {u.unit}. {u.words.join(' · ')}
              {!!u.issues.length && <span className="ml-2 text-sm text-red-700">{t('workbook.preparing')}</span>}
              {u.issues.map((issue, i) => <span key={i} className="block text-sm text-red-700">{t(`workbook.issue_${issue.type}`, { word: issue.word })}</span>)}
              {Object.values(u.images).concat(Object.values(u.lineart)).filter(src => checked[src] === false).map(src => <span key={src} className="block text-sm text-red-700">{t('workbook.imageError', { src })}</span>)}
            </label>)}</div>
          </fieldset>)}
        </div>
        <button className="rounded-full bg-primary px-6 py-3 text-on-primary disabled:opacity-50" disabled={!canPrint} onClick={async () => { await document.fonts.ready; window.print(); }}>{t('workbook.printUnits')}</button>
        <span className="ml-3">{t('workbook.pages', { units: printUnits.length, pages: printUnits.length * 2 })}</span>
      </>}
    </div>
    <div className="print-sheet mx-auto space-y-8 print:space-y-0">
      {printUnits.filter(verified).map(unit => <CvcUnitPages key={unit.unit} unit={unit} />)}
    </div>
  </div>;
}
