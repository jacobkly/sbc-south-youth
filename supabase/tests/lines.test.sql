-- Amounts per receipt: save_request writes a request and its lines together,
-- the total and vendors follow the lines, and lines lock with their request.
begin;

create extension if not exists pgtap with schema extensions;

select plan(45);

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
  has_table_privilege('authenticated', 'public.request_lines', 'select')
  and not has_table_privilege('authenticated', 'public.request_lines', 'insert')
  and not has_table_privilege('authenticated', 'public.request_lines', 'update')
  and not has_table_privilege('authenticated', 'public.request_lines', 'delete'),
  'signed-in users can read lines but not write them'
);

select ok(
  not has_table_privilege('anon', 'public.request_lines', 'select'),
  'anon can''t read lines'
);

select ok(
  not has_table_privilege('authenticated', 'public.reimbursement_requests', 'insert')
  and not has_column_privilege('authenticated', 'public.reimbursement_requests', 'amount_cents', 'update')
  and not has_column_privilege('authenticated', 'public.reimbursement_requests', 'vendor', 'update'),
  'requests are created, and their total and vendors set, only through save_request'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_request(uuid, uuid, public.reimbursement_type, date, text, text, boolean, text, jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.save_request(uuid, uuid, public.reimbursement_type, date, text, text, boolean, text, jsonb)',
    'execute'
  ),
  'signed-in users can call save_request, anon can''t'
);

select ok(
  not has_function_privilege('authenticated', 'public.vendor_list(text[])', 'execute')
  and not has_function_privilege('authenticated', 'public.request_vendor_list(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.request_lines_summary(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.check_request_lines()', 'execute')
  and not has_function_privilege('authenticated', 'public.guard_request_line()', 'execute'),
  'signed-in users can''t call the line helpers'
);

select policies_are(
  'public',
  'request_lines',
  array['Lines are readable with their request'],
  'lines have only the read policy'
);

-- The vendor list.
select is(
  public.vendor_list(array['Costco', ' costco ', null, '  ', 'Target', 'COSTCO']),
  'Costco, Target',
  'the vendor list keeps the first spelling of each vendor, in order'
);

select is(
  public.vendor_list(array[null, '  ']::text[]),
  null,
  'the vendor list is null without vendors'
);

-- Every request already saved (the backfill and the seed) matches its lines.
select is_empty(
  $$ select r.id
     from public.reimbursement_requests r
     where not exists (select 1 from public.request_lines l where l.request_id = r.id)
        or r.amount_cents <> (select sum(l.amount_cents) from public.request_lines l where l.request_id = r.id)
        or r.vendor is distinct from public.request_vendor_list(r.id) $$,
  'every existing request has lines that add up to it'
);

set local role authenticated;

-- As a member.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', 'Member made', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f009", "amount_cents": 500}]'
     ) $$,
  '42501',
  'You don''t have permission to save requests.',
  'a member can''t save requests'
);

-- As the admin.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select lives_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', '  Three stores ', ' ', false, 'Ignored',
       '[
         {"id": "00000000-0000-4000-8000-00000000f001", "amount_cents": 1000, "vendor": "Costco"},
         {"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1500, "vendor": " Target "},
         {"id": "00000000-0000-4000-8000-00000000f003", "amount_cents": 1100, "vendor": "costco"}
       ]'
     ) $$,
  'an admin can save a request with three receipts'
);

select results_eq(
  $$ select status::text, amount_cents, vendor, event_name, no_receipt_reason, created_by
     from public.reimbursement_requests where description = 'Three stores' $$,
  $$ values ('draft', 3600, 'Costco, Target', null::text, null::text, '00000000-0000-4000-8000-00000000a001'::uuid) $$,
  'the request is a draft whose total and vendors come from its receipts'
);

