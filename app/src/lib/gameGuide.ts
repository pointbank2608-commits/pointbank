import i18n from '../i18n';
import type { LiveQuestion, FullCardItem, GameItem, GameTemplate, GameTemplateConfig, GameType } from './types';
import { GAME_CATALOG } from './gameCatalog';
import { prepareClassroomGame } from './gameWorkspace';
import { gamePreparation, isNativeGameReady } from './gamePreparation';
import { storySample, storyErrors, insertPhrase } from './storybook';
import { getSentencePattern } from './sentencePatterns';
import { ADVENTURE_TYPES, sampleAdventure, type AdventureType } from './adventureGames';

export type GuideKind = 'sample' | 'word' | 'sentence' | 'names' | 'numbers';
export type GuideFamily = 'list' | 'sentence' | 'pairs' | 'quiz' | 'ox' | 'groups' | 'image' | 'builtin' | 'diagram' | 'slots' | 'monster' | 'bridge' | 'tower' | 'online';
export const GUIDE_FAMILIES: Partial<Record<GameType, GuideFamily>> = {
  wheel:'list',ladder:'list',order:'list',bomb:'list',timer:'builtin',tictactoe:'list',saveorgive:'list',findmissing:'list',baskin31:'list',connect4:'list',popcorn:'list',passball:'list',twodice:'list',quiz:'quiz',hangman:'list',truefalse:'ox',matchup:'pairs',whackamole:'pairs',flashcards:'pairs',anagram:'list',groupsort:'groups',unscramble:'sentence',typeanswer:'pairs',spellword:'list',rankorder:'list',wordsearch:'list',crossword:'list',mathgen:'builtin',mazechase:'list',airplane:'list',labeleddiagram:'diagram',imagequiz:'image',gameshowquiz:'quiz',winlosequiz:'quiz',watermelon:'slots',quizshow:'online',shopping:'builtin',treasuredig:'list',fourclues:'list',catchsentence:'sentence',lastbox:'list',mysterybox:'list',airport:'builtin',restaurant:'builtin',icecream:'builtin',doctor:'builtin',lightning:'sentence',sentencesplash:'sentence',shufflefind:'list',telepathy:'list',feedmonster:'monster',sentencebridge:'bridge',sentencetower:'tower',
};
/** New dedicated games keep their native editor until a guided schema is registered. */
export const guideFamily=(type:GameType):GuideFamily=>GUIDE_FAMILIES[type]||'builtin';
const BOTH = new Set<GameType>(['wheel','flashcards','typeanswer','treasuredig','catchsentence','lightning','lastbox','mysterybox','shufflefind','telepathy','passball']);
export const NAME_GAMES = new Set<GameType>(['wheel','ladder','order','bomb','timer']);
/** 숫자 범위로 항목을 채울 수 있는 게임(랜덤 공 뽑기) */
export const NUMBER_GAMES = new Set<GameType>(['order']);
export function guideKinds(type: GameType): GuideKind[] {
  const family = guideFamily(type);
  if(!GUIDE_FAMILIES[type])return ['sample',...gamePreparation(type).kinds];
  const kinds: GuideKind[] = ['sample'];
  if (!['builtin','bridge','tower'].includes(family)) kinds.push('word');
  if (type==='unscramble'||type==='sentencesplash') return ['sample','sentence'];
  if (BOTH.has(type)||family==='bridge'||family==='tower') kinds.push('sentence');
  if (NAME_GAMES.has(type)) kinds.push('names');
  if (NUMBER_GAMES.has(type)) kinds.push('numbers');
  return kinds;
}
/** 단어장에 "word = 뜻" 한 줄로만 저장된 항목(뜻 칸이 비어 있음)은 낱말과 뜻으로 나눠 준다. */
export function splitCards(cards: FullCardItem[]): FullCardItem[] {
  return cards.map(c => {
    if (c.meaning?.trim()) return c;
    const m = c.word.match(/^(.+?)\s+[=＝]\s+(.+)$/);
    return m ? { ...c, word: m[1].trim(), meaning: m[2].trim() } : c;
  });
}
const scriptOf = (t: string) => (/[가-힣]/.test(t) ? 'ko' : /[A-Za-z]/.test(t) ? 'en' : 'etc');
const sentenceLike = (t: string) => t.length > 14 || /[.!?"]|\s.*\s.*\s/.test(t);
/** 정답과 얼마나 닮았는지(작을수록 닮음): 글자 종류·문장 여부·길이·품사 어미·쉼표 */
function likeness(answer: string, cand: string): number {
  let d = Math.abs(answer.length - cand.length) * 2;
  if (scriptOf(answer) !== scriptOf(cand)) d += 40;
  if (sentenceLike(answer) !== sentenceLike(cand)) d += 30;
  if (answer.slice(-1) === cand.slice(-1)) d -= 3;
  if (answer.includes(',') !== cand.includes(',')) d += 4;
  return d;
}
/** 문제·정답만 있고 오답이 비어 있는 줄은, 다른 줄의 정답 가운데 정답과 닮은 것(같은 글자 종류·비슷한 길이·문장이 아닌 것)을 오답으로 채운다(단어장에서 가져온 문제 등). 이미 적은 오답은 그대로 둔다. */
export function fillDistractors(rows: string[][], want = 2): string[][] {
  const answers = [...new Set(rows.map(r => r[1]?.trim() || '').filter(Boolean))];
  return rows.map((row) => {
    if (!row[0]?.trim() || !row[1]?.trim()) return row;
    const wrong = row.slice(2).map(s => s.trim()).filter(Boolean);
    if (wrong.length) return row;
    const answer = row[1].trim();
    const ranked = answers
      .filter(a => a.toLowerCase() !== answer.toLowerCase())
      .map(a => ({ a, d: likeness(answer, a) + Math.random() * 6 }))
      .sort((x, y) => x.d - y.d);
    // 너무 안 닮은 것(글자 종류·문장 여부가 다른 것)은 쓰지 않는다. 후보가 모자라면 그만큼만 채운다.
    const picked = ranked.filter(x => x.d < 30).slice(0, want).map(x => x.a);
    return [row[0], row[1], ...picked];
  });
}
export function guideCards(rows: string[][], previous: FullCardItem[] = []): FullCardItem[] {
  return rows.filter(r=>r[0]?.trim()).map((r,i)=>({ ...previous.find(c=>c.word===r[0].trim()), id:previous.find(c=>c.word===r[0].trim())?.id || `guide-${i}`, word:r[0].trim(), meaning:r[1]?.trim()||'', imageUrl:previous.find(c=>c.word===r[0].trim())?.imageUrl || null }));
}
export function guideRows(template: GameTemplate, kind: GuideKind): string[][] {
  const c=template.config, family=guideFamily(template.game_type);
  if(c.adventure){const a=c.adventure;switch(template.game_type){case 'balloonpop':case 'wordfishing':return a.words.map(w=>[w.word,w.meaning]);case 'wordtrain':case 'sentencerocket':return a.sentences.map(s=>[s.text,s.tokens.join(' | ')]);case 'grammardetective':return a.cases.map(s=>[s.incorrect,s.correct]);case 'treasurehunt':return a.clues.map(s=>[s.text]);case 'wordclaw':return a.missions.map(s=>[s.text,s.tag]);}}
  if(family==='pairs') return (template.game_type==='typeanswer'?c.typeAnswerEntries?.map(p=>({left:p.prompt,right:p.answer})):template.game_type==='flashcards'?c.flashcards:c.pairs||[] )?.map(p=>[p.left,p.right])||[];
  if(family==='quiz')return (c.questions||[]).map(q=>[q.question,q.choices[q.correctIndex]||'',...q.choices.filter((_,i)=>i!==q.correctIndex)]);
  if(family==='online')return (c.liveQuestions||[]).filter(q=>q.kind==='choice'&&q.choices?.length).map(q=>[q.prompt,q.choices?.[q.correctIndex||0]||'',...(q.choices?.filter((_,i)=>i!==(q.correctIndex||0))||[])]);
  if(family==='ox')return (c.statements||[]).map(q=>[q.text,q.isTrue?'O':'X']);
  if(family==='groups')return (c.groups||[]).flatMap(g=>g.items.map(i=>[i.text,g.name]));
  if(family==='image')return (c.imageQuizItems||[]).map(i=>[i.answer,i.imageUrl]);
  if(family==='bridge'||family==='monster')return (c.storybook?.questions||[]).map(q=>[q.prompt,q.answer,...q.wrong]);
  if(family==='tower')return (c.storybook?.steps||[]).map(s=>[s.phrase,String(s.position),...s.wrong]);
  if(family==='diagram')return (c.diagramPins||[]).map(p=>[p.label,String(p.x),String(p.y)]);
  if(family==='slots')return template.items.map(i=>[i.label,i.slot||'subject']);
  if(kind==='names'||kind==='numbers')return template.items.map(i=>[i.label]);
  return c.classroomSource?.cards.map(c=>[c.word,c.meaning])||template.items.map(i=>[i.label]);
}
/** 휴대폰 참여 퀴즈의 "고르기" 줄만 이 화면에서 고친다. O·X·쓰기·부저 문제와 라운드·그림·듣기 같은 부가 정보는 그대로 두고, 고친 줄만 같은 문제에 덮어쓴다. */
function mergeLiveRows(prev: LiveQuestion[], rows: string[][]): LiveQuestion[] {
  const left = rows.map((r, i) => ({ r, i, used: false }));
  const out: LiveQuestion[] = [];
  for (const q of prev) {
    if (q.kind !== 'choice' || !q.choices?.length) { out.push(q); continue; }
    const hit = left.find(x => !x.used && x.r[0] === q.prompt);
    if (!hit) continue;
    hit.used = true;
    out.push({ ...q, prompt: hit.r[0] || '', choices: hit.r.slice(1).filter(Boolean), correctIndex: 0 });
  }
  for (const x of left) {
    if (x.used) continue;
    out.push({ id: `guide-${x.i}`, kind: 'choice', prompt: x.r[0] || '', choices: x.r.slice(1).filter(Boolean), correctIndex: 0, points: 1000, seconds: 20 });
  }
  return out;
}
export function guideContent(type: GameType, rows: string[][], kind: GuideKind, base: GameTemplateConfig, start = ''): {items:GameItem[];config:GameTemplateConfig} {
  const family=guideFamily(type), usable=rows.filter(r=>r.some(s=>s.trim())).map(r=>r.map(s=>s.trim()));
  const items=usable.filter(r=>r[0]).map((r,i)=>({id:`guide-${i}`,label:r[0]}));
  const config={...base};delete config.classroomSource;
  const id=(i:number)=>`guide-${i}`;
  if(family==='pairs') {
    const pairs=usable.map((r,i)=>({id:id(i),left:r[0]||'',right:r[1]||''}));
    if(type==='typeanswer')config.typeAnswerEntries=pairs.map(p=>({id:p.id,prompt:p.left,answer:p.right}));
    else if(type==='flashcards')config.flashcards=pairs;else config.pairs=pairs;
  } else if(family==='quiz')config.questions=usable.map((r,i)=>({id:id(i),question:r[0]||'',choices:r.slice(1).filter(Boolean),correctIndex:0}));
  else if(family==='online')config.liveQuestions=mergeLiveRows(base.liveQuestions||[],usable);
  else if(family==='ox')config.statements=usable.map((r,i)=>({id:id(i),text:r[0]||'',isTrue:r[1]?.toUpperCase()==='O'}));
  else if(family==='groups')config.groups=[...new Set(usable.map(r=>r[1]))].map((name,i)=>({id:id(i),name:name||'',items:usable.filter(r=>r[1]===name).map((r,j)=>({id:`${i}-${j}`,text:r[0]||''}))}));
  else if(family==='image')config.imageQuizItems=usable.map((r,i)=>({id:id(i),answer:r[0]||'',imageUrl:r[1]||''}));
  else if(family==='diagram')config.diagramPins=usable.map((r,i)=>({id:id(i),label:r[0]||'',x:Number(r[1]),y:Number(r[2])}));
  else if(family==='slots')return {items:usable.map((r,i)=>({id:id(i),label:r[0]||'',slot:r[1]||''})),config};
  else if(family==='bridge'||family==='monster')config.storybook={...(base.storybook||storySample(type==='sentencebridge'?'sentencebridge':'feedmonster')),mode:family==='monster'?'sentence':'sentence',count:usable.length,questions:usable.map((r,i)=>({id:id(i),prompt:r[0]||'',answer:r[1]||'',wrong:r.slice(2).filter(Boolean)}))};
  else if(family==='tower'){
    let previous=start;
    const steps=usable.map((r,i)=>{const position=Number(r[1]);const sentence=insertPhrase(previous,r[0]||'',position);previous=sentence;return{id:id(i),phrase:r[0]||'',position,sentence,wrong:r.slice(2).filter(Boolean)};});
    config.storybook={...(base.storybook||storySample('sentencetower')),start,steps,count:steps.length};
  }
  if(kind==='names'&&type==='ladder')config.results=items.map((i,index)=>({id:i.id,label:base.results?.[index]?.label||String(index+1)}));
  const sourceFamilies=['list','sentence','pairs','groups','image'];
  if(kind!=='names'&&kind!=='numbers'&&kind!=='sample'&&sourceFamilies.includes(family)){
    const cards=family==='pairs'&&type==='typeanswer'?guideCards(usable.map(r=>[r[1],r[0]]),base.classroomSource?.cards):guideCards(usable,base.classroomSource?.cards);
    if(family==='groups')cards.forEach((c,i)=>{c.category=usable[i][1];c.meaning=base.classroomSource?.cards.find(previous=>previous.word===c.word)?.meaning||'';});
    if(family==='image')cards.forEach((c,i)=>{c.imageUrl=usable[i][1];c.meaning=base.classroomSource?.cards.find(previous=>previous.word===c.word)?.meaning||'';});
    // Only claim a reusable source if the native content really derives from it.
    if(prepareClassroomGame(type,cards,kind==='sentence'?'sentence':'word'))config.classroomSource={id:'composition',name:base.classroomSource?.name||'',kind:kind==='sentence'?'sentence':'word',version:'',cards};
  }
  if(['quiz','online'].includes(family)&&base.classroomSource){
    const original=base.classroomSource;
    const selected=usable.map(row=>original.cards.find(card=>card.word===row[0]&&card.meaning===row[1]));
    if(selected.length&&selected.every(Boolean))config.classroomSource={...original,cards:structuredClone(selected as FullCardItem[])};
  }
  // Native question/pin structures must not masquerade as a plain word list.
  return {items:['quiz','online','ox','diagram','bridge','tower','monster'].includes(family)?[]:items,config};
}
export function guideProblem(template:GameTemplate): string | null {
  const type=template.game_type,c=template.config;
  if(type==='ladder'&&c.results&&(c.results.length!==template.items.length||c.results.some(r=>!r.label.trim())))return 'ladderIncomplete';
  if(['feedmonster','sentencebridge','sentencetower'].includes(type)&&c.storybook){if(storyErrors(type as 'feedmonster',c.storybook).length)return 'story';}
  if(type==='watermelon'){
    const slots=getSentencePattern(c.watermelonPatternId||'svo').slots;
    if(slots.some(slot=>!template.items.some(i=>i.slot===slot&&i.label.trim())))return 'incomplete';
  }
  if(type==='labeleddiagram'&&(!c.diagramImageUrl||!c.diagramPins?.length||c.diagramPins.some(p=>!p.label.trim()||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)))return 'incomplete';
  if(type==='wordsearch'||type==='crossword'){
    if(template.items.some(i=>i.label.replace(/\s/g,'').length<2||(type==='wordsearch'&&i.label.replace(/\s/g,'').length>14)))return 'letters';
    if(new Set(template.items.map(i=>i.label.replace(/\s/g,'').toLowerCase())).size!==template.items.length)return 'duplicate';
  }
  if(['hangman','spellword','anagram'].includes(type)&&template.items.some(i=>!/[a-z]/i.test(i.label)||/[^a-z '-]/i.test(i.label)))return 'alphabet';
  if(['matchup','whackamole'].includes(type)){
    const pairs=c.pairs||[];if(new Set(pairs.map(p=>p.left.toLowerCase().trim())).size!==pairs.length||new Set(pairs.map(p=>p.right.toLowerCase().trim())).size!==pairs.length)return 'duplicate';
  }
  return isNativeGameReady(template)?null:'incomplete';
}
export function guideSample(type:GameType, template:GameTemplate):{items:GameItem[];config:GameTemplateConfig} {
  if((ADVENTURE_TYPES as readonly string[]).includes(type))return {items:[],config:{...template.config,adventure:sampleAdventure(type as AdventureType)}};
  if(type==='labeleddiagram')return {items:[],config:{...template.config,diagramImageUrl:'/word-bank-images/apple.webp',diagramPins:[{id:'sample-apple',label:'apple',x:.5,y:.5}]}};
  if(type==='watermelon')return {items:[{id:'sample-s',label:'I',slot:'subject'},{id:'sample-v',label:'like',slot:'verb'},{id:'sample-o',label:'apples',slot:'object'}],config:{...template.config,watermelonPatternId:'svo'}};
  if(['feedmonster','sentencebridge','sentencetower'].includes(type))return {items:[],config:{...template.config,storybook:storySample(type as 'feedmonster')}};
  if(type==='ladder')return {items:Array.from({length:6},(_,i)=>({id:`sample-person-${i}`,label:i18n.t('gameLadder.defaultParticipant',{n:i+1})})),config:{...template.config,results:Array.from({length:6},(_,i)=>({id:`sample-result-${i}`,label:i<2?i18n.t('gameLadder.defaultResult',{n:i+1}):i18n.t('guide.ladder.miss')})),ladderResultOrder:'input'}};
  const cards=['apple','banana','cat','dog','book','sun'].map((word,i)=>({id:`sample-${i}`,word,meaning:['사과','바나나','고양이','강아지','책','해'][i],imageUrl:`/word-bank-images/${word}.webp`,category:i<2?'fruit':'other'}));
  const sentence=['unscramble','sentencesplash'].includes(type);
  const source=sentence?cards.map((c,i)=>({...c,word:['I like apples.','She has a cat.','They play soccer.','We read books.','He likes dogs.','You are happy.'][i]})):cards;
  const content=prepareClassroomGame(type,source,sentence?'sentence':'word');
  return content?{items:content.items,config:{...template.config,...content.config,classroomSource:{id:'sample',name:'',kind:sentence?'sentence':'word',version:'',cards:source}}}:{items:template.items,config:template.config};
}
export const guideCatalogue = (kind:GuideKind)=>GAME_CATALOG.filter(g=>guideKinds(g.type).includes(kind));
