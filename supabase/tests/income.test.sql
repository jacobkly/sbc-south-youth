-- Income: youth money (each tithe on its own, or one total for an event like
-- a bake sale) and the cafe's sales for each Monday to Sunday week. Owners
-- with two-step sign-in add, change, and delete it. Owners and finance viewers
-- read it, and nobody else sees any of it. Every change is logged, and nothing
-- holds a name of who gave.
begin;

create extension if not exists pgtap with schema extensions;

select plan(61);

-- Fake people. New auth users get a row with no roles from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'requester@example.test', '{"full_name": "Test Requester"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set roles = '{finance_requester}' where id = '00000000-0000-4000-8000-00000000a003';

-- The owner has an authenticator set up, so a session without its code is refused.
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000a001', 'Test phone', 'totp', 'verified',
    now(), now());

-- Shape.
select enum_has_labels('public', 'income_method', array['cash_app', 'zelle', 'cash'], 'money comes in by Cash App, Zelle, or cash');
select enum_has_labels('public', 'youth_income_kind', array['tithe', 'event'], 'youth money is a tithe or an event');

select hasnt_column('public', 'youth_income', 'note', 'youth income has no note, so a name has nowhere to go');

-- As the owner with only a password.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal1"}',
  true
);

select throws_ok(
  $$ insert into public.youth_income (received_on, amount_cents, method) values ('2026-01-04', 2500, 'cash_app') $$,
  '42501', null,
  'an owner can''t add a tithe with only a password'
);

select throws_ok(
  $$ insert into public.cafe_weeks (week_ending, sales_cents) values ('2026-01-04', 45000) $$,
  '42501', null,
  'or a cafe week'
);

-- As the owner, with a code.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

-- Youth income.
select lives_ok(
  $$ insert into public.youth_income (id, received_on, amount_cents, method)
     values ('00000000-0000-4000-8000-00000000e001', '2026-01-04', 2500, 'cash_app') $$,
  'an owner with a code adds a tithe'
);

select results_eq(
  $$ select kind::text, created_by from public.youth_income where id = '00000000-0000-4000-8000-00000000e001' $$,
  $$ values ('tithe', '00000000-0000-4000-8000-00000000a001'::uuid) $$,
  'it''s a tithe unless it says otherwise, entered by the owner'
);

select lives_ok(
  $$ insert into public.youth_income (id, kind, received_on, amount_cents, method, event_name)
     values ('00000000-0000-4000-8000-00000000e002', 'event', '2026-01-04', 31000, null, '  Bake sale  ') $$,
  'an owner adds an event''s total, which can come in more than one way'
);

select is(
  (select event_name from public.youth_income where id = '00000000-0000-4000-8000-00000000e002'),
  'Bake sale',
  'the event''s name is trimmed'
);

select lives_ok(
  $$ insert into public.youth_income (id, kind, received_on, amount_cents, method, event_name)
     values ('00000000-0000-4000-8000-00000000e003', 'event', '2026-01-11', 8000, 'cash', ' ') $$,
  'an event doesn''t need a name'
);

select is(
  (select event_name from public.youth_income where id = '00000000-0000-4000-8000-00000000e003'),
  null,
  'a blank name is no name'
);

select lives_ok(
  $$ insert into public.youth_income (id, received_on, amount_cents, method)
     values ('00000000-0000-4000-8000-00000000e004', (now() at time zone 'America/Los_Angeles')::date, 1000, 'zelle') $$,
  'a tithe can be dated today in Los Angeles'
);

with changed as (
  update public.youth_income set amount_cents = 3000
  where id = '00000000-0000-4000-8000-00000000e001'
  returning 1
)
select is(count(*)::int, 1, 'an owner changes a tithe') from changed;

with removed as (
  delete from public.youth_income where id = '00000000-0000-4000-8000-00000000e003' returning 1
)
select is(count(*)::int, 1, 'and deletes an event') from removed;

select throws_ok(
  $$ insert into public.youth_income (received_on, amount_cents, method)
     values ((now() at time zone 'America/Los_Angeles')::date + 1, 2500, 'cash_app') $$,
  '22023', 'The date can''t be in the future.',
  'youth income can''t be dated in the future'
);

select throws_ok(
  $$ insert into public.youth_income (received_on, amount_cents, method) values ('1999-12-31', 2500, 'cash_app') $$,
  '23514', null,
  'or before 2000'
);

select throws_ok(
  $$ insert into public.youth_income (received_on, amount_cents, method) values ('2026-01-04', 0, 'cash_app') $$,
  '23514', null,
  'youth income can''t be $0'
);

select throws_ok(
  $$ insert into public.youth_income (received_on, amount_cents, method) values ('2026-01-04', 100000001, 'cash_app') $$,
  '23514', null,
  'or more than $1,000,000'
);

select throws_ok(
  $$ insert into public.youth_income (received_on, amount_cents, method, event_name)
     values ('2026-01-04', 2500, 'cash_app', 'Someone') $$,
  '22023', 'Only an event can have a name.',
  'a tithe can''t have a name'
);

