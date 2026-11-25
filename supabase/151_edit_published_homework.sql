begin;
set local lock_timeout = '5s';

-- Read the issued content, including answers, only after checking teacher and class access.
create function public.hw_publication(p_assignment uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare h public.homework_assignments; doc jsonb;
begin
  select * into h from public.homework_assignments where id=p_assignment;
  if not found or public.hw_block_academy(h.class_id) is distinct from h.academy_id then raise exception 'not_found'; end if;
  select jsonb_build_object('title',h.title,'due',h.due_at,'closed',h.closed_at,'classId',h.class_id,
    'shortRepeat',h.settings->'shortRepeat',
    'items',coalesce((select jsonb_agg(jsonb_build_object('kind',i.kind,'title',i.title,'config',i.config,'content',i.content)
      order by i.position) from public.homework_items i where i.assignment_id=h.id),'[]'),
    'students',coalesce((select jsonb_agg(t.student_id order by t.student_id) from public.homework_assignment_targets t
      where t.assignment_id=h.id),'[]')) into doc;
  return doc||jsonb_build_object('version',md5(doc::text),'started',exists(select from public.homework_attempts where assignment_id=h.id));
end $$;

create function public.hw_revise_publication(p_assignment uuid,p_version text,p_title text,p_due timestamptz,p_items jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare h public.homework_assignments; doc jsonb; content_changed boolean;
begin
  select * into h from public.homework_assignments where id=p_assignment and academy_id=public.hw_staff_academy() for update;
  if not found then raise exception 'not_found'; end if;
  doc:=public.hw_publication(h.id);
  content_changed:=(doc->'items') is distinct from p_items;
  if not content_changed and p_title=h.title and p_due is not distinct from h.due_at then return; end if;
  if doc->>'version' is distinct from p_version then raise exception 'publication_changed'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'missing_title'; end if;
  if content_changed then
    -- The FK on a new attempt takes a key-share lock on this same assignment.
    if (doc->>'started')::boolean then raise exception 'publication_started'; end if;
    perform public.hw_validate_items(p_items);
    if h.settings ? 'shortRepeat' and not exists(select from jsonb_array_elements(p_items) i where
      i#>>'{config,block,type}'='recall' and jsonb_array_length(i#>'{content,questions}')>0) then raise exception 'no_graded_questions'; end if;
    delete from public.homework_items where assignment_id=h.id;
    insert into public.homework_items(assignment_id,position,kind,title,config,content)
      select h.id,ord-1,i->>'kind',coalesce(i->>'title',''),i->'config',i->'content'
      from jsonb_array_elements(p_items) with ordinality as items(i,ord);
  end if;
  if p_due is distinct from h.due_at then
    update public.homework_assignment_targets set token_expires_at=coalesce(p_due,now()+interval '30 days')+interval '7 days'
      where assignment_id=h.id;
  end if;
  update public.homework_assignments set title=p_title,due_at=p_due where id=h.id;
end $$;

revoke all on function public.hw_publication(uuid),public.hw_revise_publication(uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.hw_publication(uuid),public.hw_revise_publication(uuid,text,text,timestamptz,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
