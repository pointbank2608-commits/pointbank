import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { grammarPoint } from '../lib/grammar';
import { SCHOOLS, UNITS, unitOf } from '../lib/curriculumGrammar';
import { GRAMMAR_SHEET_BANK } from '../data/grammarSheets';
import { GRAMMAR_WORKBOOK_TOPICS } from '../data/grammarWorkbook';
import { buildSheetData, hasSetB, KEY_PAGES, KIND_PAGES, pageCount, SHEET_KINDS, type SheetKind, type SheetSet, type Support } from '../lib/grammarSheets';
import { BuildSheet, ChooseSheet, CorrectSheet, DiscoverSheet, KIND_NAMES, ReviewSheet, SaySheet, TeacherKey } from '../components/worksheets/GrammarIntentSheets';
import { GrammarMissionSheet } from '../components/worksheets/GrammarWorkbookSheets';

const PRESETS: { id: string; kinds: SheetKind[] }[] = [
  { id: 'presetAll', kinds: [...SHEET_KINDS] },
  { id: 'presetConcept', kinds: ['discover', 'choose'] },
  { id: 'presetPractice', kinds: ['build', 'correct'] },
  { id: 'presetAdvanced', kinds: ['say', 'review'] },
];
const SET_CHOICES: { id: 'A' | 'B' | 'AB'; sets: SheetSet[] }[] = [{ id: 'A', sets: ['A'] }, { id: 'B', sets: ['B'] }, { id: 'AB', sets: ['A', 'B'] }];
const SHEETS = { discover: DiscoverSheet, choose: ChooseSheet, build: BuildSheet, correct: CorrectSheet, say: SaySheet, review: ReviewSheet };

