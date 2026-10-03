-- Heads-ups and events. Site editors manage them, everyone else reads
-- nothing, and the public site gets only what's live through two functions
-- that only the secret key can call.
begin;

create extension if not exists pgtap with schema extensions;

select plan(52);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000005e01', 'editor@example.test', '{"full_name": "Site Editor"}'),
  ('00000000-0000-4000-8000-000000005e02', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-000000005e03', 'finance@example.test', '{"full_name": "Finance Person"}'),
  ('00000000-0000-4000-8000-000000005e04', 'messages@example.test', '{"full_name": "Messages Person"}'),
  ('00000000-0000-4000-8000-000000005e05', 'removed@example.test', '{"full_name": "Removed Editor"}');

update public.users set roles = '{site_editor}' where id = '00000000-0000-4000-8000-000000005e01';
update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-000000005e02';
update public.users set roles = '{finance_viewer,finance_requester}' where id = '00000000-0000-4000-8000-000000005e03';
update public.users set roles = '{site_messages}' where id = '00000000-0000-4000-8000-000000005e04';
update public.users set roles = '{site_editor}', is_active = false where id = '00000000-0000-4000-8000-000000005e05';

-- A heads-up in each state, and events published, cancelled, and in draft.
insert into site.posts (id, title, body, status, pinned, starts_at, ends_at, created_by, updated_by) values
  (
    '00000000-0000-4000-8000-000000005b01', 'Live and pinned', 'Showing now.', 'published', true,
    now() - interval '1 day', now() + interval '6 days',
    '00000000-0000-4000-8000-000000005e02', '00000000-0000-4000-8000-000000005e02'
  ),
  (
    '00000000-0000-4000-8000-000000005b02', 'Scheduled', 'Starts tomorrow.', 'published', false,
    now() + interval '1 day', now() + interval '8 days',
    '00000000-0000-4000-8000-000000005e02', '00000000-0000-4000-8000-000000005e02'
  ),
  (
    '00000000-0000-4000-8000-000000005b03', 'Ended', 'Ended an hour ago.', 'published', false,
    now() - interval '8 days', now() - interval '1 hour',
    '00000000-0000-4000-8000-000000005e02', '00000000-0000-4000-8000-000000005e02'
  ),
  (
    '00000000-0000-4000-8000-000000005b04', 'Draft', 'Not posted yet.', 'draft', false,
    now() - interval '1 day', now() + interval '6 days',
    '00000000-0000-4000-8000-000000005e02', '00000000-0000-4000-8000-000000005e02'
  ),
  (
    '00000000-0000-4000-8000-000000005b05', 'Live and newer', 'Posted an hour ago.', 'published', false,
    now() - interval '1 hour', now() + interval '6 days',
    '00000000-0000-4000-8000-000000005e02', '00000000-0000-4000-8000-000000005e02'
  );

insert into site.events (
  id, slug, title, starts_at, ends_at, status, cancel_reason, created_by, updated_by, updated_at
) values
  (
    '00000000-0000-4000-8000-000000005c01', 'test-published', 'Published',
    now() + interval '3 days', now() + interval '3 days 3 hours', 'published', null,
    '00000000-0000-4000-8000-000000005e02', '00000000-0000-4000-8000-000000005e02', now() - interval '1 day'
  ),
  (
    '00000000-0000-4000-8000-000000005c02', 'test-cancelled', 'Cancelled',
    now() + interval '4 days', now() + interval '4 days 2 hours', 'cancelled', 'Rained out',
    '00000000-0000-4000-8000-000000005e02', '00000000-0000-4000-8000-000000005e02', now() - interval '1 day'
  ),
  (
    '00000000-0000-4000-8000-000000005c03', 'test-draft', 'Draft',
    now() + interval '5 days', now() + interval '5 days 2 hours', 'draft', null,
    '00000000-0000-4000-8000-000000005e02', '00000000-0000-4000-8000-000000005e02', now() - interval '1 day'
  ),
  (
    '00000000-0000-4000-8000-000000005c04', 'test-draft-two', 'Another draft',
    now() + interval '6 days', now() + interval '6 days 2 hours', 'draft', null,
    '00000000-0000-4000-8000-000000005e02', '00000000-0000-4000-8000-000000005e02', now() - interval '1 day'
  );

-- Who can reach what.
select ok(
  not has_schema_privilege('anon', 'site', 'usage'),
  'anon can''t reach the site schema at all'
);

select is_empty(
  $$ select c.relname, p.privilege
     from pg_class c
     cross join unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p (privilege)
     where c.relnamespace = 'site'::regnamespace
       and c.relkind in ('r', 'p', 'v', 'm')
       and has_table_privilege('service_role', c.oid, p.privilege) $$,
  'the secret key can''t touch the site tables, only call the public functions'
);

select ok(
  has_function_privilege('service_role', 'site.public_posts()', 'execute')
  and has_function_privilege('service_role', 'site.public_events()', 'execute'),
  'the secret key can call the public functions'
);

select is_empty(
  $$ select p.proname from pg_proc p
     where p.pronamespace = 'site'::regnamespace
       and p.proname not in ('triage_message', 'message_assignees', 'remove_photo', 'photo_uploads_open')
       and (has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('authenticated', p.oid, 'execute')) $$,
  'no client can call a site function but triage, its leader picker, photo removal, and the storage check for uploads'
);

select ok(
  pg_get_function_result('site.public_posts()'::regprocedure) !~ '_by\M'
  and pg_get_function_result('site.public_events()'::regprocedure) !~ '_by\M',
  'the public functions never say who wrote what'
);

-- The public site, through the secret key.
set local role service_role;

select results_eq(
  $$ select id from site.public_posts() where id::text like '%-000000005b%' $$,
  $$ values ('00000000-0000-4000-8000-000000005b01'::uuid), ('00000000-0000-4000-8000-000000005b05'::uuid) $$,
  'only posted heads-ups inside their dates are public, pinned first'
);

select set_eq(
  $$ select id from site.public_events() where id::text like '%-000000005c%' $$,
  array['00000000-0000-4000-8000-000000005c01', '00000000-0000-4000-8000-000000005c02']::uuid[],
  'published and cancelled events are public, drafts aren''t'
);

select results_eq(
  $$ select status::text, cancel_reason, sequence from site.public_events()
     where id = '00000000-0000-4000-8000-000000005c02' $$,
  $$ values ('cancelled', 'Rained out', 0) $$,
  'a cancelled event keeps its reason for the banner and its sequence for calendars'
);

select throws_ok('select 1 from site.posts', '42501', null, 'the secret key can''t read posts directly');
select throws_ok('select 1 from site.events', '42501', null, 'the secret key can''t read events directly');

reset role;

-- Visitors.
set local role anon;

select throws_ok('select 1 from site.posts', '42501', null, 'anon can''t read posts');
select throws_ok('select 1 from site.events', '42501', null, 'anon can''t read events');
select throws_ok('select 1 from site.public_events()', '42501', null, 'anon can''t call the public functions');

reset role;

-- People without the site editor role.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000005e03", "role": "authenticated"}', true);

select is_empty('select 1 from site.posts', 'finance roles read no heads-ups');
select is_empty('select 1 from site.events', 'finance roles read no events');
select throws_ok(
  $$ insert into site.posts (title, body) values ('Nope', 'Nope') $$,
  '42501', null, 'finance roles can''t post a heads-up'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000005e04", "role": "authenticated"}', true);

select is_empty(
  'select 1 from site.posts union all select 1 from site.events',
  'the Messages role alone reads no heads-ups or events'
);
select throws_ok(
  $$ insert into site.events (slug, title, starts_at, ends_at) values ('nope', 'Nope', now(), now()) $$,
  '42501', null, 'the Messages role alone can''t add an event'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000005e05", "role": "authenticated"}', true);

select is_empty(
  'select 1 from site.posts union all select 1 from site.events',
  'a site editor whose access was removed reads nothing'
);

-- Site editors.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000005e01", "role": "authenticated"}', true);

select is(
  (select count(*)::int from site.posts where id::text like '%-000000005b%'),
  5,
  'site editors see every heads-up, including drafts and ended ones'
);
select is(
  (select count(*)::int from site.events where id::text like '%-000000005c%'),
  4,
  'site editors see every event, including drafts'
);

select lives_ok(
  $$ insert into site.posts (id, title, body)
     values ('00000000-0000-4000-8000-000000005b06', 'Pizza after youth', 'Stay after for pizza.') $$,
  'site editors post heads-ups'
);
select results_eq(
  $$ select created_by, updated_by, status::text, tone::text, ends_at - starts_at
     from site.posts where id = '00000000-0000-4000-8000-000000005b06' $$,
  $$ values (
       '00000000-0000-4000-8000-000000005e01'::uuid, '00000000-0000-4000-8000-000000005e01'::uuid,
       'draft', 'info', interval '7 days'
     ) $$,
  'a new heads-up names its writer, starts as a draft, and runs a week'
);
select throws_ok(
  $$ insert into site.posts (title, body, created_by)
     values ('Spoof', 'Spoof', '00000000-0000-4000-8000-000000005e02') $$,
  '42501', null, 'no one can post as someone else'
);

-- Editing an event bumps its sequence, so subscribed calendars update.
select lives_ok(
  $$ update site.events set title = 'Published, renamed' where id = '00000000-0000-4000-8000-000000005c01' $$,
  'site editors edit events'
);
select results_eq(
  $$ select sequence, updated_by, updated_at = now()
     from site.events where id = '00000000-0000-4000-8000-000000005c01' $$,
  $$ values (1, '00000000-0000-4000-8000-000000005e01'::uuid, true) $$,
  'an edit bumps the sequence and names the editor'
);

update site.events set body = 'Bring a friend.' where id = '00000000-0000-4000-8000-000000005c01';
update site.events set body = 'Bring a friend.' where id = '00000000-0000-4000-8000-000000005c01';

select is(
  (select sequence from site.events where id = '00000000-0000-4000-8000-000000005c01'),
  2,
  'every real edit bumps the sequence, and saving with no change doesn''t'
);
select throws_ok(
  $$ update site.events set sequence = 0 where id = '00000000-0000-4000-8000-000000005c01' $$,
  '42501', null, 'no one sets the sequence by hand'
);

-- Only drafts can be deleted. Anything posted is ended or cancelled instead.
select throws_ok(
  $$ delete from site.events where id = '00000000-0000-4000-8000-000000005c01' $$,
  '55000', 'Only a draft event can be deleted. Cancel it instead.', 'deleting a published event fails'
);
select throws_ok(
  $$ delete from site.posts where id = '00000000-0000-4000-8000-000000005b03' $$,
  '55000', 'Only a draft heads-up can be deleted. End it instead.',
  'a posted heads-up can''t be deleted, even once it ends'
);
select lives_ok(
  $$ delete from site.events where id = '00000000-0000-4000-8000-000000005c03';
     delete from site.posts where id = '00000000-0000-4000-8000-000000005b04' $$,
  'site editors delete drafts'
);
select is_empty(
  $$ select 1 from site.events where id = '00000000-0000-4000-8000-000000005c03'
     union all select 1 from site.posts where id = '00000000-0000-4000-8000-000000005b04' $$,
  'the drafts are gone'
);

-- Cancelling.
select lives_ok(
  $$ update site.events set status = 'cancelled', cancel_reason = 'Snow day'
     where id = '00000000-0000-4000-8000-000000005c01' $$,
  'site editors cancel events'
);
select throws_ok(
  $$ update site.events set status = 'draft', cancel_reason = null where id = '00000000-0000-4000-8000-000000005c01' $$,
  '55000', 'An event that''s been published can''t go back to a draft.', 'a cancelled event can''t go back to a draft'
);
select throws_ok(
  $$ update site.events set cancel_reason = 'Oops' where id = '00000000-0000-4000-8000-000000005c04' $$,
  '23514', null, 'only a cancelled event has a reason'
);
select throws_ok(
  $$ update site.events set status = 'cancelled' where id = '00000000-0000-4000-8000-000000005c04' $$,
  '55000', 'Only a published event can be cancelled. Delete the draft instead.',
  'a draft can''t be cancelled, since nobody heard about it'
);
select lives_ok(
  $$ update site.events set status = 'published', cancel_reason = null
     where id = '00000000-0000-4000-8000-000000005c02' $$,
  'a cancelled event can be put back on'
);

-- What the columns accept.
select throws_ok(
  $$ insert into site.events (slug, title, starts_at, ends_at) values ('weekly-friday', 'Clash', now(), now()) $$,
  '23514', null, 'weekly- slugs belong to the weekly gatherings'
);
select throws_ok(
  $$ insert into site.events (slug, title, starts_at, ends_at) values ('Bad Slug', 'Bad', now(), now()) $$,
  '23514', null, 'slugs are lowercase words and dashes'
);
select throws_ok(
  $$ insert into site.events (slug, title, starts_at, ends_at) values ('test-draft-two', 'Twin', now(), now()) $$,
  '23505', null, 'two events can''t share a slug'
);
select throws_ok(
  $$ insert into site.events (slug, title, starts_at, ends_at)
     values ('backwards', 'Backwards', now(), now() - interval '1 hour') $$,
  '23514', null, 'an event can''t end before it starts'
);
select throws_ok(
  $$ insert into site.posts (title, body, starts_at, ends_at) values ('Backwards', 'x', now(), now()) $$,
  '23514', null, 'a heads-up ends after it starts'
);
select throws_ok(
  $$ insert into site.posts (title, body) values ('   ', 'x') $$,
  '23514', null, 'a heads-up needs a title'
);
select throws_ok(
  $$ insert into site.posts (title, body) values (repeat('x', 81), 'x') $$,
  '23514', null, 'heads-up titles stop at 80 characters'
);
select throws_ok(
  $$ insert into site.posts (title, body) values ('Long', repeat('x', 281)) $$,
  '23514', null, 'heads-up bodies stop at 280 characters'
);
select throws_ok(
  $$ insert into site.posts (title, body, link_url) values ('Link', 'x', 'javascript:alert(1)') $$,
  '23514', null, 'links are https or a page on the site'
);
select throws_ok(
  $$ insert into site.posts (title, body, link_url) values ('Link', 'x', '//example.com') $$,
  '23514', null, 'a link can''t reach another site with //'
);
select lives_ok(
  $$ insert into site.posts (title, body, link_url, link_label)
     values ('Link', 'x', '/events/test-draft-two', 'See it'), ('Link', 'x', 'https://example.com/form', null) $$,
  'a page on the site or an https link is fine, with or without a label'
);

-- Owners count as site editors.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000005e02", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into site.events (slug, title, starts_at, ends_at) values ('owner-night', 'Owner night', now(), now()) $$,
  'owners manage events too'
);

reset role;

-- Activity.
select results_eq(
  $$ select actor_id, scope, entity_name from public.activity_log
     where entity_id = '00000000-0000-4000-8000-000000005b06' and action = 'post.created' $$,
  $$ values ('00000000-0000-4000-8000-000000005e01'::uuid, 'site', 'Pizza after youth') $$,
  'a new heads-up is logged as site activity by its writer'
);
select is(
  (select count(*)::int from public.activity_log
   where entity_id = '00000000-0000-4000-8000-000000005c01' and action = 'event.updated'),
  3,
  'every edit to an event is logged, even one only to its details'
);
select ok(
  not exists (select 1 from public.activity_log where entity_type = 'event' and changes ? 'body'),
  'an event''s long details stay out of the log'
);

select * from finish();
rollback;
