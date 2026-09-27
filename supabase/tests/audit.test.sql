-- The audit log: written only by triggers, one entry per real change, and
-- readable only alongside its request.
begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- Fake people. New auth users get a member row from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'member@example.test', '{"full_name": "Test Member"}');

update public.users set role = 'admin' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a002';

insert into public.payees (id, full_name)
values ('00000000-0000-4000-8000-00000000b001', 'Test Payee');

-- Entered as the admin, so the created events record them as the actor. c001
-- goes through the whole review loop, c002 stays a draft, and the rest end in
-- the other final states.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description, no_receipt, no_receipt_reason
)
select
  r.id::uuid, '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a001',
  'youth', 1000, '2026-01-10', 'Fake Store', r.description, true, 'Lost it'
from (values
  ('00000000-0000-4000-8000-00000000c001', 'Full loop'),
  ('00000000-0000-4000-8000-00000000c002', 'Still a draft'),
  ('00000000-0000-4000-8000-00000000c003', 'Paid before entry'),
  ('00000000-0000-4000-8000-00000000c004', 'Rejected'),
  ('00000000-0000-4000-8000-00000000c005', 'Cancelled')
) as r (id, description);

-- Grants.
select ok(not has_table_privilege('anon', 'public.request_events', 'select'), 'anon can''t read the audit log');
select ok(
  not has_table_privilege('authenticated', 'public.request_events', 'insert')
  and not has_table_privilege('authenticated', 'public.request_events', 'update')
  and not has_table_privilege('authenticated', 'public.request_events', 'delete'),
  'signed-in users can''t write to the audit log'
);
select ok(
  not has_table_privilege('service_role', 'public.request_events', 'insert')
  and not has_table_privilege('service_role', 'public.request_events', 'update')
  and not has_table_privilege('service_role', 'public.request_events', 'delete'),
  'the service role can''t write to the audit log either'
);
select ok(
  not has_function_privilege('authenticated', 'public.log_request_event()', 'execute'),
  'signed-in users can''t call the audit trigger function'
);

select results_eq(
  $$ select action, actor_id, from_status::text, to_status::text from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c001' $$,
  $$ values ('created', '00000000-0000-4000-8000-00000000a001'::uuid, null::text, 'draft') $$,
  'creating a request logs who created it'
);

set local role authenticated;

-- As the admin.
select public.save_request(
  '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10',
  'Full loop', null, true, 'Lost it',
  '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1500, "vendor": "Other Store"}]'
);

select is(
  (select changes from public.request_events
   where request_id = '00000000-0000-4000-8000-00000000c001' and action = 'updated'),
  '{"vendor": {"from": "Fake Store", "to": "Other Store"}, "amount_cents": {"from": 1000, "to": 1500}}'::jsonb,
  'an edit logs the old and new values of what changed'
);

select public.save_request(
  '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10',
  'Full loop', null, true, 'Lost it',
  '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1500, "vendor": "Other Store"}]'
);

select is(
  (select count(*)::int from public.request_events where request_id = '00000000-0000-4000-8000-00000000c001'),
  2,
  'saving without changing anything isn''t logged'
);

select public.submit_request('00000000-0000-4000-8000-00000000c001');
update public.reimbursement_requests set event_name = 'Game night'
where id = '00000000-0000-4000-8000-00000000c001';
select public.request_info('00000000-0000-4000-8000-00000000c001', 'Which event was this for?');
select public.submit_request('00000000-0000-4000-8000-00000000c001');
select public.approve_request('00000000-0000-4000-8000-00000000c001');
select public.mark_paid('00000000-0000-4000-8000-00000000c001', 'check', '1001');
select public.unmark_paid('00000000-0000-4000-8000-00000000c001', 'Paid the wrong person.');
select public.unapprove_request('00000000-0000-4000-8000-00000000c001', 'Needs a second look.');
select public.approve_request('00000000-0000-4000-8000-00000000c001');

