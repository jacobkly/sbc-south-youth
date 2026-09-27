-- The approval and payment RPCs: who can call them, what they check, what
-- they write, and the self-approval rule.
begin;

create extension if not exists pgtap with schema extensions;

select plan(50);

-- Fake people. New auth users get a member row from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'member@example.test', '{"full_name": "Test Member"}'),
  ('00000000-0000-4000-8000-00000000a004', 'other.admin@example.test', '{"full_name": "Other Admin"}'),
  ('00000000-0000-4000-8000-00000000a005', 'former@example.test', '{"full_name": "Former Admin"}');

update public.users set role = 'admin' where id in (
  '00000000-0000-4000-8000-00000000a001',
  '00000000-0000-4000-8000-00000000a004',
  '00000000-0000-4000-8000-00000000a005'
);
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a005';

-- b002 is the admin's own payee, for the self-approval rule.
insert into public.payees (id, full_name, user_id, linked_at) values
  ('00000000-0000-4000-8000-00000000b001', 'Test Payee', null, null),
  ('00000000-0000-4000-8000-00000000b002', 'Admin Payee', '00000000-0000-4000-8000-00000000a001', now());

-- c001 has no receipt yet. The rest use the no-receipt exception, so the
-- receipt rule passes.
insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description,
  status, submitted_at, no_receipt, no_receipt_reason
)
select
  r.id::uuid, r.payee_id::uuid, '00000000-0000-4000-8000-00000000a001', 'youth', 1000, '2026-01-10',
  'Fake Store', r.description, r.status::public.request_status,
  case when r.status = 'submitted' then now() end,
  r.id <> '00000000-0000-4000-8000-00000000c001',
  case when r.id <> '00000000-0000-4000-8000-00000000c001' then 'Lost it' end
from (values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001', 'Needs a receipt', 'draft'),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000b001', 'Approve and pay', 'draft'),
  ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000b002', 'Paid to the admin', 'draft'),
  ('00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-00000000b001', 'Paid before entry', 'draft'),
  ('00000000-0000-4000-8000-00000000c005', '00000000-0000-4000-8000-00000000b002', 'Admin paid before entry', 'draft'),
  ('00000000-0000-4000-8000-00000000c006', '00000000-0000-4000-8000-00000000b002', 'For the other admin', 'submitted'),
  ('00000000-0000-4000-8000-00000000c007', '00000000-0000-4000-8000-00000000b002', 'Blocked self-approval', 'draft')
) as r (id, payee_id, description, status);

-- Grants.
select ok(
  not has_function_privilege('anon', 'public.approve_request(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.record_as_paid(uuid, public.payment_method, text, timestamptz, text)', 'execute')
  and not has_function_privilege('anon', 'public.mark_paid(uuid, public.payment_method, text, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.unmark_paid(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.unapprove_request(uuid, text)', 'execute'),
  'anon can''t call the approval RPCs'
);

select ok(
  not has_function_privilege('authenticated', 'public.lock_request(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.assert_receipt_rule(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.require_note(text)', 'execute'),
  'signed-in users can''t call the shared helpers'
);

set local role authenticated;

-- As the viewer, a member, and a deactivated admin.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c002') $$,
  '42501', 'Only an admin can approve reimbursements.', 'a viewer can''t approve'
);
select throws_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c004', 'cash', null, now()) $$,
  '42501', 'Only an admin can record payments.', 'a viewer can''t record a payment'
);
select throws_ok(
  $$ select public.mark_paid('00000000-0000-4000-8000-00000000c002', 'cash') $$,
  '42501', 'Only an admin can mark reimbursements as paid.', 'a viewer can''t mark paid'
);
select throws_ok(
  $$ select public.unmark_paid('00000000-0000-4000-8000-00000000c002', 'Oops') $$,
  '42501', 'Only an admin can undo a payment.', 'a viewer can''t undo a payment'
);
select throws_ok(
  $$ select public.unapprove_request('00000000-0000-4000-8000-00000000c002', 'Oops') $$,
  '42501', 'Only an admin can unapprove reimbursements.', 'a viewer can''t unapprove'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c002') $$,
  '42501', 'Only an admin can approve reimbursements.', 'a member can''t approve'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c002') $$,
  '42501', 'Only an admin can approve reimbursements.', 'a deactivated admin can''t approve'
);

