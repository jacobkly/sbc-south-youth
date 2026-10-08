-- Tags: owners with two-step sign-in make, rename, and delete them, and tag
-- any request in any status. Owners and finance viewers see them, viewers
-- never on a draft. Requesters never see a tag or a tag change, and saving
-- their own request leaves its tags alone. The event name is no longer
-- written, and older callers that still pass it keep working.
begin;

create extension if not exists pgtap with schema extensions;

select plan(47);

-- Start with no tags, so the seed's don't count.
delete from public.tags;

-- Fake people. New auth users get a row with no roles from the signup trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a002', 'viewer@example.test', '{"full_name": "Test Viewer"}'),
  ('00000000-0000-4000-8000-00000000a003', 'requester@example.test', '{"full_name": "Test Requester"}');

update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a001';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a002';
update public.users set roles = '{finance_requester}' where id = '00000000-0000-4000-8000-00000000a003';

insert into public.payees (id, full_name, user_id, linked_at) values
  ('00000000-0000-4000-8000-00000000b001', 'Test Payee', null, null),
  ('00000000-0000-4000-8000-00000000b003', 'Test Requester', '00000000-0000-4000-8000-00000000a003', now());

-- c001 is submitted, c002 is a draft, c003 is the requester's draft, and c004
-- is approved. Each has one receipt.
insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description
)
select
  ('00000000-0000-4000-8000-00000000' || r.suffix)::uuid,
  ('00000000-0000-4000-8000-00000000' || r.payee)::uuid,
  '00000000-0000-4000-8000-00000000a001',
  'youth', 1000, '2026-01-10', 'Fake Store', 'Request ' || r.suffix
from (values ('c001', 'b001'), ('c002', 'b001'), ('c003', 'b003'), ('c004', 'b001')) as r (suffix, payee);

insert into public.request_lines (id, request_id, position, amount_cents, vendor)
select
  ('00000000-0000-4000-8000-00000000f' || s)::uuid, ('00000000-0000-4000-8000-00000000c' || s)::uuid,
  1, 1000, 'Fake Store'
from unnest(array['001', '002', '003', '004']) as s;

update public.reimbursement_requests r
set status = v.status::public.request_status,
    submitted_at = '2026-01-11 12:00-08'::timestamptz,
    approved_by = case when v.status = 'approved' then '00000000-0000-4000-8000-00000000a001'::uuid end,
    approved_at = case when v.status = 'approved' then '2026-01-12 12:00-08'::timestamptz end
from (values ('c001', 'submitted'), ('c004', 'approved')) as v (suffix, status)
where r.id = ('00000000-0000-4000-8000-00000000' || v.suffix)::uuid;

-- As the owner with only a password.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal1"}',
  true
);

select throws_ok(
  $$ insert into public.tags (name) values ('Fall retreat') $$,
  '42501', null,
  'an owner can''t make a tag with only a password'
);

select throws_ok(
  $$ select public.set_request_tags('00000000-0000-4000-8000-00000000c001', '{}') $$,
  '42501', 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.',
  'or tag a request'
);

-- As the owner, with a code.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

-- Making and renaming tags.
select lives_ok(
  $$ insert into public.tags (id, name) values ('00000000-0000-4000-8000-00000000e001', '  Fall   retreat ') $$,
  'an owner with a code makes a tag'
);

select results_eq(
  $$ select name, created_by from public.tags where id = '00000000-0000-4000-8000-00000000e001' $$,
  $$ values ('Fall retreat', '00000000-0000-4000-8000-00000000a001'::uuid) $$,
  'its name is tidied, and it''s made by the owner'
);

select throws_ok(
  $$ insert into public.tags (name) values ('fall RETREAT') $$,
  '23505', 'There''s already a tag called Fall retreat.',
  'a name that differs only in case is taken, and the error names the tag that has it'
);

select throws_ok(
  $$ insert into public.tags (name) values ('   ') $$,
  '22023', 'Enter a name.',
  'a tag needs a name'
);

select throws_ok(
  $$ insert into public.tags (name) values (repeat('a', 51)) $$,
  '22001', 'Keep the name to 50 characters or fewer.',
  'a name is at most 50 characters'
);

