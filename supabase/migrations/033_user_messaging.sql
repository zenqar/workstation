-- =============================================================
-- Migration 033: User Messaging & Delete Safety
-- =============================================================

-- Add recipient_user_id to support_messages to allow direct messaging to users
alter table public.support_messages 
  add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade,
  alter column business_id drop not null;

-- Ensure all foreign keys to businesses have CASCADE
do $$
declare
    r record;
begin
    for r in (
        select 
            tc.table_name, 
            kcu.column_name, 
            rc.constraint_name
        from 
            information_schema.table_constraints AS tc 
            join information_schema.key_column_usage AS kcu
              on tc.constraint_name = kcu.constraint_name
              and tc.table_schema = kcu.table_schema
            join information_schema.referential_constraints AS rc
              on tc.constraint_name = rc.constraint_name
            join information_schema.constraint_column_usage AS ccu
              on rc.unique_constraint_name = ccu.constraint_name
              and rc.unique_constraint_schema = ccu.constraint_schema
        where tc.constraint_type = 'FOREIGN KEY' 
          and ccu.table_name = 'businesses'
          and rc.delete_rule != 'CASCADE'
    ) loop
        execute 'alter table ' || quote_ident(r.table_name) || ' drop constraint ' || quote_ident(r.constraint_name);
        execute 'alter table ' || quote_ident(r.table_name) || ' add constraint ' || quote_ident(r.constraint_name) || 
                ' foreign key (' || quote_ident(r.column_name) || ') references businesses(id) on delete cascade';
    end loop;
end $$;

notify pgrst, 'reload schema';
