import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const dir = mkdtempSync(join(tmpdir(), 'classbank-tests-'));
try {
  for (const name of ['quizFromWordList','wordListLaunch','diceMotion']) {
    const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url),'utf8');
    const output = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
    writeFileSync(join(dir,`${name}.cjs`),output.replace('require("./quizFromWordList")','require("./quizFromWordList.cjs")'));
  }
  const require = createRequire(import.meta.url);
  const {nextDiceRotation} = require(join(dir,'diceMotion.cjs'));
  // Transform each actual face normal into the camera direction; do not compare
  // against the implementation's angle table (which could contain the same error).
  const normals = {1:[0,0,1],2:[0,-1,0],3:[1,0,0],4:[-1,0,0],5:[0,1,0],6:[0,0,-1]};
  let cases = 0;
  for (const direction of [-1,1]) {
    let previous = {rx:0,ry:0};
    for (let round=0;round<12;round++) for(let value=1;value<=6;value++) {
      const next = nextDiceRotation(previous,value,direction);
      for(const axis of ['rx','ry']) assert.ok((next[axis]-previous[axis])*direction >= 720);
      const [x,y,z] = normals[value];
      const ax=next.rx*Math.PI/180, ay=next.ry*Math.PI/180;
      const x1=Math.cos(ay)*x+Math.sin(ay)*z, z1=-Math.sin(ay)*x+Math.cos(ay)*z;
      const y2=Math.cos(ax)*y-Math.sin(ax)*z1, z2=Math.sin(ax)*y+Math.cos(ax)*z1;
      assert.ok(Math.abs(x1)<1e-9 && Math.abs(y2)<1e-9 && Math.abs(z2-1)<1e-9,`Face ${value} must face camera`);
      previous=next; cases++;
    }
  }
  const {prepareWordListGame}=require(join(dir,'wordListLaunch.cjs'));
  const {buildQuizQuestions,buildTrueFalseStatements}=require(join(dir,'quizFromWordList.cjs'));
  const words=[['cat','고양이'],['CAT','고양이'],['cat','냥이'],['dog','강아지'],['puppy','강아지'],['sun','태양'],['','빈칸'],['blank','']].map(([word,meaning],i)=>({id:`w${i}`,word,meaning,image_url:null,category:null}));
  const matchup=prepareWordListGame(words,'matchup');
  assert.equal(matchup.count,3); assert.equal(matchup.ready,true);
  assert.equal(prepareWordListGame(words.slice(0,3),'matchup').ready,false);
  assert.equal(prepareWordListGame([], 'wheel').ready,false);
  assert.equal(prepareWordListGame(words,'wheel').count,5);
  assert.equal(prepareWordListGame(words,'flashcards').count,5);
  for (const direction of ['wordToMeaning','meaningToWord']) {
    const questions=buildQuizQuestions({items:words},direction);
    for(const q of questions) {
      const key=direction==='wordToMeaning'?'word':'meaning', answer=direction==='wordToMeaning'?'meaning':'word';
      const valid=new Set(words.filter(w=>w[key].toLowerCase()===q.question.toLowerCase()).map(w=>w[answer].toLowerCase()));
      assert.ok(valid.has(q.choices[q.correctIndex].toLowerCase()));
      q.choices.forEach((choice,index)=>{if(index!==q.correctIndex)assert.ok(!valid.has(choice.toLowerCase()));});
      assert.equal(new Set(q.choices.map(c=>c.toLowerCase())).size,q.choices.length);
    }
  }
  const onlySynonyms=words.slice(0,3);
  assert.equal(buildQuizQuestions({items:onlySynonyms},'wordToMeaning').length,0);
  assert.ok(buildTrueFalseStatements({items:onlySynonyms},'wordToMeaning').every(s=>s.isTrue));
  console.log(`PASS: ${cases} consecutive dice landings; duplicate/alternate-answer quizzes; word-list payloads.`);
} finally { rmSync(dir,{recursive:true,force:true}); }
