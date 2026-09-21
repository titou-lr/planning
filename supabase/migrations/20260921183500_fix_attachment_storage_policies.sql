drop policy if exists planning_attachments_select_owner on storage.objects;
drop policy if exists planning_attachments_insert_owner on storage.objects;
drop policy if exists planning_attachments_update_owner on storage.objects;
drop policy if exists planning_attachments_delete_owner on storage.objects;

create policy planning_attachments_select_owner on storage.objects for select to authenticated
using (
  bucket_id = 'planning-attachments'
  and (storage.foldername(storage.objects.name))[1] ~ '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.workspaces w
    where w.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and w.owner_id = (select auth.uid())
  )
);

create policy planning_attachments_insert_owner on storage.objects for insert to authenticated
with check (
  bucket_id = 'planning-attachments'
  and (storage.foldername(storage.objects.name))[1] ~ '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.workspaces w
    where w.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and w.owner_id = (select auth.uid())
  )
);

create policy planning_attachments_update_owner on storage.objects for update to authenticated
using (
  bucket_id = 'planning-attachments'
  and (storage.foldername(storage.objects.name))[1] ~ '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.workspaces w
    where w.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and w.owner_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'planning-attachments'
  and (storage.foldername(storage.objects.name))[1] ~ '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.workspaces w
    where w.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and w.owner_id = (select auth.uid())
  )
);

create policy planning_attachments_delete_owner on storage.objects for delete to authenticated
using (
  bucket_id = 'planning-attachments'
  and (storage.foldername(storage.objects.name))[1] ~ '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.workspaces w
    where w.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and w.owner_id = (select auth.uid())
  )
);
