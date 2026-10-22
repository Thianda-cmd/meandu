import { Plus } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { useT } from '../../i18n'
import { useData } from '../../state/data'
import { useNav } from '../../state/nav'
import { useUi } from '../../state/ui'
import { useFirstSyncPending } from '../../sync/engine'
import { Pressable } from '../../ui/Pressable'
import { Screen } from '../../ui/Screen'
import { Skeleton } from '../../ui/states'

export function ListsScreen() {
  const t = useT()
  const lists = useData((s) => s.lists)
  const items = useData((s) => s.items)
  const push = useNav((s) => s.push)
  const openSheet = useUi((s) => s.openSheet)
  const loading = useFirstSyncPending()

  const counts = useMemo(() => {
    const byList = new Map<string, { total: number; left: number }>()
    for (const item of items) {
      const count = byList.get(item.listId) ?? { total: 0, left: 0 }
      count.total++
      if (!item.done) count.left++
      byList.set(item.listId, count)
    }
    return byList
  }, [items])

  return (
    <Screen large title={t.lists.title}>
      <div className="grid grid-cols-2 gap-3 px-4">
        {loading &&
          [0, 1].map((i) => (
            <div
              key={i}
              aria-hidden
              className="aspect-[1/1.05] rounded-card bg-surface p-4 shadow-soft"
            >
              <Skeleton className="size-10 rounded-2xl" />
              <Skeleton className="mt-[45%] h-5 w-3/4" />
              <Skeleton className="mt-2 h-3.5 w-1/3" />
            </div>
          ))}
        {lists.map((list) => {
          const { total, left } = counts.get(list.id) ?? { total: 0, left: 0 }
          const progress = total ? (total - left) / total : 0
          return (
            <Pressable
              key={list.id}
              onPress={() => push({ name: 'list', id: list.id })}
              className="flex aspect-[1/1.05] flex-col rounded-card bg-surface p-4 shadow-soft"
            >
              <span className="text-4xl">{list.emoji}</span>
              <span className="mt-auto line-clamp-2 font-display text-title font-bold leading-tight">
                {list.title}
              </span>
              <span className="mt-1 text-sub font-semibold text-ink-2">
                {total ? t.lists.left(left) : t.empty.list}
              </span>
              <span className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full bg-sage transition-[width] duration-500"
                  style={{ width: `${progress * 100}%` }}
                />
              </span>
            </Pressable>
          )
        })}
        <Pressable
          haptic="tap"
          onPress={() => openSheet({ type: 'list' })}
          className="flex aspect-[1/1.05] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-ink-3/40 text-ink-2"
        >
          <Plus size={28} weight="bold" />
          <span className="text-sub font-semibold">{t.lists.newTitle}</span>
        </Pressable>
      </div>
      {!loading && lists.length === 0 && (
        <p className="px-8 pt-8 text-center font-display text-title font-bold text-ink-3">
          {t.empty.lists}
        </p>
      )}
    </Screen>
  )
}
