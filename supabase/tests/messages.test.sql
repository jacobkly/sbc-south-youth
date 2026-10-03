-- Messages from the site's forms. The site's server saves them with the
-- secret key through site.submit_message(), which checks them, holds each
-- sender to 5 an hour, and queues the alert. Only the Messages role reads
-- them, and changes them only through site.triage_message(). The activity
-- log keeps triage changes without anything the sender wrote.
begin;

create extension if not exists pgtap with schema extensions;

select plan(66);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000006e01', 'editor@example.test', '{"full_name": "Site Editor"}'),
  ('00000000-0000-4000-8000-000000006e02', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-000000006e03', 'finance@example.test', '{"full_name": "Finance Person"}'),
  ('00000000-0000-4000-8000-000000006e04', 'messages@example.test', '{"full_name": "Messages Person"}'),
  ('00000000-0000-4000-8000-000000006e05', 'removed@example.test', '{"full_name": "Removed Messages"}'),
  ('00000000-0000-4000-8000-000000006e06', 'second@example.test', '{"full_name": "Second Messages"}');

update public.users set roles = '{site_editor}' where id = '00000000-0000-4000-8000-000000006e01';
update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-000000006e02';
update public.users set roles = '{finance_viewer,finance_requester}' where id = '00000000-0000-4000-8000-000000006e03';
update public.users set roles = '{site_messages}'
where id in ('00000000-0000-4000-8000-000000006e04', '00000000-0000-4000-8000-000000006e06');
update public.users set roles = '{site_messages}', is_active = false where id = '00000000-0000-4000-8000-000000006e05';

-- An empty outbox, so the alerts below are the only emails.
delete from public.email_log;

-- Who can reach what.
select is_empty(
  $$ select r.rolname, p.privilege
     from (values ('anon'), ('authenticated'), ('service_role')) as r (rolname)
     cross join unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p (privilege)
     where has_table_privilege(r.rolname, 'site.form_rate_limits', p.privilege) $$,
  'no client can touch the rate limits, not even the secret key'
);

select is_empty(
  $$ select p.privilege
     from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p (privilege)
     where has_table_privilege('service_role', 'site.messages', p.privilege) $$,
  'the secret key can''t read or write messages directly, only submit them'
);

select ok(
  has_table_privilege('authenticated', 'site.messages', 'select')
  and not has_table_privilege('authenticated', 'site.messages', 'insert')
  and not has_table_privilege('authenticated', 'site.messages', 'update')
  and not has_table_privilege('authenticated', 'site.messages', 'delete'),
  'signed-in people only read messages, as far as RLS lets them'
);

select results_eq(
  $$ select p.proname::text collate "default", r.rolname
     from pg_proc p
     cross join (values ('anon'), ('authenticated'), ('service_role')) as r (rolname)
     where p.pronamespace = 'site'::regnamespace
       and p.proname in (
         'submit_message', 'triage_message', 'mark_message_notified', 'prune_messages', 'prune_form_rate_limits'
       )
       and has_function_privilege(r.rolname, p.oid, 'execute')
     order by 1, 2 $$,
  $$ values ('submit_message', 'service_role'), ('triage_message', 'authenticated') $$,
  'only the secret key submits, only signed-in people triage, and no client runs the rest'
);

select results_eq(
  $$ select jobname::text collate "default", schedule, command from cron.job
     where jobname in ('prune-messages', 'prune-form-rate-limits')
     order by jobname $$,
  $$ values
       ('prune-form-rate-limits', '20 10 * * *', 'select site.prune_form_rate_limits()'),
       ('prune-messages', '15 10 * * *', 'select site.prune_messages()') $$,
  'the message retention jobs run nightly'
);

select columns_are(
  'site', 'form_rate_limits', array['id', 'ip_hash', 'created_at'],
  'the rate limits keep a hashed address and when, never the address itself'
);

-- The site's server, with the secret key.
set local role service_role;

select lives_ok(
  $$ select site.submit_message(
       'contact',
       '{"name": "  Sam Tester ", "email": " sam@example.test ", "phone": "(206) 555-0100", "role": "parent",
         "message": "Please call me about the retreat.\n", "status": "handled", "notified_at": "2026-01-01",
         "band": "hs", "areas": ["media"]}',
       repeat('a', 64), 'production', 'youth@example.test'
     ) $$,
  'the secret key saves a message'
);

