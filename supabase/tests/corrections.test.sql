-- Corrections: an owner with two-step sign-in fixes an approved or paid
-- request (its details, receipts, and on a paid one its payment) without
-- undoing anything. The status, approver, and payer stay, each correction
-- logs one entry with the reason, and no email goes out. Who it's paid to
-- never changes this way.
begin;

create extension if not exists pgtap with schema extensions;

select plan(49);

-- Fake people. New auth users get a row with no roles from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'requester@example.test', '{"full_name": "Test Requester"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set roles = '{finance_requester}' where id = '00000000-0000-4000-8000-00000000a003';

insert into public.payees (id, full_name, user_id, linked_at) values
  ('00000000-0000-4000-8000-00000000b001', 'Test Payee', null, null),
  ('00000000-0000-4000-8000-00000000b003', 'Test Requester', '00000000-0000-4000-8000-00000000a003', now());

-- c001 is approved, c002 and c008 are paid, and the rest are in every other
-- status. c008 is paid to the requester. Each gets its receipt and file while
-- it's still a draft, then moves on.
insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description
)
select
  ('00000000-0000-4000-8000-00000000' || r.suffix)::uuid,
  ('00000000-0000-4000-8000-00000000' || r.payee)::uuid,
  '00000000-0000-4000-8000-00000000a001',
  'youth', 1000, '2026-01-10', 'Fake Store', 'Request ' || r.suffix
from (values
  ('c001', 'b001'), ('c002', 'b001'), ('c003', 'b001'), ('c004', 'b001'),
  ('c005', 'b001'), ('c006', 'b001'), ('c007', 'b001'), ('c008', 'b003')
) as r (suffix, payee);

insert into public.request_lines (id, request_id, position, amount_cents, vendor)
select
  ('00000000-0000-4000-8000-00000000f' || s)::uuid, ('00000000-0000-4000-8000-00000000c' || s)::uuid,
  1, 1000, 'Fake Store'
from unnest(array['001', '002', '003', '004', '005', '006', '007', '008']) as s;

insert into public.receipts (id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256)
select
  ('00000000-0000-4000-8000-00000000d' || s)::uuid,
  ('00000000-0000-4000-8000-00000000c' || s)::uuid,
  ('00000000-0000-4000-8000-00000000f' || s)::uuid,
  '00000000-0000-4000-8000-00000000c' || s || '/00000000-0000-4000-8000-00000000d' || s || '.jpg',
  'receipt.jpg', 'image/jpeg', 1000, repeat('a', 64)
from unnest(array['001', '002', '008']) as s;

insert into storage.objects (bucket_id, name)
select 'receipts', rc.storage_path
from public.receipts rc
where rc.request_id in (
  '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c002',
  '00000000-0000-4000-8000-00000000c008'
);

update public.reimbursement_requests r
set status = v.status::public.request_status,
    submitted_at = case when v.status <> 'draft' then '2026-01-11 12:00-08'::timestamptz end,
    approved_by = case when v.status in ('approved', 'paid') then '00000000-0000-4000-8000-00000000a001'::uuid end,
    approved_at = case when v.status in ('approved', 'paid') then '2026-01-12 12:00-08'::timestamptz end,
    paid_by = case when v.status = 'paid' then '00000000-0000-4000-8000-00000000a001'::uuid end,
    paid_at = case when v.status = 'paid' then '2026-01-15 12:00-08'::timestamptz end,
    payment_method = case when v.status = 'paid' then 'cash'::public.payment_method end,
    payment_reference = case when v.status = 'paid' then 'Envelope 3' end
from (values
  ('c001', 'approved'),
  ('c002', 'paid'),
  ('c004', 'submitted'),
  ('c005', 'needs_info'),
  ('c006', 'rejected'),
  ('c007', 'cancelled'),
  ('c008', 'paid')
) as v (suffix, status)
where r.id = ('00000000-0000-4000-8000-00000000' || v.suffix)::uuid;

delete from public.email_log;

-- Grants.
select ok(
  has_function_privilege(
    'authenticated',
    'public.correct_request(uuid, public.reimbursement_type, date, text, text, boolean, text, jsonb, timestamptz, public.payment_method, text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.correct_request(uuid, public.reimbursement_type, date, text, text, boolean, text, jsonb, timestamptz, public.payment_method, text, text)',
    'execute'
  ),
  'signed-in users can call correct_request, anon can''t'
);

