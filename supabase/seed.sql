-- Fake data for the local stack, loaded by `npx supabase db reset`.
--
-- Local only. It creates sign-ins with a known password, so never load it into
-- the hosted project (`db push` leaves it out unless given --include-seed).
--
-- Sign in to finances (http://localhost:3000) or the portal
-- (http://portal.localhost:3001) with the password local-dev-password as:
--   alex@example.test   owner (also a payee, to try self-approval)
--   sam@example.test    finance viewer
--   jo@example.test     site editor and messages, so the portal only
--   riley@example.test  requester only, so finances only
--
-- Dates count back from today, so the dashboard always has recent activity.

-- Auth users, with the columns GoTrue needs for email and password sign-in.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('local-dev-password', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from (values
  ('00000000-0000-4000-8000-5eed0000a001'::uuid, 'alex@example.test', 'Alex Example'),
  ('00000000-0000-4000-8000-5eed0000a002'::uuid, 'sam@example.test', 'Sam Sample'),
  ('00000000-0000-4000-8000-5eed0000a003'::uuid, 'jo@example.test', 'Jo Example'),
  ('00000000-0000-4000-8000-5eed0000a004'::uuid, 'riley@example.test', 'Riley Example')
) as u (id, email, full_name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.id in (
  '00000000-0000-4000-8000-5eed0000a001', '00000000-0000-4000-8000-5eed0000a002',
  '00000000-0000-4000-8000-5eed0000a003', '00000000-0000-4000-8000-5eed0000a004'
);

-- The signup trigger gave everyone no roles.
update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-5eed0000a001';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-5eed0000a002';
update public.users set roles = '{site_editor,site_messages}' where id = '00000000-0000-4000-8000-5eed0000a003';
update public.users set roles = '{finance_requester}' where id = '00000000-0000-4000-8000-5eed0000a004';

insert into public.payees (id, full_name, email, notes, is_active, user_id, linked_at, linked_by) values
  (
    '00000000-0000-4000-8000-5eed0000b001', 'Alex Example', 'alex@example.test', null, true,
    '00000000-0000-4000-8000-5eed0000a001', now(), '00000000-0000-4000-8000-5eed0000a001'
  ),
  ('00000000-0000-4000-8000-5eed0000b002', 'Pat Example', 'pat@example.test', 'Small group leader', true, null, null, null),
  ('00000000-0000-4000-8000-5eed0000b003', 'Jordan Placeholder', null, null, true, null, null, null),
  ('00000000-0000-4000-8000-5eed0000b004', 'Casey Test', null, 'Moved away', false, null, null, null);

-- Act as the admin, so the RPCs run their checks and the audit log has an
-- actor. Approving and paying need a session that has entered a code.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-5eed0000a001", "role": "authenticated", "aal": "aal2"}',
  false
);

-- Requests and their receipt amounts go in together, since the total and
-- vendors are checked against them at commit.
begin;

insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description, event_name,
  no_receipt, no_receipt_reason
)
select
  r.id::uuid, r.payee_id::uuid, '00000000-0000-4000-8000-5eed0000a001', r.type::public.reimbursement_type,
  r.amount_cents, (now() at time zone 'America/Los_Angeles')::date - r.days_ago, r.vendor, r.description,
  r.event_name, r.no_receipt_reason is not null, r.no_receipt_reason
from (values
  ('00000000-0000-4000-8000-5eed0000c001', '00000000-0000-4000-8000-5eed0000b002', 'youth', 2350, 2,
    'Grocery Outlet, Dollar Store, Corner Store', 'Snacks for small group', null, null),
  ('00000000-0000-4000-8000-5eed0000c002', '00000000-0000-4000-8000-5eed0000b003', 'cafe', 4800, 5,
    'Restaurant Depot', 'Coffee beans and milk', null, 'The receipt was lost.'),
  ('00000000-0000-4000-8000-5eed0000c003', '00000000-0000-4000-8000-5eed0000b002', 'youth', 12000, 10,
    'Camp Example', 'Retreat deposit', 'Fall retreat', 'Paid online; no receipt was sent.'),
  ('00000000-0000-4000-8000-5eed0000c004', '00000000-0000-4000-8000-5eed0000b003', 'youth', 3525, 12,
    'Pizza Place', 'Pizza for game night', 'Game night', 'The receipt was lost.'),
  ('00000000-0000-4000-8000-5eed0000c005', '00000000-0000-4000-8000-5eed0000b002', 'cafe', 1875, 20,
    'Party Supply', 'Cups and lids', null, 'The receipt was lost.'),
  ('00000000-0000-4000-8000-5eed0000c006', '00000000-0000-4000-8000-5eed0000b001', 'youth', 6410, 30,
    'Gas Station', 'Gas for the church van', 'Fall retreat', 'Pay-at-pump receipt didn''t print.'),
  ('00000000-0000-4000-8000-5eed0000c007', '00000000-0000-4000-8000-5eed0000b003', 'cafe', 999, 15,
    'Corner Store', 'Snack for the drive home', null, 'The receipt was lost.'),
  ('00000000-0000-4000-8000-5eed0000c008', '00000000-0000-4000-8000-5eed0000b002', 'youth', 1200, 8,
    'Grocery Outlet', 'Entered twice by mistake', null, 'The receipt was lost.'),
  ('00000000-0000-4000-8000-5eed0000c009', '00000000-0000-4000-8000-5eed0000b002', 'cafe', 5620, 45,
    'Restaurant Depot, Warehouse Club', 'Syrups and whipped cream', null, 'The receipt was lost.'),
  ('00000000-0000-4000-8000-5eed0000c010', '00000000-0000-4000-8000-5eed0000b003', 'youth', 21500, 70,
    'Trampoline Park', 'Group tickets', 'Summer outing', 'Paid online; no receipt was sent.'),
  ('00000000-0000-4000-8000-5eed0000c011', '00000000-0000-4000-8000-5eed0000b004', 'youth', 4275, 100,
    'Craft Store', 'Poster board and markers', 'VBS', 'The receipt was lost.'),
  ('00000000-0000-4000-8000-5eed0000c012', '00000000-0000-4000-8000-5eed0000b001', 'cafe', 3190, 130,
    'Warehouse Club', 'Pastries for Sunday', null, 'The receipt was lost.')
) as r (id, payee_id, type, amount_cents, days_ago, vendor, description, event_name, no_receipt_reason);

-- One receipt each, except c001 (three stores) and c009 (two).
insert into public.request_lines (request_id, position, amount_cents, vendor)
select r.id, 1, r.amount_cents, r.vendor
from public.reimbursement_requests r
where r.created_by = '00000000-0000-4000-8000-5eed0000a001'
  and r.id not in ('00000000-0000-4000-8000-5eed0000c001', '00000000-0000-4000-8000-5eed0000c009');

insert into public.request_lines (request_id, position, amount_cents, vendor) values
  ('00000000-0000-4000-8000-5eed0000c001', 1, 1200, 'Grocery Outlet'),
  ('00000000-0000-4000-8000-5eed0000c001', 2, 650, 'Dollar Store'),
  ('00000000-0000-4000-8000-5eed0000c001', 3, 500, 'Corner Store'),
  ('00000000-0000-4000-8000-5eed0000c009', 1, 4100, 'Restaurant Depot'),
  ('00000000-0000-4000-8000-5eed0000c009', 2, 1520, 'Warehouse Club');

commit;

-- c001 stays a draft.
select public.submit_request('00000000-0000-4000-8000-5eed0000c002');

select public.submit_request('00000000-0000-4000-8000-5eed0000c003');
select public.request_info('00000000-0000-4000-8000-5eed0000c003', 'Which retreat is this deposit for?');

select public.approve_request('00000000-0000-4000-8000-5eed0000c004');

select public.approve_request('00000000-0000-4000-8000-5eed0000c005');
select public.mark_paid('00000000-0000-4000-8000-5eed0000c005', 'cash_app');

-- Paid to the admin, so an outside approver is named.
select public.record_as_paid(
  '00000000-0000-4000-8000-5eed0000c006', 'bank_transfer', null, now() - interval '28 days', 'Pastor Example'
);

select public.submit_request('00000000-0000-4000-8000-5eed0000c007');
select public.reject_request('00000000-0000-4000-8000-5eed0000c007', 'This wasn''t a ministry purchase.');

select public.submit_request('00000000-0000-4000-8000-5eed0000c008');
select public.cancel_request('00000000-0000-4000-8000-5eed0000c008');

select public.record_as_paid('00000000-0000-4000-8000-5eed0000c009', 'cash_app', null, now() - interval '44 days');
select public.record_as_paid('00000000-0000-4000-8000-5eed0000c010', 'check', '1042', now() - interval '65 days');
select public.record_as_paid('00000000-0000-4000-8000-5eed0000c011', 'cash', null, now() - interval '98 days');
select public.record_as_paid(
  '00000000-0000-4000-8000-5eed0000c012', 'cash_app', null, now() - interval '128 days', 'Pastor Example'
);

select set_config('request.jwt.claims', '', false);

-- Making the seed's owner an owner isn't news, so drop the alert it queued.
delete from public.email_log where template = 'owner-changed';

-- Site content around this week: events counted from this week's Monday and
-- heads-ups from today, in Los Angeles time. One heads-up is scheduled for
-- later and one has ended, and one event is still a draft. Written as the
-- site editor, so Activity names them.
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-5eed0000a003", "role": "authenticated"}', false
);

insert into site.events (
  id, slug, title, summary, body, starts_at, ends_at, all_day, location_name, address, cost_note, featured, status
)
select
  e.id, e.slug, e.title, e.summary, e.body,
  (w.monday + e.starts) at time zone 'America/Los_Angeles',
  (w.monday + e.ends) at time zone 'America/Los_Angeles',
  e.all_day, e.location_name, e.address, e.cost_note, e.featured, e.status::site.event_status
from (select date_trunc('week', now() at time zone 'America/Los_Angeles') as monday) as w
cross join (values
  (
    '00000000-0000-4000-8000-5eed0000e001'::uuid, 'kickoff-night', 'Kickoff Night',
    'Worship, food, and a first look at the season.',
    'A big night to start the season: worship, food, and a first look at what''s coming up.',
    interval '-2 days 18 hours', interval '-2 days 21 hours', false, 'SBC South', null, null, false, 'published'
  ),
  (
    '00000000-0000-4000-8000-5eed0000e002', 'volleyball-saturday', 'Volleyball Saturday',
    'Come play or come watch. Every skill level is welcome.',
    E'Come play or come watch. Every skill level is welcome, and drinks are on us.\n\n'
      'Bring a water bottle and shoes you can run in.',
    interval '5 days 14 hours', interval '5 days 17 hours', false, 'Example Park',
    '400 Example Avenue, Maple Valley, WA 98038', 'Free', false, 'published'
  ),
  (
    '00000000-0000-4000-8000-5eed0000e003', 'weekend-retreat', 'Weekend Retreat',
    'A night away with worship, games, and a lot of good food.',
    E'A night away with the whole group: worship around the fire, games, time outside, and a lot of good food.\n\n'
      'We leave from the church parking lot Saturday morning and are back Sunday by lunch. '
      'A packing list goes out the week before.',
    interval '12 days 9 hours', interval '13 days 12 hours', false, 'Example Pines Camp',
    '1 Example Pines Road, Exampleville, WA 00000', '$40 per student', true, 'published'
  ),
  (
    '00000000-0000-4000-8000-5eed0000e004', 'worship-night', 'Worship Night',
    'A long evening of worship and prayer.',
    'A long evening of worship and prayer. Bring a friend.',
    interval '20 days 18 hours', interval '20 days 20 hours', false, 'SBC South', null, null, true, 'published'
  ),
  (
    '00000000-0000-4000-8000-5eed0000e005', 'serve-day', 'Serve Day',
    'Help get the church ready for the season.',
    E'Help get the church ready for the season: yard work, cleaning, and setting up rooms. '
      'Come for any part of the day.\n\nLunch is on us.',
    interval '26 days', interval '27 days', true, 'SBC South', null, null, false, 'published'
  ),
  (
    '00000000-0000-4000-8000-5eed0000e006', 'all-church-campout', 'All-Church Campout',
    'A weekend of camping with the whole church.',
    'A weekend of camping with the whole church. Families, students, and leaders all together.',
    interval '75 days', interval '77 days', true, 'Example Lake Campground',
    '2 Example Lake Road, Exampleville, WA 00000', null, false, 'published'
  ),
  (
    '00000000-0000-4000-8000-5eed0000e007', 'game-night', 'Game Night',
    'Board games, snacks, and a lot of noise.',
    'Board games, snacks, and a lot of noise. Bring a game if you have a favorite.',
    interval '33 days 18 hours 30 minutes', interval '33 days 20 hours 30 minutes', false, 'SBC South', null, null,
    false, 'draft'
  )
) as e (id, slug, title, summary, body, starts, ends, all_day, location_name, address, cost_note, featured, status);

-- The retreat signups end when the retreat starts.
insert into site.posts (id, title, body, link_url, link_label, pinned, status, starts_at, ends_at)
select
  p.id, p.title, p.body, p.link_url, p.link_label, p.pinned, 'published',
  (d.today + p.starts) at time zone 'America/Los_Angeles',
  coalesce(
    (d.today + p.ends) at time zone 'America/Los_Angeles',
    (select starts_at from site.events where slug = 'weekend-retreat')
  )
from (select date_trunc('day', now() at time zone 'America/Los_Angeles') as today) as d
cross join (values
  (
    '00000000-0000-4000-8000-5eed0000d001'::uuid, 'Retreat signups are open',
    'Spots are limited, so sign up soon. We need a headcount for food and cabins by the Sunday before we leave.',
    '/events/weekend-retreat', 'See the retreat', true, interval '-4 days 9 hours', null::interval
  ),
  (
    '00000000-0000-4000-8000-5eed0000d002', 'Youth hoodies are here', 'Get one at the cafe when it''s open.',
    null, null, false, interval '-6 days 9 hours', interval '21 days 9 hours'
  ),
  (
    '00000000-0000-4000-8000-5eed0000d003', 'Save the date', 'Scheduled for later. It shouldn''t show yet.',
    null, null, false, interval '3 days 9 hours', interval '30 days 9 hours'
  ),
  (
    '00000000-0000-4000-8000-5eed0000d004', 'Kickoff photos are up', 'Ended yesterday. It shouldn''t show.',
    null, null, false, interval '-8 days 9 hours', interval '-1 days 9 hours'
  )
) as p (id, title, body, link_url, link_label, pinned, starts, ends);

select set_config('request.jwt.claims', '', false);

-- Where the database pokes the email drain: the site's dev server, reached
-- from the database container and answering as the portal. The secret is for
-- local use only, and the site's drain checks for the same one.
select vault.create_secret('http://host.docker.internal:3001/api/email/drain', 'email_drain_url');
select vault.create_secret('local-only-drain-secret', 'email_drain_secret');
select vault.create_secret('portal.localhost:3001', 'email_drain_host');