select bag_eq(
  $$ select action, from_status::text, to_status::text, note from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c001' $$,
  $$ values
       ('created', null, 'draft', null),
       ('updated', 'draft', 'draft', null),
       ('submitted', 'draft', 'submitted', null),
       ('updated', 'submitted', 'submitted', null),
       ('info_requested', 'submitted', 'needs_info', 'Which event was this for?'),
       ('submitted', 'needs_info', 'submitted', null),
       ('approved', 'submitted', 'approved', null),
       ('paid', 'approved', 'paid', null),
       ('unpaid', 'paid', 'approved', 'Paid the wrong person.'),
       ('unapproved', 'approved', 'submitted', 'Needs a second look.'),
       ('approved', 'submitted', 'approved', null) $$,
  'every step of the review loop is logged, with the notes that explain it'
);

select is_empty(
  $$ select 1 from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c001'
       and actor_id is distinct from '00000000-0000-4000-8000-00000000a001' $$,
  'every entry names the admin who did it'
);

select public.record_as_paid('00000000-0000-4000-8000-00000000c003', 'cash', null, now());
select public.submit_request('00000000-0000-4000-8000-00000000c004');
select public.reject_request('00000000-0000-4000-8000-00000000c004', 'Not a ministry expense.');
select public.submit_request('00000000-0000-4000-8000-00000000c005');
select public.cancel_request('00000000-0000-4000-8000-00000000c005');

select bag_eq(
  $$ select request_id, action, note from public.request_events
     where request_id in (
       '00000000-0000-4000-8000-00000000c003',
       '00000000-0000-4000-8000-00000000c004',
       '00000000-0000-4000-8000-00000000c005'
     )
     and action not in ('created', 'submitted') $$,
  $$ values
       ('00000000-0000-4000-8000-00000000c003'::uuid, 'recorded_paid', null::text),
       ('00000000-0000-4000-8000-00000000c004'::uuid, 'rejected', 'Not a ministry expense.'),
       ('00000000-0000-4000-8000-00000000c005'::uuid, 'cancelled', null) $$,
  'recording a payment, rejecting, and cancelling are logged'
);

select throws_ok(
  $$ insert into public.request_events (request_id, action)
     values ('00000000-0000-4000-8000-00000000c001', 'approved') $$,
  '42501',
  null,
  'an admin can''t add audit entries'
);

select throws_ok(
  $$ update public.request_events set note = 'Rewritten' where request_id = '00000000-0000-4000-8000-00000000c001' $$,
  '42501',
  null,
  'an admin can''t edit audit entries'
);

select throws_ok(
  $$ delete from public.request_events where request_id = '00000000-0000-4000-8000-00000000c001' $$,
  '42501',
  null,
  'an admin can''t delete audit entries'
);

select is(
  (select count(*)::int from public.request_events where request_id = '00000000-0000-4000-8000-00000000c002'),
  1,
  'an admin reads the log of a draft'
);

-- As the viewer.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.request_events where request_id = '00000000-0000-4000-8000-00000000c001'),
  11,
  'a viewer reads the log of a request they can see'
);

select is_empty(
  $$ select 1 from public.request_events where request_id = '00000000-0000-4000-8000-00000000c002' $$,
  'a viewer can''t read the log of a draft'
);

-- As a member.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.request_events
     where request_id in (
       '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c002',
       '00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000c004',
       '00000000-0000-4000-8000-00000000c005'
     ) $$,
  'a member can''t read the audit log'
);

-- As the admin, deleting the draft.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select lives_ok(
  $$ delete from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c002' $$,
  'an admin can delete a draft that has log entries'
);

reset role;

select is(
  (select count(*)::int from public.request_events where request_id = '00000000-0000-4000-8000-00000000c002'),
  0,
  'a deleted draft takes its log with it'
);

select is(
  (select count(*)::int from public.request_events where request_id = '00000000-0000-4000-8000-00000000c001'),
  11,
  'the table owner sees the same entries'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.request_events'::regclass),
  'RLS is on for the audit log'
);

select policies_are(
  'public',
  'request_events',
  array['Events are readable with their request'],
  'the audit log has only the read policy'
);

select * from finish();
rollback;
