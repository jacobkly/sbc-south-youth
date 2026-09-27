-- Receipts: the table rows, the private bucket and its file policies, the
-- 10-receipt limit, the audit entries, and the storage usage total.
begin;

create extension if not exists pgtap with schema extensions;

select plan(40);

-- Receipts already in a local database, from trying the app, aren't counted.
select set_config('test.usage_before', coalesce(sum(size_bytes), 0)::text, true)
from public.receipts
where storage_location = 'supabase';

-- Fake people. New auth users get a member row from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'member@example.test', '{"full_name": "Test Member"}');

update public.users set role = 'admin' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a002';

insert into public.payees (id, full_name)
values ('00000000-0000-4000-8000-00000000b001', 'Test Payee');

-- c001 is a draft, c002 submitted, c003 approved, and c004 a draft to delete.
insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description,
  status, approved_by, approved_at
)
select
  r.id::uuid, '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a001',
  'youth', 1000, '2026-01-10', 'Fake Store', r.description, r.status::public.request_status,
  case when r.status = 'approved' then '00000000-0000-4000-8000-00000000a001'::uuid end,
  case when r.status = 'approved' then now() end
from (values
  ('00000000-0000-4000-8000-00000000c001', 'Draft', 'draft'),
  ('00000000-0000-4000-8000-00000000c002', 'Submitted', 'submitted'),
  ('00000000-0000-4000-8000-00000000c003', 'Approved', 'approved'),
  ('00000000-0000-4000-8000-00000000c004', 'Draft to delete', 'draft')
) as r (id, description, status);

-- Receipts and files already on the approved request and the draft to delete.
insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256) values
  (
    '00000000-0000-4000-8000-00000000d003', '00000000-0000-4000-8000-00000000c003',
    '00000000-0000-4000-8000-00000000c003/00000000-0000-4000-8000-00000000d003.pdf',
    'invoice.pdf', 'application/pdf', 4000, repeat('c', 64)
  ),
  (
    '00000000-0000-4000-8000-00000000d004', '00000000-0000-4000-8000-00000000c004',
    '00000000-0000-4000-8000-00000000c004/00000000-0000-4000-8000-00000000d004.jpg',
    'photo.jpg', 'image/jpeg', 500, repeat('d', 64)
  );

insert into storage.objects (bucket_id, name) values
  ('receipts', '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000e001.jpg'),
  ('receipts', '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000e002.jpg'),
  ('receipts', '00000000-0000-4000-8000-00000000c003/00000000-0000-4000-8000-00000000d003.pdf');

-- Grants and the bucket.
select ok(not has_table_privilege('anon', 'public.receipts', 'select'), 'anon can''t read receipts');
select ok(
  not has_table_privilege('authenticated', 'public.receipts', 'update'),
  'receipts can''t be edited, only added or removed'
);
select ok(
  not has_column_privilege('authenticated', 'public.receipts', 'uploaded_by', 'insert')
  and not has_column_privilege('authenticated', 'public.receipts', 'storage_location', 'insert'),
  'uploaded_by and storage_location can''t be set by the client'
);
select ok(
  not has_function_privilege('anon', 'public.storage_usage()', 'execute'),
  'anon can''t call storage_usage'
);
select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'receipts' $$,
  $$ values (false, 10485760::bigint, array['image/jpeg', 'image/webp', 'image/png', 'application/pdf']) $$,
  'the receipts bucket is private, capped at 10 MB, and takes only images and PDFs'
);

-- As anon.
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'receipts' $$,
  'anon can''t see receipt files'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000e009.jpg') $$,
  '42501',
  null,
  'anon can''t upload receipt files'
);

-- As the admin.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, width, height, sha256)
     values (
       '00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000c001',
       '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000d001.jpg',
       'receipt.jpg', 'image/jpeg', 1000, 1200, 1600, repeat('a', 64)
     ) $$,
  'an admin can add a receipt to a draft'
);

