import assert from 'node:assert/strict';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createLessonUxServer} from '../lessons/ux-server.mjs';

process.env.VITE_LEARNING_SENSORS_ENABLED = 'false';
process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:5596';
process.env.VITE_SUPABASE_ANON_KEY = 'local-fixture-key';
const server = await createLessonUxServer(5596);
let browser;
try {
  await server.listen();
  browser = await chromium.launch({channel:'chrome', headless:true});
  const page = await browser.newPage({viewport:{width:1366,height:768}});
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('classbank.startCheck.skip', '1'));
  const url = 'http://127.0.0.1:5596/games/';
  await page.goto(url + 'wheel');
  await page.waitForFunction(() => window.__lessonQA?.lists.length);
  await page.evaluate(() => {
    const base = window.__lessonQA.lists.find(list => list.id === 'shared');
    window.__lessonQA.lists.push(
      {...base, id:'empty-list', name:'빈 자료', items:[]},
      {...base, id:'sentences', name:'연습 문장', kind:'sentence', items:base.items.map(row => ({...row, word:'I see the ' + row.word + '.'}))},
    );
    window.__saveLessonQA();
  });
  const button = name => page.getByRole('button',{name,exact:true});
  for (const game of ['wheel','order','twodice','lastbox','ladder']) {
    await page.goto(url + game);
    await button('내 단어/문장').click();
    const cards = page.locator('[data-saved-game-materials]');
    const empty = cards.getByRole('button',{name:/사용 불가 빈 자료/});
    await empty.waitFor();
    assert(await empty.isDisabled());
    const sentence = cards.getByRole('button',{name:/연습 문장 문장 모음/});
    const acceptsSentences = game === 'wheel' || game === 'lastbox';
    assert.equal(await sentence.isEnabled(), acceptsSentences);
    const target = acceptsSentences ? sentence : cards.getByRole('button',{name:/사용 가능 공용 단어장/});
    assert(await button('선택').isDisabled());
    const draft = () => page.evaluate(type => JSON.parse(sessionStorage.getItem('activity-draft:teacher:academy:' + type)), game);
    const before = await draft();
    await target.click();
    await button('닫기').click();
    await button('내 단어/문장').click();
    assert(await button('선택').isDisabled(), 'closing discards a pending choice');
    await target.click();
    await button('선택').click();
    await cards.waitFor({state:'detached'});
    const applied = await draft();
    if (game === 'ladder') {
      assert.deepEqual(applied.items, before.items);
      assert.deepEqual(applied.config.results.map(row => row.label), applied.items.map((_,i)=>['sun','moon','star','sky'][i] ?? '꽝'));
    } else {
      assert.equal(applied.items[0].label, acceptsSentences ? 'I see the sun.' : 'sun');
    }
    await button('내 단어/문장').click();
    assert.equal(await target.getAttribute('aria-pressed'), 'true');
    console.log('PASS', game, 'availability, cancel, apply and reopen');
  }
  await button('닫기').click();
  const snapshot = () => page.evaluate(()=>JSON.parse(sessionStorage.getItem('activity-draft:teacher:academy:ladder')));
  const normal = await snapshot();
  await button('게임설정').click();
  await button('단어 공부').click();
  await page.getByLabel('단어장',{exact:true}).selectOption('words-a');
  await page.getByLabel('출발 칸').selectOption('imageUrl');
  await page.getByLabel('도착 칸').selectOption('word');
  await page.getByText('단어 짝 편집',{exact:true}).click();
  await page.getByRole('button',{name:/^1\. apple/}).click();
  await page.getByRole('textbox',{name:'영어 단어',exact:true}).fill('green apple');
  await button('적용').click();
  const board = page.locator('[data-ladder-study]');
  await board.waitFor();
  const play = button('게임 시작');
  if(await play.isVisible()) await play.click();
  const seen = new Set();
  for(let turn=0;turn<9;turn++) {
    const ends = board.locator('[data-study-ends] button');
    assert.equal(await board.locator('[data-study-path]').count(),0);
    assert(await ends.first().isDisabled());
    const activeStart = board.locator('[data-study-starts] button:enabled').first();
    await activeStart.click();
    const word = await activeStart.locator('img').getAttribute('alt');
    assert(!seen.has(word));seen.add(word);
    const labels = await ends.allTextContents();
    const correctColumn = labels.indexOf(word);
    assert(correctColumn>=0);
    await ends.nth(turn===0?(correctColumn+1)%labels.length:correctColumn).click();
    const path = await board.locator('[data-study-path]').getAttribute('d');
    assert.equal(Number(path.split(' ').at(-2)),correctColumn*100+50);
    assert.match(await ends.nth(correctColumn).innerText(),/정답/);
    if(turn<8) await board.getByRole('button',{name:/다음 단어|다음 판/}).click();
  }
  assert(seen.has('green apple'));
  await board.getByRole('button',{name:'다시 하기'}).click();
  await button('저장/불러오기').click();
  await page.getByRole('textbox',{name:'저장할 이름'}).fill('Study ladder QA');
  await button('저장하기').click();
  await page.waitForFunction(()=>window.__lessonQA.templates.some(row=>row.name==='Study ladder QA' && row.config.ladderMode==='study'));
  await button('닫기').click();
  await button('게임설정').click();
  await button('일반 사다리').click();
  await button('적용').click();
  await page.locator('[data-ladder-participants]').waitFor();
  const restored = await snapshot();
  assert.deepEqual(restored.items,normal.items);
  assert.deepEqual(restored.config.results,normal.config.results);
  assert.equal(restored.config.ladderStudy.cards[0].word,'green apple');
  assert.equal(await page.evaluate(()=>window.__lessonQA.lists.find(row=>row.id==='words-a').items[0].word),'apple');
  await page.evaluate(()=>{window.__lessonQA.students={a:[{id:'s1',name:'민지'},{id:'s2',name:'서준'},{id:'s3',name:'하나'}]};});
  await button('반 설정').click();
  await page.locator('[data-class-settings-fields] select').selectOption('a');
  await page.getByText('민지, 서준, 하나').waitFor();
  await button('적용').click();
  await page.waitForFunction(()=>document.querySelector('[data-ladder-participants]')?.textContent.includes('민지'));
  assert.deepEqual((await snapshot()).items.map(item=>item.label),['민지','서준','하나']);
  await button('저장/불러오기').click();
  await page.locator('[data-game-toolbar-panel="saves"]').getByRole('button',{name:'Study ladder QA',exact:true}).click();
  await board.waitFor();
  assert.equal((await snapshot()).config.ladderStudy.cards[0].word,'green apple');
  console.log('PASS study ladder: edited image/word pairs, hidden paths, correct and incorrect guesses, every destination, next board, replay and classic roster/results');
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server.close();
}
