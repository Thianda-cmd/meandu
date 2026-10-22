import { api, ensureAccount } from '../../api/client'
import { useData } from '../../state/data'
import { useNav } from '../../state/nav'
import type { Tone } from '../../state/types'
import { useUi } from '../../state/ui'
import { syncNow } from '../../sync/engine'

export interface Profile {
  name: string
  tone: Tone
}

/** Starts your own space; your person joins later with the invite code. */
export async function createSpace(profile: Profile, togetherSince: string | null): Promise<void> {
  const userId = await ensureAccount()
  const state = await api.createSpace({ ...profile, togetherSince })
  useData.getState().beginSynced(state, {
    people: [{ id: userId, ...profile }],
    togetherSince,
  })
  void syncNow()
}

/** Joins your person's space. Anything you already made comes along. */
export async function joinSpace(code: string, profile: Profile): Promise<void> {
  const alreadySynced = useData.getState().mode === 'synced'
  // Send what's still waiting first, so it's in the old space when that moves over.
  if (alreadySynced) await syncNow()
  const userId = await ensureAccount()
  const state = await api.join({ code, ...profile })
  // A synced phone notices the move on its next sync and fetches the new space from scratch.
  if (!alreadySynced) {
    useData.getState().beginSynced(state, { people: [{ id: userId, ...profile }] })
  }
  await syncNow()
}

/** Forgets everything on this phone and goes back to the welcome screen. */
export function startOver(): void {
  useUi.getState().closeSheet()
  useData.getState().reset()
  useNav.getState().reset()
}