select results_eq(
  $$ select l.position::int, l.id, l.amount_cents, l.vendor
     from public.request_lines l
     join public.reimbursement_requests r on r.id = l.request_id
     where r.description = 'Three stores'
     order by l.position $$,
  $$ values
       (1, '00000000-0000-4000-8000-00000000f001'::uuid, 1000, 'Costco'),
       (2, '00000000-0000-4000-8000-00000000f002'::uuid, 1500, 'Target'),
       (3, '00000000-0000-4000-8000-00000000f003'::uuid, 1100, 'costco') $$,
  'the receipts are saved in order with trimmed vendors'
);

select lives_ok(
  $$ set constraints public.request_lines_match immediate $$,
  'the saved request passes the commit check'
);
set constraints public.request_lines_match deferred;

select throws_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', null, null, false, null, '[]'
     ) $$,
  '22023',
  'Enter an amount.',
  'a request needs at least one receipt'
);

select throws_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', null, null, false, null,
       (select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'amount_cents', 100)) from generate_series(1, 11))
     ) $$,
  '22023',
  'A request can have at most 10 receipts.',
  'a request can have at most 10 receipts'
);

select throws_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', null, null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f009", "amount_cents": 500},
         {"id": "00000000-0000-4000-8000-00000000f00a", "amount_cents": 0}]'
     ) $$,
  '23514',
  'Each receipt needs an amount more than $0.',
  'each receipt needs an amount'
);

select throws_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', null, null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f009", "amount_cents": 60000000},
         {"id": "00000000-0000-4000-8000-00000000f00a", "amount_cents": 60000000}]'
     ) $$,
  '23514',
  'The total can''t be more than $1,000,000.',
  'the total is capped at $1,000,000'
);

select throws_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', null, null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f009", "amount_cents": 500},
         {"id": "00000000-0000-4000-8000-00000000f009", "amount_cents": 600}]'
     ) $$,
  '22023',
  'Each receipt needs its own id.',
  'receipt ids can''t repeat'
);

select throws_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', null, null, false, null,
       jsonb_build_array(jsonb_build_object(
         'id', '00000000-0000-4000-8000-00000000f009', 'amount_cents', 500, 'vendor', repeat('x', 101)
       ))
     ) $$,
  '23514',
  'A vendor can be at most 100 characters.',
  'a vendor is at most 100 characters'
);

select throws_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b001', 'youth',
       (now() at time zone 'America/Los_Angeles')::date + 1, null, null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f009", "amount_cents": 500}]'
     ) $$,
  '22023',
  'The purchase date can''t be in the future.',
  'the purchase date still can''t be in the future'
);

-- The viewer can't see a draft's receipts.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.request_lines where id = '00000000-0000-4000-8000-00000000f001' $$,
  'a viewer can''t read a draft''s receipts'
);

select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

-- Editing: change f003 and move it first, add f004, and remove f001 and f002.
select lives_ok(
  $$ select public.save_request(
       (select id from public.reimbursement_requests where description = 'Three stores'),
       '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', 'Three stores', null, false, null,
       '[
         {"id": "00000000-0000-4000-8000-00000000f003", "amount_cents": 1200, "vendor": "Costco"},
         {"id": "00000000-0000-4000-8000-00000000f004", "amount_cents": 700, "vendor": "Walmart"}
       ]'
     ) $$,
  'an edit can add, change, reorder, and remove receipts'
);

select results_eq(
  $$ select l.position::int, l.id, l.amount_cents, l.vendor
     from public.request_lines l
     join public.reimbursement_requests r on r.id = l.request_id
     where r.description = 'Three stores'
     order by l.position $$,
  $$ values
       (1, '00000000-0000-4000-8000-00000000f003'::uuid, 1200, 'Costco'),
       (2, '00000000-0000-4000-8000-00000000f004'::uuid, 700, 'Walmart') $$,
  'the edited receipts are saved in their new order'
);

select results_eq(
  $$ select amount_cents, vendor from public.reimbursement_requests where description = 'Three stores' $$,
  $$ values (1900, 'Costco, Walmart') $$,
  'the total and vendors follow the edit'
);

