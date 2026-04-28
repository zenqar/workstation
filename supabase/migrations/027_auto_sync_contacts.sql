-- =============================================================
-- Migration 027: Auto-sync connected contacts on business update
-- =============================================================

-- Create a function to sync business updates to all connected contacts
create or replace function public.sync_business_updates_to_contacts()
returns trigger language plpgsql security definer 
set search_path = public
as $$
declare
  v_biz_name text;
begin
  -- Only proceed if relevant fields have changed
  if (
    new.name is distinct from old.name or
    new.legal_name is distinct from old.legal_name or
    new.phone is distinct from old.phone or
    new.address_line1 is distinct from old.address_line1 or
    new.city is distinct from old.city or
    new.country is distinct from old.country
  ) then
    
    v_biz_name := coalesce(new.legal_name, new.name);

    -- Find all contacts across all OTHER businesses that are 'connected' 
    -- to any user who is a member of THIS updated business.
    -- Then update their contact info to match the new business info.
    update public.contacts c
    set company_name = v_biz_name,
        phone = coalesce(new.phone, c.phone),
        address = coalesce(new.address_line1, c.address),
        city = coalesce(new.city, c.city),
        country = coalesce(new.country, c.country),
        updated_at = now()
    from public.business_memberships bm
    where bm.business_id = new.id
      and c.connected_user_id = bm.user_id
      and c.connection_status = 'connected';
      
  end if;
  return new;
end;
$$;

-- Attach the trigger to the businesses table
drop trigger if exists trg_sync_business_updates_to_contacts on public.businesses;
create trigger trg_sync_business_updates_to_contacts
  after update on public.businesses
  for each row execute function public.sync_business_updates_to_contacts();
