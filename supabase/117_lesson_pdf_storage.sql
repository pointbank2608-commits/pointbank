-- Same academy and teacher checks as the lesson image bucket, with private reads for documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-pdfs', 'lesson-pdfs', false, 26214400, array['application/pdf', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists lesson_pdfs_insert on storage.objects;
create policy lesson_pdfs_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'lesson-pdfs'
  and (storage.foldername(name))[1] = public.my_academy_id()::text
  and public.is_staff()
);

drop policy if exists lesson_pdfs_select on storage.objects;
create policy lesson_pdfs_select on storage.objects for select to authenticated
using (
  bucket_id = 'lesson-pdfs'
  and (storage.foldername(name))[1] = public.my_academy_id()::text
);

drop policy if exists lesson_pdfs_delete on storage.objects;
create policy lesson_pdfs_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'lesson-pdfs'
  and (storage.foldername(name))[1] = public.my_academy_id()::text
  and public.is_staff()
);
