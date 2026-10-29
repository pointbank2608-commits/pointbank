-- Run after 091_phonics_personal_songs.sql. Read-only checks; no user records are shown.
select name,
 case when ok then 'OK' else 'CHECK' end as result
from (
 select 'personal song table + RLS' as name,
  exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='phonics_personal_songs' and c.relrowsecurity) as ok
 union all
 select 'personal hide table + RLS',
  exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='phonics_song_hides' and c.relrowsecurity)
 union all
 select 'personal song owner policy',
  exists(select 1 from pg_policies where schemaname='public'
   and tablename='phonics_personal_songs' and policyname='personal_songs_owner')
 union all
 select 'personal hide owner policy',
  exists(select 1 from pg_policies where schemaname='public'
   and tablename='phonics_song_hides' and policyname='song_hides_owner')
 union all
 select 'song unit validation function',
  to_regprocedure('public.valid_phonics_song_units(smallint,text[])') is not null
 union all
 select 'append song to owned lesson function (invoker)',
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.oid=to_regprocedure('public.append_song_to_lesson(uuid,uuid,text,timestamptz)')
   and not p.prosecdef)
) checks;