select ok(
  not exists (
    select 1 from pg_proc p
    where p.proname = 'correct_request' and 'p_payee_id' = any (p.proargnames)
  ),
  'there''s no way to change who a request is paid to with a correction'
);

-- Outside a correction, nothing opens an approved request's receipts, even
-- for the table owner.
select throws_ok(
  $$ update public.request_lines set amount_cents = 1 where id = '00000000-0000-4000-8000-00000000f001' $$,
  '55000', 'Receipts can''t change once a request is approved or closed.',
  'an approved request''s receipts still can''t change outside a correction'
);

-- As the owner with only a password. Files are deleted the way the Storage API does.
set local role authenticated;
select set_config('storage.allow_delete_query', 'true', true);
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal1"}',
  true
);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c001', 'youth', '2026-01-10', 'Fixed', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1000, "vendor": "Fake Store"}]',
       null, null, null, 'Typo'
     ) $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'an owner can''t correct a request with only a password'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000d102.jpg') $$,
  '42501', null, 'or upload a file to a paid request'
);

select throws_ok(
  $$ insert into public.receipts (
       id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256
     ) values (
       '00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-00000000c002',
       '00000000-0000-4000-8000-00000000f002',
       '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000d102.jpg',
       'receipt.jpg', 'image/jpeg', 1000, repeat('b', 64)
     ) $$,
  '42501', null, 'or add a receipt to it'
);

with removed as (
  delete from public.receipts where id = '00000000-0000-4000-8000-00000000d002' returning 1
)
select is(count(*)::int, 0, 'or remove a receipt from it') from removed;

-- As the viewer, with a code.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated", "aal": "aal2"}',
  true
);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c001', 'youth', '2026-01-10', 'Fixed', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1000, "vendor": "Fake Store"}]',
       null, null, null, 'Typo'
     ) $$,
  '42501', 'Only an owner can correct requests.',
  'a viewer can''t correct a request'
);

select throws_ok(
  $$ insert into public.receipts (
       id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256
     ) values (
       '00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-00000000c002',
       '00000000-0000-4000-8000-00000000f002',
       '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000d102.jpg',
       'receipt.jpg', 'image/jpeg', 1000, repeat('b', 64)
     ) $$,
  '42501', null, 'or add a receipt to a paid request'
);

-- As the requester, with a code, on the request paid to them.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated", "aal": "aal2"}',
  true
);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c008', 'youth', '2026-01-10', 'Fixed', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f008", "amount_cents": 1000, "vendor": "Fake Store"}]',
       '2026-01-15 12:00-08', 'cash', 'Envelope 3', 'Typo'
     ) $$,
  '42501', 'Only an owner can correct requests.',
  'a requester can''t correct their own paid request'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-00000000c008/00000000-0000-4000-8000-00000000d108.jpg') $$,
  '42501', null, 'or upload a file to it'
);

with removed as (
  delete from public.receipts where id = '00000000-0000-4000-8000-00000000d008' returning 1
)
select is(count(*)::int, 0, 'or remove its receipt') from removed;

-- Signed out.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c001', 'youth', '2026-01-10', 'Fixed', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1000, "vendor": "Fake Store"}]',
       null, null, null, 'Typo'
     ) $$,
  '42501', null,
  'anon can''t correct a request'
);

-- As the owner, with a code.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

-- Only approved and paid requests.
select throws_ok(
  format(
    $$ select public.correct_request(
         '00000000-0000-4000-8000-00000000%1$s', 'youth', '2026-01-10', 'Fixed', null, false, null,
         '[{"id": "00000000-0000-4000-8000-00000000f%2$s", "amount_cents": 1000, "vendor": "Fake Store"}]',
         null, null, null, 'Typo'
       ) $$,
    r.suffix, substr(r.suffix, 2)
  ),
  '55000', 'Only an approved or paid request can be corrected.',
  'a ' || r.status || ' request can''t be corrected'
)
from (values
  ('c003', 'draft'),
  ('c004', 'submitted'),
  ('c005', 'needs info'),
  ('c006', 'rejected'),
  ('c007', 'cancelled')
) as r (suffix, status);

-- The reason.
select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c001', 'youth', '2026-01-10', 'Fixed', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1000, "vendor": "Fake Store"}]',
       null, null, null, '   '
     ) $$,
  '22023', 'Say what was wrong.',
  'a correction needs a reason'
);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c001', 'youth', '2026-01-10', 'Fixed', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1000, "vendor": "Fake Store"}]',
       null, null, null, repeat('x', 1001)
     ) $$,
  '22001', 'Keep the reason to 1,000 characters or fewer.',
  'and a reason that fits'
);

