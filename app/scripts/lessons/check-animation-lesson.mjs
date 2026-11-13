import assert from 'node:assert/strict';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createLessonUxServer} from './ux-server.mjs';

assert.ok(process.env.ANIMATION_PRINT_FIXTURE);
const server=await createLessonUxServer(5417);
await server.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.setDefaultTimeout(35000);
 const base='http://127.0.0.1:5417';
 for(const [title,minutes] of [['Dad Takes the Seesaw',30],["Mum's Washing Game",40],['The Ball in the Tree',30]]){
  await page.goto(base+'/materials/videos',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:new RegExp(title)}).first().click();
  await page.getByRole('radio',{name:minutes+'분'}).check();
  await page.getByRole('button',{name:'이 영상으로 수업 만들기',exact:true}).click();
  const form=page.locator('[data-lesson-edit-form]');
  const slides=form.locator('[data-slide-id]');
  await slides.nth(10).waitFor();
  await form.getByRole('button',{name:'저장',exact:true}).click();
  await form.waitFor({state:'hidden'});
  const saved=await page.evaluate(title=>window.__lessonQA.lessons.find(row=>row.name.includes(title)),title);
  assert.equal(saved.playlist[0].elements[0].text,title);
  assert.equal(saved.playlist.at(-1).elements[0].text,'One last sentence');
  assert.equal(saved.playlist.reduce((sum,slide)=>sum+(slide.animationGuide?.minutes??0),0),minutes);
  const video=saved.playlist.find(slide=>slide.kind==='video');
  assert.ok(video.clipId&&video.startSec<video.endSec);
  await page.reload({waitUntil:'domcontentloaded'});
  const card=page.locator('#lesson-card-'+saved.id);
  await card.getByRole('button',{name:'수정',exact:true}).click();
  assert.equal(await slides.count(),saved.playlist.length);
  await slides.first().click();
  await form.getByRole('button',{name:/이 슬라이드부터 발표/}).click();
  const next=page.locator('[data-lesson-runner-bar]').getByRole('button',{name:'다음 활동',exact:true});
  for(const [index,slide] of saved.playlist.entries()){
   await page.waitForURL(new RegExp(slide.id));
   if(index<saved.playlist.length-1)await next.click();
  }
  await page.locator('[data-text-body]').getByText('One last sentence',{exact:true}).or(page.locator('[data-text-body]').filter({hasText:'One last sentence'})).first().waitFor();
  console.log('PASS',title,minutes,'save, reload, present all slides');
 }
} finally {
 await browser.close();
 await server.close();
}