-- As the admin: approving.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-0000000fffff') $$,
  'P0002', 'That reimbursement doesn''t exist.', 'approving needs a real request'
);

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c001') $$,
  '23514',
  'Add at least one receipt, or mark it as having no receipt.',
  'a request with no receipt and no exception can''t be approved'
);

select throws_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c001', 'cash', null, now()) $$,
  '23514',
  'Add at least one receipt, or mark it as having no receipt.',
  'a request with no receipt and no exception can''t be recorded as paid'
);

reset role;
insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256)
values (
  '00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000c001',
  '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000d001.jpg',
  'receipt.jpg', 'image/jpeg', 1000, repeat('a', 64)
);
set local role authenticated;

select lives_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c001') $$,
  'a request with a receipt can be approved'
);

select lives_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c002', '   ') $$,
  'a draft can be approved directly'
);

select results_eq(
  $$ select status::text, approved_by, approved_at = now(), external_approver from public.reimbursement_requests
     where id = '00000000-0000-4000-8000-00000000c002' $$,
  $$ values ('approved', '00000000-0000-4000-8000-00000000a001'::uuid, true, null::text) $$,
  'approving records who and when, and a blank outside approver is saved as none'
);

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c002') $$,
  '55000', 'Only a draft or submitted reimbursement can be approved.', 'an approved request can''t be approved again'
);

-- Self-approval, with outside approvers allowed (the default).
select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c003') $$,
  '23514',
  'This reimbursement is paid to you, so enter the name of the person who approved it.',
  'approving your own reimbursement needs an outside approver'
);

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c003', '   ') $$,
  '23514',
  'This reimbursement is paid to you, so enter the name of the person who approved it.',
  'a blank outside approver doesn''t count'
);

select lives_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c003', '  Pastor Example ') $$,
  'an admin can approve their own reimbursement with an outside approver'
);

select is(
  (select external_approver from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c003'),
  'Pastor Example',
  'the outside approver''s name is trimmed'
);

-- As the other admin, approving the first admin's reimbursement.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c006') $$,
  'another admin can approve it without an outside approver'
);

-- As the admin: paying and undoing.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.mark_paid('00000000-0000-4000-8000-00000000c002', null) $$,
  '22023', 'Choose how it was paid.', 'marking paid needs a method'
);

select throws_ok(
  $$ select public.mark_paid('00000000-0000-4000-8000-00000000c002', 'cash', null, now() + interval '2 days') $$,
  '22023', 'The paid date can''t be in the future.', 'the paid date can''t be in the future'
);

select lives_ok(
  $$ select public.mark_paid('00000000-0000-4000-8000-00000000c002', 'check', '  1001  ') $$,
  'an admin can mark an approved request as paid'
);

select results_eq(
  $$ select status::text, paid_by, paid_at = now(), payment_method::text, payment_reference
     from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c002' $$,
  $$ values ('paid', '00000000-0000-4000-8000-00000000a001'::uuid, true, 'check', '1001') $$,
  'marking paid records who, when, how, and the trimmed reference'
);

select throws_ok(
  $$ select public.mark_paid('00000000-0000-4000-8000-00000000c002', 'cash') $$,
  '55000', 'Only an approved reimbursement can be marked as paid.', 'a paid request can''t be paid again'
);

select throws_ok(
  $$ select public.unmark_paid('00000000-0000-4000-8000-00000000c002', '   ') $$,
  '22023', 'Add a note explaining why.', 'undoing a payment needs a note'
);

select throws_ok(
  $$ select public.unmark_paid('00000000-0000-4000-8000-00000000c002', repeat('x', 1001)) $$,
  '22001', 'Keep the note under 1,000 characters.', 'the note is capped at 1,000 characters'
);

select lives_ok(
  $$ select public.unmark_paid('00000000-0000-4000-8000-00000000c002', '  Paid the wrong person.  ') $$,
  'an admin can undo a payment'
);

select results_eq(
  $$ select status::text, paid_by, paid_at, payment_method::text, payment_reference, admin_note
     from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c002' $$,
  $$ values ('approved', null::uuid, null::timestamptz, null::text, null::text, 'Paid the wrong person.') $$,
  'undoing a payment clears the payment and keeps the note'
);

