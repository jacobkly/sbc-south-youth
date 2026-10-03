-- Requesters: people with the finance requester role start, edit, submit, and
-- cancel their own requests, add and remove their receipts, and read only the
-- requests paid to them. A viewer who is also a requester keeps the viewer's
-- reads and submits their own. Nobody else gets any of it.
begin;

create extension if not exists pgtap with schema extensions;

select plan(64);

-- Fake people. New auth users get a row with no roles from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Viewer Requester"}'),
  ('00000000-0000-4000-8000-00000000a003', 'requester@example.test', '{"full_name": "Test Requester"}'),
  ('00000000-0000-4000-8000-00000000a004', 'member@example.test', '{"full_name": "No Roles"}'),
  ('00000000-0000-4000-8000-00000000a005', 'former@example.test', '{"full_name": "Former Requester"}'),
  ('00000000-0000-4000-8000-00000000a006', 'unlinked@example.test', '{"full_name": "Unlinked Requester"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{finance_viewer,finance_requester}' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set roles = '{finance_requester}' where id in (
  '00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-00000000a005',
  '00000000-0000-4000-8000-00000000a006'
);
update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a005';

-- Everyone but a006 is linked to a payee. b001 is nobody's.
insert into public.payees (id, full_name, user_id, linked_at) values
  ('00000000-0000-4000-8000-00000000b001', 'Other Payee', null, null),
  ('00000000-0000-4000-8000-00000000b002', 'Viewer Requester', '00000000-0000-4000-8000-00000000a002', now()),
  ('00000000-0000-4000-8000-00000000b003', 'Test Requester', '00000000-0000-4000-8000-00000000a003', now()),
  ('00000000-0000-4000-8000-00000000b004', 'No Roles', '00000000-0000-4000-8000-00000000a004', now()),
  ('00000000-0000-4000-8000-00000000b005', 'Former Requester', '00000000-0000-4000-8000-00000000a005', now());

-- The requester's payee is b003. The owner entered c003 for them with the
-- no-receipt exception, and asked for more info on c005.
insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description, status,
  submitted_at, approved_by, approved_at, admin_note, no_receipt, no_receipt_reason
)
select
  ('00000000-0000-4000-8000-00000000' || r.suffix)::uuid,
  ('00000000-0000-4000-8000-00000000' || r.payee)::uuid,
  ('00000000-0000-4000-8000-00000000' || r.created_by)::uuid,
  'youth', 1000, '2026-01-10', 'Fake Store', 'Request ' || r.suffix,
  r.status::public.request_status,
  case when r.status <> 'draft' then now() end,
  case when r.status = 'approved' then '00000000-0000-4000-8000-00000000a001'::uuid end,
  case when r.status = 'approved' then now() end,
  case when r.status = 'needs_info' then 'Which event was this for?' end,
  r.no_receipt,
  case when r.no_receipt then 'Lost it' end
from (values
  ('c001', 'b001', 'a001', 'submitted', false),
  ('c002', 'b001', 'a001', 'draft', false),
  ('c003', 'b003', 'a001', 'draft', true),
  ('c004', 'b003', 'a001', 'submitted', false),
  ('c005', 'b003', 'a001', 'needs_info', false),
  ('c006', 'b003', 'a001', 'approved', false),
  ('c007', 'b002', 'a002', 'draft', false),
  ('c008', 'b004', 'a001', 'draft', true),
  ('c009', 'b005', 'a001', 'draft', true)
) as r (suffix, payee, created_by, status, no_receipt);

insert into public.request_lines (id, request_id, position, amount_cents, vendor)
select
  ('00000000-0000-4000-8000-00000000f' || s)::uuid, ('00000000-0000-4000-8000-00000000c' || s)::uuid,
  1, 1000, 'Fake Store'
from unnest(array['001', '002', '003', '004', '005', '007']) as s;

