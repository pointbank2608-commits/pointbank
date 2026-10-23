import { useCallback, useEffect, useRef, useState } from 'react';
import { gameClock } from './gameClock';
import { useMiniGameSfx } from './miniGameSfx';
import { shuffled, type StorybookConfig, type StoryGame } from './storybook';

export function useStoryRound(type: StoryGame, config: StorybookConfig, paused: boolean) {
  const sounds=useMiniGameSfx(type,config.sound,paused);
  const [deck] = useState(() => (type === 'sentencetower' ? config.steps : config.shuffle ? shuffled(config.questions) : config.questions).slice(0, type === 'sentencetower' ? undefined : config.count));
  const [phase, setPhase] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [index, setIndex] = useState(0);
  const [reaction, setReaction] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [picked, setPicked] = useState('');
  const [mistakes, setMistakes] = useState(0);
  const [remaining, setRemaining] = useState(config.seconds);
  const [expired, setExpired] = useState(false);
  const locked = useRef(false);
  const timer = useRef<number | null>(null);
  const current = deck[index];
  const answer = current && ('answer' in current ? current.answer : current.phrase);
  const [choices, setChoices] = useState<string[]>([]);
  useEffect(() => { setChoices(current ? shuffled([('answer' in current ? current.answer : current.phrase), ...current.wrong]) : []); }, [current]);
  useEffect(() => () => gameClock.clearTimeout(timer.current), []);
  useEffect(() => {
    if (phase !== 'playing' || !config.seconds || paused || reaction !== 'idle' || expired) return;
    const job = gameClock.setInterval(() => setRemaining(old => { if (old <= 1) { setExpired(true); return 0; } return old - 1; }), 1000);
    return () => gameClock.clearInterval(job);
  }, [phase, index, config.seconds, paused, reaction, expired]);
  const start = useCallback(() => { if (deck.length) { setPhase('playing'); setRemaining(config.seconds);sounds.play('start'); } }, [deck.length, config.seconds,sounds]);
  useEffect(()=>{if(expired)sounds.play('timeUp');},[expired,sounds]);
  function submit(value: string) {
    if (locked.current || phase !== 'playing' || expired || paused || !choices.includes(value)) return;
    locked.current = true;
    setPicked(value);
    const correct = value === answer;
    setReaction(correct ? 'correct' : 'wrong');
    if (!correct) setMistakes(n => n + 1);
    sounds.play(correct?'correct':'wrong');
    timer.current = gameClock.setTimeout(() => {
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
