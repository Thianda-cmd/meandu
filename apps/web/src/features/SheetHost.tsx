import { useT } from '../i18n'
import { useUi } from '../state/ui'
import { Sheet } from '../ui/Sheet'
import { ConfirmSheet, SecureSheet, SignOutSheet } from './account/sheets'
import { EventSheet } from './calendar/EventSheet'
import { CreateSheet } from './create/CreateSheet'
import { InstallSheet } from './install/InstallSheet'
import { InviteSheet } from './invite/InviteSheet'
import { JoinSheet } from './invite/JoinSheet'
import { ListSheet } from './lists/ListSheet'
import { MemorySheet } from './memories/MemorySheet'

/** One sheet per kind, so switching from "+" to a form animates one out and the next in. */
export function SheetHost() {
  const t = useT()
  const sheet = useUi((s) => s.sheet)
  const close = useUi((s) => s.closeSheet)

  return (
    <>
      <Sheet open={sheet?.type === 'create'} onClose={close} label={t.create.title}>
        <CreateSheet />
      </Sheet>
      <Sheet open={sheet?.type === 'event'} onClose={close} label={t.event.newTitle}>
        {sheet?.type === 'event' && (
          <EventSheet eventId={sheet.eventId} date={sheet.date} countdown={sheet.countdown} />
        )}
      </Sheet>
      <Sheet open={sheet?.type === 'memory'} onClose={close} label={t.memories.newTitle}>
        {sheet?.type === 'memory' && <MemorySheet eventId={sheet.eventId} />}
      </Sheet>
      <Sheet open={sheet?.type === 'list'} onClose={close} label={t.lists.newTitle}>
        <ListSheet />
      </Sheet>
      <Sheet open={sheet?.type === 'install'} onClose={close} label={t.install.title}>
        <InstallSheet />
      </Sheet>
      <Sheet open={sheet?.type === 'invite'} onClose={close} label={t.invite.title}>
        <InviteSheet />
      </Sheet>
      <Sheet open={sheet?.type === 'join'} onClose={close} label={t.onboarding.codeTitle}>
        {sheet?.type === 'join' && <JoinSheet code={sheet.code} />}
      </Sheet>
      <Sheet open={sheet?.type === 'secure'} onClose={close} label={t.auth.safeTitle}>
        {sheet?.type === 'secure' && <SecureSheet start={sheet.start} />}
      </Sheet>
      <Sheet open={sheet?.type === 'confirm'} onClose={close} label={t.auth.confirmTitle}>
        <ConfirmSheet />
      </Sheet>
      <Sheet open={sheet?.type === 'signout'} onClose={close} label={t.settings.signOut}>
        <SignOutSheet />
      </Sheet>
    </>
  )
}
