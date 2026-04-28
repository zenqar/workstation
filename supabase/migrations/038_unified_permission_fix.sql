-- =============================================================
-- Migration 038: UNIFIED Permission & RLS Repair
-- Purpose: Consolidates all security fixes into a single reliable file.
--          1. Creates public helpers.
--          2. Updates all RLS policies to use them.
--          3. Resolves "function does not exist" and "permission denied" errors.
-- =============================================================

-- 0. REPAIR: Ensure profiles table has the is_platform_admin column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_platform_admin') THEN
    ALTER TABLE public.profiles ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 1. Create ALL permission helpers in PUBLIC schema
-- Ensure we are using the correct search path
SET search_path = public, auth;

-- A. Business IDs Helper
CREATE OR REPLACE FUNCTION public.user_business_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id
  FROM business_memberships
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

-- B. User Role Helper
CREATE OR REPLACE FUNCTION public.user_role_in_business(p_business_id uuid)
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM business_memberships
  WHERE user_id = auth.uid()
    AND business_id = p_business_id
    AND status = 'active'
  LIMIT 1;
$$;

-- C. Platform Admin Helper (Unified)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true
    UNION
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- D. Write Permission Helper
CREATE OR REPLACE FUNCTION public.role_can_write(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    public.user_role_in_business(p_business_id) IN ('owner', 'admin', 'accountant', 'staff')
    OR public.is_platform_admin()
  );
END;
$$;

-- E. Manage Permission Helper
CREATE OR REPLACE FUNCTION public.role_can_manage(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    public.user_role_in_business(p_business_id) IN ('owner', 'admin', 'accountant')
    OR public.is_platform_admin()
  );
END;
$$;

-- 2. RESET & UPDATE ALL RLS POLICIES

-- BUSINESS SETTINGS
DROP POLICY IF EXISTS "settings: member read" ON business_settings;
DROP POLICY IF EXISTS "settings: owner/admin write" ON business_settings;
DROP POLICY IF EXISTS "settings: read" ON business_settings;
DROP POLICY IF EXISTS "settings: insert" ON business_settings;
DROP POLICY IF EXISTS "settings: update" ON business_settings;
DROP POLICY IF EXISTS "settings: delete" ON business_settings;

CREATE POLICY "settings: read" ON business_settings FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "settings: insert" ON business_settings FOR INSERT WITH CHECK (public.user_role_in_business(business_id) IN ('owner', 'admin') OR public.is_platform_admin());
CREATE POLICY "settings: update" ON business_settings FOR UPDATE USING (public.user_role_in_business(business_id) IN ('owner', 'admin') OR public.is_platform_admin()) WITH CHECK (public.user_role_in_business(business_id) IN ('owner', 'admin') OR public.is_platform_admin());
CREATE POLICY "settings: delete" ON business_settings FOR DELETE USING (public.user_role_in_business(business_id) = 'owner' OR public.is_platform_admin());

-- BUSINESSES
DROP POLICY IF EXISTS "businesses: member read" ON businesses;
DROP POLICY IF EXISTS "businesses: owner/admin update" ON businesses;
DROP POLICY IF EXISTS "businesses: admin read" ON businesses;
DROP POLICY IF EXISTS "businesses: admin update" ON businesses;

