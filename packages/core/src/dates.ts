import { Temporal } from './temporal'

/** ISO weekday the week starts on: 1 = Monday … 7 = Sunday. */
export type WeekStart = 1 | 2 | 3 | 4 | 5 | 6 | 7

export function daysBetween(from: Temporal.PlainDate, to: Temporal.PlainDate): number {
  return from.until(to, { largestUnit: 'days' }).days
}

export function isSameDay(a: Temporal.PlainDate, b: Temporal.PlainDate): boolean {
  return Temporal.PlainDate.compare(a, b) === 0
}

export function startOfWeek(date: Temporal.PlainDate, weekStart: WeekStart): Temporal.PlainDate {
  return date.subtract({ days: (date.dayOfWeek - weekStart + 7) % 7 })
}

/** ISO weekdays in display order, e.g. [1…7] for Monday-first weeks. */
export function weekdayOrder(weekStart: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => ((weekStart - 1 + i) % 7) + 1)
}

/** Six full weeks covering the month, so the grid never changes height. */
export function monthMatrix(
  month: Temporal.PlainYearMonth,
  weekStart: WeekStart,
): Temporal.PlainDate[][] {
  let cursor = startOfWeek(month.toPlainDate({ day: 1 }), weekStart)
  const weeks: Temporal.PlainDate[][] = []
  for (let w = 0; w < 6; w++) {
    const week: Temporal.PlainDate[] = []
    for (let d = 0; d < 7; d++) {
      week.push(cursor)
      cursor = cursor.add({ days: 1 })
    }
    weeks.push(week)
  }
  return weeks
}
