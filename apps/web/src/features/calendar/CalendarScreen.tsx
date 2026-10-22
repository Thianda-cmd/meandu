import {
  monthMatrix,
  type Occurrence,
  occurrencesOn,
  startOfWeek,
  Temporal,
  type WeekStart,
} from '@meandu/core'
import { CalendarBlank, Plus, Rows } from '@phosphor-icons/react'
import { animate, motion, useMotionValue } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { formatMonth, relativeDay } from '../../lib/format'
import { useToday } from '../../lib/time'
import type { ToneName } from '../../lib/tone'
import { haptics } from '../../platform'
import { useData } from '../../state/data'
import { useNav } from '../../state/nav'
import { useCalendarUi, useUi } from '../../state/ui'
import { Avatar, CoupleAvatars } from '../../ui/Avatar'
import { Segmented } from '../../ui/controls'
import { STACK_SPRING } from '../../ui/motion'
import { Pressable } from '../../ui/Pressable'
import { Screen } from '../../ui/Screen'
import { EventRow, toneOf, useOccurrences, weekdayInitials } from './shared'

export function CalendarScreen() {
  const t = useT()
  const { locale, weekStart } = useLocale()
  const today = useToday()
  const selectedIso = useCalendarUi((s) => s.selected)
  const select = useCalendarUi((s) => s.select)
  const view = useCalendarUi((s) => s.view)
  const setView = useCalendarUi((s) => s.setView)
  const selected = selectedIso ? Temporal.PlainDate.from(selectedIso) : today
  const [month, setMonth] = useState(() => selected.toPlainYearMonth())

  // Jump to the right month when something else selects a day (e.g. "Today").
  useEffect(() => {
    setMonth((current) => {
      const target = Temporal.PlainDate.from(selectedIso ?? today.toString()).toPlainYearMonth()
      return current.equals(target) ? current : target
    })
  }, [selectedIso, today])

  const showToday = !selected.equals(today) || !month.equals(today.toPlainYearMonth())

  return (
    <Screen
      large
      title={formatMonth(month, locale, false)}
      eyebrow={String(month.year)}
      titleAccessory={
        <Segmented
          label={t.tabs.calendar}
          value={view}
          onChange={setView}
          className="w-28 shrink-0"
          options={[
            {
              value: 'month',
              ariaLabel: t.calendar.month,
              label: <CalendarBlank size={18} weight="bold" />,
            },
            {
              value: 'agenda',
              ariaLabel: t.calendar.agenda,
              label: <Rows size={18} weight="bold" />,
            },
          ]}
        />
      }
      actions={
        showToday && (
          <Pressable
            haptic="tap"
            onPress={() => {
              select(today.toString())
              setMonth(today.toPlainYearMonth())
            }}
            className="rounded-full bg-surface-2/80 px-3.5 py-1.5 text-sub font-semibold"
          >
            {t.calendar.showToday}
          </Pressable>
        )
      }
    >
      <Filters />
      {view === 'month' ? (
        <>
          <MonthPager
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            today={today}
            weekStart={weekStart}
            locale={locale}
            onSelect={(day) => {
              select(day.toString())
              if (!day.toPlainYearMonth().equals(month)) setMonth(day.toPlainYearMonth())
            }}
          />
          <DayList day={selected} today={today} />
        </>
      ) : (
        <Agenda from={selected.equals(today) ? today : selected} today={today} />
      )}
    </Screen>
  )
}

function Filters() {
  const t = useT()
  const me = useData((s) => s.me)
  const partner = useData((s) => s.partner)
  const hidden = useCalendarUi((s) => s.hidden)
  const toggle = useCalendarUi((s) => s.toggle)
  const chips = [
    { key: 'me' as const, label: me.name, icon: <Avatar person={me} size={22} /> },
    { key: 'partner' as const, label: partner.name, icon: <Avatar person={partner} size={22} /> },
    { key: 'us' as const, label: t.common.us, icon: <CoupleAvatars size={22} /> },
  ]
  return (
    <fieldset
      className="scroll-x flex min-w-0 gap-2 border-0 px-4 pb-3"
      aria-label={t.calendar.filter}
    >
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          aria-pressed={!hidden[chip.key]}
          haptic="select"
          onPress={() => toggle(chip.key)}
          className={cx(
            'flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sub font-semibold transition-opacity',
            hidden[chip.key] ? 'bg-surface-2/50 opacity-45' : 'bg-surface shadow-soft',
          )}
        >
          {chip.icon}
          {chip.label}
        </Pressable>
      ))}
    </fieldset>
  )
}

