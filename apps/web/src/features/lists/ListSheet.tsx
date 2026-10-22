import { Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptics } from '../../platform'
import { useData } from '../../state/data'
import { useNav } from '../../state/nav'
import { useUi } from '../../state/ui'
import { Pressable } from '../../ui/Pressable'
import { SheetBody, SheetHeader } from '../../ui/Sheet'

const EMOJIS = ['📝', '🛒', '🏠', '💡', '🌍', '🎁', '🍳', '🧳', '📚', '🎬', '🌱', '💪']

/** A new list, or renaming one (`listId`). */
export function ListSheet({ listId }: { listId?: string }) {
  const t = useT()
  const close = useUi((s) => s.closeSheet)
  const existing = useData((s) => s.lists.find((l) => l.id === listId))
  const [title, setTitle] = useState(existing?.title ?? '')
  const [emoji, setEmoji] = useState(existing?.emoji ?? '📝')
  // A list may wear an emoji from elsewhere; it stays one of the choices.
  const [choices] = useState(() =>
    existing && !EMOJIS.includes(existing.emoji)
      ? [existing.emoji, ...EMOJIS.slice(0, -1)]
      : EMOJIS,
  )

  const save = () => {
    const name = title.trim()
    if (!name) return
    haptics.success()
    close()
    if (existing) {
      if (name !== existing.title || emoji !== existing.emoji) {
        useData.getState().updateList(existing.id, { title: name, emoji })
      }
      return
    }
    const id = useData.getState().addList(name, emoji)
    useNav.getState().open('lists', { name: 'list', id })
  }

  const remove = () => {
    if (!existing) return
    haptics.warn()
    close()
    useNav.getState().pop()
    const undo = useData.getState().deleteList(existing.id)
    useUi.getState().showToast(t.common.deleted, { label: t.common.undo, run: undo })
  }

  return (
    <>
      <SheetHeader
        title={existing ? t.lists.editTitle : t.lists.newTitle}
        onClose={close}
        action={
          <Pressable
            haptic="tap"
            isDisabled={!title.trim()}
            onPress={save}
            className="rounded-full bg-coral px-4 py-1.5 text-headline font-semibold text-white"
          >
            {existing ? t.common.save : t.common.add}
          </Pressable>
        }
      />
      <SheetBody>
        <div className="flex items-center gap-3 px-1">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-surface-2 text-3xl">
            {emoji}
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.lists.namePlaceholder}
            aria-label={t.lists.namePlaceholder}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
            className="min-w-0 flex-1 py-2 font-display text-title font-bold"
          />
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2">
          {choices.map((e) => (
            <Pressable
              key={e}
              haptic="select"
              aria-pressed={emoji === e}
              onPress={() => setEmoji(e)}
              className={cx(
                'grid aspect-square place-items-center rounded-2xl text-2xl',
                emoji === e ? 'bg-coral-soft ring-2 ring-coral' : 'bg-surface-2',
              )}
            >
              {e}
            </Pressable>
          ))}
        </div>
        {existing && (
          <Pressable
            onPress={remove}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3 text-headline font-semibold text-coral-ink"
          >
            <Trash size={20} weight="bold" />
            {t.lists.deleteList}
          </Pressable>
        )}
      </SheetBody>
    </>
  )
}
