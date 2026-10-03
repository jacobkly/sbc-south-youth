-- The daily digest. A message whose alert never went keeps notified_at
-- empty, and each morning the drain asks site.queue_message_digest() to
-- queue one email listing them all. A message goes in only one digest that
-- reaches the inbox, never two.
begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- Only these messages and emails.
delete from site.messages;
delete from public.email_log;

select results_eq(
  $$ select r.rolname
     from (values ('anon'), ('authenticated'), ('service_role')) as r (rolname)
     where has_function_privilege(r.rolname, 'site.queue_message_digest(text, text)', 'execute') $$,
  $$ values ('service_role') $$,
  'only the secret key queues the digest'
);

select has_column('site', 'messages', 'digest_id', 'each message remembers the digest that listed it');

set local role service_role;

select is(
  site.queue_message_digest('production', 'youth@example.test'), 0,
  'with nothing waiting, it lists nothing'
);

reset role;

select is_empty(
  $$ select 1 from public.email_log where template = 'daily-digest' $$,
  'and queues no email'
);

set local role service_role;

select lives_ok(
  $$ select site.submit_message('visit', '{"name": "Al Alerted", "email": "al@example.test"}', repeat('1', 64),
       'production', 'youth@example.test');
     select site.submit_message('contact', '{"name": "Fay Failed", "email": "fay@example.test", "message": "When is camp?"}',
       repeat('2', 64), 'production', 'youth@example.test');
     select site.submit_message('join', '{"name": "Flo Flight", "phone": "(206) 555-0102"}', repeat('3', 64),
       'production', 'youth@example.test');
     select site.submit_message('visit', '{"name": "Nia Noalert", "phone": "(206) 555-0103"}', repeat('4', 64),
       'production', null);
     select site.submit_message(
       'takedown', '{"name": "Tay Takedown", "email": "tay@example.test", "message": "Please take down the photo."}',
       repeat('5', 64), 'production', null);
     select site.submit_message('contact', '{"name": "Han Handled", "email": "han@example.test", "message": "Thanks!"}',
       repeat('6', 64), 'production', null);
     select site.submit_message('contact', '{"name": "Spa Spam", "email": "spa@example.test", "message": "Buy now."}',
       repeat('7', 64), 'production', null);
     select site.submit_message('visit', '{"name": "Stu Staging", "email": "stu@example.test"}', repeat('8', 64),
       'staging', null) $$,
  'messages come in, some with alerts and some without'
);

reset role;

-- Spread out when they came in, and close two.
update site.messages m
set created_at = now() - v.ago
from (values
  ('Al Alerted', interval '9 hours'),
  ('Fay Failed', interval '8 hours'),
  ('Flo Flight', interval '7 hours'),
  ('Nia Noalert', interval '6 hours'),
  ('Tay Takedown', interval '5 hours'),
  ('Han Handled', interval '4 hours'),
  ('Spa Spam', interval '3 hours'),
  ('Stu Staging', interval '2 hours')
) as v (name, ago)
where m.name = v.name;

update site.messages set status = 'handled', handled_at = now() where name = 'Han Handled';
update site.messages set status = 'spam', handled_at = now() where name = 'Spa Spam';

-- Al's alert went, Fay's failed, and Flo's is still on its way.
do $$
begin
  perform public.email_mark(l.id, 'sent', 're_alert_al')
  from public.email_log l join site.messages m on m.id = l.related_id
  where m.name = 'Al Alerted';

  perform public.email_mark(l.id, 'failed', null, 'Resend said no')
  from public.email_log l join site.messages m on m.id = l.related_id
  where m.name = 'Fay Failed';
end $$;

set local role service_role;

select is(
  site.queue_message_digest('production', 'youth@example.test'), 3,
  'it lists each open message whose alert never went'
);

reset role;

