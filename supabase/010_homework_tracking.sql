-- 010: 숙제 캘린더용 추적 플래그
--
-- 프리셋에 "숙제 관련" 여부를 표시해두면, 그 프리셋으로 지급/차감할 때마다
-- 거래 기록에도 같은 표시를 복사해 남긴다. 프리셋을 나중에 지우거나 표시를
-- 바꿔도 과거 캘린더 기록은 그대로 유지된다 (created_by_name 을 비정규화해
-- 남기는 것과 같은 이유).

alter table public.presets add column if not exists is_homework boolean not null default false;
alter table public.transactions add column if not exists is_homework boolean not null default false;

-- 이미 만들어져 있던 "숙제 완료"/"미제출" 계열 프리셋과, 그걸로 이미 지급된
-- 과거 거래 기록도 자동으로 표시해준다 (없으면 아무 일도 일어나지 않음).
update public.presets
set is_homework = true
where is_homework = false
  and (label ilike '%숙제%' or label ilike '%미제출%');

update public.transactions
set is_homework = true
where is_homework = false
  and (reason ilike '%숙제%' or reason ilike '%미제출%');