CREATE POLICY "businesses: admin read" ON businesses FOR SELECT USING (public.user_role_in_business(id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "businesses: admin update" ON businesses FOR UPDATE USING (public.user_role_in_business(id) IN ('owner', 'admin') OR public.is_platform_admin());

-- MEMBERSHIPS
DROP POLICY IF EXISTS "memberships: owner/admin manage" ON business_memberships;
DROP POLICY IF EXISTS "memberships: owner/admin update" ON business_memberships;
DROP POLICY IF EXISTS "memberships: admin insert" ON business_memberships;
DROP POLICY IF EXISTS "memberships: admin update" ON business_memberships;
DROP POLICY IF EXISTS "memberships: read own" ON business_memberships;

CREATE POLICY "memberships: read own" ON business_memberships FOR SELECT USING (user_id = auth.uid() OR public.is_platform_admin());
CREATE POLICY "memberships: admin insert" ON business_memberships FOR INSERT WITH CHECK (public.user_role_in_business(business_id) IN ('owner', 'admin') OR public.is_platform_admin());
CREATE POLICY "memberships: admin update" ON business_memberships FOR UPDATE USING (public.user_role_in_business(business_id) IN ('owner', 'admin') OR public.is_platform_admin());

-- ACCOUNTS
DROP POLICY IF EXISTS "accounts: read" ON accounts;
DROP POLICY IF EXISTS "accounts: manager insert" ON accounts;
DROP POLICY IF EXISTS "accounts: manager update" ON accounts;
DROP POLICY IF EXISTS "accounts: manage insert" ON accounts;
DROP POLICY IF EXISTS "accounts: manage update" ON accounts;
DROP POLICY IF EXISTS "accounts: manage delete" ON accounts;
DROP POLICY IF EXISTS "accounts: owner delete" ON accounts;

CREATE POLICY "accounts: read" ON accounts FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "accounts: manage insert" ON accounts FOR INSERT WITH CHECK (public.role_can_manage(business_id));
CREATE POLICY "accounts: manage update" ON accounts FOR UPDATE USING (public.role_can_manage(business_id));
CREATE POLICY "accounts: manage delete" ON accounts FOR DELETE USING (public.role_can_manage(business_id));

-- CONTACTS
DROP POLICY IF EXISTS "contacts: read" ON contacts;
DROP POLICY IF EXISTS "contacts: writer insert" ON contacts;
DROP POLICY IF EXISTS "contacts: writer update" ON contacts;
DROP POLICY IF EXISTS "contacts: manage delete" ON contacts;

CREATE POLICY "contacts: read" ON contacts FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "contacts: writer insert" ON contacts FOR INSERT WITH CHECK (public.role_can_write(business_id));
CREATE POLICY "contacts: writer update" ON contacts FOR UPDATE USING (public.role_can_write(business_id));
CREATE POLICY "contacts: manage delete" ON contacts FOR DELETE USING (public.role_can_manage(business_id));

-- INVOICES
DROP POLICY IF EXISTS "invoices: read" ON invoices;
DROP POLICY IF EXISTS "invoices: writer insert" ON invoices;
DROP POLICY IF EXISTS "invoices: writer update" ON invoices;
DROP POLICY IF EXISTS "invoices: manage delete" ON invoices;

CREATE POLICY "invoices: read" ON invoices FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "invoices: writer insert" ON invoices FOR INSERT WITH CHECK (public.role_can_write(business_id));
CREATE POLICY "invoices: writer update" ON invoices FOR UPDATE USING (public.role_can_write(business_id));
CREATE POLICY "invoices: manage delete" ON invoices FOR DELETE USING (public.role_can_manage(business_id));

-- INVOICE ITEMS
DROP POLICY IF EXISTS "items: read" ON invoice_items;
DROP POLICY IF EXISTS "items: writer insert" ON invoice_items;
DROP POLICY IF EXISTS "items: writer update" ON invoice_items;
DROP POLICY IF EXISTS "items: writer delete" ON invoice_items;

CREATE POLICY "items: read" ON invoice_items FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "items: writer insert" ON invoice_items FOR INSERT WITH CHECK (public.role_can_write(business_id));
CREATE POLICY "items: writer update" ON invoice_items FOR UPDATE USING (public.role_can_write(business_id));
CREATE POLICY "items: writer delete" ON invoice_items FOR DELETE USING (public.role_can_write(business_id));

-- EXPENSES
DROP POLICY IF EXISTS "expenses: read" ON expenses;
DROP POLICY IF EXISTS "expenses: writer insert" ON expenses;
DROP POLICY IF EXISTS "expenses: writer update" ON expenses;
DROP POLICY IF EXISTS "expenses: manage delete" ON expenses;

CREATE POLICY "expenses: read" ON expenses FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "expenses: writer insert" ON expenses FOR INSERT WITH CHECK (public.role_can_write(business_id));
CREATE POLICY "expenses: writer update" ON expenses FOR UPDATE USING (public.role_can_write(business_id));
CREATE POLICY "expenses: manage delete" ON expenses FOR DELETE USING (public.role_can_manage(business_id));

-- MONEY TRANSACTIONS
DROP POLICY IF EXISTS "transactions: read" ON money_transactions;
DROP POLICY IF EXISTS "transactions: writer insert" ON money_transactions;

CREATE POLICY "transactions: read" ON money_transactions FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "transactions: writer insert" ON money_transactions FOR INSERT WITH CHECK (public.role_can_write(business_id));

-- PAYMENTS
DROP POLICY IF EXISTS "payments: read" ON payments;
DROP POLICY IF EXISTS "payments: insert" ON payments;
DROP POLICY IF EXISTS "payments: update" ON payments;
DROP POLICY IF EXISTS "payments: delete" ON payments;

CREATE POLICY "payments: read" ON payments FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "payments: insert" ON payments FOR INSERT WITH CHECK (public.role_can_write(business_id));
CREATE POLICY "payments: update" ON payments FOR UPDATE USING (public.role_can_manage(business_id));
CREATE POLICY "payments: delete" ON payments FOR DELETE USING (public.role_can_manage(business_id));
