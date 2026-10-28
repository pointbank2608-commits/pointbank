import {lessonSlides, type CourseUnit, type CourseSlide} from './phonicsLessons';
import type {PhonicsBankEntry} from '../lib/types';
export type BookKind='letters'|'intro'|'matchRule'|'more'|'choose'|'match'|'review'|'write'|'complete'|'sort'|'sight'|'reader';
export interface BookPage {id:string;kind:BookKind;title:string;entries:PhonicsBankEntry[];slides:string[];questions?:CourseSlide[];pictureOrder?:string[][];}
export const COURSE_TONES=['','#e5f3ff','#fbe0e9','#dceee0','#ece5f8','#fff1bc'];
const chunks=<T,>(xs:T[],n:number)=>Array.from({length:Math.ceil(xs.length/n)},(_,i)=>xs.slice(i*n,i*n+n));
/** Stable non-identity permutations. Each neighboring Match block uses a different order. */
export function matchOrder<T>(xs:T[],group:number):T[]{if(xs.length<2)return xs;const shift=xs.length===3?(group%3===0?1:group%3===1?2:1):1;const rotated=[...xs.slice(shift),...xs.slice(0,shift)];return xs.length===3&&group%3===2?[xs[1],xs[0],xs[2]]:rotated;}
export function workbookTargets(u:CourseUnit,e:PhonicsBankEntry):number[]{
 if(u.step===2){const g=u.groups.find(g=>g.entries.some(x=>x.id===e.id))!;const family=g.label.replace(/^-/,'');if(e.word.endsWith(family))return Array.from({length:family.length},(_,i)=>e.word.length-family.length+i);}
 return e.targets??[];
}
/** Use the live slide sequence and IDs, never a second word list. Reveal phases are not new tasks. */
export function readyClassPages(u:CourseUnit):BookPage[]{
 const slides=lessonSlides(u).filter(s=>!s.draft&&s.lesson!=='extra');const pages:BookPage[]=[];
 const byIds=(ids:string[])=>ids.map(id=>[...u.entries,...u.reading.entries].find(e=>e.id===id)!).filter(Boolean);
 const add=(kind:BookKind,title:string,entries:PhonicsBankEntry[],source:CourseSlide[],extra:Partial<BookPage>={})=>pages.push({id:`${u.id}:book:${kind}:${pages.filter(p=>p.kind===kind).length+1}`,kind,title,entries,slides:source.map(s=>s.id),...extra});
 const of=(...kinds:CourseSlide['kind'][])=>slides.filter(s=>kinds.includes(s.kind)&&s.phase===0);
 const reps=u.groups.map(g=>g.entries[0]);
 if(u.step===1)for(const gs of chunks(u.groups,3))add('letters','Meet the Letters',gs.map(g=>g.entries[0]),of('letter','letterMatch','writeLetter').filter(s=>s.groupIds.some(id=>gs.some(g=>g.id===id))));
 for(const batch of chunks(reps,3))add('intro','Listen and Say',batch,of('introduce','builder','word').filter(s=>s.entryIds.some(id=>batch.some(e=>e.id===id))));
 for(const batch of chunks(reps,3))add('matchRule','Match and Remember',batch,of('match','memory').filter(s=>s.entryIds.some(id=>batch.some(e=>e.id===id))),{pictureOrder:[matchOrder(batch,0).map(e=>e.id)]});
 for(const batch of chunks(u.entries,9))add('more','More Words',batch,of('group').filter(s=>s.lesson===1&&s.entryIds.some(id=>batch.some(e=>e.id===id))));
 const questions=of('choose','odd').filter(s=>s.entryIds.length&&s.answerIds.length);
 for(const qs of chunks(questions,4))add('choose','Listen and Choose',byIds([...new Set(qs.flatMap(s=>s.entryIds))]),qs,{questions:qs});
 let block=0;for(const batches of chunks(u.groups.flatMap(g=>chunks(g.entries,3)),3)){const entries=batches.flat();add('match','Read and Match',entries,of('match').filter(s=>s.entryIds.some(id=>entries.some(e=>e.id===id))),{pictureOrder:batches.map(es=>matchOrder(es,block++).map(e=>e.id))});}
 const memory=byIds([...new Set(of('memory','shadow').filter(s=>s.lesson===2).flatMap(s=>s.entryIds))]);
 for(const batch of chunks(memory.length?memory:u.entries,6))add('review','Review and Remember',batch,of('memory','group','shadow').filter(s=>s.lesson===2&&s.entryIds.some(id=>batch.some(e=>e.id===id))));
 for(const batch of chunks(u.entries,9))add('write','Look and Write',batch,of('write').filter(s=>s.entryIds.some(id=>batch.some(e=>e.id===id))));
 // The actual target spelling (CVC whole family; split magic e; unit-specific blend) stays annotated.
 for(const batch of chunks(u.entries,9))add('complete','Complete the Words',batch,of('complete').filter(s=>s.entryIds.some(id=>batch.some(e=>e.id===id))));
 if(of('sort').length)for(const groups of chunks(u.groups,3)){const entries=groups.flatMap(g=>g.entries);for(const batch of chunks(entries,12))add('sort','Read and Sort',batch,of('sort').filter(s=>s.entryIds.some(id=>batch.some(e=>e.id===id))));}
 if(u.reading.status==='approved'){
  if(of('sight','findSight').length)add('sight','Sight Words and Read',u.reading.entries,of('sight','findSight'));
  for(const batch of chunks(u.reading.entries,4))add('reader','Read and Choose',batch,of('read','readTogether','readChoose').filter(s=>s.entryIds.some(id=>batch.some(e=>e.id===id))));
 }
 return pages;
}
