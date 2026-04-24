-- =============================================================
-- Migration 007: Master Schema Synchronization
-- Purpose: Ensures the live database has all required columns,
--          functions, and policies expected by the codebase.
--          Safe to run multiple times.
-- =============================================================

do $$
begin
  -- 1. Ensure businesses table has created_by column
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'created_by') then
    alter table public.businesses add column created_by uuid references auth.users(id);
  end if;

  -- 2. Ensure businesses table has default_currency column
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'default_currency') then
    alter table public.businesses add column default_currency currency_code not null default 'IQD';
  end if;

  -- 3. Ensure businesses table has default_language column
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'default_language') then
    alter table public.businesses add column default_language app_language not null default 'en';
  end if;
end $$;

-- 4. Recreate atomic business creation function to guarantee it is correct
create or replace function public.create_business_with_owner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into businesses (name, created_by)
  values (p_name, auth.uid())
  returning id into v_business_id;

  insert into business_memberships (business_id, user_id, role, status)
  values (v_business_id, auth.uid(), 'owner', 'active');

  return v_business_id;
end;
$$;

-- 5. Guarantee the 'businesses' insert policy is present and permissive
drop policy if exists "businesses: authenticated insert" on businesses;
create policy "businesses: authenticated insert"
  on businesses for insert
  with check (auth.uid() is not null);

-- 6. Guarantee the 'business_memberships' self-owner bootstrap policy exists
drop policy if exists "memberships: self-owner bootstrap" on business_memberships;
create policy "memberships: self-owner bootstrap"
  on business_memberships for insert
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and not exists (
      select 1 from business_memberships bm2
      where bm2.business_id = business_memberships.business_id
    )
  );

-- 7. Ensure profile creation trigger is attached
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 8. Ensure business settings trigger is attached
drop trigger if exists on_business_created on businesses;
create trigger on_business_created
  after insert on businesses
  for each row execute function handle_new_business();
