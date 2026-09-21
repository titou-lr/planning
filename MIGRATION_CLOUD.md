# Plan de migration cloud et PWA

> Document directeur destiné aux agents IA et aux développeurs intervenant sur le projet.
>
> Statut : plan initial — aucune migration n'est autorisée sans respecter les jalons et critères de sortie décrits ci-dessous.

## 1. Décisions actées

- L'application reste personnelle : un compte utilise ses propres espaces, sans collaboration simultanée entre plusieurs personnes.
- Plusieurs appareils peuvent utiliser le même compte et doivent retrouver les mêmes données.
- Une utilisation hors ligne complète est souhaitée. Une écriture ne doit jamais attendre le réseau pour apparaître à l'écran.
- Aucun chiffrement de bout en bout n'est requis. Le chiffrement standard en transit et au repos fourni par les plateformes suffit.
- La cible principale est une PWA installable sur téléphone et ordinateur.
- L'exécutable Electron reste disponible pendant la migration et n'est retiré qu'après parité fonctionnelle validée.
- La logique métier pure et ses tests existants doivent être conservés autant que possible.
- Le fournisseur IA cible devient OpenAI. Les appels IA doivent passer côté serveur ; aucune clé secrète ne doit être incluse dans le client web.

## 2. Objectifs non fonctionnels

La priorité est la perception de vitesse, puis la fiabilité des données.

### Budgets de performance

- Une mutation locale doit être visible en moins de 100 ms.
- La saisie dans un éditeur ne doit jamais dépendre d'un aller-retour réseau.
- Après installation et première synchronisation, l'application doit afficher un écran utilisable en moins de 1,5 seconde sur un téléphone de milieu de gamme récent.
- Les changements doivent être durables localement avant d'être annoncés comme enregistrés.
- Le chargement initial ne doit pas télécharger les modules lourds non utilisés, notamment rapports, XLSX et assistant IA.
- Le volume de données synchronisé doit être incrémental ; ne jamais renvoyer tout le workspace après chaque modification.

### Garanties de données

- Aucune perte silencieuse en cas de fermeture forcée, coupure réseau, répétition d'une requête ou conflit entre deux appareils.
- Toute migration destructive doit être précédée d'un export portable validé.
- Les suppressions distantes passent par des tombstones avant purge définitive.
- Une opération de synchronisation répétée doit être idempotente.
- Le temps du serveur fait autorité pour l'ordre des changements distants.

## 3. État initial à préserver

L'application utilise actuellement :

- React 19, TypeScript strict, Vite, Tailwind v4 et Zustand ;
- un `WorkspaceData` global contenant notes, tâches, projets, calendriers, habitudes et historique ;
- Zustand `persist` avec une clé par profil ;
- `localStorage` via `@jarvis/data-layer` en mode autonome ;
- une sauvegarde globale JSON déjà importable et exportable ;
- Electron comme enveloppe minimale du renderer web ;
- des appels Anthropic directs depuis le renderer ;
- des images et pièces jointes sous forme de data URLs ;
- 163 tests unitaires actuellement réussis.

Le principal passif architectural est la persistance de l'espace entier dans un seul objet JSON. Ce modèle ne doit pas être synchronisé tel quel entre appareils.

## 4. Stack cible

| Domaine | Choix cible | Rôle |
| --- | --- | --- |
| UI | React 19 + TypeScript + Vite | Conserver le maximum de code existant |
| PWA | `vite-plugin-pwa` + Workbox | Manifest, cache de l'app shell, installation et mises à jour |
| État UI | Zustand | Navigation, sélection, modales, brouillons éphémères |
| Base locale | IndexedDB avec Dexie | Source de lecture/écriture immédiate sur l'appareil |
| Backend | Supabase Postgres | Source durable distante et synchronisation multi-appareils |
| Identité | Supabase Auth | Compte personnel et sessions |
| Fichiers | Supabase Storage | Images et pièces jointes |
| Fonctions serveur | Supabase Edge Functions | OpenAI, Web Push et opérations privilégiées |
| Temps réel | Supabase Realtime | Signal qu'un changement distant est disponible |
| Hébergement web | Vercel | CDN, HTTPS, previews et production |
| IA | SDK OpenAI + Responses API | Chat, résumés et propositions structurées |
| E2E | Playwright | Parcours desktop, mobile, offline et migration |

