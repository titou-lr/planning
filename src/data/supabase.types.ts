export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          entity_id: string
          entity_type: string
          id: string
          mime_type: string | null
          name: string
          revision: number
          size_bytes: number | null
          storage_path: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          id: string
          mime_type?: string | null
          name: string
          revision?: number
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          mime_type?: string | null
          name?: string
          revision?: number
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          created_at: string
          definition: Json
          deleted_at: string | null
          enabled: boolean
          id: string
          name: string
          revision: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          definition?: Json
          deleted_at?: string | null
          enabled?: boolean
          id: string
          name: string
          revision?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          definition?: Json
          deleted_at?: string | null
          enabled?: boolean
          id?: string
          name?: string
          revision?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      Block: {
        Row: {
          content: Json
          createdAt: string
          id: string
          order: number
          pageId: string
          type: Database["public"]["Enums"]["BlockType"]
          updatedAt: string
        }
        Insert: {
          content: Json
          createdAt?: string
          id: string
          order: number
          pageId: string
          type: Database["public"]["Enums"]["BlockType"]
          updatedAt: string
        }
        Update: {
          content?: Json
          createdAt?: string
          id?: string
          order?: number
          pageId?: string
          type?: Database["public"]["Enums"]["BlockType"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Block_pageId_fkey"
            columns: ["pageId"]
            isOneToOne: false
            referencedRelation: "Page"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          data: Json
          deleted_at: string | null
          end_at: string
          id: string
          revision: number
          start_at: string
          task_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          end_at: string
          id: string
          revision?: number
          start_at: string
          task_id?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          end_at?: string
          id?: string
          revision?: number
          start_at?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          created_at: string
          data: Json
          deleted_at: string | null
          end_date: string
          id: string
          name: string
          revision: number
          start_date: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          end_date: string
          id: string
          name: string
          revision?: number
          start_date: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          end_date?: string
          id?: string
          name?: string
          revision?: number
          start_date?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      device_subscriptions: {
        Row: {
          created_at: string
          deleted_at: string | null
          device_id: string
          id: string
          revision: number
          subscription: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          device_id: string
          id: string
          revision?: number
          subscription: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          device_id?: string
          id?: string
          revision?: number
          subscription?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      Event: {
        Row: {
          category: string | null
          color: string | null
          createdAt: string
          description: string | null
          endAt: string
          id: string
          isRecurring: boolean
          recurrence: string | null
          sourceLabel: string | null
          startAt: string
          title: string
          updatedAt: string
          userId: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          createdAt?: string
          description?: string | null
          endAt: string
          id: string
          isRecurring?: boolean
          recurrence?: string | null
          sourceLabel?: string | null
          startAt: string
          title: string
          updatedAt: string
          userId: string
        }
        Update: {
          category?: string | null
          color?: string | null
          createdAt?: string
          description?: string | null
          endAt?: string
          id?: string
          isRecurring?: boolean
          recurrence?: string | null
          sourceLabel?: string | null
          startAt?: string
          title?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Event_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          data: Json
          deleted_at: string | null
          description: string
          id: string
          name: string
          revision: number
          target_date: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          description?: string
          id: string
          name: string
          revision?: number
          target_date?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          description?: string
          id?: string
          name?: string
          revision?: number
          target_date?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived: boolean
          created_at: string
          data: Json
          deleted_at: string | null
          id: string
          name: string
          revision: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          data?: Json
          deleted_at?: string | null
          id: string
          name: string
          revision?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          data?: Json
          deleted_at?: string | null
          id?: string
          name?: string
          revision?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string
          created_at: string
          data: Json
          deleted_at: string | null
          id: string
          name: string
          revision: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color: string
          created_at?: string
          data?: Json
          deleted_at?: string | null
          id: string
          name: string
          revision?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          data?: Json
          deleted_at?: string | null
          id?: string
          name?: string
          revision?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      Page: {
        Row: {
          createdAt: string
          icon: string | null
          id: string
          isDeleted: boolean
          parentId: string | null
          title: string
          updatedAt: string
          userId: string
        }
        Insert: {
          createdAt?: string
          icon?: string | null
          id: string
          isDeleted?: boolean
          parentId?: string | null
          title?: string
          updatedAt: string
          userId: string
        }
        Update: {
          createdAt?: string
          icon?: string | null
          id?: string
          isDeleted?: boolean
          parentId?: string | null
          title?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Page_parentId_fkey"
            columns: ["parentId"]
            isOneToOne: false
            referencedRelation: "Page"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Page_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      page_versions: {
        Row: {
          blocks: Json
          created_at: string
          deleted_at: string | null
          id: string
          page_id: string
          revision: number
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          deleted_at?: string | null
          id: string
          page_id: string
          revision?: number
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          page_id?: string
          revision?: number
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          blocks: Json
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          parent_id: string | null
          position: number
          properties: Json
          revision: number
          schema_definition: Json | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          deleted_at?: string | null
          id: string
          kind?: string
          parent_id?: string | null
          position?: number
          properties?: Json
          revision?: number
          schema_definition?: Json | null
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          position?: number
          properties?: Json
          revision?: number
          schema_definition?: Json | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          created_at: string
          definition: Json
          deleted_at: string | null
          description: string
          id: string
          name: string
          revision: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          definition?: Json
          deleted_at?: string | null
          description?: string
          id: string
          name: string
          revision?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          definition?: Json
          deleted_at?: string | null
          description?: string
          id?: string
          name?: string
          revision?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string
          created_at: string
          data: Json
          deleted_at: string | null
          description: string
          health: string
          id: string
          name: string
          position: number
          revision: number
          start_date: string | null
          target_date: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color: string
          created_at?: string
          data?: Json
          deleted_at?: string | null
          description?: string
          health?: string
          id: string
          name: string
          position?: number
          revision?: number
          start_date?: string | null
          target_date?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          data?: Json
          deleted_at?: string | null
          description?: string
          health?: string
          id?: string
          name?: string
          position?: number
          revision?: number
          start_date?: string | null
          target_date?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      Reminder: {
        Row: {
          createdAt: string
          description: string | null
          dueAt: string | null
          id: string
          isDeleted: boolean
          isDone: boolean
          listId: string | null
          priority: Database["public"]["Enums"]["Priority"]
          title: string
          updatedAt: string
          userId: string
        }
        Insert: {
          createdAt?: string
          description?: string | null
          dueAt?: string | null
          id: string
          isDeleted?: boolean
          isDone?: boolean
          listId?: string | null
          priority?: Database["public"]["Enums"]["Priority"]
          title: string
          updatedAt: string
          userId: string
        }
        Update: {
          createdAt?: string
          description?: string | null
          dueAt?: string | null
          id?: string
          isDeleted?: boolean
          isDone?: boolean
          listId?: string | null
          priority?: Database["public"]["Enums"]["Priority"]
          title?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Reminder_listId_fkey"
            columns: ["listId"]
            isOneToOne: false
            referencedRelation: "ReminderList"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Reminder_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      ReminderList: {
        Row: {
          color: string | null
          createdAt: string
          id: string
          name: string
          userId: string
        }
        Insert: {
          color?: string | null
          createdAt?: string
          id: string
          name: string
          userId: string
        }
        Update: {
          color?: string | null
          createdAt?: string
          id?: string
          name?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ReminderList_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_task_views: {
        Row: {
          created_at: string
          definition: Json
          deleted_at: string | null
          id: string
          name: string
          revision: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          definition?: Json
          deleted_at?: string | null
          id: string
          name: string
          revision?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          definition?: Json
          deleted_at?: string | null
          id?: string
          name?: string
          revision?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_task_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_mutations: {
        Row: {
          base_revision: number | null
          created_at: string
          deleted_at: string | null
          device_id: string
          entity_id: string
          entity_type: string
          mutation_id: string
          operation: string
          payload: Json | null
          result_revision: number | null
          revision: number
          sequence: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          base_revision?: number | null
          created_at?: string
          deleted_at?: string | null
          device_id: string
          entity_id: string
          entity_type: string
          mutation_id: string
          operation: string
          payload?: Json | null
          result_revision?: number | null
          revision?: number
          sequence?: never
          updated_at?: string
          workspace_id: string
        }
        Update: {
          base_revision?: number | null
          created_at?: string
          deleted_at?: string | null
          device_id?: string
          entity_id?: string
          entity_type?: string
          mutation_id?: string
          operation?: string
          payload?: Json | null
          result_revision?: number | null
          revision?: number
          sequence?: never
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_mutations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_statuses: {
        Row: {
          category: string
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          position: number
          revision: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category: string
          color: string
          created_at?: string
          deleted_at?: string | null
          id: string
          name: string
          position?: number
          revision?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          position?: number
          revision?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_statuses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          content: Json
          created_at: string
          cycle_id: string | null
          deleted_at: string | null
          due_date: string | null
          id: string
          parent_id: string | null
          position: number
          priority: number
          project_id: string | null
          revision: number
          start_date: string | null
          status_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          cycle_id?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id: string
          parent_id?: string | null
          position?: number
          priority?: number
          project_id?: string | null
          revision?: number
          start_date?: string | null
          status_id?: string | null
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          cycle_id?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          parent_id?: string | null
          position?: number
          priority?: number
          project_id?: string | null
          revision?: number
          start_date?: string | null
          status_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_sessions: {
        Row: {
          created_at: string
          data: Json
          deleted_at: string | null
          end_at: string | null
          id: string
          revision: number
          start_at: string
          task_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          end_at?: string | null
          id: string
          revision?: number
          start_at: string
          task_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          end_at?: string | null
          id?: string
          revision?: number
          start_at?: string
          task_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          createdAt: string
          email: string
          id: string
          name: string | null
        }
        Insert: {
          createdAt?: string
          email: string
          id: string
          name?: string | null
        }
        Update: {
          createdAt?: string
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          owner_id: string
          revision: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          name?: string
          owner_id: string
          revision?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          revision?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      BlockType:
        | "TEXT"
        | "HEADING_1"
        | "HEADING_2"
        | "HEADING_3"
        | "BULLET_LIST"
        | "NUMBERED_LIST"
        | "CODE"
        | "IMAGE"
        | "DIVIDER"
        | "QUOTE"
        | "TODO"
      Priority: "LOW" | "NORMAL" | "HIGH"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      BlockType: [
        "TEXT",
        "HEADING_1",
        "HEADING_2",
        "HEADING_3",
        "BULLET_LIST",
        "NUMBERED_LIST",
        "CODE",
        "IMAGE",
        "DIVIDER",
        "QUOTE",
        "TODO",
      ],
      Priority: ["LOW", "NORMAL", "HIGH"],
    },
  },
} as const
