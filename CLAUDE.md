# CLAUDE.md — Suite de Productivité Locale (nom de projet à définir)

## Vision

Une application Windows **100 % locale** réunissant les usages de Notion (notes, bases de données), Linear (tâches, projets, tickets), et d'un calendrier de planification perso/pro (type Sunsama/Motion), avec un **assistant IA intégré** qui agit dans l'app sur confirmation explicite. Aucune de ses fonctions ne dépend d'un serveur qui t'appartiendrait : l'utilisateur possède ses données, l'app fonctionne hors-ligne, et rien n'est perdu si aucun compte n'est créé.

Deux références de conception s'appliquent à ce projet et priment sur toute réinterprétation :
- **Stack technique** : celle de l'app "Patrimoine Manager" (`CLAUDE.md` de référence), pour tout ce qui est compatible avec ce nouveau domaine.
- **Design visuel** : le fichier `DESIGN.md` ("Linear-inspired Dark") de Patrimoine Manager, repris **à l'identique**, à l'exception de la couleur d'accent — voir section 3.

Ce document décrit **quoi construire et pourquoi**, ainsi que les limites non négociables. Il ne prescrit **pas** l'architecture de fichiers ni les détails d'implémentation interne — ces décisions relèvent du jugement de l'agent qui implémente, tant qu'il respecte les contraintes ci-dessous (y compris la stack et le design, qui eux sont fixés).

---

## 1. Contraintes non négociables

Ces règles priment sur toute autre considération d'implémentation.

1. **Zéro backend.** Aucun serveur propriétaire, aucune base de données distante, aucun compte utilisateur hébergé. Toute donnée est stockée sur la machine de l'utilisateur. L'app doit rester pleinement fonctionnelle hors-ligne, sauf pour les fonctions qui l'exigent explicitement par nature (appel au modèle IA) — et dans ce cas, échec réseau = dégradation silencieuse, jamais un crash.
2. **Séparation stricte UI / logique métier.** Toute règle de calcul, de validation, de transformation de données doit pouvoir s'exécuter et se tester sans React et sans DOM. L'interface ne fait qu'afficher un état et déclencher des actions ; elle ne doit jamais contenir de logique métier non triviale. Un développeur doit pouvoir remplacer entièrement l'UI sans toucher à la logique, et inversement.
3. **Robustesse pour l'extension future.** L'app est destinée à grossir sur plusieurs mois/années d'itérations par un agent IA. Chaque nouvelle feature doit pouvoir s'ajouter sans réécrire l'existant : structures de données extensibles sans migration destructive, fonctionnalités isolables/désactivables sans casser le reste, pas de raccourci qui hardcode une hypothèse qui deviendra fausse dès la feature suivante.
4. **Un seul utilisateur, une seule machine, plusieurs profils possibles.** Pas de notion de compte réseau, de rôle, de permission entre personnes. Le multi-profil local (façon "qui utilise l'app ce soir") est bienvenu et doit rester simple.
5. **Pas d'intégration cloud tierce implicite.** Aucun appel à une API externe (Slack, Google Drive, GitHub...) sauf demande explicite documentée séparément le jour venu. La seule dépendance externe tolérée nativement est l'appel au modèle IA pour les fonctions d'assistant (section 8).
6. **Aucune donnée envoyée nulle part sans action explicite de l'utilisateur.** L'assistant IA n'écrit jamais dans les données sans confirmation ; les exports ne partent que sur clic explicite.
7. **Packaging final : exécutable Windows autonome**, sans dépendance externe à installer par l'utilisateur final.
8. **Stack technique imposée** (section 2) et **design visuel imposé** (section 3, DESIGN.md + accent recoloré) — ce ne sont pas des suggestions mais des contraintes de projet au même titre que "zéro backend".
9. **Aucune fonctionnalité "à moitié".** Mieux vaut ne pas avoir un champ que d'avoir un champ qui laisse croire à une capacité (multi-utilisateur, sync...) que rien ne supporte réellement.

---

## 2. Stack technique

