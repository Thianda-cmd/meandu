import { Temporal, uuidv7 } from '@meandu/core'
import { MapPin, Plus, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { useT } from '../../i18n'
import { storePhoto } from '../../lib/photos'
import { todayDate, zone } from '../../lib/time'
import { haptics } from '../../platform'
import { useData } from '../../state/data'
import { useUi } from '../../state/ui'
import { Group } from '../../ui/controls'
import { Pressable } from '../../ui/Pressable'
import { DatePicker } from '../../ui/pickers'
import { SheetBody, SheetHeader } from '../../ui/Sheet'

export function MemorySheet({ eventId }: { eventId?: string }) {
  const t = useT()
  const close = useUi((s) => s.closeSheet)
  const event = useData((s) => s.events.find((e) => e.id === eventId))
  const meId = useData((s) => s.me.id)
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(() => {
    if (!event) return todayDate().toString()
    if (event.allDay) return event.startDate
    return Temporal.Instant.from(event.start).toZonedDateTimeISO(zone).toPlainDate().toString()
  })
  const [place, setPlace] = useState(event?.location ?? '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])
  useEffect(
    () => () => {
      for (const url of previews) URL.revokeObjectURL(url)
    },
    [previews],
  )

  const save = async () => {
    setSaving(true)
    try {
      const photos = await Promise.all(files.map(storePhoto))
      useData.getState().saveMemory({
        id: uuidv7(),
        title: title.trim(),
        date,
        emoji: event?.emoji,
        place: place.trim() || undefined,
        note: note.trim() || undefined,
        eventId,
        photos,
        createdBy: meId,
        createdAt: Temporal.Now.instant().toString(),
      })
      haptics.success()
      useUi.getState().celebrate()
      close()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SheetHeader
        title={t.memories.newTitle}
        onClose={close}
        action={
          <Pressable
            haptic="tap"
            isDisabled={!title.trim() || saving}
            onPress={save}
            className="rounded-full bg-coral px-4 py-1.5 text-headline font-semibold text-white"
          >
            {t.common.save}
          </Pressable>
        }
      />
      <SheetBody>
        <div className="grid grid-cols-3 gap-2">
          {previews.map((url, i) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-2xl">
              <img src={url} alt="" className="size-full object-cover" />
              <Pressable
                aria-label={t.common.delete}
                onPress={() => setFiles((f) => f.filter((_, index) => index !== i))}
                className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/50 text-white"
              >
                <X size={14} weight="bold" />
              </Pressable>
            </div>
          ))}
          <label className="press flex aspect-square cursor-default flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-ink-3/40 text-ink-2">
            <Plus size={24} weight="bold" />
            <span className="text-foot font-semibold">{t.memories.addPhotos}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? [])
                setFiles((f) => [...f, ...picked].slice(0, 12))
                e.target.value = ''
              }}
            />
          </label>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.memories.titlePlaceholder}
          aria-label={t.memories.titlePlaceholder}
          className="mt-4 w-full px-1 py-2 font-display text-title font-bold"
        />

        <Group className="mt-2">
          <div className="flex min-h-12 items-center justify-between gap-3 px-4">
            <DatePicker label={t.event.when} value={date} onChange={setDate} />
          </div>
          <label className="flex min-h-12 items-center gap-3 px-4">
            <MapPin size={20} weight="fill" className="shrink-0 text-ink-2" />
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder={t.event.where}
              className="min-w-0 flex-1 py-3"
            />
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.memories.notePlaceholder}
            aria-label={t.memories.notePlaceholder}
            rows={3}
            className="block w-full resize-none px-4 py-3"
          />
        </Group>
      </SheetBody>
    </>
  )
}