interface PagerProps {
  month: Temporal.PlainYearMonth
  onMonthChange: (month: Temporal.PlainYearMonth) => void
  selected: Temporal.PlainDate
  today: Temporal.PlainDate
  weekStart: WeekStart
  locale: string
  onSelect: (day: Temporal.PlainDate) => void
}

/** Swipe sideways between months; the grid follows your finger. */
function MonthPager({
  month,
  onMonthChange,
  selected,
  today,
  weekStart,
  locale,
  onSelect,
}: PagerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const months = [month.subtract({ months: 1 }), month, month.add({ months: 1 })]

  // Coloured dots for every day of the three rendered months.
  const from = startOfWeek(months[0]?.toPlainDate({ day: 1 }) ?? today, weekStart)
  const to = from.add({ weeks: 16 })
  const occurrences = useOccurrences(from, to, { filtered: true })
  const me = useData((s) => s.me)
  const partner = useData((s) => s.partner)
  const dots = useMemo(() => {
    const map = new Map<string, Set<ToneName>>()
    for (const o of occurrences) {
      let day = o.startDate
      for (let i = 0; i < 31 && Temporal.PlainDate.compare(day, o.endDate) < 0; i++) {
        const key = day.toString()
        const set = map.get(key) ?? new Set<ToneName>()
        set.add(toneOf(o.event, me, partner))
        map.set(key, set)
        day = day.add({ days: 1 })
      }
    }
    return map
  }, [occurrences, me, partner])

  // After a page turn the new month is in the middle again, so reset the offset before paint.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs whenever the month changes
  useLayoutEffect(() => {
    x.jump(0)
  }, [month, x])

  const settle = (direction: -1 | 0 | 1, velocity: number) => {
    const width = ref.current?.offsetWidth ?? window.innerWidth
    animate(x, -direction * width, { ...STACK_SPRING, velocity }).then(() => {
      if (direction !== 0) {
        haptics.select()
        onMonthChange(month.add({ months: direction }))
      }
    })
  }

  return (
    <div className="px-3">
      <div className="grid grid-cols-7 pb-1 text-center text-foot font-semibold text-ink-3">
        {weekdayInitials(locale, weekStart).map((name, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: initials repeat (T, S)
          <span key={i}>{name}</span>
        ))}
      </div>
      <div ref={ref} className="overflow-hidden">
        <motion.div
          className="flex w-[300%]"
          style={{ x, marginLeft: '-100%', touchAction: 'pan-y' }}
          drag="x"
          dragDirectionLock
          dragMomentum={false}
          onDragEnd={(_, info) => {
            const width = ref.current?.offsetWidth ?? window.innerWidth
            const offset = info.offset.x
            const v = info.velocity.x
            const direction =
              offset < -width / 4 || v < -400 ? 1 : offset > width / 4 || v > 400 ? -1 : 0
            settle(direction, v)
          }}
        >
          {months.map((m) => (
            <MonthGrid
              key={m.toString()}
              month={m}
              weekStart={weekStart}
              today={today}
              selected={selected}
              dots={dots}
              onSelect={onSelect}
            />
          ))}
        </motion.div>
      </div>
    </div>
  )
}

