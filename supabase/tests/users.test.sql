-- Users, roles, and app settings: the signup trigger, who can read and edit
-- which rows, and the admin-only role and activation RPCs.
begin;

create extension if not exists pgtap with schema extensions;

select plan(39);

-- Fake people. New auth users get a member row from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'member@example.test', '{"full_name": "Test Member"}'),
  ('00000000-0000-4000-8000-00000000a004', 'other.admin@example.test', '{"full_name": "  "}'),
  ('00000000-0000-4000-8000-00000000a005', 'former@example.test', '{"full_name": "Former Admin"}');

-- No signed-in user yet, so the trigger's authenticated-only checks don't apply.
select results_eq(
  $$ select full_name, email, role::text, is_active from public.users
     where id = '00000000-0000-4000-8000-00000000a003' $$,
  $$ values ('Test Member', 'member@example.test', 'member', true) $$,
  'a new auth user gets an active member row with their name'
);

select is(
  (select full_name from public.users where id = '00000000-0000-4000-8000-00000000a004'),
  'other.admin',
  'a blank name falls back to the start of the email'
);

update public.users set role = 'admin' where id in (
  '00000000-0000-4000-8000-00000000a001',
  '00000000-0000-4000-8000-00000000a004',
  '00000000-0000-4000-8000-00000000a005'
);
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a005';

-- Nothing is open to anon.
select ok(not has_table_privilege('anon', 'public.users', 'select'), 'anon can''t read users');
select ok(not has_table_privilege('anon', 'public.app_settings', 'select'), 'anon can''t read settings');
select ok(
  not has_function_privilege('anon', 'public.current_app_role()', 'execute'),
  'anon can''t call current_app_role'
);
select ok(
  not has_function_privilege('anon', 'public.set_member_role(uuid, public.user_role)', 'execute'),
  'anon can''t call set_member_role'
);
select ok(
  not has_function_privilege('anon', 'public.set_member_active(uuid, boolean)', 'execute'),
  'anon can''t call set_member_active'
);
select ok(
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'signed-in users can''t call the signup trigger function'
);

set local role authenticated;

-- As the member.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is(public.current_app_role()::text, 'member', 'current_app_role reads the role from public.users');

select results_eq(
  $$ select id from public.users where email like '%@example.test' $$,
  $$ values ('00000000-0000-4000-8000-00000000a003'::uuid) $$,
  'a member reads only their own row'
);

select is_empty($$ select 1 from public.app_settings $$, 'a member can''t read settings');

with changed as (
  update public.users set full_name = 'Renamed Member'
  where id = '00000000-0000-4000-8000-00000000a003'
  returning 1
)
select is(count(*)::int, 1, 'a member can change their own name') from changed;

with changed as (
  update public.users set full_name = 'Hijacked'
  where id = '00000000-0000-4000-8000-00000000a001'
  returning 1
)
select is(count(*)::int, 0, 'a member can''t rename someone else') from changed;

select throws_ok(
  $$ update public.users set role = 'admin' where id = '00000000-0000-4000-8000-00000000a003' $$,
  '42501',
  null,
  'a member can''t change their own role'
);

select throws_ok(
  $$ update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a003' $$,
  '42501',
  null,
  'a member can''t change their own active flag'
);

select throws_ok(
  $$ insert into public.users (id, full_name, email) values (gen_random_uuid(), 'Sneaky', 'sneaky@example.test') $$,
  '42501',
  null,
  'nobody can insert user rows directly'
);

select throws_ok(
  $$ select public.set_member_role('00000000-0000-4000-8000-00000000a003', 'admin') $$,
  '42501',
  'Only an admin can change roles.',
  'a member can''t promote themselves'
);

-- user_metadata is editable by the user, so a role in it must mean nothing.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated", "user_metadata": {"role": "admin"}}',
  true
);

select is(public.current_app_role()::text, 'member', 'a role in user_metadata is ignored');