select results_eq(
  $$ select uploaded_by, storage_location from public.receipts where id = '00000000-0000-4000-8000-00000000d001' $$,
  $$ values ('00000000-0000-4000-8000-00000000a001'::uuid, 'supabase') $$,
  'a receipt records who uploaded it'
);

select results_eq(
  $$ select action, changes ->> 'filename' from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c001' and action like 'receipt%' $$,
  $$ values ('receipt_added', 'receipt.jpg') $$,
  'adding a receipt is logged with its file name'
);

select lives_ok(
  $$ insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256)
     values (
       '00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000c002',
       '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000d002.webp',
       'receipt.webp', 'image/webp', 2000, repeat('b', 64)
     ) $$,
  'an admin can add a receipt to a submitted request'
);

select throws_ok(
  $$ insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256)
     values (
       '00000000-0000-4000-8000-00000000d005', '00000000-0000-4000-8000-00000000c003',
       '00000000-0000-4000-8000-00000000c003/00000000-0000-4000-8000-00000000d005.jpg',
       'late.jpg', 'image/jpeg', 1000, repeat('e', 64)
     ) $$,
  '42501',
  null,
  'an approved request''s receipts are locked'
);

select throws_ok(
  $$ insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256)
     values (
       '00000000-0000-4000-8000-00000000d006', '00000000-0000-4000-8000-00000000c001',
       '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000d006.jpg',
       'wrong-folder.jpg', 'image/jpeg', 1000, repeat('e', 64)
     ) $$,
  '23514',
  null,
  'the file path must be the receipt''s own request and id'
);

select throws_ok(
  $$ insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256)
     values (
       '00000000-0000-4000-8000-00000000d006', '00000000-0000-4000-8000-00000000c001',
       '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000d006.gif',
       'animated.gif', 'image/gif', 1000, repeat('e', 64)
     ) $$,
  '23514',
  null,
  'only images and PDFs are allowed'
);

select throws_ok(
  $$ insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256)
     values (
       '00000000-0000-4000-8000-00000000d006', '00000000-0000-4000-8000-00000000c001',
       '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000d006.jpg',
       'empty.jpg', 'image/jpeg', 0, repeat('e', 64)
     ) $$,
  '23514',
  null,
  'a receipt can''t be empty'
);

select throws_ok(
  $$ insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256)
     values (
       '00000000-0000-4000-8000-00000000d006', '00000000-0000-4000-8000-00000000c001',
       '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000d006.jpg',
       'huge.jpg', 'image/jpeg', 10485761, repeat('e', 64)
     ) $$,
  '23514',
  null,
  'a receipt is capped at 10 MB'
);

select throws_ok(
  $$ insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256)
     values (
       '00000000-0000-4000-8000-00000000d006', '00000000-0000-4000-8000-00000000c001',
       '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000d006.jpg',
       'bad-hash.jpg', 'image/jpeg', 1000, 'NOT-A-HASH'
     ) $$,
  '23514',
  null,
  'the hash must be a lowercase SHA-256'
);

select lives_ok(
  $$ insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256)
     select
       f.id, '00000000-0000-4000-8000-00000000c001',
       '00000000-0000-4000-8000-00000000c001/' || f.id || '.jpg',
       'page.jpg', 'image/jpeg', 100, repeat('f', 64)
     from (select gen_random_uuid() as id from generate_series(1, 9)) as f $$,
  'a request can have 10 receipts'
);

select throws_ok(
  $$ insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256)
     values (
       '00000000-0000-4000-8000-00000000d007', '00000000-0000-4000-8000-00000000c001',
       '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000d007.jpg',
       'eleventh.jpg', 'image/jpeg', 100, repeat('f', 64)
     ) $$,
  '23514',
  'A request can have at most 10 receipts.',
  'an 11th receipt is refused'
);

select is(
  public.storage_usage() - current_setting('test.usage_before')::bigint,
  8400::bigint,
  'storage_usage adds up every receipt'
);

with removed as (
  delete from public.receipts where id = '00000000-0000-4000-8000-00000000d003' returning 1
)
select is(count(*)::int, 0, 'an admin can''t remove a receipt from an approved request') from removed;

