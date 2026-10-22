import {
  dayCount,
  daysBetween,
  nextMilestone,
  nextOccurrence,
  type Occurrence,
  occurrencesOn,
  previousMilestone,
  Temporal,
} from '@meandu/core'
import { CalendarPlus, CloudSlash, Export, Heart, WarningCircle, X } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useMemo, useSyncExternalStore } from 'react'
import { useLocale, useT } from '../../i18n'
import { formatDay, relativeDay } from '../../lib/format'
import { dayPart, useToday, zone } from '../../lib/time'
import { toneFor, toneStyle } from '../../lib/tone'
import { install } from '../../platform'
import { useData, useMe, usePartner } from '../../state/data'
import { type TabId, useNav } from '../../state/nav'
import { useSettings } from '../../state/settings'
import { useUi } from '../../state/ui'
import { useFirstSyncPending, useSync } from '../../sync/engine'
import { Avatar, CoupleAvatars } from '../../ui/Avatar'
import { IconButton, Pressable } from '../../ui/Pressable'
import { NativeDateInput } from '../../ui/pickers'
import { Screen, SectionLabel } from '../../ui/Screen'
import { RowSkeletons, Skeleton } from '../../ui/states'
import { EventRow, useOccurrences } from '../calendar/shared'
import { startOver } from '../onboarding/actions'

export function TodayScreen() {
  const t = useT()
  const { locale } = useLocale()
  const today = useToday()
  const me = useMe()
  const mode = useData((s) => s.mode)
  const push = useNav((s) => s.push)
  const hour = Temporal.Now.plainTimeISO(zone).hour

  return (
    <Screen
      large
      title={t.greeting[dayPart(hour)](me.name)}
      barTitle={t.tabs.today}
      eyebrow={formatDay(today, locale)}
      actions={
        <>
          <SyncBadge />
          <Pressable
            aria-label={t.settings.title}
            haptic="tap"
            onPress={() => push({ name: 'settings' })}
            className="rounded-full"
          >
            <Avatar person={me} size={34} />
          </Pressable>
        </>
      }
    >
      <div className="space-y-1">
        {mode === 'demo' && <DemoCard />}
        <TogetherCard />
        <InviteCard />
        <InstallCard />
        <Countdowns />
        <UpNext />
        <ListPeek />
      </div>
    </Screen>
  )
}

function TogetherCard() {
  const t = useT()
  const { locale } = useLocale()
  const today = useToday()
  const since = useData((s) => s.togetherSince)
  const setSince = useData((s) => s.setTogetherSince)

  if (!since) {
    return (
      <section className="relative mx-4 flex items-center gap-4 rounded-card bg-surface p-5 shadow-soft transition-transform duration-200 active:scale-[0.98]">
        <CoupleAvatars size={44} />
        <span className="min-w-0 flex-1 font-display text-title font-bold">{t.empty.since}</span>
        <CalendarPlus size={26} weight="duotone" className="text-coral" />
        <NativeDateInput
          label={t.settings.togetherSince}
          value={null}
          max={today.toString()}
          onChange={setSince}
        />
      </section>
    )
  }

  const count = Math.max(1, dayCount(Temporal.PlainDate.from(since), today))
  const next = nextMilestone(count)
  const previous = previousMilestone(next)
  const progress = Math.min(1, Math.max(0, (count - previous) / (next - previous)))

  return (
    <section className="mx-4 rounded-card bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-4">
        <CoupleAvatars size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-hero font-extrabold tabular-nums tracking-tight">
            {count.toLocaleString(locale)}
          </p>
          <p className="text-sub font-semibold text-ink-2">
            {t.today.days(count)} {t.today.together}
          </p>
        </div>
        <motion.span
          className="text-coral"
          animate={{ scale: [1, 1.18, 1, 1.1, 1] }}
          transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, repeatDelay: 2.4 }}
        >
          <Heart size={30} weight="fill" />
        </motion.span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full bg-linear-to-r from-coral via-lilac to-sage"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <p className="mt-2 text-foot font-medium text-ink-2">
        {t.today.milestone(next, next - count)}
      </p>
    </section>
  )
}

