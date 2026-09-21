-- 카드사·PG 심사용 계정(test@test.com)에 샘플 반/학생/통장/출석 기록을 넣는다.
-- SQL Editor 에 통째로 붙여 실행. 학생이 이미 있으면 아무것도 하지 않는다(재실행 안전).
-- 실제 서비스 스키마(schema.sql, 010_homework_tracking.sql)만 사용하고 다른 학원 데이터는 건드리지 않는다.

do $$
declare
  v_uid      uuid;
  v_academy  uuid;
  v_name     text;
  v_class1   uuid;
  v_class2   uuid;
  v_names1   text[] := array['김하늘','이서준','박지우','최민서','정하윤','강도윤','조서연','윤지호'];
  v_names2   text[] := array['한지민','오세훈','서유진','임도현','신예린','배준영'];
  v_ids1     uuid[] := '{}';
  v_ids2     uuid[] := '{}';
  v_id       uuid;
  v_n        text;
  v_day      date;
  v_i        int;
  v_k        int;
  v_delta    int;
  v_reason   text;
  v_hw       boolean;
begin
  select id into v_uid from auth.users where email = 'test@test.com';
  if v_uid is null then raise exception 'test@test.com 계정이 없어요. 먼저 가입하세요.'; end if;

  select academy_id, display_name into v_academy, v_name from public.profiles where id = v_uid;
  if v_academy is null then raise exception '이 계정에 학원이 없어요.'; end if;
  if exists (select 1 from public.students where academy_id = v_academy) then
    raise notice '이미 학생이 있어서 건너뜁니다.';
    return;
  end if;

  -- 반: 기본 1반 이름 변경 + 두 번째 반 추가
  select id into v_class1 from public.classes where academy_id = v_academy order by sort_order limit 1;
  update public.classes set name = '초등 3학년 A반' where id = v_class1;
  insert into public.classes (academy_id, name, sort_order) values (v_academy, '초등 4학년 B반', 1) returning id into v_class2;

  -- 학생
  foreach v_n in array v_names1 loop
    insert into public.students (academy_id, class_id, name) values (v_academy, v_class1, v_n) returning id into v_id;
    v_ids1 := v_ids1 || v_id;
  end loop;
  foreach v_n in array v_names2 loop
    insert into public.students (academy_id, class_id, name) values (v_academy, v_class2, v_n) returning id into v_id;
    v_ids2 := v_ids2 || v_id;
  end loop;

  -- 최근 8일: 평일마다 출석(등원 15:00~15:10, 하원 17:00~17:20, 가끔 결석) + 통장 적립/차감
  for v_i in 1..8 loop
    v_day := current_date - v_i;
    continue when extract(dow from v_day) in (0, 6);

    -- 반 A 출석·통장
    for v_k in 1..array_length(v_ids1, 1) loop
      if (v_k + v_i) % 7 <> 0 then
        insert into public.attendance (academy_id, class_id, student_id, attended_on, checked_in_at, checked_out_at, checked_in_by, checked_out_by)
        values (v_academy, v_class1, v_ids1[v_k], v_day,
                ((v_day + time '15:00') at time zone 'Asia/Seoul') + make_interval(mins => (v_k * 2) % 10),
                ((v_day + time '17:00') at time zone 'Asia/Seoul') + make_interval(mins => (v_k * 3) % 20), v_uid, v_uid);
      end if;
      -- 숙제 완료(대부분) / 미제출(가끔)
      if (v_k * v_i) % 6 = 0 then
        v_delta := -2; v_reason := '미제출'; v_hw := true;
      else
        v_delta := 2; v_reason := '숙제 완료'; v_hw := true;
      end if;
      insert into public.transactions (academy_id, class_id, student_id, delta, reason, created_by, created_by_name, is_homework, created_at)
      values (v_academy, v_class1, v_ids1[v_k], v_delta, v_reason, v_uid, v_name, v_hw, ((v_day + time '16:30') at time zone 'Asia/Seoul') + make_interval(mins => v_k));
      if v_k % 3 = 0 then
        insert into public.transactions (academy_id, class_id, student_id, delta, reason, created_by, created_by_name, created_at)
        values (v_academy, v_class1, v_ids1[v_k], 3, '수업 태도 우수', v_uid, v_name, ((v_day + time '16:45') at time zone 'Asia/Seoul') + make_interval(mins => v_k));
      end if;
      if v_k % 4 = 1 then
        insert into public.transactions (academy_id, class_id, student_id, delta, reason, created_by, created_by_name, created_at)
        values (v_academy, v_class1, v_ids1[v_k], 2, '발표 참여', v_uid, v_name, ((v_day + time '16:50') at time zone 'Asia/Seoul') + make_interval(mins => v_k));
      end if;
    end loop;

    -- 반 B 출석·통장
    for v_k in 1..array_length(v_ids2, 1) loop
      if (v_k + v_i) % 5 <> 0 then
        insert into public.attendance (academy_id, class_id, student_id, attended_on, checked_in_at, checked_out_at, checked_in_by, checked_out_by)
        values (v_academy, v_class2, v_ids2[v_k], v_day,
                ((v_day + time '17:30') at time zone 'Asia/Seoul') + make_interval(mins => (v_k * 2) % 10),
                ((v_day + time '19:30') at time zone 'Asia/Seoul') + make_interval(mins => (v_k * 3) % 20), v_uid, v_uid);
      end if;
      insert into public.transactions (academy_id, class_id, student_id, delta, reason, created_by, created_by_name, is_homework, created_at)
      values (v_academy, v_class2, v_ids2[v_k], case when (v_k + v_i) % 5 = 0 then -2 else 2 end,
              case when (v_k + v_i) % 5 = 0 then '미제출' else '숙제 완료' end, v_uid, v_name, true,
              ((v_day + time '19:00') at time zone 'Asia/Seoul') + make_interval(mins => v_k));
    end loop;

    -- 그날 마감(확정) — 반 A 는 매일, 반 B 는 격일
    insert into public.settlements (academy_id, class_id, settled_on, settled_by, settled_by_name, total_delta, student_count)
    select v_academy, v_class1, v_day, v_uid, v_name, coalesce(sum(delta), 0), count(distinct student_id)
    from public.transactions where class_id = v_class1 and (created_at at time zone 'Asia/Seoul')::date = v_day
    on conflict (class_id, settled_on) do nothing;
    if v_i % 2 = 0 then
      insert into public.settlements (academy_id, class_id, settled_on, settled_by, settled_by_name, total_delta, student_count)
      select v_academy, v_class2, v_day, v_uid, v_name, coalesce(sum(delta), 0), count(distinct student_id)
      from public.transactions where class_id = v_class2 and (created_at at time zone 'Asia/Seoul')::date = v_day
      on conflict (class_id, settled_on) do nothing;
    end if;
  end loop;

  raise notice '완료: 반 2개, 학생 %명, 통장·출석 샘플 입력', array_length(v_ids1, 1) + array_length(v_ids2, 1);
end
$$;

-- 확인
select c.name as 반, count(distinct s.id) as 학생수, count(t.id) as 통장기록
from public.classes c
left join public.students s on s.class_id = c.id
left join public.transactions t on t.student_id = s.id
where c.academy_id = (select academy_id from public.profiles where id = (select id from auth.users where email = 'test@test.com'))
group by c.name order by c.name;
