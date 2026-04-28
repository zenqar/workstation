-- =============================================================
-- Migration 026: Bi-directional Contacts
-- =============================================================

-- Update the handle_contact_request_acceptance function to create 
-- the reverse contact for the receiver so both parties see each other.
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

    -- 2. Find the receiver's primary business (first one they own)
    select b.id, b.name, b.legal_name, b.phone, b.address_line1, b.city, b.country
    into v_receiver_business_id, v_biz_name, v_biz_legal_name, v_biz_phone, v_biz_address, v_biz_city, v_biz_country
    from public.businesses b
    join public.business_memberships bm on bm.business_id = b.id
    where bm.email = new.receiver_email
      and bm.role = 'owner'
    limit 1;

    -- 3. Update the sender's contact record with the receiver's business info
    update public.contacts
    set connection_status = 'connected',
        connected_user_id = v_receiver_user_id,
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
      -- Update existing contact
      update public.contacts
      set connection_status = 'connected',
          connected_user_id = new.sender_user_id,
          company_name = coalesce(v_sender_biz_legal_name, v_sender_biz_name),
          phone = coalesce(phone, v_sender_biz_phone),
          address = coalesce(address, v_sender_biz_address),
          city = coalesce(city, v_sender_biz_city),
          country = coalesce(country, v_sender_biz_country)
      where business_id = v_receiver_business_id 
        and email = v_sender_email;
    else
      -- Insert new contact
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
        'customer', -- Defaulting to customer, they can change it later
        'connected',
        new.sender_user_id,
        v_receiver_user_id
      );
    end if;

  end if;
  return new;
end;
$$;
