# Planning

Suite de productivité **100 % locale** — notes, tâches, calendrier — en application Windows (Electron).
Aucune donnée ne quitte la machine : tout est stocké localement.

## Télécharger

L'exécutable portable Windows (x64) est publié dans les
[Releases](../../releases/latest) : `Planning-0.1.0-portable.exe`.

Aucune installation : on télécharge, on double-clique. L'application n'étant pas
signée par un certificat commercial, Windows SmartScreen affiche un avertissement
au premier lancement → *Informations complémentaires* → *Exécuter quand même*.

## Développement

Prérequis : Node.js 20+ et [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev              # serveur Vite seul (navigateur)
pnpm electron:dev     # application Electron en mode développement
pnpm test             # suite de tests (vitest)
```

## Construire l'exécutable

```bash
pnpm run build        # bundle du renderer dans dist/
pnpm dist             # + electron-builder → release/
```

Sur un poste où `electron-builder` échoue à appeler `makensis` (chemins pnpm
dépassant la limite Windows de 260 caractères, ou impossibilité de créer un pipe
stdio), utiliser l'enveloppe fournie, qui contourne ces deux points :

```bash
pnpm run build && node build-portable.cjs
```

Le résultat est `release/Planning-<version>-portable.exe`.

## Structure

```
planning/
├── electron/       process principal Electron (main + preload)
├── src/
│   ├── core/       logique métier pure (testée, sans UI)
│   ├── components/ composants React
│   ├── store/      état Zustand + persistance
│   └── actions.ts  actions exposées au registre Jarvis
└── packages/       dépendances internes, embarquées ici
    ├── design-system/    tokens et styles partagés
    ├── data-layer/       stockage clé→valeur namespacé
    ├── action-registry/  déclaration typée des actions
    └── shared-types/     types communs
```

Ce dépôt est une extraction autonome du module Planning du monorepo Jarvis :
les quatre paquets de `packages/` y sont embarqués pour que l'application se
construise et tourne seule. En isolation, la couche de données se replie
automatiquement sur `localStorage`.

## Stack

React 19 · TypeScript strict · Vite 6 · Tailwind v4 · Zustand · Electron 36
