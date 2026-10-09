-- Two-step sign-in becomes each person's choice. Someone with an
-- authenticator app set up still enters a code from it before changing
-- anything that needed one, and someone without one, owners included, signs
-- in with only their password. Adding an authenticator under Account turns
-- it on, and removing the last one turns it off.
--
-- One function, needs_code(), says whether this session still owes a code,
-- and require_aal2() and every policy that checked aal2 now ask it. Reading
-- isn't affected, and nothing else changes.

-- Whether this session still has to enter an authenticator code: it hasn't
-- entered one (aal2), and the person has a verified authenticator.
create function public.needs_code()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (auth.jwt() ->> 'aal') is distinct from 'aal2'
    and exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = auth.uid()
        and f.status = 'verified'
    );
$$;

revoke execute on function public.needs_code() from public, anon;
grant execute on function public.needs_code() to authenticated;

-- Raises when this session still owes an authenticator code.
create or replace function public.require_aal2()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if public.needs_code() then
    raise exception 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.'
      using errcode = '42501';
  end if;
end;
$$;

-- Income.

alter policy "Owners add youth income"
  on public.youth_income
  with check ((select public.has_role('owner')) and not (select public.needs_code()));

alter policy "Owners change youth income"
  on public.youth_income
  using ((select public.has_role('owner')) and not (select public.needs_code()))
  with check ((select public.has_role('owner')) and not (select public.needs_code()));

alter policy "Owners delete youth income"
  on public.youth_income
  using ((select public.has_role('owner')) and not (select public.needs_code()));

alter policy "Owners add cafe weeks"
  on public.cafe_weeks
  with check ((select public.has_role('owner')) and not (select public.needs_code()));

alter policy "Owners change cafe weeks"
  on public.cafe_weeks
  using ((select public.has_role('owner')) and not (select public.needs_code()))
  with check ((select public.has_role('owner')) and not (select public.needs_code()));

alter policy "Owners delete cafe weeks"
  on public.cafe_weeks
  using ((select public.has_role('owner')) and not (select public.needs_code()));

-- Tags.

alter policy "Owners add tags"
  on public.tags
  with check ((select public.has_role('owner')) and not (select public.needs_code()));

alter policy "Owners rename tags"
  on public.tags
  using ((select public.has_role('owner')) and not (select public.needs_code()))
  with check ((select public.has_role('owner')) and not (select public.needs_code()));

alter policy "Owners delete tags"
  on public.tags
  using ((select public.has_role('owner')) and not (select public.needs_code()));

-- Receipts and their files on approved and paid requests.

alter policy "Owners add receipts to approved and paid requests"
  on public.receipts
  with check (
    (select public.has_role('owner'))
    and not (select public.needs_code())
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id = receipts.request_id
        and r.status in ('approved', 'paid')
    )
  );

alter policy "Owners remove receipts from approved and paid requests"
  on public.receipts
  using (
    (select public.has_role('owner'))
    and not (select public.needs_code())
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id = receipts.request_id
        and r.status in ('approved', 'paid')
    )
  );

alter policy "Owners upload receipt files to approved and paid requests"
  on storage.objects
  with check (
    bucket_id = 'receipts'
    and (select public.has_role('owner'))
    and not (select public.needs_code())
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id::text = (storage.foldername(objects.name))[1]
        and r.status in ('approved', 'paid')
    )
  );

alter policy "Owners delete receipt files from approved and paid requests"
  on storage.objects
  using (
    bucket_id = 'receipts'
    and (select public.has_role('owner'))
    and not (select public.needs_code())
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id::text = (storage.foldername(objects.name))[1]
        and r.status in ('approved', 'paid')
    )
  );
