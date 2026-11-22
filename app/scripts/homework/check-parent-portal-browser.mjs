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
        import { createElement, useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import ClassCommunication from '/src/components/ClassCommunication.tsx';
        import ParentAccessPanel from '/src/components/ParentAccessPanel.tsx';
        import AddStudentModal from '/src/components/AddStudentModal.tsx';
        import '/src/i18n/index.ts';
        function Fixture() {
          const [form,setForm]=useState(null);
          const [revision,setRevision]=useState(0);
          const [name,setName]=useState('민서');
          return createElement('div',null,
            createElement('button',{onClick:()=>setForm({})},'학생 등록'),
            createElement(ClassCommunication,{classId:'class',userId:'teacher',owner:true}),
            createElement(ParentAccessPanel,{
              students:[{id:'student',name}],revision,onEditStudent:student=>setForm({student}),
            }),
            form&&createElement(AddStudentModal,{
              academyId:'academy',classId:'class',existingNames:[name],student:form.student,
              onClose:()=>setForm(null),onAdded:next=>{setForm(null);setName(next);setRevision(n=>n+1);},
            }),
          );
        }
        createRoot(document.getElementById('root')).render(createElement(Fixture));
      `;
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PARENT_TEST_CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', permissions: ['notifications'] });
  const token = 'b'.repeat(64);
  const endpoint = 'https://fcm.googleapis.com/fcm/send/test';
  const snapshot = '2026-11-18T12:00:00Z';
  let enabled = false, read = '2026-11-17T00:00:00Z', linked = false;
  let account = null;
  let publishedFeedback = '';
  const settings = { published:true,started:false,completed:true,overdue:true,attendance:true,feedback:true,inquiry:false };
  const threads = [];
  let teacherSubscribed = false;
  await ctx.addInitScript((url) => {
    let current = null;
    const fake = { endpoint: url, unsubscribe: async () => { current = null; return true; }, toJSON: () => ({ keys: { p256dh: 'a'.repeat(87), auth: 'a'.repeat(22) } }) };
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
    else if (fn === 'class_communication') data = { settings,subscribed:teacherSubscribed,teacher:'teacher',teachers:[{id:'teacher',name:'담임'}],threads,push_key:publicPushKey };
    else if (fn === 'teacher_set_inquiry_push') teacherSubscribed = args.p_enabled;
    else if (fn === 'class_set_channel') settings[args.p_channel] = args.p_enabled;
    else if (fn === 'parent_ask') threads.push({ id:args.p_request,question:args.p_question,created_at:snapshot,answer:null });
    else if (fn === 'parent_answer') threads.find(i => i.id === args.p_thread).answer = args.p_answer;
    else if (fn === 'student_save_info') {
      assert.equal(args.p_class, 'class');
      assert.equal(args.p_parent_name, '김보호');
      assert.equal(args.p_parent_phone, '010-1234-5678');
      assert.equal(args.p_parent_consent, true);
      account = { name: args.p_parent_name, last4: '5678' };
      data = { student_id: 'student' };
    } else if (fn === 'parent_publish_feedback') {
      assert.ok(account);
      assert.equal(args.p_student, 'student');
      publishedFeedback = args.p_body;
      data = args.p_request;
    } else if (fn === 'parent_login') {
      assert.deepEqual(args, { p_name: '김보호', p_phone: '010-1234-5678' });
      linked = true;
      data = { sessions: [{ id: 'e35b49c4-2fa5-489b-89ce-2c15cfd54c9a', token, student_id: 'student' }] };
    } else if (fn === 'parent_home') {
      assert.equal(args.p_token, token);
      data = linked ? { name: '민서', academy: 'QA 학원', read_through: read, snapshot,
        settings, threads, push_key: publicPushKey,
        push_enabled: enabled && args.p_endpoint === endpoint, homework: [
          { assignment_id: '1', source: 'online', title: '철자 숙제', published_at: '2026-11-18T01:00:00Z',
            due_at: '2026-11-19T14:59:00Z', completed_at: '2026-11-18T03:00:00Z', status: 'completed' },
        ], attendance: [
          { id: 'presence', day: '2026-11-18', present: true, check_in_kind: 'day', checked_in_at: null, checked_out_at: null },
        ], notices: [
          { source: 'online', assignment_id: '1', kind: 'published', happened_at: '2026-11-18T01:00:00Z', title: '철자 숙제', body: null, details: {} },
          { source: 'online', assignment_id: '1', kind: 'completed', happened_at: '2026-11-18T03:00:00Z', title: '철자 숙제', body: null, details: {} },
          { source: 'feedback', assignment_id: '2', kind: 'feedback', happened_at: '2026-11-18T04:00:00Z', title: null, body: publishedFeedback, details: {} },
        ] } : { error: 'expired' };
    } else if (fn === 'parent_set_family_push') {
      assert.equal(args.p_endpoint, endpoint);
      assert.deepEqual(args.p_tokens, [token]);
      enabled = args.p_enabled;
      data = { enabled };
    } else if (fn === 'parent_read') read = args.p_through;
    else if (fn === 'parent_logout') linked = false;
    await route.fulfill({ json: data });
  });
  const staff = await ctx.newPage();
  await staff.goto(origin + '/parent-staff-qa');
  await staff.getByText('학부모 계정·피드백', { exact: true }).click();
  await staff.getByRole('button', { name: '학생 정보 수정', exact: true }).click();
  await staff.getByRole('heading', { name: '학생 정보 수정', exact: true }).waitFor();
  await staff.getByLabel('학부모 성함', { exact: true }).fill('김보호');
  await staff.getByLabel('학부모 전화번호', { exact: true }).fill('01012345678');
  const saveInformation = staff.getByRole('button', { name: '저장', exact: true });
  assert.equal(await saveInformation.isEnabled(), false);
  await staff.getByRole('checkbox').check();
  await saveInformation.click();
  await staff.getByText(/김보호.*5678/).waitFor();
  await staff.getByRole('button', { name: '학부모 로그인 주소 복사' }).waitFor();
  await staff.getByLabel('학생 피드백', { exact: true }).fill('road 철자를 혼자 썼어요. 내일 다시 확인해 주세요.');
  await staff.getByRole('button', { name: '학부모에게 보내기', exact: true }).click();
  await staff.getByText('학부모에게 피드백을 보냈어요.', { exact: true }).waitFor();
  assert.ok(publishedFeedback.includes('road'));
  await staff.getByRole('button', { name: '학생 등록', exact: true }).click();
  await staff.getByRole('heading', { name: '학생 등록', exact: true }).waitFor();
  await staff.getByLabel('학생 이름', { exact: true }).fill('지우');
  await staff.getByLabel('학부모 성함', { exact: true }).fill('김보호');
  await staff.getByLabel('학부모 전화번호', { exact: true }).fill('01012345678');
  const registerStudent = staff.getByRole('button', { name: '등록', exact: true });
  assert.equal(await registerStudent.isEnabled(),false);
  await staff.getByRole('checkbox').check();
  await registerStudent.click();
  await staff.getByRole('dialog').waitFor({state:'hidden'});
  await staff.getByText('이 반의 학부모 소통 설정·문의').click();
  await staff.getByRole('checkbox',{name:'문의',exact:true}).click();
  await staff.getByRole('heading',{name:'학부모 문의',exact:true}).waitFor();
  await staff.getByRole('button',{name:'이 기기 문의 푸시 켜기'}).click();
  await staff.getByRole('button',{name:'이 기기 문의 푸시 끄기'}).waitFor();
  assert.equal(teacherSubscribed,true);
  const page = await ctx.newPage();
  await page.goto(origin + '/p');
  await page.getByRole('heading', { name: '우리 아이 소식' }).waitFor();
  assert.equal(await page.locator('link[rel=manifest]').getAttribute('href'), '/parent.webmanifest');
  assert.equal(new URL(page.url()).hash, '');
  await page.getByLabel('학부모 성함', { exact: true }).fill('김보호');
  await page.getByLabel('학부모 전화번호', { exact: true }).fill('01012345678');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByText('철자 숙제', { exact: true }).waitFor();
  await page.getByRole('button', { name: '푸시 켜기' }).click();
  await page.getByRole('button', { name: '푸시 끄기' }).waitFor();
  assert.equal(enabled, true);
  await page.getByRole('button', { name: '출석', exact: true }).click();
  await page.getByText('출석 기록 있음', { exact: true }).waitFor();
  assert.equal(await page.getByText('12:00', { exact: false }).count(),0);
  await page.getByRole('button', { name: '알림함 · 3' }).click();
  await page.getByText('숙제를 완료했어요', { exact: false }).waitFor();
  await page.getByText(publishedFeedback, { exact: true }).waitFor();
  await page.getByRole('button', { name: '모두 읽음' }).click();
  await page.getByRole('button', { name: '알림함', exact: true }).waitFor();
  assert.equal(read, snapshot);
  await page.getByRole('button', { name: '푸시 끄기' }).click();
  await page.getByRole('button', { name: '푸시 켜기' }).waitFor();
  assert.equal(enabled, false);
  await page.getByRole('button',{name:'선생님께 문의하기'}).click();
  await page.getByLabel('문의 내용').fill('숙제 범위를 알려 주세요.');
  await page.getByRole('button',{name:'문의 보내기'}).click();
  await page.getByText('숙제 범위를 알려 주세요.',{exact:true}).waitFor();
  await staff.reload(); await staff.getByText('이 반의 학부모 소통 설정·문의').click();
  await staff.getByLabel('답변 내용').fill('3과까지예요.');
  await staff.getByRole('button',{name:'답변 보내기'}).click();
  await staff.getByText('3과까지예요.',{exact:false}).waitFor();
  await page.goto(origin+'/p?inquiry='+threads[0].id);
  await page.getByText('3과까지예요.',{exact:false}).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'inquiry-'+threads[0].id);
  await staff.close();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByRole('heading', { name: '학부모 로그인' }).waitFor();
  await page.waitForFunction(() => localStorage.getItem('classbank.parentSessions') === '[]');
  await ctx.close();

  const ios = await browser.newContext({
    locale: 'ko-KR', viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
  });
  await ios.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const apple = await ios.newPage();
  await apple.goto(origin + '/p');
  await apple.getByRole('heading', { name: '학부모 로그인' }).waitFor();
  await apple.getByText(/Safari 공유 메뉴/).waitFor();
  console.log('PASS: parent registration inside student add/edit, teacher feedback, parent login, attendance, private inquiries and replies, teacher and family push (simulated API).');
} finally {
  await browser?.close();
  await server.close();
}
