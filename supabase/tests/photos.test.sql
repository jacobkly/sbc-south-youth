-- Site photos: the public site-photos bucket and the rows behind it. Site
-- editors upload and place photos, as WebP or (from Safari) JPEG, uploads
-- stop when storage nears the free
-- plan's limit, a photo comes down only through site.remove_photo(), which
-- keeps a tombstone, and the public site reads placed photos only through
-- site.public_photos().
begin;

create extension if not exists pgtap with schema extensions;

select plan(57);

-- Fake people, one per kind of access.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'editor@example.test', '{"full_name": "Test Editor"}'),
  ('00000000-0000-4000-8000-00000000a003', 'messages@example.test', '{"full_name": "Test Messages"}'),
  ('00000000-0000-4000-8000-00000000a004', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a005', 'former@example.test', '{"full_name": "Former Editor"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{site_editor}' where id in (
  '00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000a005'
);
update public.users set roles = '{site_messages}' where id = '00000000-0000-4000-8000-00000000a003';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a004';
update public.users set is_active = false where id = '00000000-0000-4000-8000-00000000a005';

-- Only these files and this history. Files are deleted the way the Storage
-- API does.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects;
delete from public.activity_log;

-- An event with a page and a draft that has none.
insert into site.events (id, slug, title, starts_at, ends_at, status) values
  ('00000000-0000-4000-8000-00000000e001', 'test-retreat', 'Test Retreat',
   now() + interval '7 days', now() + interval '9 days', 'published'),
  ('00000000-0000-4000-8000-00000000e002', 'test-draft', 'Test Draft',
   now() + interval '14 days', now() + interval '14 days', 'draft');

-- A photo takedown request and a plain message.
insert into site.messages (id, kind, name, email, message) values
  ('00000000-0000-4000-8000-00000000d001', 'takedown', 'Tess Takedown', 'tess@example.test', 'Please take one down.'),
  ('00000000-0000-4000-8000-00000000d002', 'contact', 'Cal Contact', 'cal@example.test', 'Hello there.');

-- Files already up for the photos added further down.
insert into storage.objects (bucket_id, name, metadata) values
  ('site-photos', '00000000-0000-4000-8000-00000000f003/lg.webp', '{"size": 250000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f003/sm.webp', '{"size": 50000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f004/lg.webp', '{"size": 250000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f004/sm.webp', '{"size": 50000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f006/lg.webp', '{"size": 250000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f006/sm.webp', '{"size": 50000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f007/lg.jpg', '{"size": 250000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f007/sm.jpg', '{"size": 50000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f008/lg.webp', '{"size": 250000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f008/sm.webp', '{"size": 50000}');

-- 1. The bucket.
select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'site-photos' $$,
  $$ values (true, 1048576::bigint, array['image/webp', 'image/jpeg']) $$,
  'site-photos is public, takes only WebP and JPEG, and caps each file at 1 MB'
);

-- 2–3. As anon. Public files load by URL, but nobody signed out lists or adds them.
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'site-photos' $$,
  'anon can''t list photo files'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('site-photos', '00000000-0000-4000-8000-00000000f001/lg.webp') $$,
  '42501',
  null,
  'anon can''t upload photos'
);

-- 4–11. As a site editor: uploads and new photos.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata) values
       ('site-photos', '00000000-0000-4000-8000-00000000f001/lg.webp', '{"size": 300000}'),
       ('site-photos', '00000000-0000-4000-8000-00000000f001/sm.webp', '{"size": 60000}') $$,
  'a site editor uploads both sizes of a photo into its own folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('site-photos', 'loose.webp') $$,
  '42501',
  null,
  'a photo file goes in a folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('site-photos', 'jo-at-the-retreat/lg.webp') $$,
  '42501',
  null,
  'the folder is a random id, never a name'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('site-photos', '00000000-0000-4000-8000-00000000f001/original.jpg') $$,
  '42501',
  null,
  'only the lg and sm sizes go up'
);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('site-photos', '00000000-0000-4000-8000-00000000f002/lg.webp', '{"size": 300000}') $$,
  'one size of another photo goes up'
);

