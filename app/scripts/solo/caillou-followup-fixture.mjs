import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { PGlite } from '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js';

export const assignment = '00000000-0000-0000-0000-000000000001';
export const lesson = '00000000-0000-0000-0000-000000000002';
export const student = '00000000-0000-0000-0000-000000000003';
export const academy = '00000000-0000-0000-0000-000000000004';
const teacherId = '00000000-0000-0000-0000-000000000005';
export const other = '00000000-0000-0000-0000-000000000006';

export async function openFixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select '${teacherId}'::uuid $$;
    create function hw_staff_academy() returns uuid language sql as $$ select coalesce(nullif(current_setting('fixture.academy',true),''),'${academy}')::uuid $$;
    create function academy_feature(uuid,text) returns boolean language sql as $$ select current_setting('fixture.closed',true) is distinct from $2 $$;
    create function student_session_student(uuid) returns uuid language sql as $$ select $1 $$;
    create table students (id uuid primary key, academy_id uuid, name text, archived_at timestamptz);
    create table solo_lessons (id uuid primary key, academy_id uuid, source text, steps jsonb);
    create table solo_assignments (id uuid primary key, academy_id uuid, lesson_id uuid references solo_lessons, student_id uuid references students,
      kind text, assigned_at timestamptz default now(), finished_at timestamptz);
    create table learning_sensor_snapshots (id uuid primary key, definition jsonb);
    create table learning_solo_versions (assignment_id uuid primary key, snapshot_id uuid references learning_sensor_snapshots);
    insert into students values ('${student}','${academy}','테스트 학생'), ('${other}','${academy}','다른 학생');
    insert into solo_lessons values ('${lesson}','${academy}', 'verified-video-0ca33141-ab1b-40bb-b361-8be0ff158da6-v7-10-1',
      '[{"t":"meet","word":"by myself","meaning":"혼자서"}]');
    insert into solo_assignments(id,academy_id,lesson_id,student_id,kind) values ('${assignment}','${academy}','${lesson}','${student}','lesson');
  `);
  await db.exec(await readFile(new URL('../../../supabase/118_caillou_followup.sql', import.meta.url), 'utf8'));
  const simulate = async action => {
    if (action === 'reset') {
      await db.exec('delete from caillou_followups; update solo_assignments set finished_at=null;');
    } else if (action === 'today' || action === 'tomorrow') {
      await db.query("update solo_assignments set finished_at=now()-($1::int * interval '1 day') where id=$2", [action === 'today' ? 0 : 1, assignment]);
    } else throw new Error('invalid_simulation');
    return true;
  };
  const as = async (role, query, params) => db.transaction(async tx => {
    await tx.exec(role === 'anon' ? 'set local role anon' : 'set local role authenticated');
    return (await tx.query(query, params)).rows[0].result;
  });
  return {
    db, simulate, as,
    teacher: (action, id = null, plan) => as('authenticated', 'select caillou_followup_teacher($1,$2,$3,$4,$5) as result', [lesson, id, action, plan?.lesson ?? null, plan?.homework ?? null]),
    student: (action, id = null, answer = null, token = student) => as('anon', 'select caillou_followup_student($1,$2,$3,$4) as result', [token, id, action, answer]),
  };
}

export async function startFixture(fixture, port) {
  process.env.VITE_SUPABASE_URL = 'https://fixture.invalid';
  process.env.VITE_SUPABASE_ANON_KEY = 'local-test-fixture';
  const vite = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    configFile: false,
    cacheDir: await mkdtemp(join(tmpdir(), 'caillou-followup-vite-')),
    server: { host: '127.0.0.1', port, strictPort: true },
    plugins: [react(), tailwindcss(), { name: 'caillou-followup-fixture', configureServer(server) {
      server.middlewares.use('/__caillou_preview', async (req, res) => {
        if (req.method !== 'POST' || req.headers.origin !== `http://127.0.0.1:${port}`) {
          res.writeHead(403).end();
          return;
        }
        try {
          const buffers = [];
          for await (const part of req) buffers.push(part);
          const { action, id, plan, answer } = JSON.parse(Buffer.concat(buffers).toString('utf8'));
          const result = action.startsWith('teacher:') ? await fixture.teacher(action.slice(8), id, plan)
            : action.startsWith('student:') ? await fixture.student(action.slice(8), id, answer)
            : await fixture.simulate(action);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(400).end(error.message);
        }
      });
    } }],
  });
  await vite.listen();
  return vite;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = await openFixture();
  const server = await startFixture(fixture, Number(process.argv[2] ?? 5208));
  server.printUrls();
}