-- A receipt and its file on c001, c004, and c007.
insert into public.receipts (id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256)
select
  ('00000000-0000-4000-8000-00000000d' || s)::uuid,
  ('00000000-0000-4000-8000-00000000c' || s)::uuid,
  ('00000000-0000-4000-8000-00000000f' || s)::uuid,
  '00000000-0000-4000-8000-00000000c' || s || '/00000000-0000-4000-8000-00000000d' || s || '.jpg',
  'receipt.jpg', 'image/jpeg', 1000, repeat('a', 64)
from unnest(array['001', '004', '007']) as s;

insert into storage.objects (bucket_id, name)
select 'receipts', rc.storage_path
from public.receipts rc
where rc.request_id in (
  '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c004',
  '00000000-0000-4000-8000-00000000c007'
);

-- As the requester. Files are deleted the way the Storage API does.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);
select set_config('storage.allow_delete_query', 'true', true);

select set_eq(
  $$ select id from public.reimbursement_requests $$,
  array[
    '00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000c004',
    '00000000-0000-4000-8000-00000000c005', '00000000-0000-4000-8000-00000000c006'
  ]::uuid[],
  'a requester reads only the requests paid to them, drafts included'
);

select is(
  (select admin_note from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c005'),
  'Which event was this for?',
  'a requester reads the note on a request sent back to them'
);

select set_eq(
  $$ select request_id from public.request_lines $$,
  array[
    '00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000c004',
    '00000000-0000-4000-8000-00000000c005'
  ]::uuid[],
  'a requester reads only the lines on their requests'
);

select set_eq(
  $$ select request_id from public.receipts $$,
  array['00000000-0000-4000-8000-00000000c004']::uuid[],
  'a requester reads only the receipts on their requests'
);

select set_eq(
  $$ select distinct request_id from public.request_events $$,
  array[
    '00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000c004',
    '00000000-0000-4000-8000-00000000c005', '00000000-0000-4000-8000-00000000c006'
  ]::uuid[],
  'a requester reads only the history of their requests'
);

select set_eq(
  $$ select (storage.foldername(name))[1] from storage.objects where bucket_id = 'receipts' $$,
  array['00000000-0000-4000-8000-00000000c004'],
  'a requester reads only the files on their requests'
);

select is_empty($$ select 1 from public.request_report $$, 'a requester reads nothing from the report');
select is_empty($$ select 1 from public.payees $$, 'a requester can''t read payees, even their own');
select is_empty($$ select 1 from public.app_settings $$, 'a requester can''t read the settings');

select throws_ok(
  $$ select public.storage_usage() $$,
  '42501', 'Only admins and viewers can see storage usage.', 'a requester can''t see storage usage'
);
select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c004') $$,
  '42501', null, 'a requester can''t approve'
);
select throws_ok(
  $$ select public.record_as_paid('00000000-0000-4000-8000-00000000c004', 'cash', null, now()) $$,
  '42501', null, 'a requester can''t record a request as paid'
);
select throws_ok(
  $$ select public.mark_paid('00000000-0000-4000-8000-00000000c006', 'cash') $$,
  '42501', null, 'a requester can''t mark a request paid'
);
select throws_ok(
  $$ select public.request_info('00000000-0000-4000-8000-00000000c004', 'Why?') $$,
  '42501', null, 'a requester can''t ask for more info'
);
select throws_ok(
  $$ select public.reject_request('00000000-0000-4000-8000-00000000c004', 'No') $$,
  '42501', null, 'a requester can''t reject'
);

-- Saving.
select is(
  (select status::text from public.save_request(
    null, '00000000-0000-4000-8000-00000000b003', 'youth', '2026-01-10', 'Snacks', null, true, 'Lost it',
    '[{"id": "00000000-0000-4000-8000-00000000f101", "amount_cents": 1200, "vendor": "Fake Store"}]'
  )),
  'draft',
  'a requester can start a request paid to them'
);

select results_eq(
  $$ select r.created_by, r.amount_cents, r.no_receipt, r.no_receipt_reason
     from public.reimbursement_requests r
     join public.request_lines l on l.request_id = r.id
     where l.id = '00000000-0000-4000-8000-00000000f101' $$,
  $$ values ('00000000-0000-4000-8000-00000000a003'::uuid, 1200, false, null::text) $$,
  'it''s theirs, and the no-receipt exception stays off'
);

