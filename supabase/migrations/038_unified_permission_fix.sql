-- =============================================================
-- Migration 038: UNIFIED Permission & RLS Super-Repair
-- Purpose: Consolidates all security fixes into a single reliable file.
--          1. Self-heals missing tables/columns/types needed for RLS.
--          2. Creates public helpers for permission management.
--          3. Resets and updates all platform RLS policies.
-- =============================================================

-- 0. PRE-FLIGHT REPAIR: Ensure all core types and tables exist
DO $$
BEGIN
  -- A. Ensure is_platform_admin column exists in profiles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_platform_admin') THEN
    ALTER TABLE public.profiles ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- B. Ensure platform_admins table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_admins') THEN
    CREATE TABLE public.platform_admins (
      id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      added_by    uuid        REFERENCES auth.users(id),
      notes       text,
      is_active   boolean     NOT NULL DEFAULT true,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
  END IF;

  -- C. Ensure business_settings table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_settings') THEN
    CREATE TABLE public.business_settings (
      business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
      invoice_due_days INTEGER DEFAULT 30,
      invoice_footer_note TEXT,
      updated_at timestamptz DEFAULT now()
    );
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
    -- Use dynamic SQL or check table existence again to be ultra safe inside function
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
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "businesses: member read" ON businesses;
DROP POLICY IF EXISTS "businesses: owner/admin update" ON businesses;
DROP POLICY IF EXISTS "businesses: admin read" ON businesses;
DROP POLICY IF EXISTS "businesses: admin update" ON businesses;

CREATE POLICY "businesses: admin read" ON businesses FOR SELECT USING (public.user_role_in_business(id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "businesses: admin update" ON businesses FOR UPDATE USING (public.user_role_in_business(id) IN ('owner', 'admin') OR public.is_platform_admin());

-- MEMBERSHIPS
ALTER TABLE business_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memberships: owner/admin manage" ON business_memberships;
DROP POLICY IF EXISTS "memberships: owner/admin update" ON business_memberships;
DROP POLICY IF EXISTS "memberships: admin insert" ON business_memberships;
DROP POLICY IF EXISTS "memberships: admin update" ON business_memberships;
DROP POLICY IF EXISTS "memberships: read own" ON business_memberships;

CREATE POLICY "memberships: read own" ON business_memberships FOR SELECT USING (user_id = auth.uid() OR public.is_platform_admin());
CREATE POLICY "memberships: admin insert" ON business_memberships FOR INSERT WITH CHECK (public.user_role_in_business(business_id) IN ('owner', 'admin') OR public.is_platform_admin());
CREATE POLICY "memberships: admin update" ON business_memberships FOR UPDATE USING (public.user_role_in_business(business_id) IN ('owner', 'admin') OR public.is_platform_admin());

-- ACCOUNTS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts: read" ON contacts;
DROP POLICY IF EXISTS "contacts: writer insert" ON contacts;
DROP POLICY IF EXISTS "contacts: writer update" ON contacts;
DROP POLICY IF EXISTS "contacts: manage delete" ON contacts;

CREATE POLICY "contacts: read" ON contacts FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "contacts: writer insert" ON contacts FOR INSERT WITH CHECK (public.role_can_write(business_id));
CREATE POLICY "contacts: writer update" ON contacts FOR UPDATE USING (public.role_can_write(business_id));
CREATE POLICY "contacts: manage delete" ON contacts FOR DELETE USING (public.role_can_manage(business_id));

-- INVOICES
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices: read" ON invoices;
DROP POLICY IF EXISTS "invoices: writer insert" ON invoices;
DROP POLICY IF EXISTS "invoices: writer update" ON invoices;
DROP POLICY IF EXISTS "invoices: manage delete" ON invoices;

CREATE POLICY "invoices: read" ON invoices FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "invoices: writer insert" ON invoices FOR INSERT WITH CHECK (public.role_can_write(business_id));
CREATE POLICY "invoices: writer update" ON invoices FOR UPDATE USING (public.role_can_write(business_id));
CREATE POLICY "invoices: manage delete" ON invoices FOR DELETE USING (public.role_can_manage(business_id));

-- INVOICE ITEMS
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "items: read" ON invoice_items;
DROP POLICY IF EXISTS "items: writer insert" ON invoice_items;
DROP POLICY IF EXISTS "items: writer update" ON invoice_items;
DROP POLICY IF EXISTS "items: writer delete" ON invoice_items;

CREATE POLICY "items: read" ON invoice_items FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "items: writer insert" ON invoice_items FOR INSERT WITH CHECK (public.role_can_write(business_id));
CREATE POLICY "items: writer update" ON invoice_items FOR UPDATE USING (public.role_can_write(business_id));
CREATE POLICY "items: writer delete" ON invoice_items FOR DELETE USING (public.role_can_write(business_id));

-- EXPENSES
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses: read" ON expenses;
DROP POLICY IF EXISTS "expenses: writer insert" ON expenses;
DROP POLICY IF EXISTS "expenses: writer update" ON expenses;
DROP POLICY IF EXISTS "expenses: manage delete" ON expenses;

CREATE POLICY "expenses: read" ON expenses FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "expenses: writer insert" ON expenses FOR INSERT WITH CHECK (public.role_can_write(business_id));
CREATE POLICY "expenses: writer update" ON expenses FOR UPDATE USING (public.role_can_write(business_id));
CREATE POLICY "expenses: manage delete" ON expenses FOR DELETE USING (public.role_can_manage(business_id));

-- MONEY TRANSACTIONS
ALTER TABLE money_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transactions: read" ON money_transactions;
DROP POLICY IF EXISTS "transactions: writer insert" ON money_transactions;

CREATE POLICY "transactions: read" ON money_transactions FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "transactions: writer insert" ON money_transactions FOR INSERT WITH CHECK (public.role_can_write(business_id));

-- PAYMENTS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments: read" ON payments;
DROP POLICY IF EXISTS "payments: insert" ON payments;
DROP POLICY IF EXISTS "payments: update" ON payments;
DROP POLICY IF EXISTS "payments: delete" ON payments;

CREATE POLICY "payments: read" ON payments FOR SELECT USING (public.user_role_in_business(business_id) IS NOT NULL OR public.is_platform_admin());
CREATE POLICY "payments: insert" ON payments FOR INSERT WITH CHECK (public.role_can_write(business_id));
CREATE POLICY "payments: update" ON payments FOR UPDATE USING (public.role_can_manage(business_id));
CREATE POLICY "payments: delete" ON payments FOR DELETE USING (public.role_can_manage(business_id));
