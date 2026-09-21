# Phases 1–2 — PWA locale et IndexedDB

Date de validation : 21 septembre 2026.

## Résultat

- Manifeste PWA, icône vectorielle, service worker Workbox et écran de mise à jour.
- App shell disponible hors ligne après la première visite.
- Routes stables par hash pour les modules et les pages, compatibles avec l'hébergement statique et Electron.
- Chargement différé des vues lourdes : rapports, bases, calendrier, assistant et réglages.
- Base Dexie versionnée, séparée par profil, avec tables par famille d'entités.
- Tables locales réservées à l'outbox, aux curseurs de synchronisation et aux blobs.
- Migration automatique du snapshot Zustand vers IndexedDB.
- Copie de secours de l'ancien snapshot sous la clé `<store>-migration-backup-v1` avant bascule.
- Après validation IndexedDB, `localStorage` ne conserve plus que l'état UI léger.

## Mesures

| Mesure | Phase 0 | Phases 1–2 |
| --- | ---: | ---: |
| JavaScript initial minifié | 1 356,60 kB | 403,43 kB |
| JavaScript initial gzip | 408,38 kB | 127,96 kB |
| Tests unitaires | 170 | 174 |
| Tests E2E réussis | 6 | 9, plus 3 contrôles PWA mobiles volontairement ignorés |

Le plus gros volume différé est la vue Rapports (408,77 kB minifiés), qui n'est plus téléchargée au démarrage. Le SDK Anthropic demeure dans le chunk Assistant différé en attendant son remplacement par l'Edge Function OpenAI.

## Rollback

L'ancien snapshot est conservé avant migration. Un rollback consiste à restaurer sa valeur vers la clé Zustand d'origine, réactiver la persistance de `data` dans le store et ignorer/supprimer la base IndexedDB du profil. Aucun format distant n'est encore impliqué.

## Étape suivante

Créer les migrations Supabase versionnées, tester RLS avec deux identités et générer les types TypeScript avant d'activer la synchronisation.
