import { useTranslation } from 'react-i18next';
import { workbookOfMaterial, workbookNumbers, stableWorkbookRefs } from '../../data/cvcWorkbook';
import { buildPhonicsWorkbook, workbookPrintable } from '../../data/phonicsWorkbook';
import type { MaterialSlide, PhonicsBankEntry } from '../../lib/types';
import { workbookStep } from '../LessonPrintPreview';
import { CvcUnitPicker } from './CvcWorkbookSheets';

export type LessonWorkbookSelection = Pick<MaterialSlide, 'cvcUnits' | 'phonicsUnitIds'>;

export default function LessonWorkbookUnits({slide, entries, onUpdate}: {
  slide: MaterialSlide;
  entries: PhonicsBankEntry[];
  onUpdate: (patch: LessonWorkbookSelection) => void;
}) {
  const {t} = useTranslation();
  const book = workbookOfMaterial(slide.materialId);
  const step = workbookStep(slide.materialId);
  if (book) return <div role="group" aria-label={t('lessonUx.unit')} className="space-y-2">
    <p className="font-bold">{t('lessonUx.unit')}</p>
    <CvcUnitPicker book={book.id}
      selected={slide.phonicsUnitIds ? workbookNumbers(book.id, slide.phonicsUnitIds) : slide.cvcUnits ?? []}
      onChange={cvcUnits => onUpdate({cvcUnits, phonicsUnitIds: stableWorkbookRefs(book.id, cvcUnits)})}
      vowelLabel={vowel => t(book.id === 'cvc' ? 'materials.cvc.vowel' : 'materials.cvc.longVowel', {vowel})} />
  </div>;
  if (!step) return null;
  const units = buildPhonicsWorkbook(entries, step).filter(workbookPrintable);
  return <label className="grid gap-1 font-bold">{t('lessonUx.unit')}
    <select className="min-w-0 rounded-lg border bg-white p-2" value={slide.phonicsUnitIds?.[0] ?? ''}
      onChange={event => onUpdate({phonicsUnitIds: event.target.value ? [event.target.value] : undefined})}>
      <option value="">{t('lessonUx.needUnit')}</option>
      {units.map(unit => <option key={unit.id} value={unit.id}>{unit.family} · {unit.words.join(' / ')}</option>)}
    </select>
  </label>;
}
