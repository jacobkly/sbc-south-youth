-- Heads-up photos: a site editor puts one photo from the library on a
-- heads-up, the way a photo takes a spot or an event's cover, and the
-- public site gets it while the heads-up is published and hasn't come down.
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

-- Fake people: a site editor and someone with Messages only.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'editor@example.test', '{"full_name": "Test Editor"}'),
  ('00000000-0000-4000-8000-00000000a002', 'messages@example.test', '{"full_name": "Test Messages"}');

update public.users set roles = '{site_editor}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{site_messages}' where id = '00000000-0000-4000-8000-00000000a002';

-- Heads-ups: up now, a draft, one that came down, one that goes up
-- tomorrow, another draft, and another that's up.
insert into site.posts (id, title, body, status, starts_at, ends_at) values
  ('00000000-0000-4000-8000-00000000c001', 'Test merch is here', '', 'published',
   now() - interval '1 day', now() + interval '6 days'),
  ('00000000-0000-4000-8000-00000000c002', 'Test draft', '', 'draft', now(), now() + interval '7 days'),
  ('00000000-0000-4000-8000-00000000c003', 'Test came down', '', 'published',
   now() - interval '9 days', now() - interval '2 days'),
  ('00000000-0000-4000-8000-00000000c004', 'Test goes up tomorrow', '', 'published',
   now() + interval '1 day', now() + interval '8 days'),
  ('00000000-0000-4000-8000-00000000c005', 'Test other draft', '', 'draft', now(), now() + interval '7 days'),
  ('00000000-0000-4000-8000-00000000c006', 'Test also up', '', 'published',
   now() - interval '1 hour', now() + interval '2 days');

-- Library photos with their files, and one in a spot.
insert into storage.objects (bucket_id, name, metadata)
select 'site-photos', '00000000-0000-4000-8000-00000000f10' || n || '/' || size || '.webp', '{"size": 1000}'
from generate_series(1, 6) as n, unnest(array['lg', 'sm']) as size;

insert into site.photos (id, alt, width, height)
select ('00000000-0000-4000-8000-00000000f10' || n)::uuid, 'A test photo ' || n, 1600, 1067
from generate_series(1, 6) as n;

update site.photos set spot = 'home-hero' where id = '00000000-0000-4000-8000-00000000f105';

-- 1. The grant.
select results_eq(
  $$ select has_column_privilege('authenticated', 'site.photos', 'post_id', 'update'),
            has_column_privilege('authenticated', 'site.photos', 'post_id', 'insert') $$,
  $$ values (true, false) $$,
  'a photo goes on a heads-up from the library, and RLS leaves that to site editors'
);

-- 2–9. As a site editor.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select lives_ok(
  $$ update site.photos set post_id = '00000000-0000-4000-8000-00000000c001'
     where id = '00000000-0000-4000-8000-00000000f101' $$,
  'a site editor puts a library photo on a heads-up'
);

select throws_ok(
  $$ update site.photos set post_id = '00000000-0000-4000-8000-00000000c002'
     where id = '00000000-0000-4000-8000-00000000f105' $$,
  '23514',
  null,
  'a photo in a spot can''t go on a heads-up too'
);

select lives_ok(
  $$ update site.photos set post_id = '00000000-0000-4000-8000-00000000c001'
     where id = '00000000-0000-4000-8000-00000000f102' $$,
  'another photo goes on the same heads-up'
);

select results_eq(
  $$ select id, post_id from site.photos
     where id in ('00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-00000000f102') order by id $$,
  $$ values ('00000000-0000-4000-8000-00000000f101'::uuid, null::uuid),
            ('00000000-0000-4000-8000-00000000f102'::uuid, '00000000-0000-4000-8000-00000000c001'::uuid) $$,
  'and the one it had goes back to the library'
);

select lives_ok(
  $$ update site.photos set post_id = '00000000-0000-4000-8000-00000000c002'
     where id = '00000000-0000-4000-8000-00000000f102' $$,
  'a photo moves to another heads-up'
);

select results_eq(
  $$ select post_id from site.photos
     where post_id in ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c002') $$,
  $$ values ('00000000-0000-4000-8000-00000000c002'::uuid) $$,
  'and leaves the first one without a photo'
);

select lives_ok(
  $$ delete from site.posts where id = '00000000-0000-4000-8000-00000000c002' $$,
  'a site editor deletes a draft with a photo'
);

select results_eq(
  $$ select post_id from site.photos where id = '00000000-0000-4000-8000-00000000f102' $$,
  $$ values (null::uuid) $$,
  'and its photo goes back to the library'
);

-- 10. Someone without Site editor can't place photos.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

update site.photos set post_id = '00000000-0000-4000-8000-00000000c004'
where id = '00000000-0000-4000-8000-00000000f103';

reset role;

select results_eq(
  $$ select post_id from site.photos where id = '00000000-0000-4000-8000-00000000f103' $$,
  $$ values (null::uuid) $$,
  'Messages alone can''t put a photo on a heads-up'
);

-- 11–14. Filling the rest as the site editor, then taking one down.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select lives_ok(
  $$ update site.photos set post_id = '00000000-0000-4000-8000-00000000c001'
     where id = '00000000-0000-4000-8000-00000000f101';
     update site.photos set post_id = '00000000-0000-4000-8000-00000000c004'
     where id = '00000000-0000-4000-8000-00000000f103';
     update site.photos set post_id = '00000000-0000-4000-8000-00000000c003'
     where id = '00000000-0000-4000-8000-00000000f104';
     update site.photos set post_id = '00000000-0000-4000-8000-00000000c005'
     where id = '00000000-0000-4000-8000-00000000f102';
     update site.photos set post_id = '00000000-0000-4000-8000-00000000c006'
     where id = '00000000-0000-4000-8000-00000000f106' $$,
  'a site editor puts photos on heads-ups that are up, scheduled, came down, and a draft'
);

select lives_ok(
  $$ select site.remove_photo('00000000-0000-4000-8000-00000000f106', 'Asked to take it down') $$,
  'a site editor takes down a heads-up''s photo'
);

reset role;

select results_eq(
  $$ select status::text, post_id from site.photos where id = '00000000-0000-4000-8000-00000000f106' $$,
  $$ values ('removed', null::uuid) $$,
  'and it comes off the heads-up'
);

select results_eq(
  $$ select changes -> 'post_id' from public.activity_log
     where entity_type = 'photo' and entity_id = '00000000-0000-4000-8000-00000000f103'
       and action = 'photo.updated' and changes ? 'post_id' $$,
  $$ values ('{"from": null, "to": "00000000-0000-4000-8000-00000000c004"}'::jsonb) $$,
  'Activity shows which heads-up a photo went on'
);

-- 15. The public site's read.
set local role service_role;

select results_eq(
  $$ select id, post_id from site.public_photos() where post_id is not null order by id $$,
  $$ values ('00000000-0000-4000-8000-00000000f101'::uuid, '00000000-0000-4000-8000-00000000c001'::uuid),
            ('00000000-0000-4000-8000-00000000f103'::uuid, '00000000-0000-4000-8000-00000000c004'::uuid) $$,
  'the public site gets photos of published heads-ups that haven''t come down, not drafts or past ones'
);

reset role;

select * from finish();
rollback;
