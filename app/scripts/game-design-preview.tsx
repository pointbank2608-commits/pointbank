// Local-only review of actual components. No auth or database writes.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import '../src/i18n';
import '../src/tailwind.css';
import { GAME_CATALOG } from '../src/lib/gameCatalog';
import GameThemeFrame from '../src/components/GameThemeFrame';
import Connect4 from '../src/components/Connect4';
import Popcorn from '../src/components/Popcorn';
import PassTheBall from '../src/components/PassTheBall';
import TwoDice from '../src/components/TwoDice';
import Quiz from '../src/components/Quiz';
import Hangman from '../src/components/Hangman';
import TrueFalse from '../src/components/TrueFalse';
import Matchup from '../src/components/Matchup';
import WhackAMole from '../src/components/WhackAMole';
import Flashcards from '../src/components/Flashcards';
import Anagram from '../src/components/Anagram';
import GroupSort from '../src/components/GroupSort';
import SentenceUnscramble from '../src/components/SentenceUnscramble';
import TypeAnswer from '../src/components/TypeAnswer';
import SpellTheWord from '../src/components/SpellTheWord';
import RankOrder from '../src/components/RankOrder';
import WordSearch from '../src/components/WordSearch';
import Crossword from '../src/components/Crossword';
import MathGenerator from '../src/components/MathGenerator';
import MazeChase from '../src/components/MazeChase';
import Airplane from '../src/components/Airplane';
import LabeledDiagram from '../src/components/LabeledDiagram';
import ImageQuiz from '../src/components/ImageQuiz';
import GameShowQuiz from '../src/components/GameShowQuiz';
import WinLoseQuiz from '../src/components/WinLoseQuiz';
const games = GAME_CATALOG.filter((game) => game.number >= 10 && game.number <= 34);
const items = ['cat','dog','sun','book','apple','happy'].map((label,i) => ({id:`i${i}`,label}));
const pairs = items.map((item,i) => ({id:item.id,left:item.label,right:['고양이','강아지','태양','책','사과','행복한'][i]}));
const questions = pairs.map((pair) => ({id:pair.id,question:pair.left,choices:[pair.right,'나무','바다','교실'],correctIndex:0}));
export function Preview() {
  const { t, i18n } = useTranslation();
  const [number,setNumber] = useState(13);
  const [round,setRound] = useState(0);
  const game = games.find((game) => game.number === number)!;
  const body = (() => {
    switch(number) {
      case 10:return <Connect4 items={items}/>;
      case 11:return <Popcorn items={items}/>;
      case 12:return <PassTheBall items={items} minSec={2} maxSec={3} music={null} resultSound={null}/>;
      case 13:return <TwoDice items={items}/>;
      case 14:return <Quiz questions={questions}/>;
      case 15:return <Hangman items={items} maxAttempts={6}/>;
      case 16:return <TrueFalse statements={[{id:'tf1',text:'cat = 고양이',isTrue:true},{id:'tf2',text:'sun = 바다',isTrue:false}]}/>;
      case 17:return <Matchup pairs={pairs}/>;
      case 18:return <WhackAMole pairs={pairs}/>;
      case 19:return <Flashcards cards={pairs}/>;
      case 20:return <Anagram items={items}/>;
      case 21:return <GroupSort groups={[{id:'a',name:'동물',items:[{id:'c',text:'cat'},{id:'d',text:'dog'}]},{id:'b',name:'과일',items:[{id:'e',text:'apple'},{id:'f',text:'banana'}]}]}/>;
      case 22:return <SentenceUnscramble items={[{id:'s1',label:'I like my school'},{id:'s2',label:'We read a book'}]}/>;
      case 23:return <TypeAnswer entries={pairs.map(p=>({id:p.id,prompt:p.right,answer:p.left}))} mode="question"/>;
      case 24:return <SpellTheWord items={items} previewSeconds={3}/>;
      case 25:return <RankOrder items={items}/>;
      case 26:return <WordSearch items={items}/>;
      case 27:return <Crossword items={items}/>;
      case 28:return <MathGenerator operations={['add']} min={1} max={9} questionCount={5}/>;
      case 29:return <MazeChase items={items}/>;
      case 30:return <Airplane items={items}/>;
      case 31:return <LabeledDiagram imageUrl="/covers/game-matchup.jpg" pins={[{id:'p1',label:'책',x:.5,y:.5},{id:'p2',label:'카드',x:.25,y:.8}]}/>;
      case 32:return <ImageQuiz items={[{id:'iq1',imageUrl:'/covers/game-wheel.jpg',answer:'돌림판'}]} revealSeconds={5}/>;
      case 33:return <GameShowQuiz questions={questions} bonusEvery={3} lifelines={2}/>;
      case 34:return <WinLoseQuiz questions={questions} startScore={10} betOptions={[1,3,5]}/>;
    }
  })();
  return <main className="mx-auto max-w-5xl px-4 py-5 sm:px-8">
    <header className="mb-5 flex flex-wrap items-center gap-4">
      <img src={game.cover ?? ''} alt="" className="h-20 w-28 rounded-2xl object-cover"/>
      <div><p className="text-sm text-on-surface-variant">CLASSBANK · CLAY & BIRCH</p><h1 className="text-2xl font-bold">{number}. {t(game.nameKey)}</h1></div>
      <label className="ml-auto">게임 선택 <select aria-label="게임 선택" className="ml-2 rounded-xl border p-3" value={number} onChange={e=>setNumber(Number(e.target.value))}>{games.map(g=><option key={g.number} value={g.number}>{g.number}. {t(g.nameKey)}</option>)}</select></label>
      <button className="rounded-xl border p-3" onClick={()=>void i18n.changeLanguage(i18n.language==='ko'?'en':'ko')}>한국어 / English</button>
    </header>
    <GameThemeFrame gameType={game.type} className="p-4 sm:p-6" onRestart={()=>setRound(r=>r+1)} roster={[{id:'a',label:'테스트 A'},{id:'b',label:'테스트 B'}]}>
      <div key={`${number}-${round}`}>{body}</div>
    </GameThemeFrame>
    <p className="mt-6 text-sm text-on-surface-variant">로컬 디자인 검증 · 예시 단어만 사용하며 학원 데이터는 저장하지 않습니다.</p>
  </main>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<Preview/>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