select throws_ok(
  $$ select public.unmark_paid('00000000-0000-4000-8000-00000000c002', 'Again') $$,
  '55000', 'Only a paid reimbursement can be unmarked as paid.', 'only a paid request can be unmarked'
);

select throws_ok(
  $$ select public.unapprove_request('00000000-0000-4000-8000-00000000c002', '') $$,
  '22023', 'Add a note explaining why.', 'unapproving needs a note'
);

select lives_ok(
  $$ select public.unapprove_request('00000000-0000-4000-8000-00000000c002', 'Needs a second look.') $$,
  'an admin can unapprove'
);

select results_eq(
  $$ select status::text, approved_by, approved_at, external_approver, submitted_at = now(), admin_note
     from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c002' $$,
  $$ values ('submitted', null::uuid, null::timestamptz, null::text, true, 'Needs a second look.') $$,
  'unapproving sends it back to submitted, filling in submitted_at when it skipped that step'
);

select throws_ok(
  $$ select public.unapprove_request('00000000-0000-4000-8000-00000000c002', 'Again') $$,
  '55000', 'Only an approved reimbursement can be unapproved.', 'only an approved request can be unapproved'
);

-- Unapproving cleared the outside approver, so the rule applies again.
select lives_ok(
  $$ select public.unapprove_request('00000000-0000-4000-8000-00000000c003', 'Wrong approver.') $$,
  'an admin can unapprove their own reimbursement'
);

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c003') $$,
  '23514',
  'This reimbursement is paid to you, so enter the name of the person who approved it.',
  're-approving your own reimbursement needs an outside approver again'
);

-- Recording a payment made before the request was entered.
select throws_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c004', null, null, now()) $$,
  '22023', 'Choose how it was paid.', 'recording a payment needs a method'
);

select throws_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c004', 'cash', null, null) $$,
  '22023', 'Enter the date it was paid.', 'recording a payment needs a date'
);

select throws_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c004', 'cash', null, now() + interval '2 days') $$,
  '22023', 'The paid date can''t be in the future.', 'a recorded payment can''t be in the future'
);

select lives_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c004', 'cash_app', '', '2026-01-12 18:00:00+00') $$,
  'an admin can record a past payment on a draft'
);

select results_eq(
  $$ select status::text, approved_by, approved_at, paid_by, paid_at, payment_method::text, payment_reference
     from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c004' $$,
  $$ values (
       'paid', '00000000-0000-4000-8000-00000000a001'::uuid, '2026-01-12 18:00:00+00'::timestamptz,
       '00000000-0000-4000-8000-00000000a001'::uuid, '2026-01-12 18:00:00+00'::timestamptz, 'cash_app', null::text
     ) $$,
  'recording a payment approves it as of the payment date'
);

select throws_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c006', 'cash', null, now()) $$,
  '55000',
  'Only a draft can be recorded as paid. Use Mark paid for approved reimbursements.',
  'only a draft can be recorded as paid'
);

select throws_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c005', 'cash', null, now()) $$,
  '23514',
  'This reimbursement is paid to you, so enter the name of the person who approved it.',
  'recording your own payment needs an outside approver'
);

select lives_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c005', 'cash', null, now(), 'Pastor Example') $$,
  'recording your own payment works with an outside approver'
);

-- With outside approvers turned off.
update public.app_settings set allow_external_approval = false where id = 1;

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c007', 'Pastor Example') $$,
  '42501',
  'You can''t approve a reimbursement that''s paid to you. Another admin has to approve it.',
  'with outside approvers off, an admin can''t approve their own reimbursement'
);

select throws_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c007', 'cash', null, now(), 'Pastor Example') $$,
  '42501',
  'You can''t approve a reimbursement that''s paid to you. Another admin has to approve it.',
  'with outside approvers off, an admin can''t record their own payment'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c007') $$,
  'with outside approvers off, another admin can still approve it'
);

reset role;

select is(
  (select status::text from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c006'),
  'approved',
  'the other admin''s approval was saved'
);

select results_eq(
  $$ select status::text, approved_by from public.reimbursement_requests
     where id = '00000000-0000-4000-8000-00000000c007' $$,
  $$ values ('approved', '00000000-0000-4000-8000-00000000a004'::uuid) $$,
  'the blocked self-approval left it for the other admin'
);

select * from finish();
rollback;
