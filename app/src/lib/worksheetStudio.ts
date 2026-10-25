import type { FullCardItem, PhonicsBankEntry } from './types';
import { worksheetActivity } from './worksheetActivityCatalog';
import { buildWorksheet, chunk, makeRng, shuffled, DEFAULT_COLORING_OPTIONS, isWorksheetEmpty, sentenceTokens, type WorksheetData } from './worksheetGenerators';
import { parsePattern } from './phonicsPattern';

export interface StudioWord extends FullCardItem {
 lineartUrl?:string|null; sounds?:string; phonemes?:string; syllables?:string; stress?:number;
 partner?:string; partnerSounds?:string; partnerPhonemes?:string; parts?:string;
 sharedImage?:boolean; sharedLineart?:boolean;
 soundGroup?:string;
}
export interface StudioTask { id:string; prompt:string; answer:string; detail:string; options:string[]; wordId?:string; order?:number; }
export interface WorksheetDocument {
 schema:'classbank-worksheet-v1'; activityId:string; title:string; instruction:string;
 words:StudioWord[]; tasks:StudioTask[]; passage:string; topic:string; left:string; right:string; columns:string; route:string; seed:number;
 editedTasks?:boolean; needsReview?:boolean;
}
export interface WorksheetIssue { key:string; index?:number; values?:Record<string,string|number>; }
export const newTask=(prompt='',answer='',detail='',wordId?:string):StudioTask=>({id:crypto.randomUUID(),prompt,answer,detail,options:[],wordId});
export function studioKey(user:string,academy:string) { return `classbank:worksheets:v1:${user}:${academy}`; }
export function safePicture(value:unknown):value is string {
 return typeof value==='string' && value.length<=2048 && (/^\/(?!\/)[\w\-./%]+(?:\?[^\s<>]*)?$/.test(value)||/^https:\/\/[^\s<>"']+$/i.test(value));
}
export function soundGroups(word:string,pattern:string):{text:string;span:number;positions:number[]}[]|null {
 const raw=pattern.split('|').map(s=>s.trim()).filter(Boolean), plain=word.trim().toLowerCase();
 if(!raw.length||raw.length>16||!/^[a-z]+$/.test(plain))return null;
 const used=new Set<number>(),out=[];
 for(const token of raw){
  const doubled=token.split(':'),span=doubled.length===2&&doubled[0]===doubled[1]?2:1;
  if(token.includes(':')&&span!==2)return null;
  const text=span===2?doubled[0]:token;let start=0;const positions:number[]=[];
  for(const piece of text.toLowerCase().split('_')){
   if(!/^[a-z]+$/.test(piece))return null;
   let found=-1;
   for(let at=start;at<=plain.length-piece.length;at++)if(plain.slice(at,at+piece.length)===piece&&[...piece].every((_,i)=>!used.has(at+i))){found=at;break;}
   if(found<0)return null;
   for(let i=0;i<piece.length;i++){used.add(found+i);positions.push(found+i);}start=found+piece.length;
  }
  out.push({text,span,positions});
 }
 return used.size===plain.length?out:null;
}
export const phonemeParts=(s:string|undefined)=>s?.split('|').map(v=>v.trim().replace(/^\/|\/$/g,'')).filter(Boolean)||[];
const phones=phonemeParts;
export function rhymeOfPhones(word:StudioWord) {const values=phones(word.phonemes);let i=values.length-1;while(i>=0&&!/[aeiouæɪɒʌʊəɑɛɔɜɐɚɝ]/i.test(values[i]))i--;return i<0?'':values.slice(i).join('|');}
export function phonemeDistance(a:string[],b:string[]):number {
 const d=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i?j?0:i:j));
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+Number(a[i-1]!==b[j-1]));
 return d[a.length][b.length];
}
/** Only an exact meaning/rule match can supply shared assets. Never replace a teacher override. */
export function studioWordsFromCards(cards:FullCardItem[],bank:PhonicsBankEntry[]=[]):StudioWord[] {
 return cards.map((card,i)=>{
  const existing=card as StudioWord;
  const hits=bank.filter(e=>e.word.toLowerCase()===card.word.trim().toLowerCase()&&(e.meaning||'').trim()===card.meaning.trim()&&(!card.patternMarked||e.pattern_marked===card.patternMarked));
  const hit=hits.find(e=>e.rule===card.category)||hits.find(e=>e.step>=2)||hits[0];
  return {...existing,id:`${card.id||'word'}:${i}`,imageUrl:card.imageUrl??hit?.image_url??null,
   lineartUrl:existing.lineartUrl===undefined?(!card.imageUrl||card.imageUrl===hit?.image_url?hit?.lineart_url??null:null):existing.lineartUrl,
   patternMarked:card.patternMarked||hit?.pattern_marked,soundGroup:existing.soundGroup||hit?.rule||'', sounds:existing.sounds||'',phonemes:existing.phonemes||'',syllables:existing.syllables||'',partner:existing.partner||'',parts:existing.parts||''};
 });
}
export function rebuildWordTasks(doc:WorksheetDocument):WorksheetDocument {
 const activity=worksheetActivity(doc.activityId);if(!activity||activity.mode==='content')return doc;
 if(doc.activityId==='exitTicket')return {...doc,editedTasks:false,needsReview:false,tasks:[newTask('Write one word you learned today.'),newTask('Use that word in your own sentence.'),newTask('What would you like to practise next?')]};
 const tasks=doc.words.map(w=>newTask(
  doc.activityId==='pictureWrite'?'Write a sentence about this picture.':doc.activityId==='findSomeone'?`Can you use "${w.word}" in a sentence?`:doc.activityId==='dictation'||doc.activityId==='walkDictation'?w.example||w.word:doc.activityId==='listenColor'?'Listen to your teacher.':w.meaning,
  doc.activityId==='pictureWrite'?w.example||'':doc.activityId==='listenColor'?['red','blue','yellow','green','orange','purple'][doc.words.indexOf(w)%6]:doc.activityId==='dictation'||doc.activityId==='walkDictation'?w.example||w.word:w.word,
  '',w.id));
 return {...doc,tasks,editedTasks:false,needsReview:false};
}
export function replaceStudioWords(doc:WorksheetDocument,words:StudioWord[]):WorksheetDocument {
 return rebuildWordTasks({...doc,words});
}
export function legacyWorksheet(doc:WorksheetDocument):WorksheetData|null {
 const kind=worksheetActivity(doc.activityId)?.legacy;
 if(kind==='phonicsRhyme'){
  const groups=new Map<string,StudioWord[]>();for(const w of doc.words){const key=rhymeOfPhones(w);if(key)groups.set(key,[...(groups.get(key)||[]),w]);}
  const pairs=[...groups.values()].filter(g=>g.length>=2).map(g=>Array.from({length:Math.ceil(g.length/2)},(_,i)=>({left:g[i*2],right:g[(i*2+1)%g.length]})));
  const pages=[];const rng=makeRng(doc.seed);
  for(let round=0;round<Math.max(0,...pairs.map(g=>g.length));round++)for(const batch of chunk(pairs.flatMap(g=>g[round]?[g[round]]:[]),5)){
   const order=shuffled(batch.map((_,i)=>i),rng);pages.push({left:batch.map(p=>({image:null,text:p.left.word})),right:order.map(i=>({image:null,text:batch[i].right.word})),answer:batch.map((_,i)=>order.indexOf(i))});
  }return {kind,pages};
 }
 const words=doc.activityId==='soundSort'?doc.words.map(w=>({...w,category:w.soundGroup||''})):doc.words;
 return kind?buildWorksheet(kind,words,doc.seed,{askTemplate:'like',sheetTitle:doc.title,coloring:{...DEFAULT_COLORING_OPTIONS,title:doc.title,preserveWords:true}}):null;
}
export function studioLegacyPages(doc:WorksheetDocument):WorksheetData[] {
 const data=legacyWorksheet(doc);if(!data)return [];
 if(data.kind==='grouping'){
  const categories=[...new Set(doc.words.map(w=>w.category).filter(Boolean))];
  return chunk(categories,3).flatMap(names=>chunk(doc.words.filter(w=>names.includes(w.category)),12).map(words=>({kind:'grouping' as const,sheet:{groups:names.map(name=>({name:name!,words:words.filter(w=>w.category===name)})),pool:shuffled(words,makeRng(doc.seed))}})));
 }
 if(data.kind==='boardGame'&&doc.words.length>28)return chunk(doc.words,28).map(words=>buildWorksheet('boardGame',words,doc.seed,{sheetTitle:doc.title}));
 return [data];
}
export function routeCells(route:string):number[]|null {
 let x=0,y=0;const cells=[0],parts=route.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!parts.length||parts.length>20)return null;
 for(const p of parts){if(p==='right')x++;else if(p==='left')x--;else if(p==='down')y++;else if(p==='up')y--;else return null;if(x<0||x>2||y<0||y>2)return null;cells.push(y*3+x);}
 return cells;
}
const imageKinds=new Set(['pictureMatch','readMatch','listenChoice','difference','barrier','pictureWrite','memory']);
const taskLayouts=new Set(['questions','reader','sequence','storyMap','mainIdea','venn','draw','table','dictogloss','informationGap','roleplay','ranking','jigsaw','expansion','paragraph','comic','recount','opinion','checklist','functional','form','poster','media','kwl','rubric']);
const openLayouts=new Set(['frayer','draw','storyMap','mainIdea','venn','dictogloss','survey','roleplay','ranking','jigsaw','pictureWrite','expansion','paragraph','comic','recount','opinion','checklist','form','poster','media','kwl','exit','rubric']);
export function hasOpenAnswers(doc:WorksheetDocument) { return openLayouts.has(worksheetActivity(doc.activityId)?.layout||''); }
export function worksheetIssues(doc:WorksheetDocument):WorksheetIssue[] {
 const activity=worksheetActivity(doc.activityId);if(!activity)return [{key:'importFailed'}];
 const issues:WorksheetIssue[]=[];const add=(key:string,index?:number,values?:WorksheetIssue['values'])=>issues.push({key,index,values});
 if(doc.needsReview)add('reviewChanged');
 for(const [key,max] of [['title',100],['instruction',300],['passage',6000],['topic',250],['left',90],['right',90],['columns',1200]] as const){
  if(['title','instruction'].includes(key)&&!doc[key].trim())add('missingField',undefined,{field:key});
  if(doc[key].length>max)add('tooLong',undefined,{field:key,count:max});
 }
 if(doc.words.length>60||doc.tasks.length>60)add('tooLong',undefined,{field:'questions',count:60});
 if(activity.mode==='words'){
  const minimum=['minimalPairs','meaningPairs','collocations','domino','memory','wordChain'].includes(doc.activityId)?2:doc.activityId==='bingo'?4:['listenChoice','difference'].includes(doc.activityId)?3:doc.activityId==='barrier'?4:1;
  if(doc.words.length<minimum)add('missingWords',undefined,{count:minimum});
  const names=doc.words.map(w=>w.word.trim().toLowerCase());
  if(new Set(names).size!==names.length)add('duplicateWord');
 }
 for(const [i,w] of doc.words.entries()){
  if(!w.word.trim())add('missingField',i,{field:'word'});
  if(w.word.length>100||w.meaning.length>160||(w.example||'').length>250)add('tooLong',i,{field:'word',count:250});
  for(const url of [w.imageUrl,w.lineartUrl])if(url&&!safePicture(url))add('invalidPicture',i);
  if(imageKinds.has(doc.activityId)&&!w.imageUrl)add('missingImage',i);
  if(['listenColor','basic-coloring'].includes(doc.activityId)&&!w.lineartUrl)add('missingLineart',i);
  if(doc.activityId==='basic-cutPaste'&&!w.imageUrl)add('missingImage',i);
  if(doc.activityId==='basic-tracing'&&w.word.length>24)add('invalidWord',i);
  if(['crossword','review','meaningPairs','domino'].includes(doc.activityId)&&!w.meaning.trim()&&!(w.partner||'').trim())add('missingMeaning',i);
  if(['meaningPairs','collocations','minimalPairs'].includes(doc.activityId)&&!w.partner?.trim())add('missingField',i,{field:'partner'});
  if(['soundBoxes','wordChain','minimalPairs'].includes(doc.activityId)){
   if(!w.sounds)add('missingSound',i);else if(!soundGroups(w.word,w.sounds))add('soundMismatch',i);
   if(doc.activityId!=='soundBoxes'&&!phones(w.phonemes).length)add('missingSound',i);
   if(doc.activityId==='minimalPairs'&&(!w.partnerSounds||!soundGroups(w.partner||'',w.partnerSounds)||!phones(w.partnerPhonemes).length||phonemeDistance(phones(w.phonemes),phones(w.partnerPhonemes))!==1||w.word===w.partner))add('invalidPair',i);
   if(doc.activityId==='wordChain'&&i>0&&phones(w.phonemes).length&&phones(doc.words[i-1].phonemes).length&&phonemeDistance(phones(doc.words[i-1].phonemes),phones(w.phonemes))!==1)add('invalidChain',i);
  }
  if(doc.activityId==='syllables'&&(!w.syllables||w.syllables.replaceAll('|','').toLowerCase()!==w.word.toLowerCase()||!Number.isInteger(w.stress)||w.stress!<1||w.stress!>w.syllables.split('|').length))add('invalidStress',i);
  if(doc.activityId==='morphology'&&(!w.parts?.trim()||w.parts.replaceAll('|','').toLowerCase()!==w.word.toLowerCase()))add('missingField',i,{field:'parts'});
  if(doc.activityId==='crossword'){
   if(!/^[a-z]{2,16}$/i.test(w.word))add('invalidWord',i);
   if(w.meaning.toLowerCase().includes(w.word.toLowerCase()))add('crosswordClue',i);
  }
  if(['readMatch','sentenceOrder'].includes(doc.activityId)&&!sentenceTokens(w.example))add('missingExample',i);
  if(doc.activityId==='targetLetters'&&(!w.patternMarked||!parsePattern(w.patternMarked).some(p=>p.marked)||parsePattern(w.patternMarked).map(p=>p.text).join('').toLowerCase()!==w.word.toLowerCase()))add('missingPattern',i);
  if(doc.activityId==='soundSort'&&!w.soundGroup)add('missingCategory',i);
  if(doc.activityId==='rhyme'&&!rhymeOfPhones(w))add('missingSound',i);
 }
 if(doc.activityId==='wordSort'&&new Set(doc.words.map(w=>w.category).filter(Boolean)).size<2)add('missingCategory');
 if(doc.activityId==='wordSort'&&doc.words.some(w=>!w.category?.trim()))add('missingCategory');
 if(['meaningPairs','collocations'].includes(doc.activityId)&&new Set(doc.words.map(w=>(w.partner||'').trim().toLowerCase())).size!==doc.words.length)add('duplicateWord');
 if(doc.activityId==='listenMap'&&!routeCells(doc.route))add('invalidRoute');
 if(doc.activityId==='listenMap'&&doc.words.length!==9)add('exactWords',undefined,{count:9});
 if(activity.layout==='substitution'){
  const cols=doc.columns.split('\n').filter(s=>s.trim());if(cols.length<2||cols.length>4||cols.some(c=>c.split('|').length>6||!c.split('|').every(v=>v.trim()&&v.length<=40)))add('invalidColumns');
 }
 if(taskLayouts.has(activity.layout)&&!doc.tasks.length)add('noTasks');
 if(['reader','storyMap','mainIdea','dictogloss','media'].includes(activity.layout)&&!doc.passage.trim())add('missingField',undefined,{field:'passage'});
 const checkedTasks=taskLayouts.has(activity.layout)||['dictation','survey','pictureWrite','walkDictation','exit'].includes(activity.layout)?doc.tasks:[];
 for(const [i,row] of checkedTasks.entries()){
  if(!row.prompt.trim())add('missingField',i,{field:'prompt'});
  if(row.prompt.length>260||row.answer.length>300||row.detail.length>350||row.options.join('').length>350)add('tooLong',i,{field:'prompt',count:350});
  if(!openLayouts.has(activity.layout)&&!['substitution','walkDictation','readRoom','listenChoice','bingo','memory','domino','crossword','rollRead','alphabet','sounds','chain','pairs','syllables','morphology','legacy','listenColor','map','coverWrite','dictation','review','sequence'].includes(activity.layout)&&!row.answer.trim())add('missingField',i,{field:'answer'});
  if(doc.activityId==='grammarChoice'||doc.activityId==='cloze'||row.options.length){const options=row.options.map(s=>s.trim());if(options.length<2||new Set(options).size!==options.length||!options.includes(row.answer.trim()))add('invalidChoice',i);}
  if(row.wordId&&!doc.words.some(w=>w.id===row.wordId))add('missingImage',i);
 }
 if(activity.layout==='sequence'&&doc.tasks.map(r=>r.order).sort((a,b)=>Number(a)-Number(b)).some((n,i)=>n!==i+1))add('invalidOrder');
 if(activity.layout==='jigsaw'&&new Set(doc.tasks.map(r=>r.order)).size<2)add('invalidOrder');
 if(activity.layout==='kwl'&&doc.tasks.length!==3)add('invalidOrder');
 if(activity.layout==='functional'&&(!doc.tasks.some(r=>r.order===1)||!doc.tasks.some(r=>r.order!==1)))add('noTasks');
 if(doc.activityId==='listenColor'&&doc.tasks.some(r=>!r.answer.trim()))add('missingField',undefined,{field:'answer'});
 if(doc.activityId==='listenColor'&&(doc.tasks.length!==doc.words.length||new Set(doc.tasks.map(r=>r.wordId)).size!==doc.words.length||doc.tasks.some(r=>!doc.words.some(w=>w.id===r.wordId))))add('linkedTasks');
 if(doc.activityId==='pictureWrite'&&doc.tasks.some(r=>!doc.words.some(w=>w.id===r.wordId&&w.imageUrl)))add('missingImage');
 if(doc.activityId==='sentenceOrder'&&new Set(doc.words.map(w=>w.example?.trim())).size!==doc.words.length)add('duplicateWord');
 if(activity.legacy){
  const generated=legacyWorksheet(doc);if(!generated||isWorksheetEmpty(generated))add('noTasks');
  if(generated?.kind==='wordSearch'&&generated.pages.some(p=>p.skipped.length))add('invalidWord');
  if(generated?.kind==='phonicsOdd'||generated?.kind==='phonicsRhyme'){
   const used=generated.kind==='phonicsOdd'?new Set(generated.pages.flat().flatMap(r=>r.options.map(o=>o.word))):new Set(generated.pages.flatMap(p=>[...p.left,...p.right].map(r=>r.text)));
   doc.words.forEach((w,i)=>{if(!used.has(w.word))add('unusedWord',i);});
  }
  if(['wordSearch','scramble'].includes(doc.activityId)&&doc.words.some(w=>!/^[a-z]{3,12}$/i.test(w.word)))add('invalidWord');
 }
 return issues.filter((v,i,all)=>all.findIndex(x=>x.key===v.key&&x.index===v.index)===i);
}

