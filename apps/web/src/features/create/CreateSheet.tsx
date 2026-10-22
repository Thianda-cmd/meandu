import { useT } from '../../i18n'
import { todayDate } from '../../lib/time'
import { useNav } from '../../state/nav'
import { type SheetState, useCalendarUi, useUi } from '../../state/ui'
import { Pressable } from '../../ui/Pressable'
import { SheetBody, SheetHeader } from '../../ui/Sheet'

/** The + button: pick what to add. Swaps straight into the matching sheet. */
export function CreateSheet() {
  const t = useT()
  const close = useUi((s) => s.closeSheet)
  const openSheet = useUi((s) => s.openSheet)
  const tab = useNav((s) => s.tab)
  const selected = useCalendarUi((s) => s.selected)
  const date = tab === 'calendar' && selected ? selected : todayDate().toString()

  const options: { emoji: string; label: string; tint: string; sheet: SheetState }[] = [
    { emoji: '📅', label: t.create.plan, tint: 'bg-lilac-soft', sheet: { type: 'event', date } },
    {
      emoji: '⏳',
      label: t.create.countdown,
      tint: 'bg-honey-soft',
      sheet: { type: 'event', date, countdown: true },
    },
    { emoji: '📸', label: t.create.memory, tint: 'bg-coral-soft', sheet: { type: 'memory' } },
    { emoji: '📝', label: t.create.list, tint: 'bg-sage-soft', sheet: { type: 'list' } },
  ]

  return (
    <>
      <SheetHeader title={t.create.title} onClose={close} />
      <SheetBody>
        <div className="grid grid-cols-2 gap-3">
          {options.map((option) => (
            <Pressable
              key={option.label}
              haptic="tap"
              onPress={() => openSheet(option.sheet)}
              className={`flex aspect-[1.25] flex-col items-start justify-between rounded-card p-4 ${option.tint}`}
            >
              <span className="text-4xl">{option.emoji}</span>
              <span className="font-display text-title font-bold">{option.label}</span>
            </Pressable>
          ))}
        </div>
      </SheetBody>
    </>
  )
}
