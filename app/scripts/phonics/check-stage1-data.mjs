import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { access,readFile,writeFile,mkdir } from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const c=await server.ssrLoadModule('/src/data/phonicsCurriculum.ts');
 const p=await server.ssrLoadModule('/src/data/phonicsStage1.ts');
 const w=await server.ssrLoadModule('/src/data/phonicsStage1Workbook.ts');
 const course=p.buildStage1Course(c.curriculumEntries(false)),u=course[0];
 assert.equal(course.length,24);assert.equal(u.id,'stage1-abc');
 assert.deepEqual(u.groups.map(g=>g.entries.map(e=>e.word)),[['apple','ant','axe'],['bag','bat','bus'],['cap','cat','cup']]);
 assert.equal(u.slides.length,98);assert.equal(u.slides.filter(s=>!s.optional).length,78);assert.equal(u.slides.filter(s=>s.optional).length,20);
 assert.equal(u.slides.filter(s=>!s.optional&&s.lesson===1).length,38);assert.equal(u.slides.filter(s=>!s.optional&&s.lesson===2).length,40);
 assert.equal(u.pages.length,8);assert.equal(u.pages[2].title,'Read and Match');
 assert.deepEqual(u.reader.wordIds.map(id=>p.stage1Sentence(u,id)),['I see a cat.','I see a cap.','I see a cup.','I see a bag.']);
 assert.equal(u.slides.filter(s=>s.kind==='yourTurn').length,1);
 for(const unit of course){
  assert.equal(new Set(unit.slides.map(s=>s.id)).size,unit.slides.length);
  assert.equal(new Set(unit.pages.map(s=>s.id)).size,unit.pages.length);
  for(const page of unit.pages){assert(page.slideIds.length,page.id);assert(w.stage1PageAnswers(unit,page).every(a=>a.prompt&&a.answer));}
  for(const slide of unit.slides){
   for(const id of [...slide.wordIds,...slide.answerIds??[]])assert(unit.wordIds.includes(id),slide.id+' invalid word');
   for(const id of slide.workbookPageIds)assert(unit.pages.some(p=>p.id===id));
   if(slide.pairId){const pair=unit.slides.filter(s=>s.pairId===slide.pairId);assert.equal(pair.length,2);assert.deepEqual(pair[0].wordIds,pair[1].wordIds);assert.deepEqual(pair[0].answerIds,pair[1].answerIds);}
  }
  for(const r of unit.rounds){
   assert.deepEqual([...r.full].sort(),[...unit.wordIds].sort());assert.deepEqual([...r.question].sort(),[...r.full].sort());
   assert(r.missing.every(id=>r.question.includes(id)));const q=unit.slides.find(s=>s.roundId===r.id&&s.phase==='question'),a=unit.slides.find(s=>s.roundId===r.id&&s.phase==='answer');assert.deepEqual(q.wordIds,a.wordIds);
  }
  for(const e of unit.groups.flatMap(g=>g.entries)){assert(e.image_url,e.word);await access('public'+e.image_url);assert(e.targets.length);}
  if(unit!==u){assert.equal(unit.number,undefined);assert.equal(unit.reader,null);assert.equal(unit.groups.length,1);assert.equal(unit.pages.length,4);assert(!unit.slides.some(s=>['sight','read','together'].includes(s.kind)));}
 }
 assert.deepEqual(u.rounds[0].full,u.rounds[0].question);assert.deepEqual(u.rounds[1].full,u.rounds[1].question);assert.notDeepEqual(u.rounds[2].full,u.rounds[2].question);assert.equal(u.rounds[2].missing.length,2);
 const x=course.find(u=>u.groups[0].letter==='X');assert(x.groups[0].entries.every(e=>e.targets[0]===2));
 const stage1Original=c.curriculumEntries(false).filter(e=>e.step===1);
 assert.deepEqual(course.flatMap(u=>u.groups.flatMap(g=>g.entries.map(e=>e.id))),stage1Original.map(e=>e.id));
 const artwork=JSON.parse(await readFile('src/data/phonics/stage1Artwork.json','utf8'));for(const a of Object.values(artwork.shadows))await access('public'+a.url);
 await mkdir('../output/phonics-stage1',{recursive:true});
 const result={passed:true,units:course.length,sourceLetters:26,learningEntries:78,distinctWords:new Set(stage1Original.map(e=>e.wordId)).size,unit1:{core:78,lesson1:38,lesson2:40,optional:20,workbook:8},otherUnits:course.slice(1).map(u=>({id:u.id,letter:u.groups[0].letter,slides:u.slides.length,core:u.slides.filter(s=>!s.optional).length,optional:u.slides.filter(s=>s.optional).length,pages:u.pages.length,reader:'pending approval'})),recordings:stage1Original.filter(e=>e.audio?.recordingUrl).length};
 await writeFile('../output/phonics-stage1/material-status.json',JSON.stringify({missingColors:[],phonemeRecordings:'unavailable for all 26 letters; teacher models sounds',missingWordRecordings:[...new Map(stage1Original.filter(e=>!e.audio?.recordingUrl).map(e=>[e.wordId,{wordId:e.wordId,word:e.word}])).values()],pendingReaders:course.filter(u=>!u.reader).map(u=>({unitId:u.id,letter:u.groups[0].letter})),referenceShadows:Object.keys(artwork.shadows),otherQuizPolicy:'Static canonical color picture; no unpaired old silhouettes.'},null,2));
 await writeFile('../output/phonics-stage1/data-checks.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await server.close();}
