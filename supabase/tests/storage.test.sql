-- The portal's storage bar: how much each bucket holds and how big the
-- database is, for anyone with a portal role, without a single file name.
begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

-- Fake people, one per kind of access.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'editor@example.test', '{"full_name": "Test Editor"}'),
  ('00000000-0000-4000-8000-00000000a003', 'messages@example.test', '{"full_name": "Test Messages"}'),
  ('00000000-0000-4000-8000-00000000a004', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a005', 'requester@example.test', '{"full_name": "Test Requester"}'),
  ('00000000-0000-4000-8000-00000000a006', 'former@example.test', '{"full_name": "Former Editor"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{site_editor}' where id in (
  '00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000a006'
);
update public.users set roles = '{site_messages}' where id = '00000000-0000-4000-8000-00000000a003';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a004';
update public.users set roles = '{finance_requester}' where id = '00000000-0000-4000-8000-00000000a005';
update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a006';

-- Known files only: two receipts, a profile picture, and nothing in a new
-- bucket. Files are deleted the way the Storage API does.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects;

insert into storage.buckets (id, name, public) values ('test-empty', 'test-empty', false);

insert into storage.objects (bucket_id, name, metadata) values
  ('receipts', 'fake-request/fake-receipt-one.webp', '{"size": 120000}'),
  ('receipts', 'fake-request/fake-receipt-two.webp', '{"size": 80500}'),
  ('avatars', '00000000-0000-4000-8000-00000000a002/fake-picture.webp', '{"size": 4200}');

-- An upload that hasn't finished has no size yet.
insert into storage.objects (bucket_id, name) values ('receipts', 'fake-request/fake-receipt-uploading.webp');

-- As anon.
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$ select public.storage_summary() $$,
  '42501',
  null,
  'anon can''t see storage'
);

-- As a requester, who only uses finances.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.storage_summary() $$,
  '42501',
  'Only people who use the portal can see storage.',
  'a requester can''t see storage'
);

-- As a site editor whose access was removed.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a006", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.storage_summary() $$,
  '42501',
  'Only people who use the portal can see storage.',
  'a removed site editor can''t see storage'
);

-- As a site editor.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select is(
  public.storage_summary() -> 'buckets',
  '[
    {"bucket": "avatars", "objects": 1, "bytes": 4200},
    {"bucket": "receipts", "objects": 3, "bytes": 200500},
    {"bucket": "site-photos", "objects": 0, "bytes": 0},
    {"bucket": "test-empty", "objects": 0, "bytes": 0}
  ]'::jsonb,
  'a site editor sees each bucket''s file count and bytes, empty buckets included'
);

select ok(
  (public.storage_summary() ->> 'database_bytes')::bigint = pg_database_size(current_database()),
  'a site editor sees the database size'
);

select is(
  array(select jsonb_object_keys(public.storage_summary()) order by 1),
  array['buckets', 'database_bytes'],
  'the summary holds only buckets and the database size'
);

select is(
  array(
    select distinct k
    from jsonb_array_elements(public.storage_summary() -> 'buckets') b, jsonb_object_keys(b) k
    order by 1
  ),
  array['bucket', 'bytes', 'objects'],
  'each bucket holds only its name, file count, and bytes'
);

select ok(
  public.storage_summary()::text !~ '(fake-|00000000-0000-4000-8000-00000000a002)',
  'no file name, folder, or owner shows up'
);

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'receipts' $$,
  'a site editor still can''t list receipts'
);

-- The other portal roles.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.storage_summary() $$,
  'a messages person can see storage'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.storage_summary() $$,
  'a finance viewer can see storage'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select is(
  jsonb_array_length(public.storage_summary() -> 'buckets'),
  4,
  'an owner can see storage'
);

-- The finances dashboard's own receipt total is unchanged.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.storage_usage() $$,
  'storage_usage() still works for the finances dashboard'
);

select * from finish();
rollback;