select throws_ok(
  $$ insert into site.photos (id, alt, width, height)
     values ('00000000-0000-4000-8000-00000000f002', 'A band on a stage', 1600, 1067) $$,
  '23503',
  'Upload both sizes of the photo first.',
  'a photo''s row waits for both of its files'
);

select lives_ok(
  $$ insert into site.photos (id, alt, spot, width, height)
     values ('00000000-0000-4000-8000-00000000f001', 'Hands raised during worship', 'home-hero', 1600, 1067) $$,
  'a site editor adds a photo once its files are up'
);

select results_eq(
  $$ select status::text, spot, uploaded_by, bytes_total, mime_type from site.photos
     where id = '00000000-0000-4000-8000-00000000f001' $$,
  $$ values ('published', 'home-hero', '00000000-0000-4000-8000-00000000a002'::uuid, 360000, 'image/webp') $$,
  'a new photo is published, names who uploaded it, and takes its bytes and type from its files'
);

-- 12–15. Safari can't make WebP, so its sizes go up as JPEG. Either way, a
-- photo's folder holds just its two files, of one type.
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata) values
       ('site-photos', '00000000-0000-4000-8000-00000000f00a/lg.jpg', '{"size": 230000}'),
       ('site-photos', '00000000-0000-4000-8000-00000000f00a/sm.jpg', '{"size": 50000}');
     insert into site.photos (id, alt, width, height)
     values ('00000000-0000-4000-8000-00000000f00a', 'Sunset over a parking lot', 1600, 1200) $$,
  'a site editor adds a photo whose sizes are JPEG'
);

select results_eq(
  $$ select mime_type, bytes_total from site.photos where id = '00000000-0000-4000-8000-00000000f00a' $$,
  $$ values ('image/jpeg', 280000) $$,
  'a JPEG photo is marked as JPEG'
);

insert into storage.objects (bucket_id, name, metadata) values
  ('site-photos', '00000000-0000-4000-8000-00000000f00b/lg.webp', '{"size": 300000}'),
  ('site-photos', '00000000-0000-4000-8000-00000000f00b/sm.jpg', '{"size": 50000}');

select throws_ok(
  $$ insert into site.photos (id, alt, width, height)
     values ('00000000-0000-4000-8000-00000000f00b', 'A band on a stage', 1600, 1067) $$,
  '23503',
  'Upload both sizes of the photo first.',
  'a photo''s two sizes are the same type'
);

insert into storage.objects (bucket_id, name, metadata)
values ('site-photos', '00000000-0000-4000-8000-00000000f00b/sm.webp', '{"size": 50000}');

select throws_ok(
  $$ insert into site.photos (id, alt, width, height)
     values ('00000000-0000-4000-8000-00000000f00b', 'A band on a stage', 1600, 1067) $$,
  '23503',
  'Upload both sizes of the photo first.',
  'a photo''s folder holds only its two files'
);

-- 16–18. What the browser can't set.
select throws_ok(
  $$ insert into site.photos (id, alt, width, height, bytes_total, uploaded_by)
     values ('00000000-0000-4000-8000-00000000f003', 'Friends around a campfire', 1600, 1067, 1,
             '00000000-0000-4000-8000-00000000a001') $$,
  '42501',
  null,
  'the database sets the size and uploader, not the browser'
);

select throws_ok(
  $$ insert into site.photos (id, alt, width, height, mime_type)
     values ('00000000-0000-4000-8000-00000000f003', 'Friends around a campfire', 1600, 1067, 'image/jpeg') $$,
  '42501',
  null,
  'the database sets the file type, not the browser'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('site-photos', '00000000-0000-4000-8000-00000000f001/sm.webp') $$,
  '42501',
  null,
  'a photo''s files can''t be replaced once it''s added'
);

-- 19–21. Alt text, spots, and covers.
select throws_ok(
  $$ insert into site.photos (id, alt, width, height)
     values ('00000000-0000-4000-8000-00000000f003', '   ', 1600, 1067) $$,
  '23514',
  null,
  'every photo needs alt text'
);

