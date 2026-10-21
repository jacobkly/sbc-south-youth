-- The cafe's weeks line by line as Square adds them up, and the church's
-- quarterly paybacks for the cafe's discounts. Owners who don't owe a code add,
-- change, and delete paybacks. Owners and finance viewers read them, nobody
-- else sees them, and every change is logged.
begin;

create extension if not exists pgtap with schema extensions;

select plan(39);

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
select enum_has_labels(
  'public', 'cafe_payback_kind', array['discounts', 'gift_cards'], 'the church pays back discounts and prepays gift cards'
);

-- As the owner, with a code.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

-- Weeks.
insert into public.cafe_weeks (id, week_ending, sales_cents)
values ('00000000-0000-4000-8000-0000000cf001', '2026-01-04', 45000);

select results_eq(
  $$ select returns_cents, discounts_cents, gift_card_sales_cents, gift_card_redeemed_cents, taxes_cents, tips_cents,
       fees_cents, source
     from public.cafe_weeks where id = '00000000-0000-4000-8000-0000000cf001' $$,
  $$ values (0, 0, 0, 0, 0, 0, 0, 'manual') $$,
  'a week typed by hand has only its gross, and zeros for the other lines'
);

select lives_ok(
  $$ insert into public.cafe_weeks (
       id, week_ending, sales_cents, returns_cents, discounts_cents, gift_card_sales_cents, gift_card_redeemed_cents,
       taxes_cents, tips_cents, fees_cents, source
     ) values (
       '00000000-0000-4000-8000-0000000cf002', '2026-01-11', 52000, 500, 12000, 2500, 1800, 0, 4100, 2200, 'square'
     ) $$,
  'an owner adds a week from Square with every line'
);

select throws_ok(
  $$ insert into public.cafe_weeks (week_ending, sales_cents, discounts_cents) values ('2026-01-18', 100, -1) $$,
  '23514', null,
  'a Square line can''t be negative'
);

select throws_ok(
  $$ insert into public.cafe_weeks (week_ending, sales_cents, fees_cents) values ('2026-01-18', 100, 100000001) $$,
  '23514', null,
  'or more than $1,000,000'
);

select throws_ok(
  $$ insert into public.cafe_weeks (week_ending, sales_cents, source) values ('2026-01-18', 100, 'typed') $$,
  '23514', null,
  'a week comes from typing or from Square'
);

update public.cafe_weeks set discounts_cents = 12500, tips_cents = 4000
where id = '00000000-0000-4000-8000-0000000cf002';

select is(
  (select changes from public.activity_log where action = 'cafe_week.updated'
     and entity_id = '00000000-0000-4000-8000-0000000cf002'),
  '{"discounts_cents": {"from": 12000, "to": 12500}, "tips_cents": {"from": 4100, "to": 4000}}'::jsonb,
  'a change to a line logs what changed'
);

select is(
  (select changes -> 'source' from public.activity_log where action = 'cafe_week.created'
     and entity_id = '00000000-0000-4000-8000-0000000cf002'),
  '{"from": null, "to": "square"}'::jsonb,
  'and the history says it came from Square'
);

-- Paybacks.
select lives_ok(
  $$ insert into public.cafe_paybacks (id, quarter_start, received_on, amount_cents, note)
     values ('00000000-0000-4000-8000-0000000cb001', '2026-01-01', '2026-04-10', 20000, '  Bank transfer  ') $$,
  'an owner with a code records a payback'
);

select results_eq(
  $$ select kind::text, note, created_by from public.cafe_paybacks where id = '00000000-0000-4000-8000-0000000cb001' $$,
  $$ values ('discounts', 'Bank transfer', '00000000-0000-4000-8000-00000000a001'::uuid) $$,
  'it''s for discounts unless it says otherwise, with a tidy note, entered by the owner'
);

select lives_ok(
  $$ insert into public.cafe_paybacks (id, quarter_start, received_on, amount_cents)
     values ('00000000-0000-4000-8000-0000000cb002', '2026-01-01', '2026-04-24', 4500) $$,
  'a quarter can have a second payback when the first came in short'
);

select lives_ok(
  $$ insert into public.cafe_paybacks (id, kind, quarter_start, received_on, amount_cents)
     values ('00000000-0000-4000-8000-0000000cb003', 'gift_cards', '2026-01-01', '2026-01-09', 25000) $$,
  'and one for the gift cards the church prepays'
);

select is(
  (select changes -> 'kind' from public.activity_log where action = 'cafe_payback.created'
     and entity_id = '00000000-0000-4000-8000-0000000cb003'),
  '{"from": null, "to": "gift_cards"}'::jsonb,
  'and the history says what it was for'
);

select throws_ok(
  $$ insert into public.cafe_paybacks (quarter_start, received_on, amount_cents) values ('2026-02-01', '2026-04-10', 100) $$,
  '22023', 'A payback is for a quarter, which starts on January 1, April 1, July 1, or October 1.',
  'a payback is for a quarter, starting on its first day'
);

select throws_ok(
  $$ insert into public.cafe_paybacks (quarter_start, received_on, amount_cents) values ('2026-04-02', '2026-04-10', 100) $$,
  '22023', 'A payback is for a quarter, which starts on January 1, April 1, July 1, or October 1.',
  'not the day after'
);

select throws_ok(
  format(
    $$ insert into public.cafe_paybacks (quarter_start, received_on, amount_cents) values (%L, '2026-04-10', 100) $$,
    (date_trunc('quarter', (now() at time zone 'America/Los_Angeles')::date) + interval '3 months')::date
  ),
  '22023', 'That quarter hasn''t started yet.',
  'a payback can''t be for a quarter that hasn''t started'
);

