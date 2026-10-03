-- Nightly retention: site and platform activity goes after 2 years, email
-- addresses after 90 days, and pg_cron's own run history after 14 days.
-- Finance records stay.
begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- The jobs, each on its own schedule in UTC.
select results_eq(
  $$ select jobname::text, schedule::text, command::text from cron.job
     where jobname in ('prune-old-activity', 'clear-old-email-addresses', 'prune-cron-history')
     order by jobname $$,
  $$ values
       ('clear-old-email-addresses', '5 10 * * *', 'select public.clear_old_email_addresses()'),
       ('prune-cron-history', '10 10 * * *', 'select public.prune_cron_history()'),
       ('prune-old-activity', '0 10 * * *', 'select public.prune_old_activity()') $$,
  'the three retention jobs run nightly'
);

-- Only the jobs run them: no client, and not the secret key either.
select is_empty(
  $$ select p.proname, r.rolname
     from pg_proc p
     cross join (values ('anon'), ('authenticated'), ('service_role')) as r (rolname)
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('prune_old_activity', 'clear_old_email_addresses', 'prune_cron_history')
       and has_function_privilege(r.rolname, p.oid, 'execute') $$,
  'no client role can run a retention function'
);

select is(
  (select count(*)::integer from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('prune_old_activity', 'clear_old_email_addresses', 'prune_cron_history')),
  3,
  'all three retention functions exist'
);

-- Activity: only known rows, either side of the 2-year line.
delete from public.activity_log;

insert into public.activity_log (id, scope, action, entity_type, created_at) values
  ('00000000-0000-4000-8000-0000000a0001', 'site', 'post.created', 'post', now() - interval '3 years'),
  ('00000000-0000-4000-8000-0000000a0002', 'platform', 'user.updated', 'user', now() - interval '2 years 1 day'),
  ('00000000-0000-4000-8000-0000000a0003', 'finances', 'export.downloaded', 'export', now() - interval '3 years'),
  ('00000000-0000-4000-8000-0000000a0004', 'site', 'post.updated', 'post', now() - interval '2 years' + interval '1 day'),
  ('00000000-0000-4000-8000-0000000a0005', 'platform', 'auth.signed_in', 'auth', now() - interval '1 day');

select is(public.prune_old_activity(), 2, 'pruning removes the two site and platform rows past 2 years');

select set_eq(
  $$ select id::text from public.activity_log $$,
  array[
    '00000000-0000-4000-8000-0000000a0003',
    '00000000-0000-4000-8000-0000000a0004',
    '00000000-0000-4000-8000-0000000a0005'
  ],
  'finance activity and anything under 2 years old stays'
);

select is(public.prune_old_activity(), 0, 'pruning again finds nothing');

-- Email addresses: only known rows, either side of the 90-day line.
delete from public.email_log;

insert into public.email_log (id, template, priority, scope, to_address, subject, status, resend_id, created_at)
values
  ('00000000-0000-4000-8000-0000000e0001', 'request-paid', 3, 'finances', 'old-sent@example.test', 'Paid',
   'delivered', 're_old_delivered', now() - interval '100 days'),
  ('00000000-0000-4000-8000-0000000e0002', 'invite', 2, 'platform', 'old-bounce@example.test', 'Invite',
   'bounced', 're_old_bounced', now() - interval '91 days'),
  ('00000000-0000-4000-8000-0000000e0003', 'request-paid', 3, 'finances', 'old-skip@example.test', 'Paid',
   'skipped_quota', null, now() - interval '120 days'),
  ('00000000-0000-4000-8000-0000000e0004', 'request-paid', 3, 'finances', 'recent@example.test', 'Paid',
   'sent', 're_recent', now() - interval '89 days'),
  ('00000000-0000-4000-8000-0000000e0005', 'request-paid', 3, 'finances', 'waiting@example.test', 'Paid',
   'queued', null, now() - interval '100 days'),
  ('00000000-0000-4000-8000-0000000e0006', 'request-paid', 3, 'finances', 'sending@example.test', 'Paid',
   'sending', null, now() - interval '100 days');

-- A suppression keeps its address, or the bounced inbox would get mail again.
insert into public.email_suppressions (address, reason, email_log_id)
values ('old-bounce@example.test', 'bounced', '00000000-0000-4000-8000-0000000e0002');

select is(public.clear_old_email_addresses(), 3, 'clearing empties the three finished emails past 90 days');

select set_eq(
  $$ select id::text from public.email_log where to_address is null $$,
  array[
    '00000000-0000-4000-8000-0000000e0001',
    '00000000-0000-4000-8000-0000000e0002',
    '00000000-0000-4000-8000-0000000e0003'
  ],
  'only the finished emails past 90 days lose their address'
);

select is(
  (select to_address from public.email_log where id = '00000000-0000-4000-8000-0000000e0004'),
  'recent@example.test',
  'an email under 90 days old keeps its address'
);

select is(
  (select count(*)::integer from public.email_log
   where id in ('00000000-0000-4000-8000-0000000e0005', '00000000-0000-4000-8000-0000000e0006')
     and to_address is not null),
  2,
  'an email still waiting to send keeps its address'
);

select results_eq(
  $$ select subject, status::text, resend_id from public.email_log
     where id = '00000000-0000-4000-8000-0000000e0001' $$,
  $$ values ('Paid', 'delivered', 're_old_delivered') $$,
  'the rest of a cleared row stays, so quotas and history still add up'
);

select is(
  (select count(*)::integer from public.email_log),
  6,
  'clearing deletes no emails'
);

select is(
  (select address from public.email_suppressions where email_log_id = '00000000-0000-4000-8000-0000000e0002'),
  'old-bounce@example.test',
  'a suppressed address stays suppressed'
);

select is(public.clear_old_email_addresses(), 0, 'clearing again finds nothing');

-- pg_cron's run history: only known rows, either side of the 14-day line.
delete from cron.job_run_details;

insert into cron.job_run_details (jobid, runid, status, start_time, end_time) values
  (1, 9001, 'succeeded', now() - interval '20 days', now() - interval '20 days'),
  (1, 9002, 'failed', now() - interval '15 days', now() - interval '15 days'),
  (1, 9003, 'succeeded', now() - interval '13 days', now() - interval '13 days'),
  (1, 9004, 'running', now() - interval '1 hour', null);

select is(public.prune_cron_history(), 2, 'pruning removes the two job runs past 14 days');

select set_eq(
  $$ select runid from cron.job_run_details $$,
  array[9003, 9004]::bigint[],
  'recent runs and a run still going stay'
);

-- Each job's command runs as written.
select lives_ok(
  (select command from cron.job where jobname = 'prune-old-activity'),
  'the activity job''s command runs'
);

select lives_ok(
  (select command from cron.job where jobname = 'clear-old-email-addresses'),
  'the email job''s command runs'
);

select * from finish();
rollback;
