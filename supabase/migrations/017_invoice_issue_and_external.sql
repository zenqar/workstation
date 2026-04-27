-- =============================================================
-- Migration 017: Invoice Issuing Fix & External Data Support
-- Fixes missing issue_invoice function and adds fields for 
-- bank balances and legacy/external invoices.
-- =============================================================

-- 1. Fix issue_invoice function (ensure it exists in public and is robust)
create or replace function public.issue_invoice(
  p_invoice_id  uuid,
  p_issued_by   uuid
)
returns void
language plpgsql 
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_snapshot jsonb;
begin
  select * into v_invoice
  from public.invoices
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
    'status',          'issued',
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
      from public.invoice_items ii
      where ii.invoice_id = p_invoice_id
    ),
    'snapshot_at', now()
  ) into v_snapshot;

  update public.invoices
  set status            = 'issued',
      issued_by         = p_issued_by,
      issued_at         = now(),
      snapshot_json     = v_snapshot,
      snapshot_taken_at = now(),
      updated_at        = now()
  where id = p_invoice_id;
end;
$$;

grant execute on function public.issue_invoice(uuid, uuid) to authenticated;
grant execute on function public.issue_invoice(uuid, uuid) to service_role;

-- 2. Add fields for External/Legacy Invoices
alter table public.invoices 
add column if not exists is_external boolean not null default false,
add column if not exists external_source text,
add column if not exists external_id text;

comment on column public.invoices.is_external is 'Flag for invoices imported from other systems or legacy data.';

-- 3. Add fields for Account Opening Balances
alter table public.accounts
add column if not exists opening_balance numeric(18,3) not null default 0,
add column if not exists opening_date date not null default current_date;

comment on column public.accounts.opening_balance is 'Initial balance of the account when added to Zenqar.';

-- 4. Trigger to automatically record opening balance in ledger
create or replace function public.handle_account_opening_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete any existing opening balance for this account if updating
  if (TG_OP = 'UPDATE') then
    delete from public.money_transactions 
    where account_id = new.id and type = 'opening_balance';
  end if;

  -- Insert opening balance transaction
  if (new.opening_balance != 0) then
    insert into public.money_transactions (
      business_id,
      account_id,
      type,
      amount,
      currency,
      description,
      transaction_date,
      created_by
    )
    values (
      new.business_id,
      new.id,
      'opening_balance',
      new.opening_balance,
      new.currency,
      'Opening balance',
      new.opening_date,
      new.created_by
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_account_opening_balance on public.accounts;
create trigger trg_account_opening_balance
  after insert or update of opening_balance, opening_date on public.accounts
  for each row execute function public.handle_account_opening_balance();

-- Ensure all authenticated users can see their transactions
-- (Already covered by existing RLS, but double checking)
