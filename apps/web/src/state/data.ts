import {
  type CalendarEvent,
  type Mutation,
  type SpaceState,
  type SyncResponse,
  Temporal,
  uuidv7,
} from '@meandu/core'
import { del, get, set as idbSet } from 'idb-keyval'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Lang } from '../i18n/locale'
import { todayDate, zone } from '../lib/time'
import { applyLocal, applyRemote, type Content, diff, emptyContent, toJson } from './records'
import { createSeed } from './seed'
import type { List, ListItem, Memory, Person } from './types'

/**
 * `none`: first launch, show onboarding. `demo`: sample data that never leaves the phone.
 * `synced`: a real space, saved on the phone first and synced with the server.
 */
export type Mode = 'none' | 'demo' | 'synced'

/** A change waiting to be sent. `seq` tells apart versions of the same change. */
export interface OutboxEntry extends Mutation {
  seq: number
}

interface Persisted extends Content {
  mode: Mode
  meId: string
  spaceId: string | null
  /** The last server version this phone has. */
  cursor: number
  outbox: OutboxEntry[]
  seq: number
}

type Undo = () => void

interface DataState extends Persisted {
  hydrated: boolean
  startDemo: (lang: Lang) => void
  /** Back to onboarding, forgetting everything on this phone. */
  reset: () => void
  /** Switches to a real space. `known` is what this phone already knows, until the first sync. */
  beginSynced: (state: SpaceState, known?: Partial<Content>) => void
  acknowledge: (sent: OutboxEntry[], response: SyncResponse) => void
  saveEvent: (event: CalendarEvent) => void
  deleteEvent: (id: string) => Undo
  addList: (title: string, emoji: string) => string
  updateList: (id: string, patch: Partial<Pick<List, 'title' | 'emoji'>>) => void
  /** Deletes the list with everything on it. */
  deleteList: (id: string) => Undo
  addItem: (listId: string, text: string) => void
  updateItem: (id: string, patch: Partial<Pick<ListItem, 'text' | 'assigneeId'>>) => void
  toggleItem: (id: string) => void
  deleteItem: (id: string) => Undo
  saveMemory: (memory: Memory) => void
  deleteMemory: (id: string) => Undo
  updatePerson: (id: string, patch: Partial<Omit<Person, 'id'>>) => void
  setTogetherSince: (date: string | null) => void
}

const initial = (): Persisted => ({
  ...emptyContent(),
  mode: 'none',
  meId: '',
  spaceId: null,
  cursor: 0,
  outbox: [],
  seq: 0,
})

const now = () => Temporal.Now.instant().toString()

/** Folds a change into the outbox, merging with an unsent change to the same thing. */
function enqueue(s: Persisted, mutation: Mutation): Pick<Persisted, 'outbox' | 'seq'> {
  if (s.mode !== 'synced') return { outbox: s.outbox, seq: s.seq }
  const seq = s.seq + 1
  const existing = s.outbox.find((e) => e.kind === mutation.kind && e.id === mutation.id)
  const entry: OutboxEntry =
    existing && existing.op === 'put' && mutation.op === 'put'
      ? { ...existing, data: { ...existing.data, ...mutation.data }, seq }
      : { ...mutation, seq }
  return { outbox: [...s.outbox.filter((e) => e !== existing), entry], seq }
}

/** Applies a change locally and queues it for the server, in one state update. */
function change(s: Persisted, mutation: Mutation): Partial<Persisted> {
  return { ...applyLocal(s, mutation), ...enqueue(s, mutation) }
}

function contentOf(s: Persisted): Content {
  return {
    people: s.people,
    togetherSince: s.togetherSince,
    events: s.events,
    lists: s.lists,
    items: s.items,
    memories: s.memories,
  }
}

const storage = createJSONStorage<Persisted>(() => ({
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: (name, value) => idbSet(name, value),
  removeItem: (name) => del(name),
}))

try {
  // The first prototype kept its demo data in localStorage; it now lives in IndexedDB.
  localStorage.removeItem('meandu-data')
} catch {}

