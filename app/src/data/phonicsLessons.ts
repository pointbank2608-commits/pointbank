import plan from './phonics/teachingPlan.json';
import readerDrafts from './phonics/readerDrafts.json';
import contextReview from './phonics/teachingReview.json';
import { PHONICS_RULES, curriculumEntries, unitsForStep } from './phonicsCurriculum';
import type { PhonicsBankEntry } from '../lib/types';
import {buildStage1Course} from './phonicsStage1';

export interface LessonGroup { id:string; ruleId:string; label:string; sound:string; entries:PhonicsBankEntry[] }
export interface ReaderContent {status:'approved'|'draft';newSightWords:string[];reviewSightWords:string[];entries:PhonicsBankEntry[];sentences:string[];otherIds:string[];}
export interface CourseUnit { id:string;step:number;number:number;status:string;groups:LessonGroup[];entries:PhonicsBankEntry[];reader:string|null;reading:ReaderContent }
export type CourseKind='cover'|'lesson'|'transition'|'sounds'|'letter'|'letterMatch'|'introduce'|'word'|'guess'|'shadow'|'missing'|'builder'|'group'|'match'|'choose'|'odd'|'writeLetter'|'write'|'complete'|'sort'|'puzzle'|'memory'|'finish'|'readIntro'|'sight'|'findSight'|'scene'|'read'|'readTogether'|'readChoose'|'readComplete'|'readAlone'|'sentenceBuild'|'end'|'extra';
export interface CourseSlide {id:string;kind:CourseKind;title:string;hint:string;lesson:1|2|'extra';entryIds:string[];groupIds:string[];phase:number;answerIds:string[];text?:string;sceneTarget?:string;draft?:boolean;}
export function courseUnits(bank:PhonicsBankEntry[]=curriculumEntries(false)):CourseUnit[]{
 const known=new Set(readerDrafts.baselineSightWords.map(w=>w.toLowerCase()));
 return plan.units.map(u=>{
  const groups=u.segments.flatMap(segment=>{
   const rule=PHONICS_RULES.find(r=>r.id===segment.ruleId)!;
   const names='groupNames' in segment?segment.groupNames as string[]:rule.groups.map(g=>g.name);
   return names.map(name=>({id:rule.id+':'+name,ruleId:rule.id,label:u.step===1?name+name.toLowerCase():u.step===2||u.step===3?name:rule.name,sound:rule.sound,
    entries:unitsForStep(u.step).filter(p=>p.ruleId===rule.id&&p.name===name).flatMap(p=>p.entries).map(e=>bank.find(b=>b.id===e.id)??e)}));
  });
  const entries=groups.flatMap(g=>g.entries);const draft=readerDrafts.drafts.find(r=>r.unitId===u.id);
  const wordIds=draft?.wordIds??(u.reader==='abc'?['pw-cat','pw-cap','pw-cup','pw-bag']:['pw-block','pw-clock','pw-flag','pw-clam']);
  const readingEntries=wordIds.map(id=>{const entry=entries.find(e=>e.wordId===id)??bank.find(e=>e.wordId===id&&e.tier==='basic');if(!entry)throw new Error(`Unresolved reader word ${u.id}: ${id}`);return entry;});
  const otherIds=(draft?.otherWordIds??[]).map(id=>readingEntries.find(e=>e.wordId===id)?.id??'');
  const sentences=readingEntries.map((e,i)=>draft?draft.pattern.replace('{word}',e.word).replace('{other}',readingEntries.find(x=>x.id===otherIds[i])?.word??''):u.reader==='abc'?`I see a ${e.word}.`:`Look at the ${e.word==='block'?'black block':e.word}.`);
  const proposed=draft?.newSightWords??(u.reader==='abc'?['a']:['Look']);
  const newSightWords=proposed.filter(w=>!known.has(w.toLowerCase())||u.reader==='abc');
  const lexical=new Set([...entries,...readingEntries].map(e=>e.word.toLowerCase()));
  const reviewSightWords=[...new Set(sentences.flatMap(s=>s.toLowerCase().replace(/[^a-z -]/g,'').split(/\s+/)).filter(w=>known.has(w)&&!lexical.has(w)&&!newSightWords.some(n=>n.toLowerCase()===w)))];
  proposed.forEach(w=>known.add(w.toLowerCase()));
  return {...u,groups,entries,reading:{status:draft?'draft' as const:'approved' as const,newSightWords,reviewSightWords,entries:readingEntries,sentences,otherIds}};
 });
}
const chunks=<T,>(a:T[],size:number)=>Array.from({length:Math.ceil(a.length/size)},(_,i)=>a.slice(i*size,(i+1)*size));
const soundHint=(g:LessonGroup,step:number)=>step===2?`Read the word family ${g.label}.`:step===3?`Magic e: ${g.sound.replace('_','…')}. Read the word family.`:g.ruleId==='th-voiceless'?'th /θ/ — the sound in thin.':g.ruleId==='th-voiced'?'th /ð/ — the sound in this.':g.ruleId==='oo-short'?'oo /ʊ/ — the sound in book.':g.ruleId==='oo-long'?'oo /uː/ — the sound in moon.':g.ruleId==='ow-long-o'?'ow /oʊ/ — the sound in snow.':g.ruleId==='ow-diphthong'?'ow /aʊ/ — the sound in cow.':step===4&&g.ruleId.startsWith('blend-')&&!['sh','ch','wh','ng'].includes(g.sound)?'Keep both sounds. Blend them together.':step===5?'Read the vowel pattern as one sound.':'Read the target sound.';
export const courseWord=(u:CourseUnit,id:string)=>[...u.entries,...u.reading.entries].find(e=>e.id===id)!;
export const pictureContext=(entry:PhonicsBankEntry)=>(contextReview as Record<string,string>)[entry.wordId??''];
export const readerSentence=(u:CourseUnit,id:string)=>u.reading.sentences[u.reading.entries.findIndex(e=>e.id===id)]??'';
export function builderParts(entry:PhonicsBankEntry,step:number):string[]{
 if(step===1)return [entry.word];
 if(step===2){const family=unitsForStep(2).find(u=>u.id===entry.unitId)?.name.replace(/^-/,'');if(family&&entry.word.endsWith(family)){const onset=entry.word.slice(0,-family.length);return onset?[onset,family]:[family];}return [entry.word.slice(0,1),entry.word.slice(1)];}
 if(step===3)return [...entry.word]; // The separated vowel and silent e retain their actual positions.
 const targets=entry.targets??[];const parts:string[]=[];let last=0;
 for(let i=0;i<entry.word.length;){const marked=targets.includes(i);let j=i+1;while(j<entry.word.length&&targets.includes(j)===marked)j++;parts.push(entry.word.slice(i,j));last=j;i=j;}
 return last?parts:[entry.word];
}
export function lessonSlides(u:CourseUnit):CourseSlide[]{
 if(u.status!=='confirmed')return [];
 if(u.id==='course-1-1')return alphabetReferenceSlides(u);
 if(u.id==='course-4-1')return level4ReferenceSlides(u);
 const slides:CourseSlide[]=[];const all=u.entries.map(e=>e.id);const reps=u.groups.map(g=>g.entries[0].id);
 let lesson:CourseSlide['lesson']=1;
 const add=(kind:CourseKind,title:string,ids:string[]=[],groups:string[]=[],hint='',phase=0,answerIds:string[]=[],extra:Partial<CourseSlide>={})=>{
  const s={id:u.id+':'+slides.length,kind,title,hint,lesson,entryIds:ids,groupIds:groups,phase,answerIds,...extra};slides.push(s);return s;
 };
 const phases=(kind:CourseKind,title:string,ids:string[],answer:string[],hint:string,count=2,groups:string[]=[])=>{for(let phase=0;phase<count;phase++)add(kind,title,ids,groups,hint,phase,answer);};
 const game=(kind:'puzzle'|'memory',ids:string[])=>{for(const id of ids){if(kind==='puzzle'&&pictureContext(courseWord(u,id)))continue;phases(kind,kind==='puzzle'?'What is it?':'Read and Remember',[id],[id],kind==='puzzle'?'Look at the pieces.':'Read the word. Remember it.',3);}};
 const batch=(g:LessonGroup)=>unitsForStep(u.step).filter(p=>p.ruleId===g.ruleId&&g.entries.some(e=>p.entries.some(x=>x.id===e.id))).map(p=>p.entries.filter(e=>g.entries.some(x=>x.id===e.id)).map(e=>e.id));
 add('cover',`Phonics Level ${u.step}`,reps,[],`Unit ${u.number}`);
 add('sounds',`Unit ${u.number}`,reps,u.groups.map(g=>g.id));
 add('lesson','Lesson 1',[],[],'Sounds, words and practice');
 if(u.step===2&&u.groups[0].ruleId!=='short-a'&&PHONICS_RULES.find(r=>r.id===u.groups[0].ruleId)?.groups[0].name===u.groups[0].label)add('transition','New Vowel',[],[u.groups[0].id],'Let’s learn the next short vowel.');
 add('sounds','Quick Review',[],u.groups.map(g=>g.id),'Say the sounds you know.');
 let previous='';
 for(const g of u.groups){
  if(u.step===2&&previous&&previous!==g.ruleId)add('transition','New Vowel',[],[g.id],'Let’s learn the next short vowel.');previous=g.ruleId;
  add(u.step===1?'letter':'sounds',u.step===1?'Meet '+g.label:'Listen and Say',[],[g.id],soundHint(g,u.step));
  add('introduce','Listen and Say',[g.entries[0].id],[g.id]);
  if(u.step>1)add('builder',u.step===4?'Blend and Say':'Phonics Builder',[g.entries[0].id],[g.id],'Connect the blocks. Blend the word.');
  add('word','Look and Say',[g.entries[0].id]);
 }
 phases('match','Match',reps,[],u.step===1?'Match the letters to the pictures.':'Match the rule to the picture.',2,u.groups.map(g=>g.id));
 game(u.step>=4?'puzzle':'memory',reps);
 if(u.step===1)for(const g of u.groups)add('writeLetter','Write '+g.label,[],[g.id],'Trace, then write.');
 for(const g of u.groups){
  add('sounds','Meet '+g.label,[],[g.id]);
  for(const ids of batch(g))add('group','Say Them Together',ids,[g.id],'Read the words in order.');
 }
 for(const g of u.groups){const ids=g.entries.slice(0,3).map(e=>e.id);phases('choose','Listen and Choose',ids,[ids[1]??ids[0]],'Listen to the whole word. Choose the picture.');}
 if(u.groups.length>1){const same=u.groups[0].entries.slice(0,2).map(e=>e.id);const other=u.groups[1].entries[0].id;phases('odd','Which One Doesn’t Belong?',[same[0],other,same[1]],[other],'Which One Doesn’t Belong?');}
 for(const ids of chunks(all,3))phases('match','Read and Match',ids,[],'Read the words. Match the pictures.');
 add('finish','Great Work!',[],[],'You finished Lesson 1.');
 lesson=2;add('lesson','Lesson 2',[],[],'Review, remember, write and read');
 for(const g of u.groups)for(const ids of batch(g))add('group','Quick Review',ids,[g.id],'Say the words.');
 game('memory',reps);
 for(const g of u.groups)for(const ids of batch(g))add('write','Look and Write',ids,[g.id],'Say the words. Trace, then write.');
 for(const g of u.groups)for(const ids of batch(g))phases('complete','Complete the Words',ids,[],'Look at the pictures. Fill the target letters.');
 if(u.groups.length>1)for(const ids of chunks(all,6))phases('sort','Read and Sort',ids,[],'Read the words. Sort by the spelling pattern.');
 if(u.reading.entries.length){
  const ids=u.reading.entries.map(e=>e.id);const words=u.reader==='abc'?['a']:[...u.reading.newSightWords];
  const start=slides.length;
  add('readIntro','Sight Words & Read',[],[],u.reading.status==='draft'?u.reading.sentences[0]:u.reader==='abc'?'I see a…':'Look at the…');
  for(const word of words)add('sight',word,[],[],'Read the word.',0,[],{text:word});
  for(const word of u.reading.reviewSightWords)add('sight','Quick Review',[],[],'Read the words you know.',0,[],{text:word});
  add('scene','Look at the Picture',ids,[],'What can you see?');
  for(const id of ids)add('read','Read with Me',ids,[],'Point and read.',0,[],{sceneTarget:id,text:readerSentence(u,id)});
  add('readTogether','Read Together',ids,[],'Read each sentence.');
  for(const [i,id] of ids.entries()){const text=readerSentence(u,id);if(text.includes(' or '))continue;const answers=text.includes(' and ')?[id,u.reading.otherIds[i]]:[id];phases('readChoose','Read and Choose',ids,answers,text);}
  const sentencePictures=[ids[0],...(u.reading.otherIds[0]?[u.reading.otherIds[0]]:[])];
  phases('sentenceBuild','Build the Sentence',sentencePictures,[],'Put the words in order.');
  if(u.reading.status==='draft')for(const s of slides.slice(start))s.draft=true;
 }else add('readIntro','Sight Words & Sentences',[],[],'Teacher review pending');
 add('finish','Great Work!',[],[],'You can read!');
 lesson='extra';add('extra','Extra Practice',[],[],'Optional word review');game(u.step>=4?'puzzle':'memory',all);game('memory',all);
 add('end','The end of slide',[],[],'Thank you!');
 return slides;
}

