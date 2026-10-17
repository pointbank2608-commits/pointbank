-- 086r: 대량 변경 묶음(미리보기 → 적용 → 되돌리기). 지금은 "학원 기능 열기·닫기"만 지원한다.
-- 대상: 현재 검색 결과 전체(scope.mode = 'filter': 검색어·필터·테스트 제외 옵션) 또는 직접 고른 학원(scope.mode = 'ids').
-- 미리보기는 아무것도 바꾸지 않고 "누가 어떻게 바뀌는지"를 묶음(batch)으로 저장한다. 적용은 그 묶음 번호로만 할 수 있어서
-- 화면에서 본 대상 그대로 바뀌고, 같은 묶음을 두 번 눌러도 한 번만 적용된다.

create table if not exists public.admin_bulk_batches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('features')),
  scope jsonb not null,
  params jsonb not null,
  status text not null default 'previewed' check (status in ('previewed', 'running', 'done', 'partial', 'undone')),
  target_count int not null default 0,
  changed_count int not null default 0,
  ok_count int not null default 0,
  failed_count int not null default 0,
  reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  undone_at timestamptz
);

create table if not exists public.admin_bulk_items (
  batch_id uuid not null references public.admin_bulk_batches(id) on delete cascade,
  academy_id uuid not null references public.academies(id) on delete cascade,
  before jsonb not null,
  after jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'ok', 'failed', 'undone', 'undo_skipped')),
  error text,
  primary key (batch_id, academy_id)
);

alter table public.admin_bulk_batches enable row level security;
alter table public.admin_bulk_items enable row level security;
drop policy if exists admin_bulk_batches_admin on public.admin_bulk_batches;
create policy admin_bulk_batches_admin on public.admin_bulk_batches for select using (public.is_platform_admin());
drop policy if exists admin_bulk_items_admin on public.admin_bulk_items;
create policy admin_bulk_items_admin on public.admin_bulk_items for select using (public.is_platform_admin());

-- 미리보기(저장만 하고 학원 데이터는 바꾸지 않는다). 열을 null 로 두면 그 기능은 그대로 둔다.
create or replace function public.admin_bulk_features_preview(
  p_query text, p_filter text, p_ids uuid[], p_exclude_test boolean,
  p_group boolean default null, p_solo boolean default null, p_homework boolean default null)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_target int;
  v_changed int;
  v_ids uuid[];
begin
  if not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  if p_group is null and p_solo is null and p_homework is null then raise exception '바꿀 기능을 하나 이상 고르세요.'; end if;

  insert into public.admin_bulk_batches (id, kind, scope, params)
  values (v_batch, 'features',
          case when p_ids is not null and array_length(p_ids, 1) > 0
               then jsonb_build_object('mode', 'ids', 'count', array_length(p_ids, 1))
               else jsonb_build_object('mode', 'filter', 'query', coalesce(p_query, ''), 'filter', coalesce(p_filter, 'all'), 'exclude_test', coalesce(p_exclude_test, true)) end,
          jsonb_build_object('group', p_group, 'solo', p_solo, 'homework', p_homework));

  if p_ids is not null and array_length(p_ids, 1) > 0 then
    v_ids := p_ids;
  else
    select coalesce(array_agg(i), '{}'::uuid[]) into v_ids from public.admin_academy_ids(p_query, p_filter, p_exclude_test) i;
  end if;

  insert into public.admin_bulk_items (batch_id, academy_id, before, after)
  select v_batch, a.id,
         jsonb_build_object('group', public.academy_feature(a.id, 'group'), 'solo', public.academy_feature(a.id, 'solo'), 'homework', public.academy_feature(a.id, 'homework')),
         jsonb_build_object('group', coalesce(p_group, public.academy_feature(a.id, 'group')),
                            'solo', coalesce(p_solo, public.academy_feature(a.id, 'solo')),
                            'homework', coalesce(p_homework, public.academy_feature(a.id, 'homework')))
    from public.academies a where a.id = any(v_ids);

  select count(*) into v_target from public.admin_bulk_items where batch_id = v_batch;
  delete from public.admin_bulk_items where batch_id = v_batch and before = after;
  select count(*) into v_changed from public.admin_bulk_items where batch_id = v_batch;
  update public.admin_bulk_batches set target_count = v_target, changed_count = v_changed where id = v_batch;

  return jsonb_build_object('batch_id', v_batch, 'targets', v_target, 'will_change', v_changed, 'unchanged', v_target - v_changed,
    'sample', (select coalesce(jsonb_agg(jsonb_build_object('academy', n.name, 'before', n.before, 'after', n.after)), '[]'::jsonb)
                 from (select a.name, i.before, i.after from public.admin_bulk_items i join public.academies a on a.id = i.academy_id
                        where i.batch_id = v_batch order by a.name limit 10) n));
end $$;

revoke all on function public.admin_bulk_features_preview(text, text, uuid[], boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_bulk_features_preview(text, text, uuid[], boolean, boolean, boolean, boolean) to authenticated;
