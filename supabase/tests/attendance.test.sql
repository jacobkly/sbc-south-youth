-- Headcounts. The Attendance role adds, fixes, and removes them, finance
-- viewers only read them, owners do everything, and nobody else sees them.
-- Each change is in Activity, for the Attendance role and owners only.
begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a701', 'usher@example.test', '{"full_name": "Test Usher"}'),
  ('00000000-0000-4000-8000-00000000a702', 'owner@example.test', '{"full_name": "Test Owner"}'),
  ('00000000-0000-4000-8000-00000000a703', 'viewer@example.test', '{"full_name": "Finance Viewer"}'),
  ('00000000-0000-4000-8000-00000000a704', 'editor@example.test', '{"full_name": "Site Editor"}'),
  ('00000000-0000-4000-8000-00000000a705', 'removed@example.test', '{"full_name": "Removed Usher"}');

update public.users set roles = '{attendance}' where id = '00000000-0000-4000-8000-00000000a701';
update public.users set roles = '{owner}' where id = '00000000-0000-4000-8000-00000000a702';
update public.users set roles = '{finance_viewer}' where id = '00000000-0000-4000-8000-00000000a703';
update public.users set roles = '{site_editor,site_messages}' where id = '00000000-0000-4000-8000-00000000a704';
update public.users set roles = '{attendance}', is_active = false where id = '00000000-0000-4000-8000-00000000a705';

-- Only this test's rows, whatever the seed holds. Adding this one logs it,
-- under the usher it names.
delete from public.headcounts;
delete from public.activity_log where entity_type = 'headcount';
insert into public.headcounts (id, night, total, created_by, updated_by) values
  (
    '00000000-0000-4000-8000-00000000c701', '2026-09-25', 40,
    '00000000-0000-4000-8000-00000000a701', '00000000-0000-4000-8000-00000000a701'
  );

-- A heads-up, so there's other site activity to see.
insert into site.posts (title, body, created_by, updated_by) values
  ('Headcount test post', 'Hi.', '00000000-0000-4000-8000-00000000a704', '00000000-0000-4000-8000-00000000a704');

select has_table('public', 'headcounts', 'headcounts exists');

select ok(
  'attendance' = any (enum_range(null::public.app_role)::text[]),
  'attendance is a role'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.headcounts'::regclass),
  'headcounts has RLS on'
);

select ok(
  not has_table_privilege('anon', 'public.headcounts', 'select'),
  'anon can''t read headcounts'
);

select ok(
  not has_table_privilege('service_role', 'public.headcounts', 'select'),
  'the secret key can''t read headcounts'
);

select ok(
  not has_column_privilege('authenticated', 'public.headcounts', 'created_by', 'insert')
    and not has_column_privilege('authenticated', 'public.headcounts', 'updated_by', 'update'),
  'nobody sets who wrote a headcount'
);

set local role authenticated;

-- As the usher.
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a701", "role": "authenticated"}', true
);

select is((select count(*)::int from public.headcounts), 1, 'the Attendance role reads every headcount');

select lives_ok(
  $$ insert into public.headcounts (id, night, total)
     values ('00000000-0000-4000-8000-00000000c702', '2026-10-02', 45) $$,
  'the Attendance role adds a headcount'
);

select is(
  (select created_by from public.headcounts where night = '2026-10-02'),
  '00000000-0000-4000-8000-00000000a701'::uuid,
  'a new headcount names who added it'
);

select lives_ok(
  $$ update public.headcounts set total = 47 where night = '2026-10-02' $$,
  'the Attendance role fixes a headcount'
);

select is((select total from public.headcounts where night = '2026-10-02'), 47, 'the fix is saved');

select throws_ok(
  $$ insert into public.headcounts (night, total) values ('2026-10-02', 50) $$,
  '23505',
  'Oct 2, 2026 already has a headcount. Change that one instead.',
  'a night has one headcount'
);

select throws_ok(
  $$ update public.headcounts set night = '2026-09-25' where night = '2026-10-02' $$,
  '23505',
  'Sep 25, 2026 already has a headcount. Change that one instead.',
  'a headcount can''t move onto a night that has one'
);

select throws_ok(
  $$ insert into public.headcounts (night, total) values ('2999-01-01', 50) $$,
  '22023',
  'The night can''t be in the future.',
  'a night that hasn''t happened yet can''t have a headcount'
);

select throws_ok(
  $$ insert into public.headcounts (night, total) values ('2026-09-18', 0) $$,
  '23514',
  null,
  'a headcount is at least 1'
);

select throws_ok(
  $$ insert into public.headcounts (night, total) values ('2026-09-18', 1001) $$,
  '23514',
  null,
  'a headcount is at most 1,000'
);

select throws_ok(
  $$ insert into public.headcounts (night, total, note) values ('2026-09-18', 30, repeat('a', 201)) $$,
  '23514',
  null,
  'a note is at most 200 characters'
);

select throws_ok(
  $$ insert into public.headcounts (night, total, note) values ('2026-09-18', 30, ' Rainy night ') $$,
  '23514',
  null,
  'a note is saved trimmed, and a blank one is left empty'
);

select throws_ok(
  $$ insert into public.headcounts (night, total, created_by)
     values ('2026-09-18', 30, '00000000-0000-4000-8000-00000000a702') $$,
  '42501',
  null,
  'the Attendance role can''t say someone else added it'
);

