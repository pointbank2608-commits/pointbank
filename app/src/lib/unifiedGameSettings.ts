import { GAME_CATALOG } from './gameCatalog';
import { guideContent, guideFamily, guideProblem, guideRows } from './gameGuide';
import { isSentenceList, prepareClassroomGame } from './gameWorkspace';
import { wordListToCards } from './gameFromWords';
import { ADVENTURE_TYPES, sampleAdventure, wordTokens, targetKey, type AdventureType, type IslandTarget } from './adventureGames';
import { caseFromCorrect, detectiveSuggestion } from './detectiveSuggestion';
import { buildContestQuestions, contestRoundNames } from './liveQuiz';
import { buildQuizQuestions, buildTrueFalseStatements } from './quizFromWordList';
import i18n from '../i18n';
import type { FullCardItem, GameTemplate, GameTemplateConfig, GameType, LiveQuestion, WordList } from './types';

const TOOLS = new Set<GameType>(['wheel', 'ladder', 'order', 'timer', 'twodice', 'mathgen']);
/** Keep speaking, roleplay, phonics and other grammar games on their existing paths. */
export function usesUnifiedGameSettings(type?: GameType) {
  if (!type || TOOLS.has(type)) return false;
  if (type.startsWith('grammar')) return type === 'grammardetective';
  const game = GAME_CATALOG.find(game => game.type === type);
  return !!game && game.category !== 'speaking' && game.category !== 'roleplay';
}

export type GameEditRow = { id: string; cells: string[]; original?: number; card?: FullCardItem; live?: LiveQuestion };
export type GameEditDraft = { kind: 'word' | 'sentence'; name: string; cards: boolean; rows: GameEditRow[] };
function sourceFingerprint(template:Pick<GameTemplate,'game_type'|'items'|'config'>) {
  const {config:c}=template;
  // This is a UI consistency guard, not a server-validated learning version.
  const data=JSON.stringify([template.game_type==='bomb'?undefined:template.items,c.words,c.questions,c.statements,c.pairs,c.flashcards,c.typeAnswerEntries,c.groups,c.imageQuizItems,c.liveQuestions,c.diagramPins,c.adventure&&[c.adventure.words,c.adventure.sentences,c.adventure.cases,c.adventure.clues],c.storybook&&[c.storybook.mode,c.storybook.start,c.storybook.questions,c.storybook.steps],c.pictureWords]);
  let hash=2166136261;for(let i=0;i<data.length;i++)hash=Math.imul(hash^data.charCodeAt(i),16777619);
  return (hash>>>0).toString(16);
}
function sourceMatches(template:GameTemplate) {
  if(template.config.gameSourceFingerprint)return template.config.gameSourceFingerprint===sourceFingerprint(template);
  const source=template.config.classroomSource;
  if(!source)return false;
  const prepared=prepareClassroomGame(template.game_type,source.cards,source.kind);
  if(!prepared)return false;
  const native={...template,config:{...template.config,classroomSource:undefined}};
  const imported={...template,items:prepared.items,config:prepared.config??{}};
  const core=(rows:string[][])=>rows.map(row=>['quiz','online'].includes(guideFamily(template.game_type))?row.slice(0,2):row);
  return JSON.stringify(core(guideRows(native,source.kind)))===JSON.stringify(core(guideRows(imported,source.kind)));
}
function markSource(type:GameType,content:{items:GameTemplate['items'];config:GameTemplateConfig}) {
  if(content.config.classroomSource)content.config.gameSourceFingerprint=sourceFingerprint({game_type:type,...content});
  return content;
}
export function gameEditDraft(template: GameTemplate): GameEditDraft {
  const source = template.config.classroomSource;
  const type = template.game_type;
  const cards = !!source && type !== 'grammardetective' && sourceMatches(template);
  const kind = source?.kind ?? (['wordtrain', 'sentencerocket', 'unscramble', 'sentencesplash', 'sentencebridge', 'sentencetower', 'grammardetective', 'treasurehunt'].includes(type) ? 'sentence' : 'word');
  let rows: string[][];
  if (cards) rows = source.cards.map(card => [card.word, card.meaning, card.imageUrl ?? '', card.category ?? '', ...(['wordtrain','sentencerocket'].includes(type)?[template.config.adventure?.sentences.find(s=>s.text===card.word)?.tokens.join(' | ')??'']:[])]);
  else if (type === 'grammardetective') rows = template.config.adventure?.cases.map(c => [c.correct, c.incorrect, c.explanation]) ?? [];
  else if (type === 'wordclaw') rows = template.config.adventure?.words.map(w => [w.word, w.meaning]) ?? [];
  else if (type === 'treasurehunt') rows = template.config.adventure?.clues.map(clue=>[clue.text,targetKey(clue.answer),...clue.wrong.map(targetKey)])??[];
  else if (type === 'quizshow') rows = (template.config.liveQuestions??[]).map(q => [q.prompt,q.kind==='choice'?q.choices?.[q.correctIndex??0]??'':q.kind==='ox'?q.correctIndex===1?'X':'O':q.answer??'',...(q.kind==='choice'?q.choices?.filter((_,i)=>i!==(q.correctIndex??0))??[]:[])]);
  else rows = guideRows({...template,config:{...template.config,classroomSource:undefined}}, kind);
  return { kind, name: source?.name || template.config.adventure?.detectiveSource && template.config.adventure.detectiveSource.kind !== 'default' && template.config.adventure.detectiveSource.name || template.config.gameMaterialName || template.name,
    cards, rows: rows.map((cells, original) => ({id: crypto.randomUUID(), cells, original, card: cards ? structuredClone(source!.cards[original]) : undefined, live:!cards&&type==='quizshow'?structuredClone(template.config.liveQuestions?.[original]):undefined})) };
}

