-- The owner's Email screen: email_summary() counts what the quota counts,
-- only owners can read it, and owners hear once a month when the month
-- passes 80% of the free plan.
begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- Who can call it.
select ok(
  has_function_privilege('authenticated', 'public.email_summary()', 'execute')
    and not has_function_privilege('anon', 'public.email_summary()', 'execute'),
  'signed-in people can call email_summary(), which checks for an owner, and anon can''t'
);

select is_empty(
  $$ select r.rolname
     from pg_catalog.pg_roles r
     where r.rolname in ('anon', 'authenticated', 'service_role')
       and has_function_privilege(r.rolname, 'public.queue_quota_warning()', 'execute') $$,
  'no client can queue the quota warning, not even with the secret key'
);

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'email-quota-warning'),
  '55 14 * * * select public.queue_quota_warning()',
  'a morning job checks the quota just before the daily digest'
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

-- Reading the summary.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select is(
  public.email_summary(),
  '{"day": 0, "month": 0, "templates": [], "warned_at": null}'::jsonb,
  'an empty log counts nothing'
);

reset role;

-- 30 invites and a bounced sign-in code today, a failed alert Resend took
-- and two it refused, three alerts the quota skipped, five requests ten days
-- ago, and four invites from before the window.
insert into public.email_log (template, priority, scope, to_address, status, resend_id, created_at)
select 'invite', 2, 'platform', 'invite' || g || '@example.test', 'sent'::public.email_status, 're_invite_' || g,
  now() - interval '1 hour'
from generate_series(1, 30) as g
union all
select 'auth', 1, 'platform', 'code@example.test', 'bounced', 're_auth_1', now() - interval '2 hours'
union all
select 'form-alert', 4, 'site', 'youth@example.test', 'failed', 're_alert_1', now() - interval '3 hours'
union all
select 'form-alert', 4, 'site', 'youth@example.test', 'failed', null, now() - interval '3 hours'
from generate_series(1, 2)
union all
select 'form-alert', 4, 'site', 'youth@example.test', 'skipped_quota', null, now() - interval '3 hours'
from generate_series(1, 3)
union all
select 'request-submitted', 3, 'finances', 'owner@example.test', 'sent', 're_request_' || g, now() - interval '10 days'
from generate_series(1, 5) as g
union all
select 'invite', 2, 'platform', 'old' || g || '@example.test', 'sent', 're_old_' || g, now() - interval '40 days'
from generate_series(1, 4) as g;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select is(
  (public.email_summary() ->> 'day')::integer,
  32,
  'today counts what Resend took in the last 24 hours, bounces and taken failures too'
);

select is(
  (public.email_summary() ->> 'month')::integer,
  37,
  'the month counts what Resend took in the last 31 days'
);

select is(
  public.email_summary() -> 'templates',
  '[
    {"template": "auth", "status": "bounced", "counted": true, "emails": 1},
    {"template": "form-alert", "status": "skipped_quota", "counted": false, "emails": 3},
    {"template": "form-alert", "status": "failed", "counted": false, "emails": 2},
    {"template": "form-alert", "status": "failed", "counted": true, "emails": 1},
    {"template": "invite", "status": "sent", "counted": true, "emails": 30},
    {"template": "request-submitted", "status": "sent", "counted": true, "emails": 5}
  ]'::jsonb,
  'each template lists its last 31 days by status, and whether they counted'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.email_summary() $$,
  '42501',
  'Only an owner can see how much email is used.',
  'a finance viewer can''t read the summary'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.email_summary() $$,
  '42501',
  'Only an owner can see how much email is used.',
  'an owner whose access was removed can''t read it either'
);

reset role;

-- The monthly warning.
select is(public.queue_quota_warning(), 0, 'under 80% of the month, nobody is warned');

select is_empty(
  $$ select 1 from public.email_log where template = 'quota-warning' $$,
  'so no warning is logged'
);

-- 2,363 more sent two days ago bring the month to 2,400, exactly 80%. The
-- second owner's address bounced before.
insert into public.email_log (template, priority, scope, to_address, status, resend_id, created_at)
select 'form-alert', 4, 'site', 'youth@example.test', 'sent', 're_fill_' || g, now() - interval '2 days'
from generate_series(1, 2363) as g;

insert into public.email_suppressions (address, reason) values ('second@example.test', 'bounced');

select is(public.queue_quota_warning(), 2, 'at 80% of the month, every active owner is warned');

select results_eq(
  $$ select to_address, status::text, priority::integer, subject, scope, env
     from public.email_log
     where template = 'quota-warning'
     order by to_address $$,
  $$ values
       ('owner@example.test', 'queued', 2, '2,400 of 3,000 emails used this month', 'platform', 'production'),
       ('second@example.test', 'suppressed', 2, '2,400 of 3,000 emails used this month', 'platform', 'production') $$,
  'the warning goes out like an invite, with the count in its subject, and skips a blocked address'
);

select is(public.queue_quota_warning(), 0, 'a second check the same month warns nobody');

select is(
  (select count(*)::integer from public.email_log where template = 'quota-warning'),
  2,
  'so the month keeps its one warning each'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select isnt(public.email_summary() ->> 'warned_at', null, 'the summary says owners were warned this month');

reset role;

-- A warning from last month doesn't count for this one.
update public.email_log
set created_at = date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles'
  - interval '1 hour'
where template = 'quota-warning';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select is(public.email_summary() ->> 'warned_at', null, 'last month''s warning isn''t this month''s');

reset role;

select is(public.queue_quota_warning(), 2, 'so the new month warns again');

-- One the daily quota skipped tries again the next morning.
delete from public.email_log where template = 'quota-warning';

insert into public.email_log (template, priority, scope, to_address, status, created_at)
values ('quota-warning', 2, 'platform', 'owner@example.test', 'skipped_quota', now() - interval '1 hour');

select is(public.queue_quota_warning(), 2, 'a warning the daily quota skipped doesn''t count as sent');

select is(
  (select count(*)::integer from public.email_log where template = 'quota-warning' and status <> 'skipped_quota'),
  2,
  'so each owner gets one'
);

-- Below 80% again, a new month stays quiet.
delete from public.email_log where template = 'quota-warning';
delete from public.email_log where resend_id like 're_fill_%';

select cmp_ok(
  (select count(*)::integer from public.email_log where counts_toward_quota and created_at > now() - interval '31 days'),
  '<',
  2400,
  'the month drops under 80%'
);

select is(public.queue_quota_warning(), 0, 'and nobody is warned');

select * from finish();
rollback;
