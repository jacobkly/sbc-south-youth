-- Importing tithes from a spreadsheet: only an owner with two-step sign-in,
-- all rows or none, each saved as a tithe that came in the way the import
-- says. The import shows in the history as one entry, not one per tithe.
begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'requester@example.test', '{"full_name": "Test Requester"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set roles = '{finance_requester}' where id = '00000000-0000-4000-8000-00000000a003';

-- The local database may hold other income, so the checks here look only at
-- 2001, which nothing else uses.

select has_function('public', 'import_tithes', array['jsonb', 'income_method'], 'import_tithes exists');

select ok(
  not has_function_privilege('anon', 'public.import_tithes(jsonb, public.income_method)', 'execute'),
  'anon can''t import tithes'
);

-- Who can import.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated", "aal": "aal2"}',
  true
);

select throws_ok(
  $$ select public.import_tithes('[{"line": 1, "date": "2001-01-07", "amount_cents": 2500}]', 'cash_app') $$,
  '42501', 'Only an owner can import tithes.',
  'a finance viewer can''t import tithes'
);

select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated", "aal": "aal2"}',
  true
);

select throws_ok(
  $$ select public.import_tithes('[{"line": 1, "date": "2001-01-07", "amount_cents": 2500}]', 'cash_app') $$,
  '42501', 'Only an owner can import tithes.',
  'or a requester'
);

select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal1"}',
  true
);

select throws_ok(
  $$ select public.import_tithes('[{"line": 1, "date": "2001-01-07", "amount_cents": 2500}]', 'cash_app') $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'or an owner with only a password'
);

-- As the owner, with a code.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select is(
  public.import_tithes(
    '[{"line": 2, "date": "2001-01-07", "amount_cents": 2500},
      {"line": 3, "date": "2001-01-07", "amount_cents": 2500},
      {"line": 4, "date": "2001-02-04", "amount_cents": 1000}]',
    'cash_app'
  ),
  '{"tithes": 3, "total_cents": 6000}'::jsonb,
  'an owner with a code imports tithes, and hears how many and how much'
);

select results_eq(
  $$ select kind::text, received_on, amount_cents, method::text, event_name, created_by
     from public.youth_income
     where received_on between '2001-01-01' and '2001-12-31'
     order by received_on, amount_cents $$,
  $$ values
       ('tithe', '2001-01-07'::date, 2500, 'cash_app', null::text, '00000000-0000-4000-8000-00000000a001'::uuid),
       ('tithe', '2001-01-07'::date, 2500, 'cash_app', null::text, '00000000-0000-4000-8000-00000000a001'::uuid),
       ('tithe', '2001-02-04'::date, 1000, 'cash_app', null::text, '00000000-0000-4000-8000-00000000a001'::uuid) $$,
  'each row is a tithe that came in the way the import says, entered by the owner, equal gifts and all'
);

select results_eq(
  $$ select scope, action, entity_type, entity_id, entity_name, actor_id, changes
     from public.activity_log
     where action = 'youth_income.imported' and changes ->> 'first_on' = '2001-01-07' $$,
  $$ values (
       'finances', 'youth_income.imported', 'youth_income', null::text, null::text,
       '00000000-0000-4000-8000-00000000a001'::uuid,
       '{"count": 3, "total_cents": 6000, "method": "cash_app", "first_on": "2001-01-07", "last_on": "2001-02-04"}'::jsonb
     ) $$,
  'the import is one entry in the finance history: how many, how much, how, and the dates it covers'
);

select is_empty(
  $$ select 1 from public.activity_log a
     join public.youth_income y on y.id::text = a.entity_id
     where y.received_on between '2001-01-01' and '2001-12-31' $$,
  'and the tithes it added aren''t logged one by one'
);

select lives_ok(
  $$ insert into public.youth_income (id, received_on, amount_cents, method)
     values ('00000000-0000-4000-8000-00000000f101', '2001-03-04', 700, 'zelle') $$,
  'after an import, a tithe can still be added by hand'
);

select is(
  (select count(*)::int from public.activity_log
   where entity_id = '00000000-0000-4000-8000-00000000f101' and action = 'youth_income.created'),
  1,
  'and it''s logged, so the import doesn''t leave logging off'
);

