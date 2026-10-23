import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GRAMMAR_POINTS } from '../lib/grammar';
import { GRAMMAR_WORKBOOK_TOPICS } from '../data/grammarWorkbook';
import { GrammarBasicSheet, GrammarMissionSheet } from '../components/worksheets/GrammarWorkbookSheets';

export default function GrammarWorkbookPage() {
  const [params, setParams] = useSearchParams();
  const topicId = params.get('topic') ?? 'third-s';
  return <GrammarWorkbook key={topicId} topicId={topicId} onTopic={id => setParams({ topic: id })} />;
}
function GrammarWorkbook({ topicId, onTopic }: { topicId: string; onTopic: (id: string) => void }) {
  const { t } = useTranslation();
  const topic = GRAMMAR_WORKBOOK_TOPICS[topicId];
  const [title, setTitle] = useState(topic?.title ?? '');
  const [mode, setMode] = useState('both');
  const [student, setStudent] = useState(true);
  const [teacher, setTeacher] = useState(false);
  const basic = mode !== 'mission';
  const mission = mode !== 'basic';
  return <div className="space-y-6">
    <div className="no-print space-y-4">
      <Link to="/materials">← {t('materials.backToMaterials')}</Link>
      <h1 className="text-2xl font-bold text-deep-navy">{t('workbook.grammarTitle')}</h1>
      <label className="block">{t('workbook.topic')} <select aria-label={t('workbook.topic')} value={topicId} onChange={e => onTopic(e.target.value)} className="max-w-full rounded-lg border p-2">
        {GRAMMAR_POINTS.map(point => <option key={point.id} value={point.id}>{point.name} · {t(GRAMMAR_WORKBOOK_TOPICS[point.id] ? 'workbook.available' : 'workbook.preparing')}</option>)}
      </select></label>
      {!topic ? <p role="status">{t('workbook.unsupported')} <button className="underline" onClick={() => onTopic('third-s')}>{t('workbook.openThird')}</button></p> : <>
        <p>{t('workbook.reviewed')}</p>
        <label className="block">{t('workbook.editTitle')} <input aria-label={t('workbook.titleLabel')} maxLength={65} value={title} onChange={e => setTitle(e.target.value)} className="w-full max-w-xl rounded-lg border p-2" /></label>
        <label className="block">{t('workbook.activity')} <select aria-label={t('workbook.activity')} value={mode} onChange={e => setMode(e.target.value)} className="rounded-lg border p-2"><option value="basic">{t('workbook.basic')}</option><option value="mission">{t('workbook.mission')}</option><option value="both">{t('workbook.both')}</option></select></label>
        <fieldset className="flex gap-4"><legend>{t('workbook.audience')}</legend>
          <label><input type="checkbox" checked={student} onChange={e => setStudent(e.target.checked)} /> {t('workbook.student')}</label>
          <label><input type="checkbox" checked={teacher} onChange={e => setTeacher(e.target.checked)} /> {t('workbook.teacher')}</label>
        </fieldset>
        <button disabled={!student && !teacher} className="rounded-full bg-primary px-6 py-3 text-on-primary disabled:opacity-50" onClick={async () => { await document.fonts.ready; window.print(); }}>{t('workbook.printSheets')}</button>
        <p>{t('workbook.grammarCount', { pages: (Number(basic) + Number(mission)) * (Number(student) + Number(teacher)) })}</p>
      </>}
    </div>
    {topic && <div className="print-sheet mx-auto space-y-8 print:space-y-0">
      {student && basic && <GrammarBasicSheet topic={topic} title={title || topic.title} />}
      {student && mission && <GrammarMissionSheet topic={topic} title={title || topic.title} />}
      {teacher && basic && <GrammarBasicSheet topic={topic} title={title || topic.title} answers />}
      {teacher && mission && <GrammarMissionSheet topic={topic} title={title || topic.title} answers />}
    </div>}
  </div>;
}
