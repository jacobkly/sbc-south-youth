-- People: invites, removing and reinstating access, last seen, and the
-- directory of names and pictures that every portal role can read.
begin;

create extension if not exists pgtap with schema extensions;

select plan(63);

-- Fake people. New auth users get a row with no roles from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'everything@example.test', '{"full_name": "Test Everything"}'),
  ('00000000-0000-4000-8000-00000000a003', 'editor@example.test', '{"full_name": "Test Editor"}'),
  ('00000000-0000-4000-8000-00000000a004', 'requester@example.test', '{"full_name": "Test Requester"}'),
  ('00000000-0000-4000-8000-00000000a005', 'Invitee@Example.test', '{"full_name": "Test Invitee"}'),
  ('00000000-0000-4000-8000-00000000a006', 'noroles@example.test', '{"full_name": "Test No Roles"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{finance_viewer,finance_requester,site_editor,site_messages}'
where id = '00000000-0000-4000-8000-00000000a002';
update public.users set roles = '{site_editor}' where id = '00000000-0000-4000-8000-00000000a003';
update public.users set roles = '{finance_requester}' where id = '00000000-0000-4000-8000-00000000a004';
update public.users set roles = '{finance_requester}' where id = '00000000-0000-4000-8000-00000000a005';

-- Something in each place the person with every role can read.
insert into public.payees (id, full_name, user_id, linked_at)
values ('00000000-0000-4000-8000-00000000b002', 'Test Everything', '00000000-0000-4000-8000-00000000a002', now());

insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description, status, submitted_at
) values (
  '00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000b002',
  '00000000-0000-4000-8000-00000000a001', 'youth', 1000, '2026-01-10', 'Fake Store', 'Submitted',
  'submitted', now()
);

insert into storage.objects (bucket_id, name)
values ('avatars', '00000000-0000-4000-8000-00000000a001/00000000-0000-4000-8000-00000000f001.webp');

update public.users
set avatar_path = '00000000-0000-4000-8000-00000000a001/00000000-0000-4000-8000-00000000f001.webp'
where id = '00000000-0000-4000-8000-00000000a001';

-- Who can write and call what.
select is_empty(
  $$ select r.role, p.privilege
     from unnest(array['anon', 'authenticated', 'service_role']) as r (role)
     cross join unnest(array['insert', 'update', 'delete', 'truncate']) as p (privilege)
     where has_table_privilege(r.role, 'public.invites', p.privilege) $$,
  'no client role, not even service_role, can write invites'
);

select ok(
  not has_table_privilege('service_role', 'public.invites', 'select'),
  'the secret key can''t read invites'
);

select ok(
  not has_column_privilege('authenticated', 'public.users', 'last_seen_at', 'update'),
  'nobody sets their own last seen time directly'
);

set local role authenticated;

-- As a site editor.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.record_invite('00000000-0000-4000-8000-00000000a005') $$,
  '42501',
  'Only an owner can invite people.',
  'a site editor can''t invite anyone'
);

select throws_ok(
  $$ select public.remove_access('00000000-0000-4000-8000-00000000a004') $$,
  '42501',
  'Only an owner can remove access.',
  'a site editor can''t remove anyone'
);

select throws_ok(
  $$ select public.reinstate('00000000-0000-4000-8000-00000000a004') $$,
  '42501',
  'Only an owner can reinstate people.',
  'a site editor can''t reinstate anyone'
);

select results_eq(
  $$ select id, full_name, avatar_path from public.people_directory()
     where id::text like '00000000-0000-4000-8000-00000000a00%' order by full_name $$,
  $$ values
       ('00000000-0000-4000-8000-00000000a003'::uuid, 'Test Editor', null::text),
       ('00000000-0000-4000-8000-00000000a002'::uuid, 'Test Everything', null::text),
       ('00000000-0000-4000-8000-00000000a005'::uuid, 'Test Invitee', null::text),
       ('00000000-0000-4000-8000-00000000a006'::uuid, 'Test No Roles', null::text),
       ('00000000-0000-4000-8000-00000000a001'::uuid,
        'Test Owner', '00000000-0000-4000-8000-00000000a001/00000000-0000-4000-8000-00000000f001.webp'),
       ('00000000-0000-4000-8000-00000000a004'::uuid, 'Test Requester', null::text) $$,
  'a site editor reads everyone''s name and picture from the directory'
);

select is(
  (select string_agg(a.name, ', ' order by a.position)
   from pg_proc p
   cross join unnest(p.proargnames, p.proargmodes) with ordinality as a (name, mode, position)
   where p.oid = 'public.people_directory()'::regprocedure and a.mode = 't'),
  'id, full_name, avatar_path',
  'the directory returns names and pictures only, never emails'
);

select results_eq(
  $$ select (storage.foldername(name))[1] from storage.objects where bucket_id = 'avatars' $$,
  $$ values ('00000000-0000-4000-8000-00000000a001') $$,
  'a site editor can load other people''s pictures'
);

select is_empty($$ select 1 from public.invites $$, 'a site editor reads no invites');

