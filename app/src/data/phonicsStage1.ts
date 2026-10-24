import config from './phonics/stage1Course.json';
import { curriculumEntries, unitsForStep } from './phonicsCurriculum';
import type { PhonicsBankEntry, MaterialSlide } from '../lib/types';

export type Stage1Kind = 'cover'|'lesson'|'air'|'matchLetters'|'meet'|'introduce'|'word'|'representativeMatch'|'quiz'|'writeLetter'|'group'|'find'|'matchWords'|'firstLetters'|'sort'|'finish'|'lookWrite'|'missingIntro'|'missing'|'level'|'readIntro'|'sight'|'findA'|'scene'|'read'|'together'|'yourTurn'|'readChoose'|'complete'|'speaking'|'extraIntro';
export interface Stage1Slide {
  id: string; lesson: 1|2; optional: boolean; kind: Stage1Kind; title: string;
  wordIds: string[]; letterUnitIds?: string[]; answerIds?: string[]; phase?: 'question'|'answer'|'all';
  pairId?: string; roundId?: string; questionNumber?: number; readerWordId?: string; workbookPageIds: string[];
}
export interface Stage1Round { id: string; full: string[]; question: string[]; missing: string[] }
export interface Stage1Group { id: string; letter: string; entries: PhonicsBankEntry[]; representative: string }
export interface Stage1Page { id: string; kind: 'letters'|'sound'|'match'|'write'|'reader'|'sentences'; groupId?: string; lesson: 1|2; title: string; slideIds: string[] }
export interface Stage1Unit {
  id: string; number?: number; groups: Stage1Group[]; wordIds: string[]; slides: Stage1Slide[]; pages: Stage1Page[];
  rounds: Stage1Round[]; reader: typeof config.unit1.reader | null;
}
const rotate = <T,>(a:T[], n=1) => [...a.slice(n), ...a.slice(0,n)];
export const stage1Entry = (unit:Stage1Unit, wordId:string) => unit.groups.flatMap(g=>g.entries).find(e=>e.wordId===wordId)!;
export const stage1Sentence = (unit:Stage1Unit, wordId:string) => unit.reader?.pattern.replace('{word}', stage1Entry(unit,wordId).word) ?? '';

/** All spelling, target positions and media are resolved from the existing canonical bank. */
export function buildStage1Course(bank:PhonicsBankEntry[]=curriculumEntries(false)): Stage1Unit[] {
  const sources=unitsForStep(1);
  const make=(id:string,sourceIds:string[],number?:number):Stage1Unit=>{
    const groups=sourceIds.map(sourceId=>{
      const source=sources.find(s=>s.id===sourceId)!;
      const entries=source.entries.map(e=>bank.find(b=>b.id===e.id)??e);
      const representative=(config.unit1.representatives as Record<string,string>)[sourceId]??entries[0].wordId!;
      return {id:sourceId,letter:source.name,entries,representative};
    });
    const unit:Stage1Unit={id,number,groups,wordIds:groups.flatMap(g=>g.entries.map(e=>e.wordId!)),slides:[],pages:[],rounds:[],reader:id===config.unit1.id?config.unit1.reader:null};
    fillCourse(unit);return unit;
  };
  return [make(config.unit1.id,config.unit1.sourceUnitIds,1),...sources.filter(s=>!config.unit1.sourceUnitIds.includes(s.id)).map(s=>make('stage1-'+s.id,[s.id]))];
}

