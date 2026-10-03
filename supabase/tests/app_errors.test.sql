-- The owners' error log: only the site's server writes it, only active
-- owners read it, a flood stops at 100 an hour, and rows go after 30 days.
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- Who can call what.
select ok(
  has_function_privilege('service_role', 'public.report_error(text, text, text, uuid, text)', 'execute'),
  'the site''s server can report an error'
);

select is_empty(
  $$ select r.rolname
     from pg_catalog.pg_roles r
     where r.rolname in ('anon', 'authenticated')
       and has_function_privilege(r.rolname, 'public.report_error(text, text, text, uuid, text)', 'execute') $$,
  'no signed-in person or visitor can write to the error log'
);

select is_empty(
  $$ select r.rolname
     from pg_catalog.pg_roles r
     where r.rolname in ('anon', 'authenticated', 'service_role')
       and has_function_privilege(r.rolname, 'public.prune_app_errors()', 'execute') $$,
  'no client can prune the error log, not even with the secret key'
);

select ok(
  not has_table_privilege('service_role', 'public.app_errors', 'select')
    and not has_table_privilege('service_role', 'public.app_errors', 'insert')
    and not has_table_privilege('authenticated', 'public.app_errors', 'insert')
    and not has_table_privilege('authenticated', 'public.app_errors', 'delete'),
  'the secret key can''t read the table, and nobody writes it but report_error()'
);

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'prune-app-errors'),
  '30 10 * * * select public.prune_app_errors()',
  'a nightly job prunes the error log after the other jobs'
);

-- Fake people: an owner, a site editor, and an owner whose access was removed.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'editor@example.test', '{"full_name": "Test Editor"}'),
  ('00000000-0000-4000-8000-00000000a003', 'former@example.test', '{"full_name": "Former Owner"}');

update public.users set roles = '{owner}'
where id in ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a003');
update public.users set roles = '{site_editor}' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a003';

delete from public.app_errors;

-- Writing, as the site's server.
set local role service_role;

select is(
  public.report_error('Save a photo', 'fetch failed', 'ECONNREFUSED', '00000000-0000-4000-8000-00000000a002', 'staging'),
  true,
  'the server reports an error'
);

select is(
  public.report_error('  Portal page /  ', '  ' || repeat('x', 600), repeat('c', 30), '00000000-0000-4000-8000-0000000ffff1'),
  true,
  'a long message, a long code, and someone with no account still write'
);

select throws_ok(
  $$ select public.report_error('Drain', 'Broke', null, null, 'preview') $$,
  '22023',
  'Say whether the error came from production or staging.',
  'only production and staging are environments'
);

reset role;

select results_eq(
  $$ select source, message, code, user_id, env from public.app_errors order by created_at, source desc $$,
  $$ values
     ('Save a photo', 'fetch failed', 'ECONNREFUSED', '00000000-0000-4000-8000-00000000a002'::uuid, 'staging'),
     ('Portal page /', repeat('x', 500), repeat('c', 20), null, 'production') $$,
  'it trims, cuts to fit, and leaves out a person who no longer has a row'
);

select is(
  (select count(*)::integer from public.app_errors where user_id = '00000000-0000-4000-8000-00000000a002'),
  1,
  'the error keeps who hit it'
);

-- Reading it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select is((select count(*)::integer from public.app_errors), 2, 'an owner reads every error');

select is(
  (select u.full_name from public.app_errors e join public.users u on u.id = e.user_id),
  'Test Editor',
  'an owner sees who hit it'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select is_empty($$ select 1 from public.app_errors $$, 'a site editor reads none, not even their own');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is_empty($$ select 1 from public.app_errors $$, 'an owner whose access was removed reads none');

reset role;

-- A flood: the 100th in an hour is the last one kept.
insert into public.app_errors (source, message, created_at)
select 'Loop', 'Broke again', now() - interval '10 minutes' from generate_series(1, 97);

set local role service_role;

select is(
  array[public.report_error('Loop', 'Broke again'), public.report_error('Loop', 'Broke again')],
  array[true, false],
  'past 100 errors in an hour, it keeps no more'
);

reset role;

-- Pruning: errors from the last 30 days stay.
update public.app_errors set created_at = now() - interval '31 days' where source = 'Loop';
update public.app_errors set created_at = now() - interval '29 days' where source = 'Save a photo';

select is(public.prune_app_errors(), 98, 'pruning removes errors older than 30 days');

select results_eq(
  $$ select source from public.app_errors order by source $$,
  $$ values ('Portal page /'), ('Save a photo') $$,
  'errors from the last 30 days stay'
);

select * from finish();
rollback;
