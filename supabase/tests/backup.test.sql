-- The nightly backup's own role: it reads everything for the dump, writes
-- nothing, and reports each finished backup through record_backup(), which
-- nothing else can call. Owners read the reports for Home.
begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- The role.
select ok(
  exists (select 1 from pg_roles where rolname = 'backup_job'),
  'the backup role exists'
);

select ok(
  not (select rolcanlogin from pg_roles where rolname = 'backup_job'),
  'the backup role can''t sign in until its password is set outside the repo'
);

select ok(
  not (select rolsuper or rolcreaterole or rolcreatedb or rolreplication from pg_roles where rolname = 'backup_job'),
  'the backup role has no admin powers'
);

select ok(
  (select rolbypassrls from pg_roles where rolname = 'backup_job'),
  'the backup role reads past RLS, so the dump has every row'
);

select set_eq(
  $$ select r.rolname::text from pg_auth_members m
     join pg_roles r on r.oid = m.roleid
     where m.member = 'backup_job'::regrole $$,
  array['pg_read_all_data'],
  'the backup role belongs only to pg_read_all_data'
);

select ok(
  not pg_has_role('authenticator', 'backup_job', 'member'),
  'the API can''t switch to the backup role'
);

-- It writes nothing, anywhere.
select is_empty(
  $$ select c.oid::regclass, p.privilege
     from pg_class c
     cross join unnest(array['insert', 'update', 'delete', 'truncate']) as p (privilege)
     where c.relkind in ('r', 'p', 'v')
       and c.relnamespace::regnamespace::text in ('public', 'site', 'auth', 'storage')
       and has_table_privilege('backup_job', c.oid, p.privilege) $$,
  'the backup role can''t write to any table'
);

-- The report function.
select ok(
  has_function_privilege('backup_job', 'public.record_backup(bigint, bigint, integer)', 'execute'),
  'the backup role can report a backup'
);

select is_empty(
  $$ select r.rolname
     from (values ('anon'), ('authenticated'), ('service_role')) as r (rolname)
     where has_function_privilege(r.rolname, 'public.record_backup(bigint, bigint, integer)', 'execute') $$,
  'no client role can report a backup, not even the secret key'
);

select set_eq(
  $$ select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace::regnamespace::text in ('public', 'site')
       and has_function_privilege('backup_job', p.oid, 'execute') $$,
  array['record_backup(bigint,bigint,integer)'],
  'record_backup is the only app function the backup role can call'
);

-- Fake people: an owner and a finance viewer.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000b001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000b002', 'viewer@example.test', '{"full_name": "Test Viewer"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000b001';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000b002';

delete from public.activity_log where action = 'backup.completed';

-- The test runs as the database owner, which needs to join the role to
-- become it.
grant backup_job to postgres;

set local role backup_job;

select lives_ok(
  $$ select public.record_backup(12345678, 234567890, 1234) $$,
  'the backup role reports a finished backup'
);

select lives_ok(
  $$ select public.record_backup(2345678, null, null) $$,
  'a backup of the database alone is reported without file sizes'
);

select throws_ok(
  $$ select public.record_backup(0, 1, 1) $$,
  '22023',
  'A backup needs the size of its database dump.',
  'a backup with an empty dump isn''t reported'
);

select throws_ok(
  $$ select public.record_backup(1, -1, 1) $$,
  '22023',
  'File sizes and counts can''t be negative.',
  'negative file sizes aren''t reported'
);

select throws_ok(
  $$ insert into public.activity_log (scope, action, entity_type) values ('platform', 'backup.completed', 'backup') $$,
  '42501',
  null,
  'the backup role can''t write the log directly'
);

reset role;

select results_eq(
  $$ select scope, entity_type, actor_id, changes from public.activity_log
     where action = 'backup.completed' order by (changes ->> 'database_bytes')::bigint desc $$,
  $$ values
       ('platform', 'backup', null::uuid,
        '{"database_bytes": 12345678, "file_bytes": 234567890, "files": 1234}'::jsonb),
       ('platform', 'backup', null::uuid,
        '{"database_bytes": 2345678, "file_bytes": null, "files": null}'::jsonb) $$,
  'each report logs backup.completed with its sizes and no one behind it'
);

-- Clients can't report one.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000b001", "role": "authenticated", "aal": "aal2"}';

select throws_ok(
  $$ select public.record_backup(1, 1, 1) $$,
  '42501',
  null,
  'an owner can''t report a backup'
);

-- Owners read the reports; nobody else does.
select is(
  (select count(*)::integer from public.activity_log where action = 'backup.completed'),
  2,
  'an owner reads the backup reports'
);

select ok(
  (select (changes ->> 'database_bytes')::bigint from public.activity_log
   where action = 'backup.completed' order by created_at desc, id desc limit 1) > 0,
  'an owner reads the latest backup''s size'
);

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000b002", "role": "authenticated"}';

select is_empty(
  $$ select 1 from public.activity_log where action = 'backup.completed' $$,
  'a finance viewer reads no backup reports'
);

reset role;
set local role service_role;

select throws_ok(
  $$ select public.record_backup(1, 1, 1) $$,
  '42501',
  null,
  'the secret key can''t report a backup'
);

reset role;
set local role anon;

select throws_ok(
  $$ select public.record_backup(1, 1, 1) $$,
  '42501',
  null,
  'anon can''t report a backup'
);

reset role;

select * from finish();
rollback;
