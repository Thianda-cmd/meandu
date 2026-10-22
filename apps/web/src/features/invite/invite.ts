import type { InviteInfo } from '@meandu/core'
import { create } from 'zustand'
import { ApiError, api } from '../../api/client'
import { syncNow } from '../../sync/engine'

interface InviteState {
  invite: InviteInfo | null
  loading: boolean
  /** Error code of the last failed attempt. */
  error: string | null
  load: () => Promise<void>
}

/** The code your person types in to join you. Fetched once and reused until it expires. */
export const useInvite = create<InviteState>()((set, get) => ({
  invite: null,
  loading: false,
  error: null,
  load: async () => {
    const { invite, loading } = get()
    if (loading) return
    if (invite && Date.parse(invite.expiresAt) > Date.now() + 60_000) return
    set({ loading: true, error: null })
    try {
      set({ invite: await api.invite(), loading: false })
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'server'
      set({ loading: false, error: code })
      // Already two of you: your person joined, so fetch them.
      if (code === 'full') void syncNow()
    }
  },
}))

/** `K7P2QX` → `K7P 2QX`, easier to read out loud. */
export function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code
}

export const joinUrl = (code: string) => `${location.origin}/join/${code}`
