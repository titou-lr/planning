/**
 * Modèle de données central — extensible sans migration destructive :
 * toutes les entités acceptent des champs additionnels inconnus (index
 * signature `meta`) et tous les champs optionnels ont un défaut sain à
 * la lecture. Aucune dépendance UI ici.
 */

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulleted'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'code'
  | 'divider'
  | 'image'
  | 'table'

export interface Block {
  id: string
  type: BlockType
  /** Texte brut ; la mise en forme inline utilise la syntaxe markdown
   *  (**gras**, *italique*, `code`) et les liens de page [[Titre]]. */
  text: string
  /** Indentation logique (listes imbriquées), 0 par défaut. */
  indent?: number
  /** Blocs todo. */
  checked?: boolean
  /** Blocs code. */
  language?: string
  /** Blocs image : data URL ou chemin. */
  src?: string
  /** Blocs table : lignes × colonnes de texte brut. */
  rows?: string[][]
  /** Extension future sans migration. */
  meta?: Record<string, unknown>
}

export type PropertyType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multiSelect'
  | 'checkbox'
  | 'relation'

export interface SelectOption {
  id: string
  name: string
  /** Token de la palette catégorielle (ex. 'cat-blue') — jamais une couleur brute. */
  color: string
}

export interface PropertyDef {
  id: string
  name: string
  type: PropertyType
  options?: SelectOption[]
  /** relation : id de la base cible. */
  relationTarget?: string
  meta?: Record<string, unknown>
}

/** Valeur de propriété : string | number | boolean | string[] selon le type. */
export type PropValue = string | number | boolean | string[] | null

export type ViewType = 'table' | 'kanban' | 'gallery' | 'calendar'

export type FilterOp =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'gt'
  | 'lt'

export interface Filter {
  propId: string
  op: FilterOp
  value?: PropValue
}

export interface Sort {
  propId: string
  dir: 'asc' | 'desc'
}

export interface ViewDef {
  id: string
  name: string
  type: ViewType
  filters: Filter[]
  sorts: Sort[]
  /** kanban : propriété select de regroupement. */
  groupBy?: string
  /** calendar : propriété date de placement (défaut : première propriété date). */
  dateProp?: string
  /** Propriétés visibles (table : colonnes ; galerie/kanban : champs de carte). */
  visibleProps?: string[]
  meta?: Record<string, unknown>
}

export interface DatabaseSchema {
  properties: PropertyDef[]
  views: ViewDef[]
}

export type PageKind = 'page' | 'database' | 'template'

export interface Page {
  id: string
  title: string
  icon?: string
  parentId: string | null
  /** Ordre parmi les frères (tri croissant). */
  order: number
  kind: PageKind
  blocks: Block[]
  /** Pages de type database uniquement. */
  schema?: DatabaseSchema
  /** Lignes d'une base (pages enfants d'une database) : valeurs par propId. */
  props?: Record<string, PropValue>
  createdAt: string
  updatedAt: string
  meta?: Record<string, unknown>
}

export interface PageVersion {
  id: string
  at: string
  title: string
  blocks: Block[]
}

/* ============================================================
   Module Tâches & Projets (CLAUDE.md §6)
   ============================================================ */

/** Catégorie de workflow : porte la sémantique (progression, rapports),
 *  indépendante des noms de statuts personnalisés. */
export type StatusCategory = 'backlog' | 'todo' | 'inprogress' | 'done' | 'canceled'

export interface TaskStatus {
  id: string
  name: string
  category: StatusCategory
  /** Token de la palette catégorielle ou sémantique (jamais une couleur brute). */
  color: string
  order: number
  meta?: Record<string, unknown>
}

export interface Label {
  id: string
  name: string
  color: string
  meta?: Record<string, unknown>
}

/** Priorité façon Linear : 0 = aucune, 1 = urgente … 4 = basse. */
export type Priority = 0 | 1 | 2 | 3 | 4

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Attachment {
  id: string
  name: string
  /** data URL (stockage local uniquement). */
  src: string
}

export interface Task {
  id: string
  title: string
  /** Description riche : mêmes blocs que l'éditeur de notes. */
  blocks: Block[]
  statusId: string
  priority: Priority
  labelIds: string[]
  projectId: string | null
  cycleId: string | null
  /** Sous-tâche : id de la tâche parente. */
  parentId: string | null
  order: number
  /** YYYY-MM-DD. */
  dueDate: string | null
  /** Échéance "dure" (§6.6) : alerte automatique si dépassement imminent/constaté. */
  hardDeadline: boolean
  /** Estimation d'effort en minutes. */
  estimateMin: number | null
  /** Roadmap : date de début planifiée (YYYY-MM-DD). */
  startDate: string | null
  /** Dépendances : ids des tâches qui bloquent celle-ci. */
  blockedBy: string[]
  checklist: ChecklistItem[]
  attachments: Attachment[]
  /** Champs personnalisés (workspace.taskFields). */
  customProps?: Record<string, PropValue>
  createdAt: string
  updatedAt: string
  completedAt: string | null
  meta?: Record<string, unknown>
}

export type ProjectHealth = 'active' | 'paused' | 'done'

export interface Project {
  id: string
  name: string
  description: string
  color: string
  health: ProjectHealth
  startDate: string | null
  targetDate: string | null
  order: number
  createdAt: string
  meta?: Record<string, unknown>
}

export interface Cycle {
  id: string
  name: string
  /** YYYY-MM-DD, bornes incluses. */
  startDate: string
  endDate: string
  meta?: Record<string, unknown>
}

