-- =============================================================
-- Migration 019: Fix record_payment_and_update_invoice RPC
-- =============================================================

create or replace function public.record_payment_and_update_invoice(
  p_business_id   uuid,
  p_invoice_id    uuid,
  p_account_id    uuid,
  p_amount        numeric,
  p_currency      text, -- Use text for flexibility with enums
  p_payment_date  date,
  p_reference     text default null,
  p_note          text default null,
  p_created_by    uuid default null
)
returns uuid
language plpgsql 
security definer
set search_path = public
as $$
declare
  v_payment_id      uuid;
  v_invoice_total   numeric;
  v_new_paid        numeric;
  v_new_status      public.invoice_status;
  v_currency_enum   public.currency_code;
begin
  v_currency_enum := p_currency::public.currency_code;

  -- Validate invoice belongs to business and is in a payable state
  select total, amount_paid
  into v_invoice_total, v_new_paid
  from public.invoices
  where id = p_invoice_id
    and business_id = p_business_id
    and status not in ('draft', 'cancelled')
  for update;

  if not found then
    raise exception 'Invoice not found or not in a payable state: %', p_invoice_id;
  end if;

  -- Insert payment record
  insert into public.payments (
    business_id, invoice_id, account_id, amount, currency,
    payment_date, reference, note, created_by
  )
  values (
    p_business_id, p_invoice_id, p_account_id, p_amount, v_currency_enum,
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
  update public.invoices
  set amount_paid = v_new_paid,
      status      = v_new_status,
      updated_at  = now()
  where id = p_invoice_id;

  -- Insert money transaction (credit to account)
  insert into public.money_transactions (
    business_id, account_id, type, amount, currency,
    reference_id, reference_table, description, transaction_date, created_by
  )
  values (
    p_business_id, p_account_id, 'payment_received', p_amount, v_currency_enum,
    v_payment_id, 'payments',
    'Payment received for invoice ' || (select invoice_number from public.invoices where id = p_invoice_id),
    p_payment_date, p_created_by
  );

  return v_payment_id;
end;
$$;

grant execute on function public.record_payment_and_update_invoice(uuid, uuid, uuid, numeric, text, date, text, text, uuid) to authenticated;
grant execute on function public.record_payment_and_update_invoice(uuid, uuid, uuid, numeric, text, date, text, text, uuid) to service_role;
