-- =============================================================
-- Migration 040: Invoice Workflow Enhancements
-- Purpose: Add 'accepted' and 'payment_claimed' states to invoices.
-- =============================================================

-- Add new statuses to the enum
-- Note: These must be run outside a transaction in some environments, 
-- but Supabase migrations handle them fine.
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'payment_claimed';

-- Add tracking columns
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_claimed_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz;

COMMENT ON COLUMN public.invoices.accepted_at IS 'When the customer accepted the invoice';
COMMENT ON COLUMN public.invoices.payment_claimed_at IS 'When the customer marked the invoice as paid';
COMMENT ON COLUMN public.invoices.payment_confirmed_at IS 'When the business owner confirmed receipt of payment';
