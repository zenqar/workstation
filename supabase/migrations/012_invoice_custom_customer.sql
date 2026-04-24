-- =============================================================
-- Migration 012: Custom Invoice Customers
-- =============================================================

do $$
begin
  -- Add custom_customer_name to invoices if it doesn't exist
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'custom_customer_name') then
    alter table public.invoices add column custom_customer_name text;
  end if;

  -- Add custom_customer_type to invoices if it doesn't exist
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'custom_customer_type') then
    -- Using text to avoid enum migration complexities, matching contact_type logic
    alter table public.invoices add column custom_customer_type text default 'customer';
  end if;
end $$;