select lives_ok(
  $$ update public.headcounts set night = '2026-10-03' where night = '2026-10-02' $$,
  'a headcount can move to a night that has none'
);

select lives_ok(
  $$ delete from public.headcounts where night = '2026-10-03' $$,
  'the Attendance role removes a headcount'
);

select results_eq(
  $$ select action, entity_name, changes
     from public.activity_log
     where entity_type = 'headcount' and actor_id = '00000000-0000-4000-8000-00000000a701'
     order by action, entity_name $$,
  $$ values
       ('headcount.created', '2026-09-25',
        '{"night": {"from": null, "to": "2026-09-25"}, "total": {"from": null, "to": 40},
          "note": {"from": null, "to": null}, "combined": {"from": null, "to": false}}'::jsonb),
       ('headcount.created', '2026-10-02',
        '{"night": {"from": null, "to": "2026-10-02"}, "total": {"from": null, "to": 45},
          "note": {"from": null, "to": null}, "combined": {"from": null, "to": false}}'::jsonb),
       ('headcount.deleted', '2026-10-03',
        '{"night": {"from": "2026-10-03", "to": null}, "total": {"from": 47, "to": null},
          "note": {"from": null, "to": null}, "combined": {"from": false, "to": null}}'::jsonb),
       ('headcount.updated', '2026-10-02', '{"total": {"from": 45, "to": 47}}'::jsonb),
       ('headcount.updated', '2026-10-03', '{"night": {"from": "2026-10-02", "to": "2026-10-03"}}'::jsonb) $$,
  'each change is logged with only the night, the total, the note, and the mark'
);

select is_empty(
  $$ select 1 from public.activity_log where entity_type = 'post' and entity_name = 'Headcount test post' $$,
  'the Attendance role doesn''t see other site activity'
);

-- As the finance viewer.
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a703", "role": "authenticated"}', true
);

select is((select count(*)::int from public.headcounts), 1, 'a finance viewer reads every headcount');

select throws_ok(
  $$ insert into public.headcounts (night, total) values ('2026-09-18', 30) $$,
  '42501',
  null,
  'a finance viewer can''t add a headcount'
);

select is_empty(
  $$ with changed as (update public.headcounts set total = 1 returning id) select * from changed $$,
  'a finance viewer can''t change a headcount'
);

select is_empty(
  $$ with removed as (delete from public.headcounts returning id) select * from removed $$,
  'a finance viewer can''t remove a headcount'
);

select is_empty(
  $$ select 1 from public.activity_log where entity_type = 'headcount' $$,
  'a finance viewer doesn''t see who changed headcounts'
);

-- As the site editor, who also has Messages.
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a704", "role": "authenticated"}', true
);

select is_empty($$ select 1 from public.headcounts $$, 'other portal roles read no headcounts');

select is_empty(
  $$ select 1 from public.activity_log where entity_type = 'headcount' $$,
  'other portal roles don''t see headcount activity'
);

select isnt_empty(
  $$ select 1 from public.activity_log where entity_type = 'post' and entity_name = 'Headcount test post' $$,
  'site editors still see the rest of the site''s activity'
);

-- As the removed usher.
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a705", "role": "authenticated"}', true
);

select is_empty($$ select 1 from public.headcounts $$, 'once removed, the Attendance role reads nothing');

select throws_ok(
  $$ insert into public.headcounts (night, total) values ('2026-09-18', 30) $$,
  '42501',
  null,
  'once removed, the Attendance role can''t add a headcount'
);

-- As the owner, who counts as every role.
select set_config(
  'request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a702", "role": "authenticated"}', true
);

select is((select count(*)::int from public.headcounts), 1, 'an owner reads every headcount');

select lives_ok(
  $$ insert into public.headcounts (night, total) values ('2026-09-18', 38) $$,
  'an owner adds a headcount'
);

select is(
  (select updated_by from public.headcounts where night = '2026-09-18'),
  '00000000-0000-4000-8000-00000000a702'::uuid,
  'the owner is named as the last to change it'
);

select lives_ok(
  $$ insert into public.headcounts (night, total, note, combined)
     values ('2026-09-11', 120, 'Joint night with another group', true) $$,
  'an owner adds a combined event with a note'
);

select lives_ok(
  $$ update public.headcounts set note = 'Rainy night' where night = '2026-09-25' $$,
  'an owner adds a note to someone else''s headcount'
);

select is(
  (select updated_by from public.headcounts where night = '2026-09-25'),
  '00000000-0000-4000-8000-00000000a702'::uuid,
  'changing only the note names who changed it'
);

select is(
  (select changes from public.activity_log
   where entity_type = 'headcount' and entity_name = '2026-09-25' and action = 'headcount.updated'),
  '{"note": {"from": null, "to": "Rainy night"}}'::jsonb,
  'a note on its own is logged'
);

select lives_ok(
  $$ update public.headcounts set total = 41 where night = '2026-09-25' $$,
  'an owner fixes someone else''s headcount'
);

select is(
  (select count(*)::int from public.activity_log where entity_type = 'headcount'),
  9,
  'an owner sees every headcount change'
);

select * from finish();
rollback;
