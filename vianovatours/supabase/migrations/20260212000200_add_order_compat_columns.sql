alter table if exists public.orders
  add column if not exists tour_timezone text,
  add column if not exists purchase_date_pst text,
  add column if not exists purchase_date_tour_tz text,
  add column if not exists updated_date timestamptz,
  add column if not exists customer_communication jsonb not null default '[]'::jsonb;

