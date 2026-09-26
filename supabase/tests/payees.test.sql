-- Payees: admin-only writes, no deletes, and links to users only through
-- link_payee() and unlink_payee().
begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

-- Fake people. New auth users get a member row from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'member@example.test', '{"full_name": "Test Member"}'),
  ('00000000-0000-4000-8000-00000000a004', 'member2@example.test', '{"full_name": "Second Member"}');

update public.users set role = 'admin' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a002';

insert into public.payees (id, full_name, email) values
  ('00000000-0000-4000-8000-00000000b001', 'Test Payee', 'payee@example.test'),
  ('00000000-0000-4000-8000-00000000b002', 'Other Payee', null);

-- Grants.
select ok(not has_table_privilege('anon', 'public.payees', 'select'), 'anon can''t read payees');
select ok(
  not has_function_privilege('anon', 'public.link_payee(uuid, uuid)', 'execute'),
  'anon can''t call link_payee'
);
select ok(
  not has_function_privilege('anon', 'public.unlink_payee(uuid)', 'execute'),
  'anon can''t call unlink_payee'
);
select ok(
  not has_function_privilege('anon', 'public.current_payee_id()', 'execute'),
  'anon can''t call current_payee_id'
);
select ok(
  not has_table_privilege('authenticated', 'public.payees', 'delete'),
  'nobody can delete payees'
);
select ok(
  not has_column_privilege('authenticated', 'public.payees', 'user_id', 'update'),
  'the link can''t be changed with a direct update'
);

set local role authenticated;

-- As a member.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.payees where email like '%@example.test' or full_name like '% Payee' $$,
  'a member can''t read payees'
);

select throws_ok(
  $$ insert into public.payees (full_name) values ('Member Made') $$,
  '42501',
  null,
  'a member can''t add payees'
);

with changed as (
  update public.payees set notes = 'Member edit' where id = '00000000-0000-4000-8000-00000000b001' returning 1
)
select is(count(*)::int, 0, 'a member can''t edit payees') from changed;

select throws_ok(
  $$ select public.link_payee('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a003') $$,
  '42501',
  'Only an admin can link payees.',
  'a member can''t link themselves to a payee'
);

select is(public.current_payee_id(), null, 'an unlinked member has no payee');

-- As the viewer.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.payees where id in (
    '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000b002'
  )),
  2,
  'a viewer reads payees'
);

select throws_ok(
  $$ insert into public.payees (full_name) values ('Viewer Made') $$,
  '42501',
  null,
  'a viewer can''t add payees'
);

with changed as (
  update public.payees set notes = 'Viewer edit' where id = '00000000-0000-4000-8000-00000000b001' returning 1
)
select is(count(*)::int, 0, 'a viewer can''t edit payees') from changed;

select throws_ok(
  $$ select public.unlink_payee('00000000-0000-4000-8000-00000000b001') $$,
  '42501',
  'Only an admin can unlink payees.',
  'a viewer can''t unlink payees'
);

-- As the admin.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.payees (full_name, email, notes) values ('New Payee', 'new@example.test', 'Added in a test') $$,
  'an admin can add a payee'
);

with changed as (
  update public.payees set full_name = 'Renamed Payee', is_active = false
  where id = '00000000-0000-4000-8000-00000000b002'
  returning 1
)
select is(count(*)::int, 1, 'an admin can rename and deactivate a payee') from changed;

select throws_ok(
  $$ update public.payees set user_id = '00000000-0000-4000-8000-00000000a003'
     where id = '00000000-0000-4000-8000-00000000b001' $$,
  '42501',
  null,
  'an admin can''t link with a direct update'
);

select throws_ok(
  $$ insert into public.payees (full_name, user_id, linked_at)
     values ('Pre-linked', '00000000-0000-4000-8000-00000000a003', now()) $$,
  '42501',
  null,
  'an admin can''t link with a direct insert'
);

select throws_ok(
  $$ delete from public.payees where id = '00000000-0000-4000-8000-00000000b002' $$,
  '42501',
  null,
  'an admin can''t delete a payee'
);

select throws_ok(
  $$ insert into public.payees (full_name, email) values ('Same Email', 'PAYEE@example.test') $$,
  '23505',
  null,
  'payee emails are unique regardless of case'
);

select throws_ok(
  $$ insert into public.payees (full_name) values ('   ') $$,
  '23514',
  null,
  'a payee needs a name'
);

select throws_ok(
  $$ insert into public.payees (full_name, email) values ('Bad Email', 'not-an-email') $$,
  '23514',
  null,
  'a payee email needs an @'
);

select throws_ok(
  $$ select public.link_payee('00000000-0000-4000-8000-0000000fffff', '00000000-0000-4000-8000-00000000a003') $$,
  'P0002',
  'That payee doesn''t exist.',
  'link_payee needs a real payee'
);

select throws_ok(
  $$ select public.link_payee('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-0000000fffff') $$,
  'P0002',
  'That user doesn''t exist.',
  'link_payee needs a real user'
);

select lives_ok(
  $$ select public.link_payee('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a003') $$,
  'an admin can link a payee to a user'
);

select lives_ok(
  $$ select public.link_payee('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a003') $$,
  'linking the same pair again does nothing'
);

select throws_ok(
  $$ select public.link_payee('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a004') $$,
  '55000',
  'This payee is already linked to another user. Unlink it first.',
  'a linked payee can''t be linked to someone else'
);

select throws_ok(
  $$ select public.link_payee('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000a003') $$,
  '23505',
  'That user is already linked to another payee.',
  'a user can be linked to only one payee'
);

select results_eq(
  $$ select user_id, linked_by, linked_at is not null from public.payees
     where id = '00000000-0000-4000-8000-00000000b001' $$,
  $$ values (
       '00000000-0000-4000-8000-00000000a003'::uuid,
       '00000000-0000-4000-8000-00000000a001'::uuid,
       true
     ) $$,
  'the link records who linked it and when'
);

-- As the linked member.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is(
  public.current_payee_id(),
  '00000000-0000-4000-8000-00000000b001'::uuid,
  'current_payee_id finds the linked payee'
);

-- As the admin again.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.unlink_payee('00000000-0000-4000-8000-00000000b001') $$,
  'an admin can unlink a payee'
);

select results_eq(
  $$ select user_id, linked_by, linked_at from public.payees
     where id = '00000000-0000-4000-8000-00000000b001' $$,
  $$ values (null::uuid, null::uuid, null::timestamptz) $$,
  'unlinking clears the link columns'
);

select throws_ok(
  $$ select public.unlink_payee('00000000-0000-4000-8000-0000000fffff') $$,
  'P0002',
  'That payee doesn''t exist.',
  'unlink_payee needs a real payee'
);

reset role;

select throws_ok(
  $$ update public.payees set user_id = '00000000-0000-4000-8000-00000000a004'
     where id = '00000000-0000-4000-8000-00000000b002' $$,
  '23514',
  null,
  'a link always has a linked_at'
);

select * from finish();
rollback;
