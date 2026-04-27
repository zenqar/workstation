-- =============================================================
-- Migration 018: Fix subtotal and add missing columns
-- =============================================================

-- Ensure subtotal exists on invoice_items as a generated column if possible
-- or as a regular column if generated fails.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'invoice_items' and column_name = 'subtotal') then
    begin
      alter table public.invoice_items add column subtotal numeric(18,3) generated always as (quantity * unit_price) stored;
    exception when others then
      alter table public.invoice_items add column subtotal numeric(18,3) not null default 0;
    end;
  end if;
end $$;

-- Update issue_invoice to be more resilient (calculate subtotal in-query)
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

  -- Build snapshot JSON with items (calculate subtotal manually to avoid missing column issues)
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
        'subtotal',    ii.quantity * ii.unit_price
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