select lives_ok(
  $$ select site.submit_message(
       'visit', '{"name": "Vi Visitor", "phone": "(206) 555-0101", "message": "Coming Friday."}',
       repeat('a', 64), 'production', 'youth@example.test'
     );
     select site.submit_message(
       'join', '{"name": "Jo Joiner", "email": "jo@example.test", "band": "college", "message": "Ignored."}',
       repeat('a', 64), 'production', 'youth@example.test'
     );
     select site.submit_message(
       'serve', '{"name": "Sid Server", "email": "sid@example.test", "areas": ["worship", "media"]}',
       repeat('b', 64), 'production', 'youth@example.test'
     );
     select site.submit_message(
       'takedown',
       '{"name": "Tay Parent", "email": "tay@example.test", "role": "parent", "message": "Please take down the photo."}',
       repeat('b', 64), 'staging', 'owner@example.test'
     );
     select site.submit_message('visit', '{"name": "Quiet Visitor", "email": "quiet@example.test"}', repeat('b', 64),
       'production', null) $$,
  'each kind of message saves, with or without an alert address'
);

-- What the server checks again, in case anything gets past the form.
select throws_ok(
  $$ select site.submit_message('contact', '{"email": "x@example.test", "message": "Hi"}', repeat('a', 64), 'production') $$,
  '22023', 'Add a name.', 'a message needs a name'
);
select throws_ok(
  $$ select site.submit_message(
       'visit', jsonb_build_object('name', repeat('x', 81), 'email', 'x@example.test'), repeat('a', 64), 'production'
     ) $$,
  '22023', null, 'names stop at 80 characters'
);
select throws_ok(
  $$ select site.submit_message('contact', '{"name": "No Email", "phone": "(206) 555-0102", "message": "Hi"}',
       repeat('a', 64), 'production') $$,
  '22023', null, 'a contact message needs an email to write back to'
);
select throws_ok(
  $$ select site.submit_message('contact', '{"name": "No Words", "email": "x@example.test"}', repeat('a', 64),
       'production') $$,
  '22023', null, 'a contact message needs a message'
);
select throws_ok(
  $$ select site.submit_message(
       'contact', jsonb_build_object('name', 'Long', 'email', 'x@example.test', 'message', repeat('x', 2001)),
       repeat('a', 64), 'production'
     ) $$,
  '22023', null, 'messages stop at 2,000 characters'
);
select throws_ok(
  $$ select site.submit_message(
       'visit', jsonb_build_object('name', 'Long', 'email', 'x@example.test', 'message', repeat('x', 501)),
       repeat('a', 64), 'production'
     ) $$,
  '22023', null, 'notes on a visit or serve form stop at 500 characters'
);
select throws_ok(
  $$ select site.submit_message('visit', '{"name": "Unreachable"}', repeat('a', 64), 'production') $$,
  '22023', 'Add an email or a phone number.', 'a visit needs an email or a phone number'
);
select throws_ok(
  $$ select site.submit_message('serve', '{"name": "No Areas", "email": "x@example.test"}', repeat('a', 64),
       'production') $$,
  '22023', null, 'a serve form needs at least one area'
);
select throws_ok(
  $$ select site.submit_message('visit', '{"name": "Bad Email", "email": "not-an-email"}', repeat('a', 64),
       'production') $$,
  '22023', null, 'an email needs an @'
);
select throws_ok(
  $$ select site.submit_message('visit', jsonb_build_object('name', 'Long Phone', 'phone', repeat('5', 26)),
       repeat('a', 64), 'production') $$,
  '22023', null, 'phone numbers stop at 25 characters'
);
select throws_ok(
  $$ select site.submit_message('contact', '{"name": "Who", "email": "x@example.test", "role": "teacher",
       "message": "Hi"}', repeat('a', 64), 'production') $$,
  '22023', null, 'the contact role is student, parent, or other'
);
select throws_ok(
  $$ select site.submit_message('visit', '{"name": "Raw", "email": "x@example.test"}', '203.0.113.5', 'production') $$,
  '22023', null, 'only a hashed address is taken, never a raw IP'
);
select throws_ok(
  $$ select site.submit_message('visit', '{"name": "Where", "email": "x@example.test"}', repeat('a', 64), 'dev') $$,
  '22023', null, 'a message comes from production or staging'
);

