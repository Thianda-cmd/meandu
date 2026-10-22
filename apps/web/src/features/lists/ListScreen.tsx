import { CaretDown, Check, PencilSimple, Plus } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { type FormEvent, useMemo, useRef, useState } from 'react'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { toneStyle } from '../../lib/tone'
import { haptics } from '../../platform'
import { useData, useMe, usePartner } from '../../state/data'
import type { ListItem } from '../../state/types'
import { useUi } from '../../state/ui'
import { Avatar } from '../../ui/Avatar'
import { SNAPPY } from '../../ui/motion'
import { IconButton, Pressable } from '../../ui/Pressable'
import { Screen } from '../../ui/Screen'
import { SwipeRow, useWasSwiped } from '../../ui/SwipeRow'
import { EmptyState } from '../../ui/states'

export function ListScreen({ id }: { id: string }) {
  const t = useT()
  const found = useData((s) => s.lists.find((l) => l.id === id))
  const items = useData((s) => s.items)
  const openSheet = useUi((s) => s.openSheet)
  // Keep showing the list while the screen slides away after deleting it.
  const last = useRef(found)
  if (found) last.current = found
  const list = found ?? last.current
  const [showDone, setShowDone] = useState(false)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)

  // Newest first; done ones by when they were ticked off.
  const { open, done } = useMemo(() => {
    const mine = items.filter((i) => i.listId === id)
    const newest = (a: ListItem, b: ListItem) => b.createdAt.localeCompare(a.createdAt)
    return {
      open: mine.filter((i) => !i.done).sort(newest),
      done: mine
        .filter((i) => i.done)
        .sort((a, b) => (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt)),
    }
  }, [items, id])

  if (!list) return <Screen title="">{null}</Screen>

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
    <Screen
      large
      title={list.title}
      eyebrow={<span className="text-2xl">{list.emoji}</span>}
      actions={
        found && (
          <IconButton
            label={t.lists.editTitle}
            haptic="tap"
            onPress={() => openSheet({ type: 'list', listId: list.id })}
          >
            <PencilSimple size={18} weight="bold" />
          </IconButton>
        )
      }
    >
      <form
        onSubmit={add}
        inert={!found}
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
              <Item item={item} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {open.length === 0 &&
        (done.length > 0 ? (
          <p className="px-5 py-8 text-center font-display text-title font-bold text-ink-2">
            {t.lists.allDone}
          </p>
        ) : (
          <EmptyState emoji={list.emoji} title={t.empty.list} />
        ))}

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
                    <Item item={item} />
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

function Item({ item }: { item: ListItem }) {
  const t = useT()
  const me = useMe()
  const partner = usePartner()
  const assignee = item.assigneeId === me.id ? me : item.assigneeId === partner?.id ? partner : null
  const wasSwiped = useWasSwiped()

  const remove = () => {
    const undo = useData.getState().deleteItem(item.id)
    useUi.getState().showToast(t.common.deleted, { label: t.common.undo, run: undo })
  }

  return (
    <SwipeRow onDelete={remove} deleteLabel={t.common.delete}>
      <div className="flex min-h-13 items-center gap-3 px-5 py-1.5">
        <Pressable
          aria-label={item.text}
          aria-pressed={item.done}
          feedback="none"
          onPress={() => {
            if (wasSwiped()) return
            haptics[item.done ? 'select' : 'success']()
            useData.getState().toggleItem(item.id)
          }}
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
        <Pressable
          feedback="none"
          aria-label={`${t.common.edit}: ${item.text}`}
          aria-haspopup="dialog"
          onPress={() => {
            if (!wasSwiped()) useUi.getState().openSheet({ type: 'item', itemId: item.id })
          }}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 self-stretch"
        >
          <span
            className={cx(
              'min-w-0 flex-1 break-words text-body transition-colors',
              item.done && 'text-ink-3 line-through',
            )}
          >
            {item.text}
          </span>
          {assignee && <Avatar person={assignee} size={24} />}
        </Pressable>
      </div>
    </SwipeRow>
  )
}
