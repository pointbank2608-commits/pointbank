import type { FullCardItem } from './types';
import { normalizeStory, shuffled } from './storybook';

export const ADVENTURE_TYPES = ['balloonpop', 'wordtrain', 'wordfishing', 'sentencerocket', 'grammardetective', 'treasurehunt', 'wordclaw'] as const;
export type AdventureType = typeof ADVENTURE_TYPES[number];
export const ADVENTURE_NAMES: Record<AdventureType, [string, string]> = {
  balloonpop: ['Balloon Pop', '풍선 터뜨리기'], wordtrain: ['Word Train', '문장 기차'],
  wordfishing: ['Word Fishing', '단어 낚시'], sentencerocket: ['Sentence Rocket', '문장 로켓 발사'],
  grammardetective: ['Grammar Detective', '문법 탐정'], treasurehunt: ['Treasure Hunt', '영어 보물찾기'],
  wordclaw: ['Word Claw Machine', '단어 뽑기'],
};
export interface AdventureWord { id: string; word: string; meaning: string; tags: string[] }
export interface AdventureSentence { id: string; text: string; tokens: string[] }
export interface DetectiveError { id: string; start: number; end: number; replacement: string; choices: string[] }
export interface DetectiveCase { id: string; incorrect: string; correct: string; errors: DetectiveError[]; accepted: string[]; explanation: string }
export const PLACE_ICONS = ['tree', 'palm', 'house', 'river', 'rock', 'chest', 'cave', 'bridge'] as const;
export interface IslandPlace { id: string; name: string; icon: typeof PLACE_ICONS[number]; x: number; y: number }
export const RELATIONS = ['at', 'under', 'above', 'left', 'right', 'behind'] as const;
export type Relation = typeof RELATIONS[number];
export const RELATION_NAMES: Record<Relation, string> = { at: '앞', under: '아래', above: '위', left: '왼쪽', right: '오른쪽', behind: '뒤' };
export interface IslandTarget { placeId: string; relation: Relation }
export interface IslandClue { id: string; text: string; answer: IslandTarget; wrong: IslandTarget[] }
export interface ClawMission { id: string; text: string; tag: string }
export interface AdventureConfig {
  version: 1;
  words: AdventureWord[];
  sentences: AdventureSentence[];
  cases: DetectiveCase[];
  places: IslandPlace[];
  clues: IslandClue[];
  missions: ClawMission[];
  count: number;
  choices: 3 | 4 | 5 | 6;
  speed: 'slow' | 'normal' | 'fast';
  seconds: number;
  sound: boolean;
  shuffle: boolean;
  listening: boolean;
  detectiveMode: 'choice' | 'type';
  caseSensitive: boolean;
  punctuationSensitive: boolean;
  simpleClaw: boolean;
}
export const adventureId = () => crypto.randomUUID();
export const wordKey = (value: string) => normalizeStory(value).normalize('NFKC').toLowerCase();
export function wordTokens(text: string): string[] { return text.trim().split(/\s+/u).filter(Boolean); }
export function sampleAdventure(type: AdventureType): AdventureConfig {
  const words = [ ['apple', '사과', 'noun,food'], ['banana', '바나나', 'noun,food'], ['monkey', '원숭이', 'noun,animal'], ['elephant', '코끼리', 'noun,animal'], ['pencil', '연필', 'noun'], ['milk', '우유', 'noun,food'] ];
  const text = ['The monkeys are eating bananas.', "I'd like to play with my friends.", 'We can help each other.', 'The little cat is under the table.'];
  const places: IslandPlace[] = [
    {id: 'big-tree', name: 'big tree', icon: 'tree', x: 24, y: 30},
    {id: 'small-tree', name: 'small tree', icon: 'palm', x: 72, y: 28},
    {id: 'house', name: 'house', icon: 'house', x: 25, y: 67},
    {id: 'rock', name: 'big rock', icon: 'rock', x: 72, y: 68},
  ];
  const clues: IslandClue[] = [
    {id: 'clue-1', text: 'Look under the big tree.', answer: {placeId: 'big-tree', relation: 'under'}, wrong: [{placeId: 'big-tree', relation: 'left'}, {placeId: 'small-tree', relation: 'under'}, {placeId: 'house', relation: 'at'}]},
    {id: 'clue-2', text: 'Go to the right of the house.', answer: {placeId: 'house', relation: 'right'}, wrong: [{placeId: 'house', relation: 'left'}, {placeId: 'rock', relation: 'under'}, {placeId: 'small-tree', relation: 'at'}]},
    {id: 'clue-3', text: 'Find the treasure behind the big rock.', answer: {placeId: 'rock', relation: 'behind'}, wrong: [{placeId: 'rock', relation: 'right'}, {placeId: 'big-tree', relation: 'under'}, {placeId: 'house', relation: 'at'}]},
  ];
  return {version: 1, words: type === 'wordclaw' ? [
    {id:'eat',word:'eat',meaning:'먹다',tags:['verb']}, {id:'apple',word:'apple',meaning:'사과',tags:['noun']},
    {id:'jump',word:'jump',meaning:'뛰다',tags:['verb']}, {id:'happy',word:'happy',meaning:'행복한',tags:['adjective']},
    {id:'run',word:'run',meaning:'달리다',tags:['verb']}, {id:'chair',word:'chair',meaning:'의자',tags:['noun']},
  ] : words.map(([word,meaning,tags])=>({id:adventureId(),word,meaning,tags:tags.split(',')})),
    sentences: type === 'sentencerocket' ? [
      {id:'rocket-1',text:'The monkey is eating a banana.',tokens:['The monkey','is eating','a banana.']},
      {id:'rocket-2',text:'My friends are playing in the park.',tokens:['My friends','are playing','in the park.']},
      {id:'rocket-3',text:'We read books after school.',tokens:['We','read books','after school.']},
    ] : text.map(sentence=>({id:adventureId(),text:sentence,tokens:wordTokens(sentence)})),
    cases: [
      {id:'case-1',incorrect:'She go to school every day.',correct:'She goes to school every day.',errors:[{id:'error-1',start:4,end:6,replacement:'goes',choices:['go','goes','going']}],accepted:[],explanation:'She와 함께 쓰는 현재형 동사에는 -s가 필요해요.'},
      {id:'case-2',incorrect:'They is happy.',correct:'They are happy.',errors:[{id:'error-2',start:5,end:7,replacement:'are',choices:['is','are','am']}],accepted:[],explanation:'They에는 are를 사용해요.'},
      {id:'case-3',incorrect:'He like apples and she like bananas.',correct:'He likes apples and she likes bananas.',errors:[{id:'error-3a',start:3,end:7,replacement:'likes',choices:['like','likes','liking']},{id:'error-3b',start:23,end:27,replacement:'likes',choices:['like','likes','liking']}],accepted:[],explanation:'반복되는 like를 각각 찾아 고쳐요.'},
    ], places, clues, missions:[{id:'verbs',text:'Find the verbs!',tag:'verb'}],
    count: type === 'wordclaw' ? 1 : 5, choices:4, speed:'slow',seconds:0,sound:true,shuffle:false,listening:false,
    detectiveMode:'choice',caseSensitive:true,punctuationSensitive:true,simpleClaw:false,
  };
}
export function importedAdventureWords(cards: FullCardItem[]): AdventureWord[] {
  return cards.filter(c=>c.word.trim()).map(c=>({id:adventureId(),word:c.word.trim(),meaning:c.meaning.trim(),tags:[c.category,c.partOfSpeech].filter((s):s is string=>!!s?.trim()).map(s=>s.trim())}));
}
export function detectiveSentence(c: DetectiveCase, edits: Record<string,string>): string {
  let value=c.incorrect;
  for(const range of [...c.errors].sort((a,b)=>b.start-a.start)) value=value.slice(0,range.start)+(edits[range.id] ?? value.slice(range.start,range.end))+value.slice(range.end);
  return value;
}
export function normalizedCorrection(text: string,c: Pick<AdventureConfig,'caseSensitive'|'punctuationSensitive'>): string {
  let value=normalizeStory(text).normalize('NFKC');
  if(!c.caseSensitive)value=value.toLowerCase();
  if(!c.punctuationSensitive)value=value.replace(/[.,!?;:"“”‘’'()-]/gu,'');
  return normalizeStory(value);
}
export function correctionAccepted(value: string, item: DetectiveCase, c: AdventureConfig): boolean {
  return [item.correct,...item.accepted].some(answer=>normalizedCorrection(answer,c)===normalizedCorrection(value,c));
}
export function targetKey(target: IslandTarget): string { return `${target.placeId}:${target.relation}`; }
export function targetPoint(target: IslandTarget,places: IslandPlace[]): {x:number;y:number} {
  const place=places.find(p=>p.id===target.placeId);
  const [dx,dy]=({at:[0,5],under:[0,13],above:[0,-14],left:[-12,0],right:[12,0],behind:[0,-7]} as const)[target.relation] || [0,0];
  return {x:(place?.x || 0)+dx,y:(place?.y || 0)+dy};
}
export function adventureSeconds(type: AdventureType,c: AdventureConfig): number {
  return type==='balloonpop' && c.seconds ? {slow:45,normal:30,fast:20}[c.speed] : c.seconds;
}
export function adventureErrors(type: AdventureType,c: AdventureConfig): string[] {
  const out:string[]=[];
  if(!Number.isInteger(c.count)||c.count<1||c.count>50)out.push('문제 개수는 1~50개로 입력해 주세요.');
  if(![0,20,30,45,60,90].includes(c.seconds))out.push('제한 시간을 다시 선택해 주세요.');
  if(type==='balloonpop'||type==='wordfishing'||type==='wordclaw'){
    const unique=new Set(c.words.map(w=>wordKey(w.word)));
    if(c.words.some(w=>!w.word.trim()||((type==='balloonpop'||type==='wordfishing')&&!w.meaning.trim())))out.push('영어 단어와 뜻을 빠짐없이 입력해 주세요.');
    if(type==='wordclaw'){
      if(c.words.length<2||c.words.length>12||unique.size!==c.words.length)out.push('뽑기에는 서로 다른 단어 2~12개를 사용해 주세요.');
      if(!c.missions.length||c.missions.some(m=>!m.text.trim()||!m.tag.trim()||!c.words.some(w=>w.tags.some(t=>wordKey(t)===wordKey(m.tag)))||c.words.every(w=>w.tags.some(t=>wordKey(t)===wordKey(m.tag)))))out.push('미션의 문장·태그와 정답 단어, 다른 분류의 단어가 필요해요.');
    }else{
      if(![3,4,5,6].includes(c.choices)||unique.size<c.choices)out.push(`서로 다른 영어 단어가 최소 ${c.choices}개 필요해요. 보기 개수를 줄이거나 단어를 추가하세요.`);
      if(c.words.some(w=>!c.words.some(other=>wordKey(other.meaning)!==wordKey(w.meaning))))out.push('서로 다른 뜻의 단어도 등록해 주세요. 같은 뜻의 단어는 모두 정답으로 인정해요.');
    }
  }
  if(type==='wordtrain'||type==='sentencerocket'){
    if(!c.sentences.length)out.push('영어 문장을 최소 1개 입력해 주세요. 각 문장은 블록이 2개 이상 필요해요.');
    c.sentences.forEach((s,i)=>{if(!s.text.trim()||s.tokens.length<2||s.tokens.some(t=>!t.trim())||normalizeStory(s.tokens.join(' '))!==normalizeStory(s.text))out.push(`${i+1}번: 블록을 순서대로 합친 문장이 원문과 일치해야 해요. 대소문자·문장부호를 확인하세요.`);});
  }
  if(type==='grammardetective'){
    if(!c.cases.length)out.push('틀린 문장과 올바른 문장을 한 쌍 이상 입력해 주세요.');
    c.cases.forEach((item,i)=>{
      if(!item.incorrect.trim()||!item.correct.trim()){
        out.push(`${i+1}번: 틀린 문장과 올바른 문장을 모두 입력해 주세요. 최소 한 쌍이 필요해요.`);
        return;
      }
      const ranges=[...item.errors].sort((a,b)=>a.start-b.start);
      if(new Set(ranges.map(r=>r.id)).size!==ranges.length)out.push(`${i+1}번: 오류 식별자가 중복돼요. 오류 범위를 다시 지정하세요.`);
      if(c.detectiveMode==='choice'&&ranges.some(r=>r.choices.some(v=>!v.trim())))out.push(`${i+1}번: 빈 선택지를 지우거나 채워 주세요.`);
      if(!item.incorrect.trim()||!item.correct.trim()||!ranges.length||ranges.some((e,j)=>!Number.isInteger(e.start)||!Number.isInteger(e.end)||e.start<0||e.end>item.incorrect.length||e.start>=e.end||!e.replacement.trim()||(j>0&&ranges[j-1].end>e.start)||(c.detectiveMode==='choice'&&(e.choices.length<2||!e.choices.includes(e.replacement)||new Set(e.choices.map(normalizeStory)).size!==e.choices.length))))out.push(`${i+1}번: 오류 범위와 정답·수정 선택지를 확인하세요. 범위는 겹칠 수 없어요.`);
      const repaired=detectiveSentence(item,Object.fromEntries(ranges.map(e=>[e.id,e.replacement])));
      if(normalizeStory(repaired)!==normalizeStory(item.correct))out.push(`${i+1}번: 지정한 범위를 고친 결과가 전체 정답 문장과 일치하지 않아요.`);
    });
  }
  if(type==='treasurehunt'){
    if(!c.clues.length||!c.places.length)out.push('지도 장소와 영어 힌트를 등록해 주세요.');
    if(c.places.some((p,i)=>c.places.some((q,j)=>i!==j&&Math.hypot(p.x-q.x,p.y-q.y)<16)))out.push('지도 장소가 겹쳐요. 장소 사이를 더 넓혀 주세요.');
    if(c.places.some(p=>!p.name.trim()||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<14||p.x>86||p.y<18||p.y>78||!PLACE_ICONS.includes(p.icon)))out.push('장소 이름과 위치를 확인해 주세요. 지도 가장자리에서 안쪽으로 배치하세요.');
    c.clues.forEach((clue,i)=>{
      const targets=[clue.answer,...clue.wrong];
      if(!clue.text.trim()||clue.wrong.length<1||targets.length>8||targets.some(t=>!c.places.some(p=>p.id===t.placeId)||!RELATIONS.includes(t.relation))||new Set(targets.map(targetKey)).size!==targets.length)out.push(`${i+1}번: 힌트와 서로 다른 정답·오답 지점을 지정하세요.`);
      const points=targets.map(t=>targetPoint(t,c.places));
      if(points.some((p,j)=>points.some((q,k)=>j!==k&&Math.hypot(p.x-q.x,p.y-q.y)<7)))out.push(`${i+1}번: 클릭 지점이 겹쳐요. 장소나 지점의 위치를 바꿔 주세요.`);
    });
  }
  for(const rows of [c.words,c.sentences,c.cases,c.places,c.clues,c.missions])if(new Set(rows.map(r=>r.id)).size!==rows.length)out.push('항목 식별자가 중복돼요. 해당 항목을 다시 추가해 주세요.');
  return [...new Set(out)];
}
export type AdventureRound =
 | {kind:'vocab';id:string;word:AdventureWord;choices:AdventureWord[];accepted:string[]}
 | {kind:'sentence';id:string;sentence:AdventureSentence}
 | {kind:'case';id:string;item:DetectiveCase}
 | {kind:'clue';id:string;clue:IslandClue}
 | {kind:'mission';id:string;mission:ClawMission};
export function adventureRounds(type: AdventureType,c: AdventureConfig): AdventureRound[] {
  let rows:AdventureRound[];
  if(type==='balloonpop'||type==='wordfishing'){
    const pool=[...new Map(c.words.map(w=>[wordKey(w.word),w])).values()];
    rows=c.words.map(word=>({kind:'vocab',id:word.id,word,choices:shuffled([word,...shuffled(pool.filter(w=>wordKey(w.word)!==wordKey(word.word))).slice(0,c.choices-1)]),accepted:c.words.filter(w=>wordKey(w.meaning)===wordKey(word.meaning)).map(w=>wordKey(w.word))}));
  }else if(type==='wordtrain'||type==='sentencerocket')rows=c.sentences.map(sentence=>({kind:'sentence',id:sentence.id,sentence}));
  else if(type==='grammardetective')rows=c.cases.map(item=>({kind:'case',id:item.id,item}));
  else if(type==='treasurehunt')rows=c.clues.map(clue=>({kind:'clue',id:clue.id,clue}));
  else rows=c.missions.map(mission=>({kind:'mission',id:mission.id,mission}));
  return (c.shuffle?shuffled(rows):rows).slice(0,c.count);
}
export function sentencePieces(sentence: AdventureSentence) { return sentence.tokens.map((text,index)=>({id:`${sentence.id}:${index}`,text,index})); }
export function sentenceOrderCorrect(sentence: AdventureSentence,ids:string[]):boolean {
  const pieces=sentencePieces(sentence),byId=new Map(pieces.map(p=>[p.id,p.text]));
  return ids.length===pieces.length&&new Set(ids).size===pieces.length&&normalizeStory(ids.map(id=>byId.get(id) || '').join(' '))===normalizeStory(sentence.text);
}
export function adventureSource(type: AdventureType,cards:FullCardItem[]):AdventureConfig|null {
  const c=sampleAdventure(type);
  if(type==='balloonpop'||type==='wordfishing'){
    c.words=importedAdventureWords(cards);c.choices=Math.min(4,new Set(c.words.map(w=>wordKey(w.word))).size) as AdventureConfig['choices'];
  }else if(type==='wordtrain')c.sentences=cards.filter(w=>wordTokens(w.word).length>1).map(w=>({id:adventureId(),text:w.word,tokens:wordTokens(w.word)}));
  else return null; // Grammar, chunks, map relations and tags always require teacher confirmation.
  return adventureErrors(type,c).length?null:c;
}
