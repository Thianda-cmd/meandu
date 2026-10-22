import { describe, expect, it } from 'vitest'
import { nextOccurrence, occurrencesBetween, occurrencesOn } from './recurrence'
import { Temporal } from './temporal'
import type { AllDayEvent, TimedEvent } from './types'

const date = (iso: string) => Temporal.PlainDate.from(iso)

const base = {
  title: 'x',
  forUserId: null,
  visibility: 'shared',
  kind: 'event',
  repeat: 'none',
  isCountdown: false,
  createdBy: 'u1',
  createdAt: '2026-01-01T00:00:00Z',
} as const

function timed(over: Partial<TimedEvent> & Pick<TimedEvent, 'start' | 'end'>): TimedEvent {
  return { ...base, id: 'e1', allDay: false, timeZone: 'Europe/Berlin', ...over }
}

function allDay(
  over: Partial<AllDayEvent> & Pick<AllDayEvent, 'startDate' | 'endDate'>,
): AllDayEvent {
  return { ...base, id: 'a1', allDay: true, ...over }
}

describe('occurrencesBetween', () => {
  it('keeps the wall-clock time of weekly events across the DST change', () => {
    // 09:00 in Berlin on Mondays; clocks go forward on 29 March 2026.
    const event = timed({
      start: '2026-03-16T08:00:00Z',
      end: '2026-03-16T09:00:00Z',
      repeat: 'weekly',
    })
    const result = occurrencesBetween(
      [event],
      date('2026-03-16'),
      date('2026-04-07'),
      'Europe/Berlin',
    )
    expect(result.map((o) => o.start?.toPlainDateTime().toString())).toEqual([
      '2026-03-16T09:00:00',
      '2026-03-23T09:00:00',
      '2026-03-30T09:00:00',
      '2026-04-06T09:00:00',
    ])
  })

  it('shows timed events on the right day in the viewer’s time zone', () => {
    // 20:00 in Berlin is 14:00 in New York, but 03:00 the next day in Tokyo.
    const event = timed({ start: '2026-06-10T18:00:00Z', end: '2026-06-10T19:00:00Z' })
    const tokyo = occurrencesBetween([event], date('2026-06-01'), date('2026-07-01'), 'Asia/Tokyo')
    expect(tokyo[0]?.startDate.toString()).toBe('2026-06-11')
    const ny = occurrencesBetween(
      [event],
      date('2026-06-01'),
      date('2026-07-01'),
      'America/New_York',
    )
    expect(ny[0]?.startDate.toString()).toBe('2026-06-10')
  })

  it('moves Feb 29 birthdays to Feb 28 in other years', () => {
    const event = allDay({
      startDate: '2024-02-29',
      endDate: '2024-03-01',
      repeat: 'yearly',
      kind: 'birthday',
    })
    const result = occurrencesBetween([event], date('2027-01-01'), date('2029-01-01'), 'UTC')
    expect(result.map((o) => o.startDate.toString())).toEqual(['2027-02-28', '2028-02-29'])
  })

  it('keeps monthly events on the 31st where the month has one', () => {
    const event = allDay({ startDate: '2026-01-31', endDate: '2026-02-01', repeat: 'monthly' })
    const result = occurrencesBetween([event], date('2026-01-01'), date('2026-04-01'), 'UTC')
    expect(result.map((o) => o.startDate.toString())).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ])
  })

  it('covers every day of a multi-day trip, but not the end date', () => {
    const trip = allDay({ startDate: '2026-11-06', endDate: '2026-11-09' })
    const [o] = occurrencesBetween([trip], date('2026-11-01'), date('2026-12-01'), 'UTC')
    expect(o).toBeDefined()
    if (!o) return
    expect(occurrencesOn([o], date('2026-11-08'))).toHaveLength(1)
    expect(occurrencesOn([o], date('2026-11-09'))).toHaveLength(0)
  })

  it('shows events that run past midnight on both days', () => {
    const party = timed({ start: '2026-12-31T21:00:00Z', end: '2027-01-01T02:00:00Z' })
    const [o] = occurrencesBetween([party], date('2026-12-01'), date('2027-02-01'), 'Europe/Berlin')
    expect(o?.startDate.toString()).toBe('2026-12-31')
    expect(o?.endDate.toString()).toBe('2027-01-02')
  })

  it('does not spill into the next day when ending exactly at midnight', () => {
    const evening = timed({ start: '2026-05-01T19:00:00Z', end: '2026-05-01T22:00:00Z' })
    const [o] = occurrencesBetween(
      [evening],
      date('2026-05-01'),
      date('2026-05-03'),
      'Europe/Berlin',
    )
    expect(o?.endDate.toString()).toBe('2026-05-02')
  })

  it('stops repeating after repeatUntil', () => {
    const event = allDay({
      startDate: '2026-01-05',
      endDate: '2026-01-06',
      repeat: 'weekly',
      repeatUntil: '2026-01-19',
    })
    const result = occurrencesBetween([event], date('2026-01-01'), date('2026-03-01'), 'UTC')
    expect(result).toHaveLength(3)
  })

  it('jumps straight to the requested range for long-running repeats', () => {
    const daily = allDay({ startDate: '2000-01-01', endDate: '2000-01-02', repeat: 'daily' })
    const result = occurrencesBetween([daily], date('2026-10-01'), date('2026-10-08'), 'UTC')
    expect(result.map((o) => o.startDate.toString())).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ])
  })

  it('sorts all-day events before timed ones on the same day', () => {
    const lunch = timed({ id: 'lunch', start: '2026-07-01T10:00:00Z', end: '2026-07-01T11:00:00Z' })
    const holiday = allDay({ id: 'holiday', startDate: '2026-07-01', endDate: '2026-07-02' })
    const result = occurrencesBetween(
      [lunch, holiday],
      date('2026-07-01'),
      date('2026-07-02'),
      'UTC',
    )
    expect(result.map((o) => o.event.id)).toEqual(['holiday', 'lunch'])
  })
})

describe('nextOccurrence', () => {
  it('finds next year’s anniversary once this year’s has passed', () => {
    const anniversary = allDay({
      startDate: '2023-05-12',
      endDate: '2023-05-13',
      repeat: 'yearly',
      kind: 'anniversary',
    })
    expect(nextOccurrence(anniversary, date('2026-06-01'), 'UTC')?.startDate.toString()).toBe(
      '2027-05-12',
    )
  })

  it('counts an ongoing trip as the next occurrence', () => {
    const trip = allDay({ startDate: '2026-11-06', endDate: '2026-11-09' })
    expect(nextOccurrence(trip, date('2026-11-07'), 'UTC')?.startDate.toString()).toBe('2026-11-06')
  })
})