select throws_ok(
  format(
    $$ insert into public.cafe_paybacks (quarter_start, received_on, amount_cents) values ('2026-01-01', %L, 100) $$,
    (now() at time zone 'America/Los_Angeles')::date + 1
  ),
  '22023', 'The date can''t be in the future.',
  'or received in the future, in Los Angeles'
);

select throws_ok(
  $$ insert into public.cafe_paybacks (quarter_start, received_on, amount_cents) values ('2026-01-01', '2026-04-10', 0) $$,
  '23514', null,
  'a payback is more than $0'
);

select throws_ok(
  $$ insert into public.cafe_paybacks (quarter_start, received_on, amount_cents)
     values ('2026-01-01', '2026-04-10', 100000001) $$,
  '23514', null,
  'and no more than $1,000,000'
);

select throws_ok(
  $$ insert into public.cafe_paybacks (quarter_start, received_on, amount_cents) values ('1999-10-01', '2026-04-10', 100) $$,
  '23514', null,
  'for a quarter in 2000 or later'
);

select throws_ok(
  $$ insert into public.cafe_paybacks (quarter_start, received_on, amount_cents, note)
     values ('2026-01-01', '2026-04-10', 100, repeat('a', 501)) $$,
  '23514', null,
  'with a note of 500 characters at most'
);

with changed as (
  update public.cafe_paybacks set amount_cents = 21000
  where id = '00000000-0000-4000-8000-0000000cb001' returning 1
)
select is(count(*)::int, 1, 'an owner changes a payback') from changed;

with changed as (
  update public.cafe_paybacks set quarter_start = '2025-10-01', received_on = '2026-01-15'
  where id = '00000000-0000-4000-8000-0000000cb002' returning 1
)
select is(count(*)::int, 1, 'including the quarter it covers') from changed;

with removed as (
  delete from public.cafe_paybacks where id = '00000000-0000-4000-8000-0000000cb002' returning 1
)
select is(count(*)::int, 1, 'and deletes one') from removed;

select results_eq(
  $$ select action, count(*)::int from public.activity_log
     where entity_type = 'cafe_payback'
       and entity_id in ('00000000-0000-4000-8000-0000000cb001', '00000000-0000-4000-8000-0000000cb002')
     group by action order by action $$,
  $$ values ('cafe_payback.created', 2), ('cafe_payback.deleted', 1), ('cafe_payback.updated', 2) $$,
  'each change to a payback is logged once'
);

select is(
  (select changes from public.activity_log where action = 'cafe_payback.updated'
     and entity_id = '00000000-0000-4000-8000-0000000cb001'),
  '{"amount_cents": {"from": 20000, "to": 21000}}'::jsonb,
  'a change logs what changed'
);

select is(
  (select scope from public.activity_log where action = 'cafe_payback.created'
     and entity_id = '00000000-0000-4000-8000-0000000cb001'),
  'finances',
  'as finance activity'
);

-- As the owner with only a password, nothing changes.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal1"}',
  true
);

select throws_ok(
  $$ insert into public.cafe_paybacks (quarter_start, received_on, amount_cents) values ('2026-01-01', '2026-04-10', 100) $$,
  '42501', null,
  'an owner can''t record a payback with only a password'
);

with changed as (
  update public.cafe_paybacks set amount_cents = 1 where id = '00000000-0000-4000-8000-0000000cb001' returning 1
)
select is(count(*)::int, 0, 'or change one') from changed;

-- As the viewer, with a code. The seed's paybacks may be there too, so these
-- look only at this test's.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated", "aal": "aal2"}',
  true
);

select results_eq(
  $$ select id, amount_cents from public.cafe_paybacks
     where id in ('00000000-0000-4000-8000-0000000cb001', '00000000-0000-4000-8000-0000000cb002') $$,
  $$ values ('00000000-0000-4000-8000-0000000cb001'::uuid, 21000) $$,
  'a viewer reads paybacks'
);

select is(
  (select count(*)::int from public.activity_log where entity_type = 'cafe_payback'
     and entity_id in ('00000000-0000-4000-8000-0000000cb001', '00000000-0000-4000-8000-0000000cb002')),
  5,
  'and their history'
);

select throws_ok(
  $$ insert into public.cafe_paybacks (quarter_start, received_on, amount_cents) values ('2026-01-01', '2026-04-10', 100) $$,
  '42501', null,
  'a viewer can''t record a payback'
);

with changed as (
  update public.cafe_paybacks set amount_cents = 1 where id = '00000000-0000-4000-8000-0000000cb001' returning 1
)
select is(count(*)::int, 0, 'or change one') from changed;

with removed as (
  delete from public.cafe_paybacks where id = '00000000-0000-4000-8000-0000000cb001' returning 1
)
select is(count(*)::int, 0, 'or delete one') from removed;

with changed as (
  update public.cafe_weeks set fees_cents = 1 where id = '00000000-0000-4000-8000-0000000cf002' returning 1
)
select is(count(*)::int, 0, 'or change a week''s lines') from changed;

-- As the requester, with a code.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated", "aal": "aal2"}',
  true
);

select is_empty($$ select 1 from public.cafe_paybacks $$, 'a requester reads no paybacks');

select is_empty(
  $$ select 1 from public.activity_log where entity_type = 'cafe_payback' $$,
  'or their history'
);

select throws_ok(
  $$ insert into public.cafe_paybacks (quarter_start, received_on, amount_cents) values ('2026-01-01', '2026-04-10', 100) $$,
  '42501', null,
  'and can''t record one'
);

-- As anon.
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok($$ select 1 from public.cafe_paybacks $$, '42501', null, 'anon can''t read paybacks');

reset role;

select * from finish();
rollback;