select throws_ok(
  $$ update public.youth_income set kind = 'tithe' where id = '00000000-0000-4000-8000-00000000e002' $$,
  '22023', 'Only an event can have a name.',
  'or become a tithe while it has one'
);

select throws_ok(
  $$ insert into public.youth_income (received_on, amount_cents, method) values ('2026-01-04', 2500, null) $$,
  '22023', 'Choose how the tithe came in.',
  'a tithe says how it came in'
);

select throws_ok(
  $$ insert into public.youth_income (kind, received_on, amount_cents, event_name)
     values ('event', '2026-01-04', 2500, repeat('a', 101)) $$,
  '23514', null,
  'an event''s name is at most 100 characters'
);

select throws_ok(
  $$ insert into public.youth_income (received_on, amount_cents, method, created_by)
     values ('2026-01-04', 2500, 'cash_app', '00000000-0000-4000-8000-00000000a002') $$,
  '42501', null,
  'nobody sets who entered it'
);

-- Cafe weeks. January 4 and 11, 2026 are Sundays.
select lives_ok(
  $$ insert into public.cafe_weeks (id, week_ending, sales_cents)
     values ('00000000-0000-4000-8000-00000000f001', '2026-01-04', 45000) $$,
  'an owner with a code adds a cafe week'
);

select is(
  (select created_by from public.cafe_weeks where id = '00000000-0000-4000-8000-00000000f001'),
  '00000000-0000-4000-8000-00000000a001'::uuid,
  'entered by the owner'
);

select lives_ok(
  $$ insert into public.cafe_weeks (id, week_ending, sales_cents, note)
     values ('00000000-0000-4000-8000-00000000f002', '2026-01-11', 0, '  Closed for camp  ') $$,
  'a week can be $0, with a note'
);

select is(
  (select note from public.cafe_weeks where id = '00000000-0000-4000-8000-00000000f002'),
  'Closed for camp',
  'the note is trimmed'
);

select lives_ok(
  $$ insert into public.cafe_weeks (id, week_ending, sales_cents)
     values (
       '00000000-0000-4000-8000-00000000f003',
       (now() at time zone 'America/Los_Angeles')::date
         + (7 - extract(isodow from (now() at time zone 'America/Los_Angeles')::date))::int,
       12000
     ) $$,
  'this week can be entered before it ends'
);

with changed as (
  update public.cafe_weeks set sales_cents = 47500
  where id = '00000000-0000-4000-8000-00000000f001'
  returning 1
)
select is(count(*)::int, 1, 'an owner changes a week''s sales') from changed;

select throws_ok(
  $$ insert into public.cafe_weeks (week_ending, sales_cents) values ('2026-01-05', 45000) $$,
  '22023', 'A cafe week ends on a Sunday.',
  'a cafe week ends on a Sunday'
);

select throws_ok(
  $$ insert into public.cafe_weeks (week_ending, sales_cents)
     values (
       (now() at time zone 'America/Los_Angeles')::date
         + (14 - extract(isodow from (now() at time zone 'America/Los_Angeles')::date))::int,
       45000
     ) $$,
  '22023', 'That week hasn''t started yet.',
  'next week can''t be entered yet'
);

select throws_ok(
  $$ insert into public.cafe_weeks (week_ending, sales_cents) values ('2026-01-04', 100) $$,
  '23505', 'That week already has its sales. Open it to change them.',
  'a week can''t be entered twice'
);

select throws_ok(
  $$ update public.cafe_weeks set week_ending = '2026-01-04' where id = '00000000-0000-4000-8000-00000000f002' $$,
  '23505', 'That week already has its sales. Open it to change them.',
  'or moved onto a week that has its sales'
);

select throws_ok(
  $$ insert into public.cafe_weeks (week_ending, sales_cents) values ('1999-12-26', 100) $$,
  '23514', null,
  'a cafe week ends in 2000 or later'
);

select throws_ok(
  $$ insert into public.cafe_weeks (week_ending, sales_cents) values ('2025-12-28', -1) $$,
  '23514', null,
  'sales can''t be negative'
);

select throws_ok(
  $$ insert into public.cafe_weeks (week_ending, sales_cents, note) values ('2025-12-28', 100, repeat('a', 501)) $$,
  '23514', null,
  'a note is at most 500 characters'
);

with removed as (
  delete from public.cafe_weeks where id = '00000000-0000-4000-8000-00000000f002' returning 1
)
select is(count(*)::int, 1, 'an owner deletes a week') from removed;

-- History. The local database may hold other income history, so these look
-- only at this test's rows.
select results_eq(
  $$ select action, count(*)::int from public.activity_log
     where entity_type in ('youth_income', 'cafe_week')
       and entity_id::text similar to '00000000-0000-4000-8000-00000000(e|f)%'
     group by action order by action $$,
  $$ values
       ('cafe_week.created', 3), ('cafe_week.deleted', 1), ('cafe_week.updated', 1),
       ('youth_income.created', 4), ('youth_income.deleted', 1), ('youth_income.updated', 1) $$,
  'every add, change, and delete is logged once'
);

