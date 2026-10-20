import i18n from '../i18n';
import type { FullCardItem, GameItem, GameTemplate, GameTemplateConfig, GameType } from './types';
import { GAME_CATALOG } from './gameCatalog';
import { prepareClassroomGame } from './gameWorkspace';
import { gamePreparation, isNativeGameReady } from './gamePreparation';
import { storySample, storyErrors, insertPhrase } from './storybook';
import { getSentencePattern } from './sentencePatterns';
import { ADVENTURE_TYPES, sampleAdventure, type AdventureType } from './adventureGames';

export type GuideKind = 'sample' | 'word' | 'sentence' | 'names';
export type GuideFamily = 'list' | 'sentence' | 'pairs' | 'quiz' | 'ox' | 'groups' | 'image' | 'builtin' | 'diagram' | 'slots' | 'monster' | 'bridge' | 'tower' | 'online';
export const GUIDE_FAMILIES: Partial<Record<GameType, GuideFamily>> = {
  wheel:'list',ladder:'list',order:'list',bomb:'list',timer:'builtin',tictactoe:'list',saveorgive:'list',findmissing:'list',baskin31:'list',connect4:'list',popcorn:'list',passball:'list',twodice:'list',quiz:'quiz',hangman:'list',truefalse:'ox',matchup:'pairs',whackamole:'pairs',flashcards:'pairs',anagram:'list',groupsort:'groups',unscramble:'sentence',typeanswer:'pairs',spellword:'list',rankorder:'list',wordsearch:'list',crossword:'list',mathgen:'builtin',mazechase:'list',airplane:'list',labeleddiagram:'diagram',imagequiz:'image',gameshowquiz:'quiz',winlosequiz:'quiz',watermelon:'slots',quizshow:'online',shopping:'builtin',treasuredig:'list',fourclues:'list',catchsentence:'sentence',lastbox:'list',mysterybox:'list',airport:'builtin',restaurant:'builtin',icecream:'builtin',doctor:'builtin',lightning:'sentence',sentencesplash:'sentence',shufflefind:'list',telepathy:'list',feedmonster:'monster',sentencebridge:'bridge',sentencetower:'tower',
};
/** New dedicated games keep their native editor until a guided schema is registered. */
export const guideFamily=(type:GameType):GuideFamily=>GUIDE_FAMILIES[type]||'builtin';
const BOTH = new Set<GameType>(['wheel','flashcards','typeanswer','treasuredig','catchsentence','lightning','lastbox','mysterybox','shufflefind','telepathy']);
export const NAME_GAMES = new Set<GameType>(['wheel','ladder','order','bomb','timer']);
export function guideKinds(type: GameType): GuideKind[] {
  const family = guideFamily(type);
  if(!GUIDE_FAMILIES[type])return ['sample',...gamePreparation(type).kinds];
  const kinds: GuideKind[] = ['sample'];
  if (!['builtin','bridge','tower'].includes(family)) kinds.push('word');
  if (type==='unscramble'||type==='sentencesplash') return ['sample','sentence'];
  if (BOTH.has(type)||family==='bridge'||family==='tower') kinds.push('sentence');
  if (NAME_GAMES.has(type)) kinds.push('names');
  return kinds;
}
export function guideCards(rows: string[][], previous: FullCardItem[] = []): FullCardItem[] {
  return rows.filter(r=>r[0]?.trim()).map((r,i)=>({ ...previous.find(c=>c.word===r[0].trim()), id:previous.find(c=>c.word===r[0].trim())?.id || `guide-${i}`, word:r[0].trim(), meaning:r[1]?.trim()||'', imageUrl:previous.find(c=>c.word===r[0].trim())?.imageUrl || null }));
}
export function guideRows(template: GameTemplate, kind: GuideKind): string[][] {
  const c=template.config, family=guideFamily(template.game_type);
  if(c.adventure){const a=c.adventure;switch(template.game_type){case 'balloonpop':case 'wordfishing':return a.words.map(w=>[w.word,w.meaning]);case 'wordtrain':case 'sentencerocket':return a.sentences.map(s=>[s.text,s.tokens.join(' | ')]);case 'grammardetective':return a.cases.map(s=>[s.incorrect,s.correct]);case 'treasurehunt':return a.clues.map(s=>[s.text]);case 'wordclaw':return a.missions.map(s=>[s.text,s.tag]);}}
  if(family==='pairs') return (template.game_type==='typeanswer'?c.typeAnswerEntries?.map(p=>({left:p.prompt,right:p.answer})):template.game_type==='flashcards'?c.flashcards:c.pairs||[] )?.map(p=>[p.left,p.right])||[];
  if(family==='quiz')return (c.questions||[]).map(q=>[q.question,q.choices[q.correctIndex]||'',...q.choices.filter((_,i)=>i!==q.correctIndex)]);
  if(family==='online')return (c.liveQuestions||[]).map(q=>[q.prompt,q.choices?.[q.correctIndex||0]||q.answer||'',...(q.choices?.filter((_,i)=>i!==q.correctIndex)||[])]);
  if(family==='ox')return (c.statements||[]).map(q=>[q.text,q.isTrue?'O':'X']);
  if(family==='groups')return (c.groups||[]).flatMap(g=>g.items.map(i=>[i.text,g.name]));
  if(family==='image')return (c.imageQuizItems||[]).map(i=>[i.answer,i.imageUrl]);
  if(family==='bridge'||family==='monster')return (c.storybook?.questions||[]).map(q=>[q.prompt,q.answer,...q.wrong]);
  if(family==='tower')return (c.storybook?.steps||[]).map(s=>[s.phrase,String(s.position),...s.wrong]);
  if(family==='diagram')return (c.diagramPins||[]).map(p=>[p.label,String(p.x),String(p.y)]);
  if(family==='slots')return template.items.map(i=>[i.label,i.slot||'subject']);
  if(kind==='names')return template.items.map(i=>[i.label]);
  return c.classroomSource?.cards.map(c=>[c.word,c.meaning])||template.items.map(i=>[i.label]);
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
  else if(family==='online')config.liveQuestions=usable.map((r,i)=>({id:id(i),kind:'choice',prompt:r[0]||'',choices:r.slice(1).filter(Boolean),correctIndex:0,points:1000,seconds:20}));
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
  if(kind!=='names'&&kind!=='sample'&&sourceFamilies.includes(family)){
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