-- The same rules as editing.
select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c001', 'youth',
       ((now() at time zone 'America/Los_Angeles')::date + 1), 'Fixed', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1000, "vendor": "Fake Store"}]',
       null, null, null, 'Wrong date'
     ) $$,
  '22023', 'The purchase date can''t be in the future.',
  'a correction can''t move the purchase date into the future'
);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c001', 'youth', '2026-01-10', 'Fixed', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 0, "vendor": "Fake Store"}]',
       null, null, null, 'Wrong amount'
     ) $$,
  '23514', 'Each receipt needs an amount more than $0.',
  'or set an amount of $0'
);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c001', 'youth', '2026-01-10', 'Fixed', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f101", "amount_cents": 1000, "vendor": "Fake Store"}]',
       null, null, null, 'Wrong receipt'
     ) $$,
  '55000', 'Remove a receipt''s files before removing the receipt.',
  'or take off a receipt that still has files'
);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c001', 'youth', '2026-01-10', 'Fixed', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1000, "vendor": "Fake Store"},
         {"id": "00000000-0000-4000-8000-00000000f003", "amount_cents": 500, "vendor": null}]',
       null, null, null, 'Wrong receipt'
     ) $$,
  '22023', 'That receipt is on another request.',
  'or take a receipt from another request'
);

-- Payments.
select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c001', 'youth', '2026-01-10', 'Fixed', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1000, "vendor": "Fake Store"}]',
       '2026-01-15 12:00-08', 'cash', null, 'Typo'
     ) $$,
  '22023', 'Only a paid request has a payment to correct.',
  'an approved request has no payment to correct'
);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c002', 'youth', '2026-01-10', 'Request c002', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1000, "vendor": "Fake Store"}]',
       '2026-01-15 12:00-08', null, 'Envelope 3', 'Typo'
     ) $$,
  '22023', 'Choose how it was paid.',
  'a paid request keeps how it was paid'
);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c002', 'youth', '2026-01-10', 'Request c002', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1000, "vendor": "Fake Store"}]',
       null, 'cash', 'Envelope 3', 'Typo'
     ) $$,
  '22023', 'Enter the date it was paid.',
  'and when it was paid'
);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c002', 'youth', '2026-01-10', 'Request c002', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1000, "vendor": "Fake Store"}]',
       now() + interval '2 days', 'cash', 'Envelope 3', 'Typo'
     ) $$,
  '22023', 'The paid date can''t be in the future.',
  'and the paid date can''t move into the future'
);

select throws_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c002', 'youth', '2026-01-10', 'Request c002', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1000, "vendor": "Fake Store"}]',
       '2026-01-15 12:00-08', 'cash', repeat('x', 201), 'Typo'
     ) $$,
  '22001', 'Keep the reference to 200 characters or fewer.',
  'and the reference has to fit'
);

-- Correcting an approved request: a new amount, date, and description, and a second receipt.
select lives_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c001', 'youth', '2026-01-09', 'Pizza for the lock-in', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1250, "vendor": "Fake Store"},
         {"id": "00000000-0000-4000-8000-00000000f101", "amount_cents": 500, "vendor": "Other Shop"}]',
       null, null, null, '  Forgot the second receipt  '
     ) $$,
  'an owner with a code corrects an approved request'
);

select results_eq(
  $$ select status::text, amount_cents, purchase_date, description, vendor, approved_by, approved_at
     from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c001' $$,
  $$ values (
    'approved', 1750, '2026-01-09'::date, 'Pizza for the lock-in', 'Fake Store, Other Shop',
    '00000000-0000-4000-8000-00000000a001'::uuid, '2026-01-12 12:00-08'::timestamptz
  ) $$,
  'the details change, and it stays approved by the same person at the same time'
);

select is(
  (select count(*)::int from public.request_lines where request_id = '00000000-0000-4000-8000-00000000c001'),
  2,
  'the new receipt is saved'
);

select results_eq(
  $$ select action, note, actor_id from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c001' and action in ('corrected', 'updated') $$,
  $$ values ('corrected', 'Forgot the second receipt', '00000000-0000-4000-8000-00000000a001'::uuid) $$,
  'it logs one corrected entry with the trimmed reason, and no separate edit'
);

