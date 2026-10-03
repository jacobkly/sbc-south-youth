-- The email log and quota guard: reserves stop at each priority's ceiling,
-- suppressed addresses are never sent to, the drain claims and marks rows,
-- Resend webhooks close the loop, and only owners read any of it.
begin;

create extension if not exists pgtap with schema extensions;

select plan(68);

-- Fake people: an owner, a finance viewer, a site editor, and an owner whose
-- access was removed.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'editor@example.test', '{"full_name": "Test Editor"}'),
  ('00000000-0000-4000-8000-00000000a004', 'removed@example.test', '{"full_name": "Test Removed"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set roles = '{site_editor,site_messages}' where id = '00000000-0000-4000-8000-00000000a003';
update public.users set roles = '{owner}', is_active = false where id = '00000000-0000-4000-8000-00000000a004';

-- Start from an empty log, so the counts below are exact.
delete from public.email_log;
delete from public.email_suppressions;

-- Who can call and write.
select is_empty(
  $$ select f.fn
     from unnest(array[
       'public.email_reserve(text, integer, text, text, text, text, text, uuid)',
       'public.email_claim(text, integer)',
       'public.email_mark(uuid, public.email_status, text, text)',
       'public.email_record_webhook(text, public.email_status, uuid, text, text, text, timestamptz)'
     ]) as f (fn)
     where has_function_privilege('anon', f.fn, 'execute')
        or has_function_privilege('authenticated', f.fn, 'execute') $$,
  'anon and signed-in users can''t call the sending functions'
);

select is_empty(
  $$ select f.fn
     from unnest(array[
       'public.email_reserve(text, integer, text, text, text, text, text, uuid)',
       'public.email_claim(text, integer)',
       'public.email_mark(uuid, public.email_status, text, text)',
       'public.email_record_webhook(text, public.email_status, uuid, text, text, text, timestamptz)'
     ]) as f (fn)
     where not has_function_privilege('service_role', f.fn, 'execute') $$,
  'service_role can call the sending functions'
);

select is_empty(
  $$ select t.tbl, p.privilege
     from unnest(array['public.email_log', 'public.email_suppressions']) as t (tbl)
     cross join unnest(array['select', 'insert', 'update', 'delete', 'truncate']) as p (privilege)
     where has_table_privilege('service_role', t.tbl, p.privilege) $$,
  'the secret key reads and writes the email tables only through the functions'
);

select is_empty(
  $$ select t.tbl, p.privilege
     from unnest(array['public.email_log', 'public.email_suppressions']) as t (tbl)
     cross join unnest(array['insert', 'update', 'delete', 'truncate']) as p (privilege)
     where has_table_privilege('authenticated', t.tbl, p.privilege) $$,
  'signed-in users can''t write the email tables'
);

-- Reserving.
set local role service_role;

select results_eq(
  $$ select status::text, template, priority::int, to_address, subject, scope, env, related_type, related_id
     from public.email_reserve(
       'invite', 2, '  New.Person@Example.test ', 'You''re invited', 'platform', 'production',
       'invite', '00000000-0000-4000-8000-0000000000e1'
     ) $$,
  $$ values ('queued', 'invite', 2, 'new.person@example.test', 'You''re invited', 'platform', 'production',
             'invite', '00000000-0000-4000-8000-0000000000e1'::uuid) $$,
  'a reserve under the ceilings queues the email, with the address trimmed and lowercased'
);

select throws_ok(
  $$ select public.email_reserve('invite', 6, 'someone@example.test', 'Hi', 'platform') $$,
  '22023',
  'Choose a priority from 1 to 5.',
  'a reserve needs a priority from 1 to 5'
);

select throws_ok(
  $$ select public.email_reserve('invite', 2, '  ', 'Hi', 'platform') $$,
  '22023',
  'The email needs an address.',
  'a reserve needs an address'
);

select throws_ok(
  $$ select public.email_reserve('invite', 2, 'someone@example.test', 'Hi', 'platform', 'preview') $$,
  '23514',
  null,
  'a reserve is for production or staging'
);

-- The daily ceilings, counted over the last 24 hours. 78 sends plus the
-- invite above make 79, and emails that never reached Resend don't count.
reset role;

insert into public.email_log (template, priority, scope, to_address, status, resend_id, created_at)
select 'request-submitted', 3, 'finances', 'fill' || g || '@example.test', 'sent', 're_fill_a' || g, now() - interval '1 hour'
from generate_series(1, 78) as g;

insert into public.email_log (template, priority, scope, to_address, status, created_at)
select 'form-alert', 4, 'site', 'never' || g || '@example.test', s, now() - interval '1 hour'
from generate_series(1, 10) as g
cross join unnest(array['skipped_quota', 'suppressed', 'failed']::public.email_status[]) as s;

set local role service_role;

select is(
  (select status::text from public.email_reserve('request-submitted', 3, 'treasurer@example.test', 'New request', 'finances')),
  'queued',
  'the 80th send of the day queues a finance notification; skipped, suppressed and unsent emails don''t count'
);

select is(
  (select status::text from public.email_reserve('request-submitted', 3, 'treasurer@example.test', 'New request', 'finances')),
  'skipped_quota',
  'at 80 sends in a day, a finance notification is skipped'
);

select is(
  (select status::text from public.email_reserve('form-alert', 4, 'messages@example.test', 'New message', 'site')),
  'skipped_quota',
  'at 80, a form alert is skipped too'
);

select is(
  (select status::text from public.email_reserve('invite', 2, 'invitee@example.test', 'You''re invited', 'platform')),
  'queued',
  'past 80, an invite still goes out'
);

reset role;

insert into public.email_log (template, priority, scope, to_address, status, resend_id, created_at)
select 'invite', 2, 'platform', 'fill' || g || '@example.test', 'delivered', 're_fill_b' || g, now() - interval '2 hours'
from generate_series(1, 8) as g;

set local role service_role;

select is(
  (select status::text from public.email_reserve('invite', 2, 'invitee@example.test', 'You''re invited', 'platform')),
  'queued',
  'the 90th send of the day is still an invite'
);

select is(
  (select status::text from public.email_reserve('invite', 2, 'invitee@example.test', 'You''re invited', 'platform')),
  'skipped_quota',
  'at 90, an invite is skipped'
);

select is(
  (select status::text from public.email_reserve('auth', 1, 'leader@example.test', 'Your code', 'platform')),
  'queued',
  'past 90, a sign-in code still goes out'
);

select is(
  (select status::text from public.email_reserve('daily-digest', 5, 'messages@example.test', 'Today''s messages', 'site')),
  'queued',
  'past the form alert ceiling, the daily digest still goes out'
);

select is(
  (select status::text from public.email_reserve('daily-digest', 5, 'messages@example.test', 'Today''s messages', 'site')),
  'skipped_quota',
  'each person gets one digest a day'
);

select is(
  (select status::text from public.email_reserve('daily-digest', 5, 'editor@example.test', 'Today''s messages', 'site')),
  'queued',
  'another person still gets their digest'
);

reset role;

insert into public.email_log (template, priority, scope, to_address, status, resend_id, created_at)
select 'auth', 1, 'platform', 'fill' || g || '@example.test', 'sent', 're_fill_c' || g, now() - interval '3 hours'
from generate_series(1, 7) as g;

set local role service_role;

select is(
  (select status::text from public.email_reserve('auth', 1, 'leader@example.test', 'Your code', 'platform')),
  'skipped_quota',
  'at Resend''s 100 a day, even a sign-in code is skipped'
);

select is(
  (select status::text from public.email_reserve('daily-digest', 5, 'owner@example.test', 'Today''s messages', 'site')),
  'skipped_quota',
  'at 100, the digest is skipped too'
);

reset role;

update public.email_log set created_at = created_at - interval '25 hours';

set local role service_role;

select is(
  (select status::text from public.email_reserve('request-submitted', 3, 'treasurer@example.test', 'New request', 'finances')),
  'queued',
  'sends more than a day old don''t count toward the daily ceilings'
);

-- The monthly ceilings, counted over the last 31 days so they cover any
-- calendar month. 101 sends so far, plus 2,798 more make 2,899.
reset role;

insert into public.email_log (template, priority, scope, to_address, status, resend_id, created_at)
select 'request-paid', 3, 'finances', 'fill@example.test', 'delivered', 're_fill_d' || g, now() - interval '10 days'
from generate_series(1, 2798) as g;

set local role service_role;

select is(
  (select status::text from public.email_reserve('request-paid', 3, 'treasurer@example.test', 'Paid', 'finances')),
  'queued',
  'the 2,900th send of the month still goes out'
);

select is(
  (select status::text from public.email_reserve('invite', 2, 'invitee@example.test', 'You''re invited', 'platform')),
  'skipped_quota',
  'at 2,900 sends in 31 days, everything but sign-in codes stops'
);

select is(
  (select status::text from public.email_reserve('auth', 1, 'leader@example.test', 'Your code', 'platform')),
  'queued',
  'sign-in codes keep the month''s last 100'
);

reset role;

insert into public.email_log (template, priority, scope, to_address, status, resend_id, created_at)
select 'auth', 1, 'platform', 'fill@example.test', 'sent', 're_fill_e' || g, now() - interval '5 days'
from generate_series(1, 99) as g;

set local role service_role;

select is(
  (select status::text from public.email_reserve('auth', 1, 'leader@example.test', 'Your code', 'platform')),
  'skipped_quota',
  'at Resend''s 3,000 a month, even a sign-in code is skipped'
);

reset role;

update public.email_log set created_at = created_at - interval '32 days';

set local role service_role;

select is(
  (select status::text from public.email_reserve('invite', 2, 'invitee@example.test', 'You''re invited', 'platform')),
  'queued',
  'sends more than 31 days old don''t count toward the monthly ceilings'
);

-- Suppressed addresses.
reset role;

insert into public.email_suppressions (address, reason) values ('bounced@example.test', 'bounced');

set local role service_role;

select results_eq(
  $$ select status::text, to_address
     from public.email_reserve('invite', 2, ' Bounced@Example.test', 'You''re invited', 'platform') $$,
  $$ values ('suppressed', 'bounced@example.test') $$,
  'a suppressed address is never queued, and the skip is logged'
);

-- The drain: claim, then mark.
reset role;

delete from public.email_log;

set local role service_role;

select is(
  (select count(*)::int from (
    select public.email_reserve('form-alert', 4, 'one@example.test', 'New message', 'site')
    union all
    select public.email_reserve('invite', 2, 'two@example.test', 'You''re invited', 'platform')
    union all
    select public.email_reserve('invite', 2, 'three@example.test', 'You''re invited', 'platform')
    union all
    select public.email_reserve('invite', 2, 'staging@example.test', 'You''re invited', 'platform', 'staging')
  ) as r),
  4,
  'four emails are reserved for the drain'
);

select results_eq(
  $$ select priority::int, status::text, attempts::int from public.email_claim('production', 10) $$,
  $$ values (2, 'sending', 1), (2, 'sending', 1), (4, 'sending', 1) $$,
  'the drain claims queued production emails, highest priority first, and marks them sending'
);

select is_empty(
  $$ select 1 from public.email_claim('production', 10) $$,
  'an email being sent isn''t claimed again'
);

select results_eq(
  $$ select to_address from public.email_claim('staging', 10) $$,
  $$ values ('staging@example.test') $$,
  'staging and production each claim only their own emails'
);

select throws_ok(
  $$ select public.email_claim('preview') $$,
  '22023',
  'Claim emails for production or staging.',
  'the drain names its environment'
);

reset role;

insert into public.email_log (template, priority, scope, to_address, status, attempts, updated_at) values
  ('invite', 2, 'platform', 'stuck@example.test', 'sending', 1, now() - interval '20 minutes'),
  ('invite', 2, 'platform', 'gave-up@example.test', 'sending', 3, now() - interval '20 minutes');

set local role service_role;

select results_eq(
  $$ select to_address, attempts::int from public.email_claim('production', 10) $$,
  $$ values ('stuck@example.test', 2) $$,
  'an email stuck sending for 15 minutes is claimed again'
);

reset role;

select results_eq(
  $$ select status::text, error from public.email_log where to_address = 'gave-up@example.test' $$,
  $$ values ('failed', 'Sending stopped partway three times.') $$,
  'after three tries, a stuck email is marked failed'
);

select set_config('test.one', (select id::text from public.email_log where to_address = 'one@example.test'), true);
select set_config('test.two', (select id::text from public.email_log where to_address = 'two@example.test'), true);
select set_config('test.three', (select id::text from public.email_log where to_address = 'three@example.test'), true);

insert into public.email_log (template, priority, scope, to_address, status)
values ('invite', 2, 'platform', 'skipped@example.test', 'skipped_quota');

select set_config('test.skipped', (select id::text from public.email_log where to_address = 'skipped@example.test'), true);

set local role service_role;

select lives_ok(
  $$ select public.email_mark(current_setting('test.two')::uuid, 'sent', 're_two') $$,
  'the drain marks a sent email with its Resend ID'
);

select lives_ok(
  $$ select public.email_mark(current_setting('test.one')::uuid, 'failed', null, 'Resend said no') $$,
  'the drain marks a failed email with the error'
);

select throws_ok(
  $$ select public.email_mark(current_setting('test.one')::uuid, 'delivered') $$,
  '22023',
  'Mark an email sent or failed.',
  'only webhooks record deliveries'
);

select throws_ok(
  $$ select public.email_mark(current_setting('test.three')::uuid, 'sent') $$,
  '22023',
  'A sent email needs its Resend ID.',
  'a sent email needs its Resend ID'
);

select throws_ok(
  $$ select public.email_mark(current_setting('test.skipped')::uuid, 'sent', 're_skipped') $$,
  '22023',
  'That email was never queued to send.',
  'a skipped email can''t be marked sent'
);

select throws_ok(
  $$ select public.email_mark('00000000-0000-4000-8000-0000000000ff', 'sent', 're_missing') $$,
  'P0002',
  'That email doesn''t exist.',
  'marking needs a real email'
);

reset role;

select results_eq(
  $$ select to_address, status::text, resend_id, error, sent_at is not null
     from public.email_log
     where to_address in ('one@example.test', 'two@example.test')
     order by to_address $$,
  $$ values ('one@example.test', 'failed', null, 'Resend said no', false),
            ('two@example.test', 'sent', 're_two', null, true) $$,
  'marks record the status, Resend ID, error and send time'
);

-- Resend webhooks.
set local role service_role;

select lives_ok(
  $$ select public.email_record_webhook('re_two', 'delivered') $$,
  'a delivery event updates its email'
);

select lives_ok(
  $$ select public.email_record_webhook('re_two', 'sent') $$,
  'a late sent event is taken'
);

-- The event for three beats the drain's mark, and finds the row by its tag.
select lives_ok(
  $$ select public.email_record_webhook('re_three', 'delivered', current_setting('test.three')::uuid) $$,
  'an event that beats the mark finds its email by the log ID tag'
);

select lives_ok(
  $$ select public.email_mark(current_setting('test.three')::uuid, 'sent', 're_three') $$,
  'the mark that comes after it still works'
);

select lives_ok(
  $$ select public.email_record_webhook(
       're_auth', 'sent', null, 'Leader@Example.test', 'Your code', null, now() - interval '1 minute'
     ) $$,
  'a sent event for Supabase Auth''s own mail is taken'
);

select lives_ok(
  $$ select public.email_record_webhook('re_auth', 'delivered') $$,
  'and so is its delivery'
);

select throws_ok(
  $$ select public.email_record_webhook('re_two', 'queued') $$,
  '22023',
  'The webhook doesn''t take that status.',
  'webhooks only record what Resend reports'
);

reset role;

select results_eq(
  $$ select to_address, status::text, resend_id from public.email_log
     where to_address in ('two@example.test', 'three@example.test')
     order by to_address $$,
  $$ values ('three@example.test', 'delivered', 're_three'),
            ('two@example.test', 'delivered', 're_two') $$,
  'events never move an email back, whichever order they come in'
);

select results_eq(
  $$ select template, priority::int, scope, to_address, subject, status::text, counts_toward_quota
     from public.email_log where resend_id = 're_auth' $$,
  $$ values ('auth', 1, 'platform', 'leader@example.test', 'Your code', 'delivered', true) $$,
  'Supabase Auth''s mail gets one row as a sign-in code, which counts toward the quota'
);

set local role service_role;

select lives_ok(
  $$ select public.email_record_webhook('re_two', 'bounced', null, null, null, 'Mailbox not found') $$,
  'a bounce is recorded'
);

select lives_ok(
  $$ select public.email_record_webhook('re_two', 'bounced', null, null, null, 'Mailbox not found') $$,
  'a repeated bounce is taken too'
);

select lives_ok(
  $$ select public.email_record_webhook('re_auth', 'complained') $$,
  'a complaint is recorded'
);

reset role;

select results_eq(
  $$ select s.address, s.reason, l.resend_id, l.status::text, l.error
     from public.email_suppressions s
     join public.email_log l on l.id = s.email_log_id
     order by s.address $$,
  $$ values ('leader@example.test', 'complained', 're_auth', 'complained', null),
            ('two@example.test', 'bounced', 're_two', 'bounced', 'Mailbox not found') $$,
  'bounces and complaints suppress the address once, linked to the email'
);

set local role service_role;

select is(
  (select status::text from public.email_reserve('invite', 2, 'Two@Example.test', 'You''re invited', 'platform')),
  'suppressed',
  'nothing more is sent to a bounced address'
);

-- Who reads.
reset role;

select set_config('test.suppression', (select id::text from public.email_suppressions where address = 'two@example.test'), true);

set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select isnt_empty($$ select 1 from public.email_log $$, 'an owner reads the email log');

select isnt_empty($$ select 1 from public.email_suppressions $$, 'an owner reads the suppressed addresses');

select throws_ok(
  $$ select public.email_reserve('invite', 2, 'someone@example.test', 'Hi', 'platform') $$,
  '42501',
  null,
  'an owner can''t call the sending functions from the browser'
);

select throws_ok(
  $$ update public.email_log set subject = 'Changed' $$,
  '42501',
  null,
  'an owner can''t change the email log'
);

select throws_ok(
  $$ delete from public.email_suppressions $$,
  '42501',
  null,
  'an owner can''t delete suppressions directly'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select is_empty($$ select 1 from public.email_log $$, 'a finance viewer reads no emails');

select throws_ok(
  $$ select public.email_unsuppress(current_setting('test.suppression')::uuid) $$,
  '42501',
  'Only an owner can start sending to an address again.',
  'a finance viewer can''t unsuppress an address'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.email_log union all select 1 from public.email_suppressions $$,
  'a site editor reads no emails or suppressions'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.email_log union all select 1 from public.email_suppressions $$,
  'an owner whose access was removed reads nothing'
);

select throws_ok(
  $$ select public.email_unsuppress(current_setting('test.suppression')::uuid) $$,
  '42501',
  'Only an owner can start sending to an address again.',
  'an owner whose access was removed can''t unsuppress'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.email_unsuppress(current_setting('test.suppression')::uuid) $$,
  'an owner starts sending to an address again'
);

select throws_ok(
  $$ select public.email_unsuppress(current_setting('test.suppression')::uuid) $$,
  'P0002',
  'That address isn''t suppressed.',
  'unsuppressing needs a suppressed address'
);

reset role;
set local role service_role;

select is(
  (select status::text from public.email_reserve('invite', 2, 'two@example.test', 'You''re invited', 'platform')),
  'queued',
  'once unsuppressed, the address gets email again'
);

reset role;

select * from finish();
rollback;
