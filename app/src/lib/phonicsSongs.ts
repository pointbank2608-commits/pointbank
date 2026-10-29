import {courseUnits} from '../data/phonicsLessons';
import {adminSaveVideoClip,fetchVideoClips,isBlockedChannel,type VideoClip} from './videoClips';
export const PHONICS_SONG_TAG='classbank:phonics-song';
export const isPhonicsSong=(clip:VideoClip)=>clip.tags.includes(PHONICS_SONG_TAG);
export const linkedSongUnits=(clip:VideoClip)=>clip.pack?.phonicsSong?.unitIds??[];
export function songYoutubeId(value:string):string|null{try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol))return null;const host=url.hostname.toLowerCase();let id:string|undefined|null;if(host==='youtu.be')id=url.pathname.match(/^\/([-\w]{11})\/?$/)?.[1];else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(host))id=url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:embed|shorts)\/([-\w]{11})\/?$/)?.[1];return id&&/^[-\w]{11}$/.test(id)?id:null;}catch{return null;}}
export function validatePhonicsSong(input:{title:string;url:string;channel:string;duration:number;unitIds:string[]}):'url'|'fields'|null{
 if(!songYoutubeId(input.url))return 'url';
 const known=new Set(courseUnits().map(u=>u.id));
 return !input.title.trim()||!input.channel.trim()||isBlockedChannel(input.channel)||!Number.isInteger(input.duration)||input.duration<1||input.duration>86400||!input.unitIds.length||input.unitIds.some(id=>!known.has(id))?'fields':null;
}
export async function savePhonicsSong(input:{id?:string;title:string;url:string;channel:string;duration:number;unitIds:string[]}){
 const invalid=validatePhonicsSong(input);if(invalid)throw Error(invalid);
 const original=input.id?(await fetchVideoClips()).find(c=>c.id===input.id&&isPhonicsSong(c)):undefined;
 if(input.id&&!original)throw Error('invalid_song');
 await adminSaveVideoClip({id:input.id,series:'Phonics Songs & Chants',title:input.title.trim(),summary:original?.summary??'',youtube_id:songYoutubeId(input.url)!,channel:input.channel.trim(),start_sec:0,end_sec:input.duration,level:Math.min(...courseUnits().filter(u=>input.unitIds.includes(u.id)).map(u=>u.step)),tags:[PHONICS_SONG_TAG],script:original?.script??'',words:original?.words??[],pack:{...original?.pack,phonicsSong:{...original?.pack?.phonicsSong,unitIds:[...new Set(input.unitIds)]}},sort_order:original?.sort_order??0});
 window.dispatchEvent(new Event('classbank:phonics-songs-changed'));
}