/** Preserve the existing approved ABC activities instead of replacing them with later-level games. */
function alphabetReferenceSlides(u:CourseUnit):CourseSlide[]{
 const original=buildStage1Course(u.entries)[0];
 const wordIds=(ids:string[])=>ids.map(id=>u.entries.find(e=>e.wordId===id)!.id);
 const mapped:CourseSlide[]=[];
 for(const s of original.slides){
  if(s.kind==='yourTurn')continue; // Removed by the latest brief; do not restore it.
  const kinds:Record<string,CourseKind>={cover:'cover',lesson:'lesson',air:'writeLetter',matchLetters:'letterMatch',meet:'letter',introduce:'introduce',word:'word',representativeMatch:'match',quiz:s.lesson===2?'shadow':'guess',writeLetter:'writeLetter',group:'group',find:'choose',matchWords:'match',firstLetters:'complete',sort:'sort',finish:'finish',lookWrite:'write',missingIntro:'extra',missing:'missing',level:'extra',readIntro:'readIntro',sight:'sight',findA:'findSight',scene:'scene',read:'read',together:'readTogether',readChoose:'readChoose',complete:'readComplete',speaking:'finish',extraIntro:'extra'};
  const kind=kinds[s.kind];if(!kind)throw new Error('Unmapped approved ABC activity: '+s.kind);
  const groups=s.letterUnitIds?.map(id=>u.groups.find(g=>g.ruleId==='letter-'+id.replace('alphabet-',''))!.id)??[];
  const round=s.roundId?original.rounds.find(r=>r.id===s.roundId):null;
  const ids=wordIds(round?round.full:s.wordIds),answers=wordIds(round?round.missing:s.answerIds??[]);
  let phase=s.phase==='answer'?1:0;if(round)phase=s.phase==='all'?0:s.phase==='question'?1:2;
  const readerId=s.readerWordId?wordIds([s.readerWordId])[0]:undefined;
  mapped.push({id:u.id+':'+mapped.length,kind,title:s.title,hint:s.kind==='readChoose'&&readerId?readerSentence(u,readerId):'',lesson:s.optional?'extra':s.lesson,entryIds:ids,groupIds:groups,answerIds:answers,phase,sceneTarget:readerId,text:s.kind==='sight'?'a':s.kind==='read'&&readerId?readerSentence(u,readerId):undefined});
 }
 mapped.push({id:u.id+':'+mapped.length,kind:'end',title:'The end of slide',hint:'Thank you!',lesson:'extra',entryIds:[],groupIds:[],answerIds:[],phase:0});
 return mapped;
}

