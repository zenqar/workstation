-- =============================================================
-- Migration 003: Database Functions & Triggers
-- Business logic enforced at the DB layer
-- =============================================================

-- =============================================================
-- FUNCTION: get_next_invoice_number
-- Atomically increments the business invoice sequence and returns
-- the formatted invoice number. Call inside a transaction.
-- =============================================================

create or replace function get_next_invoice_number(p_business_id uuid)
returns text
language plpgsql security definer
as $$
declare
  v_prefix    text;
  v_year      text;
  v_sequence  integer;
  v_number    text;
begin
  -- Lock the business row to prevent race conditions
  select invoice_prefix, invoice_sequence + 1
  into v_prefix, v_sequence
  from businesses
  where id = p_business_id
  for update;

  if not found then
    raise exception 'Business not found: %', p_business_id;
  end if;

  -- Update sequence
  update businesses
  set invoice_sequence = v_sequence
  where id = p_business_id;

  v_year   := to_char(current_date, 'YYYY');
  v_number := v_prefix || '-' || v_year || '-' || lpad(v_sequence::text, 4, '0');

  return v_number;
end;
$$;

comment on function get_next_invoice_number is 'Atomically generates a sequential invoice number per business. Format: {PREFIX}-{YEAR}-{NNNN}';

-- =============================================================
-- FUNCTION: record_payment_and_update_invoice
-- Records a payment, updates invoice paid/status, creates ledger entry.
-- Called from server actions (not directly from client).
-- =============================================================

create or replace function record_payment_and_update_invoice(
  p_business_id   uuid,
  p_invoice_id    uuid,
  p_account_id    uuid,
  p_amount        numeric,
  p_currency      currency_code,
  p_payment_date  date,
  p_reference     text default null,
  p_note          text default null,
  p_created_by    uuid default null
)
returns uuid
language plpgsql security definer
as $$
declare
  v_payment_id      uuid;
  v_invoice_total   numeric;
  v_new_paid        numeric;
  v_new_status      invoice_status;
begin
  -- Validate invoice belongs to business and is in a payable state
  select total, amount_paid
  into v_invoice_total, v_new_paid
  from invoices
  where id = p_invoice_id
    and business_id = p_business_id
    and status not in ('draft', 'cancelled')
  for update;

  if not found then
    raise exception 'Invoice not found or not in a payable state: %', p_invoice_id;
  end if;

  -- Insert payment record
  insert into payments (
    business_id, invoice_id, account_id, amount, currency,
    payment_date, reference, note, created_by
  )
  values (
    p_business_id, p_invoice_id, p_account_id, p_amount, p_currency,
    p_payment_date, p_reference, p_note, p_created_by
  )
  returning id into v_payment_id;

  -- Calculate new paid amount and determine status
  v_new_paid := v_new_paid + p_amount;

  if v_new_paid >= v_invoice_total then
    v_new_status := 'paid';
  else
    v_new_status := 'partially_paid';
  end if;

  -- Update invoice
  update invoices
  set amount_paid = v_new_paid,
      status      = v_new_status,
      updated_at  = now()
  where id = p_invoice_id;

  -- Insert money transaction (credit to account)
  insert into money_transactions (
    business_id, account_id, type, amount, currency,
    reference_id, reference_table, description, transaction_date, created_by
  )
  values (
    p_business_id, p_account_id, 'payment_received', p_amount, p_currency,
    v_payment_id, 'payments',
    'Payment received for invoice ' || (select invoice_number from invoices where id = p_invoice_id),
    p_payment_date, p_created_by
  );

  return v_payment_id;
end;
$$;

comment on function record_payment_and_update_invoice is 'Atomically records payment, updates invoice status, and creates money transaction. Call from server-side only.';

-- =============================================================
-- FUNCTION: record_expense
-- Records an expense and creates a debit money transaction.
-- =============================================================

create or replace function record_expense(
  p_business_id   uuid,
  p_account_id    uuid,
  p_contact_id    uuid default null,
  p_category      text default 'General',
  p_description   text default '',
  p_amount        numeric default 0,
  p_currency      currency_code default 'IQD',
  p_expense_date  date default current_date,
  p_note          text default null,
  p_receipt_url   text default null,
  p_created_by    uuid default null
)
returns uuid
language plpgsql security definer
as $$
declare
  v_expense_id uuid;
begin
  -- Validate account belongs to business
  if not exists (
    select 1 from accounts where id = p_account_id and business_id = p_business_id and is_active = true
  ) then
    raise exception 'Account not found or inactive: %', p_account_id;
  end if;

  -- Insert expense
  insert into expenses (
    business_id, account_id, contact_id, category, description,
    amount, currency, expense_date, note, receipt_url, created_by
  )
  values (
    p_business_id, p_account_id, p_contact_id, p_category, p_description,
    p_amount, p_currency, p_expense_date, p_note, p_receipt_url, p_created_by
  )
  returning id into v_expense_id;

  -- Insert money transaction (debit from account — negative amount)
  insert into money_transactions (
    business_id, account_id, type, amount, currency,
    reference_id, reference_table, description, transaction_date, created_by
  )
  values (
    p_business_id, p_account_id, 'expense_paid', -p_amount, p_currency,
    v_expense_id, 'expenses', p_description, p_expense_date, p_created_by
  );

  return v_expense_id;
