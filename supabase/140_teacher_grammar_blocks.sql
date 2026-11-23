-- Teacher-owned grammar boards. Lessons embed a copy in their existing playlist.
create table public.teacher_grammar_blocks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  academy_id uuid not null default public.my_academy_id() references public.academies(id) on delete cascade,
  block jsonb not null check (jsonb_typeof(block) = 'object'
    and block ?& array['grammarId','content']
    and jsonb_typeof(block->'content') = 'object'
    and (block->'content') ?& array['name','pattern','examples']
    and length(trim(block->'content'->>'name')) > 0
    and jsonb_typeof(block->'content'->'examples') = 'array'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now()
);
create index teacher_grammar_blocks_owner on public.teacher_grammar_blocks(academy_id, owner_id, created_at desc);
alter table public.teacher_grammar_blocks enable row level security;
create policy teacher_grammar_blocks_owner on public.teacher_grammar_blocks for all to authenticated
  using (owner_id = auth.uid() and academy_id = public.my_academy_id() and public.is_staff())
  with check (owner_id = auth.uid() and academy_id = public.my_academy_id() and public.is_staff());
revoke all on public.teacher_grammar_blocks from public, anon, authenticated;
grant select, insert, update on public.teacher_grammar_blocks to authenticated;
