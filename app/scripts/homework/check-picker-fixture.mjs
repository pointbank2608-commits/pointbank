import assert from 'node:assert/strict';
import {createGuidedServer} from './guided-server.mjs';
import {wordCards,sentenceCards} from './material-fixture.mjs';

// Exercises the same generated API module and conversion functions as the classroom picker.
// No browser process, external database, or real user account is needed.
globalThis.window={};
globalThis.sessionStorage={getItem:()=>null};
globalThis.WebSocket ??= class {constructor(){throw Error('No realtime connection expected in the picker');}};
const row=(kind,cards,cls='C')=>({id:kind+cls,academy_id:'A',class_id:cls,
  name:'Family Road Trip',kind,updated_at:'2026-11-26T00:00:00Z',
  items:cards.map(c=>({id:c.id,word:c.word,meaning:c.meaning,image_url:c.imageUrl,category:null}))});
const lists=[row('word',wordCards),row('sentence',sentenceCards),row('word',wordCards,'other')];
const server=await createGuidedServer(5549,{academy:'A',client:'export const supabase={}',
  seed:{lists},handle:(_req,_res,next)=>next()});
try{
  // This module instantiates a second Supabase client at import time, also in the guided three-step test.
  await server.ssrLoadModule('/src/lib/remote.ts');
  const api=await server.ssrLoadModule('/src/lib/api.ts');
  const {wordListToCards}=await server.ssrLoadModule('/src/lib/gameFromWords.ts');
  const {memoryItemFromCards}=await server.ssrLoadModule('/src/lib/homework/memory.ts');
  const available=await api.fetchWordLists('A','C','all');
  assert.deepEqual(available.map(r=>api.wordListKindOf(r)),['word','sentence']);
  assert.deepEqual((await api.fetchWordLists('A','C')).map(r=>r.kind),['word']);
  assert.equal((await api.fetchAllWordLists('A','all')).length,3);
  assert.deepEqual(await api.fetchWordLists('other','C','all'),[]);
  const [words,sentences]=available.map(wordListToCards);
  assert.deepEqual(words.map(c=>c.word),wordCards.map(c=>c.word));
  assert.deepEqual(sentences.map(c=>c.word),sentenceCards.map(c=>c.word));
  assert.equal(memoryItemFromCards(words,'flip',10,false).config.block.count,10);
  const practice=memoryItemFromCards(sentences.map(c=>({...c,example:c.word})),'sentence',8,false);
  assert.equal(practice.content.questions.length,8);
  assert.equal(available[1].updated_at,lists[1].updated_at);
  console.log('PASS guided picker: synchronous word/sentence categories and class scope; 10 flip cards, 8 sentence questions, original version');
}finally{await server.close();}
