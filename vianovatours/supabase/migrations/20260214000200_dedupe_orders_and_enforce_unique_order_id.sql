-- Remove duplicate order rows and prevent future duplicates.
-- Keep the newest row per order_id, preferring rows with tags.

with ranked as (
  select
    id,
    row_number() over (
      partition by order_id
      order by
        case when coalesce(array_length(tags, 1), 0) > 0 then 1 else 0 end desc,
        coalesce(updated_at, purchase_date, created_at) desc nulls last,
        created_at desc nulls last,
        id desc
    ) as row_num
  from public.orders
  where order_id is not null
    and btrim(order_id) <> ''
),
to_delete as (
  select id
  from ranked
  where row_num > 1
)
delete from public.orders o
using to_delete d
where o.id = d.id;

create unique index if not exists orders_order_id_unique_idx
on public.orders(order_id)
where order_id is not null
  and btrim(order_id) <> '';

