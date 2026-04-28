-- =============================================================
-- Migration 035: Enhanced Support Types
-- =============================================================

-- Update sender_type check constraint to include 'user'
alter table public.support_messages 
  drop constraint if exists support_messages_sender_type_check;

alter table public.support_messages 
  add constraint support_messages_sender_type_check 
  check (sender_type in ('admin', 'business', 'user'));

notify pgrst, 'reload schema';
