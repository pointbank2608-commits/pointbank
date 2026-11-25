import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { PGlite } from '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js';

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
  export { removeWordListItems } from '/src/lib/api.ts?bulk-delete';
  const lists = async () => (await fetch('${origin}/word_lists')).json();
  const mocks = {fetchAllWordLists: async (_academy, kind='word') => (await lists()).filter(row => kind==='all' || (row.kind || 'word')===kind), fetchWordLists: lists,
    createWordList: async draft => (await fetch('${origin}/word_lists', {method:'POST',body:JSON.stringify(draft)})).json(),
    createCurriculumLesson: async draft => (await fetch('${origin}/curriculum_lessons', {method:'POST',body:JSON.stringify(draft)})).json(),
    wordListKindOf: l => l.kind || 'word', fetchPhonicsBankResult: async () => ({entries: [], mediaAvailable: false})};
  ${apiExports.filter(name => name !== 'removeWordListItems').map(name => `export const ${name} = (...args) => (mocks.${name} || (async () => []))(...args);`).join('\n')}
`;
const bundle = await build({
  root, configFile: false, logLevel: 'error',
  build: { write: false, minify: false, copyPublicDir: false, rollupOptions: { input: resolve(root, 'scripts/games/focus.html') } },
  plugins: [react(), tailwindcss(), { name: 'textbook-check', enforce: 'pre', load(id) {
    const path = id.replaceAll('\\', '/');
    if (path.endsWith('/scripts/games/focus.tsx')) return fixture;
    if (path.endsWith('/src/lib/api.ts')) return api;
    if (path.endsWith('/src/lib/supabase.ts')) return `import {createClient} from '@supabase/supabase-js'; export const supabase=createClient('${origin}','fake-key',{auth:{persistSession:false}});`;
    if (path.endsWith('/context/AuthContext.tsx')) return 'export const useAuth=()=>({academy:{id:"academy",features:{}},profile:{id:"teacher"},session:{user:{id:"teacher"}},hasFullAccess:true});';
    if (path.endsWith('/context/ToastContext.tsx')) return 'export const useToast=()=>({notify:()=>{},run:async(fn)=>{await fn();return true;}});';
  }}],
});
const assets = new Map(bundle.output.map(file => ['/' + file.fileName, file.type === 'chunk' ? file.code : file.source]));

const books = [{ id: 'legacy-book', title: 'Existing workbook' }];
const units = [
  { id: 'old-10', book_id: 'legacy-book', textbook: 'Existing workbook', title: 'Unit 10', files: [] },
  { id: 'old-2', book_id: 'legacy-book', textbook: 'Existing workbook', title: 'Unit 2', files: [],
    word_list_id: 'old-word-list', sentence_list_id: 'old-sentence-list' },
];
const lists = [{ id: 'old-sentence-list', kind: 'sentence', name: 'Existing workbook · Unit 2', items: [
  { id: 'existing-sentence', word: 'We walk by the river.', meaning: '우리는 강가를 걸어요.', image_url: null },
] }], sheets = [];
const lessons = [];
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
let lostListResponse = true;
const extractionRequests = [];
const aiSaveAttempts = [];
const appendRequests = [];
let lostAppendResponse = true;
let concurrentEdit = true;
const addedByTeacher = { id: 'other-edit', word: 'lake', meaning: '호수', image_url: null, category: null };
let browser;
const transferDb = new PGlite();
try {
  await transferDb.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$select '00000000-0000-4000-8000-000000000001'::uuid$$;
    create function public.my_academy_id() returns uuid language sql as $$select auth.uid()$$;
    create function public.is_staff() returns boolean language sql as $$select true$$;
    create table word_lists (id uuid primary key, academy_id uuid default auth.uid(), kind text, items jsonb, updated_at timestamptz);
  `);
  await transferDb.exec(readFileSync(new URL('../../../supabase/149_transfer_word_list_items.sql', import.meta.url), 'utf8'));
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const pdfFixture = await browser.newPage();
  const pageColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
  await pdfFixture.setContent(`<style>@page{size:A4;margin:0}body{margin:0}.sheet{height:297mm;break-after:page}.sheet:last-child{break-after:auto}</style>`
    + pageColors.map((color, index) => `<div class="sheet" style="background:${color}">Textbook page ${index + 1}</div>`).join(''));
  const pdfBytes = await pdfFixture.pdf({ printBackground: true, preferCSSPageSize: true });
  await pdfFixture.close();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.route('http://127.0.0.1:5387/**', route => {
    const path = new URL(route.request().url()).pathname;
    const contentType = /\.m?js$/.test(path) ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
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
    if (pathname === '/word_lists' && request.method() === 'POST') {
      const draft = request.postDataJSON();
      const row = { id: 'new-word-list', name: draft.name, items: draft.items, kind: draft.kind, academy_id: draft.academyId, class_id: draft.classId };
      lists.push(row);
      return respond(row);
    }
    if (pathname === '/word_lists') return respond(lists);
    if (pathname === '/rest/v1/word_lists' && ['GET', 'PATCH'].includes(request.method()) && searchParams.has('id')) {
      const list = lists.find(row => 'eq.' + row.id === searchParams.get('id'));
      if (request.method() === 'GET') return respond({ items: list.items, updated_at: list.updated_at ?? '2026-01-01T00:00:00Z' });
      if (concurrentEdit) {
        list.items.push(addedByTeacher);
        list.updated_at = '2026-01-02T00:00:00Z';
        concurrentEdit = false;
      }
      if (searchParams.get('updated_at') !== 'eq.' + list.updated_at) return respond({ code: 'PGRST116', message: 'Row version changed' }, 406);
      Object.assign(list, request.postDataJSON());
      return respond({ items: list.items });
    }
    if (pathname.endsWith('/transfer_word_list_items')) {
      const { p_source, p_target, p_item_ids, p_move } = request.postDataJSON();
      const source = lists.find(list => list.id === p_source);
      const target = lists.find(list => list.id === p_target);
      const [from, to] = [crypto.randomUUID(), crypto.randomUUID()];
      await transferDb.query('insert into word_lists(id,kind,items) values ($1,$2,$3),($4,$5,$6)',
        [from, source.kind, JSON.stringify(source.items), to, target.kind, JSON.stringify(target.items)]);
      const result = await transferDb.query('select transfer_word_list_items($1,$2,$3,$4) as count', [from, to, p_item_ids, p_move]);
      for (const [id, list] of [[from, source], [to, target]]) {
        list.items = (await transferDb.query('select items from word_lists where id=$1', [id])).rows[0].items;
      }
      return respond(result.rows[0].count);
    }
    if (pathname.endsWith('/save_study_lists')) {
      const input = request.postDataJSON();
      assert.equal(input.p_academy_id, 'academy');
      appendRequests.push(input.p_lists);
      for (const draft of input.p_lists) {
        if (!draft.append) {
          if (!lists.some(list => list.id === draft.id)) lists.push({ ...draft, academy_id: 'academy', class_id: null, created_by: 'teacher' });
          continue;
        }
        const target = lists.find(list => list.id === draft.id);
        assert.equal(target.kind || 'word', draft.kind);
        const key = item => JSON.stringify([item.word.trim().replace(/\s+/g, ' ').toLowerCase(), (item.meaning || '').trim().replace(/\s+/g, ' ').toLowerCase()]);
        for (const item of draft.items) {
          if (!target.items.some(old => old.id === item.id || key(old) === key(item))) target.items.push(item);
        }
      }
      if (lostAppendResponse) { lostAppendResponse = false; return respond({ message: 'response lost after append' }, 503); }
      return respond([]);
    }
    if (pathname === '/curriculum_lessons' && request.method() === 'POST') {
      const lesson = request.postDataJSON();
      assert.ok(lesson.id && lesson.classId === null);
      lessons.push(lesson);
      return respond(lesson);
    }
    if (pathname.endsWith('/extract-textbook')) {
      if (request.headers()['content-type']?.startsWith('application/json')) {
        const input = request.postDataJSON();
        assert.deepEqual(input, {
          mode: 'generate', academy: 'academy', topic: 'At the zoo', grade: 4, wordCount: 3, sentenceCount: 1,
        });
        return respond({
          words: [{ text: 'zebra', meaning: '얼룩말' }, { text: 'giraffe', meaning: '기린' }],
          sentences: [{ text: 'I can see a zebra.', meaning: '얼룩말이 보여요.' }],
        });
      }
      const form = await new Request(request.url(), { method: 'POST', headers: request.headers(), body: request.postDataBuffer() }).formData();
      const files = form.getAll('files');
      assert.ok(files.every(file => ['image/png', 'image/jpeg'].includes(file.type)));
      const pdf = files[0].name.startsWith('textbook-page-');
      assert.equal(form.get('first'), '1');
      assert.equal(form.get('last'), String(files.length));
      if (pdf) {
        assert.ok(files.length <= 3);
        for (const file of files) {
          assert.equal(file.type, 'image/jpeg');
          const selectedPage = Number(file.name.match(/page-(\d+)\.jpg$/)[1]);
          const bytes = Buffer.from(await file.arrayBuffer());
          assert.deepEqual([...bytes.subarray(0, 3)], [255, 216, 255]);
          const pixel = await page.evaluate(async encoded => {
            const image = new Image(); image.src = 'data:image/jpeg;base64,' + encoded; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
            const context = canvas.getContext('2d'); context.drawImage(image, 100, 100, 1, 1, 0, 0, 1, 1);
            return { color: [...context.getImageData(0, 0, 1, 1).data].slice(0, 3), longest: Math.max(image.width, image.height) };
          }, bytes.toString('base64'));
          const expected = pageColors[selectedPage - 1].match(/[a-f0-9]{2}/gi).map(hex => parseInt(hex, 16));
          assert.ok(pixel.color.every((value, index) => Math.abs(value - expected[index]) < 5));
          assert.equal(pixel.longest, 2048);
        }
        assert.deepEqual(files.map(file => file.name), Array.from({ length: files.length }, (_, index) => `textbook-page-${index + 2}.jpg`));
      } else assert.equal(files[0].name, 'pages.png');
      const options = form.get('options');
      if (options) {
        const parsed = JSON.parse(options);
        assert.deepEqual(Object.keys(parsed), ['outputs']);
        assert.deepEqual(parsed.outputs, [pdf ? 'sentences' : 'words']);
      }
      extractionRequests.push(pdf ? 'pdf' : 'photo');
      return respond(pdf ? {
        words: extraction.words.map((item, index) => ({ ...item, page: Math.min(index + 1, files.length) })),
        sentences: extraction.sentences, unclearPages: [1],
      } : extraction);
    }
    if (pathname.endsWith('/rest/v1/word_lists') && request.method() === 'POST') {
      const rows = request.postDataJSON();
      aiSaveAttempts.push(rows);
      assert.match(request.headers().prefer, /resolution=ignore-duplicates/);
      lists.push(...rows.filter(row => !lists.some(list => list.id === row.id)));
      if (rows[0].name === 'Zoo practice' && lostListResponse) {
        lostListResponse = false;
        return respond({ message: 'response lost after commit' }, 503);
      }
      return route.fulfill({ status: 201, body: '', headers: { 'access-control-allow-origin': '*' } });
    }
    if (pathname.includes('/object/textbook-originals/')) { uploadCount++; return respond({ Key: pathname }); }
    if (pathname.endsWith('/textbook_books')) {
      if (request.method() === 'POST') {
        const book = { id: 'new-book', title: request.postDataJSON().title };
        books.push(book);
        return respond(book, 201);
      }
      const selected = books.filter(book => !searchParams.has('id') || searchParams.get('id') === `eq.${book.id}`);
      return respond(selected.map(book => {
        const children = units.filter(unit => unit.book_id === book.id);
        return { ...book, textbook_units: searchParams.get('select').includes('(count)')
          ? [{ count: children.length }] : children.map(({ id, title }) => ({ id, title })) };
      }));
    }
    if (pathname.endsWith('/create_textbook_catalog_unit')) {
      if (failSave) { failSave = false; return respond({ message: 'temporary failure' }, 503); }
      const input = request.postDataJSON();
      const book = books.find(book => book.id === input.p_book_id);
      assert.equal(book.id, 'new-book');
      const unit = { id: input.p_id, book_id: book.id, textbook: book.title, title: input.p_title, files: [],
        word_list_id: null, sentence_list_id: null };
      units.push(unit);
      return respond(unit);
    }
    if (pathname.endsWith('/textbook_units')) return respond(
      units.filter(unit => !searchParams.has('id') || searchParams.get('id') === `eq.${unit.id}`));
    if (pathname.endsWith('/textbook_worksheets')) {
      if (request.method() === 'POST') {
        const next = request.postDataJSON();
        const existing = sheets.findIndex(sheet => sheet.id === next.id);
        if (existing === -1) sheets.push(next);
        else sheets[existing] = next;
        return respond({}, 201);
      }
      const unitSheets = sheets.filter(sheet => !searchParams.has('unit_id') || `eq.${sheet.unit_id}` === searchParams.get('unit_id'));
      return respond(searchParams.has('id') ? unitSheets.find(sheet => `eq.${sheet.id}` === searchParams.get('id')) : unitSheets);
    }
    return respond([]);
  });
  const base = 'http://127.0.0.1:5387/scripts/games/focus.html?start=';
  const go = path => page.goto(base + encodeURIComponent(path));
  await go('/wordlists');
  await page.getByRole('button', { name: '내 교재', exact: true }).click();
  const library = page.getByRole('region', { name: '내 교재', exact: true });
  await library.getByRole('link', { name: 'Existing workbook 2개 단원' }).click();
  const contents = library.getByRole('region', { name: '단원 목차', exact: true });
  await contents.getByRole('link', { name: 'Unit 2', exact: true }).waitFor();
  assert.deepEqual(await contents.getByRole('link').allTextContents(), ['Unit 2', 'Unit 10']);
  await go('/wordlists?tab=textbooks&unit=old-2');
  assert.equal(await library.getByRole('link', { name: '단어장', exact: true }).getAttribute('href'), '/wordlists?list=old-word-list');
  assert.equal(await library.getByRole('link', { name: '문장 모음', exact: true }).getAttribute('href'), '/wordlists?list=old-sentence-list');
  await library.getByRole('link', { name: '교재 목차로' }).click();
  await library.getByRole('link', { name: '교재 목록으로' }).click();
  await library.getByRole('button', { name: '새 교재 만들기', exact: true }).waitFor();
  assert.equal(await library.getByRole('link', { name: 'Unit 2', exact: true }).count(), 0);
  assert.equal(await library.getByRole('button', { name: '단원 추가', exact: true }).count(), 0);
  await library.getByRole('button', { name: '새 교재 만들기', exact: true }).click();
  await page.getByLabel('교재 이름').fill('Field Trip');
  await library.getByRole('button', { name: '교재 만들기', exact: true }).click();
  await library.getByText('등록한 단원이 없어요.').waitFor();
  await go('/wordlists?tab=textbooks&book=new-book');
  await library.getByText('등록한 단원이 없어요.').waitFor();
  await library.getByRole('button', { name: '단원 추가', exact: true }).click();
  await page.getByLabel('단원 이름').waitFor();
  assert.equal(await page.getByLabel('교재 이름', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel('교재 촬영').count(), 0);
  assert.equal(await page.getByRole('button', { name: '수업자료 뚝딱 만들기', exact: true }).count(), 0);
  await page.getByLabel('단원 이름').fill('Unit 1');
  await page.getByRole('button', { name: '단원 저장', exact: true }).click();
  await page.getByText('저장하지 못했어요. 다시 시도해 주세요.').waitFor();
  await page.getByRole('button', { name: '단원 저장', exact: true }).click();
  await library.getByRole('heading', { name: 'Unit 1', exact: true }).waitFor();
  const createdUnit = units.find(unit => unit.book_id === 'new-book');
  assert.ok(createdUnit);
  assert.equal(await library.getByRole('link', { name: '활동지 만들기', exact: true }).getAttribute('href'),
    `/materials/worksheet?unit=${createdUnit.id}`);
  await library.getByRole('link', { name: '교재 목차로' }).click();
  await library.getByRole('link', { name: 'Unit 1', exact: true }).waitFor();
  await library.getByRole('link', { name: '교재 목록으로' }).click();
  await library.getByRole('link', { name: 'Field Trip 1개 단원' }).waitFor();

  await go('/materials/worksheet');
  await page.getByRole('button', { name: '내 교재에서 만들기' }).click();
  await page.getByRole('button', { name: '문장 모음 · 1' }).click();
  await page.locator('[data-worksheet-source]').getByText('Existing workbook · Unit 2').waitFor();
  await page.locator('[data-activity-card="sentenceOrder"] .ws-card-actions .ws-primary').click();
  await page.getByRole('button', { name: '단원에 활동지 담기' }).click();
  await page.getByRole('button', { name: '단원 활동지 업데이트' }).waitFor();
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].unit_id, 'old-2');
  assert.equal(sheets[0].document.words[0].word, 'We walk by the river.');
  await page.getByRole('link', { name: /저장할 단원/ }).click();
  await page.getByRole('link', { name: sheets[0].document.title, exact: true }).click();
  const updated = page.waitForResponse(response => response.url().endsWith('/textbook_worksheets') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '단원 활동지 업데이트' }).click();
  await updated;
  await page.getByRole('button', { name: '단원 활동지 업데이트' }).waitFor();
  assert.equal(sheets.length, 1);

  await go('/wordlists');
  await page.getByRole('button', { name: '주제로 새로 만들기', exact: true }).click();
  const ai = page.getByRole('dialog', { name: '주제로 새로 만들기', exact: true });
  await ai.getByLabel('주제', { exact: true }).fill('At the zoo');
  await ai.getByLabel('학년', { exact: true }).selectOption('4');
  await ai.getByLabel('단어 수', { exact: true }).fill('3');
  await ai.getByLabel('문장 수', { exact: true }).fill('1');
  await ai.getByRole('button', { name: '단어·문장 초안 만들기', exact: true }).click();
  const aiWords = ai.getByRole('group', { name: '단어장 (3개 요청 · 2개 생성)' });
  const aiSentences = ai.getByRole('group', { name: '문장 모음 (1개 요청 · 1개 생성)' });
  await aiWords.waitFor();
  await aiSentences.waitFor();
  assert.equal(aiSaveAttempts.length, 0);
  await ai.getByLabel('자료 이름', { exact: true }).fill('Zoo practice');
  await aiWords.getByLabel('저장할 항목', { exact: true }).nth(1).uncheck();
  await aiSentences.getByLabel('한국어 뜻', { exact: true }).fill('얼룩말 한 마리가 보여요.');
  await ai.getByRole('button', { name: '확인한 자료 저장', exact: true }).click();
  await ai.getByRole('alert').waitFor();
  await ai.getByRole('button', { name: '다시 저장', exact: true }).click();
  await ai.waitFor({ state: 'hidden' });
  const generated = lists.filter(list => list.name === 'Zoo practice');
  assert.equal(aiSaveAttempts.length, 2);
  assert.deepEqual(aiSaveAttempts[1], aiSaveAttempts[0]);
  assert.deepEqual(generated.map(row => [row.kind, row.items.map(item => [item.word, item.meaning])]), [
    ['word', [['zebra', '얼룩말']]], ['sentence', [['I can see a zebra.', '얼룩말 한 마리가 보여요.']]],
  ]);
  assert.ok(generated.every(row => row.class_id === null && row.academy_id === 'academy' && row.created_by === 'teacher'));
  await page.getByRole('button', { name: /Zoo practice.*문장/ }).waitFor();
  const openAi = page.getByRole('button', { name: '주제로 새로 만들기', exact: true });
  await openAi.click();
  const topic = ai.getByLabel('주제', { exact: true });
  assert.equal(await topic.inputValue(), '');
  await topic.fill('Discard this draft');
  const cancelAi = ai.getByRole('button', { name: '취소', exact: true });
  const clickedDialog = await ai.elementHandle();
  // The browser should dismiss the dialog even when the click doesn't reach React.
  await cancelAi.evaluate(button => button.addEventListener('click', event => event.stopPropagation(), { once: true }));
  await cancelAi.click();
  await page.waitForFunction(dialog => !dialog.isConnected, clickedDialog, { timeout: 2000 });
  assert.ok(await openAi.evaluate(button => document.activeElement === button));
  await openAi.click();
  assert.equal(await topic.inputValue(), '');
  const escapedDialog = await ai.elementHandle();
  await page.keyboard.press('Escape');
  await page.waitForFunction(dialog => !dialog.isConnected, escapedDialog, { timeout: 2000 });

  const importTitle = '수업자료 뚝딱 만들기';
  const importAi = page.getByRole('button', { name: importTitle, exact: true });
  const sourceDialog = page.getByRole('dialog', { name: importTitle, exact: true });
  await page.getByRole('button', { name: '단어장', exact: true }).click();
  await importAi.click();
  const camera = sourceDialog.getByLabel('교재 촬영');
  assert.equal(await camera.getAttribute('capture'), 'environment');
  await camera.setInputFiles({ name: 'pages.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/kf8AAAAASUVORK5CYII=', 'base64') });
  await sourceDialog.getByRole('button', { name: '단어·문장 자동 추출' }).click();
  const extractedWords = sourceDialog.getByRole('group', { name: '단어장 (3개)' });
  await extractedWords.getByLabel('한국어 뜻').nth(1).fill('숲속');
  await extractedWords.getByLabel('저장할 항목').nth(2).uncheck();
  await extractedWords.getByRole('button', { name: 'river · 단어 삭제', exact: true }).click();
  await sourceDialog.getByRole('group', { name: '단어장 (2개)' }).getByRole('button', { name: '단어 추가' }).click();
  await extractedWords.getByLabel('영어', { exact: true }).last().fill('stream');
  await extractedWords.getByLabel('한국어 뜻', { exact: true }).last().fill('개울');

  const extractedSentences = sourceDialog.getByRole('group', { name: '문장 모음 (1개)' });
  await extractedSentences.getByRole('button', { name: 'We walk by the river. · 문장 삭제', exact: true }).click();
  await sourceDialog.getByRole('group', { name: '문장 모음 (0개)' }).getByRole('button', { name: '문장 추가' }).click();
  await extractedSentences.getByLabel('영어', { exact: true }).fill('We see a stream.');
  await extractedSentences.getByLabel('한국어 뜻', { exact: true }).fill('우리는 개울을 봐요.');
  assert.equal(aiSaveAttempts.length, 2);
  await sourceDialog.getByRole('button', { name: '확인한 자료 저장', exact: true }).click();
  await sourceDialog.waitFor({ state: 'hidden' });
  const savedPhoto = lists.filter(list => list.name === 'pages');
  assert.deepEqual(savedPhoto.map(list => [list.kind, list.items.length]), [['word', 2], ['sentence', 1]]);
  assert.deepEqual(savedPhoto.map(list => list.items.map(({ word, meaning }) => [word, meaning])), [
    [['forest', '숲속'], ['stream', '개울']],
    [['We see a stream.', '우리는 개울을 봐요.']],
  ]);
  assert.equal(new URL(page.url()).searchParams.get('list'), savedPhoto[0].id);
  const photoList = page.getByRole('button', { name: /expand_less pages \(2\)/ });
  await photoList.waitFor();
  await photoList.locator('../..').getByRole('button', { name: /카드로 외우기/ }).click();
  await page.getByText('pages · 1/2', { exact: true }).waitFor();

  await go('/wordlists');
  await page.getByRole('button', { name: '문장 모음', exact: true }).click();
  await importAi.click();
  await sourceDialog.getByLabel('이미지·PDF 선택').setInputFiles({ name: 'pages.pdf', mimeType: 'application/pdf', buffer: pdfBytes });
  await sourceDialog.getByLabel('PDF 시작 쪽').fill('2');
  await sourceDialog.getByLabel('PDF 끝 쪽').fill('5');
  await sourceDialog.getByRole('button', { name: '단어·문장 자동 추출' }).click();
  await sourceDialog.getByRole('alert').getByText('한 번에 연속된 PDF 3쪽까지', { exact: false }).waitFor();
  assert.deepEqual(extractionRequests, ['photo']);
  await sourceDialog.getByLabel('PDF 끝 쪽').fill('4');
  await sourceDialog.getByRole('button', { name: '단어·문장 자동 추출' }).click();
  await sourceDialog.getByText('읽기 어려운 쪽이 있어요', { exact: false }).waitFor();
  const pdfOriginal = sourceDialog.getByRole('link', { name: '원문 열기 · 2쪽' });
  await pdfOriginal.waitFor();
  assert.match(await pdfOriginal.getAttribute('href'), /#page=2$/);
  await sourceDialog.getByRole('button', { name: '4쪽', exact: true }).click();
  assert.match(await sourceDialog.getByRole('link', { name: '원문 열기 · 4쪽' }).getAttribute('href'), /#page=4$/);
  await sourceDialog.getByRole('button', { name: '원본 바꾸기', exact: true }).click();
  await sourceDialog.getByLabel('PDF 시작 쪽').fill('5');
  await sourceDialog.getByLabel('PDF 끝 쪽').fill('6');
  await sourceDialog.getByRole('button', { name: '단어·문장 자동 추출' }).click();
  await sourceDialog.getByRole('alert').getByText('한 번에 연속된 PDF 3쪽까지', { exact: false }).waitFor();
  assert.deepEqual(extractionRequests, ['photo', 'pdf']);
  await sourceDialog.getByLabel('PDF 시작 쪽').fill('2');
  await sourceDialog.getByLabel('PDF 끝 쪽').fill('2');

  const outputOptions = sourceDialog.getByRole('group', { name: '만들 자료', exact: true });
  assert.deepEqual(await outputOptions.getByRole('checkbox').evaluateAll(inputs => inputs.map(input => input.parentElement.textContent.trim().replace(/^(library_books|notes)/, ''))), ['단어장', '문장 모음']);
  assert.equal(await sourceDialog.getByRole('button', { name: '우리 활동지', exact: true }).count(), 0);
  assert.equal(await sourceDialog.getByRole('group', { name: '수업·워크북 설정' }).count(), 0);
  await outputOptions.getByRole('checkbox', { name: '단어장', exact: true }).uncheck();
  await outputOptions.getByRole('checkbox', { name: '문장 모음', exact: true }).uncheck();
  assert.equal(await sourceDialog.getByRole('button', { name: '단어·문장 자동 추출' }).isDisabled(), true);
  await outputOptions.getByRole('checkbox', { name: '문장 모음', exact: true }).check();
  await sourceDialog.getByRole('button', { name: '단어·문장 자동 추출' }).click();
  assert.equal(await sourceDialog.getByRole('group', { name: /^단어장 \(/ }).count(), 0);
  await sourceDialog.getByLabel('자료 이름', { exact: true }).fill('PDF sentences only');
  await sourceDialog.getByRole('group', { name: '문장 모음 (1개)' }).getByLabel('한국어 뜻').fill('강가를 함께 걸어요.');
  await sourceDialog.getByRole('button', { name: '확인한 자료 저장', exact: true }).click();
  await sourceDialog.waitFor({ state: 'hidden' });
  const savedPdf = lists.filter(list => list.name === 'PDF sentences only');
  assert.deepEqual(savedPdf.map(list => [list.kind, list.items.map(item => [item.word, item.meaning])]), [
    ['sentence', [['We walk by the river.', '강가를 함께 걸어요.']]],
  ]);
  assert.equal(new URL(page.url()).searchParams.get('list'), savedPdf[0].id);
  await page.getByText('강가를 함께 걸어요.', { exact: true }).waitFor();

  await go('/wordlists');
  await importAi.click();
  await sourceDialog.getByLabel('이미지·PDF 선택').setInputFiles({ name: 'pages.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/kf8AAAAASUVORK5CYII=', 'base64') });
  await outputOptions.getByRole('checkbox', { name: '문장 모음', exact: true }).uncheck();
  await sourceDialog.getByRole('button', { name: '단어·문장 자동 추출' }).click();
  assert.equal(await sourceDialog.getByRole('group', { name: /^문장 모음 \(/ }).count(), 0);
  await sourceDialog.getByLabel('자료 이름', { exact: true }).fill('Image words only');
  await sourceDialog.getByRole('button', { name: '확인한 자료 저장', exact: true }).click();
  await sourceDialog.waitFor({ state: 'hidden' });
  assert.deepEqual(lists.filter(list => list.name === 'Image words only').map(list => [list.kind, list.items.length]), [['word', 3]]);
  assert.equal(lessons.length, 0);
  assert.deepEqual(extractionRequests, ['photo', 'pdf', 'pdf', 'photo']);
  const imageTarget = lists.find(list => list.name === 'Image words only');
  imageTarget.items[0].image_url = '/original-river.webp';
  imageTarget.items[0].example = 'A river flows.';
  const originalItem = structuredClone(imageTarget.items[0]);
  await go('/wordlists');
  await importAi.click();
  await sourceDialog.getByLabel('이미지·PDF 선택').setInputFiles({ name: 'pages.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/kf8AAAAASUVORK5CYII=', 'base64') });
  await outputOptions.getByRole('checkbox', { name: '문장 모음', exact: true }).uncheck();
  await sourceDialog.getByRole('button', { name: '단어·문장 자동 추출' }).click();
  await sourceDialog.getByLabel('단어장 저장 위치').selectOption(imageTarget.id);
  await sourceDialog.getByRole('group', { name: '단어장 (3개)' }).getByLabel('한국어 뜻').nth(1).fill('초록 숲');
  await sourceDialog.getByRole('button', { name: '확인한 자료 저장', exact: true }).click();
  await sourceDialog.getByRole('alert').waitFor();
  await sourceDialog.getByRole('button', { name: '다시 저장', exact: true }).click();
  await sourceDialog.waitFor({ state: 'hidden' });
  assert.deepEqual(appendRequests[0], appendRequests[1]);
  assert.equal(imageTarget.items.length, 4);
  assert.deepEqual(imageTarget.items[0], originalItem);
  await page.getByText('· 초록 숲', { exact: true }).waitFor();

  await go('/wordlists');
  await importAi.click();
  await sourceDialog.getByLabel('이미지·PDF 선택').setInputFiles({ name: 'pages.pdf', mimeType: 'application/pdf', buffer: pdfBytes });
  await sourceDialog.getByLabel('PDF 시작 쪽').fill('2');
  await sourceDialog.getByRole('button', { name: '단어·문장 자동 추출' }).click();
  const zooSentences = generated.find(list => list.kind === 'sentence');
  await sourceDialog.getByLabel('문장 모음 저장 위치').selectOption(zooSentences.id);
  await sourceDialog.getByLabel('자료 이름', { exact: true }).fill('Mixed PDF append');
  await sourceDialog.getByRole('button', { name: '확인한 자료 저장', exact: true }).click();
  await sourceDialog.waitFor({ state: 'hidden' });
  assert.equal(lists.filter(list => list.name === 'Mixed PDF append').length, 1);
  assert.equal(zooSentences.items.length, 2);

  savedPhoto[0].group_name = 'Review';
  await go('/wordlists?list=' + imageTarget.id);
  const deleteButton = page.getByRole('button', { name: '선택한 단어 삭제', exact: true });
  await deleteButton.waitFor();
  assert.equal(await deleteButton.isDisabled(), true);
  await page.getByRole('checkbox', { name: 'river · 강', exact: true }).check();
  await page.getByRole('button', { name: '다른 단어장으로 복사', exact: true }).click();
  const appendDialog = page.getByRole('dialog');
  const wordDestination = appendDialog.getByLabel('단어장 저장 위치');
  await wordDestination.selectOption(savedPhoto[0].id);
  assert.equal(await wordDestination.locator(`option[value="${imageTarget.id}"]`).count(), 0);
  assert.equal(await wordDestination.locator(`option[value="${zooSentences.id}"]`).count(), 0);
  assert.equal(await appendDialog.getByRole('checkbox').count(), 0);
  await appendDialog.getByRole('button', { name: '선택한 단어 복사', exact: true }).click();
  await appendDialog.waitFor({ state: 'hidden' });
  assert.equal(savedPhoto[0].items.length, 3);
  assert.equal(imageTarget.items.length, 4);
  assert.deepEqual(savedPhoto[0].items.at(-1), { ...originalItem, id: savedPhoto[0].items.at(-1).id });
  await page.getByText('· 강', { exact: true }).waitFor();

  await go('/wordlists?list=' + savedPdf[0].id);
  await page.getByRole('button', { name: '기존 목록에 추가하기', exact: true }).click();
  await appendDialog.getByLabel('문장 모음 저장 위치').selectOption(zooSentences.id);
  await appendDialog.getByRole('button', { name: '선택한 항목 추가', exact: true }).click();
  await appendDialog.waitFor({ state: 'hidden' });
  assert.equal(zooSentences.items.length, 3);
  assert.equal(savedPdf[0].items.length, 1);
  await page.getByText('강가를 함께 걸어요.', { exact: true }).waitFor();
  assert.equal(uploadCount, 0);
  await go('/wordlists');
  await page.getByRole('button', { name: '+ 단어장 만들기' }).click();
  const nameField = page.getByLabel('이름 (선택)', { exact: true });
  await nameField.fill('새 빈 목록');
  const createButton = page.getByRole('button', { name: '새 단어장 만들기', exact: true });
  const before = lists.length;
  const confirmations = [];
  for (const accept of [false, true]) {
    page.once('dialog', async dialog => {
      confirmations.push(dialog.message());
      if (accept) await dialog.accept(); else await dialog.dismiss();
    });
    await createButton.click();
    if (!accept) {
      assert.equal(lists.length, before);
      assert.equal(await nameField.inputValue(), '새 빈 목록');
    }
  }
  await page.getByText('새 빈 목록', { exact: true }).waitFor();
  assert.deepEqual(confirmations, ['빈 단어장으로 만들겠습니까?', '빈 단어장으로 만들겠습니까?']);
  assert.equal(lists.length, before + 1);
  const emptyList = lists.find(list => list.name === '새 빈 목록');
  assert.deepEqual(emptyList.items, []);
  await go('/wordlists?list=' + emptyList.id);
  await page.getByRole('button', { name: '직접 입력', exact: true }).waitFor();
  const importButton = page.getByRole('button', { name: '다른 단어장에서 불러오기', exact: true });
  assert.equal(await importButton.count(), 0);
  await go('/wordlists?list=' + imageTarget.id);
  await page.getByRole('checkbox', { name: '전체 선택', exact: true }).check();
  await page.getByRole('button', { name: '다른 단어장으로 복사', exact: true }).click();
  assert.equal(await importButton.count(), 0);
  await wordDestination.selectOption(emptyList.id);
  await appendDialog.getByRole('button', { name: '선택한 단어 복사' }).click();
  await appendDialog.waitFor({ state: 'hidden' });
  assert.deepEqual(emptyList.items.map(item => item.word), [...new Set(imageTarget.items.map(item => item.word))]);
  assert.equal(emptyList.items.find(item => item.word === 'forest').meaning, '숲 / 초록 숲');
  await go('/wordlists?list=' + emptyList.id);
  await page.getByRole('checkbox', { name: 'forest · 숲 / 초록 숲', exact: true }).check();
  await page.getByRole('button', { name: '다른 단어장으로 이동' }).click();
  const moveDialog = page.getByRole('dialog', { name: '다른 단어장으로 이동' });
  await moveDialog.getByLabel('단어장 저장 위치').selectOption(savedPhoto[0].id);
  const moveButton = moveDialog.getByRole('button', { name: '선택한 단어 이동' });
  await moveButton.click();
  await moveDialog.waitFor({ state: 'hidden' });
  await page.getByText('· 숲속 / 숲 / 초록 숲', { exact: true }).waitFor();
  await go('/wordlists?list=' + emptyList.id);
  await page.getByText('· 강', { exact: true }).waitFor();
  assert.equal(await page.getByText('· 숲 / 초록 숲', { exact: true }).count(), 0);
  await go('/wordlists?list=' + imageTarget.id);
  const keep = page.getByRole('checkbox', { name: 'river · 강', exact: true });
  await page.getByRole('checkbox', { name: '전체 선택', exact: true }).check();
  await keep.uncheck();
  const deleteCount = imageTarget.items.length - 1;
  for (const accept of [false, true]) {
    page.once('dialog', async dialog => {
      assert.equal(dialog.message(), `‘${imageTarget.name}’에서 선택한 단어 ${deleteCount}개를 삭제할까요?`);
      if (accept) await dialog.accept(); else await dialog.dismiss();
    });
    await deleteButton.click();
    if (!accept) assert.equal(imageTarget.items.length, deleteCount + 1);
  }
  await page.getByRole('button', { name: '다시 저장하기', exact: true }).click();
  await page.getByText('0개 선택됨', { exact: true }).waitFor();
  await go('/wordlists?list=' + imageTarget.id);
  await keep.waitFor();
  assert.deepEqual(imageTarget.items, [originalItem, addedByTeacher]);
  assert.deepEqual(errors, []);
  console.log('PASS PDF selected-page pixels and limits, original page mapping, AI append retries, mixed save, list-to-list copies, metadata, and reopening');
} finally {
  await browser?.close();
  await transferDb.close();
}
