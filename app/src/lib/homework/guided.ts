import type { CurriculumLesson, FullCardItem, GameTemplate, WordList } from '../types';
import { wordListToCards } from '../gameFromWords';
import { effectiveSlides } from '../lessonSlides';
import {extractYoutubeId} from '../youtube';
import {parseShadowText} from '../shadowLines';
import { lessonCandidates, newBlock, validateItems } from './blocks';
import { blankQ, GEN_VERSION, hintQ, lettersQ, listenQ, pictureQ, reverseQ, SKILL, meaningQ, sentenceOrderQ, shuffleWith, spellQ } from './build';
import { isMeaning } from './quality';
import type { HwItemDraft, HwQuestion } from './types';

export type PracticeGoal = 'review' | 'memory' | 'speaking';
export const CHECK_TYPES = {
 choice: ['그림이나 뜻을 보고 단어 고르기','Choose the word from a picture or meaning'],
 listen: ['음성을 듣고 단어 고르기','Listen and choose the word'],
 lettersMissing: ['빠진 알파벳 채우기','Fill in missing letters'],
 lettersOrder: ['알파벳을 배열해 단어 만들기','Arrange letters to make a word'],
 spelling: ['뜻을 보고 철자 직접 쓰기','Spell the word from its meaning'],
 sentenceOrder: ['단어를 배열해 문장 만들기','Arrange words into a sentence'],
 sentenceBlank: ['문장 빈칸에 맞는 단어 고르기','Choose a word for the sentence gap'],
 speak: ['단어·문장 혼자 말하기','Record the word or sentence from a cue'],
} as const;
export type CheckType = keyof typeof CHECK_TYPES;
export type FinalCheck = { types: CheckType[]; count: 5 | 10 | 15 | 0 };

export const GUIDED_FINAL = 'guided-final:';