select lives_ok(
  $$ set constraints public.request_lines_match immediate $$,
  'the edited request passes the commit check'
);
set constraints public.request_lines_match deferred;

-- A second request, with one receipt.
select public.save_request(
  null, '00000000-0000-4000-8000-00000000b001', 'cafe', '2026-01-11', 'One store', null, false, null,
  '[{"id": "00000000-0000-4000-8000-00000000f005", "amount_cents": 500, "vendor": "Fake Store"}]'
);

select public.save_request(
  (select id from public.reimbursement_requests where description = 'One store'),
  '00000000-0000-4000-8000-00000000b001', 'cafe', '2026-01-11', 'One store', null, false, null,
  '[{"id": "00000000-0000-4000-8000-00000000f005", "amount_cents": 600, "vendor": "Fake Store"}]'
);

select throws_ok(
  $$ select public.save_request(
       (select id from public.reimbursement_requests where description = 'One store'),
       '00000000-0000-4000-8000-00000000b001', 'cafe', '2026-01-11', 'One store', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f003", "amount_cents": 600}]'
     ) $$,
  '22023',
  'That receipt is on another request.',
  'an edit can''t take a receipt from another request'
);

-- Files belong to a receipt on their own request.
insert into public.receipts (id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256)
select '00000000-0000-4000-8000-00000000d001', r.id, '00000000-0000-4000-8000-00000000f004',
  r.id || '/00000000-0000-4000-8000-00000000d001.jpg', 'receipt.jpg', 'image/jpeg', 1000, repeat('a', 64)
from public.reimbursement_requests r
where r.description = 'Three stores';

select throws_ok(
  $$ insert into public.receipts (id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256)
     select '00000000-0000-4000-8000-00000000d002', r.id, '00000000-0000-4000-8000-00000000f004',
       r.id || '/00000000-0000-4000-8000-00000000d002.jpg', 'receipt.jpg', 'image/jpeg', 1000, repeat('b', 64)
     from public.reimbursement_requests r
     where r.description = 'One store' $$,
  '23503',
  null,
  'a file can''t go on a receipt from another request'
);

select throws_ok(
  $$ select public.save_request(
       (select id from public.reimbursement_requests where description = 'Three stores'),
       '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', 'Three stores', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f003", "amount_cents": 1200, "vendor": "Costco"}]'
     ) $$,
  '55000',
  'Remove a receipt''s files before removing the receipt.',
  'a receipt with files can''t be removed'
);

-- Approved requests are locked.
select public.approve_request((select id from public.reimbursement_requests where description = 'Three stores'));

select throws_ok(
  $$ select public.save_request(
       (select id from public.reimbursement_requests where description = 'Three stores'),
       '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', 'Three stores', null, false, null,
       '[
         {"id": "00000000-0000-4000-8000-00000000f003", "amount_cents": 1, "vendor": "Costco"},
         {"id": "00000000-0000-4000-8000-00000000f004", "amount_cents": 700, "vendor": "Walmart"}
       ]'
     ) $$,
  '55000',
  'This request can''t be edited anymore.',
  'an approved request can''t be saved'
);

-- The import makes one receipt per row.
select lives_ok(
  $$ select public.import_paid_requests(
       '[{"line": 2, "date": "2026-01-15", "name": "Test Payee", "amount_cents": 2500, "type": "youth", "notes": "Imported pizza"}]',
       'cash'
     ) $$,
  'the import still works'
);

reset role;

select results_eq(
  $$ select l.position::int, l.amount_cents, l.vendor
     from public.request_lines l
     join public.reimbursement_requests r on r.id = l.request_id
     where r.description = 'Imported pizza' $$,
  $$ values (1, 2500, null::text) $$,
  'an imported row has one receipt with its amount'
);

select lives_ok(
  $$ set constraints public.request_lines_match immediate $$,
  'the imported request passes the commit check'
);
set constraints public.request_lines_match deferred;

