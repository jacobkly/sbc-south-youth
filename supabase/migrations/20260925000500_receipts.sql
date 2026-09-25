-- Receipts: table rows, the private storage bucket, and its policies.
-- Files live at receipts/{request_id}/{receipt_id}.{ext}.

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.reimbursement_requests (id) on delete cascade,
  storage_path text not null unique,
  storage_location text not null default 'supabase' check (storage_location = 'supabase'),
  original_filename text not null check (char_length(original_filename) <= 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/webp', 'image/png', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid default auth.uid() references public.users (id),
  created_at timestamptz not null default now(),
  constraint receipts_storage_path_format check (
    storage_path like request_id::text || '/' || id::text || '.%'
  )
);

create index receipts_request_id_idx on public.receipts (request_id);
create index receipts_uploaded_by_idx on public.receipts (uploaded_by);
create index receipts_sha256_idx on public.receipts (sha256);

-- At most 10 receipts per request.
create function public.limit_receipts_per_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Lock the parent so two uploads at once can't both squeeze past the limit.
  perform 1
  from public.reimbursement_requests r
  where r.id = new.request_id
  for update;

  if (select count(*) from public.receipts rc where rc.request_id = new.request_id) >= 10 then
    raise exception 'A request can have at most 10 receipts.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.limit_receipts_per_request() from public, anon, authenticated;

create trigger limit_receipts_per_request
  before insert on public.receipts
  for each row execute function public.limit_receipts_per_request();

-- Audit log entries for added and removed receipts.
create function public.log_receipt_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.request_events (request_id, actor_id, action, changes)
    values (
      new.request_id,
      auth.uid(),
      'receipt_added',
      jsonb_build_object('receipt_id', new.id, 'filename', new.original_filename)
    );
    return null;
  end if;

  -- Skip when the receipt is going away because its draft is being deleted.
  if exists (select 1 from public.reimbursement_requests r where r.id = old.request_id) then
    insert into public.request_events (request_id, actor_id, action, changes)
    values (
      old.request_id,
      auth.uid(),
      'receipt_removed',
      jsonb_build_object('receipt_id', old.id, 'filename', old.original_filename)
    );
  end if;

  return null;
end;
$$;

revoke execute on function public.log_receipt_event() from public, anon, authenticated;

create trigger log_receipt_event
  after insert or delete on public.receipts
  for each row execute function public.log_receipt_event();

alter table public.receipts enable row level security;

-- Receipts are added or removed, never edited.
revoke all on table public.receipts from anon, authenticated;
grant select, delete on table public.receipts to authenticated;
grant insert (
  id,
  request_id,
  storage_path,
  original_filename,
  mime_type,
  size_bytes,
  width,
  height,
  sha256
) on table public.receipts to authenticated;

create policy "Receipts are readable with their request"
  on public.receipts for select
  to authenticated
  using (
    exists (
      select 1
      from public.reimbursement_requests r
      where r.id = receipts.request_id
    )
  );

create policy "Admins add receipts to open requests"
  on public.receipts for insert
  to authenticated
  with check (
    (select public.current_app_role()) = 'admin'
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id = receipts.request_id
        and r.status in ('draft', 'submitted', 'needs_info')
    )
  );

create policy "Admins remove receipts from open requests"
  on public.receipts for delete
  to authenticated
  using (
    (select public.current_app_role()) = 'admin'
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id = receipts.request_id
        and r.status in ('draft', 'submitted', 'needs_info')
    )
  );

-- Total size of stored receipts, for the dashboard storage bar.
create function public.storage_usage()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(public.current_app_role() in ('admin', 'viewer'), false) then
    raise exception 'Only admins and viewers can see storage usage.' using errcode = '42501';
  end if;

  return (
    select coalesce(sum(rc.size_bytes), 0)::bigint
    from public.receipts rc
    where rc.storage_location = 'supabase'
  );
end;
$$;

revoke execute on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;

-- Storage bucket ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg', 'image/webp', 'image/png', 'application/pdf']
);

-- Files follow their request, found by the request id in the first folder of
-- the path. The exists() checks run under the caller's request policies.
create policy "Receipt files are readable with their request"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id::text = (storage.foldername(objects.name))[1]
    )
  );

create policy "Admins upload receipt files to open requests"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (select public.current_app_role()) = 'admin'
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id::text = (storage.foldername(objects.name))[1]
        and r.status in ('draft', 'submitted', 'needs_info')
    )
  );

create policy "Admins delete receipt files from open requests"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (select public.current_app_role()) = 'admin'
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id::text = (storage.foldername(objects.name))[1]
        and r.status in ('draft', 'submitted', 'needs_info')
    )
  );
