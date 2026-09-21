create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.workspaces (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Espace principal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role = 'owner'),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.pages (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.pages(id) on delete set null,
  title text not null default '',
  kind text not null default 'page' check (kind in ('page', 'database', 'template')),
  position integer not null default 0,
  blocks jsonb not null default '[]'::jsonb,
  properties jsonb not null default '{}'::jsonb,
  schema_definition jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create table public.page_versions (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  title text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create table public.task_statuses (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  category text not null check (category in ('backlog', 'todo', 'inprogress', 'done', 'canceled')),
  color text not null, position integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create table public.labels (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, color text not null, data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create table public.projects (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, description text not null default '', color text not null,
  health text not null default 'active' check (health in ('active', 'paused', 'done')),
  start_date date, target_date date, position integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create table public.cycles (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, start_date date not null, end_date date not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz,
  check (end_date >= start_date)
);

create table public.tasks (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status_id uuid references public.task_statuses(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  cycle_id uuid references public.cycles(id) on delete set null,
  parent_id uuid references public.tasks(id) on delete set null,
  title text not null default '', priority smallint not null default 0 check (priority between 0 and 4),
  due_date date, start_date date, position integer not null default 0,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create table public.goals (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, description text not null default '', target_date date,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create table public.saved_task_views (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create table public.automations (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, enabled boolean not null default true, definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create table public.project_templates (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, description text not null default '', definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create table public.calendar_events (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null, start_at timestamptz not null, end_at timestamptz not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz,
  check (end_at >= start_at)
);

create table public.habits (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, archived boolean not null default false, data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create table public.time_sessions (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  start_at timestamptz not null, end_at timestamptz, data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz,
  check (end_at is null or end_at >= start_at)
);

create table public.attachments (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null, entity_id uuid not null, name text not null,
  storage_path text not null, mime_type text, size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz,
  unique (workspace_id, storage_path)
);

create table public.device_subscriptions (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  device_id uuid not null, subscription jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz,
  unique (workspace_id, device_id)
);

create table public.sync_mutations (
  mutation_id uuid primary key,
  sequence bigint generated always as identity unique,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  device_id uuid not null, entity_type text not null, entity_id uuid not null,
  operation text not null check (operation in ('upsert', 'delete')),
  base_revision bigint, payload jsonb, result_revision bigint,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0), deleted_at timestamptz
);

create or replace function private.set_sync_metadata()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  new.revision := old.revision + 1;
  return new;
end;
$$;
revoke execute on function private.set_sync_metadata() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'workspaces', 'pages', 'page_versions', 'tasks', 'task_statuses', 'labels', 'projects',
    'cycles', 'goals', 'saved_task_views', 'automations', 'project_templates', 'calendar_events',
    'habits', 'time_sessions', 'attachments', 'device_subscriptions', 'sync_mutations'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_sync_metadata()', table_name || '_sync_metadata', table_name);
  end loop;
end $$;

create index workspaces_owner_id_idx on public.workspaces(owner_id);
create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index pages_workspace_updated_idx on public.pages(workspace_id, updated_at, id);
create index pages_parent_id_idx on public.pages(parent_id);
create index page_versions_page_id_idx on public.page_versions(page_id, created_at desc);
create index task_statuses_workspace_position_idx on public.task_statuses(workspace_id, position);
create index labels_workspace_name_idx on public.labels(workspace_id, name);
create index projects_workspace_target_idx on public.projects(workspace_id, target_date);
create index cycles_workspace_dates_idx on public.cycles(workspace_id, start_date, end_date);
create index tasks_workspace_updated_idx on public.tasks(workspace_id, updated_at, id);
create index tasks_status_id_idx on public.tasks(status_id);
create index tasks_project_id_idx on public.tasks(project_id);
create index tasks_cycle_id_idx on public.tasks(cycle_id);
create index tasks_parent_id_idx on public.tasks(parent_id);
create index tasks_workspace_due_idx on public.tasks(workspace_id, due_date) where deleted_at is null;
create index goals_workspace_target_idx on public.goals(workspace_id, target_date);
create index calendar_events_workspace_start_idx on public.calendar_events(workspace_id, start_at) where deleted_at is null;
create index calendar_events_task_id_idx on public.calendar_events(task_id);
create index time_sessions_task_id_idx on public.time_sessions(task_id, start_at);
create index attachments_workspace_entity_idx on public.attachments(workspace_id, entity_type, entity_id);
create index sync_mutations_workspace_sequence_idx on public.sync_mutations(workspace_id, sequence);
create index sync_mutations_entity_idx on public.sync_mutations(workspace_id, entity_type, entity_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy workspaces_select_owner on public.workspaces for select to authenticated
  using (owner_id = (select auth.uid()));
create policy workspaces_insert_owner on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy workspaces_update_owner on public.workspaces for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy workspace_members_select_owner on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())
  ));
create policy workspace_members_insert_owner on public.workspace_members for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'owner' and exists (
    select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())
  ));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'pages', 'page_versions', 'tasks', 'task_statuses', 'labels', 'projects', 'cycles', 'goals',
    'saved_task_views', 'automations', 'project_templates', 'calendar_events', 'habits',
    'time_sessions', 'attachments', 'device_subscriptions', 'sync_mutations'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())))', table_name || '_select_owner', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())))', table_name || '_insert_owner', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid()))) with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())))', table_name || '_update_owner', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update on public.%I to authenticated', table_name);
  end loop;
end $$;

revoke all on public.workspaces, public.workspace_members from anon;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert on public.workspace_members to authenticated;
grant usage, select on sequence public.sync_mutations_sequence_seq to authenticated;

insert into storage.buckets (id, name, public)
values ('planning-attachments', 'planning-attachments', false)
on conflict (id) do update set public = false;

create policy planning_attachments_select_owner on storage.objects for select to authenticated
using (
  bucket_id = 'planning-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.workspaces w
    where w.id = ((storage.foldername(name))[1])::uuid and w.owner_id = (select auth.uid())
  )
);
create policy planning_attachments_insert_owner on storage.objects for insert to authenticated
with check (
  bucket_id = 'planning-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.workspaces w
    where w.id = ((storage.foldername(name))[1])::uuid and w.owner_id = (select auth.uid())
  )
);
create policy planning_attachments_update_owner on storage.objects for update to authenticated
using (
  bucket_id = 'planning-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.workspaces w
    where w.id = ((storage.foldername(name))[1])::uuid and w.owner_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'planning-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.workspaces w
    where w.id = ((storage.foldername(name))[1])::uuid and w.owner_id = (select auth.uid())
  )
);
