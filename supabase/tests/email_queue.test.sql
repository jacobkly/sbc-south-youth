-- The email queue: request status changes and owner changes queue the right
-- emails through email_reserve(), approval queues nothing, and a transaction
-- that queues an email pokes the drain once, with the URL and secret from
-- Vault. No client reads Vault or pokes the drain itself.
begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

select has_extension('pg_net', 'pg_net is installed');
select has_extension('pg_cron', 'pg_cron is installed');

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'email-daily-digest'),
  '0 15 * * * select public.email_poke_drain(true)',
  'a nightly job pokes the drain for the digest'
);

-- Fake people. Only they are active, so the seed's owner hears nothing.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'second@example.test', '{"full_name": "Second Owner"}'),
  ('00000000-0000-4000-8000-00000000a003', 'requester@example.test', '{"full_name": "Test Requester"}'),
  ('00000000-0000-4000-8000-00000000a004', 'former@example.test', '{"full_name": "Former Owner"}'),
  ('00000000-0000-4000-8000-00000000a005', 'viewer@example.test', '{"full_name": "Test Viewer"}');

update public.users set roles = '{owner}' where id in (
  '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a002',
  '00000000-0000-4000-8000-00000000a004'
);
update public.users set roles = '{finance_requester}' where id = '00000000-0000-4000-8000-00000000a003';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a005';
update public.users set is_active = false where id not in (
  '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a002',
  '00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-00000000a005'
);

-- The requester's payee is b003. The viewer is linked to b005 but can't
-- request, and b001 is nobody's.
insert into public.payees (id, full_name, user_id, linked_at) values
  ('00000000-0000-4000-8000-00000000b001', 'Unlinked Payee', null, null),
  ('00000000-0000-4000-8000-00000000b003', 'Test Requester', '00000000-0000-4000-8000-00000000a003', now()),
  ('00000000-0000-4000-8000-00000000b005', 'Test Viewer', '00000000-0000-4000-8000-00000000a005', now());

insert into public.reimbursement_requests (
  id, request_number, payee_id, created_by, type, amount_cents, purchase_date, vendor, description, status,
  submitted_at, approved_by, approved_at, no_receipt, no_receipt_reason
) overriding system value
select
  ('00000000-0000-4000-8000-00000000' || r.suffix)::uuid,
  r.number,
  ('00000000-0000-4000-8000-00000000' || r.payee)::uuid,
  ('00000000-0000-4000-8000-00000000' || r.created_by)::uuid,
  'youth', 1000, '2026-01-10', 'Fake Store', 'Request ' || r.suffix,
  r.status::public.request_status,
  case when r.status <> 'draft' then now() end,
  case when r.status = 'approved' then '00000000-0000-4000-8000-00000000a001'::uuid end,
  case when r.status = 'approved' then now() end,
  true, 'Lost it'
from (values
  ('c001', 9901, 'b003', 'a003', 'draft'),     -- the requester's, through every step
  ('c002', 9902, 'b001', 'a001', 'draft'),     -- an owner's, for an unlinked payee
  ('c003', 9903, 'b005', 'a001', 'submitted'), -- for the viewer, who can't follow it
  ('c004', 9904, 'b003', 'a001', 'draft'),     -- recorded as paid long after
  ('c005', 9905, 'b003', 'a001', 'approved')   -- approval taken back
) as r (suffix, number, payee, created_by, status);

insert into public.request_lines (id, request_id, position, amount_cents, vendor)
select
  ('00000000-0000-4000-8000-00000000f' || s)::uuid, ('00000000-0000-4000-8000-00000000c' || s)::uuid,
  1, 1000, 'Fake Store'
from unnest(array['001', '002', '003', '004']) as s;

-- Test drain settings in place of any the seed added, and an empty outbox.
delete from vault.secrets where name in ('email_drain_url', 'email_drain_secret', 'email_drain_host');
select vault.create_secret('http://drain.test/api/email/drain', 'email_drain_url');
select vault.create_secret('test-drain-secret', 'email_drain_secret');
select vault.create_secret('portal.drain.test', 'email_drain_host');

delete from public.email_log;
-- As if what follows were a new transaction, which hasn't poked yet.
select set_config('app.email_drain_poked', '', true);

-- The requester submits: every active owner hears, and the drain is poked once.
set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true
);
select lives_ok($$ select public.submit_request('00000000-0000-4000-8000-00000000c001') $$, 'the requester submits');
reset role;