select throws_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', 'Snacks', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f102", "amount_cents": 1200, "vendor": "Fake Store"}]'
     ) $$,
  '42501', 'You can only save requests paid to you.', 'a requester can''t start a request paid to someone else'
);

select throws_ok(
  $$ select public.save_request(
       '00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000b003', 'youth', '2026-01-10',
       'Snacks', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1000, "vendor": "Fake Store"}]'
     ) $$,
  'P0002', 'That request doesn''t exist.', 'a requester can''t edit someone else''s request, or learn it exists'
);

select lives_ok(
  $$ select public.save_request(
       '00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000b003', 'cafe', '2026-01-11',
       'Cups', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f003", "amount_cents": 1500, "vendor": "Party Store"}]'
     ) $$,
  'a requester can edit a draft paid to them'
);

select results_eq(
  $$ select type::text, amount_cents, no_receipt, no_receipt_reason
     from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c003' $$,
  $$ values ('cafe', 1500, true, 'Lost it') $$,
  'their edit keeps the owner''s no-receipt setting'
);

select lives_ok(
  $$ select public.save_request(
       '00000000-0000-4000-8000-00000000c005', '00000000-0000-4000-8000-00000000b003', 'youth', '2026-01-10',
       'Snacks for the fall retreat', 'Fall retreat', false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f005", "amount_cents": 1000, "vendor": "Fake Store"}]'
     ) $$,
  'a requester can edit a request that needs info'
);

select is(
  (select status::text from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c005'),
  'needs_info',
  'saving doesn''t submit it'
);

select throws_ok(
  $$ select public.save_request(
       '00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-00000000b003', 'youth', '2026-01-10',
       'Snacks', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f004", "amount_cents": 1000, "vendor": "Fake Store"}]'
     ) $$,
  '55000', 'Only a draft or a request that needs info can be edited.', 'a requester can''t edit a submitted request'
);

select throws_ok(
  $$ select public.save_request(
       '00000000-0000-4000-8000-00000000c006', '00000000-0000-4000-8000-00000000b003', 'youth', '2026-01-10',
       'Snacks', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f006", "amount_cents": 1000, "vendor": "Fake Store"}]'
     ) $$,
  '55000', 'Only a draft or a request that needs info can be edited.', 'a requester can''t edit an approved request'
);

with changed as (
  update public.reimbursement_requests
  set description = 'Changed'
  where id in ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000c004')
  returning 1
)
select is(count(*)::int, 0, 'a requester can''t edit a request directly') from changed;

-- Receipts and files.
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-00000000c003/00000000-0000-4000-8000-00000000d103.jpg') $$,
  'a requester can upload a file to their draft'
);

select lives_ok(
  $$ insert into public.receipts (
       id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256
     ) values (
       '00000000-0000-4000-8000-00000000d103', '00000000-0000-4000-8000-00000000c003',
       '00000000-0000-4000-8000-00000000f003',
       '00000000-0000-4000-8000-00000000c003/00000000-0000-4000-8000-00000000d103.jpg',
       'receipt.jpg', 'image/jpeg', 1000, repeat('b', 64)
     ) $$,
  'a requester can add a receipt to their draft'
);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-00000000c005/00000000-0000-4000-8000-00000000d105.jpg') $$,
  'a requester can upload a file to a request that needs info'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-00000000c004/00000000-0000-4000-8000-00000000d104.jpg') $$,
  '42501', null, 'a requester can''t upload a file to a submitted request'
);

select throws_ok(
  $$ insert into public.receipts (
       id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256
     ) values (
       '00000000-0000-4000-8000-00000000d104', '00000000-0000-4000-8000-00000000c004',
       '00000000-0000-4000-8000-00000000f004',
       '00000000-0000-4000-8000-00000000c004/00000000-0000-4000-8000-00000000d104.jpg',
       'receipt.jpg', 'image/jpeg', 1000, repeat('b', 64)
     ) $$,
  '42501', null, 'a requester can''t add a receipt to a submitted request'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000d102.jpg') $$,
  '42501', null, 'a requester can''t upload a file to someone else''s request'
);

