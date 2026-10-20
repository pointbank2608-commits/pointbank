import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const server=await createServer({root,logLevel:'error',plugins:[{name:'no-backend',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return 'export const supabase={};';}}],server:{middlewareMode:true,hmr:false},appType:'custom'});
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

try {
 const {GUIDE_FAMILIES,guideSample,guideContent,guideProblem,guideKinds}=await server.ssrLoadModule('/src/lib/gameGuide.ts');
 const {GAME_CATALOG:catalog}=await server.ssrLoadModule('/src/lib/gameCatalog.ts');
 const {storySample}=await server.ssrLoadModule('/src/lib/storybook.ts');
 assert.equal(catalog.filter(g=>g.number<=53).length,53);assert.equal(Object.keys(GUIDE_FAMILIES).length,53);
 const make=type=>({id:'original',game_type:type,items:[{id:'x',label:'apple'},{id:'y',label:'banana'}],config:{},name:'Original'});
 for(const g of catalog.filter(g=>g.number<=53)){const original=make(g.type),before=JSON.stringify(original);const content=guideSample(g.type,original);assert.equal(guideProblem({...original,...content}),null,g.type);assert.equal(JSON.stringify(original),before,'original changed '+g.type);assert(guideKinds(g.type).includes('sample'));}
 console.log('ok all 53 sample configurations ready; originals unchanged; explicit family coverage');
 const pairs=make('matchup');const contents=guideContent('matchup',[['apple','사과'],['cat','고양이']],'word',pairs.config);
 assert.equal(guideProblem({...pairs,...contents}),null);assert.equal(guideProblem({...pairs,...guideContent('matchup',[['apple','사과']],'word',{})}),'incomplete');
 assert.equal(guideProblem({...pairs,...guideContent('matchup',[['apple','사과'],['cat','사과']],'word',{})}),'duplicate');
 for(const type of ['wordsearch','crossword'])assert.equal(guideProblem({...make(type),items:[{id:'x',label:'a'},{id:'y',label:'I'}]}),'letters');
 assert.equal(guideProblem({...make('wordsearch'),items:[{id:'x',label:'abcdefghijklmno'},{id:'y',label:'banana'}]}),'letters');
 const names=guideContent('wheel',[['민지'],['지우']],'names',{classroomSource:{id:'old',kind:'word',cards:[{id:'x',word:'apple',meaning:'사과',imageUrl:null}]}});assert.equal(names.config.classroomSource,undefined);assert.equal(names.items[0].label,'민지');
 const input=[{id:'a',word:'apple',meaning:'사과',imageUrl:'/apple.webp'},{id:'c',word:'cat',meaning:'고양이',imageUrl:'/cat.webp'}];const base={classroomSource:{id:'list',name:'원본',kind:'word',version:'v1',cards:input}};const before=JSON.stringify(base);
 const reused=guideContent('matchup',[['apple','사과'],['cat','고양이']],'word',base);assert.equal(reused.config.classroomSource.cards[0].imageUrl,'/apple.webp');assert.equal(JSON.stringify(base),before);
 const preservedGroups=guideContent('groupsort',[['apple','fruit'],['cat','animal']],'word',base);assert.equal(preservedGroups.config.classroomSource.cards[0].meaning,'사과');
 const preservedImage=guideContent('imagequiz',[['apple','/apple.webp']],'word',base);assert.equal(preservedImage.config.classroomSource.cards[0].meaning,'사과');
 const groups=guideContent('groupsort',[['apple','fruit'],['cat','animal']],'word',{});assert.equal(guideProblem({...make('groupsort'),...groups}),null);assert.equal(groups.config.classroomSource.cards[1].category,'animal');
 const bridge=storySample('sentencebridge');const rows=bridge.questions.map(q=>[q.prompt,q.answer,...q.wrong]);assert.equal(guideProblem({...make('sentencebridge'),...guideContent('sentencebridge',rows,'sentence',{storybook:bridge})}),null);
 const tower=storySample('sentencetower');assert.equal(guideProblem({...make('sentencetower'),...guideContent('sentencetower',tower.steps.map(s=>[s.phrase,String(s.position),...s.wrong]),'sentence',{storybook:tower},tower.start)}),null);
 assert.equal(guideProblem({...make('labeleddiagram'),...guideContent('labeleddiagram',[['apple','NaN','.5']],'word',{diagramImageUrl:'/apple.webp'})}),'incomplete');
 assert.equal(guideProblem({...make('watermelon'),...guideContent('watermelon',[['I','subject']],'word',{watermelonPatternId:'svo'})}),'incomplete');
 console.log('ok native pairs, duplicate answers, puzzle boundaries, names/source separation, image/category reuse, original immutability, bridge/tower structures, diagram positions and sentence slots');
}finally{await server.close();}
