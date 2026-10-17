-- 085a 확인(읽기 전용): 버킷이 공개로 있고, 정책 4개가 있어야 한다.
select id, public from storage.buckets where id = 'brand';
select policyname, cmd from pg_policies
 where schemaname = 'storage' and tablename = 'objects' and policyname like 'brand_%'
 order by policyname;