### Choix explicitement différés

- Pas de Next.js : aucun besoin SSR ne justifie de réécrire l'application.
- Pas de CRDT/Yjs tant qu'il n'existe pas d'édition collaborative simultanée.
- Pas de PowerSync au premier passage. Le réévaluer seulement si le moteur de synchronisation devient trop complexe ou si la collaboration entre utilisateurs entre dans le périmètre.
- Pas d'Obsidian comme infrastructure. Obsidian reste éventuellement une inspiration ou un format d'import/export Markdown.

## 5. Architecture cible

```text
Composants React
      │
      ▼
Services / repositories métier
      │
      ▼
IndexedDB / Dexie ─────► requêtes et mutations instantanées
      │
      ├── table outbox
      ├── curseur de synchronisation
      └── cache des blobs
      │
      ▼
Moteur de synchronisation
      │
      ├── push idempotent des mutations
      ├── pull incrémental depuis le dernier curseur
      └── reprise sur launch / focus / online / timer
      │
      ▼
Supabase
      ├── Auth
      ├── Postgres + RLS
      ├── Storage
      ├── Realtime comme signal de réveil
      └── Edge Functions : OpenAI et notifications
```

Le réseau ne fait jamais partie du chemin critique d'une interaction utilisateur. Realtime n'est pas une source de vérité : après un signal, le client effectue toujours un pull fiable par curseur.

## 6. Modèle de données distant proposé

Créer au minimum les tables suivantes :

- `workspaces`
- `workspace_members`
- `pages`
- `page_versions`
- `tasks`
- `task_statuses`
- `labels`
- `projects`
- `cycles`
- `goals`
- `saved_task_views`
- `automations`
- `project_templates`
- `calendar_events`
- `habits`
- `time_sessions`
- `attachments`
- `device_subscriptions`
- `sync_mutations` ou journal équivalent si requis par le protocole retenu

Même pour une application personnelle, `workspace_members` est conservée afin de séparer proprement identité et espace de données. La première politique n'autorise qu'un propriétaire.

Champs communs aux entités synchronisées :

```text
id uuid primary key
workspace_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null
revision bigint not null
deleted_at timestamptz null
```

Principes :

- Conserver en colonnes les champs filtrés ou triés fréquemment.
- Conserver en `jsonb` les structures internes cohérentes modifiées ensemble : blocs d'une page, checklist, définition d'une vue ou règle d'automatisation.
- Utiliser des UUID déjà générés côté client lorsque c'est possible.
- Indexer `workspace_id`, `updated_at`, les dates d'échéance, statuts, parents et relations fréquemment consultées.
- Ne jamais stocker un fichier ou une data URL dans Postgres. `attachments` contient uniquement les métadonnées et le chemin Storage.

Toutes les tables exposées doivent avoir RLS activée, des grants minimaux et des politiques par `workspace_id`. La clé `service_role` ne doit jamais être envoyée au navigateur.

## 7. Protocole de synchronisation minimal

### Écriture locale

1. Ouvrir une transaction Dexie.
2. Modifier l'entité locale.
3. Ajouter une mutation à l'outbox dans la même transaction.
4. Mettre à jour immédiatement l'UI.
5. Déclencher un push opportuniste sans bloquer l'utilisateur.

Une mutation contient au minimum :

```ts
interface PendingMutation {
  mutationId: string
  deviceId: string
  workspaceId: string
  entityType: string
  entityId: string
  operation: 'upsert' | 'delete'
  baseRevision: number | null
  payload: unknown
  createdAtLocal: string
  attempts: number
}
```

### Push

