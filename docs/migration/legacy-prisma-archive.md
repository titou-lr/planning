# Suppression du schéma Prisma historique

Date d'archivage : 21 septembre 2026.

Le schéma abandonné a d'abord été retiré de `public` et isolé dans `legacy_backup_20260921`. Sa structure complète a ensuite été exportée dans `legacy-prisma-schema.sql`, testée dans une transaction, puis le schéma distant et ses données ont été supprimés conformément à l'autorisation du propriétaire.

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

La sauvegarde de structure conserve les types `BlockType` et `Priority`, toutes les colonnes et valeurs par défaut, les clés primaires, la contrainte unique sur `User.email` et les clés étrangères. Les données abandonnées ne sont pas incluses dans cette sauvegarde.

## Restauration de la structure

Exécuter `legacy-prisma-schema.sql`. Le script recrée un schéma privé `legacy_prisma_restore` vide, sans l'exposer à la Data API et sans accorder de droits à `anon` ou `authenticated`.

Ne pas déplacer ces tables vers un schéma exposé sans activer RLS et définir des politiques adaptées à l'ancien modèle.
