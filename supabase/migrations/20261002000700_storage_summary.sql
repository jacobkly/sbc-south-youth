-- The portal's storage bar. The free plan gives 1 GB of files, shared by
-- receipts, profile pictures and site photos, and a 500 MB database. Anyone
-- with a portal role can see how full both are, so this returns sizes only:
-- no file names, folders, or owners, and nothing from a finance table.
-- storage_usage() stays as it is for the finances dashboard.
create function public.storage_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('finance_viewer', 'site_editor', 'site_messages') then
    raise exception 'Only people who use the portal can see storage.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'buckets', (
      select coalesce(jsonb_agg(
        jsonb_build_object('bucket', s.bucket, 'objects', s.objects, 'bytes', s.bytes) order by s.bucket
      ), '[]'::jsonb)
      from (
        -- Every bucket, even an empty one. An upload that hasn't finished
        -- has no size yet and counts as nothing.
        select
          b.id as bucket,
          count(o.id) as objects,
          coalesce(sum((o.metadata ->> 'size')::bigint), 0) as bytes
        from storage.buckets b
        left join storage.objects o on o.bucket_id = b.id
        group by b.id
      ) s
    ),
    'database_bytes', pg_catalog.pg_database_size(pg_catalog.current_database())
  );
end;
$$;

revoke execute on function public.storage_summary() from public, anon;
grant execute on function public.storage_summary() to authenticated;