select throws_ok(
  $$ insert into site.photos (id, alt, spot, event_id, width, height)
     values ('00000000-0000-4000-8000-00000000f003', 'Friends around a campfire', 'give',
             '00000000-0000-4000-8000-00000000e001', 1600, 1067) $$,
  '23514',
  null,
  'a photo fills a spot or covers an event, not both'
);

select throws_ok(
  $$ insert into site.photos (id, alt, spot, width, height)
     values ('00000000-0000-4000-8000-00000000f003', 'Friends around a campfire', 'Home Hero', 1600, 1067) $$,
  '23514',
  null,
  'a spot is a short lowercase key'
);

-- 22–25. One photo per spot and per event: a new one moves the old one out.
select lives_ok(
  $$ insert into site.photos (id, alt, event_id, width, height)
     values ('00000000-0000-4000-8000-00000000f003', 'Friends around a campfire',
             '00000000-0000-4000-8000-00000000e001', 1600, 1067) $$,
  'a photo can be an event''s cover'
);

select lives_ok(
  $$ insert into site.photos (id, alt, event_id, width, height)
     values ('00000000-0000-4000-8000-00000000f004', 'A cabin in the trees',
             '00000000-0000-4000-8000-00000000e001', 1600, 1067) $$,
  'a new cover for the same event goes in'
);

select results_eq(
  $$ select id, event_id from site.photos
     where id in ('00000000-0000-4000-8000-00000000f003', '00000000-0000-4000-8000-00000000f004') order by id $$,
  $$ values ('00000000-0000-4000-8000-00000000f003'::uuid, null::uuid),
            ('00000000-0000-4000-8000-00000000f004'::uuid, '00000000-0000-4000-8000-00000000e001'::uuid) $$,
  'and the old cover goes back to the library'
);

select lives_ok(
  $$ update site.photos set spot = 'parents-photos', alt = 'Hands raised in worship'
     where id = '00000000-0000-4000-8000-00000000f001' $$,
  'a site editor moves a photo and fixes its alt text'
);

-- 26–30. Placing the rest, then what an editor can't do.
select lives_ok(
  $$ insert into site.photos (id, alt, spot, width, height) values
       ('00000000-0000-4000-8000-00000000f007', 'A crowd under stage lights', 'home-hero', 1600, 900);
     insert into site.photos (id, alt, event_id, width, height) values
       ('00000000-0000-4000-8000-00000000f006', 'Camp chairs by a bonfire', '00000000-0000-4000-8000-00000000e002', 1600, 1067);
     insert into site.photos (id, alt, width, height) values
       ('00000000-0000-4000-8000-00000000f008', 'A latte being poured', 1200, 1600);
     update site.photos set event_id = '00000000-0000-4000-8000-00000000e001'
     where id = '00000000-0000-4000-8000-00000000f003' $$,
  'a site editor fills the home hero, a draft''s cover, and the library, and puts the first cover back'
);

select results_eq(
  $$ select event_id from site.photos where id = '00000000-0000-4000-8000-00000000f004' $$,
  $$ values (null::uuid) $$,
  'putting a cover back on an event moves the newer one out'
);

select throws_ok(
  $$ update site.photos set status = 'removed' where id = '00000000-0000-4000-8000-00000000f001' $$,
  '42501',
  null,
  'a photo comes down only through site.remove_photo()'
);

select throws_ok(
  $$ delete from site.photos where id = '00000000-0000-4000-8000-00000000f001' $$,
  '42501',
  null,
  'nobody deletes a photo''s row'
);

delete from storage.objects
where bucket_id = 'site-photos' and name like '00000000-0000-4000-8000-00000000f001/%';

select results_eq(
  $$ select count(*)::integer from storage.objects
     where bucket_id = 'site-photos' and name like '00000000-0000-4000-8000-00000000f001/%' $$,
  $$ values (2) $$,
  'a published photo''s files stay put'
);

