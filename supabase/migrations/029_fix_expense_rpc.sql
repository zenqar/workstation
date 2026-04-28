-- =============================================================
-- Migration 029: Fix record_expense RPC signature
-- =============================================================

-- Drop the old function if it exists with the strict enum/date types
drop function if exists public.record_expense(uuid, uuid, uuid, text, text, numeric, currency_code, date, text, text, uuid);

-- Recreate with text types to ensure PostgREST can always match the signature 
-- regardless of how the JSON payload is typed.
create or replace function public.record_expense(
  p_business_id   uuid,
  p_account_id    uuid,
  p_contact_id    uuid default null,
  p_category      text default 'General',
  p_description   text default '',
  p_amount        numeric default 0,
  p_currency      text default 'IQD',
  p_expense_date  text default null,
  p_note          text default null,
  p_receipt_url   text default null,
  p_created_by    uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_date date;
begin
  -- Parse the date or default to today
  if p_expense_date is null then
    v_date := current_date;
  else
    v_date := p_expense_date::date;
  end if;

  -- Validate account belongs to business
  if not exists (
    select 1 from accounts where id = p_account_id and business_id = p_business_id and is_active = true
  ) then
    raise exception 'Account not found or inactive: %', p_account_id;
  end if;

  -- Insert expense
  insert into expenses (
    business_id,
    account_id,
    contact_id,
    category,
    description,
    amount,
    currency,
    expense_date,
    note,
    receipt_url,
    created_by
  )
  values (
    p_business_id,
    p_account_id,
    p_contact_id,
    p_category,
    p_description,
    p_amount,
    p_currency::currency_code,
    v_date,
    p_note,
    p_receipt_url,
    p_created_by
  )
  returning id into v_expense_id;

  -- Insert money transaction (negative because it's an expense)
  insert into money_transactions (
    business_id,
    account_id,
    type,
    amount,
    currency,
    description,
    transaction_date,
    reference_id,
    reference_table,
    created_by
  )
  values (
    p_business_id,
    p_account_id,
    'expense_paid',
    -p_amount,
    p_currency::currency_code,
    'Expense: ' || p_category || ' - ' || p_description,
    v_date,
    v_expense_id,
    'expenses',
    p_created_by
  );

  return v_expense_id;
end;
$$;

-- Force PostgREST to reload the schema cache so the frontend can immediately see the function
notify pgrst, 'reload schema';
