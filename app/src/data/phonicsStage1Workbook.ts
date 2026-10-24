import { stage1Entry, stage1Sentence, type Stage1Page, type Stage1Unit } from './phonicsStage1';

export const stage1WorkbookOrder=<T,>(a:T[],n=1)=>[...a.slice(n),...a.slice(0,n)];
export const stage1TargetLetters=(u:Stage1Unit,id:string)=>{const e=stage1Entry(u,id);return (e.targets??[]).map(i=>e.word[i]).join('');};
export function stage1ListeningWords(u:Stage1Unit){
  return u.groups.length===3?[u.groups[0].entries[0],u.groups[1].entries[0],u.groups[2].entries[1],u.groups[0].entries[1],u.groups[1].entries[1],u.groups[2].entries[2]]
    :Array.from({length:6},(_,i)=>u.groups[0].entries[i%u.groups[0].entries.length]);
}
export function stage1SoundWriteWords(u:Stage1Unit){return u.groups.length===3?[u.groups[0].entries[2],u.groups[1].entries[1],u.groups[2].entries[0]]:u.groups[0].entries;}
export function stage1PageAnswers(unit:Stage1Unit,page:Stage1Page):{prompt:string;answer:string}[] {

  if(page.kind==='letters')return unit.groups.map(g=>({prompt:g.letter,answer:g.letter.toLowerCase()}));
  if(page.kind==='sound')return [...stage1ListeningWords(unit).map((e,i)=>({prompt:'A'+(i+1)+'. '+e.word,answer:stage1TargetLetters(unit,e.wordId!)})),...stage1SoundWriteWords(unit).map((e,i)=>({prompt:'B'+(i+7)+'. '+e.word,answer:stage1TargetLetters(unit,e.wordId!)}))];
  if(page.kind==='match')return unit.groups.flatMap(g=>g.entries.map((e,i)=>({prompt:g.letter+g.letter.toLowerCase()+': '+e.word,answer:'Picture '+(i+1)+' ('+(e.meaning??e.word)+')'})));
  if(page.kind==='write'){
    const g=unit.groups.find(g=>g.id===page.groupId)!;const index=unit.groups.indexOf(g);
    return (index===0?stage1WorkbookOrder(g.entries):g.entries).map((e,i)=>({prompt:(index===1?'Read aloud: ':'')+e.word,answer:index===0?stage1TargetLetters(unit,e.wordId!):index===1?'Picture '+(((i-1+g.entries.length)%g.entries.length)+1)+' (row '+(i+1)+')':e.word}));
  }
  if(page.kind==='reader')return unit.reader!.wordIds.map(id=>({prompt:stage1Sentence(unit,id),answer:'a (standalone word)'}));
  const rw=unit.reader!.wordIds;return [{prompt:'A1',answer:stage1Sentence(unit,rw[2])},{prompt:'A2',answer:stage1Sentence(unit,rw[3])},{prompt:'B1',answer:stage1Entry(unit,rw[0]).word},{prompt:'B2',answer:stage1Entry(unit,rw[1]).word},{prompt:'C',answer:rw.map(id=>stage1Sentence(unit,id)).join(' / ')}];
}
