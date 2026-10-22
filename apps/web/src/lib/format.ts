import { daysBetween, type Occurrence, type Temporal } from '@meandu/core'
import type { Messages } from '../i18n'

export function formatTime(time: Temporal.ZonedDateTime, locale: string): string {
  return time.toLocaleString(locale, { hour: 'numeric', minute: '2-digit' })
}

export function formatDay(
  date: Temporal.PlainDate,
  locale: string,
  style: 'long' | 'short' = 'long',
): string {
  return date.toLocaleString(locale, {
    weekday: style,
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
  })
}

/** "Today", "Tomorrow", or the date. */
export function relativeDay(
  date: Temporal.PlainDate,
  today: Temporal.PlainDate,
  t: Messages,
  locale: string,
): string {
  const diff = daysBetween(today, date)
  if (diff === 0) return t.common.today
  if (diff === 1) return t.common.tomorrow
  if (diff === -1) return t.common.yesterday
  return formatDay(date, locale, Math.abs(diff) < 7 ? 'long' : 'short')
}

export function timeLabel(o: Occurrence, t: Messages, locale: string): string {
  if (o.allDay || !o.start || !o.end) return t.common.allDay
  return `${formatTime(o.start, locale)} – ${formatTime(o.end, locale)}`
}

export function formatMonth(
  month: Temporal.PlainYearMonth,
  locale: string,
  withYear: boolean,
): string {
  return month
    .toPlainDate({ day: 1 })
    .toLocaleString(locale, withYear ? { month: 'long', year: 'numeric' } : { month: 'long' })
}
