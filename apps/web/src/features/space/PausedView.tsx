import { GearSix, HourglassMedium, LinkSimple } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { ApiError, api } from '../../api/client'
import { useT } from '../../i18n'
import { haptics } from '../../platform'
import { useData, useMe, usePartner } from '../../state/data'
import { useUi } from '../../state/ui'
import { syncNow } from '../../sync/engine'
import { Avatar, PendingAvatar } from '../../ui/Avatar'
import { IconButton } from '../../ui/Pressable'
import { BigButton, ErrorLine } from '../../ui/states'
import { authError } from '../account/flows'

/** The two of you, a little apart, slowly leaning in. */
function Apart() {
  const me = useMe()
  const partner = usePartner()
  const lean = (x: number) => ({
    animate: { x: [0, x, 0] },
    transition: { duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' as const },
  })
  return (
    <div className="flex items-center gap-5" aria-hidden>
      <motion.span {...lean(6)}>
        <Avatar person={me} size={76} className="shadow-soft" />
      </motion.span>
      <span className="flex gap-1.5 rounded-full bg-surface px-3 py-2.5 shadow-soft">
        <span className="h-4 w-1.5 rounded-full bg-ink-3" />
        <span className="h-4 w-1.5 rounded-full bg-ink-3" />
      </span>
      <motion.span {...lean(-6)}>
        {partner ? (
          <Avatar person={partner} size={76} className="shadow-soft" />
        ) : (
          <PendingAvatar size={76} />
        )}
      </motion.span>
    </div>
  )
}

/**
 * After one of you unlinked. Nothing shows and nothing syncs, but nothing is lost: once
 * you both relink, it's all back. Either of you can also delete it for good.
 */
export function PausedView() {
  const t = useT()
  const meId = useData((s) => s.meId)
  const paused = useData((s) => s.paused)
  const partner = usePartner()
  const openSheet = useUi((s) => s.openSheet)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = partner?.name ?? ''
  const iAsked = paused?.wantsBack.includes(meId) ?? false
  const theyAsked = Boolean(partner && paused?.wantsBack.includes(partner.id))

  const relink = async () => {
    setBusy(true)
    setError(null)
    try {
      const state = await api.relink()
      useData.getState().setSpace(state)
      if (state.status === 'active') {
        haptics.success()
        useUi.getState().showToast(t.space.back)
        useUi.getState().celebrate()
        void syncNow()
      } else {
        haptics.tap()
      }
    } catch (e) {
      haptics.warn()
      setError(e instanceof ApiError ? e.code : 'server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="absolute inset-0 flex flex-col overflow-hidden bg-canvas"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
      <div
        className="flex h-(--nav-h) shrink-0 items-center justify-end px-3"
        style={{ marginTop: 'var(--safe-top)' }}
      >
        <IconButton
          label={t.settings.account}
          haptic="tap"
          onPress={() => openSheet({ type: 'account' })}
        >
          <GearSix size={20} weight="bold" />
        </IconButton>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <Apart />
        <h1 className="mt-8 font-display text-large font-extrabold tracking-tight">
          {t.space.pausedTitle}
        </h1>
        <p className="mt-2 text-balance text-body text-ink-2">
          {paused?.by === meId ? t.space.pausedByMe(name) : t.space.pausedByThem(name)}
        </p>
        {theyAsked && !iAsked && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 rounded-full bg-coral-soft px-4 py-2 text-sub font-semibold text-coral-ink"
          >
            {t.space.theyWantBack(name)}
          </motion.p>
        )}
      </div>

      <div
        className="mx-auto w-full max-w-md px-6 pt-3"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.25rem)' }}
      >
        <ErrorLine text={error && authError(t, error)} />
        {iAsked ? (
          <p
            role="status"
            className="flex h-14 items-center justify-center gap-2 rounded-full bg-surface text-headline font-bold text-ink-2 shadow-soft"
          >
            <HourglassMedium size={20} weight="duotone" />
            {t.space.waitingFor(name)}
          </p>
        ) : (
          <BigButton busy={busy} onPress={relink}>
            <LinkSimple size={22} weight="bold" />
            {t.space.relink}
          </BigButton>
        )}
        <BigButton
          variant="plainDanger"
          compact
          onPress={() => openSheet({ type: 'deleteSpace' })}
          className="mt-2"
        >
          {t.space.deleteEverything}
        </BigButton>
      </div>
    </motion.div>
  )
}
