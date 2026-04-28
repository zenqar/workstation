-- =============================================================
-- Migration 028: External Invoices via Connected Contacts
-- =============================================================

-- 1. Add connected_business_id to contacts for direct business-to-business linking
alter table public.contacts
add column if not exists connected_business_id uuid references public.businesses(id);

-- 2. Update handle_contact_request_acceptance to set it
create or replace function public.handle_contact_request_acceptance()
returns trigger language plpgsql security definer 
set search_path = public
as $$
declare
  v_receiver_business_id uuid;
  v_biz_name text;
  v_biz_legal_name text;
  v_biz_phone text;
  v_biz_address text;
  v_biz_city text;
  v_biz_country text;
  v_receiver_user_id uuid;

  v_sender_biz_name text;
  v_sender_biz_legal_name text;
  v_sender_biz_phone text;
  v_sender_biz_address text;
  v_sender_biz_city text;
  v_sender_biz_country text;
  v_sender_email text;
begin
  if (new.status = 'accepted' and old.status = 'pending') then
    
    -- 1. Find the receiver's user id
    select id into v_receiver_user_id from auth.users where email = new.receiver_email limit 1;

    -- 2. Find the receiver's primary business
    select b.id, b.name, b.legal_name, b.phone, b.address_line1, b.city, b.country
    into v_receiver_business_id, v_biz_name, v_biz_legal_name, v_biz_phone, v_biz_address, v_biz_city, v_biz_country
    from public.businesses b
    join public.business_memberships bm on bm.business_id = b.id
    where bm.user_id = v_receiver_user_id
      and bm.status = 'active'
    order by (case when bm.role = 'owner' then 1 else 2 end)
    limit 1;

    -- 3. Update the sender's contact record with the receiver's business info
    update public.contacts
    set connection_status = 'connected',
        connected_user_id = v_receiver_user_id,
        connected_business_id = v_receiver_business_id,
        company_name = coalesce(v_biz_legal_name, v_biz_name),
        phone = coalesce(phone, v_biz_phone),
        address = coalesce(address, v_biz_address),
        city = coalesce(city, v_biz_city),
        country = coalesce(country, v_biz_country)
    where business_id = new.sender_business_id
      and email = new.receiver_email;

    -- 4. Get the sender's business info
    select b.name, b.legal_name, b.phone, b.address_line1, b.city, b.country
    into v_sender_biz_name, v_sender_biz_legal_name, v_sender_biz_phone, v_sender_biz_address, v_sender_biz_city, v_sender_biz_country
    from public.businesses b
    where b.id = new.sender_business_id;

    -- 5. Get the sender's email
    select email into v_sender_email from auth.users where id = new.sender_user_id;

    -- 6. Create or update the reverse contact for the receiver
    if exists (select 1 from public.contacts where business_id = v_receiver_business_id and email = v_sender_email) then
      update public.contacts
      set connection_status = 'connected',
          connected_user_id = new.sender_user_id,
          connected_business_id = new.sender_business_id,
          company_name = coalesce(v_sender_biz_legal_name, v_sender_biz_name),
          phone = coalesce(phone, v_sender_biz_phone),
          address = coalesce(address, v_sender_biz_address),
          city = coalesce(city, v_sender_biz_city),
          country = coalesce(country, v_sender_biz_country)
      where business_id = v_receiver_business_id 
        and email = v_sender_email;
    else
      insert into public.contacts (
        business_id,
        name,
        company_name,
        email,
        phone,
        address,
        city,
        country,
        type,
        connection_status,
        connected_user_id,
        connected_business_id,
        created_by
      ) values (
        v_receiver_business_id,
        coalesce(v_sender_biz_legal_name, v_sender_biz_name),
        coalesce(v_sender_biz_legal_name, v_sender_biz_name),
        v_sender_email,
        v_sender_biz_phone,
        v_sender_biz_address,
        v_sender_biz_city,
        v_sender_biz_country,
        'customer',
        'connected',
        new.sender_user_id,
        new.sender_business_id,
        v_receiver_user_id
      );
    end if;

  end if;
  return new;
end;
$$;

-- 3. Retroactively fix existing connected contacts
do $$
begin
  -- Forward contacts
  update public.contacts c
  set connected_business_id = cr.receiver_business_id
  from public.contact_requests cr
  where c.business_id = cr.sender_business_id
    and c.email = cr.receiver_email
    and cr.status = 'accepted'
    and c.connected_business_id is null;
    
  -- Reverse contacts
  update public.contacts c
  set connected_business_id = cr.sender_business_id
  from public.contact_requests cr
  where c.business_id = cr.receiver_business_id
    and cr.status = 'accepted'
    and c.connected_business_id is null;
end $$;

-- 4. Update Invoices RLS to allow reading incoming invoices
drop policy if exists "invoices: read" on invoices;
create policy "invoices: read" on invoices for select using (
  public.user_role_in_business(business_id) is not null
  or 
  exists (
    select 1 from public.contacts c
    where c.id = invoices.contact_id
      and public.user_role_in_business(c.connected_business_id) is not null
  )
);

-- 5. RPC to fetch all invoices (sent and received) for a business
create or replace function public.get_all_business_invoices(p_business_id uuid)
returns setof public.invoices
language sql stable security definer
set search_path = public
as $$
  select i.*
  from public.invoices i
  left join public.contacts c on c.id = i.contact_id
  where i.business_id = p_business_id
     or c.connected_business_id = p_business_id;
$$;
