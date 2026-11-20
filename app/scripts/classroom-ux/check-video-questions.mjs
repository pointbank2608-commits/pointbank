import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../../src/lib/videoQuestions.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {questionError,sortedQuestions,nextVideoQuestion,shuffledWordIndices,formatQuestionTime,parseQuestionTime}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const questions=[
 {id:'spoken',kind:'spoken',at:1,replayStart:0,prompt:'What do you see?',modelAnswer:'A rabbit.'},
 {id:'choice',kind:'choice',at:3,replayStart:.5,prompt:'Which one?',choices:['rabbit','cat'],answerIndex:0},
 {id:'cloze',kind:'cloze',at:5,replayStart:2,sentence:'I like it.',hiddenWordIndices:[1]},
 {id:'scramble',kind:'scramble',at:7,replayStart:4,sentence:'I can do it.'},
];
for(const q of questions)assert.equal(questionError(q,0,8),'');
assert.deepEqual(JSON.parse(JSON.stringify(questions)),questions);
assert.deepEqual(sortedQuestions([...questions].reverse()),questions);
assert.match(questionError({...questions[0],replayStart:1}),/앞/);
assert.match(questionError({...questions[0],at:NaN}),/시점/);
assert.match(questionError({...questions[0],at:9},0,8),/구간/);
assert.match(questionError({...questions[1],choices:['','cat']}),/보기/);
assert.match(questionError({...questions[1],answerIndex:4}),/정답/);
assert.match(questionError({...questions[2],hiddenWordIndices:[]}),/단어/);
assert.match(questionError({...questions[2],hiddenWordIndices:[8]}),/단어/);
const served=new Set();
assert.equal(nextVideoQuestion(questions,served,.8),undefined);
for(const q of questions){assert.equal(nextVideoQuestion(questions,served,q.at),q);served.add(q.id);assert.notEqual(nextVideoQuestion(questions,served,q.at)?.id,q.id);}
assert.equal(nextVideoQuestion(questions,served,100),undefined);
assert.equal(parseQuestionTime('00:42.25'),42.25);
assert.equal(formatQuestionTime(42.25),'00:42.25');
assert.ok(Number.isNaN(parseQuestionTime('00:72')));
for(let i=0;i<40;i++){const order=shuffledWordIndices('I like it.');assert.deepEqual([...order].sort(),[0,1,2]);assert.notDeepEqual(order,[0,1,2]);}
console.log('Video questions: four types, JSON persistence, timeline, replay bounds, validation, continuation and scramble checks passed.');
