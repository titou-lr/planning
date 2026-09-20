import { create } from 'zustand'

/** Toast minimal (DESIGN.md §7 : entrée 200ms, affichage 3s). */

interface ToastState {
  message: string | null
  show: (message: string) => void
}

let timer: ReturnType<typeof setTimeout> | null = null

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    set({ message })
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => set({ message: null }), 3000)
  },
}))

/** Raccourci impératif hors composant. */
export function toast(message: string) {
  useToast.getState().show(message)
}

export function ToastHost() {
  const message = useToast((s) => s.message)
  if (!message) return null
  return <div className="toast">{message}</div>
}
