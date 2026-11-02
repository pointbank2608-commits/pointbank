import type { CurriculumLesson, FullCardItem, GameTemplate, WordList } from '../types';
import { wordListToCards } from '../gameFromWords';
import { effectiveSlides } from '../lessonSlides';
import {extractYoutubeId} from '../youtube';
import {parseShadowText} from '../shadowLines';
import { lessonCandidates, newBlock, validateItems } from './blocks';
import { GEN_VERSION, SKILL, meaningQ, sentenceOrderQ, spellQ } from './build';
import { isMeaning } from './quality';
import type { HwItemDraft, HwQuestion } from './types';

export type PracticeGoal = 'review' | 'memory' | 'speaking';
export type LearningContent = { id:string; kind:'word'|'sentence'; card:FullCardItem; origins:string[] };
export type LearningVideo = { id:string; title:string; item:HwItemDraft };
export type LearningSource = { contents:LearningContent[]; videos:LearningVideo[]; excluded:number };
const normalize=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
export const contentKey=(kind:LearningContent['kind'],card:FullCardItem)=>JSON.stringify([kind,normalize(card.word),normalize(typeof card.meaning==='string'?card.meaning:'')]);

/** Collapse repeated teaching activities by word AND meaning, never by word alone. */
export function mergeLearningContent(rows:LearningContent[]):LearningContent[]{
 const map=new Map<string,LearningContent>();
 for(const row of rows){
  if(typeof row.card.word!=='string'||!row.card.word.trim())continue;
  const id=contentKey(row.kind,row.card),old=map.get(id);
  if(old){old.origins=[...new Set([...old.origins,...row.origins])];old.card.imageUrl ||= row.card.imageUrl;old.card.example ||= row.card.example;}
  else map.set(id,{...row,id,card:{...structuredClone(row.card),word:row.card.word.trim(),meaning:typeof row.card.meaning==='string'?row.card.meaning:''},origins:[...row.origins]});
 }
 return [...map.values()];
}
export function contentFromList(list:WordList):LearningSource{
 return {contents:mergeLearningContent(wordListToCards(list).map(card=>({id:card.id,kind:list.kind==='sentence'?'sentence':'word',card,origins:[list.name]}))),videos:[],excluded:0};
}
export function contentFromLesson(lesson:CurriculumLesson,lists:WordList[],templates:GameTemplate[]=[]):LearningSource{
 const slides=effectiveSlides(lesson),rows:LearningContent[]=[],videos:LearningVideo[]=[];let excluded=0;
 for(const option of lessonCandidates(lesson,lists)){
  const slide=slides.find(s=>s.id===option.slideId);if(!slide)continue;
  const bound=lists.find(l=>l.id===(slide.ownWordListId||lesson.word_list_id));
  const kind:LearningContent['kind']=['drill','rainbow','grammar','reading','shadow'].includes(slide.kind)||bound?.kind==='sentence'?'sentence':'word';
  const add=(card:FullCardItem,k=kind)=>rows.push({id:card.id,kind:k,card:{...card,meaning:k==='sentence'&&card.meaning===card.word?'':card.meaning},origins:[lesson.name]});
  let found=false;
  for(const item of option.items){
   const b=item.config.block;
   if(b?.type==='video'){videos.push({id:slide.id,title:('title' in slide?slide.title:undefined)||lesson.name,item:structuredClone(item)});found=true;continue;}
   if(item.content.questions.length){for(const q of item.content.questions)if(q.card){add({id:q.id,word:q.card.word,meaning:q.card.meaning,imageUrl:q.card.imageUrl||null,example:q.card.example});found=true;}}
   else if(b?.text){add({id:slide.id+':'+rows.length,word:b.text,meaning:b.translation,imageUrl:b.imageUrl||null});found=true;}
  }
  // A saved game may own its source independently of the lesson word list.
  if(slide.kind==='game'){
   const source=templates.find(t=>t.id===slide.templateId)?.config.classroomSource;
   if(source){source.cards.forEach(c=>add(c,source.kind==='sentence'?'sentence':'word'));found=true;}
  }
  if(slide.kind==='qna')for(const question of slide.questions){if(question.a?.trim()){add({id:slide.id+':q:'+rows.length,word:question.a,meaning:question.aKo||'',imageUrl:null,example:question.q},'sentence');found=true;}}
  if((slide.kind==='shadow'||slide.kind==='reading')&&slide.videoUrl&&extractYoutubeId(slide.videoUrl)){
   const lines=parseShadowText(slide.source);if(lines.length){const item=newBlock('video');Object.assign(item.config.block!,{videoUrl:slide.videoUrl,start:lines[0].start,end:lines.at(-1)!.end,source:{lessonId:lesson.id,slideId:slide.id,version:lesson.updated_at}});videos.push({id:slide.id,title:slide.title||lesson.name,item});}
  }
  if(!found)excluded++;
 }
 // STEM vocabulary already lives in the shared lesson metadata.
 for(const slide of slides){const meta=slide.kind==='stem'||slide.kind==='video'||slide.kind==='game'?slide.stemMeta:undefined;if(meta)for(const card of meta.vocabulary)rows.push({id:card.id,kind:'word',card,origins:[lesson.name]});}
 const uniqueVideos=new Map<string,LearningVideo>();for(const video of videos){const b=video.item.config.block!;const key=JSON.stringify([extractYoutubeId(b.videoUrl),b.start,b.end]);if(!uniqueVideos.has(key))uniqueVideos.set(key,video);}
 return {contents:mergeLearningContent(rows),videos:[...uniqueVideos.values()],excluded};
}
export function splitLearningContent(contents:LearningContent[],size:number):LearningContent[][]{
 if(!contents.length)return [];
 const n=Number.isFinite(size)&&size>0?Math.max(1,Math.floor(size)):contents.length;
 return Array.from({length:Math.ceil(contents.length/n)},(_,i)=>contents.slice(i*n,(i+1)*n));
}
const clean=(s:string)=>s.replace(/[|\r\n]/g,' ').trim();
function listeningWrite(card:FullCardItem,en:boolean):HwQuestion{
 return {id:crypto.randomUUID(),qtype:'text',style:'dictation',prompt:'',speak:card.word,correct:card.word,word:card.word,skill:SKILL.dictation,gen:GEN_VERSION,card:{word:card.word,meaning:card.meaning,imageUrl:card.imageUrl,example:card.example},sub:en?'Listen and type.':'듣고 써 보세요.'};
}
/** Existing student activities, grouped into a few packs instead of 1 block per word. */
export function buildGuidedPractice(contents:LearningContent[],videos:LearningVideo[],goal:PracticeGoal,en=false){
 const items:HwItemDraft[]=[],issues:string[]=[];
 if(contents.some(c=>c.card.word.length>300))issues.push(en?'An entry exceeds 300 characters. Edit it or use detailed editing.':'300자를 넘는 내용이 있습니다. 내용을 수정하거나 세부 편집을 사용해 주세요.');
 if(contents.some(c=>c.card.word.includes('/')))issues.push(en?'Split expressions containing / into separate entries; / is reserved for answer alternatives.':'‘/’가 들어간 표현은 각각 나눠 주세요. 이 기호는 정답 구분에 사용됩니다.');
 let lines:string[]=[];let length=0;
 const flush=()=>{if(!lines.length)return;const it=newBlock('study');it.title=en?'Look and listen':'보고 듣기';Object.assign(it.config.block!,{method:'flip',count:lines.length,text:lines.join('\n')});items.push(it);lines=[];length=0;};
 for(const {card}of contents){const line=[card.word,card.meaning,card.example||''].map(clean).join(' | ');if(line.length>4800){issues.push(en?'A study card is too long.':'학습 카드 내용이 너무 깁니다.');continue;}if(lines.length>=40||length+line.length+1>4800)flush();lines.push(line);length+=line.length+1;}flush();
 const pool=contents.map(c=>c.card),recall:HwQuestion[]=[],writing:HwQuestion[]=[];
 for(const {card,kind}of contents){
  const sameWordMeanings=new Set(pool.filter(p=>normalize(p.word)===normalize(card.word)).map(p=>normalize(p.meaning)));
  const choice=isMeaning(card.meaning)&&sameWordMeanings.size===1?meaningQ(card,pool,Math.random):null;
  const order=kind==='sentence'&&card.meaning.trim()?sentenceOrderQ({...card,example:card.word},Math.random):null;
  // Never leave an ambiguous multiple-choice prompt or omit an unsupported phrase.
  recall.push(goal==='memory'?(choice||order||listeningWrite(card,en)):(order||choice||listeningWrite(card,en)));
  writing.push(kind==='word'&&card.meaning&&sameWordMeanings.size===1?(spellQ(card)||listeningWrite(card,en)):listeningWrite(card,en));
 }
 const pack=(qs:HwQuestion[],title:string)=>{for(let i=0;i<qs.length;i+=100){const it=newBlock('recall');it.title=title;it.content.questions=qs.slice(i,i+100);items.push(it);}};
 if(recall.length)pack(recall,en?'Check what you remember':'기억 확인하기');
 if(goal==='memory'&&writing.length)pack(writing,en?'Write from memory':'가리고 써 보기');
 if(goal==='speaking')for(let i=0;i<contents.length;i+=5){const group=contents.slice(i,i+5),it=newBlock('speak');it.title=en?'Read, hide and speak':'읽고 가리고 말하기';Object.assign(it.config.block!,{text:group.map(c=>c.card.word).join('\n'),translation:group.map(c=>c.card.meaning).join('\n'),stages:['model','hidden'],repeats:1});items.push(it);}
 items.push(...videos.map(v=>structuredClone(v.item)));
 issues.push(...validateItems(items));
 return {items,issues:[...new Set(issues)],questions:items.reduce((n,it)=>n+it.content.questions.length,0),recordings:items.filter(it=>it.config.block?.completion==='recording').length,contents:contents.length};
}
