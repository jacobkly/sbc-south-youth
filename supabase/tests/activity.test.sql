-- The shared activity log: only triggers and log_event() write it, people
-- read it by scope, and activity_feed adds the finance history under its own
-- rules.
begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

-- Fake people, one per role, plus a site editor whose access was removed.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'editor@example.test', '{"full_name": "Test Editor"}'),
  ('00000000-0000-4000-8000-00000000a004', 'requester@example.test', '{"full_name": "Test Requester"}'),
  ('00000000-0000-4000-8000-00000000a005', 'messages@example.test', '{"full_name": "Test Messages"}'),
  ('00000000-0000-4000-8000-00000000a006', 'removed@example.test', '{"full_name": "Test Removed"}'),
  ('00000000-0000-4000-8000-00000000a007', 'other@example.test', '{"full_name": "Test Other"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set roles = '{site_editor}' where id = '00000000-0000-4000-8000-00000000a003';
update public.users set roles = '{finance_requester}' where id = '00000000-0000-4000-8000-00000000a004';
update public.users set roles = '{site_messages}' where id = '00000000-0000-4000-8000-00000000a005';
update public.users set roles = '{site_editor}', is_active = false where id = '00000000-0000-4000-8000-00000000a006';

-- Who can write.
select is_empty(
  $$ select r.role, p.privilege
     from unnest(array['anon', 'authenticated', 'service_role']) as r (role)
     cross join unnest(array['insert', 'update', 'delete', 'truncate']) as p (privilege)
     where has_table_privilege(r.role, 'public.activity_log', p.privilege) $$,
  'no client role, not even service_role, can write activity_log'
);

select is_empty(
  $$ select r.role, p.privilege
     from unnest(array['anon', 'authenticated', 'service_role']) as r (role)
     cross join unnest(array['insert', 'update', 'delete', 'truncate']) as p (privilege)
     where has_table_privilege(r.role, 'public.activity_feed', p.privilege) $$,
  'no client role can write through activity_feed'
);

select ok(
  not has_function_privilege('authenticated', 'public.log_activity()', 'execute'),
  'signed-in users can''t call the activity trigger function'
);

select ok(
  not has_function_privilege('anon', 'public.log_event(text, text, text)', 'execute'),
  'anon can''t call log_event'
);

set local role service_role;

select throws_ok(
  $$ insert into public.activity_log (scope, action, entity_type) values ('platform', 'user.updated', 'user') $$,
  '42501',
  null,
  'service_role can''t insert into activity_log'
);

select throws_ok(
  $$ delete from public.activity_log $$,
  '42501',
  null,
  'service_role can''t delete from activity_log'
);

reset role;

-- The users trigger: role and access changes, named by who made them.
select results_eq(
  $$ select scope, action, entity_type, entity_name, changes -> 'roles'
     from public.activity_log
     where entity_id = '00000000-0000-4000-8000-00000000a003' and action = 'user.updated' $$,
  $$ values ('platform', 'user.updated', 'user', 'Test Editor', '{"from": [], "to": ["site_editor"]}'::jsonb) $$,
  'a role change is logged on the platform with the person''s name and the old and new roles'
);

-- A write with no signed-in user, as from a server action using the secret key.
update public.users
set roles = '{site_editor,site_messages}', updated_by = '00000000-0000-4000-8000-00000000a001'
where id = '00000000-0000-4000-8000-00000000a003';

select is(
  (select actor_id from public.activity_log
   where entity_id = '00000000-0000-4000-8000-00000000a003'
     and changes -> 'roles' -> 'to' = '["site_editor", "site_messages"]'),
  '00000000-0000-4000-8000-00000000a001'::uuid,
  'with no signed-in user, the trigger names the updated_by person as the actor'
);

-- The next write leaves updated_by alone, so it says nothing about who made it.
update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a003';

select results_eq(
  $$ select actor_id, changes from public.activity_log
     where entity_id = '00000000-0000-4000-8000-00000000a003' and changes ? 'is_active' and not changes ? 'roles' $$,
  $$ values (null::uuid, '{"is_active": {"from": true, "to": false}}'::jsonb) $$,
  'removing access is logged, and a stale updated_by isn''t taken as the actor'
);

update public.users set is_active = true where id = '00000000-0000-4000-8000-00000000a003';

select is(
  (select count(*)::int from public.activity_log where entity_id = '00000000-0000-4000-8000-00000000a003'),
  5,
  'creating the account and each role or access change log one row each'
);

update public.users set full_name = 'Renamed Editor', theme = 'light', last_seen_at = now()
where id = '00000000-0000-4000-8000-00000000a003';

select is(
  (select count(*)::int from public.activity_log where entity_id = '00000000-0000-4000-8000-00000000a003'),
  5,
  'name, theme and last-seen changes aren''t logged'
);

-- Older code that changes only the single role is still logged.
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a004';

select is(
  (select count(*)::int from public.activity_log
   where entity_id = '00000000-0000-4000-8000-00000000a004'
     and changes = '{"roles": {"from": ["finance_requester"], "to": ["finance_viewer", "finance_requester"]}}'),
  1,
  'a change made through the older role column is logged as a roles change'
);

update public.users set role = 'member' where id = '00000000-0000-4000-8000-00000000a004';

-- A site row and a finance request, so every scope has something to read.
insert into public.activity_log (scope, action, entity_type, entity_id, entity_name)
values ('site', 'post.created', 'post', '00000000-0000-4000-8000-0000000000e1', 'Test heads-up');

insert into public.payees (id, full_name)
values ('00000000-0000-4000-8000-00000000b001', 'Test Payee');

insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description, status, submitted_at
) values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001',
   '00000000-0000-4000-8000-00000000a001', 'youth', 1000, '2026-01-10', 'Fake Store', 'Submitted', 'submitted', now()),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000b001',
   '00000000-0000-4000-8000-00000000a001', 'cafe', 2000, '2026-01-11', 'Fake Store', 'Draft', 'draft', null);