/** Shown in a real space until your person joins. */
export function InviteCard() {
  const t = useT()
  const mode = useData((s) => s.mode)
  const partner = usePartner()
  const openSheet = useUi((s) => s.openSheet)
  if (mode !== 'synced' || partner) return null

  return (
    <Pressable
      haptic="tap"
      onPress={() => openSheet({ type: 'invite' })}
      className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-card bg-coral-soft p-4"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface text-2xl shadow-soft">
        💌
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline font-semibold text-coral-ink">{t.invite.title}</span>
        <span className="block text-sub text-ink-2">{t.invite.hint}</span>
      </span>
    </Pressable>
  )
}

function DemoCard() {
  const t = useT()
  return (
    <section className="mx-4 mb-3 flex items-center gap-3 rounded-card bg-honey-soft py-3 pl-4 pr-3">
      <span aria-hidden className="text-2xl">
        👀
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline font-semibold text-honey-ink">{t.demo.badge}</span>
        <span className="block text-sub text-ink-2">{t.demo.hint}</span>
      </span>
      <Pressable
        haptic="tap"
        onPress={startOver}
        className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-sub font-bold text-canvas"
      >
        {t.demo.startForReal}
      </Pressable>
    </section>
  )
}

/** A quiet icon in the corner when syncing isn't working, with the reason on tap. */
function SyncBadge() {
  const t = useT()
  const mode = useData((s) => s.mode)
  const status = useSync((s) => s.status)
  if (mode !== 'synced') return null
  if (status !== 'offline' && status !== 'error' && status !== 'signed-out') return null

  const message =
    status === 'offline' ? t.sync.offline : status === 'error' ? t.sync.error : t.sync.signedOut
  return (
    <IconButton
      label={message}
      haptic="tap"
      onPress={() => useUi.getState().showToast(message)}
      className="text-ink-2"
    >
      {status === 'offline' ? (
        <CloudSlash size={18} weight="bold" />
      ) : (
        <WarningCircle size={18} weight="bold" className="text-coral-ink" />
      )}
    </IconButton>
  )
}

function Countdowns() {
  const t = useT()
  const today = useToday()
  const events = useData((s) => s.events)
  const me = useMe()
  const partner = usePartner()
  const push = useNav((s) => s.push)

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.isCountdown)
        .map((event) => nextOccurrence(event, today, zone))
        .filter((o): o is Occurrence => o !== undefined)
        .sort((a, b) => Temporal.PlainDate.compare(a.startDate, b.startDate)),
    [events, today],
  )

  if (upcoming.length === 0) return null

  return (
    <section>
      <SectionLabel>{t.today.soon}</SectionLabel>
      <div className="scroll-x flex snap-x snap-mandatory gap-3 px-4 pb-1">
        {upcoming.map((o) => {
          const days = daysBetween(today, o.startDate)
          const label =
            days < 0 ? t.countdown.now : days === 0 ? t.countdown.today : t.countdown.days(days)
          return (
            <Pressable
              key={o.key}
              onPress={() => push({ name: 'event', id: o.event.id, date: o.startDate.toString() })}
              style={toneStyle(toneFor(o.event.forUserId, me, partner))}
              className="flex w-40 shrink-0 snap-start flex-col rounded-card bg-tone-soft p-4"
            >
              <span className="text-3xl">{o.event.emoji ?? '⏳'}</span>
              <span className="mt-3 font-display text-hero font-extrabold tabular-nums text-tone-ink">
                {days > 0 ? days : '♥'}
              </span>
              <span className="text-sub font-semibold text-tone-ink">{label}</span>
              <span className="mt-1 line-clamp-2 text-sub leading-snug text-ink-2">
                {o.event.title}
              </span>
            </Pressable>
          )
        })}
      </div>
    </section>
  )
}

