-- =============================================================
-- Migration 011: Fix Insert Policies & Helper Functions
-- Purpose: Ensures the auth schema helper functions exist so 
--          users can actually insert/update/delete data.
-- =============================================================

-- 1. Ensure the auth schema exists and is accessible
create schema if not exists auth;
grant usage on schema auth to postgres, anon, authenticated, service_role;

-- 2. Recreate the core permission function used by ALL write policies
create or replace function auth.user_business_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select business_id
  from business_memberships
  where user_id = auth.uid()
    and status = 'active';
$$;

-- 3. Recreate the role function
create or replace function auth.user_role_in_business(p_business_id uuid)
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

-- 4. Recreate the write permission check
create or replace function auth.role_can_write(p_business_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    auth.user_role_in_business(p_business_id) in ('owner','admin','accountant','staff'),
    false
  );
$$;

-- 5. Recreate the manage permission check
create or replace function auth.role_can_manage(p_business_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    auth.user_role_in_business(p_business_id) in ('owner','admin','accountant'),
    false
  );
$$;
