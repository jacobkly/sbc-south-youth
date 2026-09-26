-- Reimbursement requests: who can read and write them, the columns clients
-- can touch, and the checks the guard trigger and constraints enforce.
begin;

create extension if not exists pgtap with schema extensions;

select plan(45);

-- Fake people. New auth users get a member row from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'member@example.test', '{"full_name": "Test Member"}'),
  ('00000000-0000-4000-8000-00000000a004', 'other.admin@example.test', '{"full_name": "Other Admin"}');

update public.users set role = 'admin' where id in (
  '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a004'
);
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a002';

-- The member's payee is linked, so the test shows a link alone grants no access.
insert into public.payees (id, full_name, user_id, linked_at) values
  ('00000000-0000-4000-8000-00000000b001', 'Test Payee', null, null),
  ('00000000-0000-4000-8000-00000000b002', 'Member Payee', '00000000-0000-4000-8000-00000000a003', now());

-- One request in each state the policies care about. c002 was entered by the
-- other admin.
insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description,
  status, approved_by, approved_at, paid_at, paid_by, payment_method, updated_at
) values
  (
    '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001',
    '00000000-0000-4000-8000-00000000a001', 'youth', 1000, '2026-01-10', 'Fake Store', 'Draft',
    'draft', null, null, null, null, null, '2026-01-10'
  ),
  (
    '00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000b001',
    '00000000-0000-4000-8000-00000000a004', 'youth', 1100, '2026-01-10', 'Fake Store', 'Other admin''s draft',
    'draft', null, null, null, null, null, '2026-01-10'
  ),
  (
    '00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000b002',
    '00000000-0000-4000-8000-00000000a001', 'cafe', 1200, '2026-01-10', 'Fake Store', 'Submitted',
    'submitted', null, null, null, null, null, '2026-01-10'
  ),
  (
    '00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-00000000b001',
    '00000000-0000-4000-8000-00000000a001', 'cafe', 1300, '2026-01-10', 'Fake Store', 'Approved',
    'approved', '00000000-0000-4000-8000-00000000a001', '2026-01-11', null, null, null, '2026-01-10'
  ),
  (
    '00000000-0000-4000-8000-00000000c005', '00000000-0000-4000-8000-00000000b001',
    '00000000-0000-4000-8000-00000000a001', 'youth', 1400, '2026-01-10', 'Fake Store', 'Paid',
    'paid', '00000000-0000-4000-8000-00000000a001', '2026-01-11', '2026-01-12',
    '00000000-0000-4000-8000-00000000a001', 'check', '2026-01-10'
  );

-- Grants.
select ok(
  not has_table_privilege('anon', 'public.reimbursement_requests', 'select'),
  'anon can''t read requests'
);
select ok(
  not has_column_privilege('authenticated', 'public.reimbursement_requests', 'status', 'update'),
  'status can''t be changed with a direct update'
);
select ok(
  not has_column_privilege('authenticated', 'public.reimbursement_requests', 'approved_by', 'update')
  and not has_column_privilege('authenticated', 'public.reimbursement_requests', 'paid_at', 'update')
  and not has_column_privilege('authenticated', 'public.reimbursement_requests', 'admin_note', 'update'),
  'approval, payment, and note columns can''t be changed with a direct update'
);
select ok(
  not has_column_privilege('authenticated', 'public.reimbursement_requests', 'created_by', 'insert')
  and not has_column_privilege('authenticated', 'public.reimbursement_requests', 'status', 'insert'),
  'created_by and status can''t be set on insert'
);
select ok(
  not has_function_privilege('authenticated', 'public.guard_reimbursement_request()', 'execute'),
  'signed-in users can''t call the guard trigger function'
);

-- The guard trigger, as the table owner.
select throws_ok(
  $$ update public.reimbursement_requests set paid_at = now() + interval '2 days'
     where id = '00000000-0000-4000-8000-00000000c005' $$,
  '22023',
  'The paid date can''t be in the future.',
  'a paid date can''t be in the future'
);

select throws_ok(
  $$ update public.reimbursement_requests set payment_method = null
     where id = '00000000-0000-4000-8000-00000000c005' $$,
  '23514',
  null,
  'a paid request keeps its payment details'
);

set local role authenticated;

