-- The review RPCs (submit, request info, reject, cancel), then every status
-- RPC against every status, so no transition outside the lifecycle is allowed.
begin;

create extension if not exists pgtap with schema extensions;

select plan(91);

-- Fake people. New auth users get a member row from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'member@example.test', '{"full_name": "Test Member"}'),
  ('00000000-0000-4000-8000-00000000a004', 'other.admin@example.test', '{"full_name": "Other Admin"}'),
  ('00000000-0000-4000-8000-00000000a005', 'former@example.test', '{"full_name": "Former Member"}');

update public.users set role = 'admin' where id in (
  '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a004'
);
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a005';

-- b002 is the member's payee, for the member paths kept for self-service.
insert into public.payees (id, full_name, user_id, linked_at) values
  ('00000000-0000-4000-8000-00000000b001', 'Test Payee', null, null),
  ('00000000-0000-4000-8000-00000000b002', 'Member Payee', '00000000-0000-4000-8000-00000000a003', now());

-- Requests for the review loop (c0xx), for refused transitions (c1xx, one per
-- status), and for allowed transitions (c2xx, one per transition). All were
-- entered by the admin. All but c001 use the no-receipt exception, so the
-- receipt rule passes.
insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description, status,
  submitted_at, approved_by, approved_at, paid_by, paid_at, payment_method, no_receipt, no_receipt_reason
)
select
  ('00000000-0000-4000-8000-00000000' || r.suffix)::uuid,
  ('00000000-0000-4000-8000-00000000' || r.payee)::uuid,
  '00000000-0000-4000-8000-00000000a001', 'youth', 1000, '2026-01-10', 'Fake Store', 'Request ' || r.suffix,
  r.status::public.request_status,
  case when r.status <> 'draft' then now() end,
  case when r.status in ('approved', 'paid') then '00000000-0000-4000-8000-00000000a001'::uuid end,
  case when r.status in ('approved', 'paid') then now() end,
  case when r.status = 'paid' then '00000000-0000-4000-8000-00000000a001'::uuid end,
  case when r.status = 'paid' then now() end,
  case when r.status = 'paid' then 'cash'::public.payment_method end,
  r.suffix <> 'c001',
  case when r.suffix <> 'c001' then 'Lost it' end
from (values
  ('c001', 'b001', 'draft'),
  ('c002', 'b001', 'draft'),
  ('c003', 'b001', 'submitted'),
  ('c004', 'b001', 'submitted'),
  ('c005', 'b002', 'draft'),
  ('c006', 'b001', 'draft'),
  ('c101', 'b001', 'draft'),
  ('c102', 'b001', 'submitted'),
  ('c103', 'b001', 'needs_info'),
  ('c104', 'b001', 'approved'),
  ('c105', 'b001', 'paid'),
  ('c106', 'b001', 'rejected'),
  ('c107', 'b001', 'cancelled'),
  ('c201', 'b001', 'draft'),
  ('c202', 'b001', 'submitted'),
  ('c203', 'b001', 'draft'),
  ('c204', 'b001', 'approved'),
  ('c205', 'b001', 'paid'),
  ('c206', 'b001', 'approved'),
  ('c207', 'b001', 'draft'),
  ('c208', 'b001', 'needs_info'),
  ('c209', 'b001', 'submitted'),
  ('c210', 'b001', 'submitted'),
  ('c211', 'b001', 'needs_info'),
  ('c212', 'b001', 'submitted'),
  ('c213', 'b001', 'needs_info')
) as r (suffix, payee, status);

-- Grants.
select ok(
  not has_function_privilege('anon', 'public.submit_request(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.request_info(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.reject_request(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.cancel_request(uuid)', 'execute'),
  'anon can''t call the review RPCs'
);

set local role authenticated;