with removed as (
  delete from public.receipts where id = '00000000-0000-4000-8000-00000000d004' returning 1
)
select is(count(*)::int, 0, 'a requester can''t remove a receipt from a submitted request') from removed;

with removed as (
  delete from storage.objects
  where bucket_id = 'receipts'
    and name = '00000000-0000-4000-8000-00000000c004/00000000-0000-4000-8000-00000000d004.jpg'
  returning 1
)
select is(count(*)::int, 0, 'a requester can''t delete a file from a submitted request') from removed;

with removed as (
  delete from public.receipts where id = '00000000-0000-4000-8000-00000000d103' returning 1
)
select is(count(*)::int, 1, 'a requester can remove a receipt from their draft') from removed;

with removed as (
  delete from storage.objects
  where bucket_id = 'receipts'
    and name = '00000000-0000-4000-8000-00000000c003/00000000-0000-4000-8000-00000000d103.jpg'
  returning 1
)
select is(count(*)::int, 1, 'a requester can delete a file from their draft') from removed;

-- Submitting and cancelling. The new request is found by its line.
select throws_ok(
  $$ select public.submit_request(
       (select l.request_id from public.request_lines l where l.id = '00000000-0000-4000-8000-00000000f101')
     ) $$,
  '23514',
  'Add a receipt first, or turn on “No receipt on file” for this request.',
  'a requester''s request needs a receipt before it''s submitted'
);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     select 'receipts', l.request_id || '/00000000-0000-4000-8000-00000000d101.jpg'
     from public.request_lines l
     where l.id = '00000000-0000-4000-8000-00000000f101' $$,
  'a requester can upload a file to their new request'
);

select lives_ok(
  $$ insert into public.receipts (
       id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256
     )
     select
       '00000000-0000-4000-8000-00000000d101', l.request_id, l.id,
       l.request_id || '/00000000-0000-4000-8000-00000000d101.jpg',
       'receipt.jpg', 'image/jpeg', 1000, repeat('c', 64)
     from public.request_lines l
     where l.id = '00000000-0000-4000-8000-00000000f101' $$,
  'and add it as a receipt'
);

select lives_ok(
  $$ select public.submit_request(
       (select l.request_id from public.request_lines l where l.id = '00000000-0000-4000-8000-00000000f101')
     ) $$,
  'a requester can submit their own request'
);

select is(
  (select r.status::text
   from public.reimbursement_requests r
   join public.request_lines l on l.request_id = r.id
   where l.id = '00000000-0000-4000-8000-00000000f101'),
  'submitted',
  'it''s submitted'
);

select throws_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-00000000c001') $$,
  'P0002', 'That request doesn''t exist.', 'a requester can''t submit someone else''s request, or learn it exists'
);

select lives_ok(
  $$ select public.cancel_request('00000000-0000-4000-8000-00000000c004') $$,
  'a requester can cancel their own submitted request'
);

select throws_ok(
  $$ select public.cancel_request('00000000-0000-4000-8000-00000000c001') $$,
  'P0002', 'That request doesn''t exist.', 'a requester can''t cancel someone else''s request'
);

-- Deleting drafts.
select lives_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b003', 'youth', '2026-01-10', 'Started by mistake', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f102", "amount_cents": 500, "vendor": "Fake Store"}]'
     ) $$,
  'a requester can start a second draft'
);

with removed as (
  delete from public.reimbursement_requests r
  using public.request_lines l
  where l.request_id = r.id
    and l.id = '00000000-0000-4000-8000-00000000f102'
  returning 1
)
select is(count(*)::int, 1, 'a requester can delete a draft they started') from removed;

with removed as (
  delete from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c003' returning 1
)
select is(count(*)::int, 0, 'a requester can''t delete a draft the owner started for them') from removed;

-- As a requester with no linked payee.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a006", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b003', 'youth', '2026-01-10', 'Snacks', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f106", "amount_cents": 1200, "vendor": "Fake Store"}]'
     ) $$,
  '42501',
  'Your account isn''t linked to a payee yet. Ask an owner to link it.',
  'a requester with no linked payee can''t save'
);

