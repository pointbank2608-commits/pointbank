import { useTranslation } from 'react-i18next';
import { defaultExamCounts, examCategories, materialOutputs, type ExamCategory, type MaterialOutput, type SourceMaterialOptions, type TeachingSettings } from '../lib/teachingMaterials';

export type TeachingForm = {
  grade: number; level: TeachingSettings['level']; purpose: TeachingSettings['purpose'];
  minutes: string; questionCount: string; examCount: string; scope: string; counts: Record<ExamCategory, string>;
};

function countFields(total: number) {
  const counts = defaultExamCounts(total);
  return Object.fromEntries(examCategories.map(key => [key, String(counts[key])])) as TeachingForm['counts'];
}

export const defaultTeachingForm: TeachingForm = {
  grade: 3, level: 'standard', purpose: 'classroom', minutes: '40', questionCount: '10',
  examCount: '20', scope: '', counts: countFields(20),
};

const integer = (number: number, min: number, max: number) => Number.isInteger(number) && number >= min && number <= max;
export function buildSourceOptions(outputs: MaterialOutput[], form: TeachingForm): SourceMaterialOptions | null {
  if (!outputs.length) return null;
  const lesson = outputs.includes('lesson');
  const workbook = outputs.includes('workbook');
  if (!lesson && !workbook) return { outputs };
  const teaching: TeachingSettings = { grade: form.grade, level: form.level, purpose: form.purpose };
  if (lesson) {
    teaching.minutes = Number(form.minutes);
    if (!integer(teaching.minutes, 10, 90)) return null;
  }
  if (workbook || form.purpose === 'exam') {
    teaching.questionCount = Number(form.purpose === 'exam' ? form.examCount : form.questionCount);
    if (!integer(teaching.questionCount, 4, 30)) return null;
  }
  if (form.purpose === 'exam') {
    const counts = Object.fromEntries(examCategories.map(key => [key, Number(form.counts[key])])) as NonNullable<TeachingSettings['exam']>['counts'];
    if (!form.scope.trim() || !examCategories.every(key => form.counts[key] !== '' && integer(counts[key], 0, 30)) ||
        Object.values(counts).reduce((sum, count) => sum + count, 0) !== teaching.questionCount) return null;
    teaching.exam = { scope: form.scope.trim(), counts };
  }
  return { outputs, teaching };
}

export function MaterialGradeField({ value, disabled, onChange }: { value: number; disabled?: boolean; onChange: (grade: number) => void }) {
  const { t } = useTranslation();
  return <label>{t('aiMaterials.grade')}<select aria-label={t('aiMaterials.grade')} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))}>
    {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>
      {t(index < 6 ? 'aiMaterials.primaryGrade' : index < 9 ? 'aiMaterials.middleGrade' : 'aiMaterials.highGrade',
        { grade: index < 6 ? index + 1 : index % 3 + 1 })}
    </option>)}
  </select></label>;
}

const outputLabels = { words: 'textbook.words', sentences: 'textbook.sentences', lesson: 'aiMaterials.lesson', workbook: 'aiMaterials.workbook' } as const;
const outputIcons = { words: 'library_books', sentences: 'notes', lesson: 'co_present', workbook: 'print' } as const;

export default function TeachingMaterialOptions({ outputs, form, disabled, onOutputs, onForm }: {
  outputs: MaterialOutput[]; form: TeachingForm; disabled: boolean;
  onOutputs: (outputs: MaterialOutput[]) => void; onForm: (form: TeachingForm) => void;
}) {
  const { t } = useTranslation();
  const lesson = outputs.includes('lesson');
  const workbook = outputs.includes('workbook');
  const exam = form.purpose === 'exam';
  const count = exam ? form.examCount : form.questionCount;
  const total = Object.values(form.counts).reduce((sum, count) => sum + Number(count), 0);
  return <>
    <fieldset disabled={disabled} className="teaching-output-picker">
      <legend>{t('aiMaterials.outputs')}</legend>
      <div className="teaching-output-options">
        {materialOutputs.map(output => <label className="teaching-output" key={output}>
          <input type="checkbox" checked={outputs.includes(output)} onChange={event =>
            onOutputs(materialOutputs.filter(kind => kind === output ? event.target.checked : outputs.includes(kind)))} />
          <span className="material-symbols-outlined" aria-hidden="true">{outputIcons[output]}</span>
          <span>{t(outputLabels[output])}</span>
        </label>)}
      </div>
    </fieldset>
    {(lesson || workbook) && <fieldset className="teaching-settings" disabled={disabled}>
      <legend>{t('aiMaterials.teachingSettings')}</legend>
      <div className="textbook-fields">
        <MaterialGradeField value={form.grade} onChange={grade => onForm({ ...form, grade })} />
        <label>{t('aiMaterials.level')}<select aria-label={t('aiMaterials.level')} value={form.level} onChange={event =>
          onForm({ ...form, level: event.target.value as TeachingForm['level'] })}>
          {(['foundation', 'standard', 'advanced'] as const).map(level => <option key={level} value={level}>{t(`aiMaterials.${level}`)}</option>)}
        </select></label>
        <label>{t('aiMaterials.purpose')}<select aria-label={t('aiMaterials.purpose')} value={form.purpose} onChange={event =>
          onForm({ ...form, purpose: event.target.value as TeachingForm['purpose'] })}>
          {(['classroom', 'support', 'exam'] as const).map(purpose => <option key={purpose} value={purpose}>{t(`aiMaterials.${purpose}`)}</option>)}
        </select></label>
        {lesson && <label>{t('aiMaterials.lessonMinutes')}<input required type="number" min={10} max={90} value={form.minutes}
          onChange={event => onForm({ ...form, minutes: event.target.value })} /></label>}
        {(workbook || exam) && <label>{t('aiMaterials.questionCount')}<input required type="number" min={4} max={30} value={count}
          onChange={event => {
            const value = event.target.value;
            onForm(exam ? { ...form, examCount: value, counts: integer(Number(value), 4, 30) ? countFields(Number(value)) : form.counts }
              : { ...form, questionCount: value });
          }} /></label>}
        {exam && <label>{t('aiMaterials.examScope')}<input required value={form.scope} maxLength={250} placeholder={t('aiMaterials.examScopeHint')}
          onChange={event => onForm({ ...form, scope: event.target.value })} /></label>}
      </div>
      {exam && <fieldset className="teaching-mix">
        <legend>{t('aiMaterials.examMix')}</legend>
        <div className="textbook-fields">
          {examCategories.map(key => <label key={key}>{t(`aiMaterials.${key}`)}<input required type="number" min={0} max={30}
            value={form.counts[key]} onChange={event => onForm({ ...form, counts: { ...form.counts, [key]: event.target.value } })} /></label>)}
        </div>
        <p className={total === Number(count) ? 'textbook-note' : 'textbook-error'} aria-live="polite">
          {t('aiMaterials.examCount', { actual: total, target: Number(count) })}
        </p>
      </fieldset>}
    </fieldset>}
  </>;
}
