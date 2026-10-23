import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),out=resolve(root,'../output/minigame-sound');mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync(resolve(root,'public/sounds/minigames/manifest.json'),'utf8'));
const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:5189,strictPort:true,hmr:false}});await server.listen();
let browser;const results=[],errors=[];const pass=s=>{results.push(s);console.log('PASS',s);};
const instrument=()=>{
 window.__sounds=[];window.__activeSounds=new Set();let serial=0;
 const nativeStart=AudioBufferSourceNode.prototype.start,nativeStop=AudioBufferSourceNode.prototype.stop;
 AudioBufferSourceNode.prototype.start=function(...args){const id=++serial;this.__testId=id;const samples=this.buffer.getChannelData(0);let energy=0;for(let i=0;i<samples.length;i++)energy+=samples[i]*samples[i];window.__sounds.push({id,duration:this.buffer.duration,rms:Math.sqrt(energy/samples.length),state:this.context.state});window.__activeSounds.add(id);this.addEventListener('ended',()=>window.__activeSounds.delete(id));return nativeStart.apply(this,args);};
 AudioBufferSourceNode.prototype.stop=function(...args){window.__activeSounds.delete(this.__testId);return nativeStop.apply(this,args);};
};
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 async function open(game,touch=false,sound=true){const ctx=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1200,height:1000},hasTouch:touch,isMobile:touch});await ctx.addInitScript(instrument);const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));const story=['feedmonster','sentencebridge','sentencetower'].includes(game);await page.goto(`http://127.0.0.1:5189/scripts/games/${story?'storybook':'adventure'}.html?game=${game}${sound?'&sound':''}`);await page.getByRole('button',{name:/게임 시작/})[touch?'tap':'click']();return{page,ctx};}
 async function played(page,duration){await page.waitForFunction(duration=>window.__sounds.some(s=>Math.abs(s.duration-duration)<.002),duration);const played=await page.evaluate(duration=>window.__sounds.find(s=>Math.abs(s.duration-duration)<.002),duration);assert.equal(played.state,'running');assert.ok(played.rms>.002);}
 async function arrange(page,tokens){const nodes=page.locator('[data-piece]');for(let i=0;i<tokens.length;i++){if(await nodes.nth(i).getAttribute('data-piece-text')===tokens[i])continue;const texts=await nodes.evaluateAll(ns=>ns.map(n=>n.dataset.pieceText));const j=texts.findIndex((t,k)=>k>i&&t===tokens[i]);assert.ok(j>=0);await nodes.nth(i).click();await nodes.nth(j).click();}}
 const games=['feedmonster','sentencebridge','sentencetower','balloonpop','wordtrain','wordfishing','sentencerocket','grammardetective','treasurehunt','wordclaw'];
 const durations={feedmonster:.9,sentencebridge:.8,sentencetower:.95,balloonpop:.52,wordtrain:1.85,wordfishing:1.15,sentencerocket:.8,grammardetective:.65,treasurehunt:.3,wordclaw:1.35};
 for(const game of games){const{page,ctx}=await open(game);await played(page,.8);await page.evaluate(()=>{window.__sounds=[];});
  if(game==='feedmonster'){await page.locator('[data-choice="apple"]').click();await page.getByRole('button',{name:'몬스터에게 먹이 주기',exact:true}).click();}
  else if(game==='sentencebridge')await page.locator('[data-choice="goes"]').click();
  else if(game==='sentencetower')await page.locator('[data-choice="soccer"]').click();
  else if(game==='balloonpop'||game==='wordfishing')await page.locator('[data-word="apple"]').click({force:true});
  else if(game==='wordtrain'||game==='sentencerocket'){await arrange(page,game==='wordtrain'?['The','monkeys','are','eating','bananas.']:['The monkey','is eating','a banana.']);await page.getByRole('button',{name:game==='wordtrain'?'출발! 문장 확인':'연료 채우기 · 문장 확인',exact:true}).click();}
  else if(game==='grammardetective'){await page.locator('.ad-evidence').getByRole('button',{name:'go',exact:true}).click();await page.locator('.ad-choices').getByRole('button',{name:'goes',exact:true}).click();}
  else if(game==='treasurehunt')await page.locator('[data-target="big-tree:under"]').click({force:true});
  else{await page.locator('[data-word="eat"]').click();await page.getByRole('button',{name:'집게 내리기',exact:true}).click();await played(page,.85);}
  await played(page,durations[game]);
  if(game==='sentencerocket'){
    for(const tokens of [['My friends','are playing','in the park.'],['We','read books','after school.']]){await page.locator('.ad-review').waitFor();await page.locator('.ad-review .ad-primary').click();await arrange(page,tokens);await page.getByRole('button',{name:'연료 채우기 · 문장 확인',exact:true}).click();}
    await page.locator('.ad-review').waitFor();await page.evaluate(()=>{window.__sounds=[];});await page.locator('.ad-review .ad-primary').click();await played(page,2.65);assert.equal(await page.evaluate(()=>window.__sounds.filter(s=>Math.abs(s.duration-.22)<.002).length),3);pass('Actual rocket finale plays three countdowns then launch');
  }
  if(game==='treasurehunt'){
    for(const target of ['house:right','rock:behind']){await page.locator('.ad-review').waitFor();await page.locator('.ad-review .ad-primary').click();await page.locator(`[data-target="${target}"]`).click({force:true});}await played(page,1.5);await page.locator('.ad-review').waitFor();await page.locator('.ad-review .ad-primary').click();await played(page,1.85);pass('Final map clue opens treasure sound; completed game plays fanfare');
  }
  await ctx.close();pass(`${game}: first gesture unlock and real decoded action sound`);
 }
 const mobile=await open('balloonpop',true);await played(mobile.page,.8);await mobile.page.locator('[data-word="apple"]').tap({force:true});await played(mobile.page,.52);await mobile.ctx.close();pass('Mobile touch unlocks audio and plays balloon pop');
 const quiet=await open('balloonpop',false,false);await quiet.page.locator('[data-word="apple"]').click({force:true});await quiet.page.waitForTimeout(500);assert.equal(await quiet.page.evaluate(()=>window.__sounds.length),0);await quiet.ctx.close();pass('Template sound off stays silent');
 const ctx=await browser.newContext();await ctx.addInitScript(instrument);const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5189/scripts/games/minigame-sound.html');
 const decoded=await page.evaluate(async manifest=>{const ctx=new AudioContext();const rows=[];for(const item of manifest.sounds){const response=await fetch(`/sounds/minigames/${item.name}.wav`);if(!response.ok)throw Error(item.name);const buffer=await ctx.decodeAudioData(await response.arrayBuffer());let energy=0,peak=0;for(const sample of buffer.getChannelData(0)){energy+=sample*sample;peak=Math.max(peak,Math.abs(sample));}rows.push({name:item.name,duration:buffer.duration,channels:buffer.numberOfChannels,peak,rms:Math.sqrt(energy/buffer.length)});}await ctx.close();return rows;},manifest);
 for(const row of decoded){assert.ok(row.peak<.68&&row.peak>.01);assert.ok(row.rms>.002);assert.equal(row.channels,1);assert.ok(Math.abs(row.duration-manifest.sounds.find(s=>s.name===row.name).seconds)<.002);}pass('All 25 WAVs fetch/decode with nonzero signal, no clipping and correct duration');
 await page.getByLabel('game',{exact:true}).selectOption('sentencerocket');await page.getByRole('button',{name:'launch',exact:true}).click();await played(page,2.65);await page.getByRole('button',{name:'global mute',exact:true}).click();assert.equal(await page.evaluate(()=>window.__activeSounds.size),0);const before=await page.evaluate(()=>window.__sounds.length);await page.getByRole('button',{name:'correct',exact:true}).click();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__sounds.length),before);await page.getByRole('button',{name:'global unmute',exact:true}).click();await page.getByRole('button',{name:'correct',exact:true}).click();await page.waitForFunction(before=>window.__sounds.length>before,before);pass('Global mute stops playing audio immediately; unmute permits only new actions');
 await page.getByLabel('game',{exact:true}).selectOption('wordclaw');await page.getByRole('button',{name:'delayed catch',exact:true}).click();await page.getByLabel('pause',{exact:true}).check();assert.equal(await page.evaluate(()=>window.__activeSounds.size),0);const paused=await page.evaluate(()=>window.__sounds.length);await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>window.__sounds.length),paused);await page.getByLabel('pause',{exact:true}).uncheck();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__sounds.length),paused);pass('Pause cancels current and queued sounds; resume never replays a stale catch');
 await page.getByLabel('game',{exact:true}).selectOption('sentencerocket');await page.getByRole('button',{name:'launch',exact:true}).click();await page.waitForFunction(()=>window.__activeSounds.size>0);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.evaluate(()=>window.__activeSounds.size),0);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.getByRole('button',{name:'launch',exact:true}).click();await page.waitForFunction(()=>window.__activeSounds.size>0);await page.getByLabel('game',{exact:true}).selectOption('balloonpop');assert.equal(await page.evaluate(()=>window.__activeSounds.size),0);pass('Hidden tab and unmounted game stop active rocket audio');
 await ctx.close();assert.deepEqual(errors,[]);writeFileSync(resolve(out,'results.json'),JSON.stringify({results,decoded,errors},null,2));
}finally{await browser?.close();await server.close();}