Reprise de la stack de Patrimoine Manager, **pour ce qui est compatible avec un outil de notes/tâches/calendrier** (le domaine change, l'infrastructure ne change pas) :

- **React 19** + **Vite** (bundler, HMR)
- **TypeScript** (typage strict)
- **Tailwind CSS v4** — utility-first, mais **toutes les couleurs viennent des tokens CSS du design system** (section 3), jamais de couleur codée en dur via une classe utilitaire (pas de `bg-blue-500` etc.). C'est une règle d'or du DESIGN.md, non négociable.
- **Zustand** + `persist` (state global + localStorage, clé de store dynamique par profil — même pattern que `useStore.ts`/`profileService.ts` de Patrimoine Manager)
- **Electron** (packaging desktop Windows)
- **Recharts** — repris tel quel pour les graphiques de rapports/insights (vélocité, progression, tendances). Pertinent pour ce projet, contrairement à `lightweight-charts` (spécifique aux chandeliers de marché de Patrimoine Manager, à écarter ici) et `KaTeX` (rendu de formules financières, sans objet ici).
- **xlsx (SheetJS)** — conservé, optionnel, pour l'import/export CSV/XLSX des bases de données de notes (section 4.9), même usage restreint que documenté dans Patrimoine Manager (pas d'autre usage du tableur).
- Pas de backend, pas de DB serveur — tout en mémoire/localStorage, comme Patrimoine Manager.

**Librairies additionnelles nécessaires** (absentes de la stack Patrimoine Manager car ce domaine ne les nécessitait pas) : éditeur de texte riche par blocs, drag-and-drop (Kanban, réordonnancement de pages/tâches), command palette (Cmd/Ctrl+K). Le choix précis de ces librairies est laissé au jugement de l'agent implémenteur — seule contrainte : rester compatible avec React 19 + Tailwind v4 et respecter le design system de la section 3 (aucune librairie qui impose ses propres couleurs non surchargeables).

---

## 3. Design visuel — DESIGN.md avec accent recoloré en gris

Le fichier `DESIGN.md` de Patrimoine Manager ("Système de Design Linear-inspired Dark") s'applique **intégralement et à l'identique** à cette app : philosophie générale, échelle de surfaces, bordures, texte, typographie (Geist / Geist Mono), géométrie/espacement, élévation, bibliothèque de composants (boutons, panels, inputs, chips, sidebar, topbar, command palette, listes/tables, panneau de détail, overlays, tooltips, cartes sélectionnables, barres de progression, scrollbars, iconographie, motion). Rien n'est à réinventer sur ces points — copier les tokens et les specs de composants tels quels.

**Seule modification demandée : remplacer l'accent violet/lavande par des nuances de gris.** Tout le reste de la palette (surfaces, hairlines, texte, couleurs sémantiques success/danger/warning/gold) reste inchangé — ces tokens sont déjà neutres ou ont une signification fonctionnelle propre (gains/pertes/alertes) indépendante de la couleur de marque.

### 3.1 Nouvelle table d'accent (remplace §2.4 de DESIGN.md)

Les nouvelles valeurs conservent la même luminance perçue que les valeurs violettes d'origine (calcul par conservation de la luminosité HSL, teinte et saturation ramenées à zéro) — cela garantit le même niveau de contraste avec les surfaces/textes existants, seule la teinte change.

| Token | Ancienne valeur (violet) | Nouvelle valeur (gris) | Usage (inchangé) |
|---|---|---|---|
| `--primary` | `#5e6ad2` | `#999999` | CTA primaire, focus, sélection |
| `--primary-hover` | `#828fff` | `#c2c2c2` | Survol du primaire, icônes actives |
| `--primary-focus` | `#5e69d1` | `#a3a3a3` | Bordure de focus des inputs |
| `--primary-tint` | `rgba(94,106,210,0.14)` | `rgba(153,153,153,0.14)` | Fond teinté léger (badge accent, carte sélectionnée) |
| `--primary-tint-2` | `rgba(94,106,210,0.22)` | `rgba(153,153,153,0.22)` | Sélection de texte, teinte plus marquée |

**Règle d'usage inchangée** (héritée de DESIGN.md §2.4) : le gris d'accent n'apparaît QUE sur boutons primaires, icône de nav active, bordure de focus, indicateur de sélection (barre latérale 2px), barre de progression. Jamais en grand aplat de fond. Un seul accent à la fois par écran.

### 3.2 Palette catégorielle (remplace la logique de §2.6 de DESIGN.md)

