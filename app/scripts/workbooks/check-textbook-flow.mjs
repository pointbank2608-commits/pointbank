import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const apiExports = [...readFileSync(new URL('../../src/lib/api.ts', import.meta.url), 'utf8')
  .matchAll(/export (?:async )?function (\w+)|export const (\w+)/g)].map(match => match[1] || match[2]);
const origin = 'https://textbook-check.invalid';
const fixture = `
  import {createRoot} from 'react-dom/client';
  import {BrowserRouter, Route, Routes} from 'react-router-dom';
  import WordListsPage from '/src/pages/WordListsPage';
  import WorksheetStudio from '/src/components/worksheets/WorksheetStudio';
  import i18n from '/src/i18n';
  import '/src/tailwind.css';
  void i18n.changeLanguage('ko');
  history.replaceState({}, '', new URLSearchParams(location.search).get('start'));
  createRoot(document.getElementById('root')).render(<BrowserRouter><Routes>
    <Route path="/wordlists" element={<WordListsPage/>}/>
    <Route path="/materials/worksheet" element={<WorksheetStudio/>}/>
  </Routes></BrowserRouter>);
`;
const api = `
  const lists = async () => (await fetch('${origin}/word_lists')).json();
  const mocks = {fetchAllWordLists: lists, fetchWordLists: lists,
    wordListKindOf: l => l.kind || 'word', fetchPhonicsBankResult: async () => ({entries: [], mediaAvailable: false})};
  ${apiExports.map(name => `export const ${name} = (...args) => (mocks.${name} || (async () => []))(...args);`).join('\n')}
`;
const bundle = await build({
  root, logLevel: 'error',
  build: { write: false, minify: false, copyPublicDir: false, rollupOptions: { input: resolve(root, 'scripts/games/focus.html') } },
  plugins: [{ name: 'textbook-check', enforce: 'pre', load(id) {
    const path = id.replaceAll('\\', '/');
    if (path.endsWith('/scripts/games/focus.tsx')) return fixture;
    if (path.endsWith('/src/lib/api.ts')) return api;
    if (path.endsWith('/src/lib/supabase.ts')) return `import {createClient} from '@supabase/supabase-js'; export const supabase=createClient('${origin}','fake-key',{auth:{persistSession:false}});`;
    if (path.endsWith('/context/AuthContext.tsx')) return 'export const useAuth=()=>({academy:{id:"academy",features:{}},profile:{id:"teacher"},session:{user:{id:"teacher"}},hasFullAccess:true});';
    if (path.endsWith('/context/ToastContext.tsx')) return 'export const useToast=()=>({notify:()=>{},run:async(fn)=>{await fn();return true;}});';
  }}],
});
const assets = new Map(bundle.output.map(file => ['/' + file.fileName, file.type === 'chunk' ? file.code : file.source]));

