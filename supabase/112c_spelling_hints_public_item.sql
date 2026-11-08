begin;
create or replace function public.hw_public_item(i public.homework_items) returns jsonb
language sql stable as $$
 select jsonb_build_object('id',i.id,'kind',i.kind,'title',i.title,
   'config',case when i.config ? 'block' then jsonb_set(i.config,'{block}',((i.config->'block') - 'source' - 'spellingHints') - case when i.config->'block'->>'completion' = 'answers' then 'text' else '__unused' end) else i.config end,
   'content',(i.content - 'questions') || jsonb_build_object('questions',coalesce((
     select jsonb_agg(case when q->'guidedSpelling'='true'::jsonb or q->'missingLetter'='true'::jsonb
       then (q - 'correct' - 'card' - 'speak' - 'contentId') || '{"word":""}'::jsonb
       else q - 'correct' - 'card' end order by ord)
     from jsonb_array_elements(coalesce(i.content->'questions','[]')) with ordinality t(q,ord)),'[]')))
$$;
revoke all on function public.hw_public_item(public.homework_items) from public,anon,authenticated;
commit;
