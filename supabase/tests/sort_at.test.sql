-- sort_at: lists go by the day a request was paid back, or the day it was
-- created while it's unpaid.
begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- Fake people.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}');

update public.users set role = 'admin' where id = '00000000-0000-4000-8000-00000000a001';

insert into public.payees (id, full_name) values
  ('00000000-0000-4000-8000-00000000b001', 'Test Payee');

select has_index(
  'public', 'reimbursement_requests', 'reimbursement_requests_sort_at_idx',
  'lists can page by sort_at without sorting every request'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

-- An old receipt, entered today.
select public.save_request(
  null, '00000000-0000-4000-8000-00000000b001', 'cafe', '2026-02-10', 'Old receipt', null, true, 'Faded',
  '[{"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1000}]'
);

select is(
  (select sort_at from public.reimbursement_requests where description = 'Old receipt'),
  (select created_at from public.reimbursement_requests where description = 'Old receipt'),
  'an unpaid request goes by the day it was created'
);

select public.record_as_paid(
  (select id from public.reimbursement_requests where description = 'Old receipt'),
  'cash', null, '2026-02-20 12:00:00-08'
);

select is(
  (select sort_at from public.reimbursement_requests where description = 'Old receipt'),
  '2026-02-20 12:00:00-08'::timestamptz,
  'a paid request goes by the day it was paid'
);

select public.unmark_paid(
  (select id from public.reimbursement_requests where description = 'Old receipt'),
  'Paid the wrong request.'
);

select is(
  (select sort_at from public.reimbursement_requests where description = 'Old receipt'),
  (select created_at from public.reimbursement_requests where description = 'Old receipt'),
  'undoing the payment puts it back by the day it was created'
);

select throws_ok(
  $$ update public.reimbursement_requests set sort_at = now() where description = 'Old receipt' $$,
  '428C9',
  null,
  'sort_at can''t be written'
);

select * from finish();
rollback;