-- As a requester, who only uses finances.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a004", "role": "authenticated"}', true);

select is_empty($$ select 1 from public.people_directory() $$, 'a requester gets no directory');

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'avatars' $$,
  'a requester can''t load other people''s pictures'
);

-- As the owner: inviting.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select results_eq(
  $$ select user_id, email, full_name, roles::text, status, invited_by, sent_count, accepted_at
     from public.record_invite('00000000-0000-4000-8000-00000000a005') $$,
  $$ values ('00000000-0000-4000-8000-00000000a005'::uuid, 'invitee@example.test', 'Test Invitee',
             '{finance_requester}', 'pending', '00000000-0000-4000-8000-00000000a001'::uuid, 1, null::timestamptz) $$,
  'an owner records an invite with the person''s lowercased email, name, and roles'
);

select results_eq(
  $$ select status, sent_count from public.record_invite('00000000-0000-4000-8000-00000000a005') $$,
  $$ values ('pending', 2) $$,
  'sending it again counts the resend on the same invite'
);

select results_eq(
  $$ select user_id, status from public.invites where user_id::text like '00000000-0000-4000-8000-00000000a00%' $$,
  $$ values ('00000000-0000-4000-8000-00000000a005'::uuid, 'pending') $$,
  'an owner reads invites, one per person'
);

select throws_ok(
  $$ select public.record_invite('00000000-0000-4000-8000-00000000a006') $$,
  '22023',
  'Give them at least one role first.',
  'an invite needs a role'
);

select throws_ok(
  $$ select public.record_invite('00000000-0000-4000-8000-0000000fffff') $$,
  'P0002',
  'That person doesn''t exist.',
  'an invite needs a real person'
);

-- As the invitee, signed in for the first time.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a005", "role": "authenticated"}', true);

select is(public.accept_invite(), true, 'signing in accepts the person''s own invite');
select is(public.accept_invite(), false, 'accepting again changes nothing');
select is_empty($$ select 1 from public.invites $$, 'an invitee can''t read invites, even their own');

-- As the owner again.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select results_eq(
  $$ select status, accepted_at is not null from public.invites
     where user_id = '00000000-0000-4000-8000-00000000a005' $$,
  $$ values ('accepted', true) $$,
  'the invite is accepted, with the time'
);

select throws_ok(
  $$ select public.record_invite('00000000-0000-4000-8000-00000000a005') $$,
  '55000',
  'They''ve already accepted their invite.',
  'an accepted invite can''t be sent again'
);

reset role;

select results_eq(
  $$ select action, actor_id, entity_name, changes ? 'email'
     from public.activity_log
     where entity_type = 'invite' and entity_id = (
       select id::text from public.invites where user_id = '00000000-0000-4000-8000-00000000a005'
     )
     order by action, actor_id $$,
  $$ values
       ('invite.created', '00000000-0000-4000-8000-00000000a001'::uuid, 'Test Invitee', false),
       ('invite.updated', '00000000-0000-4000-8000-00000000a001'::uuid, 'Test Invitee', false),
       ('invite.updated', '00000000-0000-4000-8000-00000000a005'::uuid, 'Test Invitee', false) $$,
  'the invite, the resend, and the acceptance are logged by who did them, without the email'
);

select is(
  (select changes -> 'status' from public.activity_log
   where entity_type = 'invite' and actor_id = '00000000-0000-4000-8000-00000000a005'),
  '{"from": "pending", "to": "accepted"}'::jsonb,
  'the acceptance log shows the status change'
);