with removed as (
  delete from public.receipts where id = '00000000-0000-4000-8000-00000000d001' returning 1
)
select is(count(*)::int, 1, 'an admin can remove a receipt from a draft') from removed;

select results_eq(
  $$ select changes ->> 'filename' from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c001' and action = 'receipt_removed' $$,
  $$ values ('receipt.jpg') $$,
  'removing a receipt is logged'
);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000e003.jpg') $$,
  'an admin can upload a file to a draft'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-00000000c003/00000000-0000-4000-8000-00000000e004.jpg') $$,
  '42501',
  null,
  'an admin can''t upload a file to an approved request'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('receipts', 'loose/00000000-0000-4000-8000-00000000e005.jpg') $$,
  '42501',
  null,
  'a file has to go in a request''s folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-0000000fffff/00000000-0000-4000-8000-00000000e006.jpg') $$,
  '42501',
  null,
  'a file can''t go in the folder of a request that doesn''t exist'
);

-- As the viewer.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select results_eq(
  $$ select distinct request_id from public.receipts
     where request_id in (
       '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c002',
       '00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000c004'
     )
     order by request_id $$,
  $$ values ('00000000-0000-4000-8000-00000000c002'::uuid), ('00000000-0000-4000-8000-00000000c003'::uuid) $$,
  'a viewer reads receipts on everything but drafts'
);

select results_eq(
  $$ select (storage.foldername(name))[1] from storage.objects
     where bucket_id = 'receipts' and name like '00000000-0000-4000-8000-00000000c00%'
     order by name $$,
  $$ values ('00000000-0000-4000-8000-00000000c002'), ('00000000-0000-4000-8000-00000000c003') $$,
  'a viewer reads files on everything but drafts'
);

select throws_ok(
  $$ insert into public.receipts (id, request_id, storage_path, original_filename, mime_type, size_bytes, sha256)
     values (
       '00000000-0000-4000-8000-00000000d008', '00000000-0000-4000-8000-00000000c002',
       '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000d008.jpg',
       'viewer.jpg', 'image/jpeg', 100, repeat('f', 64)
     ) $$,
  '42501',
  null,
  'a viewer can''t add receipts'
);

with removed as (
  delete from public.receipts where id = '00000000-0000-4000-8000-00000000d002' returning 1
)
select is(count(*)::int, 0, 'a viewer can''t remove receipts') from removed;

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('receipts', '00000000-0000-4000-8000-00000000c002/00000000-0000-4000-8000-00000000e007.jpg') $$,
  '42501',
  null,
  'a viewer can''t upload files'
);

select is(
  public.storage_usage() - current_setting('test.usage_before')::bigint,
  7400::bigint,
  'a viewer can see storage usage'
);

-- As a member.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.receipts
     where request_id in (
       '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c002',
       '00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000c004'
     ) $$,
  'a member can''t read receipts'
);

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'receipts' $$,
  'a member can''t see receipt files'
);

select throws_ok(
  $$ select public.storage_usage() $$,
  '42501',
  'Only admins and viewers can see storage usage.',
  'a member can''t see storage usage'
);

-- As the admin, deleting files the way the Storage API does.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);
select set_config('storage.allow_delete_query', 'true', true);

with removed as (
  delete from storage.objects
  where bucket_id = 'receipts'
    and name = '00000000-0000-4000-8000-00000000c003/00000000-0000-4000-8000-00000000d003.pdf'
  returning 1
)
select is(count(*)::int, 0, 'an admin can''t delete a file from an approved request') from removed;

with removed as (
  delete from storage.objects
  where bucket_id = 'receipts'
    and name = '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000e001.jpg'
  returning 1
)
select is(count(*)::int, 1, 'an admin can delete a file from a draft') from removed;

select lives_ok(
  $$ delete from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c004' $$,
  'an admin can delete a draft that has receipts'
);

reset role;

select is(
  (select count(*)::int from public.receipts where request_id = '00000000-0000-4000-8000-00000000c004'),
  0,
  'a deleted draft takes its receipt rows with it'
);

select * from finish();
rollback;
