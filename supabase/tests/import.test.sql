-- Spreadsheet import: admin only, payees matched by name, all or nothing.
begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

-- Fake people. New auth users get a member row from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@example.test', '{"full_name": "Test Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}');

update public.users set role = 'admin' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set role = 'viewer' where id = '00000000-0000-4000-8000-00000000a002';

-- One payee already exists, and one is linked to the admin.
insert into public.payees (id, full_name, user_id, linked_at) values
  ('00000000-0000-4000-8000-00000000b001', 'Test Payee', null, null),
  ('00000000-0000-4000-8000-00000000b002', 'Linked Admin', '00000000-0000-4000-8000-00000000a001', now());

-- One tag already exists. The seed's don't count.
delete from public.tags;
insert into public.tags (id, name) values ('00000000-0000-4000-8000-00000000e001', 'Van');

select has_function('public', 'import_paid_requests', 'import_paid_requests exists');

select ok(
  not has_function_privilege('anon', 'public.import_paid_requests(jsonb, public.payment_method, text)', 'execute'),
  'anon can''t import'
);

set local role authenticated;

-- As the viewer.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.import_paid_requests(
       '[{"line": 2, "date": "2026-01-15", "name": "Test Payee", "amount_cents": 1000, "type": "youth", "notes": "Pizza"}]',
       'cash_app'
     ) $$,
  '42501',
  'Only an admin can import requests.',
  'a viewer can''t import'
);

-- As the admin.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select is(
  public.import_paid_requests(
    '[
      {"line": 2, "date": "2026-01-15", "name": "  test   PAYEE ", "amount_cents": 1250, "type": "youth", "notes": "Pizza"},
      {"line": 3, "date": "2026-02-01", "name": "New Person", "amount_cents": 800, "type": "cafe", "notes": ""},
      {"line": 4, "date": "2026-02-02", "name": "new person", "amount_cents": 450, "type": "cafe", "notes": "Cups"}
    ]',
    'cash_app'
  ),
  '{"requests": 3, "payees": 1, "tags": 0}'::jsonb,
  'imports every row and counts the new payees'
);

select is(
  (select count(*)::int from public.payees where lower(full_name) = 'new person'),
  1,
  'names that differ only in case share one new payee'
);

select is(
  (select count(*)::int from public.reimbursement_requests where payee_id = '00000000-0000-4000-8000-00000000b001'),
  1,
  'a name with different case and spacing matches the existing payee'
);

select is(
  (
    select count(*)::int
    from public.reimbursement_requests
    where status = 'paid'
      and vendor is null
      and no_receipt
      and no_receipt_reason = 'Imported from spreadsheet'
      and payment_method = 'cash_app'
      and paid_by = '00000000-0000-4000-8000-00000000a001'
  ),
  3,
  'rows are recorded as paid with no receipt'
);

select is(
  (select paid_date from public.request_report where description = 'Pizza'),
  '2026-01-15'::date,
  'the paid date is the spreadsheet date in LA'
);

select is(
  (
    select count(*)::int
    from public.reimbursement_requests
    where no_receipt_reason = 'Imported from spreadsheet'
      and description is null
      and paid_by = '00000000-0000-4000-8000-00000000a001'
  ),
  1,
  'blank notes leave the description empty'
);

select is(
  (
    select count(*)::int
    from public.request_events e
    join public.reimbursement_requests r on r.id = e.request_id
    where r.no_receipt_reason = 'Imported from spreadsheet'
      and r.paid_by = '00000000-0000-4000-8000-00000000a001'
      and e.action = 'recorded_paid'
  ),
  3,
  'each import is in the audit log'
);

select throws_ok(
  $$ select public.import_paid_requests(
       '[
         {"line": 2, "date": "2026-03-01", "name": "Test Payee", "amount_cents": 1000, "type": "youth", "notes": "Should roll back"},
         {"line": 3, "date": "2026-03-02", "name": "Test Payee", "amount_cents": 1000, "type": "snacks", "notes": "Bad type"}
       ]',
       'cash_app'
     ) $$,
  '22023',
  'Row 3 couldn''t be imported. Check its date, name, amount, and type.',
  'a bad value names its row'
);

select is(
  (select count(*)::int from public.reimbursement_requests where description = 'Should roll back'),
  0,
  'a failed import saves nothing'
);

select throws_ok(
  $$ select public.import_paid_requests(
       '[{"line": 5, "date": "2999-01-01", "name": "Test Payee", "amount_cents": 1000, "type": "youth", "notes": "Later"}]',
       'cash_app'
     ) $$,
  '22023',
  'Row 5: The purchase date can''t be in the future.',
  'the usual rules apply, with the row number'
);

-- Paid to the admin importing, so an outside approver is needed.
select is(
  public.import_paid_requests(
    '[{"line": 2, "date": "2026-04-01", "name": "Linked Admin", "amount_cents": 2000, "type": "youth", "notes": "Own receipt"}]',
    'cash_app',
    'Outside Approver'
  ) ->> 'requests',
  '1',
  'rows paid to the importing admin take the outside approver'
);

-- Tags.
select is(
  public.import_paid_requests(
    '[
      {"line": 2, "date": "2026-05-01", "name": "Test Payee", "amount_cents": 3000, "type": "youth", "notes": "Retreat gas",
       "tags": ["Fall  retreat", "van", "fall retreat", " "]},
      {"line": 3, "date": "2026-05-02", "name": "Test Payee", "amount_cents": 4000, "type": "youth", "notes": "Retreat food",
       "tags": ["FALL RETREAT"]}
    ]',
    'cash_app'
  ),
  '{"requests": 2, "payees": 0, "tags": 1}'::jsonb,
  'tags are matched without regard to case or spacing, and new ones are counted'
);

select results_eq(
  $$ select r.description, t.name
     from public.request_tags rt
     join public.reimbursement_requests r on r.id = rt.request_id
     join public.tags t on t.id = rt.tag_id
     order by r.description, t.name $$,
  $$ values ('Retreat food', 'Fall retreat'), ('Retreat gas', 'Fall retreat'), ('Retreat gas', 'Van') $$,
  'each row gets its tags, spelled as the tag already is or as first seen'
);

select results_eq(
  $$ select entity_name from public.activity_log
     where action = 'tag.created' and actor_id = '00000000-0000-4000-8000-00000000a001' $$,
  $$ values ('Fall retreat') $$,
  'a new tag is logged like any other'
);

select is_empty(
  $$ select 1
     from public.request_events e
     join public.reimbursement_requests r on r.id = e.request_id
     where e.action = 'tagged' and r.paid_by = '00000000-0000-4000-8000-00000000a001' $$,
  'tags are part of creating the request, not a change to it'
);

select throws_ok(
  $$ select public.import_paid_requests(
       '[{"line": 7, "date": "2026-05-03", "name": "Test Payee", "amount_cents": 1000, "type": "youth", "notes": "Too many",
          "tags": ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]}]',
       'cash_app'
     ) $$,
  '22023',
  'Row 7: A request can have at most 10 tags.',
  'a row can have at most 10 tags'
);

select throws_ok(
  $$ select public.import_paid_requests(
       '[{"line": 8, "date": "2026-05-03", "name": "Test Payee", "amount_cents": 1000, "type": "youth", "notes": "Long",
          "tags": ["xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]}]',
       'cash_app'
     ) $$,
  '22001',
  'Row 8: Keep each tag to 50 characters or fewer.',
  'a tag can be at most 50 characters'
);

select is(
  (select count(*)::int from public.tags),
  2,
  'a failed import adds no tags'
);

select * from finish();
rollback;
