import {useGameHistorySnapshot,useGameHistoryEffect,useGameHistoryClock,captureGameRef,restoreGameRef,useGameHistoryState,useGameHistoryRef} from '../context/GameHistoryContext';
import {useCallback} from 'react';
import {pauseGameClock} from './gameClock';
import { useMiniGameSfx } from './miniGameSfx';
import { adventureRounds, adventureSeconds, type AdventureConfig, type AdventureRound, type AdventureType } from './adventureGames';

export type AdventurePhase = 'ready' | 'playing' | 'review' | 'finale' | 'finished';
interface DetectiveResult { foundOnFirstTry: boolean; repairedOnFirstTry: boolean }
export interface LearningRecord { prompt: string; answer: string; mistakes: number; detective?: DetectiveResult }
export function useAdventureEngine(type: AdventureType,c:AdventureConfig,externalPaused:boolean,preparedRounds?: AdventureRound[]) {
 /* game-history-adapter */
 const historyClock=useGameHistoryClock();
 useGameHistorySnapshot('src/lib/useAdventureEngine.ts:useAdventureEngine',()=>({state:{rounds,phase,index,busy,reaction,notice,mistakes,records,expired,remaining},refs:{roundMistakes:captureGameRef(roundMistakes.current),remainingRef:captureGameRef(remainingRef.current),lock:captureGameRef(lock.current),timer:captureGameRef(timer.current),owner:captureGameRef(owner.current)}}),(snapshot,elapsed)=>{historySetRounds(()=>snapshot.state.rounds);setPhase(()=>snapshot.state.phase);setIndex(()=>snapshot.state.index);setBusy(()=>snapshot.state.busy);setReaction(()=>snapshot.state.reaction);setNotice(()=>snapshot.state.notice);setMistakes(()=>snapshot.state.mistakes);setRecords(()=>snapshot.state.records);setExpired(()=>snapshot.state.expired);setRemaining(()=>snapshot.state.remaining);restoreGameRef(roundMistakes,snapshot.refs.roundMistakes,elapsed,false);restoreGameRef(remainingRef,snapshot.refs.remainingRef,elapsed,false);restoreGameRef(lock,snapshot.refs.lock,elapsed,false);restoreGameRef(timer,snapshot.refs.timer,elapsed,false);restoreGameRef(owner,snapshot.refs.owner,elapsed,false);});

  const [rounds, historySetRounds]=useGameHistoryState("app/src/lib/useAdventureEngine.ts:useAdventureEngine:rounds",()=>preparedRounds ?? adventureRounds(type,c));
  const [phase,setPhase]=useGameHistoryState<AdventurePhase>("app/src/lib/useAdventureEngine.ts:useAdventureEngine:phase",'ready');
  const [index,setIndex]=useGameHistoryState("app/src/lib/useAdventureEngine.ts:useAdventureEngine:index",0);
  const [busy,setBusy]=useGameHistoryState("app/src/lib/useAdventureEngine.ts:useAdventureEngine:busy",false);
  const [reaction,setReaction]=useGameHistoryState<'idle'|'correct'|'wrong'>("app/src/lib/useAdventureEngine.ts:useAdventureEngine:reaction",'idle');
  const [notice,setNotice]=useGameHistoryState("app/src/lib/useAdventureEngine.ts:useAdventureEngine:notice",'');
  const [mistakes,setMistakes]=useGameHistoryState("app/src/lib/useAdventureEngine.ts:useAdventureEngine:mistakes",0);
  const roundMistakes=useGameHistoryRef("app/src/lib/useAdventureEngine.ts:useAdventureEngine:roundMistakes",0);
  const [records,setRecords]=useGameHistoryState<LearningRecord[]>("app/src/lib/useAdventureEngine.ts:useAdventureEngine:records",[]);
  const [expired,setExpired]=useGameHistoryState("app/src/lib/useAdventureEngine.ts:useAdventureEngine:expired",false);
  const [remaining,setRemaining]=useGameHistoryState("app/src/lib/useAdventureEngine.ts:useAdventureEngine:remaining",adventureSeconds(type,c));
  const remainingRef=useGameHistoryRef("app/src/lib/useAdventureEngine.ts:useAdventureEngine:remainingRef",remaining);
  const [hidden,setHidden]=useGameHistoryState("app/src/lib/useAdventureEngine.ts:useAdventureEngine:hidden",()=>document.hidden);
  const lock=useGameHistoryRef("app/src/lib/useAdventureEngine.ts:useAdventureEngine:lock",false),timer=useGameHistoryRef<number|null>("app/src/lib/useAdventureEngine.ts:useAdventureEngine:timer",null);
  const owner=useGameHistoryRef("app/src/lib/useAdventureEngine.ts:useAdventureEngine:owner",`adventure:${crypto.randomUUID()}`);
  const paused=externalPaused||hidden;
  const sounds=useMiniGameSfx(type,c.sound,paused);
  useGameHistoryEffect(()=>{
    const change=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',change);
    return()=>document.removeEventListener('visibilitychange',change);
  }, [], true, "app/src/lib/useAdventureEngine.ts:effect1");
  useGameHistoryEffect(()=>{const key=owner.current;pauseGameClock(key,paused);return()=>pauseGameClock(key,false);}, [paused], false, "app/src/lib/useAdventureEngine.ts:effect2");
  useGameHistoryEffect(()=>()=>historyClock.clearTimeout(timer.current), [], false, "app/src/lib/useAdventureEngine.ts:effect3");
  useGameHistoryEffect(()=>{
    if(phase!=='playing'||busy||expired||paused||!adventureSeconds(type,c))return;
    let previous=historyClock.now();
    const id=historyClock.setInterval(()=>{
      const now=historyClock.now(),delta=Math.max(0,(now-previous)/1000);previous=now;
      remainingRef.current=Math.max(0,remainingRef.current-delta);setRemaining(remainingRef.current);
      if(remainingRef.current<=0)setExpired(true);
    },100);
    return()=>historyClock.clearInterval(id);
  }, [phase,busy,expired,paused,type,c], false, "app/src/lib/useAdventureEngine.ts:effect4");
  const resetTime=useCallback(()=>{const seconds=adventureSeconds(type,c);remainingRef.current=seconds;setRemaining(seconds);setExpired(false);},[type,c]);
  const start=useCallback(()=>{if(rounds.length){resetTime();setPhase('playing');sounds.play('start');}},[rounds.length,resetTime,sounds]);
  useGameHistoryEffect(()=>{if(expired)sounds.play('timeUp');}, [expired,sounds], false, "app/src/lib/useAdventureEngine.ts:effect5");
  function judge(correct:boolean,prompt:string,answer:string,options:{complete?:boolean;duration?:number;detective?:DetectiveResult}={}) {
    if(lock.current||paused||expired||phase!=='playing')return false;
    lock.current=true;setBusy(true);setReaction(correct?'correct':'wrong');
    setNotice(correct?answer:'괜찮아요! 다시 살펴보고 도전해요.');
    if(!correct){roundMistakes.current++;setMistakes(n=>n+1);}
    if(type==='wordfishing'||type==='wordclaw'){
      sounds.play('action');sounds.after(correct?'correct':'wrong',type==='wordfishing'?700:850);
    }else sounds.play(correct?(type==='treasurehunt'&&index+1===rounds.length?'treasure':'correct'):'wrong');
    const complete=options.complete!==false;
    timer.current=historyClock.setTimeout(()=>{
      if(correct&&complete){setRecords(old=>[...old,{prompt,answer,mistakes:roundMistakes.current,detective:options.detective}]);setPhase('review');}
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