select results_eq(
  $$ select template, priority::integer, to_address, subject, scope, env, status::text, related_type, related_id
     from public.email_log where template = 'daily-digest' $$,
  $$ values ('daily-digest', 5, 'youth@example.test', '3 messages from the website are waiting', 'site', 'production',
             'queued', null::text, null::uuid) $$,
  'in one email, with only the count in the subject'
);

select results_eq(
  $$ select m.name from site.messages m join public.email_log l on l.id = m.digest_id order by m.name $$,
  $$ values ('Fay Failed'), ('Nia Noalert'), ('Tay Takedown') $$,
  'a failed alert or none puts a message in; a sent or pending alert, a closed message, or staging keeps it out'
);

set local role service_role;

select is(
  site.queue_message_digest('production', 'youth@example.test'), 0,
  'asking again lists none of them while the first digest is on its way'
);

select is(
  site.queue_message_digest('staging', 'owner@example.test'), 1,
  'staging gets its own digest, of its own messages'
);

reset role;

select is(
  (select count(*)::integer from public.email_log where template = 'daily-digest' and env = 'production'), 1,
  'so production still has one digest'
);

-- The drain claims it and reads what to write.
do $$ begin perform public.email_claim('production', 50); end $$;

select results_eq(
  $$ select d ->> 'env', (d ->> 'total')::integer, jsonb_path_query_array(d, '$.messages[*].name')
     from public.email_details(
       (select id from public.email_log where template = 'daily-digest' and env = 'production')
     ) d $$,
  $$ values ('production', 3, '["Tay Takedown", "Fay Failed", "Nia Noalert"]'::jsonb) $$,
  'its details list takedowns first, then the oldest'
);

select is(
  (select array_agg(k order by k)
   from public.email_details(
     (select id from public.email_log where template = 'daily-digest' and env = 'production')
   ) d,
   jsonb_object_keys(d -> 'messages' -> 0) k),
  array['created_at', 'details', 'email', 'id', 'kind', 'message', 'name', 'phone'],
  'each message carries what the email shows, and nothing from triage'
);

-- Resend refuses it.
do $$
begin
  perform public.email_mark(l.id, 'failed', null, 'Resend said no')
  from public.email_log l
  where l.template = 'daily-digest' and l.env = 'production';
end $$;

set local role service_role;

select is(
  site.queue_message_digest('production', 'youth@example.test'), 3,
  'a digest that failed lets its messages into the next one'
);

reset role;

-- Resend takes the next one.
do $$
begin
  perform public.email_claim('production', 50);
  perform public.email_mark(l.id, 'sent', 're_digest')
  from public.email_log l
  where l.template = 'daily-digest' and l.env = 'production' and l.status = 'sending';
end $$;

select results_eq(
  $$ select name, notified_at is not null from site.messages where env = 'production' order by name $$,
  $$ values ('Al Alerted', true), ('Fay Failed', true), ('Flo Flight', false), ('Han Handled', false),
            ('Nia Noalert', true), ('Spa Spam', false), ('Tay Takedown', true) $$,
  'once Resend takes the digest, everything it listed counts as notified'
);

set local role service_role;

select lives_ok(
  $$ select site.submit_message('visit', '{"name": "Lu Later", "phone": "(206) 555-0104"}', repeat('9', 64),
       'production', null) $$,
  'another message comes in'
);

select is(
  site.queue_message_digest('production', 'youth@example.test'), 0,
  'a second digest to the same inbox the same day is skipped'
);

reset role;

select results_eq(
  $$ select m.digest_id is null, l.status::text
     from site.messages m, public.email_log l
     where m.name = 'Lu Later' and l.template = 'daily-digest' and l.status = 'skipped_quota' $$,
  $$ values (true, 'skipped_quota') $$,
  'and its message waits for tomorrow''s'
);

set local role service_role;

select throws_ok(
  $$ select site.queue_message_digest('nowhere', 'youth@example.test') $$,
  '22023', null, 'a digest is for production or staging'
);

select throws_ok(
  $$ select site.queue_message_digest('production', ' ') $$,
  '22023', null, 'a digest needs an address'
);

reset role;

select * from finish();

rollback;
