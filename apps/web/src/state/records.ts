import type { CalendarEvent, Mutation, RemoteRecord } from '@meandu/core'
import { type List, type ListItem, type Memory, type Person, TONES, type Tone } from './types'

/** Everything a space holds, as plain objects. */
export interface Content {
  people: Person[]
  togetherSince: string | null
  events: CalendarEvent[]
  lists: List[]
  items: ListItem[]
  memories: Memory[]
}

export const emptyContent = (): Content => ({
  people: [],
  togetherSince: null,
  events: [],
  lists: [],
  items: [],
  memories: [],
})

type Json = Record<string, unknown>

/** JSON-safe copy without `undefined` fields. */
export function toJson(value: object): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

/** Only the fields that changed; removed fields become `null` so the server forgets them. */
export function diff(previous: object | undefined, next: object): Json | null {
  if (!previous) return toJson(next)
  const before = toJson(previous)
  const after = toJson(next)
  const changes: Json = {}
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = key in after ? after[key] : null
    }
  }
  return Object.keys(changes).length ? changes : null
}

function withoutNulls(data: Json): Json {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null && v !== undefined))
}

const str = (v: unknown): v is string => typeof v === 'string'

// Records come from the other phone too, so anything malformed is ignored rather than shown.
const validators: Record<Mutation['kind'], (d: Json) => boolean> = {
  event: (d) =>
    str(d.title) &&
    (d.allDay === true
      ? str(d.startDate) && str(d.endDate)
      : str(d.start) && str(d.end) && str(d.timeZone)),
  list: (d) => str(d.title) && str(d.emoji),
  item: (d) => str(d.listId) && str(d.text) && typeof d.done === 'boolean',
  memory: (d) => str(d.title) && str(d.date) && Array.isArray(d.photos),
  person: (d) => str(d.name) && TONES.includes(d.tone as Tone),
  settings: () => true,
}

// In a change, null means "remove this field". These fields use null as a real value
// ("for both of us", "whoever gets to it"), so a missing one reads as null.
const NULLABLE: Partial<Record<Mutation['kind'], Json>> = {
  event: { forUserId: null },
  item: { assigneeId: null },
}

function put<T extends { id: string }>(items: T[], id: string, value: T | undefined): T[] {
  const index = items.findIndex((item) => item.id === id)
  if (!value) return index === -1 ? items : items.filter((item) => item.id !== id)
  if (index === -1) return [...items, value]
  const copy = [...items]
  copy[index] = value
  return copy
}

function collectionOf(kind: Mutation['kind']): keyof Omit<Content, 'togetherSince'> | null {
  switch (kind) {
    case 'event':
      return 'events'
    case 'list':
      return 'lists'
    case 'item':
      return 'items'
    case 'memory':
      return 'memories'
    case 'person':
      return 'people'
    case 'settings':
      return null
  }
}

/**
 * Sets a record to `data` (merged over what's there when `merge`), or removes it.
 * Shared by incoming server records and by re-applying this device's unsent changes.
 */
function write(
  content: Content,
  kind: Mutation['kind'],
  id: string,
  data: Json | undefined,
  merge: boolean,
): Content {
  const key = collectionOf(kind)
  if (!key) {
    if (!data) return { ...content, togetherSince: null }
    const next = merge ? data.togetherSince : (data.togetherSince ?? null)
    return next === undefined ? content : { ...content, togetherSince: str(next) ? next : null }
  }
  const collection = content[key] as { id: string }[]
  if (!data) return { ...content, [key]: put(collection, id, undefined) }
  const existing = merge ? (collection.find((x) => x.id === id) as Json | undefined) : undefined
  const value = { ...NULLABLE[kind], ...withoutNulls({ ...(existing ?? {}), ...data, id }) }
  if (!validators[kind](value))
    return merge ? content : { ...content, [key]: put(collection, id, undefined) }
  return { ...content, [key]: put(collection, id, value as unknown as { id: string }) }
}

export function applyRemote(content: Content, record: RemoteRecord): Content {
  return write(content, record.kind, record.id, record.deleted ? undefined : record.data, false)
}

export function applyLocal(content: Content, mutation: Mutation): Content {
  return write(
    content,
    mutation.kind,
    mutation.id,
    mutation.op === 'delete' ? undefined : (mutation.data ?? {}),
    true,
  )
}