function MonthGrid({
  month,
  weekStart,
  today,
  selected,
  dots,
  onSelect,
}: {
  month: Temporal.PlainYearMonth
  weekStart: WeekStart
  today: Temporal.PlainDate
  selected: Temporal.PlainDate
  dots: Map<string, Set<ToneName>>
  onSelect: (day: Temporal.PlainDate) => void
}) {
  const { locale } = useLocale()
  return (
    <div className="grid w-1/3 shrink-0 grid-cols-7">
      {monthMatrix(month, weekStart)
        .flat()
        .map((day) => {
          const inMonth = day.month === month.month
          const isToday = day.equals(today)
          const isSelected = day.equals(selected)
          const tones = [...(dots.get(day.toString()) ?? [])].slice(0, 3)
          return (
            <Pressable
              key={day.toString()}
              feedback="none"
              haptic="select"
              aria-label={day.toLocaleString(locale, { dateStyle: 'full' })}
              aria-current={isToday ? 'date' : undefined}
              onPress={() => onSelect(day)}
              className="flex h-12 flex-col items-center pt-1"
            >
              <span
                className={cx(
                  'grid size-9 place-items-center rounded-full text-body font-semibold tabular-nums transition-colors duration-200',
                  isSelected
                    ? 'bg-ink text-canvas'
                    : isToday
                      ? 'bg-coral-soft text-coral-ink'
                      : inMonth
                        ? 'text-ink'
                        : 'text-ink-3/70',
                )}
              >
                {day.day}
              </span>
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {tones.map((tone) => (
                  <span
                    key={tone}
                    className="size-1.5 rounded-full"
                    style={{ background: `var(--${tone})`, opacity: inMonth ? 1 : 0.45 }}
                  />
                ))}
              </span>
            </Pressable>
          )
        })}
    </div>
  )
}

function DayList({ day, today }: { day: Temporal.PlainDate; today: Temporal.PlainDate }) {
  const t = useT()
  const { locale } = useLocale()
  const push = useNav((s) => s.push)
  const openSheet = useUi((s) => s.openSheet)
  const occurrences = useOccurrences(day, day.add({ days: 1 }), { filtered: true })

  return (
    <section className="mt-3 border-t border-line px-2 pt-4">
      <div className="flex items-center justify-between px-3 pb-1">
        <h3 className="font-display text-title font-bold">{relativeDay(day, today, t, locale)}</h3>
        <Pressable
          aria-label={t.event.newTitle}
          haptic="tap"
          onPress={() => openSheet({ type: 'event', date: day.toString() })}
          className="grid size-9 place-items-center rounded-full bg-coral-soft text-coral-ink"
        >
          <Plus size={18} weight="bold" />
        </Pressable>
      </div>
      {occurrences.length === 0 ? (
        <p className="px-3 py-6 text-center text-body text-ink-3">{t.calendar.empty}</p>
      ) : (
        occurrences.map((o) => (
          <EventRow
            key={o.key}
            occurrence={o}
            onPress={() => push({ name: 'event', id: o.event.id, date: o.startDate.toString() })}
          />
        ))
      )}
    </section>
  )
}

const AGENDA_DAYS = 60

/** Everything coming up, day by day. */
function Agenda({ from, today }: { from: Temporal.PlainDate; today: Temporal.PlainDate }) {
  const t = useT()
  const { locale } = useLocale()
  const push = useNav((s) => s.push)
  const occurrences = useOccurrences(from, from.add({ days: AGENDA_DAYS }), { filtered: true })

  const days = useMemo(() => {
    const groups: { day: Temporal.PlainDate; items: Occurrence[] }[] = []
    for (let i = 0; i < AGENDA_DAYS; i++) {
      const day = from.add({ days: i })
      // Multi-day things show on their first day only, so the list stays calm.
      const items = occurrencesOn(occurrences, day).filter(
        (o) =>
          o.startDate.equals(day) || (i === 0 && Temporal.PlainDate.compare(o.startDate, day) < 0),
      )
      if (items.length) groups.push({ day, items })
    }
    return groups
  }, [occurrences, from])

  return (
    <div className="pb-4">
      {days.map(({ day, items }) => (
        <section key={day.toString()}>
          <h3
            className="glass sticky z-[1] px-5 py-1.5 text-sub font-bold text-ink-2"
            style={{ top: 'calc(var(--safe-top) + var(--nav-h))' }}
          >
            {relativeDay(day, today, t, locale)}
          </h3>
          <div className="px-2 py-1">
            {items.map((o) => (
              <EventRow
                key={o.key}
                occurrence={o}
                onPress={() =>
                  push({ name: 'event', id: o.event.id, date: o.startDate.toString() })
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
