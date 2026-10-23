import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchPhonicsBank } from '../lib/api';
import type { PhonicsBankEntry } from '../lib/types';
import { buildPhonicsWorkbook, workbookPrintable, workbookUsesText, workbookBlockingIssues, withVerifiedWorkbookAssets } from '../data/phonicsWorkbook';
import { CvcUnitPages, WorkbookRuleLabel, WorkbookUnitChip } from '../components/worksheets/CvcWorkbookSheets';
import { useLocation } from 'react-router-dom';
import { curriculumEntries } from '../data/phonicsCurriculum';

export default function PhonicsWorkbookPage({ step }: { step: 4 | 5 }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [entries, setEntries] = useState<PhonicsBankEntry[]>([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string[] | null>(() => {
    const ids = (location.state as { phonicsUnitIds?: unknown } | null)?.phonicsUnitIds;
    return ids === undefined ? null : Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const ids = (location.state as { phonicsUnitIds?: unknown } | null)?.phonicsUnitIds;
    setSelected(ids === undefined ? null : Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  }, [location.key, location.state]);
  useEffect(() => {
    let active = true;
    fetchPhonicsBank().then(data => { if (active) { setEntries(data); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [attempt]);
  const units = useMemo(() => buildPhonicsWorkbook(entries, step), [entries, step]);
  const resolved = useMemo(() => units.map(u => withVerifiedWorkbookAssets(u, checked)), [units, checked]);
  const complete = resolved.filter(workbookPrintable);
  const selectedIds = selected ?? complete.slice(0, 1).map(u => u.id);
  const printUnits = complete.filter(u => selectedIds.includes(u.id));
  const missingRefs = selectedIds.filter(id => !units.some(u => u.id === id));
  const fallbackCount = complete.filter(workbookUsesText).length;
  const assetRows = [...new Set(resolved.flatMap(u => u.issues.filter(i => i.word && (i.type === 'color' || i.type === 'lineart')).map(i => i.word!)))].map(word => ({
    word, issues: [...new Set(resolved.flatMap(u => u.issues.filter(i => i.word === word && (i.type === 'color' || i.type === 'lineart')).map(i => i.type)))],
    units: resolved.filter(u => u.words.includes(word)).map(u => u.unit),
  }));
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
  const verified = (u: typeof units[number]) => {
    const source = units.find(source => source.id === u.id)!;
    return [...Object.values(source.images), ...Object.values(source.lineart)].every(src => checked[src] !== undefined);
  };
  const canPrint = printUnits.length > 0 && printUnits.every(verified);
  const toggle = (id: string) => setSelected(selectedIds.includes(id) ? selectedIds.filter(n => n !== id) : [...selectedIds, id]);
  const title = t(step === 4 ? 'workbook.stage4' : 'workbook.stage5');
  return <div className="space-y-6">
    <div className="no-print space-y-4">
      <Link to="/materials">← {t('materials.backToMaterials')}</Link>
      <h1 className="text-2xl font-bold text-deep-navy">{title}</h1>
      <p>{t('workbook.intro')}</p>
      {missingRefs.length > 0 && <p role="alert">{t('phonicsCourse.missingRef')}</p>}
      {fallbackCount > 0 && <p>{t('workbook.fallbackNotice')}</p>}
      <Link className="inline-block text-sm underline" to="/materials/phonics">{t('phonics.worksheetButton')}</Link>
      <details className="text-sm" data-asset-status><summary className="cursor-pointer font-medium">{t('workbook.assetStatus')}</summary>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left"><thead><tr><th>{t('workbook.assetWord')}</th><th>{t('workbook.assetMissing')}</th><th>{t('workbook.assetUnits')}</th></tr></thead>
          <tbody>{assetRows.map(row => <tr key={row.word}><td className="py-1 pr-3">{row.word}</td><td className="pr-3">{row.issues.map(type => t(`workbook.asset_${type}`)).join(' · ')}</td><td>{row.units.join(', ')}</td></tr>)}</tbody>
        </table></div>
        <ul>{resolved.flatMap(u => workbookBlockingIssues(u).map((issue, i) => <li key={`${u.id}-${i}`}>{u.unit}. {t(`workbook.issue_${issue.type}`, { word: issue.word })}</li>))}</ul>
        <ul>{curriculumEntries(false).filter(e => e.step === step && e.reviewFlags?.length).map(e => <li key={e.id}>{e.word}: {t('phonicsCourse.familiarity')}</li>)}</ul>
      </details>
      {status === 'loading' && <p role="status">{t('workbook.loading')}</p>}
      {status === 'error' && <div role="alert">{t('workbook.error')} <button onClick={() => { setStatus('loading'); setAttempt(n => n + 1); }}>{t('workbook.retry')}</button></div>}
      {status === 'ready' && !units.length && <p role="alert">{t('workbook.empty')}</p>}
      {!!units.length && <>
        <p>{t('workbook.counts', { units: units.length, words: units.reduce((sum, u) => sum + u.words.length, 0), ready: complete.length })}</p>
        {fallbackCount > 0 && <p className="text-sm text-on-surface-variant">{t('workbook.activityCounts', { picture: complete.length - fallbackCount, text: fallbackCount })}</p>}
        <div className="flex flex-wrap gap-3">
          <button className="rounded-full border px-4 py-2" onClick={() => setSelected(complete.map(u => u.id))}>{t('materials.cvc.selectAll')}</button>
          <button className="rounded-full border px-4 py-2" onClick={() => setSelected([])}>{t('materials.cvc.clear')}</button>
        </div>
        <div data-unit-picker className="grid grid-cols-1 items-start gap-x-5 gap-y-4 rounded-xl bg-surface-container-lowest p-5 md:grid-cols-2">
          {[...new Set(resolved.map(u => u.ruleId))].map(ruleId => <fieldset key={ruleId} className="min-w-0 space-y-2">
            <legend><WorkbookRuleLabel>{resolved.find(u => u.ruleId === ruleId)!.family}</WorkbookRuleLabel></legend>
            <div className="flex flex-wrap items-start gap-1.5">{resolved.filter(u => u.ruleId === ruleId).map(u => <WorkbookUnitChip key={u.id} checkbox disabled={!workbookPrintable(u)} selected={workbookPrintable(u) && selectedIds.includes(u.id)} onChange={() => toggle(u.id)}>
              {u.unit}. {u.words.join(' · ')}
              {workbookUsesText(u) && workbookPrintable(u) && <span className="ml-1 inline-block rounded bg-secondary-container px-1.5 py-0.5 text-xs text-on-secondary-container">{t('workbook.textBadge')}</span>}
            </WorkbookUnitChip>)}</div>
          </fieldset>)}
        </div>
        <button className="rounded-full bg-primary px-6 py-3 text-on-primary disabled:opacity-50" disabled={!canPrint} onClick={async () => { await document.fonts.ready; window.print(); }}>{t('workbook.printUnits')}</button>
        <span className="ml-3">{t('workbook.pages', { units: printUnits.length, pages: printUnits.length * 2 })}</span>
      </>}
    </div>
    <div className="max-w-full overflow-x-auto print:max-w-none print:overflow-visible">
    <div className="print-sheet mx-auto space-y-8 print:space-y-0">
      {printUnits.filter(verified).map(unit => <CvcUnitPages key={unit.id} unit={unit} />)}
    </div>
    </div>
  </div>;
}
