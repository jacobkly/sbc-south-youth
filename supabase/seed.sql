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
