import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createLessonUxServer} from '../lessons/ux-server.mjs';
process.env.VITE_SUPABASE_URL='http://127.0.0.1:5594';
process.env.VITE_SUPABASE_ANON_KEY='local-fixture-key';
process.env.VITE_LEARNING_SENSORS_ENABLED='false';
const server=await createLessonUxServer(5594);let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
 await page.addInitScript(()=>{localStorage.setItem('classbank.startCheck.skip','1');localStorage.setItem('classbank.selectedClassId','a');});
 await page.goto('http://127.0.0.1:5594/games/wordhoops');
 await page.getByRole('button',{name:'게임설정',exact:true}).waitFor();
 await page.evaluate(()=>{
  const base=window.__lessonQA.lists[0];
  window.__lessonQA.lists=[26,42].map(n=>({...base,id:'hoops-'+n,name:'전체 슛 검증 '+n,items:Array.from({length:n},(_,i)=>({id:'word-'+i,word:'word'+i,meaning:'뜻'+i}))}));
  window.__saveLessonQA();
 });
 await page.reload();
 const settings=()=>page.getByRole('button',{name:'게임설정',exact:true});
 const shots=()=>page.getByRole('spinbutton',{name:'슛 수(정해진 슛일 때)',exact:true});
 for(const count of [26,42]){
  await page.getByRole('button',{name:'내 단어/문장',exact:true}).click();
  await page.getByRole('button',{name:new RegExp('전체 슛 검증 '+count)}).click();
  await page.getByRole('button',{name:'선택',exact:true}).click();
  await page.locator('[data-saved-game-materials]').waitFor({state:'hidden'});
  await settings().click();
  await page.locator('[data-hoops-all-shots]').click();
  assert.equal(await shots().inputValue(),String(count));
  assert.equal(await page.locator('[data-hoops-all-shots]').getAttribute('aria-pressed'),'true');
  if(count===42&&process.env.HOOPS_ALL_OUTPUT){await mkdir(process.env.HOOPS_ALL_OUTPUT,{recursive:true});await shots().scrollIntoViewIfNeeded();await page.screenshot({path:process.env.HOOPS_ALL_OUTPUT+'/all-shots-settings.jpg'});}
  await page.getByRole('button',{name:'적용',exact:true}).click();
  await page.getByText('슛 1/'+count,{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'저장/불러오기',exact:true}).click();
  await page.getByRole('textbox',{name:'저장할 이름',exact:true}).fill('전체 슛 '+count);
  await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await page.waitForFunction(n=>window.__lessonQA.templates.some(row=>row.name==='전체 슛 '+n&&row.config.hoopsShots===n),count);
  await page.reload();
  await page.getByRole('button',{name:'저장/불러오기',exact:true}).click();
  await page.getByRole('button',{name:'전체 슛 '+count,exact:true}).click();
  await settings().click();assert.equal(await shots().inputValue(),String(count));
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  console.log('PASS',count,'words: All button, court total, save, reload and reopen');
 }
 await settings().click();await shots().fill('7');await page.getByRole('button',{name:'적용',exact:true}).click();
 await page.getByText('슛 1/7',{exact:true}).first().waitFor();
 console.log('PASS manual shot count remains editable');assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