-- 31–33. Storage near the free plan's limit. Exactly 1 byte short of 95% of
-- 1 GB, a file still goes up. At 95%, the next one doesn't.
reset role;
insert into storage.buckets (id, name, public) values ('test-filler', 'test-filler', false);
insert into storage.objects (bucket_id, name, metadata)
select 'test-filler', 'filler', jsonb_build_object('size', 949999999 - sum(coalesce((metadata ->> 'size')::bigint, 0)))
from storage.objects;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('site-photos', '00000000-0000-4000-8000-00000000f002/sm.webp', '{"size": 1}') $$,
  'just under 95% of the plan, photos still go up'
);

select is(site.photo_uploads_open(), false, 'at 95% of the plan, photo uploads are closed');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('site-photos', '00000000-0000-4000-8000-00000000f005/lg.webp', '{"size": 300000}') $$,
  '42501',
  null,
  'at 95% of the plan, a new photo can''t go up, so receipts keep their room'
);

reset role;
delete from storage.objects where bucket_id = 'test-filler';
set local role authenticated;

-- 34–38. Other roles see and change nothing.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated"}', true);

select is_empty($$ select 1 from site.photos $$, 'a finance viewer reads no photos');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('site-photos', '00000000-0000-4000-8000-00000000f009/lg.webp') $$,
  '42501',
  null,
  'a finance viewer can''t upload photos'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated"}', true);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('site-photos', '00000000-0000-4000-8000-00000000f009/lg.webp') $$,
  '42501',
  null,
  'a site editor whose access was removed can''t upload photos'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is_empty($$ select 1 from site.photos $$, 'the Messages role reads no photos on its own');

select throws_ok(
  $$ select site.remove_photo('00000000-0000-4000-8000-00000000f001', 'Asked to take it down') $$,
  '42501',
  'Only a site editor can take a photo down.',
  'the Messages role can''t take a photo down'
);

-- 39–48. A site editor takes a photo down.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select throws_ok(
  $$ select site.remove_photo('00000000-0000-4000-8000-00000000f001', '  ') $$,
  '22023',
  'Say why it''s coming down.',
  'taking a photo down needs a reason'
);

select throws_ok(
  $$ select site.remove_photo('00000000-0000-4000-8000-00000000f001', repeat('a', 201)) $$,
  '22023',
  'Keep the reason under 200 characters.',
  'the reason is short'
);

select throws_ok(
  $$ select site.remove_photo('00000000-0000-4000-8000-00000000f001', 'Asked to take it down',
                              '00000000-0000-4000-8000-00000000d002') $$,
  '22023',
  'Link a photo takedown request, or leave it out.',
  'only a takedown request can be linked'
);

select throws_ok(
  $$ select site.remove_photo('00000000-0000-4000-8000-00000000f009', 'Asked to take it down') $$,
  'P0002',
  'That photo doesn''t exist.',
  'a missing photo can''t come down'
);

select lives_ok(
  $$ select site.remove_photo('00000000-0000-4000-8000-00000000f001', '  A parent asked us to take it down.  ',
                              '00000000-0000-4000-8000-00000000d001') $$,
  'a site editor takes a photo down for a takedown request'
);

select results_eq(
  $$ select status::text, spot, removed_by, removed_reason, removed_at is not null, takedown_message_id
     from site.photos where id = '00000000-0000-4000-8000-00000000f001' $$,
  $$ values ('removed', null::text, '00000000-0000-4000-8000-00000000a002'::uuid, 'A parent asked us to take it down.',
             true, '00000000-0000-4000-8000-00000000d001'::uuid) $$,
  'the tombstone keeps who took it down, why, and the request, and gives up its spot'
);

select throws_ok(
  $$ select site.remove_photo('00000000-0000-4000-8000-00000000f001', 'Again') $$,
  '55000',
  'That photo is already down.',
  'a photo comes down once'
);

update site.photos set alt = 'Changed' where id = '00000000-0000-4000-8000-00000000f001';

select results_eq(
  $$ select alt from site.photos where id = '00000000-0000-4000-8000-00000000f001' $$,
  $$ values ('Hands raised in worship') $$,
  'a tombstone can''t be edited'
);

