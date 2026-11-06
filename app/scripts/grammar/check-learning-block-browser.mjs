import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const harness = `import React from 'react';
import { createRoot } from 'react-dom/client';
import Preview from '/src/components/grammar/GrammarLearningPreview.tsx';
import { grammarBlockStep } from '/src/lib/grammarLearningContent.ts';
const item = (id, sentence) => ({
  id, sentence, prompt: '어떤 역할인가요?', correctOptionId: 'purpose',
  options: [
    { id: 'wish', text: '바라는 행동', feedback: '누가 바란다는 말이 있는지 찾아봐요.' },
    { id: 'purpose', text: '행동의 목적', feedback: '왜 그렇게 했는지 알려줘요.' },
  ],
});
const example = (sentence, chunks) => ({
  sentence, translation: '문장이 무슨 뜻인지 읽어 봐요.', chunks, why: '뒤에 오는 행동이 어떤 질문에 답하는지 봐요.',
});
const lesson = {
  goalId: 'test-goal', grammarIds: ['m-to-inf-noun'], version: 1, title: '테스트 문법',
  objective: '두 문장의 뜻을 비교해요.', rule: '뒤의 행동이 답하는 질문을 찾아요.',
  boundary: '같은 형태도 문장에서 하는 일이 달라요.',
  examples: [
    example('I want to play.', [{ text: 'I want', role: '나는 원해요' }, { text: 'to play.', role: '무엇을?' }]),
    example('I went out to play.', [{ text: 'I went out', role: '나는 나갔어요' }, { text: 'to play.', role: '왜?' }]),
  ],
  reasoning: item('reason', 'I went to the store to buy milk.'),
  repair: { explanation: '먼저 앞부분만 읽어 봐요.', example: example('I ran to catch the bus.', []),
    practice: item('practice', 'She sat down to rest.') },
  transfer: item('transfer', 'He opened the box to look inside.'),
  delayed: item('delayed', 'Mina turned on the lamp to read.'),
};
window.publicTransfer = grammarBlockStep(lesson, 'transfer');
createRoot(document.getElementById('root')).render(React.createElement(Preview, { lesson }));`;

const server = await createServer({
  root,
  logLevel: 'error',
  server: { host: '127.0.0.1' },
  plugins: [{
    name: 'grammar-learning-test',
    resolveId(id) {
      if (id === '/__grammar-preview-entry.tsx') return '\0grammar-preview-entry.tsx';
    },
    load(id) {
      if (id === '\0grammar-preview-entry.tsx') return harness;
    },
    configureServer(vite) {
      vite.middlewares.use('/__grammar-learning-test', async (_req, res, next) => {
        try {
          const html = await vite.transformIndexHtml('/__grammar-learning-test', '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/tailwind.css"><div id="root"></div><script type="module" src="/__grammar-preview-entry.tsx"></script></html>');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (error) { next(error); }
      });
    },
  }],
});

let browser;
const errors = [];
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 840 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(origin) && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(new URL('__grammar-learning-test', origin).href);
  const button = name => page.getByRole('button', { name, exact: true });
  await page.getByText('I want to play.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const safeStep = await page.evaluate(() => window.publicTransfer);
  assert.equal(safeStep.item.correctOptionId, undefined);
  assert.ok(safeStep.item.options.every(option => !('feedback' in option)));
  await button('이유 골라 보기').click();
  await button('바라는 행동').click();
  await page.getByText('누가 바란다는 말이 있는지 찾아봐요.').waitFor();
  await button('계속하기').click();
  await page.getByText('먼저 앞부분만 읽어 봐요.').waitFor();
  await button('연습해 보기').click();
  await button('행동의 목적').click();
  await page.getByText('왜 그렇게 했는지 알려줘요.').waitFor();
  await button('계속하기').click();
  await page.getByText('He opened the box to look inside.').waitFor();
  assert.equal(await page.getByText('Mina turned on the lamp to read.').count(), 0);
  await button('행동의 목적').click();
  await button('계속하기').click();
  await button('지연 확인 미리 보기').click();
  await page.getByText('Mina turned on the lamp to read.').waitFor();
  await button('행동의 목적').click();
  await button('계속하기').click();
  await page.getByText('미리보기가 끝났어요.').waitFor();
  await button('처음부터 다시 보기').click();
  await button('이유 골라 보기').click();
  await button('행동의 목적').click();
  await button('계속하기').click();
  await page.getByText('He opened the box to look inside.').waitFor();
  assert.deepEqual(errors, []);
  console.log('Grammar preview: feedback, repair, independent transfer, simulated delayed check and public item shape passed.');
} finally {
  await browser?.close();
  await server.close();
}
