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

export function ListSheet() {
  const t = useT()
  const close = useUi((s) => s.closeSheet)
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('📝')

  const create = () => {
    const id = useData.getState().addList(title.trim(), emoji)
    haptics.success()
    close()
    useNav.getState().open('lists', { name: 'list', id })
  }

  return (
    <>
      <SheetHeader
        title={t.lists.newTitle}
        onClose={close}
        action={
          <Pressable
            haptic="tap"
            isDisabled={!title.trim()}
            onPress={create}
            className="rounded-full bg-coral px-4 py-1.5 text-headline font-semibold text-white"
          >
            {t.common.add}
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
              if (e.key === 'Enter' && title.trim()) create()
            }}
            className="min-w-0 flex-1 py-2 font-display text-title font-bold"
          />
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2">
          {EMOJIS.map((e) => (
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
      </SheetBody>
    </>
  )
}
