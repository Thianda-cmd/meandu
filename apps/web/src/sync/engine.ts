import { create } from 'zustand'
import { ApiError, api } from '../api/client'
import { useData } from '../state/data'

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'signed-out' | 'error'

export const useSync = create<{ status: SyncStatus; lastSyncedAt: number | null }>(() => ({
  status: 'idle',
  lastSyncedAt: null,
}))

/** True while a space that was just set up on this phone waits for its first sync. */
export function useFirstSyncPending(): boolean {
  const waiting = useData((s) => s.mode === 'synced' && s.cursor === 0)
  const status = useSync((s) => s.status)
  return waiting && (status === 'idle' || status === 'syncing')
}

/** How often to check for your partner's changes while the app is open. */
const POLL_MS = 10_000
const BATCH = 200

let running: Promise<void> | null = null
let again = false
let timer = 0

async function run(): Promise<void> {
  for (let round = 0; round < 20; round++) {
    const state = useData.getState()
    if (state.mode !== 'synced') return
    const batch = state.outbox.slice(0, BATCH)
    const response = await api.sync({
      since: state.cursor,
      spaceId: state.spaceId,
      mutations: batch.map(({ seq: _seq, ...mutation }) => mutation),
    })
    useData.getState().acknowledge(batch, response)
    if (!response.more && useData.getState().outbox.length === 0) return
  }
}

/** Sends this phone's changes and fetches your partner's. Safe to call any time. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  if (useData.getState().mode !== 'synced') return Promise.resolve()
  if (!navigator.onLine) {
    useSync.setState({ status: 'offline' })
    return Promise.resolve()
  }

  useSync.setState({ status: 'syncing' })
  running = run()
    .then(() => useSync.setState({ status: 'idle', lastSyncedAt: Date.now() }))
    .catch((error: unknown) => {
      const code = error instanceof ApiError ? error.code : 'server'
      useSync.setState({
        status: code === 'offline' ? 'offline' : code === 'signed-out' ? 'signed-out' : 'error',
      })
    })
    .finally(() => {
      running = null
      if (again) {
        again = false
        void syncNow()
      }
    })
  return running
}

/** Waits a moment so a burst of edits goes out as one request. */
export function syncSoon(delay = 400): void {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => void syncNow(), delay)
}

/** Keeps the phone in sync while the app is open. Returns a stop function. */
export function startSync(): () => void {
  let interval = 0
  const visible = () => document.visibilityState === 'visible'

  const resume = () => {
    window.clearInterval(interval)
    if (!visible()) {
      // Send anything unsent before the app goes to sleep.
      void syncNow()
      return
    }
    void syncNow()
    interval = window.setInterval(() => {
      // A signed-out phone can't sync; it waits for the next launch instead of retrying.
      if (useSync.getState().status !== 'signed-out') void syncNow()
    }, POLL_MS)
  }

  const goOffline = () => useSync.setState({ status: 'offline' })
  // Every local change is sent shortly after it's made.
  const stopWatching = useData.subscribe((state, previous) => {
    if (state.outbox.length > 0 && state.outbox !== previous.outbox) syncSoon()
  })

  resume()
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('online', resume)
  window.addEventListener('offline', goOffline)
  return () => {
    window.clearInterval(interval)
    stopWatching()
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('online', resume)
    window.removeEventListener('offline', goOffline)
  }
}
