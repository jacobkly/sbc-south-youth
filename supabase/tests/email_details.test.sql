-- What the drain reads to write a queued email: only for an email it's
-- sending right now, only what that email shows, and only with the secret key.
begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- Fake people: two owners and a requester with their own payee.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'second@example.test', '{"full_name": "Second Person"}'),
  ('00000000-0000-4000-8000-00000000a003', 'requester@example.test', '{"full_name": "Test Requester"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{finance_requester}' where id in (
  '00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000a003'
);
update public.users set is_active = false where id not in (
  '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a002',
  '00000000-0000-4000-8000-00000000a003'
);

insert into public.payees (id, full_name, user_id, linked_at) values
  ('00000000-0000-4000-8000-00000000b003', 'Test Requester', '00000000-0000-4000-8000-00000000a003', now());

insert into public.reimbursement_requests (
  id, request_number, payee_id, created_by, type, amount_cents, purchase_date, vendor, description, status,
  no_receipt, no_receipt_reason
) overriding system value values (
  '00000000-0000-4000-8000-00000000c001', 9901, '00000000-0000-4000-8000-00000000b003',
  '00000000-0000-4000-8000-00000000a003', 'youth', 4550, '2026-09-20', 'Fake Store', 'Snacks for game night',
  'draft', true, 'Lost it'
), (
  '00000000-0000-4000-8000-00000000c002', 9902, '00000000-0000-4000-8000-00000000b003',
  '00000000-0000-4000-8000-00000000a001', 'youth', 1200, '2026-09-21', 'Fake Market', 'Cups', 'draft', true,
  'Lost it'
);

insert into public.request_lines (id, request_id, position, amount_cents, vendor) values
  ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000c001', 1, 4550, 'Fake Store'),
  ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000c002', 1, 1200, 'Fake Market');

-- No pokes, and an outbox with only what this test queues.
delete from vault.secrets where name in ('email_drain_url', 'email_drain_secret', 'email_drain_host');
delete from public.email_log;

-- The requester submits.
set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true
);
select public.submit_request('00000000-0000-4000-8000-00000000c001');
reset role;

select is(
  public.email_details((select id from public.email_log where template = 'request-submitted')),
  null,
  'a queued email has no details until the drain sends it'
);

select count(*) from public.email_claim('production', 50);

select is(
  public.email_details((select id from public.email_log where template = 'request-submitted')),
  '{"number": "R-9901", "amount_cents": 4550, "vendor": "Fake Store", "by": "Test Requester",
    "payee": "Test Requester", "by_payee": true, "description": "Snacks for game night", "note": null,
    "payment_method": null, "paid_at": null}'::jsonb,
  'a submitted request shows who sent what, for whom'
);

-- One transaction is one moment, so move what happened so far into the past.
update public.request_events set created_at = created_at - interval '1 hour';
update public.email_log set created_at = created_at - interval '1 hour', status = 'sent', resend_id = 're_test_1';

select is(
  public.email_details((select id from public.email_log where template = 'request-submitted')),
  null,
  'a sent email has no details'
);

-- An owner asks for more info.
set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}', true
);
select public.request_info('00000000-0000-4000-8000-00000000c001', 'Which event was this for?');
reset role;

select count(*) from public.email_claim('production', 50);

select is(
  public.email_details((select id from public.email_log where template = 'request-returned')),
  '{"number": "R-9901", "amount_cents": 4550, "vendor": "Fake Store", "by": "Test Owner", "payee": null,
    "by_payee": null, "description": null, "note": "Which event was this for?", "payment_method": null,
    "paid_at": null}'::jsonb,
  'a returned request shows who asked and what they asked'
);

-- The requester resubmits, and an owner approves and pays.
update public.request_events set created_at = created_at - interval '1 hour';
update public.email_log set created_at = created_at - interval '1 hour', status = 'sent',
  resend_id = coalesce(resend_id, 're_test_2');

set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true
);
select public.submit_request('00000000-0000-4000-8000-00000000c001');
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}', true
);
select public.approve_request('00000000-0000-4000-8000-00000000c001', null);
select public.mark_paid('00000000-0000-4000-8000-00000000c001', 'cash_app', null, '2026-09-30 19:00:00+00');
reset role;

select count(*) from public.email_claim('production', 50);

select is(
  public.email_details((select id from public.email_log where template = 'request-paid')) - 'paid_at',
  '{"number": "R-9901", "amount_cents": 4550, "vendor": "Fake Store", "by": "Test Owner", "payee": null,
    "by_payee": null, "description": null, "note": null, "payment_method": "cash_app"}'::jsonb,
  'a paid request shows how it was paid'
);

select is(
  (public.email_details((select id from public.email_log where template = 'request-paid')) ->> 'paid_at')::timestamptz,
  '2026-09-30 19:00:00+00'::timestamptz,
  'and when'
);

