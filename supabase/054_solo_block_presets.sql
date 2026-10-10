-- 054: 개별수업 "내 블록 조합" 저장 — 수업을 만들 때 쓰는 활동 블록 켜기/끄기·단계 수를 이름 붙여 학원 안에서 다시 쓴다.
-- 학원 단위(선생님 모두 공유), 선생님만 읽고 쓴다. 이 파일 하나를 실행하고, 끝의 확인 결과가 모두 true 인지 본다.

create table if not exists public.solo_block_presets (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- { "off": ["spell", ...], "limit": { "pickWord": 5, ... } }
  config jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (academy_id, name)
);
create index if not exists solo_block_presets_academy_idx on public.solo_block_presets (academy_id, created_at desc);

alter table public.solo_block_presets enable row level security;
drop policy if exists solo_block_presets_staff on public.solo_block_presets;
create policy solo_block_presets_staff on public.solo_block_presets
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());

revoke all on public.solo_block_presets from anon;

-- 확인(읽기 전용): 셋 다 true 여야 한다
select
  to_regclass('public.solo_block_presets') is not null as table_exists,
  not has_table_privilege('anon', 'public.solo_block_presets', 'select') as hidden_from_anon,
  has_table_privilege('authenticated', 'public.solo_block_presets', 'select') as teachers_can_read;