-- The audit log records the receipts when a request has more than one.
select is(
  (select e.changes -> 'lines'
   from public.request_events e
   join public.reimbursement_requests r on r.id = e.request_id
   where r.description = 'Three stores' and e.action = 'updated'),
  '{
    "from": [
      {"amount_cents": 1000, "vendor": "Costco"},
      {"amount_cents": 1500, "vendor": "Target"},
      {"amount_cents": 1100, "vendor": "costco"}
    ],
    "to": [
      {"amount_cents": 1200, "vendor": "Costco"},
      {"amount_cents": 700, "vendor": "Walmart"}
    ]
  }'::jsonb,
  'an edit logs the receipts before and after'
);

select ok(
  (select e.changes ? 'amount_cents' and not e.changes ? 'lines'
   from public.request_events e
   join public.reimbursement_requests r on r.id = e.request_id
   where r.description = 'One store' and e.action = 'updated'),
  'an edit to a request with one receipt logs only the amount'
);

-- The lock holds for the table owner too.
select throws_ok(
  $$ update public.request_lines set amount_cents = 1 where id = '00000000-0000-4000-8000-00000000f003' $$,
  '55000',
  'Receipts can''t change once a request is approved or closed.',
  'an approved request''s receipts can''t change'
);

select throws_ok(
  $$ insert into public.request_lines (request_id, position, amount_cents)
     select id, 3, 100 from public.reimbursement_requests where description = 'Three stores' $$,
  '55000',
  'Receipts can''t change once a request is approved or closed.',
  'an approved request can''t get another receipt'
);

select throws_ok(
  $$ delete from public.request_lines where id = '00000000-0000-4000-8000-00000000f003' $$,
  '55000',
  'Receipts can''t change once a request is approved or closed.',
  'an approved request''s receipts can''t be removed'
);

select throws_ok(
  $$ update public.request_lines
     set request_id = (select id from public.reimbursement_requests where description = 'Imported pizza')
     where id = '00000000-0000-4000-8000-00000000f005' $$,
  '22023',
  'A receipt can''t move to another request.',
  'a receipt can''t move to another request'
);

select lives_ok(
  $$ delete from public.reimbursement_requests where description = 'Three stores' $$,
  'deleting a request takes its receipts and files with it'
);

select is_empty(
  $$ select 1 from public.request_lines
     where id in ('00000000-0000-4000-8000-00000000f003', '00000000-0000-4000-8000-00000000f004') $$,
  'the deleted request''s receipts are gone'
);

-- The commit check catches totals and vendors that don't match.
update public.reimbursement_requests set amount_cents = 601 where description = 'One store';

select throws_ok(
  $$ set constraints public.request_lines_match immediate $$,
  '23514',
  'A request''s total and vendors have to match its receipts.',
  'a total that doesn''t match its receipts is caught at commit'
);

update public.reimbursement_requests set amount_cents = 600, vendor = 'Other Store' where description = 'One store';

select throws_ok(
  $$ set constraints public.request_lines_match immediate $$,
  '23514',
  'A request''s total and vendors have to match its receipts.',
  'vendors that don''t match their receipts are caught at commit'
);

update public.reimbursement_requests set vendor = 'Fake Store' where description = 'One store';

insert into public.reimbursement_requests (id, payee_id, created_by, type, amount_cents, purchase_date)
values (
  '00000000-0000-4000-8000-00000000c009', '00000000-0000-4000-8000-00000000b001',
  '00000000-0000-4000-8000-00000000a001', 'youth', 500, '2026-01-10'
);

select throws_ok(
  $$ set constraints public.request_lines_match immediate $$,
  '23514',
  'A request needs at least one receipt amount.',
  'a request without receipts is caught at commit'
);

delete from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c009';

select lives_ok(
  $$ set constraints public.request_lines_match immediate $$,
  'once fixed, everything passes the commit check'
);

select * from finish();
rollback;
