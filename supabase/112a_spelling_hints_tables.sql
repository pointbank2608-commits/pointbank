begin;
create table if not exists public.homework_spelling_hints (
  attempt_id uuid not null references public.homework_attempts(id) on delete cascade,
  item_id uuid not null references public.homework_items(id) on delete cascade,
  q_index integer not null check (q_index >= 0),
  used smallint not null check (used in (1,2)),
  first_revealed_at timestamptz not null default now(),
  partial_revealed_at timestamptz,
  primary key (attempt_id,item_id,q_index)
);
alter table public.homework_spelling_hints enable row level security;
revoke all on public.homework_spelling_hints from public,anon,authenticated;

create or replace function public.hw_spelling_allowance(config jsonb, student uuid) returns int
language sql immutable set search_path=pg_catalog as $$
 select case coalesce(config #>> array['block','spellingHints','overrides',student::text],
                      config #>> '{block,spellingHints,defaultLevel}')
        when '1' then 1 when '2' then 2 else 0 end
$$;
revoke all on function public.hw_spelling_allowance(jsonb,uuid) from public,anon,authenticated;

create or replace function public.hw_spelling_mask(target text,lvl int) returns text
language sql immutable set search_path=pg_catalog as $$
 select case when lvl>0 then (select string_agg(case when pos=1 or substr(target,pos,1) in (' ','-',chr(39))
  or (lvl=2 and ((length(target)=3 and pos=2) or (pos%2=1 and pos<length(target)))) then substr(target,pos,1) else '_' end,' ' order by pos)
  from generate_series(1,length(target)) pos) end
$$;
revoke all on function public.hw_spelling_mask(text,int) from public,anon,authenticated;
commit;
