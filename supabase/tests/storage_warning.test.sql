-- Owners hear once a month while stored files are over 80% of the free
-- plan's 1 GB, and again when they pass 95%, where new site photos stop.
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- Who can call it.
select is_empty(
  $$ select r.rolname
     from pg_catalog.pg_roles r
     where r.rolname in ('anon', 'authenticated', 'service_role')
       and has_function_privilege(r.rolname, 'public.queue_storage_warning()', 'execute') $$,
  'no client can queue the storage warning, not even with the secret key'
);

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'email-storage-warning'),
  '50 14 * * * select public.queue_storage_warning()',
  'a morning job checks storage just before the email quota'
);

-- Fake people: two active owners, a finance viewer, and an owner whose
-- access was removed. Only they are active, so the seed's owner hears nothing.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'second@example.test', '{"full_name": "Second Owner"}'),
  ('00000000-0000-4000-8000-00000000a003', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a004', 'former@example.test', '{"full_name": "Former Owner"}');

update public.users set roles = '{owner}' where id in (
  '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a002',
  '00000000-0000-4000-8000-00000000a004'
);
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a003';
update public.users set is_active = false where id not in (
  '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a002',
  '00000000-0000-4000-8000-00000000a003'
);

-- Start from an empty log, so the counts below are exact.
delete from public.email_log;
delete from public.email_suppressions;

-- One receipt file that tops the bucket up to just under 80%, whatever the
-- local files already add up to.
insert into storage.objects (bucket_id, name, metadata)
select 'receipts', 'storage-warning-test/fill.jpg',
  jsonb_build_object('size', 799999999 - coalesce(sum((o.metadata ->> 'size')::bigint), 0))
from storage.objects o;

select is(public.queue_storage_warning(), 0, 'just under 80%, nobody is warned');

select is_empty(
  $$ select 1 from public.email_log where template in ('storage-warning', 'storage-full') $$,
  'so no warning is logged'
);

-- One more byte brings files to exactly 80%. The second owner's address
-- bounced before.
update storage.objects
set metadata = jsonb_build_object('size', (metadata ->> 'size')::bigint + 1)
where bucket_id = 'receipts' and name = 'storage-warning-test/fill.jpg';

insert into public.email_suppressions (address, reason) values ('second@example.test', 'bounced');

select is(public.queue_storage_warning(), 2, 'at 80%, every active owner is warned');

select results_eq(
  $$ select template, to_address, status::text, priority::integer, subject, scope, env
     from public.email_log
     where template in ('storage-warning', 'storage-full')
     order by to_address $$,
  $$ values
       ('storage-warning', 'owner@example.test', 'queued', 2, 'File storage is 80% full', 'platform', 'production'),
       ('storage-warning', 'second@example.test', 'suppressed', 2, 'File storage is 80% full', 'platform',
        'production') $$,
  'the warning goes out like an invite, with the percent in its subject, and skips a blocked address'
);

select is(public.queue_storage_warning(), 0, 'a second check the same month warns nobody');

-- Past 95%, new site photos stop, so owners hear again the same month.
update storage.objects
set metadata = jsonb_build_object('size', (metadata ->> 'size')::bigint + 160000000)
where bucket_id = 'receipts' and name = 'storage-warning-test/fill.jpg';

select is(public.queue_storage_warning(), 2, 'at 96%, owners are told it''s nearly full');

select results_eq(
  $$ select to_address, status::text, subject
     from public.email_log
     where template = 'storage-full'
     order by to_address $$,
  $$ values
       ('owner@example.test', 'queued', 'File storage is 96% full'),
       ('second@example.test', 'suppressed', 'File storage is 96% full') $$,
  'with a nearly full email and the new percent'
);

select is(public.queue_storage_warning(), 0, 'and only once that month');

-- Back under 95% the same month, the 80% warning doesn't come again.
update storage.objects
set metadata = jsonb_build_object('size', (metadata ->> 'size')::bigint - 100000000)
where bucket_id = 'receipts' and name = 'storage-warning-test/fill.jpg';

delete from public.email_log where template = 'storage-warning';

select is(
  public.queue_storage_warning(), 0,
  'once owners heard it''s nearly full, the 80% warning stays quiet for the month'
);

-- Warnings from last month don't count for this one.
update public.email_log
set created_at = date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles'
  - interval '1 hour'
where template in ('storage-warning', 'storage-full');

select is(public.queue_storage_warning(), 2, 'a new month over 80% warns again');

select is(
  (select count(*)::integer from public.email_log
   where template = 'storage-warning' and subject = 'File storage is 86% full'),
  2,
  'with this month''s percent'
);

-- One the daily email quota skipped tries again the next morning.
delete from public.email_log where template in ('storage-warning', 'storage-full');

insert into public.email_log (template, priority, scope, to_address, status, created_at)
values ('storage-warning', 2, 'platform', 'owner@example.test', 'skipped_quota', now() - interval '1 hour');

select is(public.queue_storage_warning(), 2, 'a warning the email quota skipped doesn''t count as sent');

select is(
  (select count(*)::integer from public.email_log where template = 'storage-warning' and status <> 'skipped_quota'),
  2,
  'so each owner gets one'
);

-- Below 80% again, a new month stays quiet.
delete from public.email_log where template in ('storage-warning', 'storage-full');

update storage.objects
set metadata = jsonb_build_object('size', 1)
where bucket_id = 'receipts' and name = 'storage-warning-test/fill.jpg';

select cmp_ok(
  (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o),
  '<',
  800000000::numeric,
  'files drop under 80%'
);

select is(public.queue_storage_warning(), 0, 'and nobody is warned');

select * from finish();
rollback;
