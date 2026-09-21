-- Sauvegarde de structure du schéma Prisma historique.
-- Générée et vérifiée avant sa suppression définitive le 21 septembre 2026.
-- Cette sauvegarde ne contient aucune donnée.

create schema if not exists legacy_prisma_restore;
revoke all on schema legacy_prisma_restore from public, anon, authenticated;

create type legacy_prisma_restore."BlockType" as enum (
  'TEXT', 'HEADING_1', 'HEADING_2', 'HEADING_3', 'BULLET_LIST',
  'NUMBERED_LIST', 'CODE', 'IMAGE', 'DIVIDER', 'QUOTE', 'TODO'
);
create type legacy_prisma_restore."Priority" as enum ('LOW', 'NORMAL', 'HIGH');

create table legacy_prisma_restore."User" (
  id text not null,
  email text not null,
  name text,
  "createdAt" timestamp(3) without time zone not null default current_timestamp,
  constraint "User_pkey" primary key (id)
);
create unique index "User_email_key" on legacy_prisma_restore."User" (email);

create table legacy_prisma_restore."Page" (
  id text not null,
  title text not null default 'Untitled',
  icon text,
  "userId" text not null,
  "parentId" text,
  "isDeleted" boolean not null default false,
  "createdAt" timestamp(3) without time zone not null default current_timestamp,
  "updatedAt" timestamp(3) without time zone not null,
  constraint "Page_pkey" primary key (id),
  constraint "Page_userId_fkey" foreign key ("userId") references legacy_prisma_restore."User" (id) on update cascade on delete restrict,
  constraint "Page_parentId_fkey" foreign key ("parentId") references legacy_prisma_restore."Page" (id) on update cascade on delete set null
);

create table legacy_prisma_restore."Block" (
  id text not null,
  "pageId" text not null,
  type legacy_prisma_restore."BlockType" not null,
  content jsonb not null,
  "order" integer not null,
  "createdAt" timestamp(3) without time zone not null default current_timestamp,
  "updatedAt" timestamp(3) without time zone not null,
  constraint "Block_pkey" primary key (id),
  constraint "Block_pageId_fkey" foreign key ("pageId") references legacy_prisma_restore."Page" (id) on update cascade on delete cascade
);

create table legacy_prisma_restore."ReminderList" (
  id text not null,
  name text not null,
  color text,
  "userId" text not null,
  "createdAt" timestamp(3) without time zone not null default current_timestamp,
  constraint "ReminderList_pkey" primary key (id),
  constraint "ReminderList_userId_fkey" foreign key ("userId") references legacy_prisma_restore."User" (id) on update cascade on delete restrict
);

create table legacy_prisma_restore."Reminder" (
  id text not null,
  title text not null,
  description text,
  "dueAt" timestamp(3) without time zone,
  priority legacy_prisma_restore."Priority" not null default 'NORMAL',
  "isDone" boolean not null default false,
  "isDeleted" boolean not null default false,
  "userId" text not null,
  "listId" text,
  "createdAt" timestamp(3) without time zone not null default current_timestamp,
  "updatedAt" timestamp(3) without time zone not null,
  constraint "Reminder_pkey" primary key (id),
  constraint "Reminder_userId_fkey" foreign key ("userId") references legacy_prisma_restore."User" (id) on update cascade on delete restrict,
  constraint "Reminder_listId_fkey" foreign key ("listId") references legacy_prisma_restore."ReminderList" (id) on update cascade on delete set null
);

create table legacy_prisma_restore."Event" (
  id text not null,
  title text not null,
  description text,
  "startAt" timestamp(3) without time zone not null,
  "endAt" timestamp(3) without time zone not null,
  color text,
  category text,
  "isRecurring" boolean not null default false,
  recurrence text,
  "sourceLabel" text,
  "userId" text not null,
  "createdAt" timestamp(3) without time zone not null default current_timestamp,
  "updatedAt" timestamp(3) without time zone not null,
  constraint "Event_pkey" primary key (id),
  constraint "Event_userId_fkey" foreign key ("userId") references legacy_prisma_restore."User" (id) on update cascade on delete restrict
);

create table legacy_prisma_restore._prisma_migrations (
  id varchar(36) not null,
  checksum varchar(64) not null,
  finished_at timestamptz,
  migration_name varchar(255) not null,
  logs text,
  rolled_back_at timestamptz,
  started_at timestamptz not null default now(),
  applied_steps_count integer not null default 0,
  constraint _prisma_migrations_pkey primary key (id)
);