const units = [], lists = [], sheets = [];
const extraction = {
  words: [
    { text: 'river', meaning: '강', page: 1, meaningSuggested: false },
    { text: 'forest', meaning: '숲', page: 1, meaningSuggested: true },
    { text: 'discard this', meaning: '제외', page: 1, meaningSuggested: true },
  ],
  sentences: [{ text: 'We walk by the river.', meaning: '우리는 강가를 걸어요.', page: 1, meaningSuggested: true }],
  unclearPages: [],
};
let uploadCount = 0;
let failSave = true;
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.route('http://127.0.0.1:5387/**', route => {
    const path = new URL(route.request().url()).pathname;
    const contentType = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
    const body = assets.get(path);
    return body ? route.fulfill({ contentType, body: Buffer.from(body) }) : route.fulfill({ status: 404 });
  });
  await page.route(`${origin}/**`, async route => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    const respond = (json, status = 200) => route.fulfill({
      json, status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    });
    if (request.method() === 'OPTIONS') return respond(null);
    if (pathname === '/word_lists') return respond(lists);
    if (pathname.endsWith('/extract-textbook')) {
      const body = request.postData();
      assert.match(body, /name="files"; filename="pages.png"/);
      return respond(extraction);
    }
    if (pathname.includes('/object/textbook-originals/')) { uploadCount++; return respond({ Key: pathname }); }
    if (pathname.endsWith('/save_textbook_unit')) {
      if (failSave) { failSave = false; return respond({ message: 'temporary failure' }, 503); }
      const input = request.postDataJSON();
      const unit = { id: input.p_id, textbook: input.p_textbook, title: input.p_title, files: input.p_files,
        word_list_id: 'word-list', sentence_list_id: 'sentence-list' };
      units.push(unit);
      lists.push({ id: 'word-list', kind: 'word', name: 'Field Trip · Unit 1', items: input.p_words },
        { id: 'sentence-list', kind: 'sentence', name: 'Field Trip · Unit 1', items: input.p_sentences });
      return respond(unit);
    }
    if (pathname.endsWith('/textbook_units')) return respond(units);
    if (pathname.endsWith('/textbook_worksheets')) {
      if (request.method() === 'POST') {
        const next = request.postDataJSON();
        const existing = sheets.findIndex(sheet => sheet.id === next.id);
        if (existing === -1) sheets.push(next);
        else sheets[existing] = next;
        return respond({}, 201);
      }
      return respond(searchParams.has('id') ? sheets.find(sheet => `eq.${sheet.id}` === searchParams.get('id')) : sheets);
    }
    return respond([]);
  });
  const base = 'http://127.0.0.1:5387/scripts/games/focus.html?start=';
  const go = path => page.goto(base + encodeURIComponent(path));
  await go('/wordlists');
  await page.getByRole('button', { name: '내 교재', exact: true }).click();
  await page.getByRole('button', { name: '교재 단원 추가' }).click();
  await page.getByLabel('교재 이름').fill('Field Trip');
  await page.getByLabel('단원 이름').fill('Unit 1');
  assert.equal(await page.getByLabel('교재 촬영').getAttribute('capture'), 'environment');
  await page.getByLabel('이미지·PDF 선택').setInputFiles({
    name: 'pages.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/kf8AAAAASUVORK5CYII=', 'base64'),
  });
  await page.getByRole('button', { name: '단어·문장 자동 추출' }).click();
  await page.getByText('단어·문장 확인', { exact: true }).waitFor();
  await page.getByLabel('한국어 뜻', { exact: true }).nth(1).fill('숲속');
  await page.getByLabel('저장할 항목', { exact: true }).nth(2).uncheck();
  await page.getByRole('button', { name: '확인한 자료와 단원 저장' }).click();
  await page.getByText('저장하지 못했어요. 다시 시도해 주세요.').waitFor();
  assert.equal(await page.getByLabel('한국어 뜻', { exact: true }).nth(1).inputValue(), '숲속');
  await page.getByRole('button', { name: '확인한 자료와 단원 저장' }).click();
  await page.getByRole('link', { name: '문장으로 활동지 만들기' }).waitFor();
  assert.equal(uploadCount, 2);
  assert.deepEqual(lists[0].items.map(item => [item.word, item.meaning]), [['river', '강'], ['forest', '숲속']]);
  assert.equal(lists[1].items[0].word, 'We walk by the river.');
  assert.equal(units.length, 1);

  await go('/materials/worksheet');
  await page.getByRole('button', { name: '내 교재에서 만들기' }).click();
  await page.getByRole('button', { name: '문장 모음 · 1' }).click();
  await page.locator('[data-worksheet-source]').getByText('Field Trip · Unit 1').waitFor();
  await page.locator('[data-activity-card="sentenceOrder"] .ws-card-actions .ws-primary').click();
  await page.getByRole('button', { name: '단원에 활동지 담기' }).click();
  await page.getByRole('button', { name: '단원 활동지 업데이트' }).waitFor();
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].unit_id, units[0].id);
  assert.equal(sheets[0].document.words[0].word, 'We walk by the river.');
  await page.getByRole('link', { name: /저장할 단원/ }).click();
  await page.getByRole('link', { name: sheets[0].document.title, exact: true }).click();
  const updated = page.waitForResponse(response => response.url().endsWith('/textbook_worksheets') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '단원 활동지 업데이트' }).click();
  await updated;
  await page.getByRole('button', { name: '단원 활동지 업데이트' }).waitFor();
  assert.equal(sheets.length, 1);
  assert.deepEqual(errors, []);
  console.log('PASS mobile textbook import, review, retry, worksheet creation and reopen');
} finally {
  await browser?.close();
}
