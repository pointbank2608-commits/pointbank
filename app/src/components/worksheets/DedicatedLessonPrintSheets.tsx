import { useTranslation } from 'react-i18next';
import { GRAMMAR_SHEET_BANK } from '../../data/grammarSheets';
import { grammarPoint } from '../../lib/grammar';
import { unitOf } from '../../lib/curriculumGrammar';
import { buildSheetData, KIND_PAGES, SHEET_KINDS } from '../../lib/grammarSheets';
import { buildElementaryBooklets, workbookBankWithVerbContinuation } from '../../lib/elementary800Workbook';
import AirportWorksheetPage from '../../pages/AirportWorksheetPage';
import DoctorWorksheetPage from '../../pages/DoctorWorksheetPage';
import IceCreamWorksheetPage from '../../pages/IceCreamWorksheetPage';
import LightningWorksheetPage from '../../pages/LightningWorksheetPage';
import { MysteryBoxSheets } from '../../pages/MysteryBoxPrintPage';
import RestaurantWorksheetPage from '../../pages/RestaurantWorksheetPage';
import Elementary800Sheets from './Elementary800Sheets';
import { BuildSheet, ChooseSheet, CorrectSheet, DiscoverSheet, ReviewSheet, SaySheet } from './GrammarIntentSheets';
import '../../styles/elementary800.css';

const grammarSheets = {
  discover: DiscoverSheet, choose: ChooseSheet, build: BuildSheet,
  correct: CorrectSheet, say: SaySheet, review: ReviewSheet,
};
const sampleGrammarId = 'third-s';
const point = grammarPoint(sampleGrammarId)!;
const neighbors = (unitOf(sampleGrammarId)?.ids ?? []).filter(id => id !== sampleGrammarId)
  .map(id => ({ name: grammarPoint(id)?.name ?? id, content: GRAMMAR_SHEET_BANK[id] }));
const grammarSample = buildSheetData(point, GRAMMAR_SHEET_BANK[sampleGrammarId], neighbors, 'A');
const vocabularySample = buildElementaryBooklets(workbookBankWithVerbContinuation([])).filter(book => book.pos === 'verb').slice(0, 1);

export default function DedicatedLessonPrintSheets({ materialId }: { materialId: string }) {
  const { t } = useTranslation();
  switch (materialId) {
    case 'airport': return <AirportWorksheetPage printOnly />;
    case 'doctor': return <DoctorWorksheetPage printOnly />;
    case 'icecream': return <IceCreamWorksheetPage printOnly />;
    case 'restaurant': return <RestaurantWorksheetPage printOnly />;
    case 'lightning': return <LightningWorksheetPage printOnly />;
    case 'mysterybox': return <MysteryBoxSheets />;
    case 'elementary800-workbook':
      return <Elementary800Sheets books={vocabularySample} kind="both" copies={1} cover={false} guide={false} mono={false} />;
    case 'grammarworkbook':
      return <div className="space-y-8">{SHEET_KINDS.flatMap(kind => {
        const Sheet = grammarSheets[kind];
        return Array.from({ length: KIND_PAGES[kind] }, (_, part) =>
          <Sheet key={`${kind}-${part}`} data={grammarSample} support={2} part={part} />);
      })}</div>;
    default:
      return <p className="p-3 text-sm">{t('lessonUx.previewUnavailable')}</p>;
  }
}
