# Phase 3 — Fondation Supabase

Date de préparation : 21 septembre 2026.

## Cible de développement

- Organisation : `titou-lr` (`mjnthckdboenslxhqyyc`).
- Projet provisoire de développement : `notion-like app` (`bmoxcrfvlwsjywtmkxvd`).
- Région : `eu-west-3`.
- État après reprise : `ACTIVE_HEALTHY`.

Le projet a été réveillé sans suppression de données. La migration Planning complète a été exécutée dans une transaction distante immédiatement annulée. La syntaxe, les tables, contraintes, indexes, triggers, politiques RLS, bucket Storage et tests d'isolation passent sans laisser d'objet créé.

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

- Migration SQL : validée avec `BEGIN … ROLLBACK` sur Postgres 17 distant.
- RLS : propriétaire autorisé, second utilisateur isolé dans les tests pgTAP.
- Application persistante distante : non exécutée.
- Tests locaux Supabase : non exécutables sur ce poste faute de runtime Docker.
- Génération des types : reportée après application effective de la migration.

## Vercel

Le plugin est activé, mais aucune équipe n'est visible et le CLI réclame une nouvelle authentification. Aucun projet Vercel n'a été créé ou lié. Une connexion `vercel login` ou un jeton `VERCEL_TOKEN` est nécessaire avant le bootstrap preview.
