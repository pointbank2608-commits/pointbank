import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { observedBank } from './observed-bank.mjs';
const server = await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {buildPhonicsWorkbook,patternTargets,phonicsCircleRows} = await server.ssrLoadModule('/src/data/phonicsWorkbook.ts');
 const {cvcMatchOrder,CVC_UNITS,LONG_UNITS,soundMarks,cvcCircleRows} = await server.ssrLoadModule('/src/data/cvcWorkbook.ts');
 const {GRAMMAR_WORKBOOK_TOPICS} = await server.ssrLoadModule('/src/data/grammarWorkbook.ts');
 const report=[];
 for(const step of [4,5]){
   const rows=observedBank.filter(e=>e.step===step);
   const units=buildPhonicsWorkbook(observedBank,step);
   assert.equal(rows.length,step===4?68:58);
   assert.deepEqual(units.flatMap(u=>u.entryIds).sort(), rows.map(e=>e.id).sort());
   for(const u of units){
     assert(u.words.length===1 || u.words.length===2 || u.words.length===3);
     for(const id of u.entryIds){const row=rows.find(e=>e.id===id);assert.equal(row.rule,u.family);assert.deepEqual(u.targets[row.word].red,patternTargets(row.word,row.pattern_marked));}
     if(u.words.length>1) assert(cvcMatchOrder(u).every((w,i)=>w!==u.words[i]));
     for(const q of phonicsCircleRows(u)){assert.equal(q.choices.filter(w=>w===q.word).length,1);assert.equal(new Set(q.choices).size,q.choices.length);}
     if(u.words.length>1)assert(new Set(phonicsCircleRows(u).map(q=>q.choices.indexOf(q.word))).size>1);
     assert.deepEqual(phonicsCircleRows(u),phonicsCircleRows(u));
     if(u.words.length===1) assert(u.issues.length>0);
   }
   report.push({step,sourceEntries:rows.length,uniqueWords:new Set(rows.map(e=>e.word)).size,units:units.length,readyUnits:units.filter(u=>!u.issues.length).length,readyWords:units.filter(u=>!u.issues.length).reduce((s,u)=>s+u.words.length,0),incomplete:units.filter(u=>u.issues.length).map(u=>({unit:u.unit,rule:u.family,words:u.words,issues:u.issues}))});
 }
 const sh=buildPhonicsWorkbook(observedBank,4)[0];
 const broken=buildPhonicsWorkbook(observedBank.map(e=>e.word==='ship'&&e.step===4?{...e,pattern_marked:'{sh}op'}:e),4)[0];
 assert(broken.issues.some(issue=>issue.type==='target'&&issue.word==='ship'));
 assert.deepEqual(sh.words,['ship','shell','fish']);
 assert.deepEqual(sh.targets.ship.blank,[0,1]);assert.deepEqual(sh.targets.shell.red,[0,1]);assert.deepEqual(sh.targets.fish.blank,[2,3]);
 const units=buildPhonicsWorkbook(observedBank,4);
 assert.deepEqual(units.find(u=>u.family==='R-Blends (br)').targets.brush.red,[0,1]);
 assert.deepEqual(units.find(u=>u.family==='Digraph (sh)'&&u.words.includes('brush')).targets.brush.red,[3,4]);
 for(const bad of ['{sh}i{p','{sh}}ip','{sh{}}ip','ship','{sh}op'])assert.equal(patternTargets('ship',bad),null);
 const distinct=buildPhonicsWorkbook(observedBank,5);
 for(const rule of ['oo (short)','oo (long)','ow (long o)','ow (diphthong)'])assert(distinct.some(u=>u.family===rule));
 for(const u of [...CVC_UNITS,...LONG_UNITS]){
   assert(cvcMatchOrder(u).every((w,i)=>w!==u.words[i]));
   for(const q of cvcCircleRows(u))assert.equal(q.choices.filter(w=>w===q.word).length,1);
 }
 assert.deepEqual(soundMarks(LONG_UNITS[0],'cake'),{red:[1,3],blank:[1]});
 assert.deepEqual(soundMarks(CVC_UNITS[0],'dad'),{red:[1],blank:[1]});
 const grammar=GRAMMAR_WORKBOOK_TOPICS['third-s'];
 assert.equal(grammar.choose.length,5);assert.equal(grammar.fill.length,5);assert.equal(grammar.correct.length,3);
 for(const q of grammar.choose)assert.equal(q.choices.filter(c=>c===q.answer).length,1);
 assert.equal(Object.keys(GRAMMAR_WORKBOOK_TOPICS).length,1);
 const candidates=grammar.mission.characters.filter(c=>grammar.mission.clues.every(clue=>c.sentences.includes(clue.prompt)));
 assert.deepEqual(candidates.map(c=>c.name),['TOBI']);
 assert.deepEqual(grammar.mission.clues.map(c=>c.answer),['He likes soccer.','He watches cartoons.','He goes to the park.','He has a red bag.']);
 await mkdir('../output/pdf',{recursive:true});
 await writeFile('../output/pdf/workbook-data-audit.json',JSON.stringify({source:'https://pointbank-ten.vercel.app/phonics',observedAt:'2026-10-23',stages:report},null,2));
 console.log(JSON.stringify(report,null,2));
 console.log('PASS: exact source coverage, phoneme groups, target offsets, choices, match, CVC/long regression and grammar mission.');
} finally {await server.close();}