-- 5 an hour from one sender.
select lives_ok(
  $$ select site.submit_message('visit', '{"name": "Rae Repeat", "email": "rae@example.test"}', repeat('c', 64),
       'production', 'youth@example.test')
     from generate_series(1, 5) $$,
  'one sender can send 5 in an hour'
);
select throws_ok(
  $$ select site.submit_message('visit', '{"name": "Rae Repeat", "email": "rae@example.test"}', repeat('c', 64),
       'production', 'youth@example.test') $$,
  'PT429', 'You''ve sent a few messages already. Try again in an hour.', 'the 6th in an hour is refused'
);
select lives_ok(
  $$ select site.submit_message('visit', '{"name": "Rae Repeat", "email": "rae@example.test"}', repeat('0', 64),
       'production', null) $$,
  'someone on another connection still gets through'
);

reset role;

insert into site.form_rate_limits (ip_hash, created_at)
select repeat('d', 64), now() - interval '61 minutes' from generate_series(1, 5);

set local role service_role;

select lives_ok(
  $$ select site.submit_message('visit', '{"name": "Dee Later", "email": "dee@example.test"}', repeat('d', 64),
       'production', null) $$,
  'sends more than an hour ago don''t count'
);

reset role;

-- What was saved, and what was queued.
select results_eq(
  $$ select kind::text, name, email, phone, message, details, env, status::text, outcome::text, notified_at
     from site.messages where name = 'Sam Tester' $$,
  $$ values (
       'contact', 'Sam Tester', 'sam@example.test', '(206) 555-0100', 'Please call me about the retreat.',
       '{"role": "parent"}'::jsonb, 'production', 'new', null::text, null::timestamptz
     ) $$,
  'a message is saved trimmed and new, with only the fields its form takes'
);

select results_eq(
  $$ select m.kind::text, m.message, m.details, m.env from site.messages m
     where m.name in ('Vi Visitor', 'Jo Joiner', 'Sid Server', 'Tay Parent')
     order by m.kind $$,
  $$ values
       ('visit', 'Coming Friday.', '{}'::jsonb, 'production'),
       ('join', null, '{"band": "college"}'::jsonb, 'production'),
       ('serve', null, '{"areas": ["worship", "media"]}'::jsonb, 'production'),
       ('takedown', 'Please take down the photo.', '{"role": "parent"}'::jsonb, 'staging') $$,
  'each kind keeps its own details'
);

select ok(
  (select count(*) from site.messages where name = 'Rae Repeat') = 6
  and (select count(*) from site.form_rate_limits where ip_hash = repeat('c', 64)) = 5,
  'the refused 6th saved nothing and wasn''t counted'
);

