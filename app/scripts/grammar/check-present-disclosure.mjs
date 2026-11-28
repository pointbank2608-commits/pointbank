import assert from 'node:assert/strict';
import { uxServer } from '../prelaunch-ux/server.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ||
  '../../node_modules/homework-test-tools/node_modules/playwright/index.mjs');
const port = 5493;
process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:'+port;
process.env.VITE_SUPABASE_ANON_KEY = 'local-test-key';
const server = await uxServer(port);
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const touch of [false, true]) {
    const page = await browser.newPage({ viewport: {width: 1366, height: 768}, hasTouch: touch });
    page.on('pageerror',error=>console.error(error.message));
    await page.goto('http://127.0.0.1:'+port+'/scripts/prelaunch-ux/fixture.html?go=/run');
    const start = page.getByRole('button', {name: 'QA start lesson'});
    await start.waitFor();
    await page.evaluate(() => {
      window.__ux.lessons[1].playlist = [{id:'modals', kind:'grammar', grammarId:'m-modals'}];
    });
    await start.click();
    await page.waitForURL('**/curriculum/test-video/slide/modals');
    const board = page.getByRole('region', {name:'문법 수업'});
    const question = board.locator('summary').filter({hasText:'이 밖에 어디에서 이 표현을 만날까요?'});
    const explanation = board.getByText(/May I use your pen\?/, {exact:false}).filter({visible:true});
    const press = element => touch ? element.tap() : element.click();
    async function expectStage(number) {
      // The presentation advances on a 260 ms timer to distinguish a double-click.
      await page.waitForTimeout(400);
      assert.equal(await board.locator('.workshop-chapter span').first().innerText(),number+' / 6단계');
    }
    await press(board.locator('.grammar-map-options button').first());
    await press(board.getByRole('button',{name:'더 궁금해요'}));
    await press(question);
    await expectStage(1);
    await explanation.waitFor();
    await press(explanation);
    await expectStage(1);
    assert(await explanation.isVisible());
    await press(question);
    await expectStage(1);
    assert.equal(await explanation.count(),0);
    await press(board.getByRole('button',{name:'다음 단계'}));
    await expectStage(2);
    const pair=board.locator('.grammar-scene-grid .scene-sentence');
    assert.equal(await pair.count(),2);
    for(const sentence of await pair.all()){
      assert(await sentence.evaluate(el=>{
        const area=el.closest('.workshop-body');
        const frame=area.getBoundingClientRect(), rect=el.getBoundingClientRect();
        return area.scrollTop===0 && rect.top>=frame.top && rect.bottom<=Math.min(frame.bottom,innerHeight);
      }),'Both examples must be visible when the comparison opens');
    }
    console.log((touch?'Touch':'Mouse')+' passed on the lesson presentation route');
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