/** Objectif OKR-like : progression dérivée des tâches/projets liés. */
export interface Goal {
  id: string
  name: string
  description: string
  projectIds: string[]
  taskIds: string[]
  targetDate: string | null
  createdAt: string
  meta?: Record<string, unknown>
}

export type TaskViewType = 'list' | 'kanban' | 'calendar' | 'roadmap'

export type TaskFilterField =
  | 'statusId' | 'priority' | 'projectId' | 'cycleId' | 'labelIds' | 'dueDate' | 'title'

export interface TaskFilter {
  field: TaskFilterField
  op: FilterOp
  value?: PropValue
}

export type TaskSortField = 'priority' | 'dueDate' | 'title' | 'createdAt' | 'updatedAt' | 'order' | 'estimateMin'

export interface TaskSort {
  field: TaskSortField
  dir: 'asc' | 'desc'
}

/** Vue personnalisée nommée et réutilisable (§6.4). */
export interface SavedTaskView {
  id: string
  name: string
  view: TaskViewType
  filters: TaskFilter[]
  sorts: TaskSort[]
  meta?: Record<string, unknown>
}

/* ---- Automatisations (§6.8) : déclencheur → condition → action ---- */

export type AutomationTriggerType =
  | 'task.created'
  | 'task.statusChanged'
  | 'task.completed'
  | 'task.dueSoon'

export type AutomationConditionField =
  | 'statusId' | 'priority' | 'projectId' | 'cycleId' | 'labelIds' | 'title' | 'dueDate'

export interface AutomationCondition {
  field: AutomationConditionField
  op: FilterOp
  value?: PropValue
}

export type AutomationActionType =
  | 'setStatus' | 'setPriority' | 'addLabel' | 'setProject' | 'setCycle' | 'setDueInDays'

export interface AutomationAction {
  type: AutomationActionType
  value?: string | number
}

export interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  trigger: AutomationTriggerType
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  meta?: Record<string, unknown>
}

/** Template de projet (§6.9) : structure de tâches pré-remplie. */
export interface ProjectTemplate {
  id: string
  name: string
  description: string
  /** Tâches relatives : titres, priorités, sous-tâches par index parent. */
  tasks: {
    title: string
    priority: Priority
    estimateMin: number | null
    /** Index (dans ce tableau) de la tâche parente, null si racine. */
    parentIndex: number | null
    /** Échéance relative en jours après la création du projet. */
    dueInDays: number | null
  }[]
  meta?: Record<string, unknown>
}

/* ============================================================
   Module Calendrier & Planification (CLAUDE.md §7)
   ============================================================ */

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Recurrence {
  freq: RecurrenceFreq
  /** Toutes les N unités (≥ 1). */
  interval: number
  /** weekly : jours de semaine 0=dim … 6=sam (défaut : jour de départ). */
  byWeekday?: number[]
  /** monthly : 'day' = même quantième ancré (clampé en fin de mois courts,
   *  sans dérive), 'lastDay' = dernier jour du mois. */
  monthlyMode?: 'day' | 'lastDay'
  /** Date de fin incluse (YYYY-MM-DD), ou null = sans fin. */
  until?: string | null
  /** Nombre total d'occurrences, ou null = illimité. */
  count?: number | null
}

export interface CalendarEvent {
  id: string
  title: string
  /** ISO local (date + heure). */
  start: string
  end: string
  allDay: boolean
  recurrence: Recurrence | null
  /** Occurrences exclues (ISO de début d'occurrence). */
  exdates: string[]
  /** Rappel N minutes avant, ou null = aucun. */
  reminderMin: number | null
  /** Time-blocking : tâche liée à ce créneau. */
  taskId: string | null
  color: string
  notes: string
  meta?: Record<string, unknown>
}

export interface Habit {
  id: string
  name: string
  color: string
  frequency: 'daily' | 'weekly'
  /** weekly : nombre de complétions attendues par semaine. */
  timesPerWeek: number
  /** Jours complétés (YYYY-MM-DD). */
  completions: string[]
  createdAt: string
  archived: boolean
  meta?: Record<string, unknown>
}

/** Session de suivi du temps (§7.4). */
export interface TimeSession {
  id: string
  taskId: string
  start: string
  /** null = chronomètre en cours. */
  end: string | null
  meta?: Record<string, unknown>
}

/** Tranche de données couverte par l'undo/redo et l'export global. */
export interface WorkspaceData {
  pages: Page[]
  /** Historique de versions par page. */
  versions: Record<string, PageVersion[]>
  // Tâches & projets (§6)
  tasks: Task[]
  statuses: TaskStatus[]
  labels: Label[]
  projects: Project[]
  cycles: Cycle[]
  goals: Goal[]
  savedTaskViews: SavedTaskView[]
  automations: AutomationRule[]
  projectTemplates: ProjectTemplate[]
  /** Champs personnalisés des tâches. */
  taskFields: PropertyDef[]
  // Calendrier & planification (§7)
  events: CalendarEvent[]
  habits: Habit[]
  sessions: TimeSession[]
}

export const EMPTY_WORKSPACE: WorkspaceData = {
  pages: [], versions: {},
  tasks: [], statuses: [], labels: [], projects: [], cycles: [], goals: [],
  savedTaskViews: [], automations: [], projectTemplates: [], taskFields: [],
  events: [], habits: [], sessions: [],
}

/** Tokens de la palette catégorielle (CLAUDE.md §3.2) pour tags/sélections. */
export const CATEGORY_COLORS = [
  'cat-gray',
  'cat-blue',
  'cat-teal',
  'cat-green',
  'cat-yellow',
  'cat-orange',
  'cat-red',
  'cat-pink',
  'cat-purple',
] as const
