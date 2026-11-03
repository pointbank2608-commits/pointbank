// 문법별 게임 4종을 실제 Chrome 에서 끝까지 플레이한다(임시 하네스 gharness.html). 운영 DB 연결 없음.
//   node app/scripts/grammar/check-grammar-games-browser.mjs   (app 폴더에서)
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const server = await createServer({ cacheDir: 'node_modules/.vite/qa-grammar-games', server: { host: '127.0.0.1', port: 5271, strictPort: true }, logLevel: 'error' });
await server.listen();
const base = 'http://127.0.0.1:5271/gharness.html';
const gg = await server.ssrLoadModule('/src/lib/grammarGames.ts');
const gb = await server.ssrLoadModule('/src/lib/grammarGamesB.ts');
let browser; let failed = 0;
const test = async (n, f) => { try { await f(); console.log('ok  ', n); } catch (e) { failed++; console.log('FAIL', n, '\n     ', e.message.split('\n')[0]); } };
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(() => { localStorage.setItem('classbank.lang', 'ko'); });
  const errors = [];
  const open = async (type, g = 'third-s') => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}?type=${type}&g=${g}`);
    return page;
  };

  await test('문장 변신 연구소: 정답 칩을 순서대로 누르면 +1, 끝까지 가면 결과', async () => {
    const page = await open('grammarlab');
    const rounds = gg.labRounds('third-s', 1);
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      await page.getByText(`${i + 1}/${rounds.length}`).first().waitFor();
      const words = r.to.replace(/[.?]$/, '').split(/\s+/);
      for (const w of words) {
        const chip = page.locator('button[lang=en]:not([disabled])').filter({ hasText: new RegExp(`^${w}$`) }).last();
        await chip.click();
      }
      await page.getByRole('button', { name: '확인' }).first().click();
      await page.getByText('정답! +1점').waitFor();
      await page.getByRole('button', { name: '다음' }).first().click();
    }
    await page.getByText('게임 끝!').waitFor();
    assert.ok(await page.getByText('우승!').count());
    await page.close();
  });

  await test('문장 변신 연구소: 틀리면 정답을 알려 준다', async () => {
    const page = await open('grammarlab');
    await page.locator('button[lang=en]:not([disabled])').first().click();
    await page.getByRole('button', { name: '확인' }).first().click();
    await page.getByText('정답은').waitFor();
    await page.close();
  });

  await test('주어·동사 짝꿍: 정답을 고르면 초록, 끝까지', async () => {
    const page = await open('grammarverb', 'third-s');
    const rounds = gg.verbRounds('third-s', 1);
    for (let i = 0; i < rounds.length; i++) {
      await page.getByRole('button', { name: new RegExp(`^${rounds[i].answer}$`) }).first().click();
      await page.getByRole('button', { name: '다음' }).first().click();
    }
    await page.getByText('게임 끝!').waitFor();
    await page.close();
  });

  await test('문법 경매: 입찰·마감·결과 표시', async () => {
    const page = await open('grammarauction', 'third-s');
    const lots = gg.auctionLots('third-s', 1);
    for (let i = 0; i < lots.length; i++) {
      await page.getByRole('button', { name: '10 올리기' }).first().click();
      await page.getByRole('button', { name: '경매 마감!' }).click();
      await page.getByText(lots[i].ok ? '맞는 문장이에요' : '틀린 문장이에요').waitFor();
      if (i === 0) {
        const coins = await page.locator('ul[aria-label="팀 점수"]').innerText();
        assert.ok(/9[0-9]|110/.test(coins.replace(/\s/g, '')) || /1\d\d|90/.test(coins), coins);
      }
      await page.getByRole('button', { name: /다음 물건|결과 보기/ }).click();
    }
    await page.getByText('게임 끝!').waitFor();
    await page.close();
  });

  await test('조건 영작 대결: 모범 답 보기 → 팀 점수 토글', async () => {
    const page = await open('grammarwrite', 'third-s');
    const rounds = gg.writeRounds('third-s', 1);
    await page.getByRole('button', { name: '모범 답 보기' }).first().click();
    await page.getByText(rounds[0].model).waitFor();
    await page.getByRole('button', { name: /1팀/ }).filter({ hasText: '+1' }).click();
    assert.ok((await page.locator('ul[aria-label="팀 점수"]').innerText()).includes('1팀 · 1'));
    await page.getByRole('button', { name: /^다음/ }).last().click();
    await page.close();
  });


  await test('품사 탐험: 정답 낱말을 눌러 끝까지', async () => {
    const page = await open('grammarpos', 'prepositions');
    const rounds = gb.posRounds('prepositions', 1);
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      await page.locator('button[lang=en]').nth(r.correct[0]).click();
      await page.getByText('정답! +1점').waitFor();
      await page.getByRole('button', { name: '다음' }).first().click();
    }
    await page.getByText('게임 끝!').waitFor();
    await page.close();
  });
  await test('품사 탐험: 틀리면 정답을 알려 준다', async () => {
    const page = await open('grammarpos', 'prepositions');
    const r = gb.posRounds('prepositions', 1)[0];
    const wrong = r.tokens.findIndex((_, k) => !r.correct.includes(k));
    await page.locator('button[lang=en]').nth(wrong).click();
    await page.getByText('정답은').waitFor();
    await page.close();
  });
  await test('문장 뼈대 조립소: 조각을 칸에 놓고 확인', async () => {
    const page = await open('grammarframe', 'third-s');
    const rounds = gb.frameRounds('third-s', 1);
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      for (const slot of ['subject', 'verb', 'rest']) {
        await page.locator('button[lang=en]:not([disabled])').filter({ hasText: new RegExp(`^${r[slot]}$`) }).first().click();
        await page.getByRole('button', { name: slot === 'subject' ? '주어' : slot === 'verb' ? '동사' : '나머지' }).click();
      }
      await page.getByRole('button', { name: '확인' }).first().click();
      await page.getByText(`✅ ${r.sentence}`).waitFor();
      await page.getByRole('button', { name: '다음' }).first().click();
    }
    await page.getByText('게임 끝!').waitFor();
    await page.close();
  });
  for (const [type, gid, getAnswers] of [
    ['grammarcompare', 'comparative', () => gb.compareRounds('comparative', 1).map((r) => r.answer)],
    ['grammarlink', 'and-but', () => gb.linkRounds('and-but', 1).map((r) => r.answer)],
    ['grammarhabit', 'frequency', () => gb.habitRounds('frequency', 1).map((r) => r.answer)],
  ]) {
    await test(`${type}: 정답을 골라 끝까지`, async () => {
      const page = await open(type, gid);
      for (const answer of getAnswers()) {
        await page.getByRole('button', { name: new RegExp(`^${answer.replace(/[.*+?^${}()|[\]\\]/g, '\$&')}$`) }).first().click();
        await page.getByText('정답! +1점').waitFor();
        await page.getByRole('button', { name: '다음' }).first().click();
      }
      await page.getByText('게임 끝!').waitFor();
      await page.close();
    });
  }
  await test('자료가 부족한 문법은 안내 문구', async () => {
    const page = await open('grammarverb', 'no-such-grammar');
    await page.getByText('아직 이 게임을 만들 수 없어요').waitFor();
    await page.close();
  });

  await test('모바일 폭에서 가로 넘침 없음', async () => {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`${base}?type=grammarlab&g=third-s`);
    await page.getByText('1/').first().waitFor();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `overflow ${over}`);
    await page.screenshot({ path: '../output/grammar-games-lab-mobile.png' });
    await page.close();
  });
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server.close();
}
if (failed) { console.log(`\n${failed}개 실패`); process.exit(1); }
console.log('\n전부 통과');