select lives_ok(
  $$ update public.youth_income set amount_cents = 2600
     where received_on = '2001-02-04' $$,
  'an imported tithe can be edited'
);

select is(
  (select count(*)::int from public.activity_log a
   join public.youth_income y on y.id::text = a.entity_id
   where y.received_on = '2001-02-04' and a.action = 'youth_income.updated'),
  1,
  'and the edit is logged'
);

-- All or nothing.
select throws_ok(
  $$ select public.import_tithes(
       '[{"line": 2, "date": "2001-04-01", "amount_cents": 2500},
         {"line": 3, "date": "2999-01-01", "amount_cents": 2500}]',
       'zelle'
     ) $$,
  '22023', 'Row 3: The date can''t be in the future.',
  'a row dated in the future stops the import and says which row'
);

select throws_ok(
  $$ select public.import_tithes(
       '[{"line": 2, "date": "2001-04-01", "amount_cents": 2500},
         {"line": 5, "date": "2001-04-08", "amount_cents": 0}]',
       'zelle'
     ) $$,
  '22023', 'Row 5 couldn''t be imported. Check its date and amount.',
  'so does an amount of $0'
);

select throws_ok(
  $$ select public.import_tithes('[{"line": 7, "date": "someday", "amount_cents": 2500}]', 'zelle') $$,
  '22023', 'Row 7 couldn''t be imported. Check its date and amount.',
  'or a date that isn''t one'
);

select throws_ok(
  $$ select public.import_tithes('[{"line": 8, "date": "1999-12-26", "amount_cents": 2500}]', 'zelle') $$,
  '22023', 'Row 8 couldn''t be imported. Check its date and amount.',
  'or a date before 2000'
);

select is_empty(
  $$ select 1 from public.youth_income where received_on between '2001-04-01' and '2001-04-30' $$,
  'and none of their rows are saved'
);

select is_empty(
  $$ select 1 from public.activity_log
     where action = 'youth_income.imported' and changes ->> 'method' = 'zelle' $$,
  'or logged'
);

select throws_ok(
  $$ select public.import_tithes('[{"line": 2, "date": "2001-04-01", "amount_cents": 2500}]', null) $$,
  '22023', 'Choose how they came in.',
  'an import needs to say how the tithes came in'
);

select throws_ok(
  $$ select public.import_tithes('[]', 'cash') $$,
  '22023', 'There are no rows to import.',
  'and needs at least one row'
);

select throws_ok(
  $$ select public.import_tithes('{"line": 2}', 'cash') $$,
  '22023', 'There are no rows to import.',
  'in a list'
);

select throws_ok(
  $$ select public.import_tithes(
       (select jsonb_agg(jsonb_build_object('line', n, 'date', '2001-05-06', 'amount_cents', 100))
        from generate_series(1, 2001) as n),
       'cash'
     ) $$,
  '22023', 'Import at most 2,000 rows at a time.',
  'of at most 2,000 rows'
);

select lives_ok(
  $$ select public.import_tithes(
       (select jsonb_agg(jsonb_build_object('line', n, 'date', '2001-05-06', 'amount_cents', 100))
        from generate_series(1, 2000) as n),
       'cash'
     ) $$,
  '2,000 rows import at once'
);

select is(
  (select count(*)::int from public.youth_income where received_on = '2001-05-06'),
  2000,
  'every one of them'
);

select is(
  (select count(*)::int from public.activity_log
   where action = 'youth_income.imported' and changes ->> 'first_on' = '2001-05-06'),
  1,
  'as one entry in the history'
);

-- Readers.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated", "aal": "aal1"}',
  true
);

select is(
  (select count(*)::int from public.activity_log
   where action = 'youth_income.imported' and changes ->> 'first_on' = '2001-01-07'),
  1,
  'a finance viewer sees the import in the history'
);

select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated", "aal": "aal1"}',
  true
);

select is_empty(
  $$ select 1 from public.activity_log where action = 'youth_income.imported' $$,
  'a requester doesn''t'
);

select * from finish();
rollback;
