-- Two-step sign-in in the database: changing who has access, and approving
-- or paying requests, need a session that has entered an authenticator code
-- (aal2). Reading doesn't.
begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

-- Fake people. New auth users get a row with no roles from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'requester@example.test', '{"full_name": "Test Requester"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set roles = '{finance_requester}' where id = '00000000-0000-4000-8000-00000000a003';

insert into public.payees (id, full_name) values ('00000000-0000-4000-8000-00000000b001', 'Test Payee');

-- Both use the no-receipt exception, so the receipt rule passes.
insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description,
  status, no_receipt, no_receipt_reason
) values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001',
    '00000000-0000-4000-8000-00000000a001', 'youth', 1000, '2026-01-10', 'Fake Store', 'Approve and pay',
    'draft', true, 'Lost it'),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000b001',
    '00000000-0000-4000-8000-00000000a001', 'youth', 2000, '2026-01-11', 'Fake Store', 'Paid before entry',
    'draft', true, 'Lost it');

select ok(
  not has_function_privilege('anon', 'public.require_aal2()', 'execute')
  and not has_function_privilege('authenticated', 'public.require_aal2()', 'execute'),
  'nobody can call the aal2 check directly'
);

set local role authenticated;

-- The owner, signed in with only a password.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal1"}',
  true
);

select is(
  (
    select count(*)::integer from public.reimbursement_requests
    where id in ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c002')
  ),
  2,
  'an owner reads requests with only a password'
);

select throws_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a003', '{finance_requester,site_editor}') $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'an owner can''t change roles with only a password'
);
select throws_ok(
  $$ select public.set_member_role('00000000-0000-4000-8000-00000000a003', 'viewer') $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'or through the older role function'
);
select throws_ok(
  $$ select public.remove_access('00000000-0000-4000-8000-00000000a003') $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'or remove access'
);
select throws_ok(
  $$ select public.reinstate('00000000-0000-4000-8000-00000000a003') $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'or reinstate someone'
);
select throws_ok(
  $$ select public.set_member_active('00000000-0000-4000-8000-00000000a003', false) $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'or deactivate someone through the older function'
);
select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c001') $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'or approve a request'
);
select throws_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c002', 'cash', null, now()) $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'or record a payment'
);
select throws_ok(
  $$ select public.import_paid_requests(
       '[{"line": 2, "date": "2026-01-15", "name": "Test Payee", "amount_cents": 1000, "type": "youth", "notes": ""}]',
       'cash_app'
     ) $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'or import paid requests'
);

-- A session with no aal claim at all is treated the same.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}',
  true
);

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c001') $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'a session without an aal claim can''t approve'
);

-- Someone without the role hears about the role, not the code.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated", "aal": "aal2"}',
  true
);

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c001') $$,
  '42501', 'Only an admin can approve requests.',
  'a viewer with a code still can''t approve'
);
select throws_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a003', '{finance_requester,site_editor}') $$,
  '42501', 'Only an owner can change roles.',
  'or change roles'
);

-- The owner, after entering a code.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select lives_ok(
  $$ select public.set_roles('00000000-0000-4000-8000-00000000a003', '{finance_requester,site_editor}') $$,
  'an owner with a code changes roles'
);
select lives_ok(
  $$ select public.set_member_role('00000000-0000-4000-8000-00000000a003', 'viewer') $$,
  'through the older role function too'
);
select lives_ok(
  $$ select public.remove_access('00000000-0000-4000-8000-00000000a003') $$,
  'removes access'
);
select lives_ok(
  $$ select public.reinstate('00000000-0000-4000-8000-00000000a003') $$,
  'reinstates'
);
select lives_ok(
  $$ select public.set_member_active('00000000-0000-4000-8000-00000000a003', false) $$,
  'deactivates through the older function'
);
select lives_ok(
  $$ select public.set_member_active('00000000-0000-4000-8000-00000000a003', true) $$,
  'and reactivates'
);
select lives_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c001') $$,
  'approves a request'
);

-- Undoing an approval or a payment needs a code too.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal1"}',
  true
);

select throws_ok(
  $$ select public.unapprove_request('00000000-0000-4000-8000-00000000c001', 'Wrong amount') $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'an owner can''t unapprove with only a password'
);
select throws_ok(
  $$ select public.mark_paid('00000000-0000-4000-8000-00000000c001', 'cash_app') $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'or mark a request paid'
);

select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select lives_ok(
  $$ select public.mark_paid('00000000-0000-4000-8000-00000000c001', 'cash_app') $$,
  'an owner with a code marks it paid'
);

select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal1"}',
  true
);

select throws_ok(
  $$ select public.unmark_paid('00000000-0000-4000-8000-00000000c001', 'Paid twice') $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'an owner can''t undo a payment with only a password'
);

select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select lives_ok(
  $$ select public.unmark_paid('00000000-0000-4000-8000-00000000c001', 'Paid twice') $$,
  'undoes a payment with a code'
);
select lives_ok(
  $$ select public.unapprove_request('00000000-0000-4000-8000-00000000c001', 'Wrong amount') $$,
  'unapproves with a code'
);
select lives_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c002', 'cash', null, now()) $$,
  'records a payment'
);
select lives_ok(
  $$ select public.import_paid_requests(
       '[{"line": 2, "date": "2026-01-15", "name": "Test Payee", "amount_cents": 1000, "type": "youth", "notes": ""}]',
       'cash_app'
     ) $$,
  'imports paid requests'
);

reset role;

-- The rows only changed once each call had a code.
select is(
  (select roles from public.users where id = '00000000-0000-4000-8000-00000000a003'),
  '{finance_viewer,finance_requester,site_editor}'::public.app_role[],
  'the requester got site editor, then finance viewer from the older function'
);
select is(
  (select is_active from public.users where id = '00000000-0000-4000-8000-00000000a003'),
  true,
  'and they''re active'
);
select results_eq(
  $$ select id::text, status::text from public.reimbursement_requests
     where id in ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c002')
     order by id $$,
  $$ values ('00000000-0000-4000-8000-00000000c001', 'submitted'),
            ('00000000-0000-4000-8000-00000000c002', 'paid') $$,
  'the requests ended where the calls with a code left them'
);

select * from finish();
rollback;