select is(
  (
    select array_agg(k order by k)
    from public.request_events e, jsonb_object_keys(e.changes) as k
    where e.request_id = '00000000-0000-4000-8000-00000000c001' and e.action = 'corrected'
  ),
  array['amount_cents', 'description', 'lines', 'purchase_date', 'vendor'],
  'the entry has each change'
);

select is(
  (
    select changes -> 'amount_cents'
    from public.request_events
    where request_id = '00000000-0000-4000-8000-00000000c001' and action = 'corrected'
  ),
  '{"from": 1000, "to": 1750}'::jsonb,
  'with its old and new values'
);

select throws_ok(
  $$ select public.save_request(
       '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-09',
       'Edited', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1250, "vendor": "Fake Store"},
         {"id": "00000000-0000-4000-8000-00000000f101", "amount_cents": 500, "vendor": "Other Shop"}]'
     ) $$,
  '55000', 'This request can''t be edited anymore.',
  'afterwards it still can''t be edited without a correction'
);

-- Correcting a paid request's payment.
select lives_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c002', 'youth', '2026-01-10', 'Request c002', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1000, "vendor": "Fake Store"}]',
       '2026-01-16 12:00-08', 'check', '  Check 1042  ', 'Paid by check, not cash'
     ) $$,
  'an owner with a code corrects a paid request''s payment'
);

select results_eq(
  $$ select status::text, paid_at, payment_method::text, payment_reference, paid_by, approved_by
     from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c002' $$,
  $$ values (
    'paid', '2026-01-16 12:00-08'::timestamptz, 'check', 'Check 1042',
    '00000000-0000-4000-8000-00000000a001'::uuid, '00000000-0000-4000-8000-00000000a001'::uuid
  ) $$,
  'the payment changes, and it stays paid by the same person'
);

select is(
  (
    select array_agg(k order by k)
    from public.request_events e, jsonb_object_keys(e.changes) as k
    where e.request_id = '00000000-0000-4000-8000-00000000c002' and e.action = 'corrected'
  ),
  array['paid_at', 'payment_method', 'payment_reference'],
  'the entry has the payment changes'
);

-- Receipts on paid requests.
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000d102.jpg') $$,
  'an owner with a code can upload a file to a paid request'
);

select lives_ok(
  $$ insert into public.receipts (
       id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256
     ) values (
       '00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-00000000c002',
       '00000000-0000-4000-8000-00000000f002',
       '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000d102.jpg',
       'better-photo.jpg', 'image/jpeg', 1000, repeat('b', 64)
     ) $$,
  'and add it as a receipt'
);

with removed as (
  delete from public.receipts where id = '00000000-0000-4000-8000-00000000d002' returning 1
)
select is(count(*)::int, 1, 'and remove the old receipt') from removed;

with removed as (
  delete from storage.objects
  where bucket_id = 'receipts'
    and name = '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000d002.jpg'
  returning 1
)
select is(count(*)::int, 1, 'and delete its file') from removed;

select results_eq(
  $$ select action from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c002'
       and action like 'receipt_%'
       and actor_id = '00000000-0000-4000-8000-00000000a001'
     order by action $$,
  $$ values ('receipt_added'), ('receipt_removed') $$,
  'both are logged'
);

-- A correction that only changes receipts still records why.
select lives_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c002', 'youth', '2026-01-10', 'Request c002', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1000, "vendor": "Fake Store"}]',
       '2026-01-16 12:00-08', 'check', 'Check 1042', 'The photo was blurry'
     ) $$,
  'a correction with no changes to the details'
);

select results_eq(
  $$ select note, changes from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c002'
       and action = 'corrected'
       and note = 'The photo was blurry' $$,
  $$ values ('The photo was blurry', null::jsonb) $$,
  'logs the reason with no changes'
);

-- Turning on "No receipt on file" while correcting.
select lives_ok(
  $$ select public.correct_request(
       '00000000-0000-4000-8000-00000000c002', 'youth', '2026-01-10', 'Request c002', null, true, 'Lost it',
       '[{"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1000, "vendor": "Fake Store"}]',
       '2026-01-16 12:00-08', 'check', 'Check 1042', 'The receipt was lost'
     ) $$,
  'an owner can turn on no receipt on file while correcting'
);

select is(
  (select no_receipt from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c002'),
  true,
  'and it''s saved'
);

reset role;

select is(
  (
    select count(*)::int from public.email_log
    where related_id in ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c002')
  ),
  0,
  'corrections send no email'
);

select * from finish();
rollback;