- Envoyer les mutations par petits lots.
- Utiliser `mutationId` comme clé d'idempotence.
- Appliquer le lot côté serveur dans une transaction ou une fonction RPC.
- Retourner pour chaque mutation la révision et le timestamp serveur.
- Ne supprimer l'entrée d'outbox qu'après accusé de réception durable.

### Pull

- Conserver un curseur serveur local par workspace.
- Récupérer les changements après ce curseur, avec pagination.
- Appliquer chaque page de changements dans une transaction Dexie.
- Avancer le curseur uniquement après validation de toute la transaction.
- Déclencher un pull au démarrage, au retour au premier plan, au retour en ligne, périodiquement pendant l'utilisation et après un signal Realtime.

### Conflits

Le périmètre personnel permet une stratégie simple par entité :

- accepter l'écriture si `baseRevision` correspond ;
- sinon comparer les versions et créer une copie de conflit récupérable pour les pages ou descriptions riches ;
- ne jamais écraser silencieusement un contenu riche divergent ;
- pour les champs simples, une stratégie last-write-wins basée sur l'horloge serveur est acceptable si elle est testée et documentée.

## 8. Migration Anthropic vers OpenAI

Le changement ne se limite pas à remplacer une clé. Le SDK, le format des requêtes, le traitement des sorties structurées, les erreurs et éventuellement la gestion de conversation diffèrent.

### Architecture requise

Créer une interface indépendante du fournisseur :

```ts
interface AiProvider {
  chat(input: ChatRequest): Promise<AiTextResult>
  summarize(input: SummaryRequest): Promise<AiTextResult>
  propose(input: ProposalRequest): Promise<AiProposalResult>
  semanticSearch(input: SearchRequest): Promise<AiSearchResult>
}
```

Règles :

- Les composants React ne connaissent ni OpenAI ni un nom de modèle.
- Les prompts, schémas structurés et validateurs restent dans une couche métier testable.
- Le modèle est défini par variable serveur, par exemple `OPENAI_MODEL`, jamais codé en dur dans l'UI.
- Les appels passent par une Edge Function authentifiée.
- La clé `OPENAI_API_KEY` est un secret de l'Edge Function, jamais une variable `VITE_*`.
- Utiliser le SDK OpenAI officiel et la Responses API.
- Utiliser des sorties structurées validées par schéma pour les propositions de tâches/événements/pages.
- Conserver le principe existant : l'IA propose, l'utilisateur confirme, puis la mutation métier normale s'exécute.
- Commencer avec `store: false` sauf décision explicite de conserver l'état chez le fournisseur.
- Ne pas envoyer le workspace entier : construire un contexte ciblé et plafonné.

### Stratégie de bascule

1. Extraire des jeux d'entrées/sorties de référence sans données personnelles.
2. Introduire `AiProvider` en conservant temporairement l'implémentation Anthropic.
3. Ajouter l'implémentation OpenAI côté serveur.
4. Comparer exactitude, JSON valide, latence, consommation et qualité des propositions.
5. Basculer par configuration.
6. Supprimer le SDK Anthropic et le stockage local de sa clé après validation.

Ne pas choisir définitivement un modèle par effet de mode. Tester au moins un modèle rapide/économique et un modèle plus capable sur les quatre usages actuels, puis documenter le compromis retenu.

## 9. Notifications PWA

La boucle locale actuelle ne peut notifier que lorsque l'application est ouverte. La cible doit distinguer :

- rappels en avant-plan : calcul local immédiat ;
- rappels lorsque l'application est fermée : Web Push côté serveur.

Étapes :

1. Enregistrer une souscription Push par appareil dans `device_subscriptions`.
2. Demander la permission uniquement après une action utilisateur explicite.
3. Utiliser Supabase Cron pour appeler périodiquement une Edge Function.
4. Calculer les rappels dus avec gestion explicite du fuseau horaire.
5. Dédupliquer côté serveur avec une clé stable.
6. Tester Chrome/Edge desktop, Android et iOS en PWA installée.

## 10. Phases de livraison

### Phase 0 — Baseline et garde-fous

