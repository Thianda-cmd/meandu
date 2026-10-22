import { Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { useT } from '../../i18n'
import { haptics } from '../../platform'
import { useData, useMe, usePartner } from '../../state/data'
import type { ListItem } from '../../state/types'
import { useUi } from '../../state/ui'
import { Avatar, CoupleAvatars } from '../../ui/Avatar'
import { Segmented } from '../../ui/controls'
import { Pressable } from '../../ui/Pressable'
import { SheetBody, SheetHeader } from '../../ui/Sheet'

const ANYONE = 'anyone'

/** Change what an item says and who's doing it. */
export function ItemSheet({ itemId }: { itemId: string }) {
  const t = useT()
  const close = useUi((s) => s.closeSheet)
  const me = useMe()
  const partner = usePartner()
  const item = useData((s) => s.items.find((i) => i.id === itemId))
  const [text, setText] = useState(item?.text ?? '')
  const [who, setWho] = useState(item?.assigneeId ?? ANYONE)

  const save = () => {
    const value = text.trim()
    if (!item || !value) return
    const assigneeId = who === ANYONE ? null : who
    const patch: Partial<Pick<ListItem, 'text' | 'assigneeId'>> = {}
    if (value !== item.text) patch.text = value
    if (assigneeId !== item.assigneeId) patch.assigneeId = assigneeId
    if (Object.keys(patch).length) useData.getState().updateItem(item.id, patch)
    haptics.success()
    close()
  }

  const remove = () => {
    if (!item) return
    haptics.warn()
    close()
    const undo = useData.getState().deleteItem(item.id)
    useUi.getState().showToast(t.common.deleted, { label: t.common.undo, run: undo })
  }

  return (
    <>
      <SheetHeader
        title={t.common.edit}
        onClose={close}
        action={
          <Pressable
            haptic="tap"
            isDisabled={!item || !text.trim()}
            onPress={save}
            className="rounded-full bg-coral px-4 py-1.5 text-headline font-semibold text-white"
          >
            {t.common.save}
          </Pressable>
        }
      />
      <SheetBody>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.lists.addPlaceholder}
          aria-label={t.lists.itemLabel}
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
          className="w-full rounded-2xl bg-surface-2 px-4 py-3.5 text-headline"
        />

        {/* Until your person joins, everything on a list is yours anyway. */}
        {partner && (
          <div className="mt-5">
            <p className="px-1 pb-2 text-sub font-semibold text-ink-2">{t.lists.assign}</p>
            <Segmented
              label={t.lists.assign}
              value={who}
              onChange={setWho}
              options={[
                {
                  value: ANYONE,
                  label: (
                    <>
                      <CoupleAvatars size={20} />
                      {t.lists.anyone}
                    </>
                  ),
                },
                {
                  value: me.id,
                  label: (
                    <>
                      <Avatar person={me} size={20} />
                      {me.name}
                    </>
                  ),
                },
                {
                  value: partner.id,
                  label: (
                    <>
                      <Avatar person={partner} size={20} />
                      {partner.name}
                    </>
                  ),
                },
              ]}
            />
          </div>
        )}

        <Pressable
          onPress={remove}
          isDisabled={!item}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3 text-headline font-semibold text-coral-ink"
        >
          <Trash size={20} weight="bold" />
          {t.common.delete}
        </Pressable>
      </SheetBody>
    </>
  )
}
