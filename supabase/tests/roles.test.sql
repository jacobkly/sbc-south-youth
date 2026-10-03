-- Stacked roles: has_role(), the owner-only set_roles() RPC, the last-owner
-- guard, and the older role column and current_app_role() kept in step.
begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

-- Fake people. New auth users get a row with no roles from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'stacked@example.test', '{"full_name": "Test Stacked"}'),
  ('00000000-0000-4000-8000-00000000a003', 'editor@example.test', '{"full_name": "Test Editor"}'),
  ('00000000-0000-4000-8000-00000000a004', 'nobody@example.test', '{"full_name": "Test Nobody"}'),
  ('00000000-0000-4000-8000-00000000a005', 'removed@example.test', '{"full_name": "Test Removed"}');

select is(
  (select roles from public.users where id = '00000000-0000-4000-8000-00000000a004'),
  '{}'::public.app_role[],
  'a new person starts with no roles'
);

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
-- Seed data may hold owners. Leave only the test owner so the guard can fire.
update public.users set roles = '{}'
where id <> '00000000-0000-4000-8000-00000000a001' and 'owner' = any (roles);
update public.users set roles = '{finance_requester,finance_viewer,finance_viewer}'
where id = '00000000-0000-4000-8000-00000000a002';
update public.users set roles = '{site_editor}' where id = '00000000-0000-4000-8000-00000000a003';
update public.users set roles = '{site_editor}', is_active = false
where id = '00000000-0000-4000-8000-00000000a005';

-- The older role column follows roles.
select results_eq(
  $$ select roles::text, role::text from public.users
     where id in ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a002',
                  '00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-00000000a004')
     order by id $$,
  $$ values ('{owner}', 'admin'), ('{finance_viewer,finance_requester}', 'viewer'),
            ('{site_editor}', 'member'), ('{}', 'member') $$,
  'role follows roles, and roles come back sorted without duplicates'
);

-- Older code that sets role swaps only the finance part of roles.
update public.users set role = 'admin' where id = '00000000-0000-4000-8000-00000000a003';

select is(
  (select roles from public.users where id = '00000000-0000-4000-8000-00000000a003'),
  '{owner,site_editor}'::public.app_role[],
  'setting role to admin adds owner and keeps the site role'
);

update public.users set role = 'member' where id = '00000000-0000-4000-8000-00000000a003';

select is(
  (select roles from public.users where id = '00000000-0000-4000-8000-00000000a003'),
  '{site_editor}'::public.app_role[],
  'setting role back to member takes owner away again'
);

-- Nothing is open to anon.
select ok(
  not has_function_privilege('anon', 'public.has_role(public.app_role[])', 'execute'),
  'anon can''t call has_role'
);
select ok(
  not has_function_privilege('anon', 'public.set_roles(uuid, public.app_role[])', 'execute'),
  'anon can''t call set_roles'
);
select ok(
  not has_function_privilege('authenticated', 'public.sync_user_roles()', 'execute'),
  'signed-in users can''t call the sync trigger function'
);
select ok(
  not has_function_privilege('authenticated', 'public.keep_an_owner()', 'execute'),
  'signed-in users can''t call the owner guard function'
);

set local role authenticated;

-- With no signed-in user.
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select is(public.has_role('owner'), false, 'no signed-in user holds no role');

-- As the person with stacked finance roles.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select ok(public.has_role('finance_viewer'), 'a viewer and requester holds finance_viewer');
select ok(public.has_role('finance_requester'), 'a viewer and requester holds finance_requester');
select ok(not public.has_role('site_editor'), 'a viewer and requester isn''t a site editor');
select ok(not public.has_role('owner'), 'a viewer and requester isn''t an owner');
select ok(public.has_role('site_editor', 'finance_viewer'), 'has_role is true when any listed role matches');
select is(public.current_app_role()::text, 'viewer', 'a viewer and requester is a viewer to the older rules');

select throws_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a002', '{owner}') $$,
  '42501',
  'Only an owner can change roles.',
  'a non-owner can''t give themselves owner'
);

select throws_ok(
  $$ update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a002' $$,
  '42501',
  null,
  'nobody can update roles directly'
);

-- A role in user_metadata is editable by the user, so it must mean nothing.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated", "user_metadata": {"roles": ["owner"]}}',
  true
);

select ok(not public.has_role('owner'), 'roles in user_metadata are ignored');
select is(public.current_app_role()::text, 'member', 'an active person with no roles is a member to the older rules');

-- As the site editor.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated", "aal": "aal2"}',
  true
);

select ok(public.has_role('site_editor'), 'a site editor holds site_editor');
select ok(not public.has_role('finance_viewer'), 'a site editor holds no finance role');
select is(public.current_app_role()::text, 'member', 'a site editor is only a member to the older finance rules');

with changed as (
  update public.users set full_name = 'Renamed Editor'
  where id = '00000000-0000-4000-8000-00000000a003'
  returning 1
)
select is(count(*)::int, 1, 'a site editor can still change their own name') from changed;

-- As the removed person, whose sign-in is still valid.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated"}', true);

select ok(not public.has_role('site_editor'), 'a removed person keeps their roles but holds none of them');
select is(public.current_app_role(), null, 'a removed person has no role for the older rules');

-- As the owner.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select ok(public.has_role('finance_requester'), 'an owner counts as a requester');
select ok(public.has_role('site_messages'), 'an owner counts as a messages handler');
select is(public.current_app_role()::text, 'admin', 'an owner is an admin to the older rules');

select throws_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a004', null) $$,
  '22023',
  'Choose the roles.',
  'set_roles needs a list'
);

select throws_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-0000000fffff', '{site_editor}') $$,
  'P0002',
  'That person doesn''t exist.',
  'set_roles needs a real person'
);

select throws_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a001', '{site_editor}') $$,
  '42501',
  'There has to be at least one active owner.',
  'the last owner can''t give up owner'
);

select lives_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a004', '{owner,site_messages}') $$,
  'an owner can make someone else an owner'
);

select lives_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a001', '{site_editor}') $$,
  'with a second owner, the first can step down'
);

reset role;

select results_eq(
  $$ select roles::text, role::text, updated_by from public.users
     where id in ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a004')
     order by id $$,
  $$ values ('{site_editor}', 'member', '00000000-0000-4000-8000-00000000a001'::uuid),
            ('{owner,site_messages}', 'admin', '00000000-0000-4000-8000-00000000a001'::uuid) $$,
  'set_roles saved the roles, the older role, and who changed them'
);

-- The guard also covers removing access and older code.
select throws_ok(
  $$ update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a004' $$,
  '42501',
  'There has to be at least one active owner.',
  'the last owner can''t be deactivated'
);

select throws_ok(
  $$ update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a004' $$,
  '42501',
  'There has to be at least one active owner.',
  'older code can''t demote the last owner either'
);

select * from finish();
rollback;