function fillCourse(u:Stage1Unit) {
  const letters=u.groups.map(g=>g.id), reps=u.groups.map(g=>g.representative), all=u.wordIds;
  const page=(key:string,kind:Stage1Page['kind'],lesson:1|2,title:string,groupId?:string)=>{const p={id:u.id+':page:'+key,kind,lesson,title,groupId,slideIds:[]};u.pages.push(p);return p.id;};
  const pLetters=page('letters','letters',1,'Letters: '+u.groups.map(g=>g.letter+g.letter.toLowerCase()).join(' '));
  const initial=u.groups.every(g=>g.entries.every(e=>e.targets?.[0]===0));
  const pSound=page('sounds','sound',1,initial?'Listen to the First Sound':'Listen for the Target Sound');
  const pMatch=page('match','match',1,'Read and Match');
  const pWrite=Object.fromEntries(u.groups.map(g=>[g.id,page('write-'+g.id,'write',2,'Look and Write: '+g.letter+g.letter.toLowerCase(),g.id)]));
  const pReader=u.reader?page('reader','reader',2,'Mini Reader: I See'):null;
  const pSentences=u.reader?page('sentences','sentences',2,'Read, Check and Write'):null;
  const add=(key:string,kind:Stage1Kind,title:string,lesson:1|2,words:string[]=[],pages:string[]=[],extra:Partial<Stage1Slide>={})=>{
    const s:Stage1Slide={id:u.id+':slide:'+key,kind,title,lesson,wordIds:words,optional:false,workbookPageIds:pages,...extra};
    u.slides.push(s);for(const p of pages)u.pages.find(x=>x.id===p)?.slideIds.push(s.id);return s;
  };
  const pair=(key:string,kind:Stage1Kind,title:string,lesson:1|2,words:string[],answerIds:string[],pages:string[]=[],extra:Partial<Stage1Slide>={})=>{
    for(const phase of ['question','answer'] as const)add(key+'-'+phase,kind,title,lesson,words,pages,{phase,pairId:u.id+':pair:'+key,answerIds,...extra});
  };
  add('cover','cover',u.number?'UNIT '+u.number:u.groups[0].letter+u.groups[0].letter.toLowerCase(),1,reps,[pLetters]);
  add('lesson1','lesson','Letters and Sounds',1,[],[pLetters]);
  add('air','air','Air Tracing',1,[],[pLetters],{letterUnitIds:letters});
  add('match-letters','matchLetters','Match the Letters',1,[],[pLetters],{letterUnitIds:letters});
  for(const g of u.groups){
    add('meet-'+g.id,'meet','Meet '+g.letter+g.letter.toLowerCase(),1,[],[pLetters],{letterUnitIds:[g.id]});
    add('introduce-'+g.id,'introduce','Listen and Say',1,[g.representative],[pSound],{letterUnitIds:[g.id]});
    add('say-'+g.id,'word','Look and Say',1,[g.representative],[pMatch]);
  }
  add('representative-match','representativeMatch','Match the Letters and Pictures',1,[...reps].reverse(),[pMatch],{letterUnitIds:letters});
  for(const [i,w] of reps.entries())pair('guess-'+w,'quiz','What is it?',1,[w],[w],[pMatch],{questionNumber:i+1});
  for(const g of u.groups)add('write-letter-'+g.id,'writeLetter','Write '+g.letter+g.letter.toLowerCase(),1,[],[pLetters],{letterUnitIds:[g.id]});
  for(const g of u.groups){
    add('expand-meet-'+g.id,'meet','Meet '+g.letter+g.letter.toLowerCase(),1,[],[pMatch],{letterUnitIds:[g.id]});
    add('expand-'+g.id,'group','Look and Say',1,g.entries.map(e=>e.wordId!),[pMatch],{letterUnitIds:[g.id]});
  }
  pair('listen-find','find','Listen and Find',1,reps,[reps[Math.min(1,reps.length-1)]],[pSound]);
  const listenWords=u.groups.map((g,i)=>g.entries[i===0?1:i===2?2:0]?.wordId??g.representative);
  pair('listen-match','matchWords','Listen and Match',1,listenWords,listenWords,[pMatch]);
  pair('listen-write','firstLetters','Listen and Write',1,listenWords,listenWords,[pSound]);
  if(u.groups.length>1)pair('sort','sort','Sound Sorting',1,[u.groups[0].entries[2].wordId!,u.groups[1].entries[2].wordId!,u.groups[2].representative],[],[pSound]);
  add('finish1','finish','Lesson 1 Complete',1,reps,[pLetters,pSound,pMatch]);
  add('lesson2','lesson','Review, Write and Read',2);
  for(const g of u.groups)add('review-'+g.id,'group','Quick Review',2,g.entries.map(e=>e.wordId!),[pWrite[g.id]],{letterUnitIds:[g.id]});
  for(const g of u.groups)add('look-write-'+g.id,'lookWrite','Look and Write: '+g.letter+g.letter.toLowerCase(),2,g.entries.map(e=>e.wordId!),[pWrite[g.id]],{letterUnitIds:[g.id]});
  const quizWords=u.groups.map((g,i)=>g.entries[i===0?1:i===1?1:2]?.wordId??g.representative);
  for(const [i,w] of quizWords.entries())pair('shadow-'+w,'quiz','What is it?',2,[w],[w],[pWrite[u.groups[i].id]],{questionNumber:i+1});
  const addRound=(key:string,full:string[],question:string[],missing:string[],n:number,optional=false)=>{
    const round={id:u.id+':round:'+key,full,question,missing};u.rounds.push(round);
    for(const phase of ['all','question','answer'] as const)add(key+'-'+phase,'missing','What is missing?',2,phase==='all'?full:question,[],{phase,roundId:round.id,answerIds:missing,questionNumber:n,optional});
  };
  add('missing-intro','missingIntro','What is missing?',2);
  addRound('missing-1',all,all,[u.groups.at(-1)!.representative],1);
  if(u.groups.length>1){
    const second=rotate(all,5);addRound('missing-2',second,second,[all[0]],2);
    add('missing-level','level','Level Up!',2);
    addRound('missing-3',rotate(all,2),rotate(all,7),[quizWords[0],quizWords.at(-1)!],3);
  }
  if(u.reader&&pReader&&pSentences){
    const rw=u.reader.wordIds;
    add('read-intro','readIntro',"Let's Read!",2,rw,[pReader]);
    add('sight-a','sight','Sight Word: a',2,rw.slice(0,3),[pReader]);
    pair('find-a','findA','Find a',2,rw.slice(0,3),[],[pReader]);
    add('scene','scene','I See',2,rw,[pReader]);
    for(const w of rw)add('read-'+w,'read','Read with Me',2,rw,[pReader],{readerWordId:w});
    add('together','together','Read Together',2,rw,[pReader]);
    add('your-turn','yourTurn','Your Turn',2,rw,[pSentences]);
    pair('read-choose','readChoose','Read and Choose',2,[rw[0],rw[2],rw[3]],[rw[2]],[pSentences],{readerWordId:rw[2]});
    pair('complete','complete','Look and Complete',2,[rw[0]],[rw[0]],[pSentences]);
    add('finish2','speaking','I Can Say It!',2,[u.groups[1].representative,u.groups[1].entries[2].wordId!,u.groups[2].representative],[pSentences]);
    add('extra-intro','extraIntro','Extra Practice',2,[],[],{optional:true});
    const extraWords=[u.groups[1].entries[2].wordId!,u.groups[0].entries[2].wordId!,...reps.slice(0,2),u.groups[2].entries[0].wordId!,reps[2]];
    for(const [i,w] of extraWords.entries())pair('extra-guess-'+w,'quiz','What is it?',2,[w],[w],[],{optional:true,questionNumber:i+1});
    add('extra-memory','missingIntro','Extra Memory Game',2,[],[],{optional:true});
    addRound('extra-missing-1',rotate(all,3),rotate(all,5),[u.groups[1].representative],1,true);
    addRound('extra-missing-2',rotate(all,1),rotate(all,2),[u.groups[0].entries[2].wordId!,u.groups[2].entries[0].wordId!],2,true);
  }else{
    add('finish2','finish','I Can Say It!',2,all,Object.values(pWrite));
    add('extra-intro','extraIntro','Extra Practice',2,[],[],{optional:true});
    for(const [i,w] of all.entries())pair('extra-guess-'+w,'quiz','What is it?',2,[w],[w],[],{optional:true,questionNumber:i+1});
  }
}

/** Stable lesson-runner material references; no duplicate word snapshots or new slide system. */
export function stage1LessonBlocks(unitId:string):MaterialSlide[] {
  const blocks:MaterialSlide[]=[1,2].map(lesson=>({id:crypto.randomUUID(),kind:'material',materialId:'phonicsstage1',phonicsStage1:{unitId,view:'slides',lesson:lesson as 1|2}}));
  blocks.push({id:crypto.randomUUID(),kind:'material',materialId:'phonicsstage1',phonicsStage1:{unitId,view:'workbook',lesson:1}});return blocks;
}
