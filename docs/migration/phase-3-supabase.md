# Phase 3 — Fondation Supabase

Date de préparation : 21 septembre 2026.

## Cible de développement

- Organisation : `titou-lr` (`mjnthckdboenslxhqyyc`).
- Projet provisoire de développement : `notion-like app` (`bmoxcrfvlwsjywtmkxvd`).
- Région : `eu-west-3`.
- État après reprise : `ACTIVE_HEALTHY`.

Le projet a été réveillé sans suppression de données. Après une validation complète dans une transaction annulée, la migration Planning a été appliquée le 21 septembre 2026 sous le nom distant `initial_cloud_schema` (version `20260921121130`).

## Schéma préparé

La migration versionnée crée les tables prévues par `MIGRATION_CLOUD.md`, des timestamps serveur, des révisions, des tombstones, les indexes de clés étrangères et de pull incrémental, ainsi que les tables `sync_mutations`, `device_subscriptions` et les métadonnées Storage.

Toutes les nouvelles tables exposées ont RLS activée dès leur création. Les rôles `anon` n'ont aucun droit ; `authenticated` reçoit uniquement `select`, `insert` et `update`. Aucun `delete` client n'est accordé afin de préserver les tombstones.

## Alerte sur le schéma historique

Le projet contient sept anciennes tables Prisma vides : `_prisma_migrations`, `User`, `Page`, `Block`, `ReminderList`, `Reminder` et `Event`. RLS y est désactivée et Supabase les signale comme publiquement exposées aux rôles Data API.

Conformément à l'avis de sécurité Supabase, cette correction n'est pas appliquée automatiquement, car activer RLS sans politiques bloquerait les éventuels anciens clients. Le SQL minimal proposé est :

```sql
alter table public._prisma_migrations enable row level security;
alter table public."User" enable row level security;
alter table public."Page" enable row level security;
alter table public."Block" enable row level security;
alter table public."ReminderList" enable row level security;
alter table public."Reminder" enable row level security;
alter table public."Event" enable row level security;
```

La décision restante est soit de conserver ces tables et définir leurs politiques, soit de les sauvegarder puis les supprimer puisqu'elles sont actuellement vides.

## Validation et limites

- Migration SQL : appliquée sur Postgres 17 distant.
- RLS : propriétaire autorisé, second utilisateur isolé dans les tests pgTAP rejoués après application ; les données de test et l'extension pgTAP temporaire ont été annulées par transaction.
- Tests locaux Supabase : non exécutables sur ce poste faute de runtime Docker.
- Types TypeScript : générés depuis le schéma distant dans `src/data/supabase.types.ts`.

## Vercel

La CLI est authentifiée sous `titou-lr`. Le projet `planning` a été créé dans l'équipe `titou-lrs-projects`, relié au dépôt GitHub et déployé sur `https://planning-bay-six.vercel.app`. Les scénarios Playwright distants valident desktop, mobile, manifeste, service worker, IndexedDB et mode hors ligne.