/** Strict editable-file boundary. No HTML, executable payloads, remote fetch or teacher identity is imported. */
export function parseWorksheetFile(input:unknown):WorksheetDocument {
 if(!input||typeof input!=='object')throw Error('invalid_file');
 const o=input as Record<string,unknown>;if(o.schema!=='classbank-worksheet-v1'||typeof o.activityId!=='string'||!worksheetActivity(o.activityId)||!Array.isArray(o.words)||!Array.isArray(o.tasks)||o.words.length>60||o.tasks.length>60)throw Error('invalid_file');
 const str=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)throw Error('invalid_file');return v;};
 const picture=(v:unknown)=>{if(v===null||v===undefined||v==='')return null;if(!safePicture(v))throw Error('invalid_file');return v;};
 const words:StudioWord[]=o.words.map((raw,i)=>{
  if(!raw||typeof raw!=='object')throw Error('invalid_file');const w=raw as Record<string,unknown>;
  return {id:str(w.id,180)||`word-${i}`,word:str(w.word,100),meaning:str(w.meaning,160),imageUrl:picture(w.imageUrl),lineartUrl:picture(w.lineartUrl),
   category:str(w.category??'',100),example:str(w.example??'',250),patternMarked:str(w.patternMarked??'',150),
   sounds:str(w.sounds??'',200),phonemes:str(w.phonemes??'',200),soundGroup:str(w.soundGroup??'',100),syllables:str(w.syllables??'',150),stress:typeof w.stress==='number'&&Number.isFinite(w.stress)?w.stress:1,
   partner:str(w.partner??'',150),partnerSounds:str(w.partnerSounds??'',200),partnerPhonemes:str(w.partnerPhonemes??'',200),parts:str(w.parts??'',150),sharedImage:w.sharedImage===true,sharedLineart:w.sharedLineart===true};
 });
 if(new Set(words.map(w=>w.id)).size!==words.length)throw Error('invalid_file');
 const tasks:StudioTask[]=o.tasks.map(raw=>{if(!raw||typeof raw!=='object')throw Error('invalid_file');const r=raw as Record<string,unknown>;if(!Array.isArray(r.options)||r.options.length>12)throw Error('invalid_file');return {id:str(r.id,180),prompt:str(r.prompt,260),answer:str(r.answer,300),detail:str(r.detail,350),options:r.options.map(v=>str(v,180)),wordId:r.wordId?str(r.wordId,180):undefined,order:typeof r.order==='number'&&Number.isFinite(r.order)?r.order:undefined};});
 if(new Set(tasks.map(r=>r.id)).size!==tasks.length)throw Error('invalid_file');
 const seed=typeof o.seed==='number'&&Number.isFinite(o.seed)?o.seed:1;
 return {schema:'classbank-worksheet-v1',activityId:o.activityId,title:str(o.title,100),instruction:str(o.instruction,300),words,tasks,passage:str(o.passage,6000),topic:str(o.topic,250),left:str(o.left,90),right:str(o.right,90),columns:str(o.columns,1200),route:str(o.route,200),seed,editedTasks:o.editedTasks===true,needsReview:o.needsReview===true};
}

export interface WorksheetStore {current:Record<string,WorksheetDocument>; copies:{id:string;name:string;document:WorksheetDocument;updatedAt:string}[];}
export function readWorksheetStore(key:string):WorksheetStore {
 try {const raw=JSON.parse(localStorage.getItem(key)||'{}');const current:Record<string,WorksheetDocument>={};for(const [id,value] of Object.entries(raw.current||{})){try{const doc=parseWorksheetFile(value);if(doc.activityId===id)current[id]=doc;}catch{/* keep other valid saved worksheets */}}
  const copies=(Array.isArray(raw.copies)?raw.copies:[]).slice(0,30).flatMap((c:{id?:unknown;name?:unknown;document?:unknown;updatedAt?:unknown})=>{try {if(typeof c.id!=='string'||typeof c.name!=='string'||typeof c.updatedAt!=='string')return [];return [{id:c.id,name:c.name.slice(0,100),document:parseWorksheetFile(c.document),updatedAt:c.updatedAt}];}catch{return [];}});return {current,copies};
 }catch{return {current:{},copies:[]};}
}
export function writeWorksheetStore(key:string,value:WorksheetStore):boolean {try {localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