-- As a member with a linked payee.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.reimbursement_requests
     where payee_id in ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000b002') $$,
  'a member can''t read requests, even their own'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (payee_id, type, amount_cents, purchase_date, vendor, description)
     values ('00000000-0000-4000-8000-00000000b002', 'youth', 500, '2026-01-10', 'Fake Store', 'Member made') $$,
  '42501',
  null,
  'a member can''t create requests'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (
       payee_id, type, amount_cents, purchase_date, vendor, description, no_receipt, no_receipt_reason
     ) values (
       '00000000-0000-4000-8000-00000000b002', 'youth', 500, '2026-01-10', 'Fake Store', 'Member made', true, 'Lost it'
     ) $$,
  '42501',
  'Only an admin can mark a request as having no receipt.',
  'a member can''t claim the no-receipt exception'
);

with changed as (
  update public.reimbursement_requests set description = 'Member edit'
  where id = '00000000-0000-4000-8000-00000000c003'
  returning 1
)
select is(count(*)::int, 0, 'a member can''t edit their own request') from changed;

with removed as (
  delete from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c001' returning 1
)
select is(count(*)::int, 0, 'a member can''t delete requests') from removed;

-- As the viewer.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select results_eq(
  $$ select id from public.reimbursement_requests
     where payee_id in ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000b002')
     order by id $$,
  $$ values
       ('00000000-0000-4000-8000-00000000c003'::uuid),
       ('00000000-0000-4000-8000-00000000c004'::uuid),
       ('00000000-0000-4000-8000-00000000c005'::uuid) $$,
  'a viewer reads everything but drafts'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (payee_id, type, amount_cents, purchase_date, vendor, description)
     values ('00000000-0000-4000-8000-00000000b001', 'youth', 500, '2026-01-10', 'Fake Store', 'Viewer made') $$,
  '42501',
  null,
  'a viewer can''t create requests'
);

with changed as (
  update public.reimbursement_requests set description = 'Viewer edit'
  where id = '00000000-0000-4000-8000-00000000c003'
  returning 1
)
select is(count(*)::int, 0, 'a viewer can''t edit requests') from changed;

with removed as (
  delete from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c003' returning 1
)
select is(count(*)::int, 0, 'a viewer can''t delete requests') from removed;

-- As the admin.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.reimbursement_requests
   where payee_id in ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000b002')),
  5,
  'an admin reads every request, drafts included'
);

select lives_ok(
  $$ insert into public.reimbursement_requests (payee_id, type, amount_cents, purchase_date, vendor, description)
     values (
       '00000000-0000-4000-8000-00000000b001', 'cafe', 725,
       (now() at time zone 'America/Los_Angeles')::date, 'Fake Store', 'Bought today'
     ) $$,
  'an admin can create a request dated today in LA'
);

select results_eq(
  $$ select status::text, created_by, request_number is not null from public.reimbursement_requests
     where description = 'Bought today' $$,
  $$ values ('draft', '00000000-0000-4000-8000-00000000a001'::uuid, true) $$,
  'a new request is a draft, entered by the caller, with a number'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (payee_id, type, amount_cents, purchase_date, vendor, description)
     values (
       '00000000-0000-4000-8000-00000000b001', 'cafe', 725,
       (now() at time zone 'America/Los_Angeles')::date + 1, 'Fake Store', 'Bought tomorrow'
     ) $$,
  '22023',
  'The purchase date can''t be in the future.',
  'the purchase date can''t be after today in LA'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (payee_id, type, amount_cents, purchase_date, vendor, description)
     values ('00000000-0000-4000-8000-00000000b001', 'cafe', 725, '1999-12-31', 'Fake Store', 'Too old') $$,
  '23514',
  null,
  'the purchase date can''t be before 2000'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (payee_id, type, amount_cents, purchase_date, vendor, description)
     values ('00000000-0000-4000-8000-00000000b001', 'cafe', 0, '2026-01-10', 'Fake Store', 'Free') $$,
  '23514',
  null,
  'the amount must be more than zero'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (payee_id, type, amount_cents, purchase_date, vendor, description)
     values ('00000000-0000-4000-8000-00000000b001', 'cafe', 100000001, '2026-01-10', 'Fake Store', 'Huge') $$,
  '23514',
  null,
  'the amount is capped at $1,000,000'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (payee_id, type, amount_cents, purchase_date, vendor, description)
     values ('00000000-0000-4000-8000-00000000b001', 'cafe', 500, '2026-01-10', '   ', 'No vendor') $$,
  '23514',
  null,
  'a vendor can''t be only spaces'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (payee_id, type, amount_cents, purchase_date, vendor, description)
     values ('00000000-0000-4000-8000-00000000b001', 'cafe', 500, '2026-01-10', 'Fake Store', '') $$,
  '23514',
  null,
  'a description can''t be blank'
);

