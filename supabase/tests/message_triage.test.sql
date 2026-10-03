-- The Messages screen. Its leader picker comes from site.message_assignees(),
-- and how a message was triaged shows in Activity only to the Messages role,
-- the same people who can read the message.
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- The seed has its own leaders, so the picker checks below look only at these.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000007a01', 'editor@example.test', '{"full_name": "Site Editor"}'),
  ('00000000-0000-4000-8000-000000007a02', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-000000007a03', 'finance@example.test', '{"full_name": "Finance Person"}'),
  ('00000000-0000-4000-8000-000000007a04', 'messages@example.test', '{"full_name": "Messages Person"}'),
  ('00000000-0000-4000-8000-000000007a05', 'removed@example.test', '{"full_name": "Removed Messages"}'),
  ('00000000-0000-4000-8000-000000007a06', 'both@example.test', '{"full_name": "Both Roles"}');

update public.users set roles = '{site_editor}' where id = '00000000-0000-4000-8000-000000007a01';
update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-000000007a02';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-000000007a03';
update public.users set roles = '{site_messages}' where id = '00000000-0000-4000-8000-000000007a04';
update public.users set roles = '{site_messages}', is_active = false where id = '00000000-0000-4000-8000-000000007a05';
update public.users set roles = '{site_editor,site_messages}' where id = '00000000-0000-4000-8000-000000007a06';

select results_eq(
  $$ select r.rolname
     from (values ('anon'), ('authenticated'), ('service_role')) as r (rolname)
     where has_function_privilege(r.rolname, 'site.message_assignees()', 'execute') $$,
  $$ values ('authenticated') $$,
  'only signed-in people ask who a message can be assigned to'
);

-- A message to triage, and a heads-up's history beside it. Only these.
delete from public.activity_log;

set local role service_role;
select site.submit_message('serve', '{"name": "Sid Server", "email": "sid@example.test", "areas": ["media"]}',
  repeat('a', 64), 'production', null);
reset role;

insert into public.activity_log (actor_id, scope, action, entity_type, entity_id, entity_name)
values ('00000000-0000-4000-8000-000000007a01', 'site', 'post.created', 'post', gen_random_uuid()::text, 'Merch is in');

set local role authenticated;

-- The Messages role.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000007a04", "role": "authenticated"}', true);

select results_eq(
  $$ select full_name from site.message_assignees() where id::text like '00000000-0000-4000-8000-000000007a%' $$,
  $$ values ('Both Roles'), ('Messages Person'), ('Test Owner') $$,
  'the Messages role picks from active owners and leaders with Messages, by name'
);

select lives_ok(
  $$ select site.triage_message(
       (select id from site.messages where name = 'Sid Server'),
       '{"status": "in_progress", "assigned_to": "00000000-0000-4000-8000-000000007a06"}'
     ) $$,
  'they pick it up and hand it to a leader from the list'
);

select results_eq(
  $$ select entity_type from public.activity_log order by entity_type $$,
  $$ values ('message'), ('post') $$,
  'they see how messages were triaged, and the rest of the site''s history'
);

-- A site editor without Messages.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000007a01", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from site.message_assignees() $$,
  'a site editor without Messages gets nobody to assign to'
);

select results_eq(
  $$ select entity_type from public.activity_log $$,
  $$ values ('post') $$,
  'and sees heads-up history but no message''s'
);

-- Both roles.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000007a06", "role": "authenticated"}', true);

select is(
  (select count(*)::integer from public.activity_log), 2,
  'a site editor with Messages sees both'
);

-- An owner holds every role.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000007a02", "role": "authenticated"}', true);

select is(
  (select count(*)::integer from site.message_assignees() where id::text like '00000000-0000-4000-8000-000000007a%'), 3,
  'an owner can assign too'
);

select is(
  (select count(*)::integer from public.activity_log where entity_type = 'message'), 1,
  'and sees message history'
);

-- A finance viewer sees no site history at all, as before.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000007a03", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.activity_log where scope = 'site' $$,
  'a finance viewer sees no site history'
);

reset role;

select * from finish();
rollback;
