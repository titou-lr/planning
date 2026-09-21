import { create } from 'zustand'

const cloudConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
)

export type CloudStatus =
  | 'unconfigured'
  | 'signed_out'
  | 'awaiting_email'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'

export interface CloudState {
  status: CloudStatus
  email: string | null
  workspaceId: string | null
  lastSyncedAt: string | null
  pending: number
  error: string | null
}

export const initialCloudState: CloudState = {
  status: cloudConfigured ? 'signed_out' : 'unconfigured',
  email: null,
  workspaceId: null,
  lastSyncedAt: null,
  pending: 0,
  error: null,
}

export const useCloudSync = create<CloudState>(() => initialCloudState)
