import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {mkdir,writeFile,access} from 'node:fs/promises';
const out='../output/worksheet-studio';await mkdir(out,{recursive:true});
const server=await createServer({logLevel:'error'});
try{
 const {WORKSHEET_ACTIVITIES,WORKSHEET_BASIC_ACTIVITIES}=await server.ssrLoadModule('/src/lib/worksheetActivityCatalog.ts');
 const {exampleWorksheet}=await server.ssrLoadModule('/src/lib/worksheetActivitySamples.ts');
 const model=await server.ssrLoadModule('/src/lib/worksheetStudio.ts');
 const print=await server.ssrLoadModule('/src/lib/worksheetActivityPrinting.ts');
 const {worksheetStudioKo,worksheetStudioEn}=await server.ssrLoadModule('/src/i18n/worksheetStudioLocales.ts');
 assert.equal(WORKSHEET_ACTIVITIES.length,72);assert.equal(new Set(WORKSHEET_ACTIVITIES.map(a=>a.id)).size,72);
 assert.deepEqual([1,2,3].map(p=>WORKSHEET_ACTIVITIES.filter(a=>a.phase===p).length),[15,15,42]);
 const results=[];
 for(const activity of [...WORKSHEET_ACTIVITIES,...WORKSHEET_BASIC_ACTIVITIES]){
  const doc=exampleWorksheet(activity.id),issues=model.worksheetIssues(doc);const missing=[];
  for(const w of doc.words)for(const url of [w.imageUrl,w.lineartUrl])if(url?.startsWith('/'))try{await access('public'+url);}catch{missing.push(url);}
  const blocks=print.studentBlocks(doc),restored=model.parseWorksheetFile(JSON.parse(JSON.stringify(doc)));
  assert.equal(restored.activityId,doc.activityId);assert.equal(restored.words.length,doc.words.length);
  assert(worksheetStudioKo.activities[activity.id].tip);assert(worksheetStudioEn.activities[activity.id].tip);
  results.push({id:activity.id,issues,missing:[...new Set(missing)],blocks:blocks.length});
 }
 await writeFile(out+'/logic.json',JSON.stringify({passed:results.every(r=>!r.issues.length&&!r.missing.length),results},null,2));
 for(const r of results)if(r.issues.length||r.missing.length)console.log(JSON.stringify(r));
 assert(results.every(r=>!r.issues.length&&!r.missing.length),'All examples must be complete with real asset files');
 assert.equal(model.soundGroups('ship','sh|i|p').length,3);assert.deepEqual(model.soundGroups('cake','c|a_e|k').map(g=>g.positions),[[0],[1,3],[2]]);assert.equal(model.soundGroups('fox','f|o|x:x').reduce((n,g)=>n+g.span,0),4);assert.equal(model.soundGroups('ship','s|i|p'),null);
 assert.equal(model.phonemeDistance(['k','æ','t'],['k','ɒ','t']),1);assert.equal(model.routeCells('left'),null);
 assert.equal(model.safePicture('javascript:alert(1)'),false);assert.equal(model.safePicture('//evil.test/a.png'),false);
 assert.throws(()=>model.parseWorksheetFile({...exampleWorksheet('pictureWrite'),words:[{id:'x',word:'x',meaning:'',imageUrl:'javascript:alert(1)'}]}));
 const crosswordDoc=exampleWorksheet('crossword');
 for(const words of [crosswordDoc.words.slice(0,3),[{id:'a',word:'zzz',meaning:'first'},{id:'b',word:'aaa',meaning:'second'},{id:'c',word:'qqq',meaning:'third'}]]){
  const p=print.printableCrossword(words);assert.equal(p.entries.length,words.length);
  for(const entry of p.entries)assert.equal([...entry.word.word.toUpperCase()].map((_,i)=>p.grid[entry.row+(entry.dir==='down'?i:0)][entry.col+(entry.dir==='across'?i:0)]).join(''),entry.word.word.toUpperCase());
 }
 const gap=exampleWorksheet('informationGap');assert(gap.tasks.every(r=>r.answer));assert.notDeepEqual(print.studentBlocks(gap).map(b=>b.role),[]);
 console.log('PASS: 72 activities + '+WORKSHEET_BASIC_ACTIVITIES.length+' basic formats, original examples, assets, editable-file round trips, phoneme groups, routes and crossword coverage.');
}finally{await server.close();}
