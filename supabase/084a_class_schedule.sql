-- 반마다 수업 요일·시간(오늘 화면의 "오늘 수업" 카드용). 비어 있어도(null) 앱은 그대로 동작한다.
-- 모양: {"days":[1,3],"time":"15:30","minutes":40}  (days: 0=일 ~ 6=토)
alter table public.classes add column if not exists schedule jsonb;
