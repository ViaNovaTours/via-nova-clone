create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_id text,
  tour text,
  tour_date date,
  tour_time text,
  tickets jsonb not null default '[]'::jsonb,
  extras jsonb not null default '[]'::jsonb,
  first_name text,
  last_name text,
  email text,
  country_code text,
  phone_number_country text,
  phone text,
  address text,
  city text,
  state_region text,
  zip text,
  country text,
  venue text,
  budget_max numeric,
  special_instructions text,
  status text not null default 'unprocessed',
  priority text not null default 'normal',
  tags text[] not null default '{}'::text[],
  purchase_url text,
  purchase_date timestamptz not null default now(),
  created_date timestamptz not null default now(),
  fulfilled_by text,
  currency text not null default 'USD',
  total_cost numeric default 0,
  total_ticket_cost numeric default 0,
  projected_profit numeric,
  official_site_url text,
  ticket_files jsonb not null default '[]'::jsonb,
  processing_notes text,
  email_communications jsonb not null default '[]'::jsonb,
  payment_method text,
  payment_status text,
  payment_captured boolean,
  payment_transaction_id text,
  payment_customer_id text,
  payment_fee numeric,
  payment_net_amount numeric,
  tour_card_number text,
  tour_card_expiry text,
  tour_card_cvv text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  country text,
  image_url text,
  site_url text,
  official_ticketing_url text,
  physical_address text,
  sop_url text,
  video_url text,
  google_drive_receipts_url text,
  timezone text,
  card_number text,
  card_expiry text,
  card_cvv text,
  notes text,
  extras jsonb not null default '[]'::jsonb,
  pdf_redaction_preset jsonb,
  recommended_tours text[] not null default '{}'::text[],
  woocommerce_site_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  name text not null,
  description text,
  internal_name text,
  price numeric not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.woo_commerce_credentials (
  id uuid primary key default gen_random_uuid(),
  site_name text not null unique,
  tour_name text not null,
  website_url text not null,
  api_url text,
  consumer_key text,
  consumer_secret text,
  profit_margin numeric not null default 0.25,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  tour_name text not null,
  source text,
  cost numeric not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_costs (
  id uuid primary key default gen_random_uuid(),
  month int not null check (month between 1 and 12),
  year int not null,
  currency text not null default 'USD',
  va_costs numeric not null default 0,
  make_com numeric not null default 0,
  gmail_templates numeric not null default 0,
  slack numeric not null default 0,
  siteground numeric not null default 0,
  sendgrid numeric not null default 0,
  google_workspace numeric not null default 0,
  zerobounce numeric not null default 0,
  digital_ocean numeric not null default 0,
  base44 numeric not null default 0,
  other_costs numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(month, year)
);

create table if not exists public.tour_landing_pages (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  slug text not null,
  tour_name text not null,
  favicon_url text,
  hero_title text,
  hero_subtitle text,
  hero_image_url text,
  description text,
  highlights jsonb not null default '[]'::jsonb,
  faqs jsonb not null default '[]'::jsonb,
  ticket_types jsonb not null default '[]'::jsonb,
  available_times jsonb not null default '[]'::jsonb,
  day_specific_times jsonb,
  advance_booking_hours int not null default 0,
  gallery_images jsonb not null default '[]'::jsonb,
  timezone text default 'America/New_York',
  collect_address boolean not null default false,
  payment_processor text not null default 'stripe',
  confirmation_email_from text default 'info@vianovatours.com',
  location_address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_order_id_idx on public.orders(order_id);
create index if not exists orders_tour_idx on public.orders(tour);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_purchase_date_idx on public.orders(purchase_date);
create index if not exists ad_spend_date_idx on public.ad_spend(date);
create index if not exists ad_spend_tour_name_idx on public.ad_spend(tour_name);
create index if not exists ticket_types_tour_id_idx on public.ticket_types(tour_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_orders on public.orders;
create trigger set_updated_at_orders
before update on public.orders
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_tours on public.tours;
create trigger set_updated_at_tours
before update on public.tours
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_ticket_types on public.ticket_types;
create trigger set_updated_at_ticket_types
before update on public.ticket_types
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_woo_credentials on public.woo_commerce_credentials;
create trigger set_updated_at_woo_credentials
before update on public.woo_commerce_credentials
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_ad_spend on public.ad_spend;
create trigger set_updated_at_ad_spend
before update on public.ad_spend
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_monthly_costs on public.monthly_costs;
create trigger set_updated_at_monthly_costs
before update on public.monthly_costs
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_tour_landing_pages on public.tour_landing_pages;
create trigger set_updated_at_tour_landing_pages
before update on public.tour_landing_pages
for each row execute procedure public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.tours enable row level security;
alter table public.ticket_types enable row level security;
alter table public.woo_commerce_credentials enable row level security;
alter table public.ad_spend enable row level security;
alter table public.monthly_costs enable row level security;
alter table public.tour_landing_pages enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all"
on public.orders
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "tours_public_read" on public.tours;
create policy "tours_public_read"
on public.tours
for select
to anon, authenticated
using (true);

drop policy if exists "tours_admin_write" on public.tours;
create policy "tours_admin_write"
on public.tours
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "ticket_types_public_read" on public.ticket_types;
create policy "ticket_types_public_read"
on public.ticket_types
for select
to anon, authenticated
using (true);

drop policy if exists "ticket_types_admin_write" on public.ticket_types;
create policy "ticket_types_admin_write"
on public.ticket_types
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "woo_credentials_admin_all" on public.woo_commerce_credentials;
create policy "woo_credentials_admin_all"
on public.woo_commerce_credentials
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "ad_spend_admin_all" on public.ad_spend;
create policy "ad_spend_admin_all"
on public.ad_spend
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "monthly_costs_admin_all" on public.monthly_costs;
create policy "monthly_costs_admin_all"
on public.monthly_costs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "tour_landing_pages_public_read" on public.tour_landing_pages;
create policy "tour_landing_pages_public_read"
on public.tour_landing_pages
for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists "tour_landing_pages_admin_write" on public.tour_landing_pages;
create policy "tour_landing_pages_admin_write"
on public.tour_landing_pages
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
