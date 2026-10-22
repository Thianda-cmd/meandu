import { create } from 'zustand'

export type SheetState =
  | { type: 'create' }
  | { type: 'event'; eventId?: string; date?: string; countdown?: boolean }
  /** A new memory (maybe from a plan), or editing one. */
  | { type: 'memory'; eventId?: string; memoryId?: string }
  /** A new list, or editing one. */
  | { type: 'list'; listId?: string }
  | { type: 'item'; itemId: string }
  | { type: 'install' }
  | { type: 'invite' }
  | { type: 'join'; code?: string }
  /** Add a passkey or email to this account. */
  | { type: 'secure'; start?: 'choose' | 'email' }
  /** Sign in again before changing how a protected account signs in. */
  | { type: 'confirm' }
  | { type: 'signout' }
  /** Pause the space for both of you. */
  | { type: 'unlink' }
  /** After unlinking: delete the space for both of you. */
  | { type: 'deleteSpace' }
  | { type: 'deleteAccount' }
  /** The account card on its own (while paused there are no settings). */
  | { type: 'account' }

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
  /** Onboarding has a last step to show after the space exists (keeping it safe). */
  onboardingOpen: boolean
  openSheet: (sheet: SheetState) => void
  closeSheet: () => void
  showToast: (message: string, action?: Toast['action']) => void
  hideToast: () => void
  celebrate: () => void
  setJoinCode: (code: string | null) => void
  setOnboardingOpen: (open: boolean) => void
}

let toastIds = 0

export const useUi = create<UiState>()((set) => ({
  sheet: null,
  toast: null,
  hearts: 0,
  joinCode: null,
  onboardingOpen: false,
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  showToast: (message, action) => set({ toast: { id: ++toastIds, message, action } }),
  hideToast: () => set({ toast: null }),
  celebrate: () => set((s) => ({ hearts: s.hearts + 1 })),
  setJoinCode: (joinCode) => set({ joinCode }),
  setOnboardingOpen: (onboardingOpen) => set({ onboardingOpen }),
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
