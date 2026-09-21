# Livraison de la migration cloud

Date : 21 septembre 2026.

## Architecture livrée

- PWA installable, shell hors ligne et interface responsive desktop/mobile.
- IndexedDB/Dexie comme stockage primaire, avec migration automatique de l'ancien snapshot local.
- Persistance locale et outbox atomiques : une écriture n'attend jamais le réseau.
- Auth Supabase sans mot de passe, espace personnel créé au premier login.
- Push/pull incrémental par journal append-only, curseur serveur, idempotence par `mutation_id`, tombstones et signal Realtime.
- Pièces jointes et images envoyées dans le bucket privé `planning-attachments`; seuls leurs chemins sont envoyés à Postgres.
- Indicateurs `hors ligne`, `synchronisation`, `synchronisé` et `erreur` dans l'interface.

## Base distante

Les 19 tables Planning sont dans `public`, avec RLS et grants minimaux. La structure des sept tables de l'ancien projet Prisma et de leurs deux enums est sauvegardée dans `legacy-prisma-schema.sql`; leur schéma distant, qui contenait 45 lignes abandonnées, a été supprimé. Voir `legacy-prisma-archive.md`.

Le client utilise uniquement la clé publiable Supabase. Aucun secret privilégié n'est présent dans le bundle.

## Validation exécutée

- 180 tests Vitest réussis.
- 8 assertions pgTAP réussies avec deux identités distinctes.
- Build TypeScript/Vite/PWA réussi; bundle initial environ 408 kB brut (130 kB gzip).
- 9 scénarios Playwright réussis sur Chromium desktop et mobile; 3 contrôles PWA sont volontairement limités au projet desktop.
- Test cloud de production réussi avec deux contextes navigateur indépendants : une page créée sur le premier a convergé sur le second; le compte et toutes les données temporaires ont ensuite été supprimés.
- Vérification des advisors Supabase : aucune table exposée sans RLS. L'option de protection contre les mots de passe compromis reste signalée, sans impact sur le flux passwordless retenu.

## Rollback

- Les données locales restent exportables/importables en JSON et IndexedDB demeure la source immédiate.
- Une déconnexion Supabase laisse l'application exploitable localement.
- La structure vide de l'ancien schéma Prisma est recréable avec `legacy-prisma-schema.sql`; les anciennes données abandonnées ont été supprimées avec l'autorisation du propriétaire.
- Les migrations SQL sont versionnées et ne doivent pas être réécrites.

## Hors périmètre de cette livraison

La migration Anthropic vers OpenAI et les notifications Web Push sont les deux chantiers suivants. Les avertissements Vite liés au SDK Anthropic disparaîtront lorsque ce SDK sera retiré du navigateur.
