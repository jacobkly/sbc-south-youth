-- Profile pictures: a private bucket for the files and a path on each user.
-- Files live at avatars/{user_id}/{random id}.{ext}. A new picture gets a new
-- name, so no browser shows a cached old one, and the app deletes the old file.
-- The browser shrinks pictures to about 30 KB before upload.

alter table public.users
  add column avatar_path text,
  add constraint users_avatar_path_format check (
    avatar_path ~ ('^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$')
  );

-- The existing update policy already limits this to an active user's own row.
grant update (avatar_path) on table public.users to authenticated;

alter policy "Active users update their own name" on public.users
  rename to "Active users update their own name and picture";

-- Private bucket. The size limit catches a picture the browser didn't shrink.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  51200, -- 50 KB
  array['image/webp', 'image/jpeg']
);

-- Each user owns the folder named after their id. Admins and viewers see
-- everyone's pictures, like they see everyone's users row.
create policy "Avatars are readable by their owner, admins, and viewers"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (select public.current_app_role()) in ('admin', 'viewer')
      or (
        (select public.current_app_role()) is not null
        and (storage.foldername(objects.name))[1] = (select auth.uid())::text
      )
    )
  );

create policy "Active users upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (select public.current_app_role()) is not null
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  );

create policy "Active users delete their own avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (select public.current_app_role()) is not null
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  );