select is(
  public.email_details((select id from public.email_log where subject = 'R-9901 was resubmitted')) ->> 'payee',
  'Test Requester',
  'a resubmitted request shows its details too'
);

-- An owner makes someone an owner.
update public.activity_log set created_at = created_at - interval '1 hour';

set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}', true
);
select public.set_roles('00000000-0000-4000-8000-00000000a002', '{finance_requester,owner}');
reset role;

select count(*) from public.email_claim('production', 50);

select is(
  public.email_details((select id from public.email_log where template = 'owner-changed' limit 1)),
  '{"name": "Second Person", "by": "Test Owner"}'::jsonb,
  'an owner change shows who changed and who changed it'
);

-- An owner sends a request for the requester, which the new owner hears about.
set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}', true
);
select public.submit_request('00000000-0000-4000-8000-00000000c002');
reset role;

select count(*) from public.email_claim('production', 50);

select is(
  public.email_details((
    select id from public.email_log
    where template = 'request-submitted' and related_id = '00000000-0000-4000-8000-00000000c002'
  )) - 'description' - 'note' - 'payment_method' - 'paid_at',
  '{"number": "R-9902", "amount_cents": 1200, "vendor": "Fake Market", "by": "Test Owner",
    "payee": "Test Requester", "by_payee": false}'::jsonb,
  'a request an owner sent for someone else says so'
);

-- Someone sends the Contact form, and a parent asks to take down a photo.
set local role service_role;
select site.submit_message(
  'contact',
  '{"name": "Maya  Example", "email": "maya@example.test", "phone": "555-555-0123", "role": "student",
    "message": "Is there youth this Friday?"}',
  repeat('a', 64),
  'production',
  'youth@example.test'
);
select site.submit_message(
  'takedown',
  '{"name": "Pat Example", "email": "pat@example.test", "role": "parent", "message": "Please take down a photo."}',
  repeat('b', 64),
  'staging',
  'owner@example.test'
);
reset role;

select is(
  public.email_details((select id from public.email_log where template = 'form-alert' and env = 'production')),
  null,
  'a queued form alert has no details until the drain sends it'
);

select count(*) from public.email_claim('production', 50);
select count(*) from public.email_claim('staging', 50);

select is(
  public.email_details((select id from public.email_log where template = 'form-alert' and env = 'production')),
  '{"kind": "contact", "name": "Maya  Example", "email": "maya@example.test", "phone": "555-555-0123",
    "message": "Is there youth this Friday?", "details": {"role": "student"}, "env": "production"}'::jsonb,
  'a form alert shows the whole message, so a leader can answer it from the email'
);

select is(
  public.email_details((select id from public.email_log where template = 'form-alert' and env = 'staging')),
  '{"kind": "takedown", "name": "Pat Example", "email": "pat@example.test", "phone": null,
    "message": "Please take down a photo.", "details": {"role": "parent"}, "env": "staging"}'::jsonb,
  'a takedown request shows its kind, and a staging one says so'
);

-- A message deleted while its alert waits has nothing left to show.
delete from site.messages where kind = 'contact';

select is(
  public.email_details((select id from public.email_log where template = 'form-alert' and env = 'production')),
  null,
  'a form alert whose message is gone has no details'
);

-- Emails the drain doesn't write get nothing, even while sending.
insert into public.email_log (id, template, priority, to_address, subject, scope, related_type, related_id, status)
values
  ('00000000-0000-4000-8000-00000000e001', 'invite', 2, 'someone@example.test', 'An invite', 'platform', 'invite',
   '00000000-0000-4000-8000-00000000c001', 'sending'),
  ('00000000-0000-4000-8000-00000000e002', 'request-paid', 3, 'someone@example.test', 'Paid', 'finances', 'user',
   '00000000-0000-4000-8000-00000000a001', 'sending'),
  ('00000000-0000-4000-8000-00000000e003', 'request-paid', 3, 'someone@example.test', 'Paid', 'finances', null,
   null, 'sending'),
  ('00000000-0000-4000-8000-00000000e004', 'request-paid', 3, 'someone@example.test', 'Paid', 'finances', 'message',
   (select id from site.messages where kind = 'takedown'), 'sending');

select is(public.email_details('00000000-0000-4000-8000-00000000e001'), null, 'an invite has no details');
select is(
  public.email_details('00000000-0000-4000-8000-00000000e002'), null, 'a request template about a person has none'
);
select is(public.email_details('00000000-0000-4000-8000-00000000e003'), null, 'nor does an email about nothing');
select is(
  public.email_details('00000000-0000-4000-8000-00000000e004'), null, 'nor does another template about a message'
);
select is(public.email_details(gen_random_uuid()), null, 'nor does an email that doesn''t exist');

select ok(
  not has_function_privilege('anon', 'public.email_details(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.email_details(uuid)', 'execute'),
  'no one signed in or out can read email details'
);
select ok(has_function_privilege('service_role', 'public.email_details(uuid)', 'execute'), 'the secret key can');

select * from finish();
rollback;
