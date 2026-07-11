-- Products/services catalog plus stricter contact-chat authorization.

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_type text not null check (item_type in ('product', 'service')),
  name text not null check (char_length(name) between 1 and 160),
  description text,
  sku text,
  unit text not null default 'unit',
  sales_price numeric(18,2) not null default 0 check (sales_price >= 0),
  purchase_cost numeric(18,2) not null default 0 check (purchase_cost >= 0),
  currency currency_code not null default 'IQD',
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_catalog_items_business on public.catalog_items(business_id, is_active, name);
create unique index if not exists idx_catalog_items_business_sku
  on public.catalog_items(business_id, lower(sku)) where sku is not null and sku <> '';

create or replace function public.zenqar_catalog_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_catalog_items_updated_at on public.catalog_items;
create trigger trg_catalog_items_updated_at before update on public.catalog_items
  for each row execute function public.zenqar_catalog_set_updated_at();

alter table public.catalog_items enable row level security;

drop policy if exists "catalog: members read" on public.catalog_items;
create policy "catalog: members read" on public.catalog_items for select
using (
  exists (
    select 1 from public.business_memberships membership
    where membership.business_id = catalog_items.business_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

drop policy if exists "catalog: writers insert" on public.catalog_items;
create policy "catalog: writers insert" on public.catalog_items for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.business_memberships membership
    where membership.business_id = catalog_items.business_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'accountant', 'staff')
  )
);

drop policy if exists "catalog: writers update" on public.catalog_items;
create policy "catalog: writers update" on public.catalog_items for update
using (
  exists (
    select 1 from public.business_memberships membership
    where membership.business_id = catalog_items.business_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'accountant', 'staff')
  )
)
with check (
  exists (
    select 1 from public.business_memberships membership
    where membership.business_id = catalog_items.business_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'accountant', 'staff')
  )
);

drop policy if exists "catalog: managers delete" on public.catalog_items;
create policy "catalog: managers delete" on public.catalog_items for delete
using (
  exists (
    select 1 from public.business_memberships membership
    where membership.business_id = catalog_items.business_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'accountant')
  )
);

-- Users may only send direct messages to people represented by a connected
-- contact in one of their active businesses. Server actions still perform the
-- same check; this closes the direct-client RLS bypass.
drop policy if exists "Users can send messages" on public.messages;
create policy "Users can message connected contacts" on public.messages for insert
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.contacts contact
    join public.business_memberships membership on membership.business_id = contact.business_id
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and contact.connection_status = 'connected'
      and contact.connected_user_id = receiver_id
  )
);

drop policy if exists "chat voice senders can upload" on storage.objects;
create policy "chat voice senders can upload" on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-voice'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.contacts contact
    join public.business_memberships membership on membership.business_id = contact.business_id
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and contact.connection_status = 'connected'
      and contact.connected_user_id::text = (storage.foldername(name))[2]
  )
);

create index if not exists idx_messages_unread_receiver
  on public.messages(receiver_id, is_read, created_at desc);

create index if not exists idx_contact_requests_receiver_pending
  on public.contact_requests(lower(receiver_email), status, created_at desc);

notify pgrst, 'reload schema';