select lives_ok(
  $$ insert into public.tags (id, name) values
       ('00000000-0000-4000-8000-00000000e002', 'Van'),
       ('00000000-0000-4000-8000-00000000e003', 'Game night');
     update public.tags set name = 'Game nights' where id = '00000000-0000-4000-8000-00000000e003' $$,
  'an owner makes more tags and renames one'
);

select bag_eq(
  $$ select action, scope, entity_name, changes -> 'name' ->> 'to'
     from public.activity_log
     where entity_id = '00000000-0000-4000-8000-00000000e003' $$,
  $$ values ('tag.created', 'finances', 'Game night', 'Game night'),
            ('tag.updated', 'finances', 'Game nights', 'Game nights') $$,
  'making and renaming a tag is finance activity'
);

-- Tagging requests.
select lives_ok(
  $$ select public.set_request_tags(
       '00000000-0000-4000-8000-00000000c001',
       array['00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000e001']::uuid[]
     ) $$,
  'an owner tags a submitted request'
);

select set_eq(
  $$ select tag_id from public.request_tags where request_id = '00000000-0000-4000-8000-00000000c001' $$,
  array['00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e002']::uuid[],
  'the request has both tags'
);

select results_eq(
  $$ select actor_id, from_status::text, to_status::text, changes
     from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c001' and action = 'tagged' $$,
  $$ values (
       '00000000-0000-4000-8000-00000000a001'::uuid, 'submitted', 'submitted',
       '{"tags": {"from": [], "to": ["Fall retreat", "Van"]}}'::jsonb
     ) $$,
  'its history notes the tags by name, in order'
);

select lives_ok(
  $$ select public.set_request_tags(
       '00000000-0000-4000-8000-00000000c001',
       array['00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e002',
             '00000000-0000-4000-8000-00000000e001', null]::uuid[]
     ) $$,
  'setting the same tags again, with a repeat and an empty one, works'
);

select is(
  (select count(*) from public.request_events
   where request_id = '00000000-0000-4000-8000-00000000c001' and action = 'tagged'),
  1::bigint,
  'and isn''t logged, since nothing changed'
);

select throws_ok(
  $$ select public.set_request_tags('00000000-0000-4000-8000-00000000c001', array[gen_random_uuid()]) $$,
  'P0002', 'That tag was deleted. Reload and try again.',
  'a tag that doesn''t exist can''t go on a request'
);

select throws_ok(
  $$ select public.set_request_tags(
       '00000000-0000-4000-8000-00000000c001', array(select gen_random_uuid() from generate_series(1, 11))
     ) $$,
  '22023', 'A request can have at most 10 tags.',
  'a request has at most 10 tags'
);

select throws_ok(
  $$ select public.set_request_tags(gen_random_uuid(), '{}') $$,
  'P0002', 'That request doesn''t exist.',
  'a request that doesn''t exist can''t be tagged'
);

select lives_ok(
  $$ select public.set_request_tags(
       '00000000-0000-4000-8000-00000000c004', array['00000000-0000-4000-8000-00000000e002']::uuid[]
     );
     select public.set_request_tags(
       '00000000-0000-4000-8000-00000000c003', array['00000000-0000-4000-8000-00000000e001']::uuid[]
     ) $$,
  'an owner tags an approved request, and a requester''s draft'
);

select is(
  (select tag_ids from public.request_report where id = '00000000-0000-4000-8000-00000000c001'),
  array['00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e002']::uuid[],
  'the report lists each request''s tags'
);

-- Saving with tags.
select lives_ok(
  $$ select public.save_request(
       p_request_id => null,
       p_payee_id => '00000000-0000-4000-8000-00000000b001',
       p_type => 'youth',
       p_purchase_date => '2026-01-10',
       p_description => 'New with tags',
       p_lines => '[{"id": "00000000-0000-4000-8000-00000000f101", "amount_cents": 500}]',
       p_tag_ids => array['00000000-0000-4000-8000-00000000e001']::uuid[]
     ) $$,
  'an owner saves a new request with its tags, and no event name'
);