end;
$$;

-- =============================================================
-- FUNCTION: transfer_between_accounts
-- Moves money between two accounts in the same business.
-- Creates two money_transaction records (debit + credit).
-- =============================================================

create or replace function transfer_between_accounts(
  p_business_id     uuid,
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric,
  p_currency        currency_code,
  p_transfer_date   date default current_date,
  p_description     text default 'Internal transfer',
  p_created_by      uuid default null
)
returns void
language plpgsql security definer
as $$
begin
  if p_from_account_id = p_to_account_id then
    raise exception 'Source and destination accounts must be different';
  end if;

  -- Debit source account
  insert into money_transactions (
    business_id, account_id, type, amount, currency,
    description, transaction_date, created_by
  )
  values (
    p_business_id, p_from_account_id, 'transfer_out', -p_amount, p_currency,
    p_description || ' → ' || (select name from accounts where id = p_to_account_id),
    p_transfer_date, p_created_by
  );

  -- Credit destination account
  insert into money_transactions (
    business_id, account_id, type, amount, currency,
    description, transaction_date, created_by
  )
  values (
    p_business_id, p_to_account_id, 'transfer_in', p_amount, p_currency,
    p_description || ' ← ' || (select name from accounts where id = p_from_account_id),
    p_transfer_date, p_created_by
  );
end;
$$;

-- =============================================================
-- FUNCTION: get_account_balance
-- Returns current balance for an account derived from transactions.
-- =============================================================

create or replace function get_account_balance(p_account_id uuid)
returns numeric
language sql stable security definer
as $$
  select coalesce(sum(amount), 0)
  from money_transactions
  where account_id = p_account_id;
$$;

-- =============================================================
-- FUNCTION: get_business_balances
-- Returns total balance per currency for a business.
-- =============================================================

create or replace function get_business_balances(p_business_id uuid)
returns table (currency currency_code, total_balance numeric)
language sql stable security definer
as $$
  select mt.currency, coalesce(sum(mt.amount), 0) as total_balance
  from money_transactions mt
  join accounts a on a.id = mt.account_id
  where a.business_id = p_business_id
    and a.is_active = true
  group by mt.currency;
$$;

-- =============================================================
-- FUNCTION: issue_invoice
-- Validates, snapshots, and issues a draft invoice.
-- =============================================================

create or replace function issue_invoice(
  p_invoice_id  uuid,
  p_issued_by   uuid
)
returns void
language plpgsql security definer
as $$
declare
  v_invoice invoices%rowtype;
  v_snapshot jsonb;
begin
  select * into v_invoice
  from invoices
  where id = p_invoice_id
    and status = 'draft'
  for update;

  if not found then
    raise exception 'Invoice not found or not in draft state: %', p_invoice_id;
  end if;

  -- Build snapshot JSON with items
  select jsonb_build_object(
    'id',              v_invoice.id,
    'invoice_number',  v_invoice.invoice_number,
    'status',          v_invoice.status,
    'currency',        v_invoice.currency,
    'issue_date',      v_invoice.issue_date,
    'due_date',        v_invoice.due_date,
    'subtotal',        v_invoice.subtotal,
    'discount_amount', v_invoice.discount_amount,
    'tax_amount',      v_invoice.tax_amount,
    'total',           v_invoice.total,
    'items',           (
      select jsonb_agg(jsonb_build_object(
        'description', ii.description,
        'quantity',    ii.quantity,
        'unit_price',  ii.unit_price,
        'subtotal',    ii.subtotal
      ) order by ii.sort_order)
      from invoice_items ii
      where ii.invoice_id = p_invoice_id
    ),
    'snapshot_at', now()
  ) into v_snapshot;

  update invoices
  set status            = 'issued',
      issued_by         = p_issued_by,
      issued_at         = now(),
      snapshot_json     = v_snapshot,
      snapshot_taken_at = now(),
      updated_at        = now()
  where id = p_invoice_id;
end;
$$;

-- =============================================================
-- TRIGGER: auto-create profile on user signup
-- =============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================
-- TRIGGER: auto-create business_settings on business insert
-- =============================================================

create or replace function handle_new_business()
returns trigger
language plpgsql security definer
as $$
begin
  insert into business_settings (business_id)
  values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

create trigger on_business_created
  after insert on businesses
  for each row execute function handle_new_business();

-- =============================================================
-- FUNCTION: auto-update overdue invoice statuses
-- Run periodically via pg_cron or scheduled Supabase function
-- =============================================================

create or replace function update_overdue_invoices()
returns integer
language plpgsql security definer
as $$
declare
  v_count integer;
begin
  update invoices
  set status     = 'overdue',
      updated_at = now()
  where status in ('issued', 'sent', 'partially_paid')
    and due_date < current_date
    and due_date is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function update_overdue_invoices is 'Marks past-due invoices as overdue. Schedule daily via pg_cron or Supabase scheduled functions.';
