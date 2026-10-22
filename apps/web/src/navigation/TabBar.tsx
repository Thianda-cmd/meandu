import {
  CalendarBlank,
  type Icon,
  ImagesSquare,
  ListChecks,
  Plus,
  SunHorizon,
} from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Activity } from 'react'
import { useT } from '../i18n'
import { cx } from '../lib/cx'
import { TABS, type TabId, useNav } from '../state/nav'
import { useUi } from '../state/ui'
import { SNAPPY } from '../ui/motion'
import { Pressable } from '../ui/Pressable'
import { SCROLL_TOP_EVENT } from './ScreenContext'
import { StackView } from './StackView'

const ICONS: Record<TabId, Icon> = {
  today: SunHorizon,
  calendar: CalendarBlank,
  lists: ListChecks,
  memories: ImagesSquare,
}

/** Every tab keeps its screens alive in the background, so switching is instant. */
export function TabNavigator() {
  const tab = useNav((s) => s.tab)
  return TABS.map((id) => (
    <Activity key={id} mode={id === tab ? 'visible' : 'hidden'}>
      <StackView tab={id} />
    </Activity>
  ))
}

function selectTab(id: TabId) {
  const nav = useNav.getState()
  if (id !== nav.tab) {
    nav.selectTab(id)
    return
  }
  // Tapping the current tab again goes back to its first screen, then to the top.
  if (nav.stacks[id].length > 1) nav.popToRoot(id)
  else window.dispatchEvent(new CustomEvent(SCROLL_TOP_EVENT, { detail: id }))
}

export function TabBar() {
  const t = useT()
  const active = useNav((s) => s.tab)
  const openSheet = useUi((s) => s.openSheet)

  const tabButton = (id: TabId) => {
    const Icon = ICONS[id]
    const selected = id === active
    return (
      <Pressable
        key={id}
        aria-label={t.tabs[id]}
        aria-current={selected ? 'page' : undefined}
        haptic="select"
        onPress={() => selectTab(id)}
        className={cx(
          'relative grid h-12 w-14 place-items-center rounded-full',
          selected ? 'text-ink' : 'text-ink-2',
        )}
      >
        {selected && (
          <motion.span
            layoutId="tab-pill"
            transition={SNAPPY}
            className="absolute inset-0 rounded-full bg-surface shadow-soft"
          />
        )}
        <Icon size={26} weight={selected ? 'fill' : 'regular'} className="relative" />
      </Pressable>
    )
  }

  return (
    <nav
      className="tabbar pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 transition-transform duration-300 ease-(--ease-ios)"
      style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.75rem)' }}
    >
      <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-full border border-line p-1.5 shadow-float">
        {TABS.slice(0, 2).map(tabButton)}
        <Pressable
          aria-label={t.create.title}
          haptic="tap"
          onPress={() => openSheet({ type: 'create' })}
          className="mx-1 grid size-12 place-items-center rounded-full bg-coral text-white shadow-soft"
        >
          <Plus size={24} weight="bold" />
        </Pressable>
        {TABS.slice(2).map(tabButton)}
      </div>
    </nav>
  )
}
