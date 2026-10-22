import { type CalendarEvent, type Repeat, Temporal, uuidv7 } from '@meandu/core'
import { HourglassMedium, LockSimple, MapPin } from '@phosphor-icons/react'
import { useState } from 'react'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { todayDate, zone } from '../../lib/time'
import { haptics } from '../../platform'
import { useData, useMe, usePartner } from '../../state/data'
import { useCalendarUi, useUi } from '../../state/ui'
import { Avatar, CoupleAvatars } from '../../ui/Avatar'
import { Group, Row, Segmented, Toggle } from '../../ui/controls'
import { Pressable } from '../../ui/Pressable'
import { DatePicker, OptionPicker, TimePicker } from '../../ui/pickers'
import { SheetBody, SheetHeader } from '../../ui/Sheet'

const EMOJIS = ['✨', '🍝', '🎬', '✈️', '🎂', '💛', '🏃', '🧘', '🎉', '☕️', '🍷', '🛒', '🏠', '🎵']
const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly', 'yearly']
const BOTH = 'both'

interface Draft {
  title: string
  emoji: string
  who: string
  allDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  repeat: Repeat
  countdown: boolean
  private: boolean
  location: string
  notes: string
}

const time = (t: Temporal.PlainTime) => t.toString({ smallestUnit: 'minute' })

function newDraft(date: string | undefined, countdown: boolean): Draft {
  const today = todayDate()
  const day = date ? Temporal.PlainDate.from(date) : today
  const now = Temporal.Now.plainTimeISO(zone)
  // Today: the next full hour. Other days: the evening, when couples actually make plans.
  const start =
    day.equals(today) && now.hour < 23
      ? Temporal.PlainTime.from({ hour: now.hour + 1 })
      : Temporal.PlainTime.from('19:00')
  return {
    title: '',
    emoji: '✨',
    who: BOTH,
    allDay: countdown,
    startDate: day.toString(),
    startTime: time(start),
    endDate: day.toString(),
    endTime: time(start.add({ hours: 1 })),
    repeat: 'none',
    countdown,
    private: false,
    location: '',
    notes: '',
  }
}

function draftFrom(event: CalendarEvent): Draft {
  const common = {
    title: event.title,
    emoji: event.emoji ?? '✨',
    who: event.forUserId ?? BOTH,
    repeat: event.repeat,
    countdown: event.isCountdown,
    private: event.visibility === 'private',
    location: event.location ?? '',
    notes: event.notes ?? '',
  }
  if (event.allDay) {
    return {
      ...common,
      allDay: true,
      startDate: event.startDate,
      startTime: '19:00',
      endDate: Temporal.PlainDate.from(event.endDate).subtract({ days: 1 }).toString(),
      endTime: '20:00',
    }
  }
  const start = Temporal.Instant.from(event.start).toZonedDateTimeISO(zone)
  const end = Temporal.Instant.from(event.end).toZonedDateTimeISO(zone)
  return {
    ...common,
    allDay: false,
    startDate: start.toPlainDate().toString(),
    startTime: time(start.toPlainTime()),
    endDate: end.toPlainDate().toString(),
    endTime: time(end.toPlainTime()),
  }
}

function toEvent(draft: Draft, existing: CalendarEvent | undefined, meId: string): CalendarEvent {
  const base = {
    id: existing?.id ?? uuidv7(),
    title: draft.title.trim(),
    emoji: draft.emoji,
    notes: draft.notes.trim() || undefined,
    location: draft.location.trim() || undefined,
    forUserId: draft.who === BOTH ? null : draft.who,
    visibility: draft.private ? 'private' : 'shared',
    kind: existing?.kind ?? 'event',
    repeat: draft.repeat,
    isCountdown: draft.countdown,
    createdBy: existing?.createdBy ?? meId,
    createdAt: existing?.createdAt ?? Temporal.Now.instant().toString(),
  } as const

  const startDate = Temporal.PlainDate.from(draft.startDate)
  if (draft.allDay) {
    const lastDay = Temporal.PlainDate.from(draft.endDate || draft.startDate)
    const last = Temporal.PlainDate.compare(lastDay, startDate) < 0 ? startDate : lastDay
    return {
      ...base,
      allDay: true,
      startDate: startDate.toString(),
      endDate: last.add({ days: 1 }).toString(),
    }
  }

  const start = startDate.toZonedDateTime({
    timeZone: zone,
    plainTime: Temporal.PlainTime.from(draft.startTime || '19:00'),
  })
  let end = Temporal.PlainDate.from(draft.endDate || draft.startDate).toZonedDateTime({
    timeZone: zone,
    plainTime: Temporal.PlainTime.from(draft.endTime || draft.startTime || '20:00'),
  })
  if (Temporal.ZonedDateTime.compare(end, start) <= 0) end = start.add({ hours: 1 })
  return {
    ...base,
    allDay: false,
    start: start.toInstant().toString(),
    end: end.toInstant().toString(),
    timeZone: zone,
  }
}

