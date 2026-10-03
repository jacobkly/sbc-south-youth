-- Photos that are down but whose files are still stored, because deleting
-- them failed after the photo came down. Only site editors see them, to
-- delete the files again.
begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- Fake people.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a002', 'editor@example.test', '{"full_name": "Test Editor"}'),
  ('00000000-0000-4000-8000-00000000a003', 'messages@example.test', '{"full_name": "Test Messages"}'),
  ('00000000-0000-4000-8000-00000000a005', 'former@example.test', '{"full_name": "Former Editor"}');

update public.users set roles = '{site_editor}' where id in (
  '00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000a005'
);
update public.users set roles = '{site_messages}' where id = '00000000-0000-4000-8000-00000000a003';
update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a005';

-- Only these files. Files are deleted the way the Storage API does.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects;

insert into storage.objects (bucket_id, name, metadata) values
  ('site-photos', '00000000-0000-4000-8000-00000000f001/lg.webp', '{"size": 250000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f001/sm.webp', '{"size": 50000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f002/lg.jpg', '{"size": 250000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f002/sm.jpg', '{"size": 50000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f003/lg.webp', '{"size": 250000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f003/sm.webp', '{"size": 50000}');

-- One up, one down with its files left, and one down with its files gone.
insert into site.photos (id, alt, width, height) values
  ('00000000-0000-4000-8000-00000000f001', 'A crowd under stage lights', 1600, 900),
  ('00000000-0000-4000-8000-00000000f002', 'Friends around a campfire', 1600, 1067),
  ('00000000-0000-4000-8000-00000000f003', 'A latte', 1200, 1600);

-- The one with its files left came down for a takedown request.
insert into site.messages (id, kind, name, email, message) values
  ('00000000-0000-4000-8000-00000000d001', 'takedown', 'Tess Takedown', 'tess@example.test', 'Please take one down.');

update site.photos
set status = 'removed', removed_at = now(), removed_reason = 'Asked to take it down'
where id in ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000f003');

update site.photos set takedown_message_id = '00000000-0000-4000-8000-00000000d001'
where id = '00000000-0000-4000-8000-00000000f002';

delete from storage.objects where name like '00000000-0000-4000-8000-00000000f003/%';

-- 1. Who can call it.
select results_eq(
  $$ select r.rolname
     from (values ('anon'), ('authenticated'), ('service_role')) as r (rolname)
     where has_function_privilege(r.rolname, 'site.photos_with_files_left()', 'execute') $$,
  $$ values ('authenticated') $$,
  'only signed-in people call it'
);

-- 2. A site editor.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select results_eq(
  $$ select id, mime_type from site.photos_with_files_left() $$,
  $$ values ('00000000-0000-4000-8000-00000000f002'::uuid, 'image/jpeg') $$,
  'a site editor sees the photo that''s down with its files left, and their type'
);

-- 3. A site editor whose access was removed.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from site.photos_with_files_left() $$,
  'a site editor whose access was removed sees none'
);

-- 4. The Messages role, which sees photos taken down for a request but not their files.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from site.photos_with_files_left() $$,
  'the Messages role sees none'
);

-- 5. Signed out.
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$ select 1 from site.photos_with_files_left() $$,
  '42501',
  null,
  'anon can''t call it'
);

select * from finish();
rollback;
