import type {VideoClip} from './videoClips';
import {parseShadowText,shadowSpeakers} from './shadowLines';
export type ClipActivity='words'|'shadow'|'questions'|'cloze'|'drill'|'roles'|'bingo';
export function clipActivities(clip:VideoClip):ClipActivity[]{
 const lines=parseShadowText(clip.script);const out:ClipActivity[]=[];
 if(clip.pack?.words?.length)out.push('words');if(lines.length)out.push('shadow');if(clip.pack?.questions?.length)out.push('questions');
 if(lines.length&&clip.words.length)out.push('cloze');if(clip.pack?.grammar?.drills?.length)out.push('drill');if(shadowSpeakers(lines).length>1)out.push('roles');if((clip.pack?.bingo?.length??0)>=9)out.push('bingo');return out;
}
export const clipTopics=(clips:VideoClip[])=>[...new Set(clips.flatMap(c=>c.tags).filter(t=>t&&!t.startsWith('classbank:')))].sort();
/** Exact script & metadata are indexed; no AI-inferred levels or teaching times. */
export const clipSearchText=(c:VideoClip)=>[c.series,c.title,c.summary,...c.words,...c.tags,c.script,...(c.pack?.words??[]).flatMap(w=>[w.word,w.meaning,w.example]),...(c.pack?.questions??[]).map(q=>q.q)].join(' ').toLowerCase();
export function estimateClipMinutes(c:VideoClip,selected:ClipActivity[]=['words','questions']){const base=(Number(c.end_sec)-Number(c.start_sec))/60*2+(selected.includes('words')?(c.pack?.words?.length??c.words.length)*.5:0)+(selected.includes('questions')?(c.pack?.questions?.length??0):0);const min=Math.max(1,Math.ceil(base));return {min,max:Math.ceil(min*1.5)};}
