-- The nightly backup's own database role, and how it reports in.
--
-- The backup job runs outside this repo. It signs in as backup_job through
-- the session pooler, dumps the database with pg_dump, copies the files, and
-- then calls record_backup() with the sizes. The owner's Home shows the last
-- one.
--
-- backup_job reads everything, past RLS, since a backup that skips rows
-- can't be restored. Like Supabase's own read-only role, that comes from
-- pg_read_all_data, which grants no writes. It can't sign in until its
-- password is set outside the repo, since a password can't be committed:
--
--   alter role backup_job with login password '...';
--
-- Roles belong to the whole server, not one database, so the role is only
-- created if it isn't there yet.

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'backup_job') then
    create role backup_job nologin bypassrls;
  end if;
end;
$$;

comment on role backup_job is 'The nightly backup. Reads everything, writes nothing, and reports through record_backup().';

grant pg_read_all_data to backup_job;

-- Logs a finished backup, with the size of its database dump and, when the
-- job copied files too, their total size and how many there are. Only
-- backup_job can call it. The sizes go in changes, and no one is behind the
-- row.
create function public.record_backup(p_database_bytes bigint, p_file_bytes bigint, p_files integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_database_bytes is null or p_database_bytes <= 0 then
    raise exception 'A backup needs the size of its database dump.' using errcode = '22023';
  end if;

  if p_file_bytes < 0 or p_files < 0 then
    raise exception 'File sizes and counts can''t be negative.' using errcode = '22023';
  end if;

  insert into public.activity_log (scope, action, entity_type, changes)
  values (
    'platform',
    'backup.completed',
    'backup',
    jsonb_build_object('database_bytes', p_database_bytes, 'file_bytes', p_file_bytes, 'files', p_files)
  );
end;
$$;

revoke execute on function public.record_backup(bigint, bigint, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.record_backup(bigint, bigint, integer) to backup_job;
