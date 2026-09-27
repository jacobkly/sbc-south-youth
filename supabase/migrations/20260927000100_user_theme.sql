-- The color theme, saved on the account so it follows the user to every
-- device. Null until it's picked: each device keeps its own until then, and
-- the first signed-in page load saves that device's choice here.

alter table public.users
  add column theme text,
  add constraint users_theme_known check (theme in ('light', 'grey', 'dark', 'system'));

-- The existing update policy already limits this to an active user's own row.
grant update (theme) on table public.users to authenticated;

alter policy "Active users update their own name and picture" on public.users
  rename to "Active users update their own profile";