- Ajouter des fixtures représentatives de `WorkspaceData`.
- Tester tous les formats d'import/export et données historiques.
- Ajouter Playwright sur les parcours critiques.
- Mesurer bundle, démarrage, saisie et gros volumes.
- Ajouter des tests de corruption, fermeture forcée et restauration.

Critère de sortie : comportement actuel reproductible et métriques enregistrées.

### Phase 1 — PWA locale, sans cloud

- Ajouter manifeste, icônes, service worker et écran de mise à jour.
- Adapter les vues au mobile et au tactile.
- Ajouter navigation URL et deep links.
- Découper le bundle avec `React.lazy`/imports dynamiques.
- Maintenir Electron et le navigateur avec le même code métier.

Critère de sortie : parité fonctionnelle locale desktop/mobile, tests offline réussis.

### Phase 2 — Repositories et IndexedDB

- Introduire les interfaces de repository.
- Installer Dexie et créer un schéma versionné.
- Migrer progressivement les familles d'entités.
- Sortir les données persistantes du store Zustand global.
- Migrer les data URLs vers des blobs locaux.
- Ajouter migration `localStorage → IndexedDB`, vérification et rollback.

Critère de sortie : l'application locale n'utilise plus le gros snapshot comme stockage primaire.

### Phase 3 — Supabase dev/staging

- Initialiser `supabase/` dans le dépôt.
- Écrire toutes les évolutions sous forme de migrations versionnées.
- Créer Auth, tables, index, RLS, Storage et données de test.
- Générer et versionner les types TypeScript Supabase.
- Tester les politiques RLS avec au moins deux utilisateurs factices.

Critère de sortie : environnement distant reproductible depuis le dépôt, sans configuration manuelle du Dashboard.

### Phase 4 — Synchronisation

- Implémenter outbox, push, pull, curseurs et tombstones.
- Ajouter signal Realtime.
- Ajouter indicateur discret `hors ligne / synchronisation / synchronisé / erreur`.
- Tester répétitions, changements simultanés, fermeture forcée et réseau instable.
- Vérifier les performances avec plusieurs milliers d'entités.

Critère de sortie : deux appareils convergent sans perte et restent pleinement utilisables hors ligne.

### Phase 5 — Fichiers, OpenAI et notifications

- Migrer pièces jointes vers Supabase Storage.
- Déployer l'Edge Function OpenAI et supprimer l'appel navigateur.
- Ajouter Web Push et planification serveur.
- Mettre en place quotas, taille maximale des requêtes et erreurs utilisateur.

Critère de sortie : aucun secret fournisseur dans le bundle et fonctions distantes testées.

### Phase 6 — Migration utilisateur et production

- Publier une dernière version Electron capable d'exporter une sauvegarde de migration.
- Déployer une bêta PWA.
- Importer, vérifier les comptes d'entités puis synchroniser.
- Conserver Electron et les exports de secours pendant une période de stabilisation.
- Basculer le domaine principal seulement après validation des sauvegardes et restaurations.

Critère de sortie : PWA installable, données restaurables, monitoring stable et aucune régression bloquante.

## 11. Accès des agents à GitHub, Supabase et Vercel

Cette section est un inventaire vivant. Tout agent qui constate un changement de connexion, de projet cible ou de niveau de permission doit la mettre à jour dans la même livraison.

### État vérifié des accès

Dernière vérification : **21 septembre 2026**.

