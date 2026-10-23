import { useCallback, useEffect, useRef, useState } from 'react';
import { gameClock, pauseGameClock } from './gameClock';
import { useMiniGameSfx } from './miniGameSfx';
import { adventureRounds, adventureSeconds, type AdventureConfig, type AdventureType } from './adventureGames';

export type AdventurePhase = 'ready' | 'playing' | 'review' | 'finale' | 'finished';
export interface LearningRecord { prompt: string; answer: string; mistakes: number }
export function useAdventureEngine(type: AdventureType,c:AdventureConfig,externalPaused:boolean) {
  const [rounds]=useState(()=>adventureRounds(type,c));
  const [phase,setPhase]=useState<AdventurePhase>('ready');
  const [index,setIndex]=useState(0);
  const [busy,setBusy]=useState(false);
  const [reaction,setReaction]=useState<'idle'|'correct'|'wrong'>('idle');
  const [notice,setNotice]=useState('');
  const [mistakes,setMistakes]=useState(0);
  const roundMistakes=useRef(0);
  const [records,setRecords]=useState<LearningRecord[]>([]);
  const [expired,setExpired]=useState(false);
  const [remaining,setRemaining]=useState(adventureSeconds(type,c));
  const remainingRef=useRef(remaining);
  const [hidden,setHidden]=useState(()=>document.hidden);
  const lock=useRef(false),timer=useRef<number|null>(null);
  const owner=useRef(`adventure:${crypto.randomUUID()}`);
  const paused=externalPaused||hidden;
  const sounds=useMiniGameSfx(type,c.sound,paused);
  useEffect(()=>{
    const change=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',change);
    return()=>document.removeEventListener('visibilitychange',change);
  },[]);
  useEffect(()=>{const key=owner.current;pauseGameClock(key,paused);return()=>pauseGameClock(key,false);},[paused]);
  useEffect(()=>()=>gameClock.clearTimeout(timer.current),[]);
  useEffect(()=>{
    if(phase!=='playing'||busy||expired||paused||!adventureSeconds(type,c))return;
    let previous=gameClock.now();
    const id=gameClock.setInterval(()=>{
      const now=gameClock.now(),delta=(now-previous)/1000;previous=now;
      remainingRef.current=Math.max(0,remainingRef.current-delta);setRemaining(remainingRef.current);
      if(remainingRef.current<=0)setExpired(true);
    },100);
    return()=>gameClock.clearInterval(id);
  },[phase,busy,expired,paused,type,c]);
  const resetTime=useCallback(()=>{const seconds=adventureSeconds(type,c);remainingRef.current=seconds;setRemaining(seconds);setExpired(false);},[type,c]);
  const start=useCallback(()=>{if(rounds.length){resetTime();setPhase('playing');sounds.play('start');}},[rounds.length,resetTime,sounds]);
  useEffect(()=>{if(expired)sounds.play('timeUp');},[expired,sounds]);
  function judge(correct:boolean,prompt:string,answer:string,options:{complete?:boolean;duration?:number}={}) {
    if(lock.current||paused||expired||phase!=='playing')return false;
    lock.current=true;setBusy(true);setReaction(correct?'correct':'wrong');
    setNotice(correct?answer:'괜찮아요! 다시 살펴보고 도전해요.');
    if(!correct){roundMistakes.current++;setMistakes(n=>n+1);}
    if(type==='wordfishing'||type==='wordclaw'){
      sounds.play('action');sounds.after(correct?'correct':'wrong',type==='wordfishing'?700:850);
    }else sounds.play(correct?(type==='treasurehunt'&&index+1===rounds.length?'treasure':'correct'):'wrong');
    const complete=options.complete!==false;
    timer.current=gameClock.setTimeout(()=>{
      if(correct&&complete){setRecords(old=>[...old,{prompt,answer,mistakes:roundMistakes.current}]);setPhase('review');}
      else setReaction('idle');
      setBusy(false);lock.current=false;
    },options.duration ?? (correct?1600:800));
    return true;
  }
  function next(){
    if(busy||phase!=='review')return;
    if(index+1===rounds.length){setPhase(type==='sentencerocket'?'finale':'finished');if(type!=='sentencerocket')sounds.play('finish');}
    else{setIndex(n=>n+1);setPhase('playing');setReaction('idle');setNotice('');roundMistakes.current=0;resetTime();sounds.play('next');}
  }
  const finish=useCallback(()=>{setPhase('finished');sounds.play('finish');},[sounds]);
  function retry(){resetTime();setNotice('같은 문제에 다시 도전해요.');sounds.play('next');}
  return {rounds,current:rounds[index],phase,index,busy,reaction,notice,mistakes,records,expired,remaining,paused,start,judge,next,finish,retry,sound:sounds.play,total:rounds.length};
}
export type AdventureEngine = ReturnType<typeof useAdventureEngine>;
