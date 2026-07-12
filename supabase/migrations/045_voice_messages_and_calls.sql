-- Reliable voice messages plus participant-only one-to-one WebRTC call signaling.

alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists attachment_path text,
  add column if not exists attachment_mime text,
  add column if not exists attachment_duration_seconds integer,
  add column if not exists sender_business_id uuid references public.businesses(id) on delete cascade,
  add column if not exists receiver_business_id uuid references public.businesses(id) on delete cascade;

-- Scope chat to the two companies, not only two user IDs. This prevents a
-- conversation leaking into another business relationship owned by the same
-- users and lets authorized teammates see their company's contact history.
update public.messages
set sender_business_id = business_id
where sender_business_id is null and business_id is not null;

update public.messages message
set receiver_business_id = (
  select (array_agg(distinct candidate.connected_business_id))[1]
  from public.contacts candidate
  where candidate.business_id = message.sender_business_id
    and candidate.connected_user_id = message.receiver_id
    and candidate.connection_status = 'connected'
    and candidate.connected_business_id is not null
  having count(distinct candidate.connected_business_id) = 1
)
where message.receiver_business_id is null
  and message.sender_business_id is not null
  and 1 = (
    select count(distinct candidate.connected_business_id) from public.contacts candidate
    where candidate.business_id = message.sender_business_id
      and candidate.connected_user_id = message.receiver_id
      and candidate.connection_status = 'connected'
      and candidate.connected_business_id is not null
  );

with inferred as (
  select
    message.id,
    (array_agg(distinct contact.business_id))[1] as sender_business_id,
    (array_agg(distinct contact.connected_business_id))[1] as receiver_business_id
  from public.messages message
  join public.business_memberships membership
    on membership.user_id = message.sender_id and membership.status = 'active'
  join public.contacts contact
    on contact.business_id = membership.business_id
   and contact.connected_user_id = message.receiver_id
   and contact.connection_status = 'connected'
   and contact.connected_business_id is not null
  where message.sender_business_id is null
  group by message.id
  having count(distinct (contact.business_id, contact.connected_business_id)) = 1
)
update public.messages message
set sender_business_id = inferred.sender_business_id,
    receiver_business_id = inferred.receiver_business_id
from inferred
where message.id = inferred.id;

create index if not exists idx_messages_business_conversation
  on public.messages(sender_business_id, receiver_business_id, created_at);

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type in ('text', 'voice'));

alter table public.messages drop constraint if exists messages_voice_attachment_check;
update public.messages
set attachment_mime = case
  when lower(split_part(coalesce(attachment_mime, ''), ';', 1)) in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg')
    then lower(split_part(attachment_mime, ';', 1))
  when lower(attachment_path) ~ '\.(m4a|mp4)$' then 'audio/mp4'
  when lower(attachment_path) ~ '\.ogg$' then 'audio/ogg'
  when lower(attachment_path) ~ '\.mp3$' then 'audio/mpeg'
  when lower(attachment_path) ~ '\.webm$' then 'audio/webm'
  else null
end
where message_type = 'voice';

-- Migration 042 allowed arbitrary MIME strings. Keep valid legacy recordings,
-- but quarantine malformed rows that cannot be identified safely instead of
-- letting one bad value abort this migration or be served as trusted audio.
update public.messages
set message_type = 'text',
    attachment_path = null,
    attachment_mime = null,
    attachment_duration_seconds = null
where message_type = 'voice'
  and (
    attachment_path is null
    or attachment_mime is null
    or attachment_duration_seconds not between 1 and 60
  );

update public.messages
set attachment_path = null, attachment_mime = null, attachment_duration_seconds = null
where message_type = 'text';

