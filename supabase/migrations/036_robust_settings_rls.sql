-- =============================================================
-- Migration 036: Robust Settings RLS & Permission Schema Fix
-- Purpose: Fix "permission denied for schema auth" and RLS errors.
--          Moves permission helpers to public schema for reliability.
-- =============================================================

-- 1. Create permission helpers in PUBLIC schema (to avoid auth schema restrictions)

-- A. Get user's business IDs
create or replace function public.user_business_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select business_id
  from business_memberships
  where user_id = auth.uid()
    and status = 'active';
$$;

-- B. Get user's role in business
create or replace function public.user_role_in_business(p_business_id uuid)
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role
  from business_memberships
  where user_id = auth.uid()
    and business_id = p_business_id
    and status = 'active'
  limit 1;
$$;

-- C. Check if user is platform admin (checks both profiles and platform_admins table)
create or replace function public.is_platform_admin()
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

-- D. Check if role has write permission (supports Platform Admin overrides)
create or replace function public.role_can_write(p_business_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
begin
  return (
    public.user_role_in_business(p_business_id) in ('owner', 'admin', 'accountant', 'staff')
    or public.is_platform_admin()
  );
end;
$$;

-- E. Check if role has manage permission
create or replace function public.role_can_manage(p_business_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
begin
  return (
    public.user_role_in_business(p_business_id) in ('owner', 'admin', 'accountant')
    or public.is_platform_admin()
  );
end;
$$;

-- 2. Drop legacy business_settings policies
drop policy if exists "settings: member read" on business_settings;
drop policy if exists "settings: owner/admin write" on business_settings;
drop policy if exists "settings: read" on business_settings;
drop policy if exists "settings: insert" on business_settings;
drop policy if exists "settings: update" on business_settings;
drop policy if exists "settings: delete" on business_settings;

-- 3. Apply robust policies for business_settings using NEW public functions
create policy "settings: read" on business_settings for select 
  using (public.user_role_in_business(business_id) is not null or public.is_platform_admin());

create policy "settings: insert" on business_settings for insert 
  with check (public.user_role_in_business(business_id) in ('owner', 'admin') or public.is_platform_admin());

create policy "settings: update" on business_settings for update 
  using (public.user_role_in_business(business_id) in ('owner', 'admin') or public.is_platform_admin())
  with check (public.user_role_in_business(business_id) in ('owner', 'admin') or public.is_platform_admin());

create policy "settings: delete" on business_settings for delete 
  using (public.user_role_in_business(business_id) = 'owner' or public.is_platform_admin());

-- 4. BUSINESSES: Update policies to use public functions
drop policy if exists "businesses: member read" on businesses;
drop policy if exists "businesses: owner/admin update" on businesses;
drop policy if exists "businesses: admin read" on businesses;
drop policy if exists "businesses: admin update" on businesses;

create policy "businesses: admin read" on businesses for select
  using (public.user_role_in_business(id) is not null or public.is_platform_admin());

create policy "businesses: admin update" on businesses for update
  using (public.user_role_in_business(id) in ('owner', 'admin') or public.is_platform_admin());

-- 5. MEMBERSHIPS: Update policies
drop policy if exists "memberships: owner/admin manage" on business_memberships;
drop policy if exists "memberships: owner/admin update" on business_memberships;
drop policy if exists "memberships: admin insert" on business_memberships;
drop policy if exists "memberships: admin update" on business_memberships;

create policy "memberships: admin insert" on business_memberships for insert
  with check (public.user_role_in_business(business_id) in ('owner', 'admin') or public.is_platform_admin());

create policy "memberships: admin update" on business_memberships for update
  using (public.user_role_in_business(business_id) in ('owner', 'admin') or public.is_platform_admin());