| Service | Plugin | État vérifié | Ressources/capacités accessibles | Vérification requise avant écriture |
| --- | --- | --- | --- | --- |
| GitHub | Installé, activé et connecté | Compte `titou-lr`; accès confirmé au dépôt `titou-lr/planning` avec permissions admin, maintain, pull, push et triage | Lire/écrire le dépôt, branches, commits, fichiers, issues, pull requests, revues et workflows CI | Confirmer le dépôt, la branche et `git status`; ne jamais pousser directement sur `main` sans instruction explicite |
| Supabase | Installé, activé et connecté | Organisation `titou-lr` (`mjnthckdboenslxhqyyc`); projet `notion-like app` (`bmoxcrfvlwsjywtmkxvd`), région `eu-west-3`, réactivé et `ACTIVE_HEALTHY`; utilisé provisoirement comme développement | Projets, SQL/Postgres, schémas, migrations, Auth, Edge Functions, Storage, branches et logs | La migration Planning est validée en transaction avec rollback mais non appliquée tant que le sort des anciennes tables Prisma sans RLS n'est pas décidé |
| Vercel | Installé et activé, connexion sans ressource visible | Le connecteur répond mais ne retourne aucune équipe, donc aucun projet cible ne peut encore être identifié | Les capacités projet/déploiement sont chargées dans la session mais inutilisables sans équipe accessible | Connecter ou créer l'équipe Vercel, puis consigner `teamId` et `projectId` avant tout déploiement |
| OpenAI Developers | Installé, activé et connecté | Organisation personnelle `org-u6Nr29ExvpMRLFeeMmALbjyw`; projet cible `Default project` (`proj_Myw0uFiJ1mS90SOCfdEm5ecU`) | Création et enregistrement sécurisé d'une clé API pour les fonctions serveur | Ne créer la clé qu'à la phase OpenAI et la stocker comme secret d'Edge Function, jamais dans le client |

`Installé`, `connecté` et `disponible dans la session` sont trois états différents. Un agent ne doit jamais déduire l'accès effectif de la seule présence du plugin.

### Préflight obligatoire au début d'une phase cloud

Avant toute action distante, l'agent doit :

1. relire ce tableau et inscrire la date si un accès a changé ;
2. vérifier l'identité ou l'organisation active pour chaque service ;
3. effectuer une opération en lecture seule : dépôt GitHub, liste des projets Supabase, puis liste des projets Vercel ;
4. relever les identifiants exacts du dépôt, du projet Supabase, du projet Vercel et de l'équipe ;
5. distinguer explicitement les environnements développement, staging et production ;
6. interrompre l'action si une cible est ambiguë ;
7. ne jamais considérer une permission de lecture comme une permission d'écriture ;
8. noter dans le compte rendu les accès réellement utilisés et non les seuls accès théoriques.

### GitHub

Le dépôt distant de référence est `https://github.com/titou-lr/planning`, branche par défaut `main`.

Les agents peuvent actuellement inspecter et modifier le dépôt distant, créer des branches et pull requests, consulter ou relancer les workflows et intervenir sur les issues. Ces capacités n'autorisent pas implicitement :

- le push direct sur `main` ;
- la fusion d'une pull request ;
- la suppression de branches, tags, fichiers ou releases ;
- la modification des règles de branche ou des secrets Actions ;
- la publication d'une release.

Pour le développement normal : créer une branche dédiée, pousser des commits atomiques, laisser les contrôles CI s'exécuter et utiliser une pull request. Le dépôt local reste la source de travail ; le plugin GitHub sert aux opérations distantes et à la CI.

### Option recommandée : connecteurs OAuth

Les plugins GitHub, Supabase et Vercel sont installés. Après une connexion OAuth initiale effectuée par le propriétaire du compte, Codex peut utiliser les opérations autorisées sans demander un jeton à chaque intervention. Une nouvelle conversation peut être nécessaire pour charger les outils ajoutés après le début d'une session.

Procédure :

1. Installer/connecter GitHub, Supabase et Vercel depuis les intégrations proposées dans l'interface Codex.
2. S'authentifier sur le bon compte et la bonne organisation.
3. Limiter les autorisations et projets au strict nécessaire lorsque le fournisseur le permet.
4. Vérifier dans une nouvelle session que Codex voit le projet de développement avant toute mutation.
5. Commencer sur un projet Supabase de développement et un projet Vercel de preview.
6. N'autoriser les opérations de production qu'après validation du pipeline staging.

L'autorisation OAuth initiale, l'ouverture de compte, la facturation et certaines validations de domaine restent nécessairement des actions humaines. Le travail quotidien peut ensuite être automatisé.

### Option alternative : CLI et jetons