select results_eq(
  $$ select
       (select array_agg(rt.tag_id) from public.request_tags rt where rt.request_id = r.id),
       (select array_agg(e.action) from public.request_events e where e.request_id = r.id)
     from public.reimbursement_requests r
     where r.description = 'New with tags' $$,
  $$ values (array['00000000-0000-4000-8000-00000000e001']::uuid[], array['created']) $$,
  'it has its tag, and its history is only that it was created'
);

select lives_ok(
  $$ select public.set_request_tags(
       '00000000-0000-4000-8000-00000000c002', array['00000000-0000-4000-8000-00000000e002']::uuid[]
     );
     select public.save_request(
       '00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000b001', 'youth', '2026-01-10',
       'Request c002', 'From the old app', false, null,
       '[{"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1000, "vendor": "Fake Store"}]'
     ) $$,
  'the older call, with an event name and no tags, still saves'
);

select results_eq(
  $$ select r.event_name, array(select rt.tag_id from public.request_tags rt where rt.request_id = r.id)
     from public.reimbursement_requests r
     where r.id = '00000000-0000-4000-8000-00000000c002' $$,
  $$ values (null::text, array['00000000-0000-4000-8000-00000000e002']::uuid[]) $$,
  'it doesn''t write the event name, and leaves the tags'
);

select lives_ok(
  $$ select public.save_request(
       p_request_id => '00000000-0000-4000-8000-00000000c002',
       p_payee_id => '00000000-0000-4000-8000-00000000b001',
       p_type => 'youth',
       p_purchase_date => '2026-01-10',
       p_description => 'Request c002',
       p_lines => '[{"id": "00000000-0000-4000-8000-00000000f002", "amount_cents": 1000, "vendor": "Fake Store"}]',
       p_tag_ids => '{}'
     ) $$,
  'an owner saves a request with no tags'
);

select bag_eq(
  $$ select changes from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c002' and action = 'tagged' $$,
  $$ values ('{"tags": {"from": [], "to": ["Van"]}}'::jsonb),
            ('{"tags": {"from": ["Van"], "to": []}}'::jsonb) $$,
  'taking the tags off an existing request is logged, like adding them'
);

select lives_ok(
  $$ select public.correct_request(
       p_request_id => '00000000-0000-4000-8000-00000000c004',
       p_type => 'youth',
       p_purchase_date => '2026-01-10',
       p_description => 'Fixed',
       p_no_receipt => false,
       p_no_receipt_reason => null,
       p_lines => '[{"id": "00000000-0000-4000-8000-00000000f004", "amount_cents": 1000, "vendor": "Fake Store"}]',
       p_reason => 'Typo'
     ) $$,
  'an owner corrects a request without passing an event name'
);

select results_eq(
  $$ select r.description, array(select rt.tag_id from public.request_tags rt where rt.request_id = r.id)
     from public.reimbursement_requests r
     where r.id = '00000000-0000-4000-8000-00000000c004' $$,
  $$ values ('Fixed', array['00000000-0000-4000-8000-00000000e002']::uuid[]) $$,
  'the correction saves and keeps its tags'
);

-- Van is on c001 and c004 now.
select lives_ok(
  $$ update public.tags set name = 'Church van' where id = '00000000-0000-4000-8000-00000000e002';
     update public.tags set name = 'Church van' where id = '00000000-0000-4000-8000-00000000e002' $$,
  'an owner renames a tag that''s on requests, then saves the same name again'
);

select results_eq(
  $$ select actor_id, changes from public.activity_log
     where entity_id = '00000000-0000-4000-8000-00000000e002' and action = 'tag.updated' $$,
  $$ values (
       '00000000-0000-4000-8000-00000000a001'::uuid,
       '{"name": {"from": "Van", "to": "Church van"}, "requests": {"from": 2, "to": 2}}'::jsonb
     ) $$,
  'the rename logs one row that says how many requests it''s on, and the same name logs nothing'
);

-- As the finance viewer.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated", "aal": "aal2"}',
  true
);

select is((select count(*) from public.tags), 3::bigint, 'a finance viewer reads every tag');

select set_eq(
  $$ select distinct request_id from public.request_tags $$,
  array['00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c004']::uuid[],
  'and the tags on submitted requests, never on drafts'
);

