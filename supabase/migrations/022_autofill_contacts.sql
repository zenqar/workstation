-- =============================================================
-- Migration 022: Auto-fill contact info on connection
-- =============================================================

-- 1. Update the handle_contact_request_acceptance function
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
begin
  if (new.status = 'accepted' and old.status = 'pending') then
    -- Find the receiver's primary business (first one they own)
    select b.id, b.name, b.legal_name, b.phone, b.address_line1, b.city, b.country
    into v_receiver_business_id, v_biz_name, v_biz_legal_name, v_biz_phone, v_biz_address, v_biz_city, v_biz_country
    from public.businesses b
    join public.business_memberships bm on bm.business_id = b.id
    where bm.email = new.receiver_email
      and bm.role = 'owner'
    limit 1;

    -- Update the sender's contact record with the receiver's business info
    update public.contacts
    set connection_status = 'connected',
        connected_user_id = (select id from auth.users where email = new.receiver_email limit 1),
        company_name = coalesce(v_biz_legal_name, v_biz_name),
        phone = coalesce(phone, v_biz_phone),
        address = coalesce(address, v_biz_address),
        city = coalesce(city, v_biz_city),
        country = coalesce(country, v_biz_country)
    where business_id = new.sender_business_id
      and email = new.receiver_email;

  end if;
  return new;
end;
$$;
