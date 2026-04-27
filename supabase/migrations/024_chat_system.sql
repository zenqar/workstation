-- =============================================================
-- Migration 024: B2B Chat System
-- =============================================================

-- 1. Create messages table
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete cascade not null,
  receiver_id uuid references auth.users(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade, -- Optional: messages can be business-linked
  content text not null,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

-- 2. Enable Realtime
alter publication supabase_realtime add table public.messages;

-- 3. RLS Policies
alter table public.messages enable row level security;

create policy "Users can view their own messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Users can update their own messages (read status)"
  on public.messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- 4. Indexes
create index idx_messages_sender_receiver on public.messages(sender_id, receiver_id);
create index idx_messages_created_at on public.messages(created_at desc);
