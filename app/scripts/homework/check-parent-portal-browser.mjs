import assert from 'node:assert/strict';
import { createECDH } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const modules = process.env.PARENT_TEST_NODE_MODULES
  ? pathToFileURL(resolve(process.env.PARENT_TEST_NODE_MODULES) + '/')
  : new URL('../../node_modules/homework-test-tools/node_modules/', import.meta.url);
const { chromium } = await import(new URL('playwright-core/index.mjs', modules));
const curve = createECDH('prime256v1');
curve.generateKeys();
const publicPushKey = curve.getPublicKey().toString('base64url');
process.env.VITE_PARENT_PUSH_PUBLIC_KEY = '';
process.env.VITE_SUPABASE_URL = 'https://parent-qa.invalid';
process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-only';
const origin = 'http://127.0.0.1:5439';
const fixturePath = '/parent-staff-qa-fixture.js';
const fixtureId = '\0parent-staff-qa-fixture.js';
const server = await createServer({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 5439, strictPort: true, hmr: false },
  plugins: [{
    name: 'parent-staff-qa-fixture',
    configureServer(vite) {
      vite.middlewares.use('/parent-staff-qa', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!DOCTYPE html><html lang="ko"><div id="root"></div><script type="module" src="${fixturePath}"></script></html>`);
      });
    },
    resolveId(id) { if (id === fixturePath) return fixtureId; },
    load(id) {
      if (id === fixtureId) return `
        import { createElement } from 'react';
        import { createRoot } from 'react-dom/client';
        import ParentAccessPanel from '/src/components/ParentAccessPanel.tsx';
        import '/src/i18n/index.ts';
        createRoot(document.getElementById('root')).render(createElement(ParentAccessPanel, {
          students: [{ id: 'student', name: '민서' }],
        }));
      `;
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PARENT_TEST_CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', permissions: ['notifications'] });
  const token = 'b'.repeat(64), invite = 'a'.repeat(64);
  const endpoint = 'https://fcm.googleapis.com/fcm/send/test';
  const snapshot = '2026-11-18T12:00:00Z';
  let enabled = false, read = '2026-11-17T00:00:00Z', linked = false;
  let account = null;
  await ctx.addInitScript((url) => {
    let current = null;
    const fake = { endpoint: url, toJSON: () => ({ keys: { p256dh: 'a'.repeat(87), auth: 'a'.repeat(22) } }) };
    PushManager.prototype.getSubscription = async () => current;
    PushManager.prototype.subscribe = async () => (current = fake);
  }, endpoint);
  await ctx.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname !== 'parent-qa.invalid') return route.abort();
    const fn = url.pathname.split('/').pop();
    const args = route.request().postDataJSON();
    let data = null;
    if (fn === 'parent_account_status') data = account;
    else if (fn === 'parent_save_account') {
      assert.deepEqual(args, { p_student: 'student', p_name: '김보호', p_phone: '010-1234-5678', p_consent: true });
      account = { name: args.p_name, last4: '5678' };
    } else if (fn === 'parent_make_invite') {
      assert.ok(account);
      data = invite;
    } else if (fn === 'parent_connect') {
      assert.equal(args.p_invite, invite);
      linked = true;
      data = { id: 'e35b49c4-2fa5-489b-89ce-2c15cfd54c9a', token, student_id: 'student' };
    } else if (fn === 'parent_home') {
      assert.equal(args.p_token, token);
      data = linked ? { name: '민서', academy: 'QA 학원', read_through: read, snapshot,
        push_key: publicPushKey,
        push_enabled: enabled && args.p_endpoint === endpoint, homework: [
          { assignment_id: '1', source: 'online', title: '철자 숙제', published_at: '2026-11-18T01:00:00Z',
            due_at: '2026-11-19T14:59:00Z', completed_at: '2026-11-18T03:00:00Z', status: 'completed' },
        ] } : { error: 'expired' };
    } else if (fn === 'parent_set_push') {
      assert.equal(args.p_endpoint, endpoint);
      assert.equal(args.p_token, token);
      enabled = args.p_enabled;
      data = { enabled };
    } else if (fn === 'parent_read') read = args.p_through;
    else if (fn === 'parent_logout') linked = false;
    await route.fulfill({ json: data });
  });
  const staff = await ctx.newPage();
  await staff.goto(origin + '/parent-staff-qa');
  await staff.getByText('학부모 계정', { exact: true }).click();
  await staff.getByLabel('학부모 성함', { exact: true }).fill('김보호');
  await staff.getByLabel('학부모 전화번호', { exact: true }).fill('01012345678');
  const createAccount = staff.getByRole('button', { name: '학부모 계정 만들기', exact: true });
  assert.equal(await createAccount.isEnabled(), false);
  await staff.getByRole('checkbox').check();
  await createAccount.click();
  await staff.getByText(/김보호.*5678/).waitFor();
  await staff.getByRole('button', { name: '연결 링크 만들기' }).click();
  const issued = staff.getByLabel('연결 링크 또는 코드');
  await issued.waitFor();
  assert.equal(await issued.inputValue(), origin + '/p#invite=' + invite);
  await staff.close();
  const page = await ctx.newPage();
  await page.goto(origin + '/p#invite=' + invite);
  await page.getByRole('heading', { name: '우리 아이 숙제' }).waitFor();
  assert.equal(await page.locator('link[rel=manifest]').getAttribute('href'), '/parent.webmanifest');
  assert.equal(new URL(page.url()).hash, '');
  await page.getByRole('button', { name: '이 기기에 연결' }).click();
  await page.getByText('철자 숙제', { exact: true }).waitFor();
  await page.getByRole('button', { name: '푸시 켜기' }).click();
  await page.getByRole('button', { name: '푸시 끄기' }).waitFor();
  assert.equal(enabled, true);
  await page.getByRole('button', { name: '알림함 · 2' }).click();
  await page.getByText('숙제를 완료했어요', { exact: false }).waitFor();
  await page.getByRole('button', { name: '모두 읽음' }).click();
  await page.getByRole('button', { name: '알림함', exact: true }).waitFor();
  assert.equal(read, snapshot);
  await page.getByRole('button', { name: '푸시 끄기' }).click();
  await page.getByRole('button', { name: '푸시 켜기' }).waitFor();
  assert.equal(enabled, false);
  await page.getByRole('button', { name: '이 기기 연결 끊기' }).click();
  await page.getByRole('heading', { name: '자녀 연결하기' }).waitFor();
  await page.waitForFunction(() => localStorage.getItem('classbank.parentSessions') === '[]');
  await ctx.close();

  const ios = await browser.newContext({
    locale: 'ko-KR', viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
  });
  await ios.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const apple = await ios.newPage();
  await apple.goto(origin + '/p#invite=' + invite);
  await apple.getByRole('button', { name: '홈 화면에서 쓸 링크 복사' }).waitFor();
  await apple.getByText(/Safari 공유 메뉴/).waitFor();
  console.log('PASS: teacher registration and invite, mobile /p, push consent, inbox/read and iOS guidance (simulated API).');
} finally {
  await browser?.close();
  await server.close();
}