export const useData = create<DataState>()(
  persist(
    (set, get) => {
      const remove = <K extends 'events' | 'lists' | 'items' | 'memories'>(
        kind: Mutation['kind'],
        key: K,
        id: string,
      ): Undo => {
        const item = (get()[key] as { id: string }[]).find((x) => x.id === id)
        set((s) => change(s, { kind, id, op: 'delete' }))
        return () => {
          if (item) set((s) => change(s, { kind, id, op: 'put', data: toJson(item) }))
        }
      }

      return {
        ...initial(),
        hydrated: false,

        startDemo: (lang) => {
          const seed = createSeed(lang, todayDate(), zone)
          set({ ...initial(), ...seed, mode: 'demo', meId: seed.meId })
        },

        reset: () => set(initial()),

        beginSynced: (state, known) =>
          set({
            ...initial(),
            ...known,
            mode: 'synced',
            meId: state.userId,
            spaceId: state.spaceId,
          }),

        acknowledge: (sent, response) =>
          set((s) => {
            const sentSeqs = new Set(sent.map((e) => e.seq))
            const outbox = s.outbox.filter((e) => !sentSeqs.has(e.seq))
            // Moved to another space (joined a partner): start from what the server says.
            let content = response.spaceId === s.spaceId ? contentOf(s) : emptyContent()
            for (const record of response.records) content = applyRemote(content, record)
            // Changes made while this sync was in flight stay on top.
            for (const entry of outbox) content = applyLocal(content, entry)
            return { ...content, outbox, cursor: response.version, spaceId: response.spaceId }
          }),

        saveEvent: (event) => {
          const previous = get().events.find((e) => e.id === event.id)
          const data = diff(previous, event)
          if (data) set((s) => change(s, { kind: 'event', id: event.id, op: 'put', data }))
        },

        deleteEvent: (id) => remove('event', 'events', id),

        addList: (title, emoji) => {
          const list: List = { id: uuidv7(), title, emoji, createdAt: now() }
          set((s) => change(s, { kind: 'list', id: list.id, op: 'put', data: toJson(list) }))
          return list.id
        },

        updateList: (id, patch) =>
          set((s) => change(s, { kind: 'list', id, op: 'put', data: toJson(patch) })),

        deleteList: (id) => {
          const list = get().lists.find((l) => l.id === id)
          const items = get().items.filter((i) => i.listId === id)
          set((s) => {
            let next: Persisted = s
            for (const item of items)
              next = { ...next, ...change(next, { kind: 'item', id: item.id, op: 'delete' }) }
            return { ...next, ...change(next, { kind: 'list', id, op: 'delete' }) }
          })
          return () =>
            set((s) => {
              if (!list) return s
              let next: Persisted = {
                ...s,
                ...change(s, { kind: 'list', id, op: 'put', data: toJson(list) }),
              }
              for (const item of items) {
                next = {
                  ...next,
                  ...change(next, { kind: 'item', id: item.id, op: 'put', data: toJson(item) }),
                }
              }
              return next
            })
        },

        addItem: (listId, text) => {
          const item: ListItem = {
            id: uuidv7(),
            listId,
            text,
            done: false,
            assigneeId: null,
            createdAt: now(),
          }
          set((s) => change(s, { kind: 'item', id: item.id, op: 'put', data: toJson(item) }))
        },

        updateItem: (id, patch) =>
          // `assigneeId: null` (anyone) goes out as null, which the other phone reads the same way.
          set((s) => change(s, { kind: 'item', id, op: 'put', data: { ...patch } })),

        toggleItem: (id) => {
          const item = get().items.find((i) => i.id === id)
          if (!item) return
          const data = { done: !item.done, doneAt: item.done ? null : now() }
          set((s) => change(s, { kind: 'item', id, op: 'put', data }))
        },

        deleteItem: (id) => remove('item', 'items', id),

        saveMemory: (memory) => {
          const previous = get().memories.find((m) => m.id === memory.id)
          const data = diff(previous, memory)
          if (data) set((s) => change(s, { kind: 'memory', id: memory.id, op: 'put', data }))
        },

        deleteMemory: (id) => remove('memory', 'memories', id),

        updatePerson: (id, patch) => {
          // In a real space you can only change your own name and colour.
          if (get().mode === 'synced' && id !== get().meId) return
          set((s) => change(s, { kind: 'person', id, op: 'put', data: toJson(patch) }))
        },

        setTogetherSince: (date) =>
          set((s) =>
            change(s, {
              kind: 'settings',
              id: `settings:${s.spaceId ?? 'local'}`,
              op: 'put',
              data: { togetherSince: date },
            }),
          ),
      }
    },
    {
      name: 'meandu-data',
      version: 2,
      storage,
      // Older versions kept a different shape; start fresh rather than guess.
      migrate: () => initial() as DataState,
      partialize: (s): Persisted => ({
        ...contentOf(s),
        mode: s.mode,
        meId: s.meId,
        spaceId: s.spaceId,
        cursor: s.cursor,
        outbox: s.outbox,
        seq: s.seq,
      }),
      onRehydrateStorage: () => () => {
        useData.setState({ hydrated: true })
      },
    },
  ),
)

const NOBODY: Person = { id: '', name: '', tone: 'coral' }

export function useMe(): Person {
  return useData((s) => s.people.find((p) => p.id === s.meId) ?? NOBODY)
}

/** Your person, once they've joined (always there in the demo). */
export function usePartner(): Person | null {
  return useData((s) => s.people.find((p) => p.id !== s.meId) ?? null)
}
