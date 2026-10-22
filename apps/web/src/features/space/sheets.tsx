import { LinkBreak, Trash, UserMinus } from '@phosphor-icons/react'
import { api } from '../../api/client'
import { useT } from '../../i18n'
import { haptics } from '../../platform'
import { useData, usePartner } from '../../state/data'
import { useUi } from '../../state/ui'
import { SheetBody, SheetHeader } from '../../ui/Sheet'
import { AccountCard } from '../account/AccountCard'
import { AskSheet } from '../account/sheets'
import { startOver } from '../onboarding/actions'

/** Pauses the space for both of you. Nothing is deleted. */
export function UnlinkSheet() {
  const t = useT()
  const partner = usePartner()
  return (
    <AskSheet
      icon={<LinkBreak size={36} weight="duotone" />}
      title={t.space.unlinkTitle(partner?.name ?? '')}
      hint={t.space.unlinkHint}
      confirm={t.space.unlink}
      onConfirm={async () => {
        const state = await api.unlink()
        haptics.warn()
        useUi.getState().closeSheet()
        useData.getState().setSpace(state)
      }}
    />
  )
}

/** After unlinking: the space and everything in it, gone for both of you. */
export function DeleteSpaceSheet() {
  const t = useT()
  return (
    <AskSheet
      danger
      icon={<Trash size={36} weight="duotone" />}
      title={t.space.deleteEverythingTitle}
      hint={t.space.deleteEverythingHint}
      confirm={t.space.deleteEverything}
      onConfirm={async () => {
        await api.deleteSpace()
        haptics.warn()
        startOver()
        useUi.getState().showToast(t.space.deleted)
      }}
    />
  )
}

export function DeleteAccountSheet() {
  const t = useT()
  const partner = usePartner()
  return (
    <AskSheet
      danger
      icon={<UserMinus size={36} weight="duotone" />}
      title={t.space.deleteAccountTitle}
      hint={partner ? t.space.deleteAccountPairedHint(partner.name) : t.space.deleteAccountHint}
      confirm={t.space.deleteAccount}
      onConfirm={async () => {
        await api.deleteAccount()
        haptics.warn()
        startOver()
        useUi.getState().showToast(t.space.accountDeleted)
      }}
    />
  )
}

/** The account card on its own, for screens without settings (like while paused). */
export function AccountSheet() {
  const t = useT()
  const close = useUi((s) => s.closeSheet)
  return (
    <>
      <SheetHeader title={t.settings.account} onClose={close} />
      <SheetBody>
        <AccountCard />
      </SheetBody>
    </>
  )
}
