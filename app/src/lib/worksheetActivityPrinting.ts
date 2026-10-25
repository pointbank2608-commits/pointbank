import { chunk, makeRng, shuffled } from './worksheetGenerators';
import { worksheetActivity } from './worksheetActivityCatalog';
import { phonemeParts, routeCells, soundGroups, type StudioTask, type StudioWord, type WorksheetDocument } from './worksheetStudio';

export interface PrintCrossword {grid:(string|null)[][]; entries:{word:StudioWord;row:number;col:number;dir:'across'|'down';number:number}[];}
/** All input words are retained. Unconnected words get their own separated row. */
export function printableCrossword(words:StudioWord[]):PrintCrossword {
 const cells=new Map<string,string>(),entries:PrintCrossword['entries']=[];
 const key=(r:number,c:number)=>`${r},${c}`;
 const at=(r:number,c:number)=>cells.get(key(r,c));
 const fits=(text:string,r:number,c:number,dir:'across'|'down')=>{
  const dr=Number(dir==='down'),dc=Number(dir==='across');
  if(r<0||c<0||r+dr*(text.length-1)>22||c+dc*(text.length-1)>17||at(r-dr,c-dc)||at(r+dr*text.length,c+dc*text.length))return false;
  let crosses=0;
  for(let i=0;i<text.length;i++){
   const rr=r+dr*i,cc=c+dc*i,old=at(rr,cc);
   if(old){if(old!==text[i])return false;crosses++;}
   else if(dir==='across'?(at(rr-1,cc)||at(rr+1,cc)):(at(rr,cc-1)||at(rr,cc+1)))return false;
  }
  return crosses>0&&crosses<text.length;
 };
 for(const w of [...words].sort((a,b)=>b.word.length-a.word.length)){
  const text=w.word.toUpperCase();let pos:{r:number;c:number;dir:'across'|'down'}|null=null;
  for(const e of entries){if(pos)break;const old=e.word.word.toUpperCase();for(let i=0;i<old.length&&!pos;i++)for(let j=0;j<text.length&&!pos;j++)if(old[i]===text[j]){
   const dir=e.dir==='across'?'down':'across',r=e.row+(e.dir==='down'?i:0)-(dir==='down'?j:0),c=e.col+(e.dir==='across'?i:0)-(dir==='across'?j:0);
   if(fits(text,r,c,dir))pos={r,c,dir};
  }}
  if(!pos){const last=entries.length?Math.max(...entries.map(e=>e.row+(e.dir==='down'?e.word.word.length-1:0))):-2;pos={r:last+2,c:0,dir:'across'};}
  entries.push({word:w,row:pos.r,col:pos.c,dir:pos.dir,number:0});
  [...text].forEach((letter,i)=>cells.set(key(pos!.r+(pos!.dir==='down'?i:0),pos!.c+(pos!.dir==='across'?i:0)),letter));
 }
 const h=Math.max(0,...[...cells.keys()].map(k=>Number(k.split(',')[0])+1)),width=Math.max(0,...[...cells.keys()].map(k=>Number(k.split(',')[1])+1));
 const starts=[...new Set(entries.map(e=>key(e.row,e.col)))].sort((a,b)=>Number(a.split(',')[0])-Number(b.split(',')[0])||Number(a.split(',')[1])-Number(b.split(',')[1]));
 entries.forEach(e=>e.number=starts.indexOf(key(e.row,e.col))+1);
 return {grid:Array.from({length:h},(_,r)=>Array.from({length:width},(_,c)=>at(r,c)||null)),entries};
}
export function passageChunks(text:string,size=850):string[] {
 const result:string[]=[];let rest=text.trim();while(rest){let end=Math.min(size,rest.length);if(end<rest.length){const split=rest.lastIndexOf(' ',end);if(split>size/2)end=split;}result.push(rest.slice(0,end));rest=rest.slice(end).trim();}return result;
}
export function listeningChoices(doc:WorksheetDocument) {
 const rng=makeRng(doc.seed);
 return doc.words.map(word=>{const choices=shuffled([word,...shuffled(doc.words.filter(w=>w.id!==word.id),rng).slice(0,2)],rng);return {word,choices,correct:choices.findIndex(w=>w.id===word.id)};});
}
export function chainCue(previous:StudioWord,next:StudioWord):string {
 const a=phonemeParts(previous.phonemes),b=phonemeParts(next.phonemes);let i=0;while(i<Math.min(a.length,b.length)&&a[i]===b[i])i++;
 return a.length===b.length?`Change sound ${i+1}: /${a[i]}/ → /${b[i]}/.`:a.length<b.length?`Add /${b[i]}/ at sound position ${i+1}.`:`Remove /${a[i]}/ at sound position ${i+1}.`;
}
export function teacherCues(doc:WorksheetDocument):string[] {
 const layout=worksheetActivity(doc.activityId)!.layout;
 if(layout==='listenChoice')return listeningChoices(doc).map((c,i)=>`${i+1}. Find the ${c.word.word}.`);
 if(layout==='pairs'&&doc.activityId==='minimalPairs'){const rng=makeRng(doc.seed);return doc.words.map((w,i)=>`${i+1}. ${rng()<.5?w.word:w.partner}`);}
 if(layout==='listenColor')return doc.tasks.map(r=>`Colour picture ${doc.words.findIndex(w=>w.id===r.wordId)+1}, the ${doc.words.find(w=>w.id===r.wordId)?.word||''}, ${r.answer}.`);
 if(layout==='map')return [`Start at A1. ${doc.route.split(',').map(s=>`Go one block ${s.trim()}.`).join(' ')}`];
 if(layout==='table')return doc.tasks.map(r=>r.detail||`${r.prompt}: ${r.answer}.`);
 if(layout==='dictation')return doc.tasks.map((r,i)=>`${i+1}. ${r.prompt}`);
 if(layout==='draw')return doc.tasks.map((r,i)=>`${i+1}. ${r.detail||r.answer}`);
 if(layout==='dictogloss')return passageChunks(doc.passage);
 if(doc.activityId==='mediaGaps')return doc.tasks.map(r=>r.detail||r.answer);
 if(layout==='sounds')return doc.words.map((w,i)=>`${i+1}. ${w.word}`);
 return [];
}
export function teacherAnswers(doc:WorksheetDocument):{prompt:string;answer:string;detail?:string}[] {
 const layout=worksheetActivity(doc.activityId)!.layout;
 if(layout==='listenChoice')return listeningChoices(doc).map((c,i)=>({prompt:String(i+1),answer:`${String.fromCharCode(65+c.correct)} · ${c.word.word}`}));
 if(layout==='listenColor')return doc.tasks.map(r=>({prompt:`${doc.words.findIndex(w=>w.id===r.wordId)+1}. ${doc.words.find(w=>w.id===r.wordId)?.word||''}`,answer:r.answer}));
 if(layout==='map'){const cells=routeCells(doc.route)||[];return [{prompt:doc.route,answer:cells.map(c=>`${'ABC'[c%3]}${Math.floor(c/3)+1}`).join(' → ')}];}
 if(layout==='pairs')return doc.activityId==='minimalPairs'?teacherCues(doc).map(s=>({prompt:s.split('.')[0],answer:s.slice(s.indexOf('.')+2)})):doc.words.map(w=>({prompt:w.word,answer:w.partner||w.meaning}));
 if(layout==='sounds')return doc.words.map(w=>({prompt:w.word,answer:(soundGroups(w.word,w.sounds||'')||[]).map(g=>g.text+(g.span===2?' (2 sounds)':'')).join(' | ')}));
 if(layout==='chain')return doc.words.map((w,i)=>({prompt:i?chainCue(doc.words[i-1],w):'Start',answer:w.word}));
 if(layout==='syllables')return doc.words.map(w=>({prompt:w.word,answer:`${w.syllables} · stress ${w.stress}`}));
 if(layout==='morphology')return doc.words.map(w=>({prompt:w.parts||'',answer:`${w.word} — ${w.meaning}`}));
 if(layout==='sequence')return [...doc.tasks].sort((a,b)=>a.order!-b.order!).map(r=>({prompt:String(r.order),answer:r.prompt}));
 if(layout==='difference')return [{prompt:'A → B',answer:'The first three occupied positions are rotated. Compare positions 1, 2 and 3 on each pair of boards.'}];
 if(layout==='barrier')return doc.words.map((w,i)=>({prompt:`${i+1}`,answer:w.word}));
 if(['alphabet','frayer','coverWrite','memory','domino','bingo','crossword','rollRead','readRoom','review'].includes(layout))return doc.words.map((w,i)=>({prompt:`${i+1}. ${layout==='review'?w.meaning:w.word}`,answer:layout==='alphabet'?`${w.word[0].toUpperCase()} ${w.word[0].toLowerCase()}`:`${w.word} — ${w.meaning}`,detail:w.example||''}));
 if(['walkDictation','dictation'].includes(layout))return doc.tasks.map((r,i)=>({prompt:String(i+1),answer:r.prompt}));
 return doc.tasks.map(r=>({prompt:r.prompt,answer:r.answer,detail:r.detail}));
}
export interface StudioPaperBlock {kind:string;words?:StudioWord[];rows?:StudioTask[];text?:string;role?:string;offset?:number;index?:number;}
export function studentBlocks(doc:WorksheetDocument):StudioPaperBlock[] {
 const activity=worksheetActivity(doc.activityId)!,layout=activity.layout;
 const words=(size:number,kind:string=layout):StudioPaperBlock[]=>chunk(doc.words,size).map((ws,i)=>({kind,words:ws,offset:i*size}));
 const rows=(size:number,kind:string=layout):StudioPaperBlock[]=>chunk(doc.tasks,size).map((rs,i)=>({kind,rows:rs,offset:i*size}));
 const textPages=()=>passageChunks(doc.passage).map(text=>({kind:'text',text}));
 if(layout==='legacy')return [{kind:'legacy'}];
 if(layout==='substitution')return [{kind:layout}];
 if(layout==='wordList')return words(doc.words.some(w=>(w.example||'').length>140||w.meaning.length>90||w.word.length>30)?2:4);
 if(layout==='wordCards')return words(6);
 if(layout==='wordTracing')return words(3);
 if(layout==='coverWrite')return words(doc.words.some(w=>w.word.length>30)?3:4);
 if(layout==='pairs')return words(doc.words.some(w=>(w.partner||'').length>80||w.word.length>25)?4:6);
 if(['alphabet','sounds','syllables','morphology','review'].includes(layout))return words(6);
 if(layout==='chain')return chunk(doc.words,6).map((ws,i)=>({kind:layout,words:i?[doc.words[i*6-1],...ws]:ws,offset:i*6-(i?1:0)}));
 if(layout==='frayer')return words(1);
 if(layout==='sequence')return chunk(shuffled(doc.tasks,makeRng(doc.seed)),4).map((rs,i)=>({kind:layout,rows:rs,offset:i*4}));
 if(layout==='questions'||layout==='reader'){
  const parts=rows(doc.passage?2:3,'questions');
  if(doc.passage.length<=850&&doc.passage){if(parts[0])parts[0].text=doc.passage;return parts;}
  return [...textPages(),...parts];
 }
 if(['storyMap','mainIdea','checklist'].includes(layout))return [...textPages(),...rows(4)];
 if(layout==='dictogloss')return [{kind:layout}];
 if(layout==='venn')return rows(4);
 if(layout==='draw')return rows(2);
 if(layout==='map')return words(9);
 if(layout==='table')return rows(doc.tasks.some(r=>r.prompt.length>100)?3:6);
 if(layout==='survey')return rows(doc.tasks.some(r=>r.prompt.length>150)?2:doc.tasks.some(r=>r.prompt.length>70)?3:6);
 if(layout==='informationGap'){const perPage=doc.tasks.some(r=>r.prompt.length>200||r.answer.length>200)?2:doc.tasks.some(r=>r.prompt.length>100||r.answer.length>100)?3:6;return chunk(doc.tasks,perPage).flatMap((rs,i)=>['A','B'].map(role=>({kind:layout,rows:rs,role,offset:i*perPage})));}
 if(layout==='difference')return chunk(doc.words,9).flatMap((ws,i)=>['A','B'].map(role=>({kind:layout,words:ws.length<3?doc.words.slice(-3):ws,role,offset:i*9})));
 if(layout==='barrier')return chunk(doc.words,6).flatMap((ws,i)=>[{kind:layout,words:ws,role:'A',offset:i*6},{kind:layout,words:ws,role:'B',offset:i*6},{kind:'placementCards',words:ws,offset:i*6}]);
 if(layout==='roleplay')return rows(doc.tasks.some(r=>r.prompt.length+r.answer.length+r.detail.length>550)?1:2);
 if(layout==='ranking')return rows(6);
 if(layout==='jigsaw')return [...new Set(doc.tasks.map(r=>r.order))].flatMap(order=>chunk(doc.tasks.filter(r=>r.order===order),2).map(rs=>({kind:layout,rows:rs,role:String(order)})));
 if(layout==='pictureWrite')return rows(3);
 if(['expansion','paragraph','recount','opinion','form'].includes(layout))return rows(layout==='expansion'?2:4);
 if(layout==='comic')return rows(2);
 if(layout==='listenChoice')return words(3);
 if(layout==='listenColor')return words(4);
 if(layout==='dictation')return rows(6);
 if(layout==='bingo')return chunk(doc.words,doc.words.length>=8?8:4).map((ws,i)=>({kind:layout,words:ws.length>=4?ws:doc.words.slice(-Math.max(4,ws.length)),index:i}));
 if(layout==='memory')return chunk(doc.words.flatMap(w=>[{...w,partner:'picture'},{...w,partner:'word'}]),6).map(ws=>({kind:layout,words:ws}));
 if(layout==='domino')return words(8);
 if(layout==='crossword')return words(3);
 if(layout==='rollRead')return words(doc.words.some(w=>w.word.length>20)?18:36);
 if(layout==='walkDictation')return [...rows(6,'record'),...rows(6,'wallText')];
 if(layout==='readRoom')return [...words(8,'record'),...words(6,'wallPictures')];
 if(layout==='functional'){
  const data=doc.tasks.filter(r=>r.order!==1),questions=doc.tasks.filter(r=>r.order===1);
  return [...chunk(data,6).map(rs=>({kind:layout,rows:rs})),...chunk(questions,3).map(rs=>({kind:'questions',rows:rs}))];
 }
 if(layout==='poster')return rows(3);
 if(layout==='media')return [...textPages(),...rows(3,'questions')];
 if(layout==='kwl')return [{kind:layout,rows:doc.tasks}];
 if(layout==='rubric')return rows(6);
 if(layout==='exit')return rows(3);
 throw Error('missing_print_layout:'+layout);
}
