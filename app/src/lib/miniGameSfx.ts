import { useEffect, useMemo, useRef } from 'react';
import { gameClock } from './gameClock';
import { isGameSoundOn, useGameSoundOn } from './gameSfx';
import type { AdventureType } from './adventureGames';
import type { StoryGame } from './storybook';

export type MiniGame = AdventureType | StoryGame;
export type MiniGameCue = 'start' | 'pick' | 'place' | 'shuffle' | 'move' | 'action' | 'correct' | 'wrong' | 'next' | 'finish' | 'timeUp' | 'countdown' | 'launch' | 'treasure';
const common = {start:'intro',pick:'pick',place:'place',shuffle:'shuffle',wrong:'wrong',next:'next',finish:'finish',timeUp:'time-up'};
export const MINI_GAME_SOUNDS: Record<MiniGame, Partial<Record<MiniGameCue,string>>> = {
  feedmonster:{...common,correct:'monster-nibble'},
  sentencebridge:{...common,correct:'bridge-hop'},
  sentencetower:{...common,correct:'tower-stack'},
  balloonpop:{...common,correct:'balloon-pop'},
  wordtrain:{...common,correct:'train-depart',next:'train-arrive'},
  wordfishing:{...common,action:'fish-cast',correct:'fish-catch'},
  sentencerocket:{...common,correct:'rocket-fuel',countdown:'rocket-countdown',launch:'rocket-launch'},
  grammardetective:{...common,correct:'detective-stamp'},
  treasurehunt:{...common,correct:'hunt-step',next:'hunt-step',treasure:'treasure-open'},
  wordclaw:{...common,move:'claw-move',action:'claw-drop',correct:'claw-catch'},
};

// One browser audio context, independent per-game voices. Unlock on the first real
// gesture, including the workspace's start button. No autoplay or silent errors
// from constructing HTMLAudio elements after a delayed React effect.
let context: AudioContext | null = null;
const downloads = new Map<string,Promise<ArrayBuffer>>();
const buffers = new Map<string,Promise<AudioBuffer>>();
const soundUrl = (name:string) => `/sounds/minigames/${name}.wav`;
function download(name:string):Promise<ArrayBuffer> {
  let pending=downloads.get(name);
  if(!pending){pending=fetch(soundUrl(name)).then(response=>{if(!response.ok)throw new Error('Sound unavailable');return response.arrayBuffer();}).catch(error=>{downloads.delete(name);throw error;});downloads.set(name,pending);}
  return pending;
}
async function unlock():Promise<AudioContext|null> {
  const Constructor=window.AudioContext || (window as Window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!Constructor)return null;
  try {context ||= new Constructor();if(context.state==='suspended')await context.resume();return context;}catch{return null;}
}
function decode(name:string,ctx:AudioContext):Promise<AudioBuffer> {
  let pending=buffers.get(name);
  if(!pending){pending=download(name).then(data=>ctx.decodeAudioData(data.slice(0))).catch(error=>{buffers.delete(name);throw error;});buffers.set(name,pending);}
  return pending;
}

/** Scoped effects respect both template sound and the existing global mute.
 * Pause/hidden/unmount cancels active audio AND queued effects; resume never
 * replays old actions. The game clock still owns animation timing.
 */
export function useMiniGameSfx(game:MiniGame,enabled:boolean,paused:boolean) {
  const soundOn=useGameSoundOn();
  const settings=useRef({enabled,paused});settings.current={enabled,paused};
  const player=useMemo(()=>{
    const profile=MINI_GAME_SOUNDS[game];
    const sources=new Set<AudioBufferSourceNode>();
    const timers=new Set<number>();
    let generation=0;
    let gain:GainNode|null=null;
    const allowed=()=>settings.current.enabled&&!settings.current.paused&&!document.hidden&&isGameSoundOn();
    function stop(){generation++;timers.forEach(id=>gameClock.clearTimeout(id));timers.clear();sources.forEach(source=>{try{source.stop();}catch{/* already ended */}source.disconnect();});sources.clear();}
    function play(cue:MiniGameCue,volume=.72){
      const name=profile[cue];if(!name||!allowed())return;
      const ticket=generation,requested=performance.now();
      void unlock().then(async ctx=>{
        if(!ctx)return;
        const buffer=await decode(name,ctx);
        if(ticket!==generation||!allowed()||ctx.state!=='running'||performance.now()-requested>1200)return;
        if(!gain){gain=ctx.createGain();gain.gain.value=.72;gain.connect(ctx.destination);}
        if(sources.size>=4){const oldest=sources.values().next().value;if(oldest){sources.delete(oldest);try{oldest.stop();}catch{/* ended between events */}oldest.disconnect();}}
        const source=ctx.createBufferSource(),level=ctx.createGain();source.buffer=buffer;level.gain.value=Math.max(0,Math.min(volume,1));
        source.connect(level);level.connect(gain);sources.add(source);
        source.onended=()=>{sources.delete(source);source.disconnect();level.disconnect();};source.start();
      }).catch(()=>{/* Unsupported/blocked audio must never interrupt a lesson. */});
    }
    function after(cue:MiniGameCue,delay:number){if(!allowed())return;const ticket=generation;const id=gameClock.setTimeout(()=>{timers.delete(id);if(ticket===generation)play(cue);},delay);timers.add(id);}
    function warm(){if(!settings.current.enabled||!isGameSoundOn()||document.hidden)return;void unlock().then(ctx=>{if(ctx)Object.values(profile).forEach(name=>void decode(name,ctx).catch(()=>{}));});}
    function dispose(){stop();gain?.disconnect();gain=null;}
    return {play,after,stop,warm,dispose};
  },[game]);
  useEffect(()=>{
    if(enabled&&soundOn)Object.values(MINI_GAME_SOUNDS[game]).forEach(name=>void download(name).catch(()=>{}));
  },[game,enabled,soundOn]);
  useEffect(()=>{if(!enabled||!soundOn||paused)player.stop();},[player,enabled,soundOn,paused]);
  useEffect(()=>{
    const visibility=()=>{if(document.hidden)player.stop();};
    const gesture=(event:Event)=>{if(event.isTrusted)player.warm();};
    document.addEventListener('pointerdown',gesture,true);document.addEventListener('keydown',gesture,true);document.addEventListener('visibilitychange',visibility);
    return()=>{document.removeEventListener('pointerdown',gesture,true);document.removeEventListener('keydown',gesture,true);document.removeEventListener('visibilitychange',visibility);player.dispose();};
  },[player]);
  return player;
}