select set_eq(
  $$ select to_address, template, priority::int, scope, subject, status::text, related_type
     from public.email_log where related_id = '00000000-0000-4000-8000-00000000c001' $$,
  $$ values
       ('owner@example.test', 'request-submitted', 3, 'finances', 'R-9901 is ready for review', 'queued',
        'reimbursement_request'),
       ('second@example.test', 'request-submitted', 3, 'finances', 'R-9901 is ready for review', 'queued',
        'reimbursement_request') $$,
  'a submitted request emails every active owner'
);

select bag_eq(
  $$ select url, headers ->> 'Authorization' as auth, headers ->> 'Host' as host, convert_from(body, 'UTF8') as body
     from net.http_request_queue where url like 'http://drain.test/%' $$,
  $$ values ('http://drain.test/api/email/drain', 'Bearer test-drain-secret', 'portal.drain.test', '{}') $$,
  'two queued emails poke the drain once, with the secret'
);

-- An owner asks for more info: only the requester hears.
set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}', true
);
select lives_ok(
  $$ select public.request_info('00000000-0000-4000-8000-00000000c001', 'Which event was this for?') $$,
  'an owner asks for more info'
);
reset role;

select set_eq(
  $$ select to_address, template, priority::int, subject from public.email_log
     where related_id = '00000000-0000-4000-8000-00000000c001' and template <> 'request-submitted' $$,
  $$ values ('requester@example.test', 'request-returned', 3, 'Your request R-9901 needs more info') $$,
  'asking for more info emails the requester'
);

-- The requester resubmits.
set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true
);
select lives_ok($$ select public.submit_request('00000000-0000-4000-8000-00000000c001') $$, 'the requester resubmits');
reset role;

select set_eq(
  $$ select to_address from public.email_log
     where related_id = '00000000-0000-4000-8000-00000000c001' and subject = 'R-9901 was resubmitted' $$,
  array['owner@example.test', 'second@example.test'],
  'a resubmitted request emails every active owner again'
);

-- An owner approves, then pays.
set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}', true
);
select lives_ok($$ select public.approve_request('00000000-0000-4000-8000-00000000c001', null) $$, 'an owner approves');
reset role;

select is(
  (select count(*)::int from public.email_log where related_id = '00000000-0000-4000-8000-00000000c001'),
  5,
  'approving queues nothing'
);

set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}', true
);
select lives_ok($$ select public.mark_paid('00000000-0000-4000-8000-00000000c001', 'cash') $$, 'an owner pays');
reset role;

select set_eq(
  $$ select to_address, template, priority::int, subject from public.email_log
     where related_id = '00000000-0000-4000-8000-00000000c001' and template = 'request-paid' $$,
  $$ values ('requester@example.test', 'request-paid', 3, 'Your request R-9901 was paid') $$,
  'paying emails the requester'
);

-- An owner's own submission goes to the other owners, and nobody follows an
-- unlinked payee, a viewer who can't request, a backfilled payment, or an
-- approval taken back.
set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}', true
);
select lives_ok($$ select public.submit_request('00000000-0000-4000-8000-00000000c002') $$, 'an owner submits');
select lives_ok(
  $$ select public.request_info('00000000-0000-4000-8000-00000000c002', 'Which store?') $$,
  'an owner asks about an unlinked payee''s request'
);
select lives_ok(
  $$ select public.request_info('00000000-0000-4000-8000-00000000c003', 'Which store?') $$,
  'an owner asks about a viewer''s request'
);
select lives_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c004', 'cash', null, now() - interval '30 days') $$,
  'an owner records an old payment'
);
select lives_ok(
  $$ select public.unapprove_request('00000000-0000-4000-8000-00000000c005', 'Not yet') $$,
  'an owner takes an approval back'
);
reset role;

select set_eq(
  $$ select to_address, subject from public.email_log where related_id = '00000000-0000-4000-8000-00000000c002' $$,
  $$ values ('second@example.test', 'R-9902 is ready for review') $$,
  'an owner''s submission emails the other owners, and returning an unlinked payee''s request emails nobody'
);

select is_empty(
  $$ select 1 from public.email_log where related_id in (
       '00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000c004',
       '00000000-0000-4000-8000-00000000c005'
     ) $$,
  'nobody hears about a viewer''s request, a backfilled payment, or an approval taken back'
);