select is_empty(
  $$ select 1 from public.activity_log
     where entity_type in ('youth_income', 'cafe_week')
       and entity_id::text similar to '00000000-0000-4000-8000-00000000(e|f)%'
       and (scope <> 'finances' or actor_id is distinct from '00000000-0000-4000-8000-00000000a001') $$,
  'as finance activity, by the owner'
);

select is(
  (select changes from public.activity_log where action = 'youth_income.updated'
     and entity_id = '00000000-0000-4000-8000-00000000e001'),
  '{"amount_cents": {"from": 2500, "to": 3000}}'::jsonb,
  'a change logs what changed'
);

select is(
  (select changes from public.activity_log where action = 'youth_income.deleted'
     and entity_id = '00000000-0000-4000-8000-00000000e003'),
  jsonb_build_object(
    'kind', jsonb_build_object('from', 'event', 'to', null),
    'received_on', jsonb_build_object('from', '2026-01-11', 'to', null),
    'amount_cents', jsonb_build_object('from', 8000, 'to', null),
    'method', jsonb_build_object('from', 'cash', 'to', null),
    'event_name', jsonb_build_object('from', null, 'to', null)
  ),
  'a delete logs what was there'
);

select is(
  (select entity_name from public.activity_log where action = 'youth_income.created'
     and entity_id = '00000000-0000-4000-8000-00000000e002'),
  'Bake sale',
  'an event is logged by its name'
);

-- As the owner with only a password, nothing changes.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal1"}',
  true
);

with changed as (
  update public.youth_income set amount_cents = 1 where id = '00000000-0000-4000-8000-00000000e001' returning 1
)
select is(count(*)::int, 0, 'an owner can''t change a tithe with only a password') from changed;

with removed as (
  delete from public.youth_income where id = '00000000-0000-4000-8000-00000000e001' returning 1
)
select is(count(*)::int, 0, 'or delete one') from removed;

with changed as (
  update public.cafe_weeks set sales_cents = 1 where id = '00000000-0000-4000-8000-00000000f001' returning 1
)
select is(count(*)::int, 0, 'or change a cafe week') from changed;

select is(
  (select count(*)::int from public.youth_income where id::text like '00000000-0000-4000-8000-00000000e%'),
  3,
  'but still reads youth income'
);

-- As the viewer, with a code.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated", "aal": "aal2"}',
  true
);

select is(
  (select count(*)::int from public.youth_income where id::text like '00000000-0000-4000-8000-00000000e%'),
  3,
  'a viewer reads youth income'
);

select is(
  (select count(*)::int from public.cafe_weeks where id::text like '00000000-0000-4000-8000-00000000f%'),
  2,
  'and cafe weeks'
);

select is(
  (select count(*)::int from public.activity_log where entity_type in ('youth_income', 'cafe_week')
     and entity_id::text similar to '00000000-0000-4000-8000-00000000(e|f)%'),
  11,
  'and their history'
);

select throws_ok(
  $$ insert into public.youth_income (received_on, amount_cents, method) values ('2026-01-04', 2500, 'cash_app') $$,
  '42501', null,
  'a viewer can''t add a tithe'
);

with changed as (
  update public.youth_income set amount_cents = 1 where id = '00000000-0000-4000-8000-00000000e001' returning 1
)
select is(count(*)::int, 0, 'or change one') from changed;

with removed as (
  delete from public.youth_income where id = '00000000-0000-4000-8000-00000000e001' returning 1
)
select is(count(*)::int, 0, 'or delete one') from removed;

select throws_ok(
  $$ insert into public.cafe_weeks (week_ending, sales_cents) values ('2025-12-28', 100) $$,
  '42501', null,
  'or add a cafe week'
);

with changed as (
  update public.cafe_weeks set sales_cents = 1 where id = '00000000-0000-4000-8000-00000000f001' returning 1
)
select is(count(*)::int, 0, 'or change one') from changed;

with removed as (
  delete from public.cafe_weeks where id = '00000000-0000-4000-8000-00000000f001' returning 1
)
select is(count(*)::int, 0, 'or delete one') from removed;

-- As the requester, with a code.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated", "aal": "aal2"}',
  true
);

select is_empty($$ select 1 from public.youth_income $$, 'a requester reads no youth income');
select is_empty($$ select 1 from public.cafe_weeks $$, 'or cafe weeks');

select is_empty(
  $$ select 1 from public.activity_log where entity_type in ('youth_income', 'cafe_week') $$,
  'or their history'
);

select throws_ok(
  $$ insert into public.youth_income (received_on, amount_cents, method) values ('2026-01-04', 2500, 'cash_app') $$,
  '42501', null,
  'and can''t add a tithe'
);

-- As anon.
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok($$ select 1 from public.youth_income $$, '42501', null, 'anon can''t read youth income');
select throws_ok($$ select 1 from public.cafe_weeks $$, '42501', null, 'or cafe weeks');

reset role;

select * from finish();
rollback;
