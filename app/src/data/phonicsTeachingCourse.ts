import { buildStage1Course } from './phonicsStage1';
import { curriculumEntries, unitById } from './phonicsCurriculum';
import type { PhonicsBankEntry } from '../lib/types';

/** Local Vite development preview only. A URL parameter cannot enable this in a production build. */
export const PHONICS_TEACHING_PREVIEW = import.meta.env.DEV;
export interface TeachingUnit {
 id:string; step:number; title:string; sounds:string; entryIds:string[]; entries:PhonicsBankEntry[];
 stage1Id?:string;
}
export function teachingUnits(bank=curriculumEntries(false)):TeachingUnit[] {
 const alphabet=buildStage1Course(bank).map(unit=>({
  id:unit.id,step:1,title:unit.number?'Unit 1 · Aa Bb Cc':unit.groups.map(g=>g.letter+g.letter.toLowerCase()).join(' '),
  sounds:unit.groups.map(g=>g.letter+g.letter.toLowerCase()).join(' · '),
  entryIds:unit.groups.flatMap(g=>g.entries.map(e=>e.id)),entries:unit.groups.flatMap(g=>g.entries),stage1Id:unit.id,
 }));
 // This teaching grouping is independent of the unchanged cvc-ad/ag/am print units.
 const sources=['cvc-ad','cvc-ag','cvc-am'].map(id=>unitById(id)!);
 const entries=sources.flatMap(unit=>unit.entries.map(e=>bank.find(row=>row.id===e.id)??e));
 return [...alphabet,{id:'teaching-cvc-unit-1',step:2,title:'Unit 1 · -ad · -ag · -am',sounds:'-ad · -ag · -am',entryIds:entries.map(e=>e.id),entries}];
}
