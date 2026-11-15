import assert from 'node:assert/strict';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/playwright/index.mjs';
import { academy, assignment, lesson, openFixture, startFixture, student } from './caillou-followup-fixture.mjs';

const classId = '00000000-0000-0000-0000-000000000007';
const uid = '00000000-0000-0000-0000-000000000005';
const title = '카이유 1차시 · 처음 타는 스케이트';
const ref = 'fixture';
const port = 5220;
const origin = `http://127.0.0.1:${port}`;
const base64 = data => Buffer.from(JSON.stringify(data)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const user = { id: uid, role: 'authenticated', aud: 'authenticated', email: 'teacher@example.test', app_metadata: {}, user_metadata: {} };
const session = { user, access_token: `${base64({ alg: 'HS256' })}.${base64({ sub: uid, exp, aud: 'authenticated', role: 'authenticated', aal: 'aal1' })}.test-only`, refresh_token: 'test-only', expires_at: exp };
const features = { group: true, solo: true, homework: true };
const fixture = await openFixture();
let vite;
let browser;
try {
  vite = await startFixture(fixture, port);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const calls = [];
  const errors = [];
  async function context(teacher) {
    const ctx = await browser.newContext({ viewport: teacher ? { width: 1440, height: 1000 } : { width: 420, height: 900 } });
    await ctx.addInitScript(({ teacher, session, ref, student }) => {
      localStorage.setItem('classbank.lang', 'ko');
      if (teacher) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
      else localStorage.setItem('classbank.studentToken', student);
    }, { teacher, session, ref, student });
    await ctx.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === origin) return route.continue();
      if (url.hostname !== 'fixture.invalid') return route.abort();
      const name = url.pathname.split('/').at(-1);
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      let data = [];
      if (name === 'user') data = user;
      if (name === 'profiles') data = [{ id: uid, academy_id: academy, role: 'owner', display_name: '테스트 선생님' }];
      if (name === 'academies') data = [{ id: academy, name: '테스트 학원', plan: 'paid', plan_status: 'active', features }];
      if (name === 'classes') data = [{ id: classId, academy_id: academy, name: '테스트 반' }];
      if (name === 'my_deletion_request') data = null;
      if (name === 'learning_path_teacher_summary') data = { plans: [], recommendations: [], protection: [] };
      if (name === 'learning_vocab_cue_feedback') data = { cue_ready: true, lessons: [], rows: [], drafts: [], followups: [], cue_rows: [] };
      if (name === 'solo_lessons') {
        const [stored] = (await fixture.db.query('select * from solo_lessons where id=$1', [lesson])).rows;
        data = [{ ...stored, name: title, class_id: classId, minutes: 10 }];
      }
      if (name === 'solo_assignments') data = (await fixture.db.query('select * from solo_assignments')).rows;
      if (name === 'student_home_with_vocab_schedule') {
        const [row] = (await fixture.db.query('select * from solo_assignments where id=$1', [assignment])).rows;
        data = { name: '테스트 학생', academy: '테스트 학원', lessons: [{ id: row.id, name: title, kind: 'lesson', done: !!row.finished_at, progress: 0, total: 1, minutes: 10 }], homework: [], features };
      }
      if (name === 'caillou_followup_teacher' || name === 'caillou_followup_student') {
        const body = request.postDataJSON();
        calls.push([name, body.p_action ?? 'list']);
        try {
          if (name.endsWith('_teacher')) {
            assert.equal(teacher, true);
            assert.equal(body.p_lesson, lesson);
            data = await fixture.teacher(body.p_action, body.p_assignment, { lesson: body.p_lesson_plan, homework: body.p_homework_plan });
          } else {
            assert.equal(teacher, false);
            assert.equal(body.p_token, student);
            data = await fixture.student(body.p_action ?? 'list', body.p_assignment, body.p_value, body.p_token);
          }
        } catch (error) {
          return route.fulfill({ status: 400, headers, json: { message: error.message } });
        }
      }
      return route.fulfill({ status: 200, headers, json: data });
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', err => errors.push(err.message));
    return page;
  }
  const teacherPage = await context(true);
  const pupilPage = await context(false);
  const button = (p, name) => p.getByRole('button', { name, exact: true });
  await teacherPage.goto(`${origin}/curriculum`);
  await teacherPage.getByRole('tab', { name: /개별수업/ }).click();
  await teacherPage.getByText('저장한 개별수업', { exact: true }).click();
  await teacherPage.getByText(title, { exact: true }).waitFor();
  await teacherPage.getByText('다음 날 숙제와 추천', { exact: true }).click();
  await button(teacherPage, '첫 문항 미리보기').click();
  await teacherPage.getByText(/내 가방은 혼자 챙기고 싶다고/).waitFor();
  await button(teacherPage, '다음 날 숙제 연결').click();
  await teacherPage.getByText('개별수업을 마친 다음 날 열려요.').waitFor();
  await pupilPage.goto(`${origin}/s`);
  await pupilPage.getByRole('heading', { name: /숙제$/, level: 2 }).waitFor();
  await pupilPage.getByText('개별수업을 마친 다음 날 열려요.').waitFor();
  assert.equal(await button(pupilPage, '숙제 시작').count(), 0);
  await fixture.simulate('today');
  await pupilPage.reload();
  await pupilPage.getByText(/월 \d+일에 열려요\./).waitFor();
  await fixture.simulate('tomorrow');
  await pupilPage.reload();
  await button(pupilPage, '숙제 시작').click();
  assert.equal(await button(pupilPage, '힌트 보기').count(), 0);
  await pupilPage.getByLabel('영어 문장').fill('I want to pack my bag.');
  await button(pupilPage, '첫 답 제출').click();
  await button(pupilPage, '힌트 보기').click();
  await pupilPage.getByText(/pack my bag으로 말할 수 있어요/).waitFor();
  await pupilPage.getByLabel('영어 문장').fill('I want to pack my bag by myself.');
  await button(pupilPage, '다시 쓴 답 제출').click();
  await pupilPage.getByText(/선생님이 답을 확인할 수 있어요/).waitFor();
  await button(teacherPage, '결과 새로고침').click();
  await button(teacherPage, '추천 미리보기').click();
  await teacherPage.getByText('사용함', { exact: true }).waitFor();
  await button(teacherPage, '수정').click();
  await teacherPage.getByLabel('다음 숙제 수정').fill('다음 날 혼자 도시락을 챙기는 상황에서 첫 답을 확인해요.');
  await button(teacherPage, '수정 반영').click();
  await button(teacherPage, '계획 승인').click();
  await teacherPage.getByText('승인한 계획 · 배정 전').waitFor();
  await teacherPage.getByText('다음 날 혼자 도시락을 챙기는 상황에서 첫 답을 확인해요.', { exact: true }).waitFor();
  assert.deepEqual(calls.filter(([, action]) => action !== 'list').map(([, action]) => action), ['enable', 'first', 'hint', 'retry', 'approve']);
  assert.deepEqual(errors, []);
  console.log('PASS real /curriculum individual lesson card and /s homework routes with isolated PostgreSQL RPCs');
} finally {
  await browser?.close();
  await vite?.close();
  await fixture.db.close();
}
