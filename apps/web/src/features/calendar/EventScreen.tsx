import {
  type CalendarEvent,
  daysBetween,
  nextOccurrence,
  type Occurrence,
  occurrencesBetween,
  Temporal,
} from '@meandu/core'
import {
  ArrowsClockwise,
  Camera,
  LockSimple,
  MapPin,
  NotePencil,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react'
import { useRef } from 'react'
import { useLocale, useT } from '../../i18n'
import { formatDay, formatTime } from '../../lib/format'
import { useToday, zone } from '../../lib/time'
import { toneStyle, useToneFor } from '../../lib/tone'
import { haptics } from '../../platform'
import { useData } from '../../state/data'
import { useNav } from '../../state/nav'
import { useUi } from '../../state/ui'
import { WhoBadge } from '../../ui/Avatar'
import { IconButton, Pressable } from '../../ui/Pressable'
import { Screen } from '../../ui/Screen'

function occurrenceFor(
  event: CalendarEvent,
  date: string | undefined,
  today: Temporal.PlainDate,
): Occurrence | undefined {
  if (date) {
    const day = Temporal.PlainDate.from(date)
    const match = occurrencesBetween([event], day, day.add({ days: 1 }), zone).find((o) =>
      o.startDate.equals(day),
    )
    if (match) return match
  }
  return (
    nextOccurrence(event, today, zone) ??
    occurrencesBetween(
      [event],
      Temporal.PlainDate.from('1900-01-01'),
      today.add({ years: 5 }),
      zone,
    ).at(-1)
  )
}

export function EventScreen({ id, date }: { id: string; date?: string }) {
  const t = useT()
  const { locale } = useLocale()
  const today = useToday()
  const found = useData((s) => s.events.find((e) => e.id === id))
  const me = useData((s) => s.me)
  const partner = useData((s) => s.partner)
  const openSheet = useUi((s) => s.openSheet)
  // Keep showing the event while the screen slides away after deleting it.
  const last = useRef(found)
  if (found) last.current = found
  const event = found ?? last.current
  const tone = useToneFor(event?.forUserId ?? null)

  if (!event) return <Screen title="">{null}</Screen>

  const o = occurrenceFor(event, date, today)
  const days = o ? daysBetween(today, o.startDate) : 0
  const isPast = o ? Temporal.PlainDate.compare(o.endDate, today) <= 0 : false
  const years =
    event.kind !== 'event' && o && event.allDay
      ? o.startDate.year - Temporal.PlainDate.from(event.startDate).year
      : 0
  const who =
    event.forUserId === null ? t.common.us : event.forUserId === me.id ? me.name : partner.name

  const remove = () => {
    haptics.warn()
    useNav.getState().pop()
    const undo = useData.getState().deleteEvent(event.id)
    useUi.getState().showToast(t.common.deleted, { label: t.common.undo, run: undo })
  }

  return (
    <Screen
      title={event.title}
      actions={
        <IconButton
          label={t.common.edit}
          haptic="tap"
          onPress={() => openSheet({ type: 'event', eventId: event.id })}
        >
          <PencilSimple size={18} weight="bold" />
        </IconButton>
      }
    >
      <div style={toneStyle(tone)} className="px-5 pb-8">
        <div className="flex items-start gap-4 pt-2">
          <span className="grid size-20 shrink-0 place-items-center rounded-[1.75rem] bg-tone-soft text-[2.6rem]">
            {event.emoji ?? '✨'}
          </span>
          <div className="min-w-0 pt-1">
            <h1 className="text-balance font-display text-large font-extrabold leading-tight">
              {event.title}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <WhoBadge forUserId={event.forUserId} size={22} />
              <span className="text-sub font-semibold text-ink-2">{who}</span>
              {event.visibility === 'private' && (
                <LockSimple size={14} weight="bold" className="text-ink-3" />
              )}
            </div>
          </div>
        </div>

        {o && (
          <div className="mt-6 rounded-card bg-surface p-4 shadow-soft">
            <p className="text-headline font-semibold">
              {o.allDay
                ? o.endDate.equals(o.startDate.add({ days: 1 }))
                  ? formatDay(o.startDate, locale)
                  : `${formatDay(o.startDate, locale, 'short')} – ${formatDay(o.endDate.subtract({ days: 1 }), locale, 'short')}`
                : formatDay(o.startDate, locale)}
            </p>
            <p className="text-body text-ink-2">
              {o.allDay || !o.start || !o.end
                ? t.common.allDay
                : `${formatTime(o.start, locale)} – ${formatTime(o.end, locale)}`}
            </p>
            {event.repeat !== 'none' && (
              <p className="mt-2 flex items-center gap-1.5 text-sub font-medium text-ink-2">
                <ArrowsClockwise size={15} weight="bold" />
                {t.event.repeats[event.repeat]}
              </p>
            )}
          </div>
        )}

        {o && !isPast && (event.isCountdown || event.kind !== 'event') && (
          <div className="mt-3 flex items-end justify-between rounded-card bg-tone-soft p-5">
            <div>
              <p className="font-display text-hero font-extrabold tabular-nums text-tone-ink">
                {days > 0 ? days : '♥'}
              </p>
              <p className="text-sub font-semibold text-tone-ink">
                {days < 0
                  ? t.countdown.now
                  : days === 0
                    ? t.countdown.today
                    : days === 1
                      ? t.countdown.tomorrow
                      : t.countdown.days(days)}
              </p>
            </div>
            {years > 0 && (
              <p className="font-display text-title font-bold text-tone-ink">
                {t.countdown.years(years)}
              </p>
            )}
          </div>
        )}

        {(event.location || event.notes) && (
          <div className="mt-3 space-y-3 rounded-card bg-surface p-4 shadow-soft">
            {event.location && (
              <p className="flex items-center gap-2 text-body">
                <MapPin size={18} weight="fill" className="shrink-0 text-tone" />
                {event.location}
              </p>
            )}
            {event.notes && (
              <p className="flex items-start gap-2 whitespace-pre-wrap text-body">
                <NotePencil size={18} weight="fill" className="mt-0.5 shrink-0 text-tone" />
                {event.notes}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 space-y-2">
          {isPast && (
            <Pressable
              haptic="tap"
              onPress={() => openSheet({ type: 'memory', eventId: event.id })}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-tone-soft py-3 text-headline font-semibold text-tone-ink"
            >
              <Camera size={20} weight="bold" />
              {t.memories.newTitle}
            </Pressable>
          )}
          <Pressable
            onPress={remove}
            className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-headline font-semibold text-coral-ink"
          >
            <Trash size={20} weight="bold" />
            {t.common.delete}
          </Pressable>
        </div>
      </div>
    </Screen>
  )
}