/** Options belong to the current game; conversion only replaces its content fields. */
export function mergeGameMaterial(base: GameTemplateConfig, next: GameTemplateConfig): GameTemplateConfig {
  const contentKeys = ['classroomSource','questions','statements','pairs','flashcards','typeAnswerEntries','groups','imageQuizItems','liveQuestions','words'] as const;
  const content = Object.fromEntries(contentKeys.filter(key => key in next).map(key => [key,next[key]]));
  return { ...next, ...base, ...content,
    ...(next.adventure ? { adventure: { ...next.adventure, ...base.adventure, words: next.adventure.words, sentences: next.adventure.sentences, cases: next.adventure.cases, missions: [] } } : {}),
    ...(next.storybook ? {storybook: {...next.storybook, ...base.storybook, mode: next.storybook.mode, questions: next.storybook.questions, steps: next.storybook.steps}} : {}),
    // The old pictureWords override must never keep serving a previously chosen list.
    pictureWords: next.classroomSource?.cards.map(({id, word, imageUrl}) => ({id, word, imageUrl})),
    pictureWordListId: next.classroomSource?.id,
  };
}

export function materialForGame(type: GameType, list: WordList, base: GameTemplateConfig) {
  const content = prepareClassroomGame(type, list);
  if (!content) return null;
  const config = mergeGameMaterial(base, { ...content.config, classroomSource: { id: list.id, name: list.name, version: list.updated_at, kind: isSentenceList(list) ? 'sentence' : 'word', cards: wordListToCards(list) } });
  if(type==='quizshow') config.liveQuestions=buildContestQuestions(wordListToCards(list),contestRoundNames(i18n.t.bind(i18n) as (key:string,options?:Record<string,unknown>)=>string),base.liveContestRounds);
  applyQuestionDirection(type,config,wordListToCards(list));
  return guideProblem({game_type: type, items: content.items, config}) ? null : markSource(type,{items: content.items, config});
}

function applyQuestionDirection(type:GameType,config:GameTemplateConfig,cards:FullCardItem[]) {
  // The normal adapter also supplies phonics questions where appropriate.
  if(config.wordQuestionDirection!=='meaningToWord')return;
  const source={items:cards.map(card=>({...card,image_url:card.imageUrl,category:card.category??null}))};
  if(['quiz','gameshowquiz','winlosequiz','tugofwar'].includes(type)) config.questions=buildQuizQuestions(source,config.wordQuestionDirection);
  if(type==='truefalse') config.statements=buildTrueFalseStatements(source,config.wordQuestionDirection);
}

