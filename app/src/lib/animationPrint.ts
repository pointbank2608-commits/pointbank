import type { VideoClip } from './videoClips';
import type { WordBankEntry } from './types';
import { sceneLesson, sceneQuestions, sceneTeaching } from './animationScene';
import { parseShadowText } from './shadowLines';
import { makeRng, shuffled } from './worksheetGenerators';
import { printableCrossword, type PrintCrossword } from './worksheetActivityPrinting';

export type PaperItem = {
  id: string; label: string; prompt?: string; answer?: string; lines?: number;
  meaning?: string; definition?: string; exampleSentence?: string; choices?: string[]; trace?: string; cue?: string; example?: boolean; image?: string;
  pictures?: string[]; puzzle?: PrintCrossword;
};
type Options = { letters: number; bank: boolean; chunks: boolean; pictureClues: boolean; choiceCount?: number };
type PrintActivity = { id: string; label: string; title: string; instruction: string; items: PaperItem[]; reason?: string };
type CuratedItem = { prompt: string; answer: string; options?: string[]; pictures?: string[]; cue?: string };
export type AnimationPrintContent = Partial<Record<'scene'|'trueFalse'|'eventOrder'|'infer'|'wordContext'|'substitute'|'create', CuratedItem[]>>;

const words = (text: string) => text.trim().split(/\s+/);
const clean = (text: string) => text.replace(/\*\*/g,'').trim();
const key = (text: string) => text.normalize('NFKC').trim().toLowerCase();
const regexEscape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const clock = (seconds: number) => {
  const tenths = Math.round(seconds * 10);
  return Math.floor(tenths / 600) + ':' + (tenths % 600 / 10).toFixed(1).padStart(4,'0');
};
const mix = <T,>(items: T[]) => {
  const result = shuffled(items,makeRng(83 + items.length));
  return result.every((value,index) => value === items[index]) ? [...result.slice(1),result[0]] : result;
};
const gap = '________________';
const unavailable = '이 영상에 해당 활동에 쓸 검토된 자료가 없어요.';
const wordMatch = (text: string) => new RegExp('\\b' + regexEscape(text) + '\\b','i');
export function animationPrintActivities(clip: VideoClip, bank: WordBankEntry[], options: Options): {id:string;title:string;en:string;types:PrintActivity[]}[] {
  const teaching=sceneTeaching(clip);
  const vocabulary = (clip.pack.words ?? []).map((entry,index) => {
    const matching = bank.filter(row => key(row.word) === key(entry.word) && key(row.meaning) === key(entry.meaning));
    const images = [...new Set(matching.flatMap(row => row.image_url ? [row.image_url] : []))];
    const reviewed = teaching.wordPictures?.[key(entry.word)+'|'+key(entry.meaning)];
    return {...entry, id:String(index), label:entry.word, image:entry.imageUrl || (reviewed ?? (images.length === 1 ? images[0] : undefined))};
  });
  const script = parseShadowText(clip.script).map((line,index) => ({
    ...line, id:String(index), label:clean(line.en), text:clean(line.en),
  }));
  const questions = sceneQuestions(clip).map((item,index) => ({...item,id:String(index),label:item.q}));
  const curated = {...teaching.print,...clip.pack.animationPrint};
  const grammar = clip.pack.grammar;
  const practice=sceneLesson(clip).expression;
  const wordRows = (fn: (entry: typeof vocabulary[number]) => Partial<PaperItem> | null) =>
    vocabulary.flatMap(entry => { const row = fn(entry); return row ? [{id:entry.id,label:entry.word,...row}] : []; });
  const questionRows = (fn: (entry: typeof questions[number]) => Partial<PaperItem> | null) =>
    questions.flatMap(entry => { const row = fn(entry); return row ? [{id:entry.id,label:entry.q,prompt:entry.q,answer:entry.a,cue:entry.time!==undefined&&entry.end!==undefined?clock(entry.time)+'–'+clock(entry.end):undefined,...row}] : []; });
  const lineRows = (items: typeof script, fn: (line: typeof script[number]) => Partial<PaperItem> | null) =>
    items.flatMap(line => { const row = fn(line); return row ? [{id:line.id,label:line.text,...row}] : []; });
  const verified = (type: keyof AnimationPrintContent): PaperItem[] =>
    (curated[type] ?? []).map((entry,index) => ({id:String(index),label:entry.prompt,prompt:entry.prompt+(entry.options?.length?'\n'+entry.options.join(' / '):''),answer:entry.answer,pictures:entry.pictures,cue:entry.cue,lines:entry.options?.length||entry.pictures?.length||type==='trueFalse'?0:2,example:type==='infer'||type==='create'||type==='substitute'}));
  const choice = (text: string, answer: string, alternative: string) =>
    text.replace(wordMatch(answer), '(' + mix([answer,alternative]).join(' / ') + ')');
  const markedGap = (line: typeof script[number]) => {
    const marked = line.en.match(/\*\*([^*]+)\*\*/)?.[1];
    const term = marked || [...vocabulary].sort((a,b)=>b.word.length-a.word.length).find(entry=>wordMatch(entry.word).test(line.text))?.word;
    if (!term || !wordMatch(term).test(line.text)) return null;
    const other = vocabulary.filter(entry=>key(entry.word)!==key(term)).slice(0,2).map(entry=>entry.word);
    return {prompt:line.text.replace(wordMatch(term),gap)+(options.bank?'\nWord Bank: '+mix([term,...other]).join(' · '):''),answer:line.text};
  };
  const sentenceStarter = (answer: string) => answer.match(/^(?:I|You|He|She|It|We|They|Mum|Dad) (?:am|is|are|was|were|can|will|have|has)\b/i)?.[0];
  const basicChoice = (line: typeof script[number]) => {
    const match = line.text.match(/^(I|you|he|she|it|we|they) (am|is|are)\b/i);
    if (!match) return null;
    const expected = /^i$/i.test(match[1])?'am':/^(he|she|it)$/i.test(match[1])?'is':'are';
    if (match[2].toLowerCase()!==expected) return null;
    return {prompt:choice(line.text,match[2],expected==='are'?'is':'are'),answer:line.text};
  };
  return [
    {id:'words',title:'단어 연습',en:'Vocabulary',types:[
      {id:'pictureMatch',label:'그림과 영어 단어 연결',title:'Picture Match',instruction:'Match each picture to its word.',items:wordRows(entry=>({image:entry.image,meaning:entry.meaning,answer:entry.word})),reason:'이 단어 목록에는 연결할 그림이 없어요.'},
      {id:'meaningMatch',label:'영어 단어와 한국어 뜻 연결',title:'Meaning Match',instruction:'Match each word to its meaning.',items:wordRows(entry=>entry.meaning?{answer:entry.meaning}:null)},
      {id:'wordTrace',label:'단어 따라쓰기',title:'Trace the Words',instruction:'Trace each word. Then write it on your own.',items:wordRows(entry=>({trace:entry.word,image:entry.image,answer:entry.word,lines:1}))},
      {id:'letters',label:'빠진 글자 채우기',title:'Missing Letters',instruction:'Complete the missing letters.',items:wordRows(entry=>entry.meaning&&/^[a-z]{3,}$/i.test(entry.word)?{meaning:entry.meaning,prompt:[...entry.word].map((letter,index)=>index>0&&index<=Math.min(options.letters,entry.word.length-2)?'_':letter).join(' '),answer:entry.word}:null)},
      {id:'fromMeaning',label:'뜻 보고 영단어 쓰기',title:'Write the English Word',instruction:'Read the meaning. Write the English word.',items:wordRows(entry=>entry.meaning?{prompt:entry.meaning,answer:entry.word,lines:1}:null)},
      {id:'meaning',label:'영단어 보고 뜻 쓰기',title:'Vocabulary',instruction:'Write the meaning.',items:wordRows(entry=>entry.meaning?{prompt:entry.word,answer:entry.meaning,lines:1}:null)},
      {id:'wordContext',label:'문장 속 단어 고르기',title:'Choose the Word',instruction:'Read and circle.',items:verified('wordContext')},
      {id:'crossword',label:'크로스워드 퍼즐',title:'Crossword',instruction:'Read the clues. Write one letter in each box.',items:wordRows(entry=>entry.meaning?{answer:entry.meaning,image:options.pictureClues?entry.image:undefined}:null)},
      {id:'wordScramble',label:'단어 스크램블',title:'Unscramble the Words',instruction:'Put the letters in order. Write the word.',items:wordRows(entry=>/^[a-z]+$/i.test(entry.word)&&new Set(key(entry.word)).size>1?{prompt:mix([...entry.word.toUpperCase()]).join(' ')+(entry.meaning?' · '+entry.meaning:''),pictures:options.pictureClues&&entry.image?[entry.image]:undefined,answer:entry.word,lines:1}:null)},
      {id:'study',label:'단어 학습표',title:'Words for the Scene',instruction:'Read the words and examples.',items:wordRows(entry=>entry.meaning&&(entry.example||teaching.definitions?.[entry.word])?{meaning:entry.meaning,definition:teaching.definitions?.[entry.word],exampleSentence:entry.example}:null)},
    ]},
    {id:'questions',title:'내용 질문',en:'Comprehension',types:[
      {id:'scene',label:'장면 그림 고르기',title:'Choose the Scene',instruction:'Read and circle the picture.',items:verified('scene')},
      {id:'questionChoice',label:'보기에서 답 고르기',title:'Choose the Answer',instruction:'Read and circle.',items:questionRows(entry=>{
        const alternatives=teaching.choices?.[entry.q]?.filter(value=>value.trim()&&key(value)!==key(entry.a))??[];
        const choices=mix([entry.a,...new Set(alternatives)].slice(0,options.choiceCount??3));
        return entry.a&&choices.length>=2?{choices,answer:String.fromCharCode(65+choices.indexOf(entry.a))+'. '+entry.a}:null;
      })},
      {id:'trueFalse',label:'참·거짓',title:'True or False',instruction:'Read and circle True or False.',items:verified('trueFalse').map(row=>({...row,prompt:row.prompt+'\nTrue / False'}))},
      {id:'eventOrder',label:'장면 순서 맞추기',title:'Put the Scenes in Order',instruction:'Number the events in order.',items:verified('eventOrder')},
      {id:'questionHint',label:'문장 힌트로 답하기',title:'Complete the Answer',instruction:'Use the sentence starter.',items:questionRows(entry=>{
        const starter=sentenceStarter(entry.a);
        return starter?{prompt:entry.q+'\n'+starter+' '+gap,lines:1}:null;
      })},
      {id:'questionFull',label:'완전문장으로 답하기',title:'Comprehension',instruction:'Answer in a full sentence.',items:questionRows(()=>({lines:2}))},
      {id:'infer',label:'이유·마음 짐작하기',title:'Think and Explain',instruction:'Use a clue from the video to explain your answer.',items:verified('infer')},
    ]},
    {id:'sentences',title:'문장 연습',en:'Sentences',types:[
      {id:'sentenceTrace',label:'문장 따라쓰기',title:'Trace the Sentences',instruction:'Trace the sentence. Then write it on your own.',items:lineRows(script,line=>({trace:line.text,lines:1,answer:line.text}))},
      {id:'readCircle',label:'읽고 괄호에서 고르기',title:'Read and Circle',instruction:'Read and circle.',items:lineRows(script,basicChoice)},
      {id:'sentenceGap',label:'문장 빈칸 채우기',title:'Complete the Sentence',instruction:'Read and complete the sentence.',items:lineRows(script,line=>{const row=markedGap(line);return row&&(line.ko||options.bank)?{...row,prompt:(line.ko?line.ko+'\n':'')+row.prompt}:null;})},
      {id:'sentenceScramble',label:'문장 스크램블 · 순서 맞추기',title:'Unscramble the Sentence',instruction:'Keep the first part. Put the other parts in order, then write the sentence.',items:lineRows(script,line=>{
        const parts=words(line.text.replace(/[.?!]$/,''));
        if (parts.length<4) return null;
        const first=parts.shift()!;
        const chunks=options.chunks?parts.reduce<string[]>((out,part,index)=>{if(index%2===0)out.push(part);else out[out.length-1]+=' '+part;return out;},[]):parts;
        return {prompt:first+'  |  '+mix(chunks.length<2?parts:chunks).join(' / '),answer:line.text,lines:2,example:true};
      })},
      {id:'grammarPractice',label:'대표 문법과 응용',title:'Use the Pattern',instruction:'Read the pattern. Try it in a new situation.',items:(practice?.examples??[]).slice(0,5).map((example,index)=>{
        const parts=words(example.answer);
        const missing=parts.pop()??'';
        const prefix=[practice?.original?'From the scene: '+practice.original:'Learning expression: '+practice?.text,practice?.explanation??'',example.situation];
        const alternative=practice?.examples.find(item=>item.answer!==example.answer)?.answer;
        const choices=index===0&&alternative?mix([example.answer,alternative]):undefined;
        const task=index===4?'Write your own sentence.':index===3?'Use these words: '+parts.slice(0,3).join(' '):index===0&&choices?'Choose the best sentence.':parts.join(' ')+' '+gap;
        return {id:'pattern-'+index,label:example.situation,prompt:[...prefix,task].join('\n'),choices,answer:choices?String.fromCharCode(65+choices.indexOf(example.answer))+'. '+example.answer:index>=3?example.answer:missing,lines:choices?0:index>=3?2:1,example:index>=3};
      })},
      {id:'substitute',label:'문장 일부 바꿔 쓰기',title:'Change Part of the Sentence',instruction:'Keep the pattern. Use the new words.',items:verified('substitute').concat((grammar?.drills??[]).flatMap((drill,index)=>{
        const replaced=grammar && drill.cue.trim() && wordMatch(drill.cue).test(drill.answer) && clean(drill.answer)!==clean(grammar.sentence);
        return replaced ? [{id:'drill-'+index,label:drill.answer,prompt:grammar.sentence+'\nUse: '+drill.cue,answer:drill.answer,lines:2,example:true}] : [];
      }))},
      {id:'create',label:'내 문장 만들기',title:'Write Your Own Sentence',instruction:'Use the pattern to write your own sentence.',items:[...verified('create'),...lineRows(script,line=>{
        const starter=sentenceStarter(line.text) ?? line.text.match(/^(?:there[’']s nothing wrong with being|I like|I want|Can we)\b/i)?.[0];
        return starter && key(line.text)!==key(starter)?{prompt:starter+' '+gap,answer:line.text,lines:2,example:true}:null;
      }).map(row=>({...row,id:'script-'+row.id}))]},
      {id:'translate',label:'한글 힌트 보고 영어 문장 쓰기',title:'Write the English Sentence',instruction:'Read the Korean clue. Write an English sentence.',items:lineRows(script,line=>line.ko?{prompt:line.ko,answer:line.text,lines:2,example:true}:null)},
    ]},
  ].map(group=>({...group,types:group.types.map(type=>({...type,reason:('reason' in type?type.reason:undefined)??unavailable}))}));
}

export function animationCrossword(items: PaperItem[]) {
  const words = items.filter(item=>/^[a-z]{2,16}$/i.test(item.label));
  let best: typeof words = [];
  let puzzle = printableCrossword([]);
  const orders=words.flatMap((first,index)=>[[first,...words.filter((_,i)=>i!==index)],[first,...words.filter((_,i)=>i!==index).reverse()]]);
  for (const order of orders) {
  let connected:typeof words=[];
  let current=printableCrossword([]);
  for (const item of order) {
    if (connected.some(row=>key(row.label)===key(item.label))) continue;
    const next = [...connected,item];
    const candidate = printableCrossword(next.map(row=>({id:row.id,word:row.label,meaning:row.answer??'',imageUrl:row.image??null})),true);
    const reachable = new Set([0]);
    let before: number;
    do {
      before=reachable.size;
      candidate.entries.forEach((entry,index)=>{
        if (reachable.has(index)) return;
        const intersects = [...reachable].some(i=>{
          const a=candidate.entries[i];
          if (a.dir===entry.dir) return false;
          const [across,down]=a.dir==='across'?[a,entry]:[entry,a];
          return across.row>=down.row && across.row<down.row+down.word.word.length && down.col>=across.col && down.col<across.col+across.word.word.length;
        });
        if (intersects) reachable.add(index);
      });
    } while(before!==reachable.size);
    if (reachable.size!==next.length || candidate.grid.length>17 || next.length>10) continue;
    connected=next;
    current=candidate;
  }
    if(connected.length>best.length && current.entries.some(entry=>entry.dir==='down')) {best=connected;puzzle=current;}
  }
  return {puzzle, included:new Set(best.map(row=>row.id))};
}