select results_eq(
  $$ select scope, action, entity_type, from_status, to_status::text from public.activity_feed
     where entity_id = '00000000-0000-4000-8000-00000000c001' $$,
  $$ values ('finances', 'request.created', 'request', null::public.request_status, 'submitted') $$,
  'activity_feed shows the finance history as request rows in the finances scope'
);

set local role authenticated;

-- As the owner.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select set_eq(
  $$ select distinct scope from public.activity_feed $$,
  array['site', 'finances', 'platform'],
  'an owner reads every scope'
);

select throws_ok(
  $$ insert into public.activity_log (scope, action, entity_type) values ('platform', 'user.updated', 'user') $$,
  '42501',
  null,
  'an owner can''t write activity_log directly'
);

select throws_ok(
  $$ update public.activity_log set entity_name = 'Changed' $$,
  '42501',
  null,
  'an owner can''t change activity_log'
);

select lives_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a007', '{site_editor}') $$,
  'an owner changes someone''s roles'
);

select is(
  (select actor_id from public.activity_log
   where entity_id = '00000000-0000-4000-8000-00000000a007' and changes ? 'roles' and not changes ? 'is_active'),
  '00000000-0000-4000-8000-00000000a001'::uuid,
  'a signed-in change names the signed-in person'
);

-- As the finance viewer.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select set_eq(
  $$ select distinct scope from public.activity_feed $$,
  array['finances'],
  'a finance viewer reads finance rows and no site or platform rows'
);

select is_empty(
  $$ select 1 from public.activity_feed where entity_id = '00000000-0000-4000-8000-00000000c002' $$,
  'a finance viewer reads nothing about a draft'
);

select lives_ok(
  $$ select public.log_event('export.downloaded', null, 'Test export.csv') $$,
  'a finance viewer logs an export'
);

select results_eq(
  $$ select scope, action, entity_type, entity_name, actor_id from public.activity_feed
     where action = 'export.downloaded' $$,
  $$ values ('finances', 'export.downloaded', 'export', 'Test export.csv',
             '00000000-0000-4000-8000-00000000a002'::uuid) $$,
  'log_event writes the row in its action''s scope, named by the caller'
);

select throws_ok(
  $$ select public.log_event('activity.exported') $$,
  '42501',
  'You can''t log that.',
  'a finance viewer can''t log an owner-only action'
);

select throws_ok(
  $$ select public.log_event('user.updated') $$,
  '22023',
  'The activity log doesn''t take that action.',
  'log_event only takes actions on its list'
);

-- As the site editor.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select set_eq(
  $$ select distinct scope from public.activity_feed $$,
  array['site'],
  'a site editor reads site rows only'
);

select is_empty(
  $$ select 1 from public.activity_feed where scope = 'finances' $$,
  'a site editor reads 0 finance rows'
);

select throws_ok(
  $$ select public.log_event('export.downloaded') $$,
  '42501',
  'You can''t log that.',
  'a site editor can''t log a finance export'
);

-- As the messages handler.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated"}', true);

select set_eq(
  $$ select distinct scope from public.activity_feed $$,
  array['site'],
  'a messages handler reads site rows only'
);

-- As the requester and the removed site editor.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated"}', true);

select is_empty($$ select 1 from public.activity_feed $$, 'a requester reads no activity');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a006", "role": "authenticated"}', true);

select is_empty($$ select 1 from public.activity_feed $$, 'a removed site editor reads no activity');

reset role;

select * from finish();
rollback;