DESIGN.md dérivait sa palette de graphiques/catégories (`--c-equity`, `--c-bonds`...) par rotation de teinte à partir de `--primary`. Cette méthode ne fonctionne plus : un gris n'a pas de teinte à faire tourner. Deux cas d'usage distincts pour ce projet :

- **États/statuts fonctionnels** (priorité, avancement, succès/échec d'une tâche...) → utiliser exclusivement les couleurs sémantiques déjà définies (`--success`, `--danger`, `--warning`, `--gold`), inchangées. Elles portent un sens, pas une identité de marque.
- **Étiquettes/couleurs choisies par l'utilisateur** (couleur de projet, de tag, de catégorie — fonctionnalité normale d'un outil type Notion/Linear où l'utilisateur distingue visuellement ses propres catégories) → un petit jeu **indépendant** de teintes discrètes et lisibles sur `--canvas`/`--surface-1/2`, non dérivé de `--primary`. Le choix des teintes précises est laissé à l'agent implémenteur ; elles doivent rester cohérentes en luminance/saturation entre elles (comme les anciennes `--c-*` de Patrimoine Manager) mais ne représentent pas la marque — seul le gris de la section 3.1 représente l'identité de l'app.

### 3.3 Points de vigilance spécifiques au passage en gris

- Le gris d'accent (`#999999`/`#c2c2c2`) doit rester visuellement distinct de `--ink-subtle` (`#8a8f98`) et `--ink-tertiary` (`#62666d`) dans le contexte réel des composants (pas seulement en valeur isolée) : vérifier à l'implémentation que les icônes de nav actives, boutons primaires et bordures de focus restent identifiables sans ambiguïté avec du texte tertiaire inactif. Si un doute apparaît en usage réel, préférer l'usage combiné avec un fond (`--primary-tint`) ou un poids de trait plus marqué plutôt que la couleur seule.
- Tout le reste des règles de hiérarchie de DESIGN.md (§2.1, jamais sauter un niveau de surface ; §5, ombres réservées aux éléments flottants ; §7, motion sobre) s'applique sans changement.
- KaTeX (§11 de DESIGN.md) et les composants strictement financiers (points de risque `--risk` orientés marché, etc.) ne sont pas utilisés dans ce projet — ignorer ces sous-sections, elles ne sont pas hors-scope pour la DA globale, juste sans objet ici.

---

## 4. Fondations transverses

Ces briques sont utilisées par tous les modules fonctionnels ; elles doivent être pensées en premier et être réutilisables.

- **Profils locaux.** Plusieurs profils sur la même machine, cloisonnés (données distinctes par profil). Écran de sélection au lancement si plusieurs profils existent.
- **Persistance & sauvegarde.** Toutes les données survivent à la fermeture de l'app. Export global (une sauvegarde = un fichier portable) et import (restauration).
- **Undo/redo global**, pas seulement local à un champ de saisie.
- **Recherche transverse** (command palette Cmd/Ctrl+K) qui cherche à travers notes, tâches, événements — pas des recherches cloisonnées par module.
- **Raccourcis clavier** pour les actions fréquentes, navigables sans souris dans la mesure du possible.
- **Notifications locales** (rappels, alertes) via les notifications natives du système.
- **Thème** : dark mode natif uniquement (comme DESIGN.md §1) — pas de light mode à prévoir dans ce projet.
- **Chiffrement optionnel des données locales**, activable par l'utilisateur, avec avertissement clair sur les risques de perte en cas d'oubli de mot de passe.

---

## 5. Module Notes & Documents (inspiration Notion)

### 5.1 Éditeur de contenu
Éditeur de texte enrichi par blocs (titres, listes, citations, code, images, tableaux, cases à cocher...), organisation en pages, réordonnancement par glisser-déposer. Raccourcis type markdown (`#`, `-`...).

### 5.2 Arborescence de pages
Pages imbriquées à profondeur illimitée. Navigation latérale avec pliage/dépliage. Déplacement d'une page (et de ses enfants) par glisser-déposer.

### 5.3 Bases de données personnalisées
Propriétés custom (texte, nombre, date, sélection, case à cocher, relation vers une autre entrée...) sur un ensemble d'éléments, visualisables sous plusieurs formes : tableau, galerie de cartes, kanban, calendrier. Plusieurs vues simultanées sur une même base, filtres/tris différents, sans dupliquer les données.

### 5.4 Templates
Modèles de page réutilisables (structure de blocs pré-remplie).

### 5.5 Liens entre pages & backlinks
Mention d'une page depuis une autre → lien cliquable ; liste des pages qui mentionnent la page courante. Doit rester performant à plusieurs milliers de pages — dégradation progressive plutôt que plantage.

### 5.6 Recherche plein texte
Recherche dans le contenu de toutes les pages, pas seulement les titres.

### 5.7 Historique de versions
Historique des modifications d'une page, retour en arrière possible. Pas de limite artificielle de durée — c'est une donnée locale, elle appartient à l'utilisateur.

### 5.8 Formulaires
Mode "formulaire" pour créer une entrée dans une base via un écran de saisie guidé.

### 5.9 Import / Export
Import Markdown et CSV a minima. Export d'une page ou de l'espace complet en Markdown et PDF, sans limite de volume.

---

## 6. Module Tâches & Projets (inspiration Linear)

### 6.1 Modèle de base
Titre, description riche, statut (workflow personnalisable), priorité, étiquettes, champs personnalisés, échéance, estimation d'effort, sous-tâches, pièces jointes.

### 6.2 Vues
Kanban (colonnes = statuts), liste/tableau avec tri et filtres combinables, calendrier, vue "roadmap"/timeline (Gantt simplifié, sans gestion de ressources partagées entre personnes).

### 6.3 Organisation du travail
- **Projets** : regroupent des tâches, progression visible (% de complétion).
- **Cycles/sprints** : période fixe, récapitulatif de fin de cycle.
- **Sous-tâches et checklists** imbriquées à profondeur raisonnable.
- **Dépendances entre tâches** ("bloque"/"bloqué par"), avec détection et signalement des dépendances circulaires.

### 6.4 Priorisation & tri
Filtres/tris combinables, vues personnalisées nommées et réutilisables.

### 6.5 Objectifs & vue d'ensemble
- **Objectifs (OKR-like)** rattachables à des projets/tâches, progression dérivée automatiquement.
- **Portfolio** : vue agrégée de plusieurs projets (avancement, échéances, alertes de retard).
- **Charge de travail** : vue "combien d'heures/tâches planifiées cette semaine" pour éviter la surcharge, même seul.

### 6.6 Échéances garanties (SLA simplifié)
Échéance "dure" sur une tâche avec alerte automatique en cas de dépassement imminent ou constaté.

### 6.7 Rapports & analytique
Tableaux de bord dérivés purement des données locales : vélocité par cycle, taux de complétion, temps moyen de résolution, répartition par étiquette/priorité — Recharts, comme les moteurs `benchmarkEngine.ts`/`healthScoreEngine.ts` de Patrimoine Manager.

### 6.8 Automatisations simples
Règles *déclencheur → condition → action*. Moteur générique et extensible, pas une suite de cas particuliers codés en dur.

### 6.9 Templates de projet
Structure de tâches/statuts pré-remplie pour démarrer un projet.

---

## 7. Module Calendrier & Planification personnelle

### 7.1 Calendrier local
Vue jour/semaine/mois, événements récurrents (fin de mois, années bissextiles, ancrage sans dérive sur les récurrences longues — même rigueur que `computeVersementsEnAttente` dans Patrimoine Manager).

### 7.2 Time-blocking
Glisser une tâche du module Tâches sur un créneau du calendrier. Cohérence du lien tâche ↔ créneau si la tâche change de statut/durée ensuite.

### 7.3 Rappels
Notifications locales avant un événement ou une échéance, configurables.

### 7.4 Suivi du temps (time tracking)
Chronomètre par tâche, historique des sessions, total par tâche/projet/période.

### 7.5 Suivi d'habitudes
Habitude + fréquence attendue + historique de complétion, visualisation type "streak".

### 7.6 Planification assistée par contraintes
Rangement automatique des tâches non planifiées dans les créneaux libres (priorité, échéance, durée estimée, disponibilité). Algorithme déterministe et explicable, pas de génératif ici.

---

## 8. Assistant IA intégré

Contextuel : accès en lecture aux données pertinentes (notes, tâches, calendrier), mais **n'écrit jamais sans confirmation explicite** — chaque proposition d'écriture passe par une carte "Confirmer/Annuler", jamais d'exécution silencieuse (même pattern que le coach IA de Patrimoine Manager : `propose_life_events`, `sanitizeProposedEvents()`).

- **Chat contextuel** sur les données de l'app.
- **Résumé automatique** d'une note longue ou d'un ensemble de tickets.
- **Génération de sous-tâches** à partir d'une description, proposées puis validées.
- **Triage intelligent** des nouvelles tâches/notes : statut/priorité/étiquette/projet proposés, jamais appliqués automatiquement sauf mode "auto-application" activé explicitement en connaissance de cause.
- **Insights automatiques** dérivés des mêmes moteurs que les rapports (6.7), formulés en langage naturel — pas de calcul dupliqué.
- **Recherche sémantique** (optionnelle) en complément de la recherche plein texte (5.6), qui reste la méthode principale et ne dépend jamais du réseau.

L'assistant est une **couche au-dessus** des moteurs de calcul existants — il les appelle, ne duplique pas leur logique — afin qu'un nouveau module enrichisse automatiquement ce que l'assistant peut voir et proposer.

---

## 9. Hors scope — explicitement exclu, et pourquoi

Ne pas implémenter, même partiellement :

- Comptes utilisateurs, connexion, SSO/SAML, SCIM, rôles et permissions entre personnes.
- Édition collaborative en temps réel à plusieurs (CRDT + serveur).
- Synchronisation automatique entre plusieurs appareils appartenant à l'utilisateur (un dossier synchronisé par un outil tiers reste possible côté utilisateur, mais l'app ne gère pas de sync réseau elle-même).
- Notifications push serveur, envoi d'e-mails.
- Partage de page/projet via lien public accessible sans l'app.
- Intégrations tierces nécessitant OAuth (Slack, GitHub, Google Calendar, Zendesk...).
- Facturation, abonnement, gestion de licence multi-postes.
- Analytics d'usage remontées à un tiers.
- Light mode (le design est dark-only, voir section 3).