function UpNext() {
  const t = useT()
  const { locale } = useLocale()
  const today = useToday()
  const push = useNav((s) => s.push)
  const loading = useFirstSyncPending()
  const tomorrow = today.add({ days: 1 })
  const occurrences = useOccurrences(today, today.add({ days: 2 }))

  const days = [today, tomorrow].map((day) => ({ day, items: occurrencesOn(occurrences, day) }))

  return (
    <section>
      <SectionLabel>{t.today.next}</SectionLabel>
      {loading ? (
        <RowSkeletons count={3} />
      ) : (
        <div className="space-y-3 px-2">
          {days.map(({ day, items }) => (
            <div key={day.toString()}>
              <p className="px-3 pb-1 text-sub font-semibold text-ink-2">
                {relativeDay(day, today, t, locale)}
              </p>
              {items.length === 0 ? (
                <p className="px-3 py-2 text-body text-ink-3">{t.today.free}</p>
              ) : (
                items.map((o) => (
                  <EventRow
                    key={o.key}
                    occurrence={o}
                    onPress={() =>
                      push({ name: 'event', id: o.event.id, date: o.startDate.toString() })
                    }
                  />
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ListPeek() {
  const t = useT()
  const lists = useData((s) => s.lists)
  const items = useData((s) => s.items)
  const open = useNav((s) => s.open)
  const loading = useFirstSyncPending()

  const left = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      if (!item.done) counts.set(item.listId, (counts.get(item.listId) ?? 0) + 1)
    }
    return counts
  }, [items])

  if (loading) {
    return (
      <section aria-hidden>
        <SectionLabel>{t.today.lists}</SectionLabel>
        <div className="flex gap-2 px-4 pb-2">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </section>
    )
  }
  if (lists.length === 0) return null

  return (
    <section>
      <SectionLabel>{t.today.lists}</SectionLabel>
      <div className="scroll-x flex gap-2 px-4 pb-2">
        {lists.map((list) => (
          <Pressable
            key={list.id}
            onPress={() => open('lists' satisfies TabId, { name: 'list', id: list.id })}
            className="flex shrink-0 items-center gap-2 rounded-full bg-surface py-2 pl-3 pr-4 shadow-soft"
          >
            <span className="text-lg">{list.emoji}</span>
            <span className="text-sub font-semibold">{list.title}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-foot font-bold tabular-nums text-ink-2">
              {left.get(list.id) ?? 0}
            </span>
          </Pressable>
        ))}
      </div>
    </section>
  )
}

function InstallCard() {
  const t = useT()
  const hidden = useSettings((s) => s.installHidden)
  const hide = useSettings((s) => s.hideInstall)
  const openSheet = useUi((s) => s.openSheet)
  const canPrompt = useSyncExternalStore(install.subscribe, install.canPrompt)
  const needsGuide = install.needsGuide()

  if (hidden || (!canPrompt && !needsGuide)) return null

  return (
    <section className="mx-4 mt-3 flex items-center gap-3 rounded-card bg-lilac-soft p-3 pr-2">
      <img src="/pwa-192x192.png" alt="" className="size-12 rounded-xl bg-canvas p-1" />
      <Pressable
        feedback="none"
        onPress={() => (canPrompt ? install.prompt() : openSheet({ type: 'install' }))}
        className="min-w-0 flex-1"
      >
        <span className="flex items-center gap-1.5 text-headline font-semibold text-lilac-ink">
          {canPrompt ? t.install.cta : t.install.title}
          {!canPrompt && <Export size={16} weight="bold" />}
        </span>
        <span className="block text-sub text-ink-2">{t.install.hint}</span>
      </Pressable>
      <Pressable
        aria-label={t.common.close}
        onPress={hide}
        className="grid size-8 place-items-center rounded-full text-ink-2"
      >
        <X size={16} weight="bold" />
      </Pressable>
    </section>
  )
}
