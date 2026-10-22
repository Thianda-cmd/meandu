import { Temporal } from '@meandu/core'
import { CalendarBlank, MapPin, PencilSimple, Trash } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { useLocale, useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { formatDay } from '../../lib/format'
import { haptics } from '../../platform'
import { useData } from '../../state/data'
import { useNav } from '../../state/nav'
import { useUi } from '../../state/ui'
import { IconButton, Pressable } from '../../ui/Pressable'
import { Screen } from '../../ui/Screen'
import { PhotoView } from './Photo'

export function MemoryScreen({ id }: { id: string }) {
  const t = useT()
  const { locale } = useLocale()
  const found = useData((s) => s.memories.find((m) => m.id === id))
  const last = useRef(found)
  if (found) last.current = found
  const memory = found ?? last.current
  const linked = useData((s) => s.events.find((e) => e.id === memory?.eventId))
  const [page, setPage] = useState(0)

  if (!memory) return <Screen title="">{null}</Screen>

  const remove = () => {
    haptics.warn()
    useNav.getState().pop()
    const undo = useData.getState().deleteMemory(memory.id)
    useUi.getState().showToast(t.common.deleted, { label: t.common.undo, run: undo })
  }

  return (
    <Screen
      title={memory.title}
      actions={
        found && (
          <IconButton
            label={t.memories.editTitle}
            haptic="tap"
            onPress={() => useUi.getState().openSheet({ type: 'memory', memoryId: memory.id })}
          >
            <PencilSimple size={18} weight="bold" />
          </IconButton>
        )
      }
    >
      <div className="px-4">
        <div
          className="scroll-x flex snap-x snap-mandatory overflow-hidden rounded-card"
          onScroll={(e) => {
            const el = e.currentTarget
            setPage(Math.round(el.scrollLeft / el.clientWidth))
          }}
        >
          {memory.photos.map((photo) => (
            <PhotoView
              key={photo.id}
              photo={photo}
              alt={memory.title}
              className="aspect-[4/5] w-full shrink-0 snap-center"
            />
          ))}
        </div>
        {memory.photos.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {memory.photos.map((photo, i) => (
              <span
                key={photo.id}
                className={cx(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === page ? 'w-5 bg-ink' : 'w-1.5 bg-ink-3/50',
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-5 pb-8 pt-5">
        <p className="text-sub font-semibold text-ink-2">
          {memory.emoji} {formatDay(Temporal.PlainDate.from(memory.date), locale)}
        </p>
        <h1 className="mt-1 text-balance font-display text-large font-extrabold leading-tight">
          {memory.title}
        </h1>
        {memory.place && (
          <p className="mt-2 flex items-center gap-1.5 text-body text-ink-2">
            <MapPin size={16} weight="fill" />
            {memory.place}
          </p>
        )}
        {memory.note && (
          <p className="mt-4 whitespace-pre-wrap text-body leading-relaxed">{memory.note}</p>
        )}

        {linked && (
          <Pressable
            onPress={() => useNav.getState().open('calendar', { name: 'event', id: linked.id })}
            className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-lilac-soft text-xl">
              {linked.emoji ?? <CalendarBlank size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-foot font-semibold text-ink-2">{t.memories.from}</span>
              <span className="block truncate text-headline font-semibold">{linked.title}</span>
            </span>
          </Pressable>
        )}

        <Pressable
          onPress={remove}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3 text-headline font-semibold text-coral-ink"
        >
          <Trash size={20} weight="bold" />
          {t.common.delete}
        </Pressable>
      </div>
    </Screen>
  )
}
