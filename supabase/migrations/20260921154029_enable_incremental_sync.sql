-- sync_mutations is an append-only, idempotent change journal.
drop policy if exists sync_mutations_update_owner on public.sync_mutations;
revoke update on public.sync_mutations from authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sync_mutations'
  ) then
    alter publication supabase_realtime add table public.sync_mutations;
  end if;
end
$$;
