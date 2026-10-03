-- Photos that are down but whose files are still stored. The portal
-- deletes a photo's files right after site.remove_photo(), and if that
-- fails, the Photos screen lists the photo here to delete them again.
--
-- It runs as the caller, so RLS answers: only site editors see both the
-- tombstones and the files, and everyone else gets nothing.
create function site.photos_with_files_left()
returns table (id uuid, mime_type text)
language sql
stable
set search_path = ''
as $$
  select p.id, p.mime_type
  from site.photos p
  where p.status = 'removed'
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'site-photos' and starts_with(o.name, p.id::text || '/')
    )
  order by p.removed_at desc, p.id;
$$;

revoke execute on function site.photos_with_files_left() from public, anon, service_role;
grant execute on function site.photos_with_files_left() to authenticated;