Si une de ces idées revient dans une demande future, la réponse par défaut de l'agent qui code doit être : *"hors scope de ce projet — nécessiterait un backend"*, plutôt que d'implémenter une version dégradée qui laisse croire que ça fonctionne.

---

## 10. Exigences de qualité transverses

- **Moteurs de calcul purs et testables**, indépendants de l'affichage, pour toute logique non triviale (récurrence de dates, progression, dépendances circulaires, règles d'automatisation, statistiques...).
- **Types de données extensibles** : chaque entité (page, tâche, événement...) doit pouvoir accueillir des champs personnalisés sans casser l'existant.
- **Dégradation silencieuse, jamais de crash** en cas d'échec réseau (appel IA) ou de donnée corrompue/manquante.
- **Performance à l'échelle d'un usage réel et long** : penser à plusieurs milliers de notes/tâches sur plusieurs années, pas seulement au jeu de données de démo.
- **Accessibilité clavier** sur les actions fréquentes (au moins command palette et navigation entre pages/tâches).
- **Fidélité stricte au design system** (section 3) : aucune couleur codée en dur hors des tokens, respect de la hiérarchie de surfaces, densité des contrôles (32px standard, 28px compact).
- **Aucune fonctionnalité "à moitié"**.

---

## 11. Priorisation suggérée (à ajuster librement)

1. **Socle** : profils, persistance/export-import, undo/redo, design system (tokens gris + composants de base : boutons, panels, inputs), command palette.
2. **Notes** : éditeur par blocs, arborescence, une base de données simple avec vue tableau + kanban.
3. **Tâches/Projets** : modèle de tâche, vues Kanban/liste, projets, cycles.
4. **Calendrier** : vue calendrier, récurrence, rappels locaux, time-blocking basique.
5. **Rapports & objectifs** : vélocité, portfolios, goals.
6. **Assistant IA** : chat contextuel en lecture seule d'abord, puis propositions d'écriture avec confirmation, puis triage/insights automatiques.
7. **Raffinements** : templates, formulaires, historique de versions étendu, time tracking, habit tracker, automatisations, recherche sémantique.