-- As the viewer.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-00000000c002') $$,
  '42501', 'You don''t have permission to submit requests.', 'a viewer can''t submit'
);
select throws_ok(
  $$ select public.request_info('00000000-0000-4000-8000-00000000c003', 'Why?') $$,
  '42501', 'Only an admin can ask for more info.', 'a viewer can''t ask for more info'
);
select throws_ok(
  $$ select public.reject_request('00000000-0000-4000-8000-00000000c003', 'No') $$,
  '42501', 'Only an admin can reject requests.', 'a viewer can''t reject'
);
select throws_ok(
  $$ select public.cancel_request('00000000-0000-4000-8000-00000000c003') $$,
  '42501', 'You don''t have permission to cancel requests.', 'a viewer can''t cancel'
);

-- As a deactivated member.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-00000000c002') $$,
  '42501', 'You don''t have permission to submit requests.', 'a deactivated user can''t submit'
);

-- As the member, whose payee is b002.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-00000000c006') $$,
  'P0002', 'That request doesn''t exist.', 'a member can''t submit someone else''s request, or learn it exists'
);
select throws_ok(
  $$ select public.cancel_request('00000000-0000-4000-8000-00000000c003') $$,
  'P0002', 'That request doesn''t exist.', 'a member can''t cancel someone else''s request, or learn it exists'
);
select throws_ok(
  $$ select public.request_info('00000000-0000-4000-8000-00000000c003', 'Why?') $$,
  '42501', 'Only an admin can ask for more info.', 'a member can''t ask for more info'
);
select lives_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-00000000c005') $$,
  'a member can submit their own request'
);
select lives_ok(
  $$ select public.cancel_request('00000000-0000-4000-8000-00000000c005') $$,
  'a member can cancel their own request'
);

-- As the admin.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-0000000fffff') $$,
  'P0002', 'That request doesn''t exist.', 'submitting needs a real request'
);

select throws_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-00000000c001') $$,
  '23514',
  'Add a receipt first, or turn on “No receipt on file” for this request.',
  'a request with no receipt and no exception can''t be submitted'
);

select lives_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-00000000c002') $$,
  'an admin can submit a draft'
);

select is(
  (select submitted_at from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c002'),
  now(),
  'submitting records when'
);

select throws_ok(
  $$ select public.request_info('00000000-0000-4000-8000-00000000c002', '  ') $$,
  '22023', 'Add a note explaining why.', 'asking for more info needs a note'
);

select throws_ok(
  $$ select public.request_info('00000000-0000-4000-8000-00000000c002', repeat('x', 1001)) $$,
  '22001', 'Keep the note under 1,000 characters.', 'the note is capped at 1,000 characters'
);

select lives_ok(
  $$ select public.request_info('00000000-0000-4000-8000-00000000c002', ' Which event was this for? ') $$,
  'an admin can ask for more info'
);

select results_eq(
  $$ select status::text, admin_note from public.reimbursement_requests
     where id = '00000000-0000-4000-8000-00000000c002' $$,
  $$ values ('needs_info', 'Which event was this for?') $$,
  'asking for more info saves the trimmed note'
);

select lives_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-00000000c002') $$,
  'a request that needs info can be submitted again'
);

select throws_ok(
  $$ select public.reject_request('00000000-0000-4000-8000-00000000c004', '') $$,
  '22023', 'Add a note explaining why.', 'rejecting needs a note'
);

select lives_ok(
  $$ select public.reject_request('00000000-0000-4000-8000-00000000c004', 'Not a ministry expense.') $$,
  'an admin can reject a submitted request'
);

select results_eq(
  $$ select status::text, admin_note from public.reimbursement_requests
     where id = '00000000-0000-4000-8000-00000000c004' $$,
  $$ values ('rejected', 'Not a ministry expense.') $$,
  'rejecting saves the note'
);

-- As the other admin, who didn't enter c003.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.cancel_request('00000000-0000-4000-8000-00000000c003') $$,
  '42501',
  'Only the admin who entered this request can cancel it. Reject it instead.',
  'an admin can''t cancel a request another admin entered'
);

-- As the admin who entered it.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.cancel_request('00000000-0000-4000-8000-00000000c003') $$,
  'the admin who entered a request can cancel it'
);

