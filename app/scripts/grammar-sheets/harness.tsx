// 로그인 없이 문법 워크북 시트를 그려 보는 검증용 진입점(운영 빌드에 들어가지 않는다). 쿼리: ?topic=id&support=1|2|3&set=A|B
import { createRoot } from 'react-dom/client';
import '../../src/tailwind.css';
import { grammarPoint } from '../../src/lib/grammar';
import { unitOf } from '../../src/lib/curriculumGrammar';
import { GRAMMAR_SHEET_BANK } from '../../src/data/grammarSheets';
import { buildSheetData, KEY_PAGES, KIND_PAGES, SHEET_KINDS, type SheetSet, type Support } from '../../src/lib/grammarSheets';
import { BuildSheet, ChooseSheet, CorrectSheet, DiscoverSheet, ReviewSheet, SaySheet, TeacherKey } from '../../src/components/worksheets/GrammarIntentSheets';

const SHEETS = { discover: DiscoverSheet, choose: ChooseSheet, build: BuildSheet, correct: CorrectSheet, say: SaySheet, review: ReviewSheet };
function App() {
  const q = new URLSearchParams(location.search);
  const id = q.get('topic') ?? 'third-s';
  const support = (Number(q.get('support')) || 2) as Support;
  const point = grammarPoint(id);
  const content = GRAMMAR_SHEET_BANK[id];
  if (!point || !content) return <p id="missing">missing {id}</p>;
  const unit = unitOf(id);
  const neighbors = (unit?.ids ?? []).filter((x) => x !== id).map((x) => ({ name: grammarPoint(x)?.name ?? x, content: GRAMMAR_SHEET_BANK[x] }));
  const set = (q.get('set') === 'B' ? 'B' : 'A') as SheetSet;
  if (set === 'B' && !content.b) return <p id="missing">no B {id}</p>;
  const data = buildSheetData(point, content, neighbors, set);
  return <div id="ready" style={{ width: '186mm', margin: '0 auto' }}>
    {SHEET_KINDS.map((k) => { const S = SHEETS[k]; return Array.from({ length: KIND_PAGES[k] }, (_, part) => <S key={`${k}${part}`} data={data} support={support} part={part} />); })}
    {Array.from({ length: KEY_PAGES }, (_, part) => <TeacherKey key={`key${part}`} data={data} kinds={[...SHEET_KINDS]} part={part} />)}
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
