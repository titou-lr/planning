# Phase 0 — Baseline et garde-fous

Date de référence : 21 septembre 2026.

## Objectif et critère de sortie

Cette étape fige le comportement local avant toute modification PWA, IndexedDB ou cloud. Elle est terminée lorsque les sauvegardes représentatives et historiques sont testées, que les parcours critiques passent sur desktop et mobile, et que les métriques initiales sont consignées.

## Contrôles couverts

- Fixture couvrant notes, versions, tâches, projets, cycles, objectifs, vues, automatisations, calendrier, habitudes, suivi du temps et pièces jointes en data URL.
- Aller-retour export/import JSON, compatibilité d'une sauvegarde partielle historique et refus silencieux de contenus corrompus.
- Restauration d'un volume de 5 000 pages et 5 000 tâches.
- Parcours Playwright desktop et mobile : création de profil, ouverture du workspace, persistance après rechargement et après fermeture forcée de la page.

## Baseline initiale

| Mesure | Valeur |
| --- | ---: |
| Tests unitaires avant phase 0 | 163 réussis / 163 |
| Tests unitaires après ajout des garde-fous | 170 réussis / 170 |
| Tests E2E Chromium | 6 réussis / 6 (desktop et mobile) |
| Build production | réussi |
| JavaScript initial minifié | 1 356,60 kB |
| JavaScript initial gzip | 408,38 kB |
| CSS initial minifié | 74,62 kB |
| CSS initial gzip | 35,31 kB |

Le build signale que le chunk principal dépasse 500 kB et que le SDK Anthropic importe des modules Node externalisés pour le navigateur. Ces deux observations sont des dettes connues : le découpage du bundle relève de l'étape PWA locale et la suppression de l'appel Anthropic côté client relève de l'étape services distants.

Vérification visuelle complémentaire : la page de sélection de profil charge du contenu utile, aucun overlay d'erreur Vite n'est présent et la vue mobile compacte est rendue sans écran blanc.

Comportement historique figé : après fermeture complète d'une page navigateur, les données et profils restent dans `localStorage`, mais le profil actif stocké dans `sessionStorage` doit être resélectionné avant de rouvrir le workspace.

## Rollback

La phase n'altère ni le format de stockage ni les données utilisateur. Le rollback consiste à retirer les fixtures, la configuration Playwright et les tests associés. L'application reste sur `localStorage` et Electron demeure inchangé.

## Étape suivante

PWA locale et découpage du bundle, sans activation du cloud ni modification du stockage primaire.