delete from storage.objects
where bucket_id = 'site-photos' and name like '00000000-0000-4000-8000-00000000f001/%';

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'site-photos' and name like '00000000-0000-4000-8000-00000000f001/%' $$,
  'a removed photo''s files can be deleted'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('site-photos', '00000000-0000-4000-8000-00000000f001/lg.webp') $$,
  '42501',
  null,
  'a removed photo''s files can''t come back'
);

-- 49. The Messages role sees what came down for a request, to close it.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select results_eq(
  $$ select id, status::text from site.photos $$,
  $$ values ('00000000-0000-4000-8000-00000000f001'::uuid, 'removed') $$,
  'the Messages role sees only photos taken down for a request'
);

-- 50–51. Activity, under the site scope.
reset role;

select bag_eq(
  $$ select scope, action, actor_id, entity_name from public.activity_log
     where entity_type = 'photo' and entity_id = '00000000-0000-4000-8000-00000000f001' $$,
  $$ values ('site', 'photo.created', '00000000-0000-4000-8000-00000000a002'::uuid, 'Hands raised during worship'),
            ('site', 'photo.updated', '00000000-0000-4000-8000-00000000a002'::uuid, 'Hands raised in worship'),
            ('site', 'photo.updated', '00000000-0000-4000-8000-00000000a002'::uuid, 'Hands raised in worship') $$,
  'Activity shows the photo going up, moving, and coming down, by who did it'
);

select is(
  (select changes from public.activity_log
   where entity_type = 'photo' and entity_id = '00000000-0000-4000-8000-00000000f001'
     and action = 'photo.updated' and changes ? 'status'),
  '{"spot": {"from": "parents-photos", "to": null},
    "status": {"from": "published", "to": "removed"},
    "removed_reason": {"from": null, "to": "A parent asked us to take it down."}}'::jsonb,
  'Activity shows the photo coming down, the spot it left, and why'
);

-- 52–54. The public site's read.
select results_eq(
  $$ select r.rolname
     from (values ('anon'), ('authenticated'), ('service_role')) as r (rolname)
     where has_function_privilege(r.rolname, 'site.public_photos()', 'execute') $$,
  $$ values ('service_role') $$,
  'only the site''s server reads photos for the public pages'
);

set local role service_role;

select throws_ok(
  $$ select 1 from site.photos $$,
  '42501',
  null,
  'the secret key can''t read the photos table'
);

select results_eq(
  $$ select id, spot, event_id, alt, width, height, mime_type from site.public_photos() $$,
  $$ values ('00000000-0000-4000-8000-00000000f007'::uuid, 'home-hero', null::uuid, 'A crowd under stage lights',
             1600, 900, 'image/jpeg'),
            ('00000000-0000-4000-8000-00000000f003'::uuid, null, '00000000-0000-4000-8000-00000000e001'::uuid,
             'Friends around a campfire', 1600, 1067, 'image/webp') $$,
  'the public site gets placed photos only: no tombstones, no library, no draft''s cover'
);

-- 55–57. Tombstones go after 2 years.
reset role;

update site.photos
set status = 'removed', removed_at = now(), removed_reason = 'Out of date'
where id = '00000000-0000-4000-8000-00000000f008';

update site.photos set removed_at = now() - interval '2 years 1 day'
where id = '00000000-0000-4000-8000-00000000f001';

select is(site.prune_removed_photos(), 1, 'tombstones older than 2 years go');

select results_eq(
  $$ select id from site.photos where status = 'removed' $$,
  $$ values ('00000000-0000-4000-8000-00000000f008'::uuid) $$,
  'newer tombstones stay'
);

select results_eq(
  $$ select r.rolname
     from (values ('anon'), ('authenticated'), ('service_role')) as r (rolname)
     where has_function_privilege(r.rolname, 'site.prune_removed_photos()', 'execute')
     union all
     select jobname from cron.job where jobname = 'prune-removed-photos' and schedule = '25 10 * * *' $$,
  $$ values ('prune-removed-photos') $$,
  'only the nightly job prunes tombstones, after the other jobs'
);

select * from finish();
rollback;
