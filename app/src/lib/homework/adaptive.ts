import { supabase } from '../supabase';
import type { PathCard } from '../learningPaths';
import type { LearningSource } from './guided';

export type HomeworkPortion = 4 | 8;
export interface AdaptiveHomeworkInput {
  p_request: string; p_class: string; p_students: string[]; p_title: string; p_cards: PathCard[];
  p_practice: 'letters'|'recall'; p_portion: HomeworkPortion; p_due: string|null;
  p_source_kind: 'list'|'lesson'|'manual'; p_source_id: string|null;
}
export interface AdaptiveHomeworkPlan {
  lesson_id: string; name: string; approved_at: string; initial_due_at: string|null; portion: number;
  goal: 'meaning_to_spelling'; rule_version: string; practice: string; words: number;
  assigned: number; first_completed: number; delayed_answered: number; delayed_correct: number;
  students: {name:string;assignment_id:string;started:boolean;first_completed:boolean;finished:boolean;waiting:boolean;due_at:string|null;phase:'not_started'|'learning'|'review'|'finished'}[];
}
export class AdaptiveHomeworkError extends Error {
  kind: 'missing'|'rejected'|'uncertain';
  constructor(code?:string,message='') {
    super(message);this.kind=['PGRST202','42883','42P01'].includes(code??'')?'missing':code==='P0001'||code==='42501'?'rejected':'uncertain';
  }
}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
  const {data,error}=await supabase.rpc(name,args);
  if(error)throw new AdaptiveHomeworkError(error.code,error.message);
  return data as T;
}
export const assignAdaptiveHomework=(input:AdaptiveHomeworkInput)=>rpc<{lesson_id:string;duplicate:boolean}>('learning_homework_assign',{...input});
export const adaptiveHomeworkSummary=(classId:string)=>rpc<{plans:AdaptiveHomeworkPlan[];limit:number}>('learning_homework_summary',{p_class:classId});
export interface HomeworkResearch {
  rule_version:string;days:number;plans:number;assignments:number;students:number;first_completed:number;finished:number;
  rounds:{round:number;answered:number;correct:number;due:number;missing:number;not_due:number;not_scheduled:number}[];
  observed_assignments:number;grading_links:number;protection_intact:boolean;
}
export const adaptiveHomeworkResearch=(days=30)=>rpc<HomeworkResearch>('admin_learning_homework_summary',{p_days:days});

/** Single-word recall only. Unsupported material is counted, never silently rewritten into vocabulary. */
export function adaptiveCards(source:LearningSource):{cards:PathCard[];excluded:number}{
  const cards:PathCard[]=[];let excluded=source.videos.length;
  for(const row of source.contents){
    const word=row.card.word.trim(),meaning=row.card.meaning.trim();
    if(row.kind!=='word'||!/^[A-Za-z][A-Za-z-]{0,39}$/.test(word)||!meaning||meaning.length>120){excluded++;continue;}
    const image=row.card.imageUrl;
    cards.push({word:word.toLowerCase(),meaning,imageUrl:image&&/^(\/[^/]|https:\/\/)/.test(image)?image:null,example:row.card.example?.slice(0,250)||null});
  }
  return {cards,excluded};
}
export function homeworkParts<T>(cards:readonly T[],portion:HomeworkPortion):T[][]{
  const parts:T[][]=[];for(let i=0;i<cards.length;i+=portion)parts.push(cards.slice(i,i+portion));return parts;
}
