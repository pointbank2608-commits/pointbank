import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {uxServer} from './server.mjs';
const out=resolve('../output/prelaunch-ux');mkdirSync(out,{recursive:true});const server=await uxServer(5402,true);let browser;
try{await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const go=path=>page.goto('http://127.0.0.1:5402/scripts/prelaunch-ux/fixture.html?go='+encodeURIComponent(path));
await go('/editor');await page.locator('textarea').first().waitFor();await page.screenshot({path:resolve(out,'before-video-editor.png'),fullPage:true});
await go('/video');await page.getByRole('button',{name:'전체화면',exact:true}).click();const before=await page.locator('.tv-video').boundingBox();await page.getByRole('button',{name:'수업 설정',exact:true}).click();await page.locator('[data-video-popup]').waitFor();const after=await page.locator('.tv-video').boundingBox();await page.screenshot({path:resolve(out,'before-fullscreen-settings.png')});writeFileSync(resolve(out,'before-geometry.json'),JSON.stringify({before,after},null,2));
await go('/qa');await page.getByText('QA launch list',{exact:true}).click();await page.locator('dialog[open]').waitFor();await page.screenshot({path:resolve(out,'before-duplicate-preparation.png'),fullPage:true});await page.locator('dialog[open]').getByRole('button',{name:'닫기',exact:true}).first().click();await page.locator('[data-game-ready-overlay] button').first().click();await page.screenshot({path:resolve(out,'before-wheel-desktop.png'),fullPage:true});
}finally{await browser?.close();await server.close();}