alter table public.messages add constraint messages_voice_attachment_check check (
  (
    message_type = 'text'
    and attachment_path is null
    and attachment_mime is null
    and attachment_duration_seconds is null
  )
  or
  (
    message_type = 'voice'
    and attachment_path is not null
    and attachment_mime in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg')
    and attachment_duration_seconds between 1 and 60
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-voice', 'chat-voice', false, 4194304, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat voice participants can read" on storage.objects;
drop policy if exists "chat voice senders can upload" on storage.objects;
drop policy if exists "chat voice senders can delete" on storage.objects;

-- Voice files are uploaded, signed, and removed only by authenticated server
-- routes after checking current business membership. Direct object policies
-- would let a former employee reuse a cached path or delete company history.

drop policy if exists "Users can view their own messages" on public.messages;
drop policy if exists "Users can view business conversations" on public.messages;
create policy "Users can view business conversations" on public.messages for select to authenticated
using (
  (
    (sender_business_id is null and receiver_business_id is null)
    and auth.uid() in (sender_id, receiver_id)
  )
  or exists (
    select 1 from public.business_memberships membership
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.business_id in (sender_business_id, receiver_business_id)
  )
);

drop policy if exists "Users can update their own messages (read status)" on public.messages;
drop policy if exists "Recipient businesses can mark messages read" on public.messages;
create policy "Recipient businesses can mark messages read" on public.messages for update to authenticated
using (
  (
    (sender_business_id is null and receiver_business_id is null)
    and auth.uid() = receiver_id
  )
  or exists (
    select 1 from public.business_memberships membership
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.business_id = receiver_business_id
  )
)
with check (
  (
    (sender_business_id is null and receiver_business_id is null)
    and auth.uid() = receiver_id
  )
  or exists (
    select 1 from public.business_memberships membership
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.business_id = receiver_business_id
  )
);

drop policy if exists "Users can message connected contacts" on public.messages;
create policy "Users can message connected contacts" on public.messages for insert to authenticated
with check (
  auth.uid() = sender_id
  and business_id = sender_business_id
  and exists (
    select 1
    from public.contacts contact
    join public.business_memberships membership on membership.business_id = contact.business_id
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and contact.connection_status = 'connected'
      and contact.connected_user_id = receiver_id
      and contact.business_id = sender_business_id
      and contact.connected_business_id = receiver_business_id
  )
);

-- Messages are created by authenticated server actions/routes after full file
-- and membership validation. Browsers only need SELECT plus the is_read column.
revoke insert, update, delete on public.messages from anon, authenticated;
grant update (is_read) on public.messages to authenticated;

-- Contact connection fields are security boundaries for chat and calls. All
-- app mutations already go through validated server actions or the acceptance
-- trigger, so clients receive read-only table privileges.
revoke insert, update, delete on public.contacts from anon, authenticated;
grant select on public.contacts to authenticated;

create table if not exists public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  caller_business_id uuid not null references public.businesses(id) on delete cascade,
  callee_business_id uuid not null references public.businesses(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  caller_name text not null default 'Zenqar contact',
  callee_name text not null default 'Zenqar contact',
  status text not null default 'ringing' check (status in ('ringing', 'active', 'declined', 'missed', 'cancelled', 'ended', 'failed')),
  -- Signaling data is erased as soon as the call reaches a terminal state.
  offer jsonb,
  answer jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '45 seconds'),
  answered_at timestamptz,
  ended_at timestamptz,
  caller_heartbeat_at timestamptz not null default now(),
  callee_heartbeat_at timestamptz,
  check (caller_id <> callee_id)
);

-- Repair a database where an earlier draft of migration 045 was applied.
alter table public.voice_calls add column if not exists caller_business_id uuid references public.businesses(id) on delete cascade;
alter table public.voice_calls add column if not exists callee_business_id uuid references public.businesses(id) on delete cascade;
alter table public.voice_calls add column if not exists caller_heartbeat_at timestamptz not null default now();
alter table public.voice_calls add column if not exists callee_heartbeat_at timestamptz;

-- An interrupted run of an earlier draft may have created these columns as
-- nullable. Retire any such unusable open call, then enforce business scope on
-- every new row without deleting historical call records.
update public.voice_calls
set status = 'failed', ended_at = coalesce(ended_at, now()), offer = null, answer = null
where (caller_business_id is null or callee_business_id is null)
  and status in ('ringing', 'active');

alter table public.voice_calls drop constraint if exists voice_calls_business_scope_required;
alter table public.voice_calls add constraint voice_calls_business_scope_required
  check (caller_business_id is not null and callee_business_id is not null) not valid;

update public.voice_calls
set ended_at = coalesce(ended_at, now()), offer = null, answer = null
where status in ('declined', 'missed', 'cancelled', 'ended', 'failed');

alter table public.voice_calls drop constraint if exists voice_calls_signaling_state_check;
alter table public.voice_calls add constraint voice_calls_signaling_state_check check (
  (
    status = 'ringing'
    and offer is not null
    and jsonb_typeof(offer) = 'object'
    and coalesce(offer->>'type', '') = 'offer'
    and coalesce(char_length(offer->>'sdp'), 0) between 1 and 250000
    and answer is null
  )
  or (
    status = 'active'
    and offer is not null
    and jsonb_typeof(offer) = 'object'
    and coalesce(offer->>'type', '') = 'offer'
    and coalesce(char_length(offer->>'sdp'), 0) between 1 and 250000
    and answer is not null
    and jsonb_typeof(answer) = 'object'
    and coalesce(answer->>'type', '') = 'answer'
    and coalesce(char_length(answer->>'sdp'), 0) between 1 and 250000
  )
  or (
    status in ('declined', 'missed', 'cancelled', 'ended', 'failed')
    and offer is null
    and answer is null
  )
);

create index if not exists voice_calls_callee_ringing_idx on public.voice_calls(callee_id, status, created_at desc);
create index if not exists voice_calls_caller_status_idx on public.voice_calls(caller_id, status, created_at desc);
create index if not exists voice_calls_open_expires_idx on public.voice_calls(expires_at) where status in ('ringing', 'active');
create unique index if not exists voice_calls_one_open_pair_idx
  on public.voice_calls (least(caller_id, callee_id), greatest(caller_id, callee_id))
  where status in ('ringing', 'active');

create or replace function public.zenqar_enforce_voice_call_availability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Serialize call creation for both participants so simultaneous requests
  -- from multiple tabs cannot put one user into two calls.
  perform pg_advisory_xact_lock(hashtextextended(least(new.caller_id, new.callee_id)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(new.caller_id, new.callee_id)::text, 0));

  if exists (
    select 1 from public.voice_calls existing
    where existing.status in ('ringing', 'active')
      and existing.expires_at > now()
      and (
        existing.caller_id in (new.caller_id, new.callee_id)
        or existing.callee_id in (new.caller_id, new.callee_id)
      )
  ) then
    raise exception using errcode = '23505', message = 'voice_call_participant_busy';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_voice_calls_enforce_availability on public.voice_calls;
create trigger trg_voice_calls_enforce_availability
  before insert on public.voice_calls
  for each row execute function public.zenqar_enforce_voice_call_availability();

alter table public.voice_calls enable row level security;
revoke all on public.voice_calls from anon, authenticated;
grant select on public.voice_calls to authenticated;
drop policy if exists voice_calls_participants_read on public.voice_calls;
create policy voice_calls_participants_read on public.voice_calls for select to authenticated
using (auth.uid() in (caller_id, callee_id));

create table if not exists public.voice_call_ice_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists voice_call_ice_requests_user_created_idx
  on public.voice_call_ice_requests(user_id, created_at desc);
alter table public.voice_call_ice_requests enable row level security;
revoke all on public.voice_call_ice_requests from anon, authenticated;

create table if not exists public.voice_call_candidates (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.voice_calls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.voice_call_candidates drop constraint if exists voice_call_candidates_payload_check;
alter table public.voice_call_candidates add constraint voice_call_candidates_payload_check
  check (jsonb_typeof(candidate) = 'object' and pg_column_size(candidate) <= 8192);

create index if not exists voice_call_candidates_call_idx on public.voice_call_candidates(call_id, id);
create index if not exists voice_call_candidates_created_at_idx on public.voice_call_candidates(created_at);
alter table public.voice_call_candidates enable row level security;
revoke all on public.voice_call_candidates from anon, authenticated;
grant select on public.voice_call_candidates to authenticated;
grant insert (call_id, user_id, candidate) on public.voice_call_candidates to authenticated;
grant usage, select on sequence public.voice_call_candidates_id_seq to authenticated;

drop policy if exists voice_call_candidates_participants_read on public.voice_call_candidates;
create policy voice_call_candidates_participants_read on public.voice_call_candidates for select to authenticated
using (exists (
  select 1 from public.voice_calls voice_call
  where voice_call.id = voice_call_candidates.call_id
    and auth.uid() in (voice_call.caller_id, voice_call.callee_id)
));

drop policy if exists voice_call_candidates_participants_insert on public.voice_call_candidates;
create policy voice_call_candidates_participants_insert on public.voice_call_candidates for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.voice_calls voice_call
    where voice_call.id = voice_call_candidates.call_id
      and auth.uid() in (voice_call.caller_id, voice_call.callee_id)
      and voice_call.status in ('ringing', 'active')
      and voice_call.expires_at > now()
  )
);

