-- The reporting view: LA paid dates, and RLS passed through to the caller.
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- Fake people. New auth users get a member row from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'member@example.test', '{"full_name": "Test Member"}');

update public.users set role = 'admin' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a002';

insert into public.payees (id, full_name)
values ('00000000-0000-4000-8000-00000000b001', 'Test Payee');

-- A draft, and a request paid at 11:30 PM on Dec 31, 2025 in LA, which is
-- already Jan 1 in UTC.
insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description,
  status, paid_at, paid_by, payment_method
) values
  (
    '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001',
    '00000000-0000-4000-8000-00000000a001', 'youth', 1000, '2025-12-20', 'Fake Store', 'Test draft',
    'draft', null, null, null
  ),
  (
    '00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000b001',
    '00000000-0000-4000-8000-00000000a001', 'cafe', 2500, '2025-12-20', 'Fake Store', 'Test paid',
    'paid', '2026-01-01 07:30:00+00', '00000000-0000-4000-8000-00000000a001', 'cash'
  );

select has_view('public', 'request_report', 'request_report exists');

select ok(
  (select 'security_invoker=true' = any (c.reloptions) from pg_class c where c.oid = 'public.request_report'::regclass),
  'request_report reads the table as the caller'
);

select ok(
  not has_table_privilege('anon', 'public.request_report', 'select'),
  'anon can''t read request_report'
);

-- As the admin.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.request_report where payee_id = '00000000-0000-4000-8000-00000000b001'),
  2,
  'an admin sees drafts'
);

select is(
  (select paid_date from public.request_report where id = '00000000-0000-4000-8000-00000000c002'),
  '2025-12-31'::date,
  'paid_date is the LA date, not the UTC date'
);

select is(
  (select paid_date from public.request_report where id = '00000000-0000-4000-8000-00000000c001'),
  null::date,
  'an unpaid request has no paid_date'
);

-- As the viewer.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select results_eq(
  $$ select id from public.request_report where payee_id = '00000000-0000-4000-8000-00000000b001' $$,
  $$ values ('00000000-0000-4000-8000-00000000c002'::uuid) $$,
  'a viewer gets no drafts'
);

-- As a member, who has no access to requests.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is_empty(
  $$ select id from public.request_report $$,
  'a member sees nothing'
);

select * from finish();
rollback;
