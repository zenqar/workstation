-- =============================================================
-- Migration 013: Update Public Invoice Verification View
-- Purpose: Include custom_customer_name from the new feature
-- =============================================================

create or replace view public_invoice_verification with (security_invoker = true) as
  select
    i.verification_token,
    i.invoice_number,
    i.status,
    i.issue_date,
    i.due_date,
    i.total,
    i.currency,
    i.amount_paid,
    b.name        as business_name,
    b.logo_url    as business_logo_url,
    coalesce(c.name, i.custom_customer_name) as customer_name
  from invoices i
  join businesses b on b.id = i.business_id
  left join contacts c on c.id = i.contact_id
  where i.status not in ('draft', 'cancelled');

-- Grant anonymous read on the view only
grant select on public_invoice_verification to anon;