select results_eq(
  $$ select l.template, l.priority::integer, l.to_address, l.subject, l.scope, l.env, l.related_type, l.status::text
     from public.email_log l
     join site.messages m on m.id = l.related_id
     where m.name in ('Sam Tester', 'Vi Visitor', 'Jo Joiner', 'Sid Server', 'Tay Parent')
     order by m.kind $$,
  $$ values
       ('form-alert', 4, 'youth@example.test', 'Vi is planning a visit', 'site', 'production', 'message', 'queued'),
       ('form-alert', 4, 'youth@example.test', 'Jo wants to join the chat', 'site', 'production', 'message', 'queued'),
       ('form-alert', 4, 'youth@example.test', 'Sid wants to serve', 'site', 'production', 'message', 'queued'),
       ('form-alert', 4, 'youth@example.test', 'Sam sent a message', 'site', 'production', 'message', 'queued'),
       ('form-alert', 4, 'owner@example.test', 'Tay asked to take down a photo', 'site', 'staging', 'message', 'queued') $$,
  'each message queues one alert, with only its kind and first name in the subject'
);

select is_empty(
  $$ select 1 from public.email_log l join site.messages m on m.id = l.related_id
     where m.name in ('Quiet Visitor', 'Dee Later') $$,
  'without an alert address the message still saves, and nothing is queued'
);

-- Notified once Resend takes the alert. A failed alert waits for the digest.
select public.email_mark(c.id, 'sent', 're_alert_sam')
from public.email_claim('production', 50) c
join site.messages m on m.id = c.related_id
where m.name = 'Sam Tester';

select public.email_mark(l.id, 'failed', null, 'Resend said no')
from public.email_log l
join site.messages m on m.id = l.related_id
where m.name = 'Vi Visitor';

select results_eq(
  $$ select name, notified_at is not null from site.messages
     where name in ('Sam Tester', 'Vi Visitor', 'Jo Joiner') order by name $$,
  $$ values ('Jo Joiner', false), ('Sam Tester', true), ('Vi Visitor', false) $$,
  'a message counts as notified only once Resend accepts its alert'
);

-- Visitors.
set local role anon;

select throws_ok('select 1 from site.messages', '42501', null, 'visitors can''t read messages');

reset role;

-- People without the Messages role.
set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000006e03", "role": "authenticated"}', true);
select is_empty('select 1 from site.messages', 'finance roles read no messages');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000006e01", "role": "authenticated"}', true);
select is_empty('select 1 from site.messages', 'a site editor without Messages reads no messages');
select throws_ok(
  $$ select site.triage_message('00000000-0000-4000-8000-000000006a99', '{"status": "handled"}') $$,
  '42501', 'Only someone with Messages can change a message.', 'a site editor without Messages can''t triage'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000006e05", "role": "authenticated"}', true);
select is_empty('select 1 from site.messages', 'someone whose access was removed reads no messages');

-- The Messages role.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000006e04", "role": "authenticated"}', true);

select is(
  (select count(*)::integer from site.messages
   where name in ('Sam Tester', 'Vi Visitor', 'Jo Joiner', 'Sid Server', 'Tay Parent')),
  5,
  'the Messages role reads every message, staging ones too'
);
select throws_ok(
  $$ update site.messages set status = 'handled' $$,
  '42501', null, 'the Messages role can''t change a message directly'
);
select throws_ok(
  $$ delete from site.messages $$,
  '42501', null, 'the Messages role can''t delete a message'
);

select lives_ok(
  $$ select site.triage_message(
       (select id from site.messages where name = 'Sid Server'),
       '{"status": "in_progress", "assigned_to": "00000000-0000-4000-8000-000000006e06",
         "internal_note": "  Called back on Monday.  "}'
     ) $$,
  'the Messages role picks up a message, assigns it, and adds a note'
);
select results_eq(
  $$ select status::text, assigned_to, internal_note, handled_by, handled_at
     from site.messages where name = 'Sid Server' $$,
  $$ values ('in_progress', '00000000-0000-4000-8000-000000006e06'::uuid, 'Called back on Monday.', null::uuid,
             null::timestamptz) $$,
  'triage changes only what it was given'
);

select lives_ok(
  $$ select site.triage_message(
       (select id from site.messages where name = 'Sid Server'), '{"status": "handled", "outcome": "placed"}'
     ) $$,
  'the Messages role marks a serve message handled, with how it went'
);
select results_eq(
  $$ select status::text, outcome::text, handled_by, handled_at = now(), internal_note
     from site.messages where name = 'Sid Server' $$,
  $$ values ('handled', 'placed', '00000000-0000-4000-8000-000000006e04'::uuid, true, 'Called back on Monday.') $$,
  'handling a message says who and when, and keeps the note'
);