/** Rebuild the 137-page supplied Level 4 v2 sequence using editable text and shared images. */
function level4ReferenceSlides(u:CourseUnit):CourseSlide[]{
 const slides:CourseSlide[]=[];let lesson:CourseSlide['lesson']=1;
 const ids=(words:string[])=>words.map(word=>u.entries.find(e=>e.word===word)!.id);
 const gids=u.groups.map(g=>g.id);
 const add=(kind:CourseKind,title:string,words:string[]=[],hint='',phase=0,answer:string[]=[],groupIds:string[]=[],extra:Partial<CourseSlide>={})=>slides.push({id:u.id+':'+slides.length,kind,title,hint,lesson,entryIds:ids(words),answerIds:ids(answer),groupIds,phase,...extra});
 const pair=(kind:CourseKind,title:string,words:string[],answer:string[],hint:string,groupIds:string[]=[])=>{const checked:Partial<Record<CourseKind,string>>={match:title==='Match'?'Match and Check':'Read and Check',choose:'Listen and Check',complete:'Let’s Check',sort:'Sort and Check',findSight:'Find and Check',readChoose:'Read and Check',sentenceBuild:'Let’s Check'};add(kind,title,words,hint,0,answer,groupIds);add(kind,checked[kind]??title,words,hint,1,answer,groupIds);};
 const puzzle=(word:string)=>{for(let phase=0;phase<3;phase++)add('puzzle','What is it?',[word],['Look at the pieces.','What can you see?','Say the word.'][phase],phase,[word]);add('word','Look and Say',[word]);};
 const memory=(word:string)=>{for(let phase=0;phase<3;phase++)add('memory',phase===2?'Look and Say':'Read and Remember',[word],phase===0?'Read the word.':'Say the word.',phase,[word]);};
 const batches=u.groups.flatMap(g=>unitsForStep(4).filter(p=>p.ruleId===g.ruleId).map(p=>({group:g,words:p.entries.map(e=>e.word)})));
 add('cover','Phonics Level 4',['black','clap','flag'],'Consonant Blends');
 add('sounds','Unit 1',['black','clap','flag'],'Consonant blends · bl, cl, fl',0,[],gids);
 add('lesson','Lesson 1',[],'Sounds, words and picture puzzles');
 add('sounds','Quick Review',[],'Say the sounds you know.',0,[],gids);
 add('sounds','Two Sounds Together',[],'Keep both sounds. Blend them together.',0,[],[gids[0]],{text:'b + l'});
 for(const [i,word] of ['black','clap','flag'].entries()){
  add('sounds','Listen and Say',[],'Listen to both sounds.',0,[],[gids[i]]);
  add('builder','Blend and Say',[word],'Say both sounds. Blend them together.',0,[],[gids[i]]);
  add('introduce','Listen and Say',[word],'Listen and say.',0,[],[gids[i]]);
  add('word','Look and Say',[word]);
 }
 pair('match','Match',['black','clap','flag'],[],'Match the blend to the picture.',gids);
 for(const word of ['black','clap','flag'])puzzle(word);
 for(const word of ['black','block','clap','flag'])add('builder','Phonics Builder',[word],'Connect the blocks. Blend the word.');
 for(const g of u.groups){add('sounds','Meet '+g.label,[],'Say both sounds.',0,[],[g.id]);for(const b of batches.filter(b=>b.group.id===g.id))add('group','Say Them Together',b.words,'Read the blend. Say the words.',0,[],[g.id]);}
 for(const word of ['block','clock','flip'])puzzle(word);
 pair('choose','Listen and Choose',['black','block','blank'],['block'],'Listen. Point to the picture.');
 pair('choose','Listen and Choose',['clap','clip','club'],['clip'],'Listen. Point to the picture.');
 pair('odd','Which One Doesn’t Belong?',['clip','block','clock'],['block'],'Which One Doesn’t Belong?');
 pair('odd','Which One Doesn’t Belong?',['flag','blank','blink'],['flag'],'Which One Doesn’t Belong?');
 pair('odd','Which One Doesn’t Belong?',['flat','clap','flip'],['clap'],'Which One Doesn’t Belong?');
 pair('match','Read and Match',['blank','clock','flap'],[],'Read the words. Match the pictures.');
 add('finish','Great Work!',[],'See you next time!');
 lesson=2;add('lesson','Lesson 2',[],'Review, remember, write and read');
 add('sounds','Quick Review',[],'Read the blends.',0,[],gids);
 for(const b of batches)add('group','Quick Review',b.words,'Say the words.',0,[],[b.group.id]);
 for(const word of ['block','clip','flap'])memory(word);
 for(const b of batches)add('write','Look and Write',b.words,'Say the words. Trace, then write.',0,[],[b.group.id]);
 pair('complete','Complete the Words',['black','clap','flag'],[],'Choose bl, cl or fl.');
 pair('sort','Read and Sort',['clip','flat','block','flip','blink','clock'],[],'Read the words. Sort by the blend.');
 add('readIntro','Sight Words & Read',[],'Look at the…');
 add('sight','Look',[],'Read the word.',0,[],[],{text:'Look'});
 add('sight','Look at the…',[],'Read the words together.',0,[],[],{text:'Look at the'});
 pair('findSight','Find the Words',['flag'],[],'Find Look, at and the.');
 const scene=['block','clock','flag','clam'];add('scene','Look at the Picture',scene,'What can you see?');
 for(const word of scene)add('read','Read with Me',scene,'Point and read.',0,[],[],{sceneTarget:ids([word])[0],text:`Look at the ${word==='block'?'black block':word}.`});
 add('readTogether','Read Together',scene,'Read each sentence.');
 add('read','Find and Read',scene,'Point and read.',0,[],[],{sceneTarget:ids(['flag'])[0],text:'Look at the flag.'});
 pair('readChoose','Read and Choose',['club','clock'],['clock'],'Look at the clock.');
 pair('readChoose','Read and Choose',['blank','block'],['block'],'Look at the black block.');
 pair('sentenceBuild','Build the Sentence',['flag'],[],'Put the words in order.');
 add('readAlone','Read by Yourself',['black','clip','flip'],'Read without pictures.');
 add('finish','Great Work!',[],'You can read!');
 lesson='extra';add('extra','Extra Practice',[],'Optional word and review practice');
 add('extra','What is it?',[],'Picture Puzzles');for(const word of ['club','clam'])puzzle(word);
 add('extra','Read and Remember',[],'Word Review');for(const word of ['blank','clock','flip'])memory(word);
 add('end','The end of slide',[],'Thank you!');
 if(slides.length!==137)throw new Error('Level 4 reference sequence must contain 137 steps');
 return slides;
}

/** Unapproved reader drafts remain in development when the course tab is published. */
export function availableLessonSlides(unit:CourseUnit){return lessonSlides(unit).filter(slide=>import.meta.env.DEV||!slide.draft);}