-- Every status RPC against every status. The refused ones must fail on the
-- status check and change nothing.
select throws_ok(
  format('select public.%s(%L%s)', a.fn, '00000000-0000-4000-8000-00000000' || r.suffix, a.args),
  '55000',
  null,
  format('%s is refused on a %s request', a.fn, r.status)
)
from (values
  ('approve_request', ''),
  ('record_as_paid', ', ''cash'', null, now()'),
  ('mark_paid', ', ''cash'''),
  ('unmark_paid', ', ''Test note'''),
  ('unapprove_request', ', ''Test note'''),
  ('submit_request', ''),
  ('request_info', ', ''Test note'''),
  ('reject_request', ', ''Test note'''),
  ('cancel_request', '')
) as a (fn, args)
cross join (values
  ('c101', 'draft'),
  ('c102', 'submitted'),
  ('c103', 'needs_info'),
  ('c104', 'approved'),
  ('c105', 'paid'),
  ('c106', 'rejected'),
  ('c107', 'cancelled')
) as r (suffix, status)
where (a.fn, r.status) not in (values
  ('approve_request', 'draft'),
  ('approve_request', 'submitted'),
  ('record_as_paid', 'draft'),
  ('mark_paid', 'approved'),
  ('unmark_paid', 'paid'),
  ('unapprove_request', 'approved'),
  ('submit_request', 'draft'),
  ('submit_request', 'needs_info'),
  ('request_info', 'submitted'),
  ('reject_request', 'submitted'),
  ('reject_request', 'needs_info'),
  ('cancel_request', 'submitted'),
  ('cancel_request', 'needs_info')
);

select results_eq(
  $$ select status::text from public.reimbursement_requests
     where id::text like '00000000-0000-4000-8000-00000000c1%'
     order by id $$,
  $$ values ('draft'), ('submitted'), ('needs_info'), ('approved'), ('paid'), ('rejected'), ('cancelled') $$,
  'the refused calls changed no statuses'
);

-- Each allowed transition, on its own request.
select lives_ok(
  format('select public.%s(%L%s)', t.fn, '00000000-0000-4000-8000-00000000' || t.suffix, t.args),
  format('%s works on a %s request', t.fn, t.status)
)
from (values
  ('c201', 'approve_request', '', 'draft'),
  ('c202', 'approve_request', '', 'submitted'),
  ('c203', 'record_as_paid', ', ''cash'', null, now()', 'draft'),
  ('c204', 'mark_paid', ', ''cash''', 'approved'),
  ('c205', 'unmark_paid', ', ''Test note''', 'paid'),
  ('c206', 'unapprove_request', ', ''Test note''', 'approved'),
  ('c207', 'submit_request', '', 'draft'),
  ('c208', 'submit_request', '', 'needs_info'),
  ('c209', 'request_info', ', ''Test note''', 'submitted'),
  ('c210', 'reject_request', ', ''Test note''', 'submitted'),
  ('c211', 'reject_request', ', ''Test note''', 'needs_info'),
  ('c212', 'cancel_request', '', 'submitted'),
  ('c213', 'cancel_request', '', 'needs_info')
) as t (suffix, fn, args, status);

select results_eq(
  $$ select right(id::text, 4), status::text from public.reimbursement_requests
     where id::text like '00000000-0000-4000-8000-00000000c2%'
     order by id $$,
  $$ values
       ('c201', 'approved'),
       ('c202', 'approved'),
       ('c203', 'paid'),
       ('c204', 'paid'),
       ('c205', 'approved'),
       ('c206', 'submitted'),
       ('c207', 'submitted'),
       ('c208', 'submitted'),
       ('c209', 'needs_info'),
       ('c210', 'rejected'),
       ('c211', 'rejected'),
       ('c212', 'cancelled'),
       ('c213', 'cancelled') $$,
  'each allowed transition lands in the right status'
);

reset role;

select results_eq(
  $$ select right(id::text, 4), status::text from public.reimbursement_requests
     where id::text like '00000000-0000-4000-8000-00000000c00%'
     order by id $$,
  $$ values
       ('c001', 'draft'),
       ('c002', 'submitted'),
       ('c003', 'cancelled'),
       ('c004', 'rejected'),
       ('c005', 'cancelled'),
       ('c006', 'draft') $$,
  'the review loop left each request where expected'
);

select * from finish();
rollback;
