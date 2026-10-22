import { Temporal } from '@meandu/core'
import { Plus } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { useLocale, useT } from '../../i18n'
import { formatMonth } from '../../lib/format'
import { useData } from '../../state/data'
import { useNav } from '../../state/nav'
import type { Memory } from '../../state/types'
import { useUi } from '../../state/ui'
import { useFirstSyncPending } from '../../sync/engine'
import { Pressable } from '../../ui/Pressable'
import { Screen } from '../../ui/Screen'
import { EmptyState, Skeleton } from '../../ui/states'
import { PhotoView } from './Photo'

export function MemoriesScreen() {
  const t = useT()
  const { locale } = useLocale()
  const memories = useData((s) => s.memories)
  const push = useNav((s) => s.push)
  const openSheet = useUi((s) => s.openSheet)
  const loading = useFirstSyncPending()

  const groups = useMemo(() => {
    const sorted = [...memories].sort((a, b) => b.date.localeCompare(a.date))
    const byMonth = new Map<string, Memory[]>()
    for (const memory of sorted) {
      const key = memory.date.slice(0, 7)
      byMonth.set(key, [...(byMonth.get(key) ?? []), memory])
    }
    return [...byMonth.entries()]
  }, [memories])

  return (
    <Screen large title={t.memories.title}>
      {loading ? (
        <div aria-hidden className="grid grid-cols-2 gap-3 px-4 pt-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-card" />
          ))}
        </div>
      ) : (
        groups.length === 0 && (
          <EmptyState
            emoji="📸"
            title={t.memories.empty}
            action={
              <Pressable
                haptic="tap"
                onPress={() => openSheet({ type: 'memory' })}
                className="flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 text-headline font-semibold text-white shadow-soft"
              >
                <Plus size={18} weight="bold" />
                {t.memories.newTitle}
              </Pressable>
            }
          />
        )
      )}
      {groups.map(([month, items]) => (
        <section key={month} className="pb-2">
          <h3 className="px-5 pb-2 pt-4 text-sub font-bold text-ink-2">
            {formatMonth(Temporal.PlainYearMonth.from(month), locale, true)}
          </h3>
          <div className="grid grid-cols-2 gap-3 px-4">
            {items.map((memory) => (
              <Pressable
                key={memory.id}
                onPress={() => push({ name: 'memory', id: memory.id })}
                className="relative aspect-[4/5] overflow-hidden rounded-card shadow-soft"
              >
                <PhotoView
                  photo={memory.photos[0]}
                  alt={memory.title}
                  className="absolute inset-0"
                />
                <span className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/55 to-transparent" />
                {memory.emoji && (
                  <span className="absolute left-3 top-3 grid size-9 place-items-center rounded-full bg-white/85 text-lg">
                    {memory.emoji}
                  </span>
                )}
                {memory.photos.length > 1 && (
                  <span className="absolute right-3 top-3 rounded-full bg-black/35 px-2 py-0.5 text-foot font-bold text-white">
                    {memory.photos.length}
                  </span>
                )}
                <span className="absolute inset-x-3 bottom-3 line-clamp-2 text-left font-display text-headline font-bold leading-tight text-white">
                  {memory.title}
                </span>
              </Pressable>
            ))}
          </div>
        </section>
      ))}
    </Screen>
  )
}
