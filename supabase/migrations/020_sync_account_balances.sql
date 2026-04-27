-- =============================================================
-- Migration 020: Sync account balance column with transactions
-- =============================================================

-- 0. Ensure balance column exists
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'accounts' and column_name = 'balance') then
    alter table public.accounts add column balance numeric(18,3) not null default 0;
  end if;
end $$;

-- 1. Create function to sync balance
create or replace function public.update_account_balance()
returns trigger language plpgsql security definer 
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.accounts 
    set balance = balance + new.amount, 
        updated_at = now() 
    where id = new.account_id;
  elsif (tg_op = 'UPDATE') then
    update public.accounts 
    set balance = balance - old.amount + new.amount, 
        updated_at = now() 
    where id = new.account_id;
  elsif (tg_op = 'DELETE') then
    update public.accounts 
    set balance = balance - old.amount, 
        updated_at = now() 
    where id = old.account_id;
  end if;
  return null;
end;
$$;

-- 2. Attach trigger to money_transactions
drop trigger if exists trg_money_transaction_sync_balance on public.money_transactions;
create trigger trg_money_transaction_sync_balance
  after insert or update or delete on public.money_transactions
  for each row execute function public.update_account_balance();

-- 3. Initial sync for all accounts
update public.accounts a
set balance = (
  select coalesce(sum(amount), 0)
  from public.money_transactions mt
  where mt.account_id = a.id
);
