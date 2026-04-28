-- =============================================================
-- Migration 036: Robust Settings RLS
-- Purpose: Fix "new row violates RLS" errors on business_settings
--          by ensuring explicit policies and Platform Admin support.
-- =============================================================

-- 1. Redefine Platform Admin helper to use BOTH profiles and platform_admins table
-- This ensures that regardless of which system is used, admins are caught.
create or replace function auth.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_platform_admin = true
    union
    select 1 from platform_admins where user_id = auth.uid() and is_active = true
  );
$$;

-- 2. Drop legacy business_settings policies
drop policy if exists "settings: member read" on business_settings;
drop policy if exists "settings: owner/admin write" on business_settings;

-- 3. Create explicit, robust policies for business_settings
-- READ: Members of the business or Platform Admins
create policy "settings: read"
  on business_settings for select
  using (
    auth.user_role_in_business(business_id) is not null
    or auth.is_platform_admin()
  );

-- INSERT: Owners/Admins or Platform Admins
create policy "settings: insert"
  on business_settings for insert
  with check (
    auth.user_role_in_business(business_id) in ('owner', 'admin')
    or auth.is_platform_admin()
  );

-- UPDATE: Owners/Admins or Platform Admins
create policy "settings: update"
  on business_settings for update
  using (
    auth.user_role_in_business(business_id) in ('owner', 'admin')
    or auth.is_platform_admin()
  )
  with check (
    auth.user_role_in_business(business_id) in ('owner', 'admin')
    or auth.is_platform_admin()
  );

-- DELETE: Owners only or Platform Admins
create policy "settings: delete"
  on business_settings for delete
  using (
    auth.user_role_in_business(business_id) = 'owner'
    or auth.is_platform_admin()
  );

-- 4. Audit Fix: Ensure auth.role_can_write and auth.role_can_manage also support platform admins
-- This makes the entire system more stable for admin intervention.

create or replace function auth.role_can_write(p_business_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
begin
  return (
    auth.user_role_in_business(p_business_id) in ('owner', 'admin', 'accountant', 'staff')
    or auth.is_platform_admin()
  );
end;
$$;

create or replace function auth.role_can_manage(p_business_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
begin
  return (
    auth.user_role_in_business(p_business_id) in ('owner', 'admin', 'accountant')
    or auth.is_platform_admin()
  );
end;
$$;
