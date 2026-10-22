import { type CalendarEvent, Temporal, uuidv7 } from '@meandu/core'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Lang } from '../i18n/locale'
import { todayDate, zone } from '../lib/time'
import { createSeed, type Seed } from './seed'
import { useSettings } from './settings'
import type { List, ListItem, Memory, Person } from './types'

type Undo = () => void

interface DataState extends Seed {
  saveEvent: (event: CalendarEvent) => void
  deleteEvent: (id: string) => Undo
  addList: (title: string, emoji: string) => string
  addItem: (listId: string, text: string) => void
  toggleItem: (listId: string, itemId: string) => void
  deleteItem: (listId: string, itemId: string) => Undo
  saveMemory: (memory: Memory) => void
  deleteMemory: (id: string) => Undo
  updatePerson: (who: 'me' | 'partner', patch: Partial<Omit<Person, 'id'>>) => void
  setTogetherSince: (date: string) => void
  reset: (lang: Lang) => void
}

function without<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id)
}

function upsert<T extends { id: string }>(items: T[], next: T): T[] {
  return items.some((item) => item.id === next.id)
    ? items.map((item) => (item.id === next.id ? next : item))
    : [...items, next]
}

function insertAt<T>(items: T[], index: number, item: T): T[] {
  const copy = [...items]
  copy.splice(Math.min(index, copy.length), 0, item)
  return copy
}

const now = () => Temporal.Now.instant().toString()

export const useData = create<DataState>()(
  persist(
    (set, get) => {
      const updateList = (listId: string, update: (list: List) => List) =>
        set((s) => ({ lists: s.lists.map((list) => (list.id === listId ? update(list) : list)) }))

      return {
        ...createSeed(useSettings.getState().lang, todayDate(), zone),

        saveEvent: (event) => set((s) => ({ events: upsert(s.events, event) })),

        deleteEvent: (id) => {
          const index = get().events.findIndex((e) => e.id === id)
          const event = get().events[index]
          set((s) => ({ events: without(s.events, id) }))
          return () => {
            if (event) set((s) => ({ events: insertAt(s.events, index, event) }))
          }
        },

        addList: (title, emoji) => {
          const id = uuidv7()
          set((s) => ({ lists: [...s.lists, { id, title, emoji, items: [], createdAt: now() }] }))
          return id
        },

        addItem: (listId, text) => {
          const item: ListItem = {
            id: uuidv7(),
            text,
            done: false,
            assigneeId: null,
            createdAt: now(),
          }
          updateList(listId, (list) => ({ ...list, items: [item, ...list.items] }))
        },

        toggleItem: (listId, itemId) =>
          updateList(listId, (list) => ({
            ...list,
            items: list.items.map((item) =>
              item.id === itemId
                ? { ...item, done: !item.done, doneAt: item.done ? undefined : now() }
                : item,
            ),
          })),

        deleteItem: (listId, itemId) => {
          const list = get().lists.find((l) => l.id === listId)
          const index = list?.items.findIndex((i) => i.id === itemId) ?? -1
          const item = list?.items[index]
          updateList(listId, (l) => ({ ...l, items: without(l.items, itemId) }))
          return () => {
            if (item) updateList(listId, (l) => ({ ...l, items: insertAt(l.items, index, item) }))
          }
        },

        saveMemory: (memory) => set((s) => ({ memories: upsert(s.memories, memory) })),

        deleteMemory: (id) => {
          const index = get().memories.findIndex((m) => m.id === id)
          const memory = get().memories[index]
          set((s) => ({ memories: without(s.memories, id) }))
          return () => {
            if (memory) set((s) => ({ memories: insertAt(s.memories, index, memory) }))
          }
        },

        updatePerson: (who, patch) => set((s) => ({ [who]: { ...s[who], ...patch } })),

        setTogetherSince: (date) => set({ togetherSince: date }),

        reset: (lang) => set(createSeed(lang, todayDate(), zone)),
      }
    },
    { name: 'meandu-data', version: 1 },
  ),
)