export function suggestedCheck(goals: PracticeGoal[], contents: LearningContent[]): CheckType[] {
 const words=contents.some(c=>c.kind==='word'), sentences=contents.some(c=>c.kind==='sentence');
 const types:CheckType[]=[];
 if(words&&goals.includes('memory'))types.push('spelling');
 if(sentences&&goals.some(goal=>goal!=='speaking'))types.push('sentenceOrder');
 if(goals.includes('speaking'))types.push('speak');
 if(!types.length&&words)types.push('choice');
 return types;
}
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
export function buildGuidedPractice(contents:LearningContent[],videos:LearningVideo[],goal:PracticeGoal | PracticeGoal[],en=false,final:FinalCheck|null=null){
 const goals=Array.isArray(goal)?goal:[goal];
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
  recall.push(goals.includes('memory')?(choice||order||listeningWrite(card,en)):(order||choice||listeningWrite(card,en)));
  writing.push(kind==='word'&&card.meaning&&sameWordMeanings.size===1?(spellQ(card)||listeningWrite(card,en)):listeningWrite(card,en));
 }
 const pack=(qs:HwQuestion[],title:string)=>{for(let i=0;i<qs.length;i+=100){const it=newBlock('recall');it.title=title;it.content.questions=qs.slice(i,i+100);items.push(it);}};
 if(recall.length)pack(recall,en?'Check what you remember':'기억 확인하기');
 if(goals.includes('memory')&&writing.length)pack(writing,en?'Write from memory':'가리고 써 보기');
 if(goals.includes('speaking'))for(let i=0;i<contents.length;i+=5){const group=contents.slice(i,i+5),it=newBlock('speak');it.title=en?'Read, hide and speak':'읽고 가리고 말하기';Object.assign(it.config.block!,{text:group.map(c=>c.card.word).join('\n'),translation:group.map(c=>c.card.meaning).join('\n'),stages:['model','hidden'],hiddenWords:group.flatMap(c=>c.card.word.trim().split(/\s+/)).map((_,index)=>index),repeats:1});items.push(it);}
 items.push(...videos.map(v=>structuredClone(v.item)));
 for(const item of items)if(item.config.block)item.config.block.guidedPractice=true;
 let finalQuestions=0;
 if(final){
  const candidates=final.types.map(type=>({type,items:shuffleWith(contents.flatMap<{id:string;card:FullCardItem;question:HwQuestion|null}>(({card,kind,id})=>{
   const word=kind==='word';
   const uniqueMeaning=isMeaning(card.meaning)&&!pool.some(other=>normalize(other.meaning)===normalize(card.meaning)&&normalize(other.word)!==normalize(card.word));
   const uniqueImage=!!card.imageUrl&&!pool.some(other=>other.imageUrl===card.imageUrl&&normalize(other.word)!==normalize(card.word));
   let question:HwQuestion|null=null;
   switch(type){
    case 'choice': if(word)question=(uniqueImage?pictureQ(card,pool,Math.random):null)??(uniqueMeaning?reverseQ(card,pool,Math.random):null);break;
    case 'listen': if(word)question=listenQ(card,pool,Math.random);break;
    case 'lettersMissing': if(word&&uniqueMeaning)question=hintQ(card);break;
    case 'lettersOrder': if(word&&uniqueMeaning)question=lettersQ(card,Math.random);break;
    case 'spelling': if(word&&uniqueMeaning)question=spellQ(card);break;
    case 'sentenceOrder': if(!word&&uniqueMeaning)question=sentenceOrderQ({...card,example:card.word},Math.random);break;
    case 'sentenceBlank': if(word)question=blankQ(card,pool,Math.random);break;
    case 'speak': return uniqueMeaning||uniqueImage?[{id,card:{...card,meaning:uniqueMeaning?card.meaning:"",imageUrl:uniqueImage?card.imageUrl:null},question:null}]:[];
   }
   if(!question)return [];
   if(type==='lettersMissing'||type==='spelling')delete question.speak;
   return [{id,card,question}];
  }),Math.random)}));
  for(const {type,items:available} of candidates)if(!available.length)
   issues.push(en?'No suitable material for '+CHECK_TYPES[type][1]+'.':CHECK_TYPES[type][0]+'에 쓸 수 있는 자료가 없어요.');
  const capacity=candidates.reduce((sum,c)=>sum+c.items.length,0);
  const target=final.count||capacity;
  if(!candidates.length||target<candidates.length||target>capacity)
   issues.push(en?'Adjust the check types or total count to fit the available material.':'자료에 맞게 확인 유형이나 총 문제 수를 조정해 주세요.');
  if(candidates.length&&target>=candidates.length&&target<=capacity&&candidates.every(c=>c.items.length)){
   const picks=candidates.map(()=>[] as (typeof candidates)[number]['items']);
   const seen=new Set<string>();
   while(finalQuestions<target){
    for(const [index,candidate] of candidates.entries()){
     if(finalQuestions===target)break;
     if(!candidate.items.length)continue;
     const fresh=candidate.items.findIndex(item=>!seen.has(item.id));
     const [item]=candidate.items.splice(fresh<0?0:fresh,1);
     picks[index].push(item);seen.add(item.id);finalQuestions++;
    }
   }
   for(const [index,{type}] of candidates.entries()){
    const title=(en?'Final check · ':'마무리 확인 · ')+CHECK_TYPES[type][en?1:0];
    const qs=picks[index].flatMap(pick=>pick.question?[pick.question]:[]);
    const start=items.length;
    if(type==='speak'){
     for(const {card} of picks[index]){
      const item=newBlock('speak');item.title=title;
      Object.assign(item.config.block!,{text:en?'Record your answer.':'답을 말하고 녹음하세요.',translation:card.meaning,imageUrl:card.imageUrl||'',stages:['picture']});
      items.push(item);
     }
    }else pack(qs,title);
    for(const item of items.slice(start))item.config.block!.method=GUIDED_FINAL+type;
   }
  }
 }
 issues.push(...validateItems(items));
 return {items,issues:[...new Set(issues)],finalQuestions,questions:items.reduce((n,it)=>n+it.content.questions.length,0),recordings:items.filter(it=>it.config.block?.completion==='recording').length,contents:contents.length};
}
