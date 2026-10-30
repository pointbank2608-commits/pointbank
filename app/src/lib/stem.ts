import type {CurriculumLesson,LessonSlide,WordListItem} from './types';
import {STEM_BLOCKS,type StemFrame,type StemLesson,type StemMeta} from './stemTypes';
import {effectiveSlides} from './lessonSlides';
import {supabase} from './supabase';
export function stemPlaylist(lesson:StemLesson):LessonSlide[]{
 return lesson.frames.map(frame=>{
  if(frame.mode==='existing'&&frame.existing)return {...structuredClone(frame.existing),id:frame.id};
  const meta=structuredClone(frame.metaOverride||lesson.meta);
  if(frame.mode==='video')return {id:frame.id,kind:'video',title:frame.title,videoUrl:frame.videoUrl!,stemFrame:structuredClone(frame),stemMeta:meta};
  if(frame.mode==='game')return {id:frame.id,kind:'game',gameType:frame.gameType!,templateId:frame.templateId,stemFrame:structuredClone(frame),stemMeta:meta};
  return {id:frame.id,kind:'stem',frame:structuredClone(frame),stemMeta:meta};
 });
}
export function stemFromLesson(row:CurriculumLesson):StemLesson|null{
 const slides=effectiveSlides(row),first=slides.find(s=>(s.kind==='stem'||s.kind==='game'||s.kind==='video')&&s.stemMeta?.schema===1);
 if(!first||!(first.kind==='stem'||first.kind==='game'||first.kind==='video')||!first.stemMeta)return null;
 const source=first.stemMeta;
 const frames:StemFrame[]=slides.map(s=>{
  const frame:StemFrame=s.kind==='stem'?{...s.frame,id:s.id}:s.kind==='video'?{id:s.id,block:'introduction',layout:'picture-question',mode:'video',title:s.title||'Video',lines:[],...s.stemFrame,videoUrl:s.videoUrl}:s.kind==='game'?{id:s.id,block:'review',layout:'game-instructions',mode:'game',title:s.gameType,lines:[],...s.stemFrame,gameType:s.gameType,templateId:s.templateId}:{id:s.id,block:'introduction',layout:'picture-question',mode:'existing',title:s.kind,lines:[],existing:s};
  if((s.kind==='stem'||s.kind==='game'||s.kind==='video')&&s.stemMeta&&s.stemMeta.sourceId!==source.sourceId)frame.metaOverride=structuredClone(s.stemMeta);
  return {...frame,id:s.id};
 });
 return {meta:{...structuredClone(source),title:row.name,ownerId:row.created_by,visibility:'academy'},frames};
}
export function copyStem(source:StemLesson,owner:string):StemLesson{
 const out=structuredClone(source);out.meta={...out.meta,sourceId:crypto.randomUUID(),ownerId:owner,visibility:'academy',published:false};out.frames=out.frames.map(f=>({...f,id:crypto.randomUUID()}));return out;
}
export function emptyStem(owner:string):StemLesson{
 const report={title:'My Experiment',question:'What will happen?',prediction:'I predict ____________________.',result:'I observed ____________________.',steps:[],questions:[],wordBank:[],sentences:['I learned ____________________.'],showWordBank:true};
 const meta:StemMeta={schema:1,sourceId:crypto.randomUUID(),title:'',description:'',grade:'Elementary Grade 3',level:'Elementary English',duration:50,language:'en',category:'Science',objectives:[],materials:[],safety:[],vocabulary:[],report,ownerId:owner,visibility:'academy',published:false};
 return {meta,frames:STEM_BLOCKS.map(block=>({id:crypto.randomUUID(),block,layout:block==='introduction'?'cover':block==='report'?'report-instructions':'science-concept',title:({introduction:'Introduction',concept:'Science Concept',vocabulary:'Vocabulary',prediction:'Prediction',experiment:'Experiment',review:'Review & Challenge',report:'Science Report',wrapup:'Wrap-up'})[block],mode:block==='report'?'report':'text',lines:[]}))};
}
export function validateStem(lesson:StemLesson):string[]{
 const errors:string[]=[];
 if(!lesson.meta.title.trim()||!lesson.frames.length||lesson.meta.duration<1||lesson.meta.duration>300)errors.push('basics');
 if(!Number.isFinite(lesson.meta.duration))errors.push('basics');
 if(lesson.meta.vocabulary.some(w=>!w.word.trim()))errors.push('words');
 if(lesson.frames.some(f=>!f.title.trim()||!STEM_BLOCKS.includes(f.block)||f.mode==='image'&&!f.imageUrl||f.mode==='text'&&(!f.lines.some(l=>l.trim())||f.illustrations?.some(i=>!i.imageUrl))))errors.push('content');
 if(lesson.frames.some(f=>f.mode==='missing'&&(f.metaOverride||lesson.meta).vocabulary.length<2||f.mode==='vocabulary'&&!(f.metaOverride||lesson.meta).vocabulary.length))errors.push('words');
 if(lesson.frames.some(f=>f.mode==='game'&&(!f.gameType||!f.templateId)))errors.push('game');
 if(lesson.frames.some(f=>f.mode==='video'&&!youtubeUrl(f.videoUrl||'')))errors.push('video');
 for(const frame of lesson.frames.filter(f=>f.mode==='report')){
  const r=frame.report||(frame.metaOverride||lesson.meta).report;
  if(!r.title.trim()||!r.question.trim()||!r.prediction.trim()||!r.result.trim()||r.steps.length>4||r.questions.length>4||r.sentences.length>2||r.questions.some(q=>!q.prompt||q.options.length<2||q.options.some(o=>!o.trim())||!q.options.includes(q.answer))||r.steps.some(s=>!s.text||!s.imageUrl))errors.push('report');
 }
 return [...new Set(errors)];
}
import {extractYoutubeId} from './youtube';
export const youtubeUrl=(url:string)=>{try{const u=new URL(url);return ['www.youtube.com','youtube.com','youtu.be','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname)&&!!extractYoutubeId(url);}catch{return false;}};
export const stemWordItems=(lesson:StemLesson):WordListItem[]=>lesson.meta.vocabulary.map(w=>({id:w.id,word:w.word,meaning:w.meaning,image_url:w.imageUrl,example:w.example,category:w.category||'STEM'}));
/** Compare-and-swap: never replace another teacher's more recent lesson edit. Same existing RLS. */
export async function saveStemPlaylist(row:CurriculumLesson,playlist:LessonSlide[],name=row.name){
 const {data,error}=await supabase.from('curriculum_lessons').update({playlist,name,updated_at:new Date().toISOString()}).eq('id',row.id).eq('academy_id',row.academy_id).eq('updated_at',row.updated_at).select('id');
 if(error||!data?.length)throw new Error(error?.message||'lesson_changed_retry');
}
export const stemReportOrder=(n:number)=>n===4?[2,0,3,1]:Array.from({length:n},(_,i)=>(i+1)%n);
