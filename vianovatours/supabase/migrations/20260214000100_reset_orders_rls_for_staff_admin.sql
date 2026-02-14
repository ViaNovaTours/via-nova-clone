-- Reset orders RLS to match app role model:
-- - admin: full access
-- - staff: read/insert/update
-- - delete: admin only

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and lower(role) = 'admin'
    );
$$;

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

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
  loop
    execute format('drop policy if exists %I on public.orders', policy_record.policyname);
  end loop;
end
$$;

create policy "orders_staff_or_admin_select"
on public.orders
for select
to authenticated
using (public.is_staff_or_admin());

create policy "orders_staff_or_admin_insert"
on public.orders
for insert
to authenticated
with check (public.is_staff_or_admin());

create policy "orders_staff_or_admin_update"
on public.orders
for update
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

create policy "orders_admin_delete"
on public.orders
for delete
to authenticated
using (public.is_admin());