select lives_ok(
  $$ insert into public.reimbursement_requests (
       payee_id, type, amount_cents, purchase_date, no_receipt, no_receipt_reason
     ) values ('00000000-0000-4000-8000-00000000b001', 'youth', 432, '2026-01-10', true, 'Lost it') $$,
  'a request can leave out the vendor and description'
);

select lives_ok(
  $$ select public.record_as_paid(
       (select id from public.reimbursement_requests where amount_cents = 432), 'cash', null, now()
     ) $$,
  'a request without a vendor or description can still be paid'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (
       payee_id, type, amount_cents, purchase_date, vendor, description, no_receipt
     ) values ('00000000-0000-4000-8000-00000000b001', 'cafe', 500, '2026-01-10', 'Fake Store', 'No reason', true) $$,
  '23514',
  null,
  'the no-receipt exception needs a reason'
);

select lives_ok(
  $$ insert into public.reimbursement_requests (
       payee_id, type, amount_cents, purchase_date, vendor, description, no_receipt, no_receipt_reason
     ) values (
       '00000000-0000-4000-8000-00000000b001', 'cafe', 500, '2026-01-10', 'Fake Store', 'Lost receipt', true, 'Lost it'
     ) $$,
  'an admin can use the no-receipt exception with a reason'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (
       payee_id, created_by, type, amount_cents, purchase_date, vendor, description
     ) values (
       '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a004',
       'cafe', 500, '2026-01-10', 'Fake Store', 'Someone else'
     ) $$,
  '42501',
  null,
  'an admin can''t enter a request as someone else'
);

select throws_ok(
  $$ insert into public.reimbursement_requests (payee_id, type, amount_cents, purchase_date, vendor, description, status)
     values ('00000000-0000-4000-8000-00000000b001', 'cafe', 500, '2026-01-10', 'Fake Store', 'Pre-approved', 'approved') $$,
  '42501',
  null,
  'an admin can''t create a request in another status'
);

with changed as (
  update public.reimbursement_requests set vendor = 'Other Store', amount_cents = 1050
  where id = '00000000-0000-4000-8000-00000000c001'
  returning 1
)
select is(count(*)::int, 1, 'an admin can edit a draft') from changed;

with changed as (
  update public.reimbursement_requests set description = 'Clarified'
  where id = '00000000-0000-4000-8000-00000000c003'
  returning 1
)
select is(count(*)::int, 1, 'an admin can edit a submitted request') from changed;

with changed as (
  update public.reimbursement_requests set description = 'Too late'
  where id = '00000000-0000-4000-8000-00000000c004'
  returning 1
)
select is(count(*)::int, 0, 'an approved request is locked') from changed;

with changed as (
  update public.reimbursement_requests set amount_cents = 1
  where id = '00000000-0000-4000-8000-00000000c005'
  returning 1
)
select is(count(*)::int, 0, 'a paid request is locked') from changed;

select throws_ok(
  $$ update public.reimbursement_requests set status = 'approved'
     where id = '00000000-0000-4000-8000-00000000c001' $$,
  '42501',
  null,
  'an admin can''t change the status directly'
);

select throws_ok(
  $$ update public.reimbursement_requests set paid_at = now()
     where id = '00000000-0000-4000-8000-00000000c001' $$,
  '42501',
  null,
  'an admin can''t set payment details directly'
);

select throws_ok(
  $$ update public.reimbursement_requests
     set purchase_date = (now() at time zone 'America/Los_Angeles')::date + 1
     where id = '00000000-0000-4000-8000-00000000c001' $$,
  '22023',
  'The purchase date can''t be in the future.',
  'an edit can''t move the purchase date into the future'
);

select throws_ok(
  $$ update public.reimbursement_requests
     set no_receipt = true, no_receipt_reason = '  '
     where id = '00000000-0000-4000-8000-00000000c001' $$,
  '23514',
  null,
  'an edit can''t leave the no-receipt reason blank'
);

with removed as (
  delete from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c002' returning 1
)
select is(count(*)::int, 0, 'an admin can''t delete another admin''s draft') from removed;

with removed as (
  delete from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c003' returning 1
)
select is(count(*)::int, 0, 'an admin can''t delete a submitted request') from removed;

with removed as (
  delete from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c001' returning 1
)
select is(count(*)::int, 1, 'an admin can delete their own draft') from removed;

reset role;

select is(
  (select updated_at from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c003'),
  now(),
  'an edit bumps updated_at'
);

select is(
  (select description from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c004'),
  'Approved',
  'the blocked edit left the approved request alone'
);

select is(
  (select count(*)::int from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c002'),
  1,
  'the other admin''s draft is still there'
);

select * from finish();
rollback;
