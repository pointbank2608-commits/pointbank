// Isolated teacher session: no production data, sensors, or real student answers.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createLessonUxServer} from '../lessons/ux-server.mjs';
process.env.VITE_SUPABASE_URL='http://127.0.0.1:5592';
process.env.VITE_SUPABASE_ANON_KEY='local-fixture-key';
process.env.VITE_LEARNING_SENSORS_ENABLED='false';
const inspect={name:'history-test-inspector',enforce:'pre',transform(code,id){
 if(id.replaceAll('\\','/').endsWith('/src/components/QuizShowHost.tsx'))return code.replace('preview = false','preview = true');
 if(id.replaceAll('\\','/').endsWith('/src/context/GameHistoryContext.tsx'))return code.replace('return <Context.Provider value={history.current}>','window.__gameHistory=history.current;return <Context.Provider value={history.current}>');
}};
const server=await createLessonUxServer(5592,false,[inspect]);
const results=[],errors=[];let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push({url:page.url(),error:e.message}));
 await page.addInitScript(()=>{localStorage.setItem('classbank.startCheck.skip','1');});
 await page.goto('http://127.0.0.1:5592/curriculum');
 const manifest=await page.evaluate(async()=>Object.keys((await import('/src/lib/gamePages.ts')).GAME_PAGES));
 const selected=process.env.HISTORY_TYPES?.split(',');
 const undo=()=>page.getByRole('button',{name:'뒤로가기',exact:true}),redo=()=>page.getByRole('button',{name:'앞으로가기',exact:true});
 const settled=()=>page.waitForFunction(()=>window.__gameHistory&&!window.__gameHistory.restoring);
 // Snapshot gameplay state, excluding continuously moving visual/time fields and UI-only drafts.
 const state=()=>page.evaluate(()=>JSON.parse(JSON.stringify([...window.__gameHistory.capture().values].map(([id,value])=>[id,value?.state??value]).sort(([a],[b])=>a.localeCompare(b)),(key,value)=>value instanceof Node?undefined:/^(progress|liveIndex|countdown|secondsLeft|now|remaining|left|timeLeft|tick|frame|ms|elapsedMs|fruits|scale|naturalSize|hover|pointer|motion|ribbon)$/.test(key)?undefined:value)));
 for(const route of process.env.HISTORY_PHONICS?[]:manifest){const type=route.split('/').at(-1);if(selected&&!selected.includes(type))continue;
  try{
   await page.evaluate(url=>{history.pushState({usr:null,key:crypto.randomUUID(),idx:100},'',url);dispatchEvent(new PopStateEvent('popstate'));},route);
   await page.locator(`[data-game="${type}"] [data-game-canvas]`).waitFor();
   const start=page.locator('[data-game-start-card]').getByRole('button',{name:'게임 시작',exact:true});if(await start.isVisible())await start.click();
   await page.waitForTimeout(250);
   const nodeCount=await page.evaluate(()=>window.__gameHistory.nodes.size);assert(nodeCount>=3,`${type}: missing gameplay snapshot`);
   const region=page.locator('[data-game-history-region]');
   if(type==='quizshow'){
    await region.getByRole('button',{name:/미리보기 시작/}).click();
    await region.getByRole('button',{name:/첫 문제 시작/}).click();
    const openQuestion=region.getByRole('button',{name:/문제 열기/});if(await openQuestion.isVisible())await openQuestion.click();
   }
   const buttons=await region.locator('button:visible:not(:disabled)').allTextContents();
   if(process.env.HISTORY_DISCOVER){results.push({type,nodeCount,buttons:buttons.slice(0,24)});continue;}
   // Every route must support a real action followed by exact local state restoration.
   if(['findmissing','spellword','passball','catchsentence','shufflefind'].includes(type)){
     const phases={findmissing:'hidden',spellword:'input',passball:'revealed',catchsentence:'hidden',shufflefind:'pick'};
     await page.waitForFunction(wanted=>[...window.__gameHistory.capture().values.values()].some(value=>value?.state?.phase===wanted),phases[type],{timeout:45000});
   }
   const before=await state();let acted=false;if(process.env.HISTORY_DEBUG)console.log('BEFORE',before,await page.evaluate(()=>({undo:window.__gameHistory.canUndo,region:document.querySelectorAll('[data-game-history-region]').length})));
   if(type==='catchsentence'){await region.getByRole('button',{name:/^↻/}).click();acted=true;}
   if(type==='bomb'){await page.locator('[data-turn-advance]').click();acted=true;}
   if(type==='spellword'){await page.keyboard.press('x');acted=true;}
   if(type==='shopping'){await region.getByRole('button',{name:'시작',exact:true}).click();acted=true;}
   if(type==='quizshow'){await region.getByRole('button',{name:/정답 공개/}).first().click();acted=true;}
   if(type==='shufflefind'){await region.locator('button').filter({has:page.locator('[alt]')}).first().click();acted=true;}
   const candidates=region.locator('button:visible:not(:disabled)');
   for(let i=0;!acted&&i<Math.min(12,await candidates.count());i++){
    const button=candidates.nth(i),text=(await button.innerText()).trim();
    if(/^(대회 끝내기|샘플 자료|🔊|🔈|다시 듣기|편집|수정|삭제|추가|저장|이름|전체화면|소리|배경음)/.test(text))continue;
    await button.click({timeout:2500});await page.waitForTimeout(150);
    if(await undo().isEnabled()){acted=true;break;}if(process.env.HISTORY_DEBUG)console.log('NO HISTORY',text,await state(),await page.evaluate(()=>({pending:window.__gameHistory.pendingChanged,undo:window.__gameHistory.canUndo})));
   }
   assert(acted,`${type}: no reversible action: ${buttons.join(' | ')}`);
   const after=await state();if(type==='findmissing')await page.keyboard.press('Control+z');else await undo().click();await settled();assert.deepEqual(await state(),before,`${type}: undo differs`);
   assert(await redo().isEnabled(),`${type}: no redo`);if(type==='findmissing')await page.keyboard.press('Control+Shift+z');else await redo().click();await settled();assert.deepEqual(await state(),after,`${type}: redo differs`);
   results.push({type,nodeCount,pass:true});console.log('PASS',type,'real action / undo / redo');
  }catch(error){await page.screenshot({path:`scripts/games/history-failure-${type}.jpg`});results.push({type,error:error.message});console.log('FAIL',type,error.message.slice(0,220));}
 }
 if(process.env.HISTORY_PHONICS){
  const phonics=await page.evaluate(async()=>{
   const {PHONICS_GAMES,phonicsGameUnits,gameAvailability}=await import('/src/lib/phonicsGames.ts');const units=phonicsGameUnits();
   return PHONICS_GAMES.map(game=>({id:game.id,unit:units.find(unit=>!gameAvailability(game,unit))?.id}));
  });
  for(const game of phonics){if(selected&&!selected.includes(game.id))continue;
   try{
    await page.evaluate(url=>{history.pushState({usr:null,key:crypto.randomUUID(),idx:100},'',url);dispatchEvent(new PopStateEvent('popstate'));},`/phonics-games/${game.id}?unit=${encodeURIComponent(game.unit)}`);
    await page.locator('[data-game-start-card]').getByRole('button',{name:'게임 시작',exact:true}).click();
    await page.locator(`[data-phonics-session="${game.id}"]`).waitFor();
    const before=await state();await page.getByRole('button',{name:'힌트 보기',exact:true}).click();
    const after=await state();assert.notDeepEqual(before,after);
    await undo().click();await settled();assert.deepEqual(await state(),before);
    await redo().click();await settled();assert.deepEqual(await state(),after);
    if(game.id==='sound-balloons'){
     await page.getByRole('button',{name:'힌트 보기',exact:true}).click();
     const beforeAnswer=await state();await page.locator('.pg-options [data-hint="true"]').first().click();
     await page.locator('.pg-next:not(:disabled)').waitFor();const solved=await state();
     await undo().click();await settled();assert.deepEqual(await state(),beforeAnswer);
     await redo().click();await settled();assert.deepEqual(await state(),solved);
     await page.locator('.pg-next').click();const next=await state();
     await undo().click();await settled();assert.deepEqual(await state(),solved);
     await redo().click();await settled();assert.deepEqual(await state(),next);
     console.log('PASS phonics solved answer / stars / round remount restore');
    }
    results.push({type:game.id,pass:true});console.log('PASS phonics',game.id,'hint / undo / redo');
   }catch(error){results.push({type:game.id,error:error.message});console.log('FAIL phonics',game.id,error.message.slice(0,220));}
  }
 }
 const output=process.env.HISTORY_OUTPUT??'scripts/games/history-matrix-results.json';
 await writeFile(output,JSON.stringify({results,errors},null,2));
 if(process.env.HISTORY_SHOT){await mkdir(process.env.HISTORY_SHOT,{recursive:true});await page.screenshot({path:process.env.HISTORY_SHOT+'/history-toolbar.jpg'});}
 assert.equal(results.filter(r=>r.error).length,0,'History matrix failures (see '+output+')');assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
