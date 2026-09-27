-- Profile pictures: the private bucket, who can read, add, and delete files,
-- and the avatar_path each user sets on their own row.
begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

-- Fake people. New auth users get a member row from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'member@example.test', '{"full_name": "Test Member"}'),
  ('00000000-0000-4000-8000-00000000a004', 'other@example.test', '{"full_name": "Other Member"}'),
  ('00000000-0000-4000-8000-00000000a005', 'former@example.test', '{"full_name": "Former Admin"}');

update public.users set role = 'admin' where id in (
  '00000000-0000-4000-8000-00000000a001',
  '00000000-0000-4000-8000-00000000a005'
);
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a005';

-- Pictures already stored for the other member and the deactivated admin.
insert into storage.objects (bucket_id, name) values
  ('avatars', '00000000-0000-4000-8000-00000000a004/00000000-0000-4000-8000-00000000f004.webp'),
  ('avatars', '00000000-0000-4000-8000-00000000a005/00000000-0000-4000-8000-00000000f005.jpg');

-- The bucket and grants.
select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars' $$,
  $$ values (false, 51200::bigint, array['image/webp', 'image/jpeg']) $$,
  'the avatars bucket is private, capped at 50 KB, and takes only WebP and JPEG'
);

select ok(
  not has_column_privilege('anon', 'public.users', 'avatar_path', 'update'),
  'anon can''t set a picture'
);

-- As anon.
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'avatars' $$,
  'anon can''t see pictures'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '00000000-0000-4000-8000-00000000a003/00000000-0000-4000-8000-00000000f009.webp') $$,
  '42501',
  null,
  'anon can''t upload pictures'
);

-- As the member. Files are deleted the way the Storage API does.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);
select set_config('storage.allow_delete_query', 'true', true);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '00000000-0000-4000-8000-00000000a003/00000000-0000-4000-8000-00000000f003.webp') $$,
  'a user can upload a picture to their own folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '00000000-0000-4000-8000-00000000a004/00000000-0000-4000-8000-00000000f006.webp') $$,
  '42501',
  null,
  'a user can''t upload to someone else''s folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-4000-8000-00000000f007.webp') $$,
  '42501',
  null,
  'a picture has to go in a folder'
);

select results_eq(
  $$ select (storage.foldername(name))[1] from storage.objects where bucket_id = 'avatars' $$,
  $$ values ('00000000-0000-4000-8000-00000000a003') $$,
  'a member sees only their own pictures'
);

with changed as (
  update public.users
  set avatar_path = '00000000-0000-4000-8000-00000000a003/00000000-0000-4000-8000-00000000f003.webp'
  where id = '00000000-0000-4000-8000-00000000a003'
  returning 1
)
select is(count(*)::int, 1, 'a user can set their own picture') from changed;

select throws_ok(
  $$ update public.users
     set avatar_path = '00000000-0000-4000-8000-00000000a004/00000000-0000-4000-8000-00000000f004.webp'
     where id = '00000000-0000-4000-8000-00000000a003' $$,
  '23514',
  null,
  'a user''s picture has to be in their own folder'
);

select throws_ok(
  $$ update public.users
     set avatar_path = '00000000-0000-4000-8000-00000000a003/00000000-0000-4000-8000-00000000f003.png'
     where id = '00000000-0000-4000-8000-00000000a003' $$,
  '23514',
  null,
  'a picture path has to be a random id with a WebP or JPEG extension'
);

with changed as (
  update public.users
  set avatar_path = '00000000-0000-4000-8000-00000000a004/00000000-0000-4000-8000-00000000f003.webp'
  where id = '00000000-0000-4000-8000-00000000a004'
  returning 1
)
select is(count(*)::int, 0, 'a user can''t set someone else''s picture') from changed;

with removed as (
  delete from storage.objects
  where bucket_id = 'avatars' and name = '00000000-0000-4000-8000-00000000a004/00000000-0000-4000-8000-00000000f004.webp'
  returning 1
)
select is(count(*)::int, 0, 'a user can''t delete someone else''s picture') from removed;

with changed as (
  update public.users set avatar_path = null
  where id = '00000000-0000-4000-8000-00000000a003'
  returning 1
)
select is(count(*)::int, 1, 'a user can remove their own picture') from changed;

with removed as (
  delete from storage.objects
  where bucket_id = 'avatars' and name = '00000000-0000-4000-8000-00000000a003/00000000-0000-4000-8000-00000000f003.webp'
  returning 1
)
select is(count(*)::int, 1, 'a user can delete their own picture file') from removed;

-- As the viewer.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'avatars'),
  2,
  'a viewer sees everyone''s pictures'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '00000000-0000-4000-8000-00000000a004/00000000-0000-4000-8000-00000000f008.webp') $$,
  '42501',
  null,
  'a viewer can''t upload to someone else''s folder'
);

with removed as (
  delete from storage.objects
  where bucket_id = 'avatars' and name = '00000000-0000-4000-8000-00000000a004/00000000-0000-4000-8000-00000000f004.webp'
  returning 1
)
select is(count(*)::int, 0, 'a viewer can''t delete someone else''s picture') from removed;

-- As the admin.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'avatars'),
  2,
  'an admin sees everyone''s pictures'
);

with removed as (
  delete from storage.objects
  where bucket_id = 'avatars' and name = '00000000-0000-4000-8000-00000000a004/00000000-0000-4000-8000-00000000f004.webp'
  returning 1
)
select is(count(*)::int, 0, 'an admin can''t delete someone else''s picture') from removed;

with changed as (
  update public.users
  set avatar_path = '00000000-0000-4000-8000-00000000a004/00000000-0000-4000-8000-00000000f004.webp'
  where id = '00000000-0000-4000-8000-00000000a004'
  returning 1
)
select is(count(*)::int, 0, 'an admin can''t set someone else''s picture') from changed;

-- As the deactivated admin.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'avatars' $$,
  'a deactivated user sees no pictures, not even their own'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '00000000-0000-4000-8000-00000000a005/00000000-0000-4000-8000-00000000f010.webp') $$,
  '42501',
  null,
  'a deactivated user can''t upload a picture'
);

with changed as (
  update public.users
  set avatar_path = '00000000-0000-4000-8000-00000000a005/00000000-0000-4000-8000-00000000f005.jpg'
  where id = '00000000-0000-4000-8000-00000000a005'
  returning 1
)
select is(count(*)::int, 0, 'a deactivated user can''t set a picture') from changed;

with removed as (
  delete from storage.objects
  where bucket_id = 'avatars' and name = '00000000-0000-4000-8000-00000000a005/00000000-0000-4000-8000-00000000f005.jpg'
  returning 1
)
select is(count(*)::int, 0, 'a deactivated user can''t delete their picture') from removed;

reset role;

select results_eq(
  $$ select name from storage.objects where bucket_id = 'avatars' order by name $$,
  $$ values
       ('00000000-0000-4000-8000-00000000a004/00000000-0000-4000-8000-00000000f004.webp'),
       ('00000000-0000-4000-8000-00000000a005/00000000-0000-4000-8000-00000000f005.jpg') $$,
  'only the member''s own file was deleted'
);

select * from finish();
rollback;
