-- Allow staff to manage tours and ticket types (admin keeps same access).

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('staff', 'admin')
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and lower(role) in ('staff', 'admin')
    );
$$;

drop policy if exists "tours_admin_write" on public.tours;
drop policy if exists "tours_staff_or_admin_write" on public.tours;
create policy "tours_staff_or_admin_write"
on public.tours
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

drop policy if exists "ticket_types_admin_write" on public.ticket_types;
drop policy if exists "ticket_types_staff_or_admin_write" on public.ticket_types;
create policy "ticket_types_staff_or_admin_write"
on public.ticket_types
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

