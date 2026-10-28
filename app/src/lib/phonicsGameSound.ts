import {createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {isGameSoundOn,setGameSoundOn,useGameSoundOn} from './gameSfx';
import type {PhonicsGame} from './phonicsGames';
import {gameVisual} from './phonicsGameVisuals';

export type PhonicsCue='start'|'pick'|'place'|'retry'|'scene'|'success'|'next'|'finish';
/** Original ClassBank WAVs, produced by scripts/sfx/build-minigame-sfx.py.
 * These are game effects, never spoken letters or phonemes. */
export function phonicsSoundProfile(game:PhonicsGame):Record<PhonicsCue,string>{
 const visual=gameVisual(game);
 const scenes={train:'train-depart',workshop:'tower-stack',garden:'bridge-hop',diner:'monster-nibble',coast:'fish-catch',island:'treasure-open'};
 const scene=game.id==='sound-balloons'?'balloon-pop':visual.prop==='rocket'?'rocket-launch':visual.prop==='sprout'?'rocket-fuel':visual.prop==='book'?'shuffle':visual.prop==='dino'?'hunt-step':scenes[visual.world];
 return {start:'intro',pick:visual.world==='train'?'place':visual.prop==='book'?'shuffle':'pick',place:visual.action==='fish'?'fish-cast':visual.action==='travel'?'hunt-step':'place',retry:'wrong',scene,success:'next',next:visual.world==='train'?'train-arrive':'next',finish:'finish'};
}
const url=(name:string)=>`/sounds/minigames/${name}.wav`;
let context:AudioContext|null=null;
const downloads=new Map<string,Promise<ArrayBuffer>>();
const decoded=new Map<string,Promise<AudioBuffer>>();
function download(name:string){
 let request=downloads.get(name);
 if(!request){request=fetch(url(name)).then(r=>{if(!r.ok)throw Error('Sound unavailable');return r.arrayBuffer();}).catch(error=>{downloads.delete(name);throw error;});downloads.set(name,request);}
 return request;
}
async function unlock(){
 const Constructor=window.AudioContext||(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
 if(!Constructor)return null;
 try{context??=new Constructor();if(context.state==='suspended')await context.resume();return context;}catch{return null;}
}
function buffer(name:string,ctx:AudioContext){
 let request=decoded.get(name);
 if(!request){request=download(name).then(bytes=>ctx.decodeAudioData(bytes.slice(0))).catch(error=>{decoded.delete(name);throw error;});decoded.set(name,request);}
 return request;
}
const volumeKey='classbank.phonics.effectsVolume';
function savedVolume(){try{const value=localStorage.getItem(volumeKey);const number=value===null ? .55 : Number(value);return Number.isFinite(number)?Math.max(0,Math.min(1,number)):.55;}catch{return .55;}}

export function usePhonicsGameSound(game:PhonicsGame,active:boolean){
 const on=useGameSoundOn(),[volume,setVolumeState]=useState(savedVolume);
 const settings=useRef({active,volume});settings.current={active,volume};
 const player=useMemo(()=>{
  const profile=phonicsSoundProfile(game),sources=new Set<AudioBufferSourceNode>(),timers=new Set<number>();
  let generation=0,paused=false,speaking=false,speechGeneration=0,speechTimer:number|undefined,lastPick=-Infinity;
  let master:GainNode|null=null;
  const allowed=()=>settings.current.active&&settings.current.volume>0&&isGameSoundOn()&&!paused&&!speaking&&!document.hidden&&!window.speechSynthesis?.speaking&&!window.speechSynthesis?.pending;
  function stop(){generation++;timers.forEach(id=>window.clearTimeout(id));timers.clear();sources.forEach(source=>{try{source.stop();}catch{/* Already ended. */}source.disconnect();});sources.clear();}
  function endSpeech(){speechGeneration++;speaking=false;window.clearTimeout(speechTimer);}
  function warm(){if(!isGameSoundOn()||document.hidden)return;void unlock().then(ctx=>{if(ctx)Object.values(profile).forEach(name=>void buffer(name,ctx).catch(()=>{}));});}
  function play(cue:PhonicsCue){
   if(!allowed())return;
   if(cue==='pick'){if(performance.now()-lastPick<65)return;lastPick=performance.now();}
   // Semantic feedback replaces the click rather than piling loud sounds up.
   if(['retry','scene','finish','next','start'].includes(cue))stop();
   const ticket=generation,requested=performance.now();
   void unlock().then(async ctx=>{
    if(!ctx)return;const audio=await buffer(profile[cue],ctx);
    if(ticket!==generation||!allowed()||ctx.state!=='running'||performance.now()-requested>700)return;
    if(!master){master=ctx.createGain();master.connect(ctx.destination);}
    master.gain.setValueAtTime(settings.current.volume,ctx.currentTime);
    if(sources.size>=3){const oldest=sources.values().next().value;if(oldest){sources.delete(oldest);try{oldest.stop();}catch{/* Ended. */}oldest.disconnect();}}
    const source=ctx.createBufferSource();source.buffer=audio;source.connect(master);sources.add(source);
    source.onended=()=>{sources.delete(source);source.disconnect();};source.start();
   }).catch(()=>{/* Missing or blocked audio must never stop a lesson. */});
  }
  function after(cue:PhonicsCue,delay:number){if(!allowed())return;const ticket=generation;const id=window.setTimeout(()=>{timers.delete(id);if(ticket===generation)play(cue);},delay);timers.add(id);}
  function answer(){play('scene');after('success',profile.scene==='rocket-launch'?2350:profile.scene==='train-depart'?1500:650);}
  function speechStart(text:string){
   stop();endSpeech();speaking=true;const ticket=speechGeneration;
   const end=()=>{if(ticket===speechGeneration)endSpeech();};
   // A missing browser end/error callback cannot leave effects muted forever.
   speechTimer=window.setTimeout(end,Math.min(30000,2500+text.length*180));return end;
  }
  function pause(value:boolean){paused=value;if(value){stop();endSpeech();}}
  function sync(){if(master&&context)master.gain.setValueAtTime(settings.current.volume,context.currentTime);if(!isGameSoundOn()||!settings.current.active||!settings.current.volume)stop();}
  function dispose(){stop();endSpeech();master?.disconnect();master=null;}
  const cancelSpeech=()=>{endSpeech();window.speechSynthesis?.cancel();};
  return {play,after,answer,stop,warm,speechStart,cancelSpeech,pause,sync,dispose};
 },[game]);
 useEffect(()=>{player.sync();},[player,active,on,volume]);
 useEffect(()=>{
  const gesture=(event:Event)=>{if(event.isTrusted)player.warm();};
  const visibility=()=>{if(document.hidden){player.stop();player.cancelSpeech();}};
  document.addEventListener('pointerdown',gesture,true);document.addEventListener('keydown',gesture,true);document.addEventListener('visibilitychange',visibility);
  return()=>{document.removeEventListener('pointerdown',gesture,true);document.removeEventListener('keydown',gesture,true);document.removeEventListener('visibilitychange',visibility);player.dispose();};
 },[player]);
 const setVolume=(value:number)=>{const next=Number.isFinite(value)?Math.max(0,Math.min(1,value)):.55;settings.current.volume=next;player.sync();setVolumeState(next);try{localStorage.setItem(volumeKey,String(next));}catch{/* Keep this session's setting. */}};
 return {player,on,volume,setVolume,toggle:()=>setGameSoundOn(!isGameSoundOn())};
}
export const PhonicsSoundContext=createContext<ReturnType<typeof usePhonicsGameSound>|null>(null);
export function usePhonicsSound(){const sound=useContext(PhonicsSoundContext);if(!sound)throw Error('Phonics sound provider missing');return sound;}
