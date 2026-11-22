import {useGameHistorySnapshot,useGameHistoryEffect,useGameHistoryClock,captureGameRef,restoreGameRef,useGameHistoryState,useGameHistoryRef} from '../context/GameHistoryContext';
import {useCallback} from 'react';

import { useMiniGameSfx } from './miniGameSfx';
import { shuffled, type StorybookConfig, type StoryGame } from './storybook';

export function useStoryRound(type: StoryGame, config: StorybookConfig, paused: boolean) {
 /* game-history-adapter */
 const historyClock=useGameHistoryClock();
 useGameHistorySnapshot('src/lib/useStoryRound.ts:useStoryRound',()=>({state:{deck,phase,index,reaction,picked,mistakes,remaining,expired,choices},refs:{locked:captureGameRef(locked.current),timer:captureGameRef(timer.current)}}),(snapshot,elapsed)=>{historySetDeck(()=>snapshot.state.deck);setPhase(()=>snapshot.state.phase);setIndex(()=>snapshot.state.index);setReaction(()=>snapshot.state.reaction);setPicked(()=>snapshot.state.picked);setMistakes(()=>snapshot.state.mistakes);setRemaining(()=>snapshot.state.remaining);setExpired(()=>snapshot.state.expired);setChoices(()=>snapshot.state.choices);restoreGameRef(locked,snapshot.refs.locked,elapsed,false);restoreGameRef(timer,snapshot.refs.timer,elapsed,false);});

  const sounds=useMiniGameSfx(type,config.sound,paused);
  const [deck, historySetDeck] = useGameHistoryState("app/src/lib/useStoryRound.ts:useStoryRound:deck",() => (type === 'sentencetower' ? config.steps : config.shuffle ? shuffled(config.questions) : config.questions).slice(0, type === 'sentencetower' ? undefined : config.count));
  const [phase, setPhase] = useGameHistoryState<'ready' | 'playing' | 'finished'>("app/src/lib/useStoryRound.ts:useStoryRound:phase",'ready');
  const [index, setIndex] = useGameHistoryState("app/src/lib/useStoryRound.ts:useStoryRound:index",0);
  const [reaction, setReaction] = useGameHistoryState<'idle' | 'correct' | 'wrong'>("app/src/lib/useStoryRound.ts:useStoryRound:reaction",'idle');
  const [picked, setPicked] = useGameHistoryState("app/src/lib/useStoryRound.ts:useStoryRound:picked",'');
  const [mistakes, setMistakes] = useGameHistoryState("app/src/lib/useStoryRound.ts:useStoryRound:mistakes",0);
  const [remaining, setRemaining] = useGameHistoryState("app/src/lib/useStoryRound.ts:useStoryRound:remaining",config.seconds);
  const [expired, setExpired] = useGameHistoryState("app/src/lib/useStoryRound.ts:useStoryRound:expired",false);
  const locked = useGameHistoryRef("app/src/lib/useStoryRound.ts:useStoryRound:locked",false);
  const timer = useGameHistoryRef<number | null>("app/src/lib/useStoryRound.ts:useStoryRound:timer",null);
  const current = deck[index];
  const answer = current && ('answer' in current ? current.answer : current.phrase);
  const [choices, setChoices] = useGameHistoryState<string[]>("app/src/lib/useStoryRound.ts:useStoryRound:choices",[]);
  useGameHistoryEffect(() => { setChoices(current ? shuffled([('answer' in current ? current.answer : current.phrase), ...current.wrong]) : []); }, [current], false, "app/src/lib/useStoryRound.ts:effect1");
  useGameHistoryEffect(() => () => historyClock.clearTimeout(timer.current), [], false, "app/src/lib/useStoryRound.ts:effect2");
  useGameHistoryEffect(() => {
    if (phase !== 'playing' || !config.seconds || paused || reaction !== 'idle' || expired) return;
    const job = historyClock.setInterval(() => setRemaining(old => { if (old <= 1) { setExpired(true); return 0; } return old - 1; }), 1000);
    return () => historyClock.clearInterval(job);
  }, [phase, index, config.seconds, paused, reaction, expired], false, "app/src/lib/useStoryRound.ts:effect3");
  const start = useCallback(() => { if (deck.length) { setPhase('playing'); setRemaining(config.seconds);sounds.play('start'); } }, [deck.length, config.seconds,sounds]);
  useGameHistoryEffect(()=>{if(expired)sounds.play('timeUp');}, [expired,sounds], false, "app/src/lib/useStoryRound.ts:effect4");
  function submit(value: string) {
    if (locked.current || phase !== 'playing' || expired || paused || !choices.includes(value)) return;
    locked.current = true;
    setPicked(value);
    const correct = value === answer;
    setReaction(correct ? 'correct' : 'wrong');
    if (!correct) setMistakes(n => n + 1);
    sounds.play(correct?'correct':'wrong');
    timer.current = historyClock.setTimeout(() => {
      if (correct) {
        if (index + 1 === deck.length) { setPhase('finished');sounds.play('finish'); }
        else {setIndex(n => n + 1);sounds.play('next');}
      }
      setPicked(''); setReaction('idle'); setRemaining(config.seconds); locked.current = false;
    }, correct ? 1450 : 850);
  }
  function retry() { setExpired(false); setRemaining(config.seconds);sounds.play('next'); }
  return { deck, phase, index, reaction, picked, mistakes, remaining, expired, choices, start, submit, retry,sound:sounds.play, total: deck.length };
}
