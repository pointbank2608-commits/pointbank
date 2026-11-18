import { useTranslation } from 'react-i18next';
import type { PracticeQuestion, TeachingDraft, TeachingSettings } from '../lib/teachingMaterials';

export default function TeachingDraftReview({ draft, settings, workbook, disabled, onChange }: {
  draft: TeachingDraft; settings: TeachingSettings; workbook: boolean; disabled: boolean; onChange: (draft: TeachingDraft) => void;
}) {
  const { t } = useTranslation();
  const { lesson, practice } = draft;
  function changeQuestion(index: number, update: Partial<PracticeQuestion>) {
    if (practice) onChange({ ...draft, practice: { ...practice,
      questions: practice.questions.map((row, i) => i === index ? { ...row, ...update } : row) } });
  }
  return <div className="teaching-review">
    <fieldset className="teaching-settings" disabled={disabled}>
      <legend>{t('aiMaterials.teachingObjective')}</legend>
      <div className="textbook-fields teaching-full-width"><label className="sr-only" htmlFor="teaching-objective">{t('aiMaterials.teachingObjective')}</label>
        <textarea id="teaching-objective" required maxLength={180} rows={2} value={draft.objective}
          onChange={event => onChange({ ...draft, objective: event.target.value })} /></div>
    </fieldset>
    {!!lesson?.length && <fieldset className="teaching-settings" disabled={disabled}>
      <legend>{t('aiMaterials.lesson')} · {t('aiMaterials.minuteLabel', { count: settings.minutes })}</legend>
      <details className="teaching-preview"><summary>{t('aiMaterials.studentPreview')}</summary>
        <p>{draft.objective}</p>
        <ol>{lesson.map((stage, index) => <li key={index}><strong>{stage.title} · {t('aiMaterials.minuteLabel', { count: stage.minutes })}</strong>
          <p>{stage.content}</p></li>)}</ol>
      </details>
      {lesson.map((stage, index) => {
        const change = (update: Partial<typeof stage>) => onChange({ ...draft, lesson: lesson.map((row, i) => i === index ? { ...row, ...update } : row) });
        return <fieldset className="teaching-settings" key={index}>
          <legend>{t('aiMaterials.lessonStage', { number: index + 1 })}</legend>
          <div className="textbook-fields">
            <label>{t('aiMaterials.stageTitle')}<input required maxLength={80} value={stage.title} onChange={event => change({ title: event.target.value })} /></label>
            <label>{t('aiMaterials.lessonMinutes')}<input required type="number" min={1} max={90} value={stage.minutes || ''}
              onChange={event => change({ minutes: Number(event.target.value) })} /></label>
            <label className="teaching-full-width">{t('aiMaterials.stageContent')}<textarea required maxLength={550} rows={4}
              value={stage.content} onChange={event => change({ content: event.target.value })} /></label>
          </div>
        </fieldset>;
      })}
    </fieldset>}
    {practice && <fieldset className="teaching-settings" disabled={disabled}>
      <legend>{t(workbook ? 'aiMaterials.workbook' : 'aiMaterials.lessonPractice')} · {practice.questions.length}</legend>
      <details className="teaching-preview"><summary>{t('aiMaterials.studentPreview')}</summary>
        <p>{practice.instruction}</p>{practice.passage && <blockquote>{practice.passage}</blockquote>}
        <ol>{practice.questions.map((question, index) => <li key={index}>
          {settings.exam && <strong>{t(`aiMaterials.${question.category}`)} · </strong>}{question.prompt}
          {!!question.options.length && <ol type="A">{question.options.map((option, choice) => <li key={choice}>{option}</li>)}</ol>}
        </li>)}</ol>
      </details>
      <details className="teaching-preview"><summary>{t('aiMaterials.teacherPreview')}</summary>
        <ol>{practice.questions.map((question, index) => <li key={index}>
          <strong>{question.answer}</strong><p>{question.explanation}</p>{question.evidence && <small>{question.evidence}</small>}
        </li>)}</ol>
      </details>
      <div className="textbook-fields">
        <label className="teaching-full-width">{t('worksheetStudio.instruction')}<textarea required maxLength={260} rows={2} value={practice.instruction}
          onChange={event => onChange({ ...draft, practice: { ...practice, instruction: event.target.value } })} /></label>
        <label className="teaching-full-width">{t('worksheetStudio.passage')}<textarea maxLength={2500} rows={4} value={practice.passage}
          onChange={event => onChange({ ...draft, practice: { ...practice, passage: event.target.value } })} /></label>
      </div>
      {practice.questions.map((question, index) => <fieldset className="teaching-settings" key={index}>
        <legend>{index + 1}. {t(`aiMaterials.${question.category}`)}</legend>
        <div className="textbook-fields">
          <label className="teaching-full-width">{t('worksheetStudio.prompt')}<textarea required maxLength={220} rows={2} value={question.prompt}
            onChange={event => changeQuestion(index, { prompt: event.target.value })} /></label>
          {(!settings.exam || question.category !== 'writing') && <label className="teaching-full-width">{t('worksheetStudio.options')}
            <input maxLength={320} value={question.options.join('|')} onChange={event => changeQuestion(index, {
              options: event.target.value ? event.target.value.split('|') : [],
            })} /></label>}
          <label>{t('worksheetStudio.answer')}<textarea required maxLength={250} rows={2} value={question.answer}
            onChange={event => changeQuestion(index, { answer: event.target.value })} /></label>
          <label>{t('worksheetStudio.detail')}<textarea required maxLength={220} rows={2} value={question.explanation}
            onChange={event => changeQuestion(index, { explanation: event.target.value })} /></label>
          <label className="teaching-full-width">{t('aiMaterials.sourceReference')}<input maxLength={100} value={question.evidence}
            onChange={event => changeQuestion(index, { evidence: event.target.value })} /></label>
        </div>
      </fieldset>)}
    </fieldset>}
  </div>;
}
