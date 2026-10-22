import { describe, expect, it } from 'vitest'
import { dayCount, nextMilestone, previousMilestone } from './countdown'
import { monthMatrix, startOfWeek, weekdayOrder } from './dates'
import { uuidv7 } from './ids'
import { Temporal } from './temporal'

describe('monthMatrix', () => {
  it('always returns six full weeks starting on the chosen weekday', () => {
    const weeks = monthMatrix(Temporal.PlainYearMonth.from('2026-10'), 1)
    expect(weeks).toHaveLength(6)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks[0]?.[0]?.toString()).toBe('2026-09-28')
    expect(weeks[5]?.[6]?.toString()).toBe('2026-11-08')
  })

  it('supports Sunday-first weeks', () => {
    const weeks = monthMatrix(Temporal.PlainYearMonth.from('2026-10'), 7)
    expect(weeks[0]?.[0]?.toString()).toBe('2026-09-27')
  })
})

describe('weeks', () => {
  it('finds the start of the week', () => {
    expect(startOfWeek(Temporal.PlainDate.from('2026-10-22'), 1).toString()).toBe('2026-10-19')
    expect(startOfWeek(Temporal.PlainDate.from('2026-10-22'), 7).toString()).toBe('2026-10-18')
  })

  it('orders weekdays', () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(weekdayOrder(7)).toEqual([7, 1, 2, 3, 4, 5, 6])
  })
})

describe('days together', () => {
  it('counts the first day as day 1', () => {
    const since = Temporal.PlainDate.from('2023-05-12')
    expect(dayCount(since, since)).toBe(1)
    expect(dayCount(since, Temporal.PlainDate.from('2023-05-13'))).toBe(2)
  })

  it('finds the next milestone', () => {
    expect(nextMilestone(1)).toBe(100)
    expect(nextMilestone(100)).toBe(100)
    expect(nextMilestone(101)).toBe(200)
    expect(nextMilestone(1087)).toBe(1100)
    expect(nextMilestone(3000)).toBe(3000)
    expect(nextMilestone(3001)).toBe(4000)
    expect(previousMilestone(1100)).toBe(1000)
    expect(previousMilestone(4000)).toBe(3000)
  })
})

describe('uuidv7', () => {
  it('is a valid, time-ordered v7 UUID', () => {
    const a = uuidv7(1_700_000_000_000)
    const b = uuidv7(1_700_000_000_001)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(a < b).toBe(true)
  })
})
