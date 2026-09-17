// Local regression fixture: no authentication, database calls, or student data.
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/i18n';
import '../src/tailwind.css';
import GameThemeFrame from '../src/components/GameThemeFrame';
import Quiz from '../src/components/Quiz';
import Matchup from '../src/components/Matchup';
import GameShowQuiz from '../src/components/GameShowQuiz';
import WordListGameLauncher from '../src/components/WordListGameLauncher';
import { WordListEditor } from '../src/pages/WordListsPage';
import { ToastProvider } from '../src/context/ToastContext';
import type { WordList, WordListItem } from '../src/lib/types';
const questions = [{ id: 'q1', question: 'cat', choices: ['고양이', '개'], correctIndex: 0 }];
const pairs = [{ id: 'p1', left: 'cat', right: '고양이' }, { id: 'p2', left: 'dog', right: '개' }];
const longPairs = Array.from({ length: 13 }, (_, index) => ({ id: `p${index}`, left: `word ${index + 1}`, right: `뜻 ${index + 1}` }));
const sampleList: WordList = { id: 'local-list', academy_id: 'local-academy', class_id: null, name: '검증용 단어장', created_by: null, created_at: '', updated_at: '', items: pairs.map((pair) => ({ id: pair.id, word: pair.left, meaning: pair.right, image_url: null, category: null })) };
const sampleClasses = [{ id: 'local-class', academy_id: 'local-academy', name: '검증용 반', sort_order: 0, created_at: '' }];
export function Fixture() {
  const [kind, setKind] = useState('matchup');
  const [round, setRound] = useState(0);
  const [list, setList] = useState(sampleList);
  const [launcher, setLauncher] = useState(false);
  const [paid, setPaid] = useState(true);
  const [result, setResult] = useState('');
  const attempts = useRef(0);
  async function saveItems(_id: string, _items: WordListItem[]) {
    attempts.current += 1;
    setResult(`저장 요청 ${attempts.current}회`);
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (attempts.current === 1) throw new Error('Intentional local save failure');
  }
  return <ToastProvider><main className="mx-auto max-w-4xl p-4 sm:p-8">
    <h1>전체화면 상태 유지 회귀 검증</h1>
    <p>정답 처리 후 전체화면 진입·종료, 목록 숨김을 실행하세요. 정답·점수·완료 상태가 유지되어야 합니다. 다시하기만 초기화해야 합니다.</p>
    {['matchup', 'matchup13', 'quiz', 'gameshow', 'editor'].map((name) => <button className="m-2 rounded border p-3" key={name} onClick={() => setKind(name)}>{name}</button>)}
    <button className="m-2 rounded border p-3" onClick={() => setLauncher(true)}>단어장 게임 선택 검증</button>
    <label><input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} />유료 계정 조건</label>
    <p role="status">{result}</p>
    {kind === 'editor' ? <WordListEditor list={list} onChange={(items) => setList((prev) => ({ ...prev, items }))} saveItems={saveItems} /> :
    <GameThemeFrame className="mt-8 rounded border p-4" roster={[{ id: 'one', label: '테스트 A' }, { id: 'two', label: '테스트 B' }]} onRestart={() => setRound((r) => r + 1)}>
      {kind === 'matchup' || kind === 'matchup13' ? <Matchup key={`${kind}-${round}`} pairs={kind === 'matchup13' ? longPairs : pairs} />
        : kind === 'quiz' ? <Quiz key={`quiz-${round}`} questions={questions} />
        : <GameShowQuiz key={`gameshow-${round}`} questions={questions} bonusEvery={0} lifelines={2} />}
    </GameThemeFrame>}
    {launcher && <WordListGameLauncher list={list} classes={sampleClasses} selectedClassId="local-class" isPaid={paid} busy={false} error={false} onClose={() => setLauncher(false)} onLaunch={(game, classId) => { setResult(`선택: ${game}, ${classId}`); setLauncher(false); }} />}
  </main></ToastProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
