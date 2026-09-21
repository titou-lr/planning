# Archive Prisma historique

Date d'archivage : 21 septembre 2026.

Le schéma abandonné a été retiré de `public` sans perte en déplaçant ses objets vers le schéma privé `legacy_backup_20260921`. Ce schéma n'est pas exposé par la Data API et les rôles `public`, `anon` et `authenticated` n'y ont aucun droit.

## Inventaire vérifié avant archivage

| Table | Lignes |
| --- | ---: |
| `_prisma_migrations` | 3 |
| `User` | 2 |
| `Page` | 10 |
| `Block` | 24 |
| `ReminderList` | 1 |
| `Reminder` | 3 |
| `Event` | 2 |

Les types `BlockType` et `Priority`, les clés primaires, la contrainte unique sur `User.email`, les clés étrangères, les index et toutes les lignes ont été conservés par `ALTER ... SET SCHEMA`.

## Restauration d'urgence

La restauration doit être effectuée dans une transaction et seulement si aucun objet du même nom n'existe dans `public` :

```sql
begin;
alter type legacy_backup_20260921."BlockType" set schema public;
alter type legacy_backup_20260921."Priority" set schema public;
alter table legacy_backup_20260921."User" set schema public;
alter table legacy_backup_20260921."Page" set schema public;
alter table legacy_backup_20260921."Block" set schema public;
alter table legacy_backup_20260921."ReminderList" set schema public;
alter table legacy_backup_20260921."Reminder" set schema public;
alter table legacy_backup_20260921."Event" set schema public;
alter table legacy_backup_20260921._prisma_migrations set schema public;
commit;
```

Ne pas restaurer ces tables dans un schéma exposé sans activer RLS et définir des politiques adaptées à l'ancien modèle.
