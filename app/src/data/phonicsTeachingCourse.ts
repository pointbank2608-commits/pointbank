import {courseUnits} from './phonicsLessons';
import {curriculumEntries} from './phonicsCurriculum';
import type {PhonicsBankEntry} from '../lib/types';

/** The course tab is public; draft readers and legacy review routes stay in development. */
export const PHONICS_TEACHING_VISIBLE=true;
export const PHONICS_TEACHING_PREVIEW=import.meta.env.DEV;
export interface TeachingUnit {id:string;step:number;title:string;sounds:string;entryIds:string[];entries:PhonicsBankEntry[];stage1Id?:string;}
/** Compatibility adapter: saved ABC and CVC references keep their historic IDs. */
export function teachingUnits(bank=curriculumEntries(false)):TeachingUnit[]{return courseUnits(bank).map(u=>({
 id:u.id==='course-1-1'?'stage1-abc':u.id==='course-2-1'?'teaching-cvc-unit-1':u.id,
 step:u.step,title:`Unit ${u.number} · ${u.groups.map(g=>g.label).join(' · ')}`,sounds:u.groups.map(g=>g.label).join(' · '),
 entries:u.entries,entryIds:u.entries.map(e=>e.id),stage1Id:u.id==='course-1-1'?'stage1-abc':undefined,
}));}
