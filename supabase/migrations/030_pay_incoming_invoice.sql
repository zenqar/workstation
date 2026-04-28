-- =============================================================
-- Migration 030: Wallet-to-Wallet Incoming Invoice Payment
-- =============================================================

create or replace function public.pay_incoming_invoice(
  p_invoice_id uuid,
  p_payer_business_id uuid,
  p_payer_account_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_reference text default null,
  p_note text default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_payee_business_id uuid;
  v_payee_account_id uuid;
  v_new_paid numeric;
  v_new_status public.invoice_status;
  v_payment_id uuid;
  v_expense_id uuid;
  v_currency currency_code;
begin
  -- 1. Lock and load the invoice
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
    and status not in ('draft', 'cancelled')
  for update;

  if not found then
    raise exception 'Invoice not found or not in a payable state: %', p_invoice_id;
  end if;

  v_payee_business_id := v_invoice.business_id;
  v_currency := v_invoice.currency;

  -- Verify the payer is actually connected to this invoice via a contact
  if not exists (
    select 1 from public.contacts c 
    where c.id = v_invoice.contact_id 
      and c.connected_business_id = p_payer_business_id
  ) then
    raise exception 'Permission denied: Your business is not the recipient of this invoice.';
  end if;

  -- 2. Validate payer account
  if not exists (
    select 1 from public.accounts 
    where id = p_payer_account_id 
      and business_id = p_payer_business_id 
      and currency = v_currency
      and is_active = true
  ) then
    raise exception 'Payer account not found, inactive, or currency mismatch.';
  end if;

  -- 3. Find payee (issuer) account to receive the funds
  select id into v_payee_account_id
  from public.accounts
  where business_id = v_payee_business_id
    and currency = v_currency
    and is_active = true
  order by created_at asc
  limit 1;

  if v_payee_account_id is null then
    raise exception 'The issuer does not have an active account in % to receive this payment.', v_currency;
  end if;

  -- 4. Record EXPENSE for the Payer (Business B)
  insert into public.expenses (
    business_id, account_id, category, description, amount, currency, expense_date, note, created_by
  ) values (
    p_payer_business_id, p_payer_account_id, 'Accounts Payable', 
    'Payment for Invoice ' || v_invoice.invoice_number, 
    p_amount, v_currency, p_payment_date, p_note, p_created_by
  ) returning id into v_expense_id;

  insert into public.money_transactions (
    business_id, account_id, type, amount, currency, reference_id, reference_table, description, transaction_date, created_by
  ) values (
    p_payer_business_id, p_payer_account_id, 'expense_paid', -p_amount, v_currency,
    v_expense_id, 'expenses', 'Paid Invoice ' || v_invoice.invoice_number, p_payment_date, p_created_by
  );

  -- 5. Record PAYMENT for the Payee (Business A)
  insert into public.payments (
    business_id, invoice_id, account_id, amount, currency, payment_date, reference, note, created_by
  ) values (
    v_payee_business_id, p_invoice_id, v_payee_account_id, p_amount, v_currency, p_payment_date, p_reference, p_note, p_created_by
  ) returning id into v_payment_id;

  insert into public.money_transactions (
    business_id, account_id, type, amount, currency, reference_id, reference_table, description, transaction_date, created_by
  ) values (
    v_payee_business_id, v_payee_account_id, 'payment_received', p_amount, v_currency,
    v_payment_id, 'payments', 'Payment received for invoice ' || v_invoice.invoice_number, p_payment_date, p_created_by
  );

  -- 6. Update the Invoice
  v_new_paid := v_invoice.amount_paid + p_amount;
  if v_new_paid >= v_invoice.total then
    v_new_status := 'paid';
  else
    v_new_status := 'partially_paid';
  end if;

  update public.invoices
  set amount_paid = v_new_paid,
      status = v_new_status,
      updated_at = now()
  where id = p_invoice_id;

  return v_payment_id;
end;
$$;

-- Ensure schema cache is updated
notify pgrst, 'reload schema';
