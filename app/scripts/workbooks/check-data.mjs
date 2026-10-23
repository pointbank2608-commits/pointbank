import '../phonics/check-curriculum.mjs';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
const server = await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {GRAMMAR_WORKBOOK_TOPICS} = await server.ssrLoadModule('/src/data/grammarWorkbook.ts');
 const grammar=GRAMMAR_WORKBOOK_TOPICS['third-s'];
 assert.equal(grammar.choose.length,5);assert.equal(grammar.fill.length,5);assert.equal(grammar.correct.length,3);
 for(const q of grammar.choose)assert.equal(q.choices.filter(c=>c===q.answer).length,1);
 assert.equal(Object.keys(GRAMMAR_WORKBOOK_TOPICS).length,1);
 const candidates=grammar.mission.characters.filter(c=>grammar.mission.clues.every(clue=>c.sentences.includes(clue.prompt)));
 assert.deepEqual(candidates.map(c=>c.name),['TOBI']);
 assert.deepEqual(grammar.mission.clues.map(c=>c.answer),['He likes soccer.','He watches cartoons.','He goes to the park.','He has a red bag.']);

 console.log('PASS: existing grammar mission regression.');
} finally {await server.close();}