create or replace function public.zenqar_limit_voice_call_candidates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.voice_call_candidates candidate where candidate.call_id = new.call_id) >= 128 then
    raise exception using errcode = '54000', message = 'voice_call_candidate_limit_reached';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_voice_call_candidates_limit on public.voice_call_candidates;
create trigger trg_voice_call_candidates_limit
  before insert on public.voice_call_candidates
  for each row execute function public.zenqar_limit_voice_call_candidates();

create or replace function public.zenqar_finalize_voice_call()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('declined', 'missed', 'cancelled', 'ended', 'failed') then
    new.ended_at := coalesce(new.ended_at, now());
    new.offer := null;
    new.answer := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_voice_calls_finalize on public.voice_calls;
create trigger trg_voice_calls_finalize
  before update of status on public.voice_calls
  for each row execute function public.zenqar_finalize_voice_call();

create or replace function public.zenqar_delete_voice_call_candidates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('declined', 'missed', 'cancelled', 'ended', 'failed')
     and old.status is distinct from new.status then
    delete from public.voice_call_candidates where call_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_voice_calls_delete_candidates on public.voice_calls;
create trigger trg_voice_calls_delete_candidates
  after update of status on public.voice_calls
  for each row execute function public.zenqar_delete_voice_call_candidates();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'voice_calls'
  ) then alter publication supabase_realtime add table public.voice_calls; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'voice_call_candidates'
  ) then alter publication supabase_realtime add table public.voice_call_candidates; end if;
end $$;

notify pgrst, 'reload schema';