-- Before removal, the person with every role reads finance and site things.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select ok(
  exists (select 1 from public.payees where id = '00000000-0000-4000-8000-00000000b002')
  and exists (select 1 from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c002')
  and exists (select 1 from public.users where id <> '00000000-0000-4000-8000-00000000a002')
  and exists (select 1 from public.people_directory())
  and exists (select 1 from storage.objects where bucket_id = 'avatars'),
  'before removal, they read payees, requests, people, and pictures'
);

-- As the owner: removing access.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select throws_ok(
  $$ select public.remove_access('00000000-0000-4000-8000-00000000a001') $$,
  '42501',
  'You can''t remove your own access.',
  'an owner can''t remove themselves'
);

select throws_ok(
  $$ select public.remove_access('00000000-0000-4000-8000-0000000fffff') $$,
  'P0002',
  'That person doesn''t exist.',
  'removing access needs a real person'
);

select lives_ok(
  $$ select public.remove_access('00000000-0000-4000-8000-00000000a002') $$,
  'an owner removes someone''s access'
);

select lives_ok(
  $$ select public.remove_access('00000000-0000-4000-8000-00000000a002') $$,
  'removing it again is harmless, so a failed ban can be retried'
);

reset role;

select results_eq(
  $$ select is_active, roles::text, updated_by from public.users where id = '00000000-0000-4000-8000-00000000a002' $$,
  $$ values (false, '{finance_viewer,finance_requester,site_editor,site_messages}',
             '00000000-0000-4000-8000-00000000a001'::uuid) $$,
  'removing access keeps the roles, so reinstating gives them back'
);

-- As the removed person, whose sign-in is still valid until it expires.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select is_empty(
  format('select 1 from public.%I', c.relname),
  format('once removed, they read nothing from %s', c.relname)
)
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relname <> 'users'
order by c.relname;

select results_eq(
  $$ select id from public.users $$,
  $$ values ('00000000-0000-4000-8000-00000000a002'::uuid) $$,
  'once removed, they see only their own users row'
);

select is_empty($$ select 1 from public.people_directory() $$, 'once removed, they get no directory');

select is_empty(
  $$ select 1 from storage.objects where bucket_id in ('avatars', 'receipts') $$,
  'once removed, they load no pictures or receipts'
);

select ok(
  not public.has_role('finance_viewer', 'finance_requester', 'site_editor', 'site_messages'),
  'once removed, they hold none of their roles'
);

select is(public.touch_last_seen(), false, 'a removed person isn''t marked as seen');

-- As the owner: reinstating.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select throws_ok(
  $$ select public.reinstate('00000000-0000-4000-8000-0000000fffff') $$,
  'P0002',
  'That person doesn''t exist.',
  'reinstating needs a real person'
);

select lives_ok(
  $$ select public.reinstate('00000000-0000-4000-8000-00000000a002') $$,
  'an owner reinstates someone'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select ok(
  exists (select 1 from public.payees where id = '00000000-0000-4000-8000-00000000b002')
  and public.has_role('site_editor'),
  'once reinstated, their roles and reads are back'
);

reset role;

select results_eq(
  $$ select changes -> 'is_active' ->> 'to', actor_id from public.activity_log
     where action = 'user.updated' and entity_id = '00000000-0000-4000-8000-00000000a002' and changes ? 'is_active'
     order by changes -> 'is_active' ->> 'to' $$,
  $$ values ('false', '00000000-0000-4000-8000-00000000a001'::uuid),
            ('true', '00000000-0000-4000-8000-00000000a001'::uuid) $$,
  'removing and reinstating are each logged once, by the owner'
);

-- An owner can remove another owner while one is left.
update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a006';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select lives_ok(
  $$ select public.remove_access('00000000-0000-4000-8000-00000000a006') $$,
  'an owner removes another owner'
);

select throws_ok(
  $$ select public.record_invite('00000000-0000-4000-8000-00000000a006') $$,
  '55000',
  'Reinstate them before sending an invite.',
  'a removed person gets no invite'
);

-- Last seen, as the site editor.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is(public.touch_last_seen(), true, 'the first visit is recorded');
select is(public.touch_last_seen(), false, 'another visit within the hour writes nothing');

reset role;

select results_eq(
  $$ select last_seen_at = now(), (select count(*)::int from public.activity_log
                                    where actor_id = '00000000-0000-4000-8000-00000000a003'
                                      and action = 'auth.signed_in')
     from public.users where id = '00000000-0000-4000-8000-00000000a003' $$,
  $$ values (true, 1) $$,
  'the first visit sets last seen and logs one sign-in'
);

select results_eq(
  $$ select scope, entity_type, entity_id, entity_name from public.activity_log
     where actor_id = '00000000-0000-4000-8000-00000000a003' and action = 'auth.signed_in' $$,
  $$ values ('platform', 'user', '00000000-0000-4000-8000-00000000a003', 'Test Editor') $$,
  'a sign-in is platform activity about the person'
);

-- An hour later on the same day.
update public.users set last_seen_at = now() - interval '61 minutes'
where id = '00000000-0000-4000-8000-00000000a003';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is(public.touch_last_seen(), true, 'a visit over an hour later updates last seen');

reset role;

select results_eq(
  $$ select last_seen_at = now(), (select count(*)::int from public.activity_log
                                    where actor_id = '00000000-0000-4000-8000-00000000a003'
                                      and action = 'auth.signed_in')
     from public.users where id = '00000000-0000-4000-8000-00000000a003' $$,
  $$ values (true, 1) $$,
  'but logs no second sign-in the same day'
);

-- Two days later.
update public.users set last_seen_at = now() - interval '2 days'
where id = '00000000-0000-4000-8000-00000000a003';
update public.activity_log set created_at = now() - interval '2 days'
where actor_id = '00000000-0000-4000-8000-00000000a003' and action = 'auth.signed_in';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is(public.touch_last_seen(), true, 'a visit on a later day updates last seen');

reset role;

select is(
  (select count(*)::int from public.activity_log
   where actor_id = '00000000-0000-4000-8000-00000000a003' and action = 'auth.signed_in'),
  2,
  'and logs that day''s sign-in'
);

-- Nothing to accept for someone with no invite, and nothing without a sign-in.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated"}', true);

select is(public.accept_invite(), false, 'someone with no invite has nothing to accept');

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);

select is(public.touch_last_seen(), false, 'with no one signed in, nothing is recorded');
select is(public.accept_invite(), false, 'with no one signed in, nothing is accepted');

reset role;

select * from finish();
rollback;