export function EventSheet({
  eventId,
  date,
  countdown = false,
}: {
  eventId?: string
  date?: string
  countdown?: boolean
}) {
  const t = useT()
  const me = useMe()
  const partner = usePartner()
  const existing = useData((s) => s.events.find((e) => e.id === eventId))
  const close = useUi((s) => s.closeSheet)
  const [draft, setDraft] = useState<Draft>(() =>
    existing ? draftFrom(existing) : newDraft(date, countdown),
  )
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const save = () => {
    const event = toEvent(draft, existing, me.id)
    useData.getState().saveEvent(event)
    if (!existing) useCalendarUi.getState().select(draft.startDate)
    haptics.success()
    useUi.getState().celebrate()
    close()
  }

  return (
    <>
      <SheetHeader
        title={existing ? t.event.editTitle : t.event.newTitle}
        onClose={close}
        action={
          <Pressable
            haptic="tap"
            isDisabled={!draft.title.trim()}
            onPress={save}
            className="rounded-full bg-coral px-4 py-1.5 text-headline font-semibold text-white"
          >
            {t.common.save}
          </Pressable>
        }
      />
      <SheetBody>
        <div className="flex items-center gap-3 px-1">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-surface-2 text-3xl">
            {draft.emoji}
          </span>
          <input
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={t.event.titlePlaceholder}
            aria-label={t.event.titlePlaceholder}
            enterKeyHint="done"
            className="min-w-0 flex-1 py-2 font-display text-title font-bold"
          />
        </div>

        <fieldset
          className="scroll-x -mx-4 mt-3 flex min-w-0 gap-1.5 border-0 px-4 pb-1"
          aria-label={t.event.emoji}
        >
          {EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              haptic="select"
              aria-pressed={draft.emoji === emoji}
              onPress={() => set('emoji', emoji)}
              className={cx(
                'grid size-11 shrink-0 place-items-center rounded-full text-[1.35rem] transition-colors',
                draft.emoji === emoji ? 'bg-coral-soft ring-2 ring-coral' : 'bg-surface-2',
              )}
            >
              {emoji}
            </Pressable>
          ))}
        </fieldset>

        <div className="mt-4 space-y-3">
          <Segmented
            label={t.event.for}
            value={draft.who}
            onChange={(who) => set('who', who)}
            options={[
              {
                value: me.id,
                label: (
                  <>
                    <Avatar person={me} size={20} />
                    {me.name}
                  </>
                ),
              },
              // Until your person joins, plans are for you or for both of you.
              ...(partner
                ? [
                    {
                      value: partner.id,
                      label: (
                        <>
                          <Avatar person={partner} size={20} />
                          {partner.name}
                        </>
                      ),
                    },
                  ]
                : []),
              {
                value: BOTH,
                label: (
                  <>
                    <CoupleAvatars size={20} />
                    {t.common.us}
                  </>
                ),
              },
            ]}
          />

          <Group>
            <Toggle isSelected={draft.allDay} onChange={(v) => set('allDay', v)}>
              {t.common.allDay}
            </Toggle>
            <Row label={t.event.starts}>
              <DatePicker
                label={t.event.starts}
                value={draft.startDate}
                onChange={(value) =>
                  setDraft((d) => ({
                    ...d,
                    startDate: value,
                    endDate: Temporal.PlainDate.compare(d.endDate, value) < 0 ? value : d.endDate,
                  }))
                }
              />
              {!draft.allDay && (
                <TimePicker
                  label={t.event.starts}
                  value={draft.startTime}
                  onChange={(value) => set('startTime', value)}
                />
              )}
            </Row>
            <Row label={t.event.ends}>
              <DatePicker
                label={t.event.ends}
                value={draft.endDate}
                min={draft.startDate}
                onChange={(value) => set('endDate', value)}
              />
              {!draft.allDay && (
                <TimePicker
                  label={t.event.ends}
                  value={draft.endTime}
                  onChange={(value) => set('endTime', value)}
                />
              )}
            </Row>
            <Row label={t.event.repeat}>
              <OptionPicker
                label={t.event.repeat}
                value={draft.repeat}
                onChange={(value) => set('repeat', value)}
                options={REPEATS.map((r) => ({ value: r, label: t.event.repeats[r] }))}
              />
            </Row>
          </Group>

          <Group>
            <Toggle isSelected={draft.countdown} onChange={(v) => set('countdown', v)}>
              <HourglassMedium size={20} weight="fill" className="text-honey" />
              {t.event.countdown}
            </Toggle>
            <Toggle
              isSelected={draft.private}
              // Something hidden from your person can't be for both of you.
              onChange={(v) =>
                setDraft((d) => ({ ...d, private: v, who: v && d.who === BOTH ? me.id : d.who }))
              }
            >
              <LockSimple size={20} weight="fill" className="text-ink-2" />
              <span>
                {t.event.private}
                <span className="block text-foot text-ink-2">{t.event.privateHint}</span>
              </span>
            </Toggle>
          </Group>

          <Group>
            <label className="flex min-h-12 items-center gap-3 px-4">
              <MapPin size={20} weight="fill" className="shrink-0 text-ink-2" />
              <input
                value={draft.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder={t.event.where}
                className="min-w-0 flex-1 py-3"
              />
            </label>
            <textarea
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={t.event.notesPlaceholder}
              aria-label={t.event.notes}
              rows={3}
              className="block w-full resize-none px-4 py-3"
            />
          </Group>
        </div>
      </SheetBody>
    </>
  )
}
