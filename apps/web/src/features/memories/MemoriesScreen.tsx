import { Temporal } from '@meandu/core'
import { Camera } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { useLocale, useT } from '../../i18n'
import { formatMonth } from '../../lib/format'
import { useData } from '../../state/data'
import { useNav } from '../../state/nav'
import type { Memory } from '../../state/types'
import { useUi } from '../../state/ui'
import { Pressable } from '../../ui/Pressable'
import { Screen } from '../../ui/Screen'
import { PhotoView } from './Photo'

export function MemoriesScreen() {
  const t = useT()
  const { locale } = useLocale()
  const memories = useData((s) => s.memories)
  const push = useNav((s) => s.push)
  const openSheet = useUi((s) => s.openSheet)

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
      {groups.length === 0 && (
        <Pressable
          onPress={() => openSheet({ type: 'memory' })}
          className="mx-4 mt-6 flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-ink-3/40 p-10 text-center text-ink-2"
        >
          <Camera size={36} weight="duotone" />
          <span className="font-display text-title font-bold">{t.memories.empty}</span>
        </Pressable>
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
