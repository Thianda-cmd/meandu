import { Check, Copy, Export } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { haptics } from '../../platform'
import { usePartner } from '../../state/data'
import { useUi } from '../../state/ui'
import { CoupleAvatars } from '../../ui/Avatar'
import { SNAPPY } from '../../ui/motion'
import { SheetBody, SheetHeader } from '../../ui/Sheet'
import { BigButton, Skeleton } from '../../ui/states'
import { joinUrl, useInvite } from './invite'

const canShare = typeof navigator.share === 'function'

export function InviteSheet() {
  const t = useT()
  const close = useUi((s) => s.closeSheet)
  const invite = useInvite((s) => s.invite)
  const error = useInvite((s) => s.error)
  const load = useInvite((s) => s.load)
  const partner = usePartner()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  // Your person just joined: nothing left to do here.
  useEffect(() => {
    if (partner) close()
  }, [partner, close])

  const message = invite ? t.invite.message(invite.code, joinUrl(invite.code)) : ''

  const copy = async () => {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(message)
      haptics.success()
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard blocked: the code is on screen to read out instead.
    }
  }

  const share = async () => {
    try {
      await navigator.share({ text: message })
    } catch {
      // Share sheet closed.
    }
  }

  return (
    <>
      <SheetHeader title={t.invite.title} onClose={close} />
      <SheetBody>
        <div className="flex flex-col items-center pt-2 text-center">
          <CoupleAvatars size={56} />
          <p className="mt-4 text-body text-ink-2">{t.invite.hint}</p>

          <div className="mt-5 flex items-center gap-1.5" aria-live="polite">
            {invite ? (
              <Code code={invite.code} />
            ) : error && error !== 'full' ? (
              <BigButton variant="soft" fit onPress={() => void load()}>
                {t.oops.retry}
              </BigButton>
            ) : (
              Array.from({ length: 6 }, (_, i) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                  key={i}
                  className={i === 3 ? 'ml-3 h-16 w-12 rounded-2xl' : 'h-16 w-12 rounded-2xl'}
                />
              ))
            )}
          </div>

          <div className="mt-8 flex w-full gap-3">
            <BigButton variant={canShare ? 'soft' : 'primary'} isDisabled={!invite} onPress={copy}>
              {copied ? <Check size={20} weight="bold" /> : <Copy size={20} weight="bold" />}
              {copied ? t.invite.copied : t.invite.copy}
            </BigButton>
            {canShare && (
              <BigButton isDisabled={!invite} onPress={share}>
                <Export size={20} weight="bold" />
                {t.invite.share}
              </BigButton>
            )}
          </div>
          <BigButton variant="plain" className="mt-2" onPress={close}>
            {t.invite.later}
          </BigButton>
        </div>
      </SheetBody>
    </>
  )
}

/** The code in big friendly tiles, popping in one after another. */
function Code({ code }: { code: string }) {
  return (
    <>
      <span className="sr-only">{code.split('').join(' ')}</span>
      {code.split('').map((char, i) => (
        <motion.span
          // biome-ignore lint/suspicious/noArrayIndexKey: letters can repeat
          key={i}
          aria-hidden
          initial={{ opacity: 0, y: 10, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...SNAPPY, delay: i * 0.05 }}
          className={`grid h-16 w-12 place-items-center rounded-2xl bg-surface-2 font-display text-[2rem] font-extrabold text-ink ${i === 3 ? 'ml-3' : ''}`}
        >
          {char}
        </motion.span>
      ))}
    </>
  )
}
