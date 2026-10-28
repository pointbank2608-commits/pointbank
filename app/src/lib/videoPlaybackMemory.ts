import type {ShadowFlow,ShadowSubtitle} from '../components/ShadowBoard';
export interface PlaybackMemory{idx:number;time:number;flow:ShadowFlow;repeat:number;speed:number;subtitle:ShadowSubtitle;roleTeams:number;}
/** Only a tab/session teaching aid; never changes saved lessons or starts audio on return. */
const memory=new Map<string,PlaybackMemory>();
export const readPlaybackMemory=(key?:string)=>key?memory.get(key):undefined;
export const writePlaybackMemory=(key:string|undefined,value:PlaybackMemory)=>{if(key)memory.set(key,value);};