export function gameEditContent(template: GameTemplate, draft: GameEditDraft, options: GameTemplateConfig) {
  const type = template.game_type;
  if (!draft.rows.length) throw new Error('이번 게임에 사용할 항목을 추가해 주세요.');
  if (draft.cards) {
    const cards = draft.rows.map(row => {
      const word=row.cells[0]?.trim()??'',meaning=row.cells[1]?.trim()??'';
      return {...row.card,id:row.card&&row.card.word===word&&row.card.meaning===meaning?row.card.id:row.id,word,meaning,imageUrl:row.cells[2]?.trim()||null,category:row.cells[3]?.trim()||null};
    });
    const content = prepareClassroomGame(type, cards, draft.kind);
    if (!content) throw new Error('이 게임에 필요한 단어·문장과 정답을 확인해 주세요.');
    const source = template.config.classroomSource!;
    const config = mergeGameMaterial(options, {...content.config, classroomSource: {...source, cards, version: `game-edit:${crypto.randomUUID()}`}});
    if(config.storybook&&options.storybook) config.storybook.mode=options.storybook.mode;
    if(type==='quizshow') config.liveQuestions=buildContestQuestions(cards,contestRoundNames(i18n.t.bind(i18n) as (key:string,options?:Record<string,unknown>)=>string), options.liveContestRounds);
    applyQuestionDirection(type,config,cards);
    if(config.adventure&&['wordtrain','sentencerocket'].includes(type)) config.adventure.sentences=config.adventure.sentences.map(sentence=>{
      const row=draft.rows.find(row=>row.cells[0].trim()===sentence.text);
      const blocks=row?.cells[4]?.trim();
      return blocks?{...sentence,tokens:blocks.split('|').map(s=>s.trim())}:sentence;
    });
    return markSource(type,{items: type === 'bomb' ? template.items : content.items, config});
  }
  const rows = draft.rows.map(row => row.cells);
  if ((ADVENTURE_TYPES as readonly string[]).includes(type)) {
    const adventure = structuredClone(options.adventure ?? sampleAdventure(type as AdventureType));
    if (type === 'balloonpop' || type === 'wordfishing' || type === 'wordclaw') adventure.words = draft.rows.map(row => ({id:row.id, word:row.cells[0].trim(), meaning:row.cells[1]?.trim() ?? '', tags:[]}));
    else if (type === 'wordtrain' || type === 'sentencerocket') adventure.sentences = draft.rows.map(row => ({id:row.id,text:row.cells[0].trim(),tokens:row.cells[1]?.trim() ? row.cells[1].split('|').map(s=>s.trim()) : wordTokens(row.cells[0])}));
    else if (type === 'grammardetective') {
      adventure.cases = draft.rows.map(row => {
        const [correct, incorrect, explanation] = row.cells.map(s=>s.trim());
        const previous = row.original === undefined ? undefined : options.adventure?.cases[row.original];
        if (previous && previous.correct === correct && previous.incorrect === incorrect) return {...previous, explanation};
        const item = incorrect ? { ...caseFromCorrect(correct), incorrect, correct } : caseFromCorrect(correct);
        const suggestion = detectiveSuggestion(item.incorrect, correct);
        return {...item,id:row.id,explanation:explanation || item.explanation, errors:suggestion ? [{id:crypto.randomUUID(),...suggestion}] : incorrect ? [] : item.errors};
      });
      if (draft.rows.length !== options.adventure?.cases.length || draft.rows.some(row => {
        const previous = options.adventure?.cases[row.original ?? -1];
        return !previous || previous.correct !== row.cells[0] || previous.incorrect !== row.cells[1] || previous.explanation !== row.cells[2];
      })) adventure.detectiveSource = undefined;
    } else if (type === 'treasurehunt') adventure.clues = draft.rows.map(row => {
      const target=(text:string):IslandTarget=>{const [placeId,relation]=text.split(':');return {placeId,relation:relation as IslandTarget['relation']};};
      return {id:row.id,text:row.cells[0],answer:target(row.cells[1]??''),wrong:row.cells.slice(2).filter(Boolean).map(target)};
    });
    adventure.missions = [];
    const source=options.adventure?.detectiveSource;
    const gameMaterialId=source&&source.kind!=='default'?source.listId:options.gameMaterialId??template.config.classroomSource?.id;
    return {items:template.items, config:{...options,classroomSource:undefined,gameSourceFingerprint:undefined,gameMaterialName:draft.name,gameMaterialId,adventure}};
  }
  if(type==='quizshow') return {items:[],config:{...options,classroomSource:undefined,gameMaterialName:draft.name,liveQuestions:draft.rows.map(row=>{
    const live=row.live??{id:row.id,kind:'choice' as const,points:1000,seconds:20};
    return {...live,id:row.id,prompt:row.cells[0],custom:true,...(live.kind==='choice'?{choices:row.cells.slice(1).filter(Boolean),correctIndex:0}:live.kind==='ox'?{correctIndex:row.cells[1]?.toUpperCase()==='X'?1:0}:{answer:row.cells[1]})};
  })}};
  const content = guideContent(type, rows, draft.kind, options, options.storybook?.start, template.items);
  // Preserve metadata on retained native questions (pictures, audio, hints, points…).
  const family = guideFamily(type);
  const key = family === 'quiz' ? 'questions' : family === 'ox' ? 'statements' : family === 'image' ? 'imageQuizItems' : family === 'pairs' ? type === 'typeanswer' ? 'typeAnswerEntries' : type === 'flashcards' ? 'flashcards' : 'pairs' : null;
  if (key) {
    const next = content.config[key] as unknown as Record<string, unknown>[];
    const old = template.config[key] as unknown as Record<string, unknown>[] | undefined;
    (content.config as Record<string, unknown>)[key] = next.map((item,i)=>({...old?.[draft.rows[i].original ?? -1],...item,id:draft.rows[i].id}));
  }
  if (content.config.storybook && options.storybook) {
    content.config.storybook = {...content.config.storybook, mode:options.storybook.mode, count:options.storybook.count,
      questions:content.config.storybook.questions.map((q,i)=>({...options.storybook!.questions[draft.rows[i]?.original ?? -1],...q}))};
  }
  content.config.gameMaterialName=draft.name;
  content.config.gameMaterialId=options.gameMaterialId??template.config.classroomSource?.id;
  return markSource(type,content);
}
