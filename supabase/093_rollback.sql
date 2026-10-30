-- 093 되돌리기: 영상 시청 기록과 광고 표시가 사라진다(기존 숙제 데이터는 그대로).
drop function if exists public.hw_watch_report(uuid, uuid, uuid, int, int);
drop function if exists public.hw_watch_state(uuid);
drop function if exists public.hw_watch_summary(uuid);
drop table if exists public.homework_watch_views;
drop table if exists public.video_ad_flags;
