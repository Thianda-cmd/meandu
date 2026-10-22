import { describe, expect, it } from 'vitest'
import { applyLocal, applyRemote, diff, emptyContent } from './records'

const list = { id: 'l1', title: 'Groceries', emoji: '🛒', createdAt: '2026-01-01T00:00:00Z' }

describe('diff', () => {
  it('keeps only what changed, and marks removed fields with null', () => {
    expect(diff({ a: 1, b: 2, c: 3 }, { a: 1, b: 5 })).toEqual({ b: 5, c: null })
  })

  it('returns null when nothing changed', () => {
    expect(diff({ a: [1, 2] }, { a: [1, 2] })).toBeNull()
  })

  it('sends everything for something new', () => {
    expect(diff(undefined, { a: 1, b: undefined })).toEqual({ a: 1 })
  })
})

describe('applyRemote', () => {
  it('adds, replaces and removes records', () => {
    let content = applyRemote(emptyContent(), {
      kind: 'list',
      id: 'l1',
      data: list,
      deleted: false,
    })
    expect(content.lists).toEqual([list])

    // The server sends the whole record, so fields it doesn't have are gone.
    content = applyRemote(content, {
      kind: 'list',
      id: 'l1',
      data: { title: 'Food', emoji: '🍎' },
      deleted: false,
    })
    expect(content.lists).toEqual([{ id: 'l1', title: 'Food', emoji: '🍎' }])

    content = applyRemote(content, { kind: 'list', id: 'l1', deleted: true })
    expect(content.lists).toEqual([])
  })

  it('ignores malformed records instead of showing them', () => {
    const content = applyRemote(emptyContent(), {
      kind: 'item',
      id: 'i1',
      data: { text: 'Milk' },
      deleted: false,
    })
    expect(content.items).toEqual([])
  })

  it('reads the space settings', () => {
    const content = applyRemote(emptyContent(), {
      kind: 'settings',
      id: 'settings:s1',
      data: { togetherSince: '2023-05-01' },
      deleted: false,
    })
    expect(content.togetherSince).toBe('2023-05-01')
  })
})

describe('applyLocal', () => {
  it('merges changes into what is there, null removing a field', () => {
    let content = applyLocal(emptyContent(), { kind: 'list', id: 'l1', op: 'put', data: list })
    content = applyLocal(content, {
      kind: 'list',
      id: 'l1',
      op: 'put',
      data: { title: 'Food', createdAt: null },
    })
    expect(content.lists).toEqual([{ id: 'l1', title: 'Food', emoji: '🛒' }])
  })

  it('keeps plans that are for both of you that way', () => {
    const data = {
      title: 'Dinner',
      allDay: true,
      startDate: '2026-01-01',
      endDate: '2026-01-02',
      forUserId: null,
    }
    let content = applyLocal(emptyContent(), { kind: 'event', id: 'e1', op: 'put', data })
    expect(content.events[0]?.forUserId).toBeNull()
    content = applyRemote(content, { kind: 'event', id: 'e1', data, deleted: false })
    expect(content.events[0]?.forUserId).toBeNull()
  })

  it('leaves the date alone when a settings change does not mention it', () => {
    let content = applyLocal(emptyContent(), {
      kind: 'settings',
      id: 'settings:s1',
      op: 'put',
      data: { togetherSince: '2023-05-01' },
    })
    content = applyLocal(content, { kind: 'settings', id: 'settings:s1', op: 'put', data: {} })
    expect(content.togetherSince).toBe('2023-05-01')
  })
})
