import { CaretDown, Check, Plus } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { type FormEvent, useRef, useState } from 'react'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { toneStyle } from '../../lib/tone'
import { haptics } from '../../platform'
import { useData } from '../../state/data'
import type { ListItem } from '../../state/types'
import { useUi } from '../../state/ui'
import { Avatar } from '../../ui/Avatar'
import { SNAPPY } from '../../ui/motion'
import { Pressable } from '../../ui/Pressable'
import { Screen } from '../../ui/Screen'
import { SwipeRow } from '../../ui/SwipeRow'

export function ListScreen({ id }: { id: string }) {
  const t = useT()
  const list = useData((s) => s.lists.find((l) => l.id === id))
  const [showDone, setShowDone] = useState(false)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)

  if (!list) return <Screen title="">{null}</Screen>

  const open = list.items.filter((i) => !i.done)
  const done = list.items.filter((i) => i.done)

  const add = (event: FormEvent) => {
    event.preventDefault()
    const value = text.trim()
    if (!value) return
    useData.getState().addItem(list.id, value)
    haptics.tap()
    setText('')
    input.current?.focus()
  }

  return (
    <Screen large title={list.title} eyebrow={<span className="text-2xl">{list.emoji}</span>}>
      <form
        onSubmit={add}
        className="mx-4 mb-2 flex items-center gap-3 rounded-2xl bg-surface px-3 shadow-soft"
      >
        <Plus size={20} weight="bold" className="shrink-0 text-coral" />
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.lists.addPlaceholder}
          aria-label={t.lists.addPlaceholder}
          enterKeyHint="done"
          className="min-w-0 flex-1 py-3.5"
        />
      </form>

      <ul className="px-0">
        <AnimatePresence initial={false}>
          {open.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SNAPPY}
            >
              <Item listId={list.id} item={item} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {open.length === 0 && (
        <p className="px-5 py-8 text-center font-display text-title font-bold text-ink-2">
          {t.lists.allDone}
        </p>
      )}

      {done.length > 0 && (
        <section className="mt-4">
          <Pressable
            feedback="none"
            onPress={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="flex items-center gap-1.5 px-5 py-2 text-sub font-semibold text-ink-2"
          >
            {t.lists.done(done.length)}
            <motion.span animate={{ rotate: showDone ? 0 : -90 }} transition={SNAPPY}>
              <CaretDown size={14} weight="bold" />
            </motion.span>
          </Pressable>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={SNAPPY}
                className="overflow-hidden"
              >
                {done.map((item) => (
                  <li key={item.id}>
                    <Item listId={list.id} item={item} />
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </section>
      )}
    </Screen>
  )
}

function Item({ listId, item }: { listId: string; item: ListItem }) {
  const t = useT()
  const me = useData((s) => s.me)
  const partner = useData((s) => s.partner)
  const assignee = item.assigneeId === me.id ? me : item.assigneeId === partner.id ? partner : null

  const remove = () => {
    const undo = useData.getState().deleteItem(listId, item.id)
    useUi.getState().showToast(t.common.deleted, { label: t.common.undo, run: undo })
  }

  return (
    <SwipeRow onDelete={remove} deleteLabel={t.common.delete}>
      <div className="flex min-h-13 items-center gap-3 px-5 py-1.5">
        <Pressable
          aria-label={item.text}
          aria-pressed={item.done}
          haptic={item.done ? 'select' : 'success'}
          feedback="none"
          onPress={() => useData.getState().toggleItem(listId, item.id)}
          style={toneStyle(assignee?.tone ?? 'sage')}
          className={cx(
            'grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200',
            item.done ? 'border-tone bg-tone text-white' : 'border-ink-3/60',
          )}
        >
          <AnimatePresence>
            {item.done && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', bounce: 0.6, visualDuration: 0.3 }}
              >
                <Check size={15} weight="bold" />
              </motion.span>
            )}
          </AnimatePresence>
        </Pressable>
        <span
          className={cx(
            'min-w-0 flex-1 text-body transition-colors',
            item.done && 'text-ink-3 line-through',
          )}
        >
          {item.text}
        </span>
        {assignee && <Avatar person={assignee} size={24} />}
      </div>
    </SwipeRow>
  )
}
