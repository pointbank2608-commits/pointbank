import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js';

const academy = '10000000-0000-4000-8000-000000000001';
const otherAcademy = '10000000-0000-4000-8000-000000000002';
const user = '20000000-0000-4000-8000-000000000001';
const words = '30000000-0000-4000-8000-000000000001';
const sentences = '30000000-0000-4000-8000-000000000002';
const fresh = '30000000-0000-4000-8000-000000000003';
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user', true),'')::uuid$$;
    create function public.my_academy_id() returns uuid language sql as $$select nullif(current_setting('test.academy', true),'')::uuid$$;
    create function public.is_staff() returns boolean language sql as $$select coalesce(current_setting('test.staff', true),'false') = 'true'$$;
    create table public.academies(id uuid primary key, plan text, trial_ends_at date);
    create table public.word_lists(id uuid primary key, academy_id uuid not null, class_id uuid, created_by uuid,
      kind text, name text, items jsonb not null default '[]', created_at timestamptz default now(), updated_at timestamptz default now());
    alter table public.word_lists enable row level security;
    create policy read_lists on public.word_lists for select using(academy_id = public.my_academy_id());
    create policy write_lists on public.word_lists for all using(academy_id = public.my_academy_id() and public.is_staff())
      with check(academy_id = public.my_academy_id() and public.is_staff());
    grant usage on schema public, auth to authenticated;
    grant select, insert, update on public.word_lists to authenticated;
    grant select on public.academies to authenticated;
  `);
  await db.exec(readFileSync(new URL('../../../supabase/145_save_study_lists.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../../../supabase/080c_free_wordlist_limit.sql', import.meta.url), 'utf8'));
  await db.query('insert into academies(id,plan) values($1,$2)', [academy, 'paid']);
  const river = { id: 'old-river', word: 'river', meaning: '강', image_url: '/river.webp', example: 'A river flows.' };
  await db.query('insert into word_lists(id,academy_id,kind,name,items) values($1,$2,null,$3,$4),($5,$2,$6,$7,$8)',
    [words, academy, 'Original words', JSON.stringify([river]), sentences, 'sentence', 'Original sentences', '[]']);
  const foreign = '30000000-0000-4000-8000-000000000004';
  await db.query('insert into word_lists(id,academy_id,kind,name,items) values($1,$2,$3,$4,$5)', [foreign, otherAcademy, 'word', 'Private', '[]']);
  await db.exec(`set role authenticated; select set_config('test.user','${user}',false),
    set_config('test.academy','${academy}',false),set_config('test.staff','true',false);`);
  const save = lists => db.query('select * from public.save_study_lists($1,$2)', [academy, JSON.stringify(lists)]);
  const read = async id => (await db.query('select * from word_lists where id=$1', [id])).rows[0];
  const additions = [{ id: 'duplicate', word: '\t RIVER \n', meaning: '강' },
    { id: 'new-river', word: 'river', meaning: '강물', image_url: '/new.webp' },
    { id: 'new-forest', word: 'forest', meaning: '숲', category: 'nature' },
    { id: 'duplicate-forest', word: 'forest', meaning: '숲' }];
  const request = [{ id: words, kind: 'word', append: true, items: additions }];
  await save(request);
  assert.deepEqual((await read(words)).items, [river, additions[1], additions[2]]);
  assert.equal((await read(words)).name, 'Original words');
  await save(request);
  assert.equal((await read(words)).items.length, 3);

  // A retry retains stable IDs, so an intervening edit does not re-add the old text.
  const edited = (await read(words)).items;
  edited[1].meaning = '흐르는 강물';
  await db.query('update word_lists set items=$1 where id=$2', [JSON.stringify(edited), words]);
  await save(request);
  assert.deepEqual((await read(words)).items, edited);
  const unchangedAt = (await read(words)).updated_at;
  await save(request);
  assert.deepEqual((await read(words)).updated_at, unchangedAt);

  await assert.rejects(save([
    { id: words, kind: 'word', append: true, items: [{ id: 'rollback', word: 'lake', meaning: '호수' }] },
    { id: sentences, kind: 'word', append: true, items: [{ id: 'wrong-kind', word: 'lake', meaning: '호수' }] },
  ]), /study_list_missing/);
  assert.deepEqual((await read(words)).items, edited);
  await assert.rejects(save([
    { id: fresh, kind: 'word', name: 'New list', items: [{ id: 'new', word: 'lake', meaning: '호수' }] },
    { id: sentences, kind: 'word', append: true, items: [] },
  ]), /study_list_missing/);
  assert.equal(await read(fresh), undefined);

  const mixed = [
    { id: fresh, kind: 'word', name: 'New list', items: [{ id: 'new', word: 'lake', meaning: '호수' }] },
    { id: sentences, kind: 'sentence', append: true, items: [{ id: 'sentence', word: 'We see a river.', meaning: '강이 보여요.' }] },
  ];
  await save(mixed);
  await save(mixed);
  assert.equal((await read(fresh)).items.length, 1);
  assert.equal((await read(sentences)).items.length, 1);
  await assert.rejects(save([{ id: foreign, kind: 'word', append: true, items: additions }]), /study_list_missing/);
  await db.exec('reset role');
  await db.query("update academies set plan='free' where id=$1", [academy]);
  await db.exec('set role authenticated');
  await assert.rejects(save([{ id: words, kind: 'word', append: true,
    items: Array.from({ length: 11 }, (_, index) => ({ id: 'free-' + index, word: 'word ' + index, meaning: '뜻' })) }]), /10개/);
  assert.deepEqual((await read(words)).items, edited);
  await assert.rejects(save([{ id: sentences, kind: 'sentence', append: true,
    items: [{ id: 'readonly', word: 'A new sentence.', meaning: '새 문장' }] }]), /읽기 전용/);
  await assert.rejects(db.query('select * from save_study_lists($1,$2)', [otherAcademy, JSON.stringify(request)]), /study_list_access_denied/);
  await db.exec("select set_config('test.staff','false',false)");
  await assert.rejects(save(request), /study_list_access_denied/);
  await db.exec("select set_config('test.staff','true',false),set_config('test.user','',false)");
  await assert.rejects(save(request), /study_list_access_denied/);
  await db.exec('reset role; set role anon');
  await assert.rejects(save(request), /permission denied/);
  console.log('PASS atomic list append, metadata, duplicate senses, retry IDs, rollback, legacy kind, and access isolation');
} finally {
  await db.close();
}
