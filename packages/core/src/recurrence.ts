import { daysBetween } from './dates'
import { Temporal } from './temporal'
import type { CalendarEvent, Repeat } from './types'

export interface Occurrence {
  /** Unique per occurrence: event id + the day it starts on in the event's own zone. */
  key: string
  event: CalendarEvent
  allDay: boolean
  /** First day covered, in the viewer's time zone. */
  startDate: Temporal.PlainDate
  /** Day after the last covered day, in the viewer's time zone. */
  endDate: Temporal.PlainDate
  /** Timed events only, in the viewer's time zone. */
  start?: Temporal.ZonedDateTime
  end?: Temporal.ZonedDateTime
}

interface Candidate extends Occurrence {
  /** Start day in the event's own zone; `repeatUntil` is compared against this. */
  originDate: Temporal.PlainDate
}

const MAX_STEPS = 5000

function offset(repeat: Exclude<Repeat, 'none'>, i: number): Temporal.DurationLike {
  switch (repeat) {
    case 'daily':
      return { days: i }
    case 'weekly':
      return { weeks: i }
    case 'monthly':
      return { months: i }
    case 'yearly':
      return { years: i }
  }
}

/** Index of an occurrence that starts safely before `from`, so we don't walk years of history. */
function firstIndex(
  repeat: Exclude<Repeat, 'none'>,
  origin: Temporal.PlainDate,
  from: Temporal.PlainDate,
  spanDays: number,
): number {
  const target = from.subtract({ days: spanDays + 1 })
  if (Temporal.PlainDate.compare(target, origin) <= 0) return 0
  switch (repeat) {
    case 'daily':
      return Math.max(0, daysBetween(origin, target) - 1)
    case 'weekly':
      return Math.max(0, Math.floor(daysBetween(origin, target) / 7) - 1)
    case 'monthly':
      return Math.max(0, origin.until(target, { largestUnit: 'months' }).months - 1)
    case 'yearly':
      return Math.max(0, origin.until(target, { largestUnit: 'years' }).years - 1)
  }
}

function candidateFactory(event: CalendarEvent, zone: string): (i: number) => Candidate {
  if (event.allDay) {
    const start = Temporal.PlainDate.from(event.startDate)
    const span = Math.max(1, daysBetween(start, Temporal.PlainDate.from(event.endDate)))
    return (i) => {
      const s = event.repeat === 'none' ? start : start.add(offset(event.repeat, i))
      return {
        key: `${event.id}@${s}`,
        event,
        allDay: true,
        originDate: s,
        startDate: s,
        endDate: s.add({ days: span }),
      }
    }
  }

  const start = Temporal.Instant.from(event.start).toZonedDateTimeISO(event.timeZone)
  const duration = start.until(Temporal.Instant.from(event.end).toZonedDateTimeISO(event.timeZone))
  return (i) => {
    // Adding calendar units to a zoned time keeps the wall-clock time across DST changes.
    const s = event.repeat === 'none' ? start : start.add(offset(event.repeat, i))
    const e = s.add(duration)
    const local = s.withTimeZone(zone)
    const localEnd = e.withTimeZone(zone)
    const startDate = local.toPlainDate()
    let endDate = localEnd.toPlainDate()
    // An event ending exactly at midnight doesn't cover the next day.
    const endsAtMidnight = localEnd.toPlainTime().equals(Temporal.PlainTime.from('00:00'))
    if (!endsAtMidnight || Temporal.PlainDate.compare(endDate, startDate) <= 0) {
      endDate = endDate.add({ days: 1 })
    }
    return {
      key: `${event.id}@${s.toPlainDate()}`,
      event,
      allDay: false,
      originDate: s.toPlainDate(),
      startDate,
      endDate,
      start: local,
      end: localEnd,
    }
  }
}

function overlaps(o: Occurrence, from: Temporal.PlainDate, to: Temporal.PlainDate): boolean {
  return (
    Temporal.PlainDate.compare(o.startDate, to) < 0 &&
    Temporal.PlainDate.compare(o.endDate, from) > 0
  )
}

function strip({ originDate: _, ...occurrence }: Candidate): Occurrence {
  return occurrence
}

function expand(
  event: CalendarEvent,
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
  zone: string,
  out: Occurrence[],
): void {
  const at = candidateFactory(event, zone)
  const first = at(0)
  if (event.repeat === 'none') {
    if (overlaps(first, from, to)) out.push(strip(first))
    return
  }
  const until = event.repeatUntil ? Temporal.PlainDate.from(event.repeatUntil) : undefined
  const span = daysBetween(first.startDate, first.endDate)
  let i = firstIndex(event.repeat, first.originDate, from, span)
  for (let steps = 0; steps < MAX_STEPS; steps++, i++) {
    const o = at(i)
    if (until && Temporal.PlainDate.compare(o.originDate, until) > 0) break
    if (Temporal.PlainDate.compare(o.startDate, to) >= 0) break
    if (overlaps(o, from, to)) out.push(strip(o))
  }
}

export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  return (
    Temporal.PlainDate.compare(a.startDate, b.startDate) ||
    Number(b.allDay) - Number(a.allDay) ||
    (a.start && b.start ? Temporal.ZonedDateTime.compare(a.start, b.start) : 0) ||
    a.event.title.localeCompare(b.event.title)
  )
}

/** All occurrences that touch the days `from` (inclusive) to `to` (exclusive). */
export function occurrencesBetween(
  events: readonly CalendarEvent[],
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
  zone: string,
): Occurrence[] {
  const out: Occurrence[] = []
  for (const event of events) expand(event, from, to, zone, out)
  return out.sort(compareOccurrences)
}

export function occurrencesOn(
  occurrences: readonly Occurrence[],
  day: Temporal.PlainDate,
): Occurrence[] {
  return occurrences.filter(
    (o) =>
      Temporal.PlainDate.compare(o.startDate, day) <= 0 &&
      Temporal.PlainDate.compare(o.endDate, day) > 0,
  )
}

/** The occurrence happening now or next, looking up to two years ahead. */
export function nextOccurrence(
  event: CalendarEvent,
  today: Temporal.PlainDate,
  zone: string,
): Occurrence | undefined {
  return occurrencesBetween([event], today, today.add({ years: 2 }), zone)[0]
}