select is_empty(
  $$ select 1 from public.reimbursement_requests $$,
  'a requester with no linked payee reads no requests'
);

-- As someone with no roles, whose payee is b004.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.reimbursement_requests $$,
  'someone with no roles reads no requests, even with a linked payee'
);

select throws_ok(
  $$ select public.save_request(
       '00000000-0000-4000-8000-00000000c008', '00000000-0000-4000-8000-00000000b004', 'youth', '2026-01-10',
       'Snacks', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f108", "amount_cents": 1000, "vendor": "Fake Store"}]'
     ) $$,
  '42501', 'You don''t have permission to save requests.', 'someone with no roles can''t save'
);

select throws_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-00000000c008') $$,
  '42501', 'You don''t have permission to submit requests.', 'someone with no roles can''t submit'
);

select throws_ok(
  $$ select public.cancel_request('00000000-0000-4000-8000-00000000c008') $$,
  '42501', 'You don''t have permission to cancel requests.', 'someone with no roles can''t cancel'
);

-- As a requester who was removed, whose payee is b005.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.reimbursement_requests $$,
  'a removed requester reads no requests'
);

select throws_ok(
  $$ select public.save_request(
       '00000000-0000-4000-8000-00000000c009', '00000000-0000-4000-8000-00000000b005', 'youth', '2026-01-10',
       'Snacks', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f109", "amount_cents": 1000, "vendor": "Fake Store"}]'
     ) $$,
  '42501', 'You don''t have permission to save requests.', 'a removed requester can''t save'
);

select throws_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-00000000c009') $$,
  '42501', 'You don''t have permission to submit requests.', 'a removed requester can''t submit'
);

-- As the viewer who is also a requester, whose payee is b002.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select set_eq(
  $$ select id from public.reimbursement_requests where id::text like '00000000-0000-4000-8000-00000000c%' $$,
  array[
    '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c004',
    '00000000-0000-4000-8000-00000000c005', '00000000-0000-4000-8000-00000000c006',
    '00000000-0000-4000-8000-00000000c007'
  ]::uuid[],
  'a viewer who is also a requester reads every request past draft, and their own drafts'
);

select set_eq(
  $$ select id from public.request_report where id::text like '00000000-0000-4000-8000-00000000c%' $$,
  array[
    '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c004',
    '00000000-0000-4000-8000-00000000c005', '00000000-0000-4000-8000-00000000c006'
  ]::uuid[],
  'their report leaves out drafts, even their own'
);

select lives_ok(
  $$ select public.submit_request('00000000-0000-4000-8000-00000000c007') $$,
  'a viewer who is also a requester can submit their own request'
);

select throws_ok(
  $$ select public.save_request(
       null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', 'Snacks', null, false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f107", "amount_cents": 1200, "vendor": "Fake Store"}]'
     ) $$,
  '42501', 'You can only save requests paid to you.', 'they still can''t save a request paid to someone else'
);

select throws_ok(
  $$ select public.approve_request('00000000-0000-4000-8000-00000000c001') $$,
  '42501', null, 'they still can''t approve'
);

-- As the owner, with two-step sign-in.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select ok(
  exists (
    select 1
    from public.reimbursement_requests r
    join public.request_lines l on l.request_id = r.id
    where l.id = '00000000-0000-4000-8000-00000000f101'
  ),
  'an owner sees requests a requester started'
);

select isnt_empty(
  $$ select 1 from public.request_report
     where status = 'draft' and id::text like '00000000-0000-4000-8000-00000000c%' $$,
  'an owner''s report still includes drafts'
);

select is(
  (select no_receipt from public.save_request(
    null, '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10', 'Snacks', null, true, 'Lost it',
    '[{"id": "00000000-0000-4000-8000-00000000f110", "amount_cents": 1200, "vendor": "Fake Store"}]'
  )),
  true,
  'an owner still saves for any payee, with the no-receipt exception'
);

reset role;

select * from finish();
rollback;
