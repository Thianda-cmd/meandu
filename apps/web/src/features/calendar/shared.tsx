import { type CalendarEvent, type Occurrence, occurrencesBetween, Temporal } from '@meandu/core'
import { LockSimple } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { useLocale, useT } from '../../i18n'
import { timeLabel } from '../../lib/format'
import { zone } from '../../lib/time'
import { type ToneName, toneStyle, useToneFor } from '../../lib/tone'
import { useData } from '../../state/data'
import type { Person } from '../../state/types'
import { useCalendarUi } from '../../state/ui'
import { WhoBadge } from '../../ui/Avatar'
import { Pressable } from '../../ui/Pressable'

export function toneOf(event: CalendarEvent, me: Person, partner: Person): ToneName {
  if (event.forUserId === null) return 'lilac'
  return event.forUserId === me.id ? me.tone : partner.tone
}

/** Occurrences between two days, optionally hiding what the calendar filters hide. */
export function useOccurrences(
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
  { filtered = false }: { filtered?: boolean } = {},
): Occurrence[] {
  const events = useData((s) => s.events)
  const meId = useData((s) => s.me.id)
  const hidden = useCalendarUi((s) => s.hidden)
  const fromKey = from.toString()
  const toKey = to.toString()

  return useMemo(() => {
    const visible = filtered
      ? events.filter((e) => {
          if (e.forUserId === null) return !hidden.us
          return e.forUserId === meId ? !hidden.me : !hidden.partner
        })
      : events
    return occurrencesBetween(
      visible,
      Temporal.PlainDate.from(fromKey),
      Temporal.PlainDate.from(toKey),
      zone,
    )
  }, [events, fromKey, toKey, filtered, hidden, meId])
}

/** Weekday initials in display order, e.g. M T W T F S S. */
export function weekdayInitials(locale: string, weekStart: number): string[] {
  // 1 January 2024 was a Monday.
  const monday = Temporal.PlainDate.from('2024-01-01')
  return Array.from({ length: 7 }, (_, i) =>
    monday.add({ days: (weekStart - 1 + i) % 7 }).toLocaleString(locale, { weekday: 'narrow' }),
  )
}

export function EventRow({ occurrence, onPress }: { occurrence: Occurrence; onPress: () => void }) {
  const t = useT()
  const { locale } = useLocale()
  const tone = useToneFor(occurrence.event.forUserId)
  const { event } = occurrence

  return (
    <Pressable
      feedback="row"
      onPress={onPress}
      style={toneStyle(tone)}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-tone-soft text-[1.35rem]">
        {event.emoji ?? '✨'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-headline font-semibold">{event.title}</span>
        <span className="block truncate text-sub text-ink-2">
          {timeLabel(occurrence, t, locale)}
        </span>
      </span>
      {event.visibility === 'private' && (
        <LockSimple size={16} weight="bold" className="shrink-0 text-ink-3" />
      )}
      <WhoBadge forUserId={event.forUserId} size={24} />
    </Pressable>
  )
}
