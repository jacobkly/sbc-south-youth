-- missing_receipt: a request is missing a receipt when "No receipt on file"
-- is on, or any of its receipts has no file. It's read like a column, and
-- follows the same RLS as the lines and files it looks at.
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

-- Fake people.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'member@example.test', '{"full_name": "Test Member"}');

update public.users set role = 'admin' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a002';

insert into public.payees (id, full_name) values
  ('00000000-0000-4000-8000-00000000b001', 'Test Payee');

-- Grants.
select ok(
  has_function_privilege('authenticated', 'public.missing_receipt(public.reimbursement_requests)', 'execute')
  and not has_function_privilege('anon', 'public.missing_receipt(public.reimbursement_requests)', 'execute'),
  'signed-in users can read missing_receipt, anon can''t'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.missing_receipt(public.reimbursement_requests)'::regprocedure),
  'missing_receipt runs as the caller, so RLS applies to what it reads'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

-- Three receipts, no files yet.
select public.save_request(
  null, '00000000-0000-4000-8000-00000000b001', 'cafe', '2026-02-10', 'Three stores', null, false, null,
  '[
    {"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1000, "vendor": "Test Market"},
    {"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1500, "vendor": "Test Grocer"},
    {"id": "00000000-0000-4000-8000-00000000f003", "amount_cents": 1100}
  ]'
);

select is(
  (select r.missing_receipt from public.reimbursement_requests r where r.description = 'Three stores'),
  true,
  'a request with no files is missing a receipt'
);

-- Files on the first two.
insert into public.receipts (id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256)
select v.id, r.id, v.line_id, r.id || '/' || v.id || '.jpg', 'receipt.jpg', 'image/jpeg', 1000, v.sha256
from public.reimbursement_requests r
cross join (values
  ('00000000-0000-4000-8000-00000000d001'::uuid, '00000000-0000-4000-8000-00000000f001'::uuid, repeat('a', 64)),
  ('00000000-0000-4000-8000-00000000d002'::uuid, '00000000-0000-4000-8000-00000000f002'::uuid, repeat('b', 64))
) as v (id, line_id, sha256)
where r.description = 'Three stores';

select is(
  (select r.missing_receipt from public.reimbursement_requests r where r.description = 'Three stores'),
  true,
  'one receipt of three without a file is still missing'
);

-- A file on the third.
insert into public.receipts (id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256)
select '00000000-0000-4000-8000-00000000d003', r.id, '00000000-0000-4000-8000-00000000f003',
  r.id || '/00000000-0000-4000-8000-00000000d003.jpg', 'receipt.jpg', 'image/jpeg', 1000, repeat('c', 64)
from public.reimbursement_requests r
where r.description = 'Three stores';

select is(
  (select r.missing_receipt from public.reimbursement_requests r where r.description = 'Three stores'),
  false,
  'every receipt with a file is not missing any'
);

select results_eq(
  $$ select count(*)::int from public.reimbursement_requests r
     where r.description = 'Three stores' and not public.missing_receipt(r) $$,
  $$ values (1) $$,
  'it can be called as a function on the row, as the API filter does'
);

-- Take a file off again.
delete from public.receipts where id = '00000000-0000-4000-8000-00000000d002';

select is(
  (select r.missing_receipt from public.reimbursement_requests r where r.description = 'Three stores'),
  true,
  'removing a file makes it missing again'
);

-- A second file on another receipt doesn't stand in for the missing one.
insert into public.receipts (id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256)
select '00000000-0000-4000-8000-00000000d004', r.id, '00000000-0000-4000-8000-00000000f001',
  r.id || '/00000000-0000-4000-8000-00000000d004.jpg', 'receipt.jpg', 'image/jpeg', 1000, repeat('d', 64)
from public.reimbursement_requests r
where r.description = 'Three stores';

select is(
  (select r.missing_receipt from public.reimbursement_requests r where r.description = 'Three stores'),
  true,
  'extra files on one receipt don''t cover another'
);

-- "No receipt on file".
select public.save_request(
  null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-02-11', 'Lost receipt', null, true, null,
  '[{"id": "00000000-0000-4000-8000-00000000f004", "amount_cents": 800}]'
);

select is(
  (select r.missing_receipt from public.reimbursement_requests r where r.description = 'Lost receipt'),
  true,
  'a request with "No receipt on file" is missing a receipt'
);

-- One receipt with a file.
select public.save_request(
  null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-02-12', 'One store', null, false, null,
  '[{"id": "00000000-0000-4000-8000-00000000f005", "amount_cents": 900, "vendor": "Test Depot"}]'
);

insert into public.receipts (id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256)
select '00000000-0000-4000-8000-00000000d005', r.id, '00000000-0000-4000-8000-00000000f005',
  r.id || '/00000000-0000-4000-8000-00000000d005.jpg', 'receipt.jpg', 'image/jpeg', 1000, repeat('e', 64)
from public.reimbursement_requests r
where r.description = 'One store';

select is(
  (select r.missing_receipt from public.reimbursement_requests r where r.description = 'One store'),
  false,
  'a one-receipt request with a file is not missing any'
);

select public.submit_request((select id from public.reimbursement_requests where description = 'Three stores'));

-- Kept for the member checks, who can't look it up.
select set_config('test.three_stores', (select id::text from public.reimbursement_requests where description = 'Three stores'), true);

-- The viewer sees it on requests they can read.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select results_eq(
  $$ select r.description, r.missing_receipt from public.reimbursement_requests r
     where r.description in ('Three stores', 'One store', 'Lost receipt') $$,
  $$ values ('Three stores', true) $$,
  'a viewer sees it on a submitted request, and drafts stay hidden'
);

-- A member sees no requests, and can't learn about one by passing in its id.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.reimbursement_requests r where r.missing_receipt $$,
  'a member can''t find requests with it'
);

select is(
  public.missing_receipt(jsonb_populate_record(
    null::public.reimbursement_requests,
    jsonb_build_object(
      'id', current_setting('test.three_stores'),
      'no_receipt', false
    )
  )),
  false,
  'a member passing a hidden request''s id learns nothing'
);

reset role;

select is(
  public.missing_receipt(jsonb_populate_record(
    null::public.reimbursement_requests,
    jsonb_build_object(
      'id', current_setting('test.three_stores'),
      'no_receipt', false
    )
  )),
  true,
  'the same call as the owner does see the missing file'
);

-- The seed: every request has a line, so the field is never null.
select is_empty(
  $$ select 1 from public.reimbursement_requests r where r.missing_receipt is null $$,
  'missing_receipt is never null'
);

select * from finish();
rollback;