-- Owner changes: every active owner hears, and so does the person who lost it.
set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}', true
);
select lives_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a005', '{finance_viewer,owner}') $$,
  'an owner makes the viewer an owner'
);
select lives_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a005', '{finance_viewer}') $$,
  'and takes it back'
);
select lives_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a003', '{finance_requester,site_editor}') $$,
  'an owner gives the requester another role'
);
select lives_ok($$ select public.remove_access('00000000-0000-4000-8000-00000000a002') $$, 'an owner removes an owner');
select lives_ok($$ select public.reinstate('00000000-0000-4000-8000-00000000a002') $$, 'and reinstates them');
reset role;

select set_eq(
  $$ select to_address, subject from public.email_log where related_id = '00000000-0000-4000-8000-00000000a005' $$,
  $$ values
       ('owner@example.test', 'Test Viewer is now an owner'),
       ('second@example.test', 'Test Viewer is now an owner'),
       ('viewer@example.test', 'Test Viewer is now an owner'),
       ('owner@example.test', 'Test Viewer is no longer an owner'),
       ('second@example.test', 'Test Viewer is no longer an owner'),
       ('viewer@example.test', 'Test Viewer is no longer an owner') $$,
  'gaining and losing Owner each email every owner, once'
);

select is(
  (select count(*)::int from public.email_log where related_id = '00000000-0000-4000-8000-00000000a005'),
  6,
  'one alert per owner for each change'
);

select set_eq(
  $$ select to_address, subject from public.email_log where related_id = '00000000-0000-4000-8000-00000000a002' $$,
  $$ values
       ('owner@example.test', 'Second Owner is no longer an owner'),
       ('second@example.test', 'Second Owner is no longer an owner'),
       ('owner@example.test', 'Second Owner is now an owner'),
       ('second@example.test', 'Second Owner is now an owner') $$,
  'removing and reinstating an owner emails every owner and them'
);

select is_empty(
  $$ select 1 from public.email_log where related_id = '00000000-0000-4000-8000-00000000a003' $$,
  'other role changes email nobody'
);

select is_empty(
  $$ select 1 from public.email_log
     where template = 'owner-changed' and (priority <> 2 or scope <> 'platform' or related_type <> 'user') $$,
  'owner alerts are platform emails at invite priority'
);

-- Pokes: the digest always pokes, emails that won't be sent never do, and
-- nothing pokes without the Vault settings.
select is(
  (select count(*)::int from net.http_request_queue where url like 'http://drain.test/%'),
  1,
  'one transaction pokes the drain once, however many emails it queues'
);

select isnt(public.email_poke_drain(true), null, 'the digest pokes the drain');
select isnt(public.email_poke_drain(true), null, 'even twice in one transaction');

select is(
  (select count(*)::int from net.http_request_queue where url = 'http://drain.test/api/email/drain?digest=1'),
  2,
  'the digest asks for digest=1'
);

select set_config('app.email_drain_poked', '', true);
insert into public.email_suppressions (address, reason) values ('blocked@example.test', 'bounced');
select public.email_reserve('invite', 2, 'blocked@example.test', 'Suppressed', 'platform');
select public.email_reserve('invite', 2, 'now@example.test', 'Sent right away', 'platform', p_send_now => true);

select is(
  (select count(*)::int from net.http_request_queue where url like 'http://drain.test/%'),
  3,
  'suppressed emails and ones sent right away don''t poke the drain'
);

delete from vault.secrets where name in ('email_drain_url', 'email_drain_secret', 'email_drain_host');
select public.email_reserve('invite', 2, 'later@example.test', 'Queued', 'platform');

select is(
  (select status::text from public.email_log where to_address = 'later@example.test'),
  'queued',
  'without the Vault settings, emails still queue'
);

select is(public.email_poke_drain(true), null, 'but nothing pokes the drain, not even the digest');

-- Nobody but the database pokes the drain or reads its secret.
select ok(
  not has_function_privilege('anon', 'public.email_poke_drain(boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.email_poke_drain(boolean)', 'execute')
  and not has_function_privilege('service_role', 'public.email_poke_drain(boolean)', 'execute'),
  'no API role can poke the drain'
);

set local role anon;
select throws_ok('select decrypted_secret from vault.decrypted_secrets', '42501', null, 'anon can''t read Vault');
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}', true
);
select throws_ok(
  'select decrypted_secret from vault.decrypted_secrets', '42501', null, 'an owner can''t read Vault'
);
select throws_ok('select secret from vault.secrets', '42501', null, 'or its encrypted secrets');
reset role;

select * from finish();
rollback;
