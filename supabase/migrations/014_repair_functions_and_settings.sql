-- =============================================================
-- Migration 014: Repair Functions and Settings
-- Purpose: Install missing core functions (invoice generation, 
--          settings triggers) and repair existing businesses.
-- =============================================================

-- 1. Install get_next_invoice_number
create or replace function get_next_invoice_number(p_business_id uuid)
returns text
language plpgsql security definer
as $$
declare
  v_prefix    text;
  v_year      text;
  v_sequence  integer;
  v_number    text;
begin
  -- Lock the business row to prevent race conditions
  select invoice_prefix, invoice_sequence + 1
  into v_prefix, v_sequence
  from businesses
  where id = p_business_id
  for update;

  if not found then
    raise exception 'Business not found: %', p_business_id;
  end if;

  -- Update sequence
  update businesses
  set invoice_sequence = v_sequence
  where id = p_business_id;

  v_year   := to_char(current_date, 'YYYY');
  v_number := v_prefix || '-' || v_year || '-' || lpad(v_sequence::text, 4, '0');

  return v_number;
end;
$$;

-- Grant execute so the authenticated role can use the RPC
grant execute on function get_next_invoice_number(uuid) to authenticated;
grant execute on function get_next_invoice_number(uuid) to service_role;

-- 2. Install handle_new_business function
create or replace function handle_new_business()
returns trigger
language plpgsql security definer
as $$
begin
  insert into business_settings (business_id)
  values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

-- 3. Install the trigger if it doesn't exist
drop trigger if exists on_business_created on businesses;
create trigger on_business_created
  after insert on businesses
  for each row execute function handle_new_business();

-- 4. EMERGENCY REPAIR: Create missing settings rows for existing businesses
do $$
begin
  insert into business_settings (business_id)
  select id from businesses
  where id not in (select business_id from business_settings)
  on conflict (business_id) do nothing;
end $$;

-- 5. Safe Check: Ensure avatar_url exists in profiles just in case
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'avatar_url') then
    alter table public.profiles add column avatar_url text;
  end if;
end $$;

-- 6. Install handle_new_user function
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 7. Install the user trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 8. EMERGENCY REPAIR: Create missing profiles for existing auth users
do $$
begin
  insert into profiles (id, email, full_name)
  select id, email, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  from auth.users
  where id not in (select id from profiles)
  on conflict (id) do nothing;
end $$;

