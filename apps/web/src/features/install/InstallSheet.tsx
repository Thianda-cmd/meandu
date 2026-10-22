import { DeviceMobile, Export, PlusSquare } from '@phosphor-icons/react'
import { useT } from '../../i18n'
import { useSettings } from '../../state/settings'
import { useUi } from '../../state/ui'
import { Pressable } from '../../ui/Pressable'
import { SheetBody, SheetHeader } from '../../ui/Sheet'

const ICONS = [Export, PlusSquare, DeviceMobile]

/** iPhones never offer to install web apps, so we show the three taps instead. */
export function InstallSheet() {
  const t = useT()
  const close = useUi((s) => s.closeSheet)
  const hide = useSettings((s) => s.hideInstall)

  return (
    <>
      <SheetHeader title={t.install.title} onClose={close} />
      <SheetBody>
        <ol className="space-y-3">
          {t.install.steps.map((step, i) => {
            const Icon = ICONS[i] ?? DeviceMobile
            return (
              <li key={step} className="flex items-center gap-4 rounded-card bg-surface-2/60 p-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink font-display font-extrabold text-canvas">
                  {i + 1}
                </span>
                <span className="flex-1 text-headline font-semibold">{step}</span>
                <Icon size={26} weight="duotone" className="text-lilac-ink" />
              </li>
            )
          })}
        </ol>
        <Pressable
          haptic="tap"
          onPress={() => {
            hide()
            close()
          }}
          className="mt-5 w-full rounded-full bg-ink py-3.5 text-center text-headline font-semibold text-canvas"
        >
          {t.common.done}
        </Pressable>
      </SheetBody>
    </>
  )
}
