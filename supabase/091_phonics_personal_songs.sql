-- Review locally first. No operational database changes are made by the application.
create or replace function public.valid_phonics_song_units(p_level smallint,p_units text[])
returns boolean language sql immutable set search_path=public as $$
 select coalesce(array_length(p_units,1),0)=0 or (
  p_level between 1 and 5 and cardinality(p_units)<=9 and
  not exists(select 1 from unnest(p_units) x where x is null or
   x !~ ('^course-'||p_level||'-[1-'||case when p_level in (1,5) then '9' else '8' end||']$'))
 );
$$;
create table if not exists public.phonics_personal_songs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 academy_id uuid not null default public.my_academy_id() references public.academies(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 200),
 youtube_id text not null check(youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
 level smallint check(level between 1 and 5),
 unit_ids text[] not null default '{}',
 duration integer check(duration between 1 and 86400),
 channel text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint personal_song_units check (coalesce(public.valid_phonics_song_units(level,unit_ids),false))
);
create index if not exists personal_songs_owner on public.phonics_personal_songs(owner_id,updated_at desc);
alter table public.phonics_personal_songs enable row level security;
drop policy if exists personal_songs_owner on public.phonics_personal_songs;
create policy personal_songs_owner on public.phonics_personal_songs for all to authenticated
 using(owner_id=auth.uid() and academy_id=public.my_academy_id() and public.is_staff())
 with check(owner_id=auth.uid() and academy_id=public.my_academy_id() and public.is_staff());
grant select,insert,update,delete on public.phonics_personal_songs to authenticated;

create table if not exists public.phonics_song_hides (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 clip_id uuid not null references public.video_clips(id) on delete cascade,
 primary key(user_id,clip_id)
);
alter table public.phonics_song_hides enable row level security;
drop policy if exists song_hides_owner on public.phonics_song_hides;
create policy song_hides_owner on public.phonics_song_hides for all to authenticated
 using(user_id=auth.uid() and public.is_staff()) with check(user_id=auth.uid() and public.is_staff());
grant select,insert,delete on public.phonics_song_hides to authenticated;

-- Derive the snapshot server-side from an accessible song; never accept another user's URL or lesson.
create or replace function public.append_song_to_lesson(p_lesson uuid,p_song uuid,p_source text,p_expected timestamptz)
returns uuid language plpgsql security invoker set search_path=public as $$
declare l public.curriculum_lessons; s public.phonics_personal_songs; v public.video_clips;
 slide jsonb; base jsonb; new_id uuid:=gen_random_uuid();
begin
 if not public.is_staff() then raise exception 'not_staff';end if;
 select * into l from public.curriculum_lessons where id=p_lesson and created_by=auth.uid() and academy_id=public.my_academy_id() for update;
 if not found then raise exception 'lesson_not_owned';end if;
 if l.updated_at is distinct from p_expected then raise exception 'lesson_changed_retry';end if;
 if p_source='personal' then
  select * into s from public.phonics_personal_songs where id=p_song and owner_id=auth.uid();
  if not found then raise exception 'song_not_owned';end if;
  slide:=jsonb_strip_nulls(jsonb_build_object('id',new_id,'kind','video','title',s.title,'videoUrl','https://www.youtube.com/watch?v='||s.youtube_id,'startSec',0,'endSec',s.duration));
 elsif p_source='provided' then
  select * into v from public.video_clips where id=p_song and not hidden and pack ? 'phonicsSong';
  if not found then raise exception 'song_unavailable';end if;
  slide:=jsonb_build_object('id',new_id,'kind','video','title',v.title,'videoUrl','https://www.youtube.com/watch?v='||v.youtube_id,'startSec',v.start_sec,'endSec',v.end_sec);
 else raise exception 'invalid_source';end if;
 base:=coalesce(l.playlist,'[]'::jsonb);
 if jsonb_array_length(base)>0 and not (base->0 ? 'kind') then
  select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','kind','game','gameType',x->>'gameType')),'[]'::jsonb) into base from jsonb_array_elements(base) x;
 end if;
 if l.video_url is not null and length(trim(l.video_url))>0 and not exists(select 1 from jsonb_array_elements(base) x where x->>'kind'='video') then
  base:=jsonb_build_array(jsonb_build_object('id','legacy-video-'||l.video_url,'kind','video','videoUrl',l.video_url))||base;
 end if;
 update public.curriculum_lessons set playlist=base||jsonb_build_array(slide),updated_at=clock_timestamp() where id=l.id;
 return new_id;
end;$$;
revoke all on function public.append_song_to_lesson(uuid,uuid,text,timestamptz) from public;
grant execute on function public.append_song_to_lesson(uuid,uuid,text,timestamptz) to authenticated;
