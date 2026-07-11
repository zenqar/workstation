-- Private, participant-only voice messages for B2B chat.
alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists attachment_path text,
  add column if not exists attachment_mime text,
  add column if not exists attachment_duration_seconds integer;

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type in ('text', 'voice'));

alter table public.messages drop constraint if exists messages_voice_attachment_check;
alter table public.messages add constraint messages_voice_attachment_check
  check (
    (message_type = 'text' and attachment_path is null)
    or
    (message_type = 'voice' and attachment_path is not null and attachment_duration_seconds between 1 and 60)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-voice',
  'chat-voice',
  false,
  4194304,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat voice participants can read" on storage.objects;
create policy "chat voice participants can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-voice'
  and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2])
);

drop policy if exists "chat voice senders can upload" on storage.objects;
create policy "chat voice senders can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-voice'
  and auth.uid()::text = (storage.foldername(name))[1]
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1
    from public.contacts contact
    join public.business_memberships membership on membership.business_id = contact.business_id
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and contact.connected_user_id::text = (storage.foldername(name))[2]
  )
);

drop policy if exists "chat voice senders can delete" on storage.objects;
create policy "chat voice senders can delete"
on storage.objects for delete to authenticated
using (bucket_id = 'chat-voice' and auth.uid()::text = (storage.foldername(name))[1]);

notify pgrst, 'reload schema';
