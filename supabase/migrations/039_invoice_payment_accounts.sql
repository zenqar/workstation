-- =============================================================
-- Migration 039: Invoice Payment Accounts
-- Purpose: Allow invoices to specify which bank/wallet accounts 
--          should be displayed as payment instructions.
-- =============================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_account_ids uuid[] DEFAULT '{}';

COMMENT ON COLUMN public.invoices.payment_account_ids IS 'List of account IDs to show on the invoice for payment instructions';
