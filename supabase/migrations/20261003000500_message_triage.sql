-- The portal's Messages screen.
--
-- Its leader picker reads site.message_assignees(), since the Messages role
-- can't read public.users and the directory doesn't say who has Messages.
-- And a message's history in Activity, its kind, who has it, and how it
-- went, is now only for the Messages role, the same people who can read the
-- message. Site editors still see heads-up and event history.

-- Active leaders a message can be assigned to: owners and the Messages role,
-- the same rule site.triage_message() checks. Names and pictures only.
create function site.message_assignees()
returns table (id uuid, full_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.full_name, u.avatar_path
  from public.users u
  where (select public.has_role('site_messages'))
    and u.is_active
    and u.roles && array['owner', 'site_messages']::public.app_role[]
  order by u.full_name, u.id
$$;

revoke execute on function site.message_assignees() from public, anon, service_role;
grant execute on function site.message_assignees() to authenticated;

alter policy "Activity is readable by scope"
  on public.activity_log
  using (
    case scope
      when 'site' then
        case entity_type
          when 'message' then (select public.has_role('site_messages'))
          else (select public.has_role('site_editor', 'site_messages'))
        end
      when 'finances' then (select public.has_role('finance_viewer'))
      when 'platform' then (select public.has_role('owner'))
      else false
    end
  );
