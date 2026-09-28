-- 032_live_quiz_rejoin.sql 이 잘 들어갔는지 확인(읽기만 함, 아무것도 바꾸지 않음).
-- SQL Editor 에 붙여 넣고 Run → 모든 줄이 ok = true 면 성공.
select '1. live_presence 표' as check_item,
       to_regclass('public.live_presence') is not null as ok
union all
select '2. live_join 이 재접속을 처리',
       coalesce((select prosrc like '%rejoined%' and prosrc like '%live_presence%'
                   from pg_proc where oid = 'public.live_join(text,text)'::regprocedure), false)
union all
select '3. live_state 가 접속 시각을 기록',
       coalesce((select prosrc like '%live_presence%'
                   from pg_proc where oid = 'public.live_state(uuid)'::regprocedure), false)
union all
select '4. 학생(로그인 없음)이 입장 함수를 쓸 수 있음',
       has_function_privilege('anon', 'public.live_join(text,text)', 'execute')
union all
select '5. 학생이 화면 함수를 쓸 수 있음',
       has_function_privilege('anon', 'public.live_state(uuid)', 'execute')
union all
select '6. live_presence 는 실시간 발행에 없음(칠판이 괜히 울리지 않게)',
       not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and tablename = 'live_presence');