select site.triage_message((select id from site.messages where name = 'Sid Server'), '{"status": "new"}');

select results_eq(
  $$ select status::text, handled_by, handled_at from site.messages where name = 'Sid Server' $$,
  $$ values ('new', null::uuid, null::timestamptz) $$,
  'opening a handled message again clears who handled it'
);

select site.triage_message((select id from site.messages where name = 'Sid Server'), '{"internal_note": "Left a voicemail."}');
select site.triage_message(
  (select id from site.messages where name = 'Sid Server'), '{"assigned_to": null, "internal_note": " "}'
);

select results_eq(
  $$ select assigned_to, internal_note from site.messages where name = 'Sid Server' $$,
  $$ values (null::uuid, null::text) $$,
  'a null assignment or a blank note clears it'
);

select throws_ok(
  $$ select site.triage_message((select id from site.messages where name = 'Sam Tester'), '{"outcome": "placed"}') $$,
  '22023', 'Only a serve message has an outcome.', 'only serve messages have an outcome'
);
select throws_ok(
  $$ select site.triage_message(
       (select id from site.messages where name = 'Sam Tester'),
       '{"assigned_to": "00000000-0000-4000-8000-000000006e01"}'
     ) $$,
  '22023', 'Assign it to a leader with Messages.', 'a message can''t go to someone without Messages'
);
select throws_ok(
  $$ select site.triage_message(
       (select id from site.messages where name = 'Sam Tester'),
       '{"assigned_to": "00000000-0000-4000-8000-000000006e05"}'
     ) $$,
  '22023', 'Assign it to a leader with Messages.', 'a message can''t go to someone whose access was removed'
);
select throws_ok(
  $$ select site.triage_message(
       (select id from site.messages where name = 'Sam Tester'), jsonb_build_object('internal_note', repeat('x', 2001))
     ) $$,
  '22023', null, 'notes stop at 2,000 characters'
);
select throws_ok(
  $$ select site.triage_message(
       (select id from site.messages where name = 'Sam Tester'), '{"email": "changed@example.test"}'
     ) $$,
  '22023', null, 'what the sender wrote can''t be changed'
);
select throws_ok(
  $$ select site.triage_message((select id from site.messages where name = 'Sam Tester'), '{"status": "done"}') $$,
  '22023', null, 'the status is new, in progress, handled, or spam'
);
select throws_ok(
  $$ select site.triage_message('00000000-0000-4000-8000-000000006a99', '{"status": "handled"}') $$,
  'P0002', 'That message doesn''t exist.', 'triaging a missing message fails'
);

-- Owners count as Messages.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000006e02", "role": "authenticated"}', true);

select lives_ok(
  $$ select site.triage_message((select id from site.messages where name = 'Sam Tester'), '{"status": "spam"}') $$,
  'owners triage too'
);

reset role;

select results_eq(
  $$ select handled_by, handled_at = now() from site.messages where name = 'Sam Tester' $$,
  $$ values ('00000000-0000-4000-8000-000000006e02'::uuid, true) $$,
  'marking spam says who and when, so retention knows when it was closed'
);

