-- 필요할 때만: 앱의 이번 학습 게임 변경도 함께 되돌린다. 088a/b로 모은 기록/테이블은 삭제하지 않는다.
begin;
do $$
declare names text[][]:=array[
  array['solo_word_stats_before_games(uuid,uuid)','solo_word_stats_before_games','solo_word_stats'],
  array['student_review_candidates_before_games(uuid)','student_review_candidates_before_games','student_review_candidates'],
  array['student_skill_events_before_games(uuid,timestamptz)','student_skill_events_before_games','student_skill_events'],
  array['solo_open_before_game_learning(uuid,uuid)','solo_open_before_game_learning','solo_open'],
  array['solo_start_review_before_games(uuid,text,int,jsonb)','solo_start_review_before_games','solo_start_review']
]; row text[]; definition text;
begin
  foreach row slice 1 in array names loop
    if to_regprocedure('public.'||row[1]) is not null then
      definition:=pg_get_functiondef(to_regprocedure('public.'||row[1]));
      execute replace(definition,'FUNCTION public.'||row[2]||'(','FUNCTION public.'||row[3]||'(');
    end if;
  end loop;
end $$;
revoke all on function public.solo_game_check_open(uuid,uuid,int),public.solo_game_check_answer(uuid,uuid,int,int,text,uuid),public.solo_start_personal_game(uuid,uuid),public.student_game_growth(uuid,int),public.solo_game_results(uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