-- As the viewer.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.users where email like '%@example.test' and id::text like '00000000-0000-4000-8000-00000000a00%'),
  5,
  'a viewer reads every user'
);

select is(
  (select allow_external_approval from public.app_settings where id = 1),
  true,
  'a viewer reads settings'
);

with changed as (
  update public.app_settings set allow_external_approval = false where id = 1 returning 1
)
select is(count(*)::int, 0, 'a viewer can''t change settings') from changed;

select throws_ok(
  $$ select public.set_member_active('00000000-0000-4000-8000-00000000a003', false) $$,
  '42501',
  'Only an admin can activate or deactivate users.',
  'a viewer can''t deactivate users'
);

-- As the deactivated admin.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated", "aal": "aal2"}',
  true
);

select is(public.current_app_role(), null, 'a deactivated user has no role');

select results_eq(
  $$ select id from public.users where email like '%@example.test' $$,
  $$ values ('00000000-0000-4000-8000-00000000a005'::uuid) $$,
  'a deactivated admin reads only their own row'
);

select is_empty($$ select 1 from public.app_settings $$, 'a deactivated admin can''t read settings');

with changed as (
  update public.users set full_name = 'Still Here'
  where id = '00000000-0000-4000-8000-00000000a005'
  returning 1
)
select is(count(*)::int, 0, 'a deactivated user can''t change their name') from changed;

select throws_ok(
  $$ select public.set_member_role('00000000-0000-4000-8000-00000000a003', 'admin') $$,
  '42501',
  'Only an admin can change roles.',
  'a deactivated admin can''t change roles'
);

-- As the admin.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select throws_ok(
  $$ select public.set_member_role('00000000-0000-4000-8000-00000000a001', 'member') $$,
  '42501',
  'You can''t change your own role.',
  'an admin can''t demote themselves'
);

select throws_ok(
  $$ select public.set_member_active('00000000-0000-4000-8000-00000000a001', false) $$,
  '42501',
  'You can''t deactivate yourself.',
  'an admin can''t deactivate themselves'
);

select throws_ok(
  $$ select public.set_member_role('00000000-0000-4000-8000-00000000a003', null) $$,
  '22023',
  'Choose a role.',
  'a role is required'
);

select throws_ok(
  $$ select public.set_member_role('00000000-0000-4000-8000-0000000fffff', 'viewer') $$,
  'P0002',
  'That user doesn''t exist.',
  'set_member_role needs a real user'
);

select lives_ok(
  $$ select public.set_member_role('00000000-0000-4000-8000-00000000a003', 'viewer') $$,
  'an admin can change another user''s role'
);

select throws_ok(
  $$ select public.set_member_active('00000000-0000-4000-8000-00000000a003', null) $$,
  '22023',
  'Choose active or inactive.',
  'set_member_active needs a value'
);

select lives_ok(
  $$ select public.set_member_active('00000000-0000-4000-8000-00000000a005', true) $$,
  'an admin can reactivate a user'
);

with changed as (
  update public.app_settings set allow_external_approval = false, late_submission_days = 30 where id = 1 returning 1
)
select is(count(*)::int, 1, 'an admin can change settings') from changed;

select throws_ok(
  $$ update public.app_settings set late_submission_days = 0 where id = 1 $$,
  '23514',
  null,
  'late_submission_days must be at least 1'
);

select throws_ok(
  $$ insert into public.app_settings (id) values (2) $$,
  '42501',
  null,
  'nobody can add a second settings row'
);

reset role;

select results_eq(
  $$ select role::text, is_active from public.users
     where id in ('00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-00000000a005')
     order by id $$,
  $$ values ('viewer', true), ('admin', true) $$,
  'the RPCs saved the role and active changes'
);

select is(
  (select full_name from public.users where id = '00000000-0000-4000-8000-00000000a001'),
  'Test Admin',
  'the member''s rename attempt on the admin changed nothing'
);

select * from finish();
rollback;