Si les connecteurs ne sont pas utilisés :

#### Supabase

- Créer un Personal Access Token dans les paramètres du compte Supabase.
- Le placer dans le gestionnaire de secrets de l'environnement sous `SUPABASE_ACCESS_TOKEN`.
- Ne jamais écrire sa valeur dans le dépôt, un prompt, `.env.example` ou une issue.
- Lier le dépôt au projet avec `supabase link --project-ref <PROJECT_REF>`.
- Versionner `supabase/config.toml`, `supabase/migrations/` et les fonctions ; ne pas versionner les caches et secrets.
- Utiliser `supabase db push --dry-run` avant chaque application distante.

#### Vercel

- Créer un token d'accès Vercel réservé à l'automatisation.
- Le stocker comme secret `VERCEL_TOKEN` dans l'environnement d'exécution de l'agent/CI.
- Définir `VERCEL_ORG_ID` et `VERCEL_PROJECT_ID` pour les commandes non interactives.
- Stocker les secrets applicatifs dans les variables Vercel/Supabase, jamais dans Git.
- Utiliser les previews avant `vercel --prod`.

#### GitHub

- Préférer le plugin OAuth déjà connecté pour les opérations interactives.
- Pour la CI, utiliser `GITHUB_TOKEN` fourni automatiquement par GitHub Actions et limiter les `permissions:` du workflow au strict nécessaire.
- Ne jamais créer de Personal Access Token GitHub tant que le plugin ou `GITHUB_TOKEN` couvre le besoin.
- Protéger `main` et exiger les contrôles de build/test avant fusion lorsque le pipeline sera en place.

### Plugins complémentaires

#### Recommandé : OpenAI Developers

À installer avant la phase OpenAI. Il permet à l'agent de travailler avec les API OpenAI et de créer/enregistrer une clé API par le flux prévu, plutôt que de demander qu'une clé soit copiée dans une conversation. La clé finale doit être stockée comme secret de l'Edge Function Supabase et ne jamais être exposée au client Vite.

#### Optionnel pour la production : Resend

Utile si Supabase Auth doit envoyer des e-mails de connexion, confirmation ou récupération de mot de passe avec une délivrabilité et des modèles maîtrisés. Ne pas l'installer tant que le flux d'authentification retenu ne nécessite pas d'e-mail transactionnel personnalisé.

#### Déjà couvert, aucun plugin supplémentaire requis

- Tests navigateur/PWA : les outils navigateur fournis avec l'environnement Vercel et Playwright dans le dépôt suffisent.
- Observabilité initiale : logs Supabase et Vercel suffisent pour le MVP.
- Gestion de projet : GitHub Issues/Projects suffit tant qu'aucun besoin Linear n'est exprimé.
- Design : le design system existe déjà ; Figma n'est utile que si une phase de conception visuelle collaborative est décidée.
- Analytics produit : Amplitude ou un équivalent serait prématuré pour une application personnelle.
- Datadog : disproportionné pour le MVP ; réévaluer uniquement si les outils natifs ne suffisent plus.
- Hébergement alternatif (Railway, Replit, Webflow) : inutile avec Supabase et Vercel déjà retenus.

### Règles de sécurité pour les agents

- Ne jamais afficher, journaliser ou committer un token.
- Préférer OAuth aux tokens longs quand disponible.
- Utiliser des comptes/projets dev distincts de la production.
- Vérifier la cible avant toute migration ou commande destructive.
- Les commandes détruisant/réinitialisant une base distante sont interdites en production.
- Les migrations de production doivent être versionnées, relues, testées localement et appliquées sans réécriture de l'historique.
- Faire tourner/retirer immédiatement un jeton suspecté d'avoir été exposé.
- Mettre à jour le tableau « État vérifié des accès » après installation, révocation, changement d'organisation ou changement de projet.

## 12. CI/CD souhaitée

Sur chaque pull request :

1. installation verrouillée des dépendances ;
2. TypeScript ;
3. tests Vitest ;
4. tests de migrations Supabase sur base locale ;
5. tests RLS ;
6. build PWA ;
7. Playwright desktop et viewport mobile ;
8. contrôle du budget de bundle ;
9. preview Vercel.

