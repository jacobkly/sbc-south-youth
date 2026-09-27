-- The theme each user saves on their own row.
begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- Fake people. New auth users get a member row from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a003', 'member@example.test', '{"full_name": "Test Member"}'),
  ('00000000-0000-4000-8000-00000000a004', 'other@example.test', '{"full_name": "Other Member"}'),
  ('00000000-0000-4000-8000-00000000a005', 'former@example.test', '{"full_name": "Former Admin"}');

update public.users set role = 'admin' where id in (
  '00000000-0000-4000-8000-00000000a001',
  '00000000-0000-4000-8000-00000000a005'
);
update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a005';

select ok(
  not has_column_privilege('anon', 'public.users', 'theme', 'update'),
  'anon can''t set a theme'
);

select is(
  (select theme from public.users where id = '00000000-0000-4000-8000-00000000a003'),
  null,
  'a new user has no theme until they pick one'
);

-- As the member.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

with changed as (
  update public.users set theme = 'grey'
  where id = '00000000-0000-4000-8000-00000000a003'
  returning 1
)
select is(count(*)::int, 1, 'a user can set their own theme') from changed;

select is(
  (select theme from public.users where id = '00000000-0000-4000-8000-00000000a003'),
  'grey',
  'the theme is saved on their row'
);

select throws_ok(
  $$ update public.users set theme = 'blue' where id = '00000000-0000-4000-8000-00000000a003' $$,
  '23514',
  null,
  'a theme has to be light, grey, dark, or system'
);

with changed as (
  update public.users set theme = 'dark'
  where id = '00000000-0000-4000-8000-00000000a004'
  returning 1
)
select is(count(*)::int, 0, 'a user can''t set someone else''s theme') from changed;

-- As the admin.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

with changed as (
  update public.users set theme = 'dark'
  where id = '00000000-0000-4000-8000-00000000a004'
  returning 1
)
select is(count(*)::int, 0, 'an admin can''t set someone else''s theme') from changed;

-- As the deactivated admin.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated"}', true);

with changed as (
  update public.users set theme = 'dark'
  where id = '00000000-0000-4000-8000-00000000a005'
  returning 1
)
select is(count(*)::int, 0, 'a deactivated user can''t set a theme') from changed;

reset role;

select results_eq(
  $$ select id::text, theme from public.users
     where id::text like '00000000-0000-4000-8000-00000000a00_' and theme is not null $$,
  $$ values ('00000000-0000-4000-8000-00000000a003', 'grey') $$,
  'only the member''s own theme changed'
);

select * from finish();
rollback;
