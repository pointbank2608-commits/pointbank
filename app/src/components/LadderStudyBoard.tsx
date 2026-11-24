import { useTranslation } from 'react-i18next';
import { useGameHistoryState, useGameHistorySnapshot } from '../context/GameHistoryContext';
import { useOptionalLessonRunner, usePresenting } from '../context/LessonRunnerContext';
import { useGameEmbed } from '../context/GameEmbedContext';
import { useLearningActivity } from '../lib/learningSensors/useLearningActivity';
import { firstStudyLadder, ladderStudyCards, studyLadderRound } from '../lib/ladderStudy';
import { tracePath } from '../lib/ladder';
import { announceRoundDone } from '../lib/teamOrder';
import type { FullCardItem, LadderFace, LadderStudy } from '../lib/types';

function Face({card, face}: {card: FullCardItem; face: LadderFace}) {
  return face === 'imageUrl'
    ? <img className="mx-auto h-20 w-full object-contain" src={card.imageUrl!} alt={card.word}/>
    : <span className="break-words">{card[face]}</span>;
}

export default function LadderStudyBoard({study}: {study: LadderStudy}) {
  const {i18n} = useTranslation();
  const en = i18n.language.startsWith('en');
  const cards = ladderStudyCards(study);
  const [round, setRound] = useGameHistoryState('ladderStudy.round', () => firstStudyLadder(cards.length));
  const [start, setStart] = useGameHistoryState<number|null>('ladderStudy.start', null);
  const [guess, setGuess] = useGameHistoryState<number|null>('ladderStudy.guess', null);
  const [done, setDone] = useGameHistoryState<number[]>('ladderStudy.done', []);
  useGameHistorySnapshot('ladderStudy', () => ({round,start,guess,done}), saved => {
    setRound(saved.round); setStart(saved.start); setGuess(saved.guess); setDone(saved.done);
  });
  const runner = useOptionalLessonRunner()?.runner;
  const presenting = usePresenting();
  const embed = useGameEmbed();
  const prompt = start === null ? undefined : cards[round.starts[start]];
  const observe = useLearningActivity(presenting && !embed?.preview && runner ? {source:'group',credential:'',resource:runner.lessonId} : undefined,
    prompt ? runner?.stepIndex ?? null : null, prompt ? study.cards.indexOf(prompt) : null);
  if (cards.length < 2) return <p>{en?'Choose at least two complete pairs in Game settings.':'게임설정에서 출제 가능한 단어 짝을 두 개 이상 준비해 주세요.'}</p>;
  const {grid, starts, ends, destinations} = round;
  const correct = start === null ? null : destinations[start];
  const revealed = guess !== null && start !== null;
  const path = revealed ? tracePath(grid, start).map(({row,col},i)=>`${i?'L':'M'} ${col*100+50} ${row*20+8}`).join(' ') : '';
  const last = round.offset + starts.length >= cards.length;
  const tile = 'min-w-0 rounded-2xl border-2 bg-white px-2 py-3 text-center text-xl font-extrabold text-deep-navy shadow-sm focus-visible:outline-4 focus-visible:outline-primary';
  function next() {
    if (done.length === starts.length) {
      setRound(last ? firstStudyLadder(cards.length) : studyLadderRound(round.order, round.offset + starts.length));
      setDone([]);
    }
    setStart(null); setGuess(null);
  }
  return <section className="mx-auto w-full max-w-5xl rounded-3xl bg-white/80 p-4 text-center" data-ladder-study>
    <p className="mb-4 text-xl font-bold" aria-live="polite">{revealed
      ? (guess === correct ? (en?'Correct!':'맞았어요!') : (en?'Follow the path to the matching answer.':'길을 따라 맞는 짝을 확인해 보세요.'))
      : start === null ? (en?'Choose a starting card.':'출발 카드를 고르세요.') : (en?'Where will it land? Choose the matching card.':'어디에 도착할까요? 짝이 되는 카드를 고르세요.')}</p>
    <div className="grid gap-1" style={{gridTemplateColumns:`repeat(${starts.length}, minmax(0, 1fr))`}} data-study-starts>
      {starts.map((id,i)=><button key={id} type="button" aria-pressed={start===i} disabled={revealed || done.includes(i)}
        className={tile + (start===i?' border-primary bg-sky-50':' border-outline-variant disabled:opacity-50')} onClick={()=>setStart(i)}><Face card={cards[id]} face={study.from}/></button>)}
    </div>
    <svg className="my-1 h-40 w-full md:h-56" viewBox={`0 0 ${grid.cols*100} ${grid.rows*20+16}`} preserveAspectRatio="none" aria-hidden="true">
      {starts.map((id,i)=><image key={id} href="/skins/ladder-rail.png" x={i*100+44} y="4" width="12" height={grid.rows*20+8} preserveAspectRatio="none"/>)}
      {revealed && grid.rungs.map((row,r)=>row.map((on,c)=>on && <image key={r+'-'+c} href="/skins/ladder-rung.png" x={c*100+50} y={r*20+15} width="100" height="6" preserveAspectRatio="none"/>))}
      {revealed && <path data-study-path d={path} pathLength="1" fill="none" stroke="#0866db" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="ladder-study-path"/>}
    </svg>
    <div className="grid gap-1" style={{gridTemplateColumns:`repeat(${ends.length}, minmax(0, 1fr))`}} data-study-ends>
      {ends.map((id,i)=><button key={id} type="button" disabled={start===null || revealed}
        className={tile+(revealed && i===correct?' border-green-600 bg-green-50':revealed && i===guess?' border-red-500 bg-red-50':' border-outline-variant')}
        onClick={()=>{if(start===null || revealed)return; observe('submitted'); setGuess(i); setDone([...done,start]); observe('revealed'); announceRoundDone();}}>
        <Face card={cards[id]} face={study.to}/>{revealed && i===correct && <span className="block text-sm text-green-800">{en?'Answer':'정답'}</span>}
      </button>)}
    </div>
    <div className="mt-3 flex min-h-11 items-center justify-center gap-3 text-sm font-bold">
      <span>{round.offset+done.length} / {cards.length}</span>
      {revealed && <button type="button" className="min-h-11 rounded-xl bg-primary px-5 text-white" onClick={next}>
        {done.length===starts.length ? last ? (en?'Play again':'다시 하기') : (en?'Next board':'다음 판') : (en?'Next pair':'다음 단어')}
      </button>}
    </div>
  </section>;
}
