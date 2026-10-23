import { createRoot } from 'react-dom/client';
import '../../src/tailwind.css';
import i18n from '../../src/i18n';
import { CvcUnitPages } from '../../src/components/worksheets/CvcWorkbookSheets';
import { CVC_UNITS, LONG_UNITS } from '../../src/data/cvcWorkbook';
import { buildPhonicsWorkbook } from '../../src/data/phonicsWorkbook';
import { BrowserRouter } from 'react-router-dom';
import GrammarWorkbookPage from '../../src/pages/GrammarWorkbookPage';
import PhonicsWorkbookPage from '../../src/pages/PhonicsWorkbookPage';
import { curriculumEntries } from '../../src/data/phonicsCurriculum';
const book = new URLSearchParams(location.search).get('book');
void i18n.changeLanguage('ko');
const number = Number(new URLSearchParams(location.search).get('unit') ?? 1);
const step = book === 'stage5' ? 5 : 4;
const unitId = new URLSearchParams(location.search).get('unitId');
const units = buildPhonicsWorkbook(curriculumEntries(), step);
createRoot(document.getElementById('root')!).render(<BrowserRouter>
  {book === 'grammar' ? <GrammarWorkbookPage /> : book === 'picker' ? <PhonicsWorkbookPage step={4} /> :
  <div className="print-sheet mx-auto"><CvcUnitPages unit={book === 'long' ? LONG_UNITS[number - 1] : book?.startsWith('stage') ? (unitId ? units.find(u => u.id === unitId)! : units[number - 1]) : CVC_UNITS[number - 1]} /></div>}
</BrowserRouter>);
