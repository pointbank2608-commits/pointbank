import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';

// Data-path regression tests only. Browser verification uses the GPT in-app browser.
const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),plugins:[{name:'no-backend-in-data-tests',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return 'export const supabase = new Proxy({}, {get(){throw new Error("Unexpected backend access in data tests")}});';}}],define:{'import.meta.env.VITE_SUPABASE_URL':'"https://test.supabase.co"','import.meta.env.VITE_SUPABASE_ANON_KEY':'"test-only"','import.meta.env.VITE_LEARNING_SENSORS_ENABLED':'"false"'},server:{middlewareMode:true},logLevel:'error'});
try {
  const {usesUnifiedGameSettings,gameEditDraft,gameEditContent,materialForGame}=await server.ssrLoadModule('/src/lib/unifiedGameSettings.ts');
  const {GAME_CATALOG}=await server.ssrLoadModule('/src/lib/gameCatalog.ts');
  const {guideSample,guideProblem}=await server.ssrLoadModule('/src/lib/gameGuide.ts');
  const {sampleAdventure,adventureRounds,adventureErrors}=await server.ssrLoadModule('/src/lib/adventureGames.ts');
  const {storySample}=await server.ssrLoadModule('/src/lib/storybook.ts');
  const template=(type,config={},items=[])=>({id:'activity:test',name:'Test material',game_type:type,config,items});
  const list={id:'test-words',name:'Animals',kind:'word',updated_at:'v1',items:['cat','dog','pig','cow','duck','horse'].map((word,i)=>({id:`w${i}`,word,meaning:`meaning ${i}`,image_url:`/${word}.webp`,category:i<3?'one':'two'}))};
  const sourceJSON=JSON.stringify(list);
  const tested=[];
  for(const game of GAME_CATALOG.filter(g=>usesUnifiedGameSettings(g.type))) {
    let original=template(game.type);
    if(['balloonpop','wordfishing','wordtrain','sentencerocket','wordclaw','grammardetective','treasurehunt'].includes(game.type)) original.config.adventure=sampleAdventure(game.type);
    else if(['feedmonster','sentencebridge','sentencetower'].includes(game.type)) original.config.storybook=storySample(game.type);
    else Object.assign(original,guideSample(game.type,original));
    if(!guideProblem(original)) {
      const draft=gameEditDraft(original);
      const next=gameEditContent(original,draft,structuredClone(original.config));
      assert.equal(guideProblem({game_type:game.type,...next}),null,`${game.type}: unchanged content remains playable`);
      tested.push(game.type);
    }
  }
  for(const type of ['wordfishing','balloonpop','wordclaw','quiz','matchup','flashcards','groupsort','imagequiz','telepathy','sentencesplash','wordtrain','sentencerocket']) {
    const sentence=['sentencesplash','wordtrain','sentencerocket'].includes(type);
    const input=sentence?{...list,kind:'sentence',items:list.items.map((row,i)=>({...row,word:`We read book ${i}.`}))}:list;
    const base={lightningMin:7,lightningMax:18,splashSeconds:90,adventure:['wordclaw','balloonpop','wordfishing','wordtrain','sentencerocket'].includes(type)?{...sampleAdventure(type),speed:'fast',seconds:60}:undefined};
    const content=materialForGame(type,input,base);
    assert.ok(content,`${type}: source can be selected`);
    const original=template(type,content.config,content.items);
    const draft=gameEditDraft(original);
    assert.ok(draft.cards);
    draft.rows[0].cells[0]=sentence?'We read stories.':'kitten';
    if(type==='sentencerocket'||type==='wordtrain')draft.rows[0].cells[4]='We | read stories.';
    draft.rows.splice(1,1);
    draft.rows.push({id:'new-row',cells:sentence?['They play soccer.','','','']:['goat','염소','/goat.webp','two']});
    const next=gameEditContent(original,draft,structuredClone(original.config));
    assert.equal(guideProblem({game_type:type,...next}),null,`${type}: edited content is playable`);
    const text=JSON.stringify(next);
    assert.ok(text.includes(sentence?'We read stories.':'kitten'));
    assert.ok(!next.config.classroomSource.cards.some(c=>c.word===(sentence?'We read book 1.':'dog')));
    assert.ok(next.config.classroomSource.cards.some(c=>c.word===(sentence?'They play soccer.':'goat')));
    assert.equal(next.config.lightningMin,7);
    assert.equal(next.config.splashSeconds,90);
    assert.equal(next.config.classroomSource.cards[1].id,'w2','unmodified source items keep their material identity');
    if(type==='sentencerocket'||type==='wordtrain')assert.deepEqual(next.config.adventure.sentences[0].tokens,['We','read stories.']);
    if(next.config.adventure){assert.equal(next.config.adventure.speed,'fast');assert.equal(next.config.adventure.seconds,60);}
  }
  assert.equal(JSON.stringify(list),sourceJSON,'source list is never mutated');
  const detective=template('grammardetective',{adventure:sampleAdventure('grammardetective')});
  const draft=gameEditDraft(detective);
  draft.rows[0].cells=['She likes cats.','She like cats.','She takes -s'];
  draft.rows.splice(1,1);
  draft.rows.push({id:'new-case',cells:['He plays soccer.','','']});
  const next=gameEditContent(detective,draft,structuredClone(detective.config));
  assert.deepEqual(adventureErrors('grammardetective',next.config.adventure),[]);
  assert.equal(next.config.adventure.cases.length,3);
  assert.equal(next.config.adventure.cases[0].correct,'She likes cats.');
  assert.ok(!next.config.adventure.cases.some(c=>c.correct==='They are happy.'));
  const live=template('quizshow',{liveSpeedBonus:false,liveQuestions:[{id:'choice',kind:'choice',prompt:'cat',choices:['개','고양이'],correctIndex:1,points:500,seconds:30,imageUrl:'/cat.webp'},{id:'ox',kind:'ox',prompt:'A cat is an animal.',correctIndex:0},{id:'text',kind:'text',prompt:'고양이',answer:'cat',speak:'cat',seconds:45},{id:'buzzer',kind:'buzzer',prompt:'Name an animal.',answer:'cat/dog'}]});
  const liveDraft=gameEditDraft(live);
  assert.equal(liveDraft.rows.length,4,'all native online question types appear in the editor');
  liveDraft.rows[2].cells[1]='kitten';liveDraft.rows.splice(1,1);
  const liveNext=gameEditContent(live,liveDraft,structuredClone(live.config));
  assert.deepEqual(liveNext.config.liveQuestions.map(q=>q.kind),['choice','text','buzzer']);
  assert.equal(liveNext.config.liveQuestions[1].answer,'kitten');
  assert.equal(liveNext.config.liveQuestions[0].imageUrl,'/cat.webp');
  assert.equal(liveNext.config.liveQuestions[0].points,500);
  assert.equal(liveNext.config.liveSpeedBonus,false);
  const reversed=materialForGame('quiz',list,{wordQuestionDirection:'meaningToWord'});
  assert.ok(reversed.config.questions.every(q=>q.question.startsWith('meaning')),'the existing reverse direction uses the chosen list');
  const customized=materialForGame('quiz',list,{});
  customized.config.questions[0].question='A custom question from the native editor';
  const customTemplate=template('quiz',customized.config,customized.items);
  const customDraft=gameEditDraft(customTemplate);
  assert.equal(customDraft.cards,false,'native edits cannot be replaced by a stale source snapshot');
  assert.equal(customDraft.rows[0].cells[0],'A custom question from the native editor');
  const customNext=gameEditContent(customTemplate,customDraft,structuredClone(customized.config));
  assert.equal(customNext.config.questions[0].question,'A custom question from the native editor');
  const claw=sampleAdventure('wordclaw');claw.count=5;claw.missions=[{id:'legacy',tag:'unknown',text:'Legacy classification'}];
  assert.deepEqual(adventureErrors('wordclaw',claw),[],'legacy classification cannot block a draw');
  assert.ok(adventureRounds('wordclaw',claw).every(r=>r.kind==='draw'&&!('mission' in r)));
  for(const type of ['wheel','ladder','order','timer','twodice','mathgen','grammarverb','grammarlab','airport','doctor','shufflefind','lastbox']) assert.equal(usesUnifiedGameSettings(type),false,`${type} stays out of scope`);
  console.log(`PASS: ${tested.length} native game configurations, source selection/editing adapters, option preservation, immutable sources, detective corrections, classification-free draw and scope exclusions.`);
} finally {await server.close();}
