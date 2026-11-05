import {buildFixture} from './learning-fixture.mjs';

export async function buildAdaptiveFixture(db){
 const f=await buildFixture(db);
 f.otherToken='50000000-0000-4000-8000-000000000002';
 await f.db.exec(`
 create schema auth;
 create function auth.uid() returns uuid language sql as $$select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid$$;
 alter table solo_assignments add column kind text not null default 'lesson', add column due_at timestamptz;
 create table word_lists(id uuid primary key,academy_id uuid,class_id uuid);
 insert into word_lists values('${f.WL}','${f.A}',null);
 create function student_session_student(p_token uuid) returns uuid language plpgsql stable as $$begin
  if p_token='${f.TK}' then return '${f.ST}';elsif p_token='${f.otherToken}' then return '${f.OTHER}';else raise exception 'expired';end if;
 end$$;
 create or replace function student_home(p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
 declare sid uuid:=student_session_student(p_token);ac uuid; begin select academy_id into ac from students where id=sid;
 return jsonb_build_object('name','샘플 학생','academy','샘플 학원','class_name','샘플 반','homework','[]'::jsonb,'features',jsonb_build_object('solo',academy_feature(ac,'solo'),'homework',academy_feature(ac,'homework')),
 'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',l.name,'kind',a.kind,'minutes',l.minutes,'progress',a.progress,'total',jsonb_array_length(l.steps),'done',a.finished_at is not null,'due_at',a.due_at)) from solo_assignments a join solo_lessons l on l.id=a.lesson_id where a.student_id=sid and a.id<>'${f.SA}'),'[]'));
 end$$;
 `);
 await f.db.exec(f.extract('074c_feature_guards.sql','solo_assignment_for'));
 await f.db.exec(f.read('099_learning_paths.sql'));
 await f.db.exec(f.read('100_learning_research.sql'));
 await f.db.exec(f.read('101_adaptive_homework.sql'));
 return f;
}
