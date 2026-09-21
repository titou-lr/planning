-- Archive the abandoned Prisma application outside the exposed Data API schema.
-- ALTER ... SET SCHEMA preserves rows, columns, indexes and foreign keys, making
-- this operation reversible while removing the unprotected tables from public.
create schema if not exists legacy_backup_20260921;

revoke all on schema legacy_backup_20260921 from public, anon, authenticated;

alter table public."Block" set schema legacy_backup_20260921;
alter table public."Page" set schema legacy_backup_20260921;
alter table public."Reminder" set schema legacy_backup_20260921;
alter table public."ReminderList" set schema legacy_backup_20260921;
alter table public."Event" set schema legacy_backup_20260921;
alter table public."User" set schema legacy_backup_20260921;
alter table public._prisma_migrations set schema legacy_backup_20260921;

alter type public."BlockType" set schema legacy_backup_20260921;
alter type public."Priority" set schema legacy_backup_20260921;

revoke all on all tables in schema legacy_backup_20260921 from public, anon, authenticated;
alter default privileges in schema legacy_backup_20260921 revoke all on tables from public, anon, authenticated;
