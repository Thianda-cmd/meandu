import type { AccountInfo } from '@meandu/core'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../api/client'

interface AccountState {
  /** How this account can be reached from another device; null until first loaded. */
  info: AccountInfo | null
  /** Whether the server can email codes. */
  emailSignIn: boolean
  load: () => Promise<void>
  loadConfig: () => Promise<void>
  clear: () => void
}

/** Kept on the phone too, so "protected or not" is known the moment the app opens. */
export const useAccount = create<AccountState>()(
  persist(
    (set) => ({
      info: null,
      emailSignIn: false,
      load: async () => {
        try {
          set({ info: await api.account() })
        } catch {
          // Offline: keep what we knew.
        }
      },
      loadConfig: async () => {
        try {
          set({ emailSignIn: (await api.config()).email })
        } catch {
          // Offline: keep what we knew.
        }
      },
      clear: () => set({ info: null }),
    }),
    {
      name: 'meandu-account',
      version: 1,
      partialize: (s) => ({ info: s.info, emailSignIn: s.emailSignIn }),
    },
  ),
)
