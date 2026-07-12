-- Supplier bills (accounts payable) and stricter expense integrity.

create table if not exists public.supplier_bills (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  supplier_name text not null default '',
  invoice_number text,
  category text not null default 'General',
  description text not null,
  currency public.currency_code not null default 'IQD',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(18,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  total numeric(18,2) not null check (total > 0),
  amount_paid numeric(18,2) not null default 0 check (amount_paid >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'partially_paid', 'paid', 'cancelled')),
  notes text,
  attachment_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_paid <= total)
);

create table if not exists public.document_scan_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists document_scan_events_limits_idx
  on public.document_scan_events(business_id, user_id, created_at desc);

alter table public.document_scan_events enable row level security;

drop policy if exists document_scan_events_admin_read on public.document_scan_events;
create policy document_scan_events_admin_read on public.document_scan_events for select
  using (exists (
    select 1 from public.business_memberships membership
    where membership.business_id = document_scan_events.business_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin')
  ));

create index if not exists supplier_bills_business_status_idx
  on public.supplier_bills(business_id, status, due_date);

create unique index if not exists supplier_bills_number_unique_idx
  on public.supplier_bills(business_id, lower(supplier_name), lower(invoice_number))
  where invoice_number is not null and btrim(invoice_number) <> '' and status <> 'cancelled';

alter table public.supplier_bills enable row level security;

drop policy if exists supplier_bills_select_members on public.supplier_bills;
create policy supplier_bills_select_members on public.supplier_bills for select
  using (exists (
    select 1 from public.business_memberships membership
    where membership.business_id = supplier_bills.business_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  ));

drop policy if exists supplier_bills_manage_bookkeepers on public.supplier_bills;
create policy supplier_bills_manage_bookkeepers on public.supplier_bills for all
  using (exists (
    select 1 from public.business_memberships membership
    where membership.business_id = supplier_bills.business_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'accountant', 'staff')
  ))
  with check (exists (
    select 1 from public.business_memberships membership
    where membership.business_id = supplier_bills.business_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'accountant', 'staff')
  ));

create or replace function public.set_supplier_bill_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists supplier_bills_updated_at on public.supplier_bills;
create trigger supplier_bills_updated_at before update on public.supplier_bills
for each row execute function public.set_supplier_bill_updated_at();

-- Recreate expense posting with tenant/contact/currency checks inside the transaction.
create or replace function public.record_expense(
  p_business_id uuid,
  p_account_id uuid,
  p_contact_id uuid default null,
  p_category text default 'General',
  p_description text default '',
  p_amount numeric default 0,
  p_currency text default 'IQD',
  p_expense_date text default null,
  p_note text default null,
  p_receipt_url text default null,
  p_created_by uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_expense_id uuid;
  v_date date;
begin
  if auth.role() <> 'service_role' and not exists (
    select 1 from public.business_memberships membership
    where membership.business_id = p_business_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'accountant', 'staff')
  ) then raise exception 'Permission denied'; end if;

  if p_amount <= 0 then raise exception 'Expense amount must be positive'; end if;
  v_date := coalesce(nullif(p_expense_date, '')::date, current_date);

  if not exists (
    select 1 from public.accounts
    where id = p_account_id and business_id = p_business_id and is_active = true
      and currency = p_currency::public.currency_code
  ) then
    raise exception 'Account is inactive, belongs to another business, or uses another currency';
  end if;

  if p_contact_id is not null and not exists (
    select 1 from public.contacts where id = p_contact_id and business_id = p_business_id
  ) then
    raise exception 'Supplier belongs to another business';
  end if;

  insert into public.expenses (
    business_id, account_id, contact_id, category, description, amount,
    currency, expense_date, note, receipt_url, created_by
  ) values (
    p_business_id, p_account_id, p_contact_id, p_category, p_description, p_amount,
    p_currency::public.currency_code, v_date, p_note, p_receipt_url, p_created_by
  ) returning id into v_expense_id;

  insert into public.money_transactions (
    business_id, account_id, type, amount, currency, description,
    transaction_date, reference_id, reference_table, created_by
  ) values (
    p_business_id, p_account_id, 'expense_paid', -p_amount, p_currency::public.currency_code,
    'Expense: ' || p_category || ' - ' || p_description,
    v_date, v_expense_id, 'expenses', p_created_by
  );

  return v_expense_id;
end;
$$;

create or replace function public.pay_supplier_bill(
  p_business_id uuid,
  p_bill_id uuid,
  p_account_id uuid,
  p_payment_date text,
  p_note text default null,
  p_created_by uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_bill public.supplier_bills%rowtype;
  v_expense_id uuid;
  v_remaining numeric;
begin
  if auth.role() <> 'service_role' and not exists (
    select 1 from public.business_memberships membership
    where membership.business_id = p_business_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'accountant')
  ) then raise exception 'Permission denied'; end if;

  select * into v_bill from public.supplier_bills
  where id = p_bill_id and business_id = p_business_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if v_bill.status in ('paid', 'cancelled') then raise exception 'Bill cannot be paid'; end if;

  v_remaining := v_bill.total - v_bill.amount_paid;
  select public.record_expense(
    p_business_id, p_account_id, v_bill.contact_id, v_bill.category,
    v_bill.description, v_remaining, v_bill.currency::text, p_payment_date,
    concat_ws(' · ', nullif(v_bill.invoice_number, ''), p_note),
    v_bill.attachment_path, p_created_by
  ) into v_expense_id;

  update public.supplier_bills
  set amount_paid = total, status = 'paid', updated_at = now()
  where id = v_bill.id;

  return v_expense_id;
end;
$$;

notify pgrst, 'reload schema';