Sur la branche principale :

1. appliquer les migrations validées vers staging ;
2. déployer les Edge Functions ;
3. exécuter les smoke tests ;
4. déployer la PWA ;
5. promouvoir en production seulement si les contrôles passent.

Prévoir au départ une étape d'approbation avant la production. Une chaîne totalement automatique n'est raisonnable qu'après plusieurs migrations réussies et une restauration testée.

## 13. Consignes obligatoires pour les agents IA

Avant chaque phase :

- lire ce document, `README.md`, `CLAUDE.md` et les migrations existantes ;
- vérifier `git status` et ne jamais écraser des modifications utilisateur ;
- annoncer précisément la phase et le critère de sortie visé ;
- maintenir l'ancien chemin fonctionnel derrière une abstraction ou un flag jusqu'à validation ;
- ajouter les tests avant ou avec la migration ;
- mesurer les performances avant et après ;
- documenter les décisions irréversibles dans un ADR ;
- ne pas changer simultanément UI, modèle métier et persistance pour une même fonctionnalité ;
- ne jamais effectuer une migration distante destructive sans cible vérifiée et sauvegarde restaurable.

Chaque livraison doit indiquer :

- fichiers et migrations modifiés ;
- commandes de validation exécutées ;
- résultats des tests et mesures ;
- stratégie de rollback ;
- limites restantes et phase suivante.

## 14. Registre initial des risques

| Risque | Réduction prévue |
| --- | --- |
| Écrasement entre appareils | Révisions, outbox, idempotence, copies de conflit |
| Régression métier | Conservation des moteurs purs et tests de caractérisation |
| Lenteur mobile | IndexedDB locale, code splitting, budgets de bundle |
| Perte pendant migration | Export préalable, comparaison des comptes, rollback |
| Fuite de clé IA | Edge Function et secret serveur uniquement |
| RLS incorrecte | Tests avec deux identités et grants minimaux |
| Service worker périmé | Mise à jour avec prompt et version de schéma compatible |
| Pièces jointes volumineuses | Blob local + Storage, limites et reprise d'upload |
| Notifications manquées | Web Push serveur, déduplication et fuseaux horaires |
| Dépendance fournisseur | Repositories, `AiProvider`, migrations SQL et exports portables |

## 15. Définition de terminé globale

La migration est considérée terminée lorsque :

- la PWA est installable et adaptée au téléphone comme au PC ;
- toutes les fonctions actuelles disposent d'une parité validée ;
- les écritures sont instantanées et fonctionnent hors ligne ;
- deux appareils convergent après reconnexion sans perte silencieuse ;
- les données existantes peuvent être importées depuis une sauvegarde Electron ;
- les pièces jointes sont stockées hors du JSON métier ;
- aucune clé OpenAI ou privilégiée n'est présente dans le client ;
- RLS empêche tout compte de lire un autre workspace ;
- les tests unitaires, E2E, offline, migration et restauration passent ;
- les budgets de performance sont respectés ;
- un rollback documenté et une restauration complète ont été testés ;
- Electron peut être retiré sans priver l'utilisateur d'une fonction ou de ses données.

## 16. Références techniques

- Supabase RLS : https://supabase.com/docs/guides/database/postgres/row-level-security
- Workflow et migrations Supabase : https://supabase.com/docs/guides/local-development/cli-workflows
- CLI Supabase et tokens : https://supabase.com/docs/reference/cli/su
- Vite sur Vercel : https://vercel.com/docs/frameworks/frontend/vite
- CLI Vercel : https://vercel.com/docs/cli
- Vite PWA : https://vite-pwa-org.netlify.app/guide/
- Dexie : https://dexie.org/docs/Dexie.js
- OpenAI Responses API : https://developers.openai.com/api/docs/guides/migrate-to-responses
- Configuration MCP de Codex : https://learn.chatgpt.com/docs/extend/mcp
