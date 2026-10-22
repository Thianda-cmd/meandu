import type { CalendarEvent, SpaceState, SyncResponse } from '@meandu/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The store saves to IndexedDB; an in-memory stand-in is enough here.
vi.mock('idb-keyval', () => {
  const saved = new Map<string, unknown>()
  return {
    get: async (key: string) => saved.get(key),
    set: async (key: string, value: unknown) => void saved.set(key, value),
    del: async (key: string) => void saved.delete(key),
  }
})

const { useData } = await import('./data')

const space: SpaceState = {
  spaceId: 's1',
  userId: 'me',
  status: 'active',
  members: [],
  pausedBy: null,
  wantsBack: [],
}

const dinner: CalendarEvent = {
  id: 'e1',
  title: 'Dinner',
  allDay: false,
  start: '2026-10-22T17:30:00Z',
  end: '2026-10-22T20:00:00Z',
  timeZone: 'Europe/Berlin',
  forUserId: null,
  visibility: 'shared',
  kind: 'event',
  repeat: 'none',
  isCountdown: false,
  createdBy: 'me',
  createdAt: '2026-10-01T00:00:00Z',
}

const response = (records: SyncResponse['records'], version = 5): SyncResponse => ({
  spaceId: 's1',
  version,
  records,
  more: false,
})

beforeEach(() => {
  useData.getState().reset()
  useData.getState().beginSynced(space)
})

describe('outbox', () => {
  it('folds repeated edits of one thing into a single change', () => {
    const { saveEvent } = useData.getState()
    saveEvent(dinner)
    saveEvent({ ...dinner, title: 'Late dinner' })

    const { outbox } = useData.getState()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]?.data?.title).toBe('Late dinner')
    expect(outbox[0]?.data?.start).toBe(dinner.start)
  })

  it('keeps nothing to send in the demo', () => {
    useData.getState().startDemo('en')
    useData.getState().saveEvent(dinner)
    expect(useData.getState().outbox).toEqual([])
  })

  it('undoes a delete by putting the whole thing back', () => {
    useData.getState().saveEvent(dinner)
    const undo = useData.getState().deleteEvent('e1')
    expect(useData.getState().events).toEqual([])
    undo()
    expect(useData.getState().events).toEqual([dinner])
    expect(useData.getState().outbox.at(-1)).toMatchObject({ op: 'put', id: 'e1' })
  })
})

describe('acknowledge', () => {
  it('clears what was sent and keeps changes made while the request was out', () => {
    useData.getState().saveEvent(dinner)
    const sent = useData.getState().outbox
    // Edited again before the server answered.
    useData.getState().saveEvent({ ...dinner, title: 'Late dinner' })

    useData
      .getState()
      .acknowledge(
        sent,
        response([{ kind: 'event', id: 'e1', data: { ...dinner, id: undefined }, deleted: false }]),
      )

    const state = useData.getState()
    expect(state.cursor).toBe(5)
    expect(state.outbox).toHaveLength(1)
    // The newer local title wins until it has been sent too.
    expect(state.events[0]?.title).toBe('Late dinner')
  })

  it("applies your person's changes", () => {
    useData.getState().acknowledge(
      [],
      response([
        { kind: 'person', id: 'you', data: { name: 'Alex', tone: 'sage' }, deleted: false },
        { kind: 'event', id: 'e1', data: { ...dinner }, deleted: false },
      ]),
    )
    const state = useData.getState()
    expect(state.people.map((p) => p.name)).toEqual(['Alex'])
    expect(state.events).toHaveLength(1)
  })

  it('starts over from what the server says after moving to another space', () => {
    useData.getState().saveEvent(dinner)
    useData.getState().acknowledge(useData.getState().outbox, response([]))
    expect(useData.getState().events).toHaveLength(1)

    useData.getState().acknowledge([], { ...response([]), spaceId: 's2' })
    expect(useData.getState().events).toEqual([])
    expect(useData.getState().spaceId).toBe('s2')
  })
})

describe('lists', () => {
  it('deletes a list with everything on it, and undo brings it all back', () => {
    const { addList, addItem, deleteList } = useData.getState()
    const id = addList('Groceries', '🛒')
    addItem(id, 'Oat milk')
    addItem(id, 'Basil')
    const other = addList('Ideas', '💡')
    addItem(other, 'Pottery class')

    const undo = deleteList(id)
    let state = useData.getState()
    expect(state.lists.map((l) => l.title)).toEqual(['Ideas'])
    expect(state.items.map((i) => i.text)).toEqual(['Pottery class'])
    expect(state.outbox.filter((e) => e.op === 'delete')).toHaveLength(3)

    undo()
    state = useData.getState()
    expect(state.lists.map((l) => l.title).sort()).toEqual(['Groceries', 'Ideas'])
    expect(
      state.items
        .filter((i) => i.listId === id)
        .map((i) => i.text)
        .sort(),
    ).toEqual(['Basil', 'Oat milk'])
    expect(state.outbox.every((e) => e.op === 'put')).toBe(true)
  })

  it('sends "anyone" as null, which reads back the same on the other phone', () => {
    const { addList, addItem, updateItem } = useData.getState()
    const list = addList('Home', '🏠')
    addItem(list, 'Fix the shelf')
    const item = useData.getState().items[0]
    if (!item) throw new Error('no item')

    updateItem(item.id, { assigneeId: 'you', text: 'Fix the shelf properly' })
    expect(useData.getState().items[0]).toMatchObject({
      assigneeId: 'you',
      text: 'Fix the shelf properly',
    })
    updateItem(item.id, { assigneeId: null })
    expect(useData.getState().items[0]?.assigneeId).toBeNull()
    expect(useData.getState().outbox.at(-1)?.data).toMatchObject({ assigneeId: null })
  })
})
