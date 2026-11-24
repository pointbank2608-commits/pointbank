import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from '../../node_modules/typescript/lib/typescript.js';

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(transpile(source)).toString('base64');
const shared = moduleUrl(readFileSync(new URL('../../../supabase/functions/extract-textbook/source-materials.ts', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../../../supabase/functions/extract-textbook/index.ts', import.meta.url), 'utf8')
  .replace("'./source-materials.ts'", JSON.stringify(shared));
const originalFetch = globalThis.fetch;
const originalDeno = globalThis.Deno;
const config = { OPENAI_API_KEY: 'test-key', SUPABASE_URL: 'https://extraction.invalid', SUPABASE_ANON_KEY: 'test-anon' };
let handler;
let reservations = 0;
const providerRequests = [];
try {
  globalThis.Deno = { env: { get: key => config[key] }, serve: callback => { handler = callback; } };
  globalThis.fetch = async (url, options) => {
    if (url === 'https://extraction.invalid/rest/v1/rpc/reserve_textbook_extraction') {
      reservations++;
      return Response.json(true);
    }
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    providerRequests.push(body);
    assert.ok(body.input[0].content.every(part => ['input_text', 'input_image'].includes(part.type)));
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text',
      text: JSON.stringify({ words: [{ text: 'river', meaning: '강', page: 1, meaningSuggested: true }], sentences: [], unclearPages: [] }),
    }] }] });
  };
  await import(moduleUrl(source));
  const request = files => {
    const form = new FormData();
    form.set('academy', '10000000-0000-4000-8000-000000000001');
    for (const file of files) form.append('files', file);
    return new Request('https://extraction.invalid/extract-textbook', { method: 'POST', headers: { authorization: 'Bearer test' }, body: form });
  };
  assert.equal((await handler(request([new File(['%PDF-1.4'], 'book.pdf', { type: 'application/pdf' })]))).status, 400);
  assert.equal((await handler(request([new File(['%PDF-1.4'], 'fake.jpg', { type: 'image/jpeg' })]))).status, 400);
  assert.equal(reservations, 0);
  assert.equal(providerRequests.length, 0);
  const image = () => new File([new Uint8Array([255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0])], 'page.jpg', { type: 'image/jpeg' });
  assert.equal((await handler(request(Array.from({ length: 7 }, image)))).status, 400);
  const response = await handler(request(Array.from({ length: 3 }, image)));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).words[0].text, 'river');
  assert.equal(reservations, 1);
  assert.equal(providerRequests[0].input[0].content.filter(part => part.type === 'input_image').length, 3);
  assert.equal(providerRequests[0].store, false);
  console.log('PASS image-only provider requests, PDF rejection before quota reservation, signature validation, and file count limits');
} finally {
  globalThis.fetch = originalFetch;
  if (originalDeno === undefined) delete globalThis.Deno; else globalThis.Deno = originalDeno;
}
