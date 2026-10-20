-- Optional backend parity for blank activity titles. No existing rows or permissions are changed.
-- Apply only through the project's normal SQL review process; the frontend also supplies valid defaults.
begin;
create or replace function public.classbank_optional_activity_name()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
declare base text; candidate text; n integer := 1; occupied boolean;
begin
  new.name := regexp_replace(coalesce(new.name,''),'^[[:space:]]+|[[:space:]]+$','','g');
  if new.name <> '' then return new; end if;
  if tg_table_name = 'game_templates' then
    base := case new.game_type
      when 'feedmonster' then 'Feed the Monster'
      when 'sentencebridge' then 'Sentence Bridge'
      when 'sentencetower' then 'Sentence Tower'
      when 'telepathy' then '텔레파시'
      when 'shufflefind' then '컵 속 친구 찾기'
      when 'sentencesplash' then 'Sentence Splash'
      when 'wheel' then '돌림판'
      when 'ladder' then '사다리타기'
      when 'order' then '랜덤 공 뽑기'
      when 'bomb' then '시한폭탄'
      when 'timer' then '타이머 맞추기'
      when 'tictactoe' then '틱택토'
      when 'saveorgive' then 'Save it or Give it'
      when 'findmissing' then '사라진 항목 찾기'
      when 'baskin31' then '베스킨라빈스31'
      when 'connect4' then '4 in a row'
      when 'popcorn' then '팝콘 게임'
      when 'passball' then '공 돌리기'
      when 'twodice' then '두 주사위 읽기'
      when 'quiz' then '퀴즈'
      when 'hangman' then '행맨'
      when 'truefalse' then '참 또는 거짓'
      when 'matchup' then '매치업'
      when 'whackamole' then '두더지잡기'
      when 'flashcards' then '플래시카드'
      when 'anagram' then '애너그램'
      when 'groupsort' then '그룹 정렬'
      when 'unscramble' then '문장 배열하기'
      when 'typeanswer' then '답 입력하기'
      when 'spellword' then '단어 철자'
      when 'rankorder' then '순위'
      when 'wordsearch' then '워드서치'
      when 'crossword' then '크로스워드'
      when 'mathgen' then '수학 문제 생성기'
      when 'mazechase' then '미로 찾기'
      when 'airplane' then '비행기'
      when 'labeleddiagram' then '그림 속 이름 맞히기'
      when 'imagequiz' then '이미지 퀴즈'
      when 'gameshowquiz' then '팀 대항 퀴즈'
      when 'winlosequiz' then '점수 걸기 퀴즈'
      when 'watermelon' then '수박 문장'
      when 'quizshow' then '휴대폰 참여 보카 대회'
      when 'shopping' then '장보기'
      when 'treasuredig' then '보물 땅파기'
      when 'fourclues' then '단서 네 개'
      when 'catchsentence' then '문장 잡기'
      when 'lightning' then '번개 피하기'
      when 'lastbox' then '마지막 박스 챌린지'
      when 'mysterybox' then '미스터리 박스'
      when 'airport' then '공항 롤플레이'
      when 'restaurant' then '레스토랑 롤플레이'
      when 'icecream' then '아이스크림 가게'
      when 'doctor' then '병원 롤플레이'
      else '새 게임' end;
  else
    base := case when new.kind = 'sentence' then '새 문장 모음' else '새 단어장' end;
  end if;
  -- Serialize generated labels in the same academy/scope without broadening visibility.
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.academy_id::text || ':' || coalesce(new.class_id::text,''),0));
  loop
    candidate := base || case when n=1 then '' else ' ' || n::text end;
    if tg_table_name = 'game_templates' then
      select exists(select 1 from public.game_templates g where g.academy_id=new.academy_id and g.class_id is not distinct from new.class_id and g.game_type=new.game_type and g.name=candidate and g.id is distinct from new.id) into occupied;
    else
      select exists(select 1 from public.word_lists w where w.academy_id=new.academy_id and w.class_id is not distinct from new.class_id and w.name=candidate and w.id is distinct from new.id) into occupied;
    end if;
    exit when not occupied;
    n := n+1;
  end loop;
  new.name := candidate;
  return new;
end $$;
drop trigger if exists game_templates_optional_name on public.game_templates;
create trigger game_templates_optional_name before insert or update of name on public.game_templates for each row execute function public.classbank_optional_activity_name();
drop trigger if exists word_lists_optional_name on public.word_lists;
create trigger word_lists_optional_name before insert or update of name on public.word_lists for each row execute function public.classbank_optional_activity_name();
commit;
