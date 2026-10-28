// 문장 은행 선택기(상황·말하기 목적·문장 패턴)를 브라우저로 확인한다: node scripts/sentences/check-picker.mjs
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({ root, server: { port: 5196, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1500 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5196/scripts/sentences/harness.html');
await page.getByRole('button', { name: /문장 은행에서 담기/ }).click();
const rows = () => page.locator('ul li').count();
const box = page.locator('input[type=checkbox]');

// 1) 상황·주제(기존)
assert.equal(await rows(), 8);
// 2) 말하기 목적
await page.getByRole('button', { name: '말하기 목적', exact: true }).first().click();
await page.getByRole('button', { name: '부탁하기·허락 구하기' }).click();
assert.equal(await rows(), 8);
await box.nth(0).check();
await box.nth(1).check();
// 3) 문장 패턴 — 모든 상황·목적에서 같은 구조를 모아 보여 준다
await page.getByRole('button', { name: '문장 패턴', exact: true }).first().click();
const patternChips = page.locator('button', { hasText: / … \d+$/ });
const nChips = await patternChips.count();
assert(nChips >= 3, `패턴 칩 ${nChips}`);
const firstText = (await patternChips.first().innerText()).trim();
const firstCount = Number(firstText.match(/(\d+)$/)[1]);
assert.equal(await rows(), firstCount, '첫 패턴의 문장 수가 칩 숫자와 같아야 함');
const pat = firstText.replace(/ … \d+$/, '');
const texts = await page.locator('ul li span.font-body-md').allInnerTexts();
assert(texts.every((x) => x.toLowerCase().startsWith(pat.toLowerCase())), `모든 문장이 "${pat}"로 시작: ${texts.slice(0, 3)}`);
await box.nth(0).check();
// 두 번째 패턴으로 바꾸면 목록이 바뀐다
if (nChips > 1) {
  await patternChips.nth(1).click();
  const second = await page.locator('ul li span.font-body-md').first().innerText();
  assert(!second.toLowerCase().startsWith(pat.toLowerCase()) || firstText === (await patternChips.nth(1).innerText()).trim());
}
await page.waitForTimeout(400);
assert.equal(await page.locator('button.bg-primary', { hasText: / … \d+$/ }).count(), 1, '활성 패턴 칩은 하나');
await page.getByRole('button', { name: /3개 담기/ }).click();
const got = await page.evaluate(() => window.got);
assert.equal(got.length, 3);
assert(got.every((l) => l.includes(' | ')), got.join('\n'));
await page.screenshot({ path: 'scripts/sentences/picker.png' });
assert.deepEqual(errors, []);
console.log(`통과: 패턴 칩 ${nChips}개, 첫 패턴 "${pat}" ${firstCount}문장, 담기 ${got.length}개`);
await browser.close();
await server.close();