-- Activity: triage changes, and nothing the sender or a leader wrote.
select is(
  (select count(*)::integer from public.activity_log
   where entity_type = 'message' and entity_id = (select id::text from site.messages where name = 'Sid Server')),
  4,
  'each status, outcome, and assignment change is logged, and a note on its own isn''t'
);
select set_eq(
  $$ select distinct scope, action, entity_name, actor_id from public.activity_log where entity_type = 'message' $$,
  $$ values
       ('site', 'message.updated', 'serve', '00000000-0000-4000-8000-000000006e04'::uuid),
       ('site', 'message.updated', 'contact', '00000000-0000-4000-8000-000000006e02'::uuid) $$,
  'triage is site activity named by the kind of message, by whoever did it, and new messages aren''t logged'
);
select is_empty(
  $$ select k from public.activity_log a, jsonb_object_keys(a.changes) k
     where a.entity_type = 'message' and k not in ('status', 'outcome', 'assigned_to') $$,
  'the log keeps only the status, the outcome, and who it''s assigned to'
);
select ok(
  not exists (
    select 1 from public.activity_log a, to_jsonb(a) as r (row)
    where a.entity_type = 'message'
      and (
        strpos(r.row::text, 'Sam') > 0 or strpos(r.row::text, 'Sid') > 0 or strpos(r.row::text, '@example.test') > 0
        or strpos(r.row::text, '(206)') > 0 or strpos(r.row::text, 'retreat') > 0
        or strpos(r.row::text, 'Monday') > 0 or strpos(r.row::text, 'voicemail') > 0
      )
  ),
  'the log never holds a name, email, phone number, message, or note'
);

-- What the columns take.
select throws_ok(
  $$ insert into site.messages (kind, name, email, outcome) values ('visit', 'Nope', 'x@example.test', 'placed') $$,
  '23514', null, 'only a serve message has an outcome'
);
select throws_ok(
  $$ insert into site.messages (kind, name, email, status) values ('visit', 'Nope', 'x@example.test', 'handled') $$,
  '23514', null, 'a handled message says when'
);
select throws_ok(
  $$ insert into site.messages (kind, name) values ('visit', 'Nope') $$,
  '23514', null, 'a message has a way to reach its sender'
);
select throws_ok(
  $$ insert into site.form_rate_limits (ip_hash) values ('203.0.113.5') $$,
  '23514', null, 'a raw IP never lands in the rate limits'
);

-- Retention: closed messages go, open ones stay however old they are.
insert into site.messages (id, kind, name, email, status, handled_at, created_at) values
  ('00000000-0000-4000-8000-000000006a01', 'visit', 'Old Handled', 'old@example.test', 'handled',
   now() - interval '12 months 1 day', now() - interval '13 months'),
  ('00000000-0000-4000-8000-000000006a02', 'visit', 'Handled', 'old@example.test', 'handled',
   now() - interval '11 months', now() - interval '13 months'),
  ('00000000-0000-4000-8000-000000006a03', 'visit', 'Old Spam', 'old@example.test', 'spam',
   now() - interval '31 days', now() - interval '31 days'),
  ('00000000-0000-4000-8000-000000006a04', 'visit', 'Spam', 'old@example.test', 'spam',
   now() - interval '29 days', now() - interval '2 years'),
  ('00000000-0000-4000-8000-000000006a05', 'visit', 'Old New', 'old@example.test', 'new', null, now() - interval '3 years'),
  ('00000000-0000-4000-8000-000000006a06', 'visit', 'Old In Progress', 'old@example.test', 'in_progress', null,
   now() - interval '3 years');

insert into site.form_rate_limits (ip_hash, created_at) values
  (repeat('9', 64), now() - interval '25 hours'),
  (repeat('9', 64), now() - interval '23 hours');

select is(site.prune_messages(), 2, 'pruning removes handled messages after 12 months and spam after 30 days');
select set_eq(
  $$ select id from site.messages where id::text like '%-000000006a0%' $$,
  array[
    '00000000-0000-4000-8000-000000006a02', '00000000-0000-4000-8000-000000006a04',
    '00000000-0000-4000-8000-000000006a05', '00000000-0000-4000-8000-000000006a06'
  ]::uuid[],
  'newer closed messages, and every open one, stay'
);
select is(site.prune_form_rate_limits(), 1, 'pruning removes rate-limit rows after 24 hours');
select is(
  (select count(*)::integer from site.form_rate_limits where ip_hash = repeat('9', 64)),
  1,
  'rate-limit rows under 24 hours old stay'
);

select * from finish();
rollback;