export default function GrammarSheetsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const topicId = params.get('topic') ?? 'third-s';
  const point = grammarPoint(topicId);
  const content = GRAMMAR_SHEET_BANK[topicId];
  const [kinds, setKinds] = useState<SheetKind[]>([...SHEET_KINDS]);
  const [support, setSupport] = useState<Support>(2);
  const [setChoice, setSetChoice] = useState<'A' | 'B' | 'AB'>('A');
  const [student, setStudent] = useState(true);
  const [teacher, setTeacher] = useState(false);
  const [robot, setRobot] = useState(false);
  const detective = GRAMMAR_WORKBOOK_TOPICS[topicId];

  const withB = hasSetB(content);
  const activeSets = (SET_CHOICES.find((c) => c.id === setChoice)?.sets ?? ['A']).filter((x) => x === 'A' || withB);
  const dataBySet = useMemo(() => {
    if (!point || !content) return null;
    const unit = unitOf(point.id);
    const neighbors = (unit?.ids ?? []).filter((id) => id !== point.id).map((id) => ({ name: grammarPoint(id)?.name ?? id, content: GRAMMAR_SHEET_BANK[id] }));
    return { A: buildSheetData(point, content, neighbors, 'A'), B: withB ? buildSheetData(point, content, neighbors, 'B') : null };
  }, [point, content, withB]);
  const data = dataBySet?.A ?? null;

  const ordered = SHEET_KINDS.filter((k) => kinds.includes(k));
  const robotPages = detective && robot ? (student ? 1 : 0) + (teacher ? 1 : 0) : 0;
  const pages = pageCount(ordered, teacher, student, activeSets.length) + robotPages;
  const toggle = (k: SheetKind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  return (
    <div className="space-y-6">
      <div className="no-print space-y-4" data-grammar-sheets-controls>
        <Link to="/materials">← {t('grammarSheets.back')}</Link>
        <h1 className="text-2xl font-bold text-deep-navy">{t('grammarSheets.title')}</h1>
        <p>{t('grammarSheets.intro')}</p>
        <label className="block">{t('grammarSheets.topic')}{' '}
          <select aria-label={t('grammarSheets.topic')} value={topicId} onChange={(e) => setParams({ topic: e.target.value })} className="max-w-full rounded-lg border p-2">
            {SCHOOLS.flatMap((school) =>
              UNITS.map((unit) => {
                const ids = unit.ids.filter((id) => { const p = grammarPoint(id); return p && school.stages.includes(p.stage) && GRAMMAR_SHEET_BANK[id]; });
                return ids.length === 0 ? null : (
                  <optgroup key={`${school.id}-${unit.id}`} label={`${school.ko} · ${unit.ko}`}>
                    {ids.map((id) => <option key={id} value={id}>{grammarPoint(id)!.name}</option>)}
                  </optgroup>
                );
              }),
            )}
          </select>
        </label>
        {!data ? <p role="status">{t('grammarSheets.unavailable')}</p> : <>
          <fieldset className="space-y-2"><legend className="font-bold">{t('grammarSheets.sheets')}</legend>
            <div className="flex flex-wrap gap-2">{PRESETS.map((p) => <button key={p.id} type="button" className="rounded-full border px-3 py-1" onClick={() => setKinds(p.kinds)}>{t(`grammarSheets.${p.id}`)}</button>)}</div>
            <div className="flex flex-wrap gap-4">{SHEET_KINDS.map((k, i) => <label key={k}><input type="checkbox" checked={kinds.includes(k)} onChange={() => toggle(k)} /> {i + 1}. {KIND_NAMES[k].ko}</label>)}</div>
          </fieldset>
          {detective && <label className="block"><input type="checkbox" checked={robot} onChange={(e) => setRobot(e.target.checked)} /> {t('grammarSheets.robot')}</label>}
          <fieldset className="space-y-1"><legend className="font-bold">{t('grammarSheets.setLegend')}</legend>
            <div className="flex flex-wrap gap-4">{SET_CHOICES.map((c) => <label key={c.id} className={c.id !== 'A' && !withB ? 'opacity-50' : ''}><input type="radio" name="set" disabled={c.id !== 'A' && !withB} checked={setChoice === c.id} onChange={() => setSetChoice(c.id)} /> {t(`grammarSheets.set${c.id}`)}</label>)}</div>
            <p className="text-sm">{t('grammarSheets.setHelp')}</p>
          </fieldset>
          <fieldset className="space-y-1"><legend className="font-bold">{t('grammarSheets.support')}</legend>
            {([1, 2, 3] as Support[]).map((s) => <label key={s} className="block"><input type="radio" name="support" checked={support === s} onChange={() => setSupport(s)} /> {t(`grammarSheets.support${s}`)}</label>)}
          </fieldset>
          <fieldset className="flex gap-4"><legend className="font-bold">{t('grammarSheets.audience')}</legend>
            <label><input type="checkbox" checked={student} onChange={(e) => setStudent(e.target.checked)} /> {t('grammarSheets.student')}</label>
            <label><input type="checkbox" checked={teacher} onChange={(e) => setTeacher(e.target.checked)} /> {t('grammarSheets.teacher')}</label>
          </fieldset>
          <button disabled={pages === 0} className="rounded-full bg-primary px-6 py-3 text-on-primary disabled:opacity-50" onClick={async () => { await document.fonts.ready; window.print(); }}>{t('grammarSheets.print')}</button>
          <p>{pages === 0 ? t('grammarSheets.noSheets') : t('grammarSheets.pages', { pages })}</p>
        </>}
      </div>
      {data && dataBySet && <div className="print-sheet mx-auto space-y-8 print:space-y-0">
        {activeSets.map((sid) => { const d = dataBySet[sid]; if (!d) return null; return <div key={sid} className="contents">
          {student && ordered.map((k) => { const Sheet = SHEETS[k]; return Array.from({ length: KIND_PAGES[k] }, (_, part) => <Sheet key={`${sid}${k}${part}`} data={d} support={support} part={part} />); })}
          {teacher && ordered.length > 0 && Array.from({ length: KEY_PAGES }, (_, part) => <TeacherKey key={`${sid}key${part}`} data={d} kinds={ordered} part={part} />)}
        </div>; })}
        {detective && robot && student && <GrammarMissionSheet topic={detective} title={detective.title} />}
        {detective && robot && teacher && <GrammarMissionSheet topic={detective} title={detective.title} answers />}
      </div>}
    </div>
  );
}
