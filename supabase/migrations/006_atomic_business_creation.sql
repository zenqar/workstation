-- =============================================================
-- Migration 006: Atomic business creation function
-- =============================================================

-- Problem: When creating a business, `insert(...).select('id')` fails RLS
-- because the user cannot `select` the business until they have a membership,
-- but we can't create the membership until we have the business ID.
-- 
-- Fix: A SECURITY DEFINER function that creates both atomically, bypassing
-- the RLS catch-22 entirely.

create or replace function public.create_business_with_owner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  -- Ensure user is authenticated
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Insert business
  insert into businesses (name)
  values (p_name)
  returning id into v_business_id;

  -- 2. Insert owner membership
  insert into business_memberships (business_id, user_id, role, status)
  values (v_business_id, auth.uid(), 'owner', 'active');

  return v_business_id;
end;
$$;
