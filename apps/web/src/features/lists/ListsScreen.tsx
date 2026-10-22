import { Plus } from '@phosphor-icons/react'
import { useT } from '../../i18n'
import { useData } from '../../state/data'
import { useNav } from '../../state/nav'
import { useUi } from '../../state/ui'
import { Pressable } from '../../ui/Pressable'
import { Screen } from '../../ui/Screen'

export function ListsScreen() {
  const t = useT()
  const lists = useData((s) => s.lists)
  const push = useNav((s) => s.push)
  const openSheet = useUi((s) => s.openSheet)

  return (
    <Screen large title={t.lists.title}>
      <div className="grid grid-cols-2 gap-3 px-4">
        {lists.map((list) => {
          const total = list.items.length
          const left = list.items.filter((i) => !i.done).length
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
              <span className="mt-1 text-sub font-semibold text-ink-2">{t.lists.left(left)}</span>
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
    </Screen>
  )
}
