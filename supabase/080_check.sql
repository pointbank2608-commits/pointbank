-- 080 확인(읽기 전용)
select
  exists (select 1 from information_schema.columns
           where table_name = 'academies' and column_name = 'trial_ends_at') as trial_col,
  exists (select 1 from pg_proc where proname = 'check_free_wordlist_limit') as wordlist_fn,
  exists (select 1 from pg_trigger where tgname = 'word_lists_free_cap') as wordlist_trigger,
  exists (select 1 from pg_proc where proname = 'admin_extend_trial') as extend_fn,
  (select min(trial_ends_at) from public.academies) as earliest_trial_end,
  (select max(trial_ends_at) from public.academies) as latest_trial_end;