select isnt_empty(
  $$ select 1 from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c001' and action = 'tagged' $$,
  'and the tag changes in a request''s history'
);

select throws_ok(
  $$ insert into public.tags (name) values ('Viewer tag') $$,
  '42501', null,
  'a finance viewer can''t make a tag'
);

select is_empty(
  $$ update public.tags set name = 'Renamed' returning id $$,
  'or rename one'
);

select is_empty(
  $$ delete from public.tags returning id $$,
  'or delete one'
);

select throws_ok(
  $$ select public.set_request_tags('00000000-0000-4000-8000-00000000c001', '{}') $$,
  '42501', 'Only an owner can tag requests.',
  'or tag a request'
);

-- As the requester. The owner tagged their draft c003.
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a003", "role": "authenticated", "aal": "aal1"}',
  true
);

select is_empty($$ select 1 from public.tags $$, 'a requester reads no tags');

select is_empty($$ select 1 from public.request_tags $$, 'not even on their own request');

select set_eq(
  $$ select distinct action from public.request_events
     where request_id = '00000000-0000-4000-8000-00000000c003' $$,
  array['created'],
  'their request''s history leaves out the tag change'
);

select is_empty(
  $$ select 1 from public.activity_feed where action = 'request.tagged' $$,
  'and so does the activity feed'
);

select throws_ok(
  $$ select public.save_request(
       p_request_id => '00000000-0000-4000-8000-00000000c003',
       p_payee_id => '00000000-0000-4000-8000-00000000b003',
       p_type => 'youth',
       p_purchase_date => '2026-01-10',
       p_description => 'Request c003',
       p_lines => '[{"id": "00000000-0000-4000-8000-00000000f003", "amount_cents": 1000, "vendor": "Fake Store"}]',
       p_tag_ids => '{}'
     ) $$,
  '42501', 'Only an owner can tag requests.',
  'a requester can''t tag their request'
);

select lives_ok(
  $$ select public.save_request(
       p_request_id => '00000000-0000-4000-8000-00000000c003',
       p_payee_id => '00000000-0000-4000-8000-00000000b003',
       p_type => 'youth',
       p_purchase_date => '2026-01-10',
       p_description => 'Edited by the requester',
       p_lines => '[{"id": "00000000-0000-4000-8000-00000000f003", "amount_cents": 1000, "vendor": "Fake Store"}]'
     ) $$,
  'a requester saves their draft'
);

reset role;

select results_eq(
  $$ select r.description, array(select rt.tag_id from public.request_tags rt where rt.request_id = r.id)
     from public.reimbursement_requests r
     where r.id = '00000000-0000-4000-8000-00000000c003' $$,
  $$ values ('Edited by the requester', array['00000000-0000-4000-8000-00000000e001']::uuid[]) $$,
  'which keeps the tags the owner gave it'
);

-- Deleting a tag, as the owner with a code.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated", "aal": "aal2"}',
  true
);

select results_eq(
  $$ delete from public.tags where id = '00000000-0000-4000-8000-00000000e001' returning name $$,
  $$ values ('Fall retreat') $$,
  'an owner deletes a tag'
);

select is_empty(
  $$ select 1 from public.request_tags where tag_id = '00000000-0000-4000-8000-00000000e001' $$,
  'which takes it off every request'
);

-- It was on c001, the requester's draft c003, and the request saved with it.
select results_eq(
  $$ select actor_id, scope, entity_name, changes from public.activity_log
     where entity_id = '00000000-0000-4000-8000-00000000e001' and action = 'tag.deleted' $$,
  $$ values (
       '00000000-0000-4000-8000-00000000a001'::uuid, 'finances', 'Fall retreat',
       '{"name": {"from": "Fall retreat", "to": null}, "requests": {"from": 3, "to": 0}}'::jsonb
     ) $$,
  'and logs one finance activity row that says how many requests it was on, drafts too'
);

select is(
  (select count(*) from public.request_events where action = 'tagged'),
  5::bigint,
  'rather than a row in each request''s history'
);

reset role;

select * from finish();
rollback;
