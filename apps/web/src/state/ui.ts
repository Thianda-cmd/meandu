import { create } from 'zustand'

export type SheetState =
  | { type: 'create' }
  | { type: 'event'; eventId?: string; date?: string; countdown?: boolean }
  | { type: 'memory'; eventId?: string }
  | { type: 'list' }
  | { type: 'install' }
  | { type: 'invite' }
  | { type: 'join'; code?: string }

export interface Toast {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

interface UiState {
  sheet: SheetState | null
  toast: Toast | null
  /** Bumped to play the little heart animation. */
  hearts: number
  /** A code from an invite link, waiting to be used. */
  joinCode: string | null
  openSheet: (sheet: SheetState) => void
  closeSheet: () => void
  showToast: (message: string, action?: Toast['action']) => void
  hideToast: () => void
  celebrate: () => void
  setJoinCode: (code: string | null) => void
}

let toastIds = 0

export const useUi = create<UiState>()((set) => ({
  sheet: null,
  toast: null,
  hearts: 0,
  joinCode: null,
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  showToast: (message, action) => set({ toast: { id: ++toastIds, message, action } }),
  hideToast: () => set({ toast: null }),
  celebrate: () => set((s) => ({ hearts: s.hearts + 1 })),
  setJoinCode: (joinCode) => set({ joinCode }),
}))

interface CalendarUiState {
  /** ISO date of the selected day */
  selected: string | null
  view: 'month' | 'agenda'
  hidden: { me: boolean; partner: boolean; us: boolean }
  select: (date: string) => void
  setView: (view: 'month' | 'agenda') => void
  toggle: (who: 'me' | 'partner' | 'us') => void
}

export const useCalendarUi = create<CalendarUiState>()((set) => ({
  selected: null,
  view: 'month',
  hidden: { me: false, partner: false, us: false },
  select: (selected) => set({ selected }),
  setView: (view) => set({ view }),
  toggle: (who) => set((s) => ({ hidden: { ...s.hidden, [who]: !s.hidden[who] } })),
}))
