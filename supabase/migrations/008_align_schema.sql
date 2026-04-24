-- =============================================================
-- Migration 008: Align live schema columns
-- =============================================================

do $$
begin
  -- 1. Align businesses table
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'logo_url') then
    alter table public.businesses add column logo_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'email') then
    alter table public.businesses add column email text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'phone') then
    alter table public.businesses add column phone text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'website') then
    alter table public.businesses add column website text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'address_line1') then
    alter table public.businesses add column address_line1 text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'address_line2') then
    alter table public.businesses add column address_line2 text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'city') then
    alter table public.businesses add column city text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'country') then
    alter table public.businesses add column country text not null default 'Iraq';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'tax_number') then
    alter table public.businesses add column tax_number text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'timezone') then
    alter table public.businesses add column timezone text not null default 'Asia/Baghdad';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'businesses' and column_name = 'updated_at') then
    alter table public.businesses add column updated_at timestamptz not null default now();
  end if;

  -- 2. Align business_settings table
  if not exists (select 1 from information_schema.columns where table_name = 'business_settings' and column_name = 'id') then
    alter table public.business_settings add column id uuid default uuid_generate_v4();
    -- If it already has a PK, we can't easily add id as PK without dropping it, so we just add the column.
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_settings' and column_name = 'invoice_due_days') then
    alter table public.business_settings add column invoice_due_days integer not null default 30;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_settings' and column_name = 'invoice_tax_label') then
    alter table public.business_settings add column invoice_tax_label text not null default 'Tax';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_settings' and column_name = 'show_tax_on_invoice') then
    alter table public.business_settings add column show_tax_on_invoice boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_settings' and column_name = 'show_discount_on_invoice') then
    alter table public.business_settings add column show_discount_on_invoice boolean not null default true;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_settings' and column_name = 'payout_iban') then
    alter table public.business_settings add column payout_iban text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_settings' and column_name = 'payout_swift') then
    alter table public.business_settings add column payout_swift text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_settings' and column_name = 'payout_notes') then
    alter table public.business_settings add column payout_notes text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_settings' and column_name = 'created_at') then
    alter table public.business_settings add column created_at timestamptz not null default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_settings' and column_name = 'updated_at') then
    alter table public.business_settings add column updated_at timestamptz not null default now();
  end if;

  -- 3. Align business_memberships table
  if not exists (select 1 from information_schema.columns where table_name = 'business_memberships' and column_name = 'email') then
    alter table public.business_memberships add column email text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_memberships' and column_name = 'invited_by') then
    alter table public.business_memberships add column invited_by uuid references auth.users(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_memberships' and column_name = 'invited_at') then
    alter table public.business_memberships add column invited_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_memberships' and column_name = 'created_at') then
    alter table public.business_memberships add column created_at timestamptz not null default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'business_memberships' and column_name = 'updated_at') then
    alter table public.business_memberships add column updated_at timestamptz not null default now();
  end if;

  -- 4. Align invoices table
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'payment_terms') then
    alter table public.invoices add column payment_terms text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'subtotal') then
    alter table public.invoices add column subtotal numeric(18,3) not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'discount_amount') then
    alter table public.invoices add column discount_amount numeric(18,3) not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'discount_percent') then
    alter table public.invoices add column discount_percent numeric(5,2) not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'tax_amount') then
    alter table public.invoices add column tax_amount numeric(18,3) not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'tax_rate') then
    alter table public.invoices add column tax_rate numeric(5,2) not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'notes') then
    alter table public.invoices add column notes text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'internal_notes') then
    alter table public.invoices add column internal_notes text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'snapshot_json') then
    alter table public.invoices add column snapshot_json jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'snapshot_taken_at') then
    alter table public.invoices add column snapshot_taken_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'created_by') then
    alter table public.invoices add column created_by uuid references auth.users(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'issued_by') then
    alter table public.invoices add column issued_by uuid references auth.users(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'issued_at') then
    alter table public.invoices add column issued_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'updated_at') then
    alter table public.invoices add column updated_at timestamptz not null default now();
  end if;

end $$;
