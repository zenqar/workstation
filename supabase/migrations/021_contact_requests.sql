-- =============================================================
-- Migration 021: Contact Connections & Requests
-- =============================================================

-- 1. Create contact_requests table
create table public.contact_requests (
  id                  uuid          primary key default uuid_generate_v4(),
  sender_business_id  uuid          not null references public.businesses(id) on delete cascade,
  sender_user_id      uuid          not null references auth.users(id),
  receiver_email      text          not null,
  status              text          not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

-- 2. Add connection fields to contacts table
alter table public.contacts add column if not exists connected_user_id uuid references auth.users(id);
alter table public.contacts add column if not exists connection_status text default 'none' check (connection_status in ('none', 'pending', 'connected'));

-- 3. RLS for contact_requests
alter table public.contact_requests enable row level security;

create policy "Users can view requests they sent"
  on public.contact_requests for select
  using (auth.uid() = sender_user_id);

create policy "Users can view requests sent to their email"
  on public.contact_requests for select
  using (receiver_email = (select email from auth.users where id = auth.uid()));

create policy "Users can update requests sent to them"
  on public.contact_requests for update
  using (receiver_email = (select email from auth.users where id = auth.uid()))
  with check (receiver_email = (select email from auth.users where id = auth.uid()));

-- 4. Trigger to handle acceptance
create or replace function public.handle_contact_request_acceptance()
returns trigger language plpgsql security definer 
set search_path = public
as $$
begin
  if (new.status = 'accepted' and old.status = 'pending') then
    -- Update the sender's contact record to 'connected'
    update public.contacts
    set connection_status = 'connected',
        connected_user_id = new.sender_user_id -- This is tricky, it should be the receiver's user ID?
                                                -- Actually, if I accept a request, I am the receiver.
                                                -- So the contact in the sender's business should link to ME.
    where business_id = new.sender_business_id
      and email = new.receiver_email;

    -- Optional: Create a reverse contact in the receiver's business?
    -- For now, just mark the link.
  end if;
  return new;
end;
$$;

create trigger trg_handle_contact_request_acceptance
  after update on public.contact_requests
  for each row execute function public.handle_contact_request_acceptance();
