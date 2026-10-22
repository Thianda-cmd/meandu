import { EnvelopeSimple, Fingerprint, SignOut } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useEffect, useState } from 'react'
import { passkeysSupported, signOut } from '../../api/auth'
import { useT } from '../../i18n'
import { haptics } from '../../platform'
import { useAccount } from '../../state/account'
import { useUi } from '../../state/ui'
import { CodeInput } from '../../ui/CodeInput'
import { Pressable } from '../../ui/Pressable'
import { SheetBody, SheetHeader } from '../../ui/Sheet'
import { BigButton, ErrorLine } from '../../ui/states'
import { startOver } from '../onboarding/actions'
import { authError, type SecureStep, useSecureFlow, useSignInFlow } from './flows'
import { DoneMark, EmailField, KeyGlyph } from './parts'

type Flow = ReturnType<typeof useSecureFlow> | ReturnType<typeof useSignInFlow>

/** Steps inside a sheet fade and drift sideways, like pages. */
function Steps({ step, children }: { step: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Type an address, get a code. */
export function EmailStep({
  flow,
  forSignIn = false,
  inSheet = false,
}: {
  flow: Flow
  forSignIn?: boolean
  inSheet?: boolean
}) {
  const t = useT()
  return (
    <div className="space-y-4">
      <EmailField
        value={flow.email}
        onChange={(value) => {
          flow.setEmail(value)
          flow.setError(null)
        }}
        onSubmit={flow.send}
        label={t.auth.emailTitle}
        placeholder={t.auth.emailPlaceholder}
        forSignIn={forSignIn}
        autoFocus={!forSignIn}
        inSheet={inSheet}
      />
      {inSheet && (
        <BigButton
          busy={flow.busy === 'email'}
          isDisabled={!flow.email.includes('@')}
          onPress={flow.send}
        >
          {t.auth.sendCode}
        </BigButton>
      )}
      <ErrorLine text={flow.error && authError(t, flow.error)} />
    </div>
  )
}

/** The six digits from the email; they go in by themselves once complete. */
export function CodeStep({ flow, inSheet = false }: { flow: Flow; inSheet?: boolean }) {
  const t = useT()
  const [resent, setResent] = useState(false)
  return (
    <div className="flex flex-col items-center">
      <p className="pb-6 text-center text-body text-ink-2">{t.auth.sentTo(flow.email.trim())}</p>
      <CodeInput
        kind="email"
        value={flow.code}
        onChange={(value) => {
          flow.setCode(value)
          flow.setError(null)
        }}
        onComplete={(value) => void flow.confirm(value)}
        label={t.auth.checkEmail}
        shake={flow.shake}
        autoFocus
        inSheet={inSheet}
      />
      <ErrorLine text={flow.error && authError(t, flow.error)} />
      <Pressable
        feedback="none"
        isDisabled={resent || flow.busy !== false}
        onPress={async () => {
          await flow.send()
          setResent(true)
        }}
        className="rounded-full px-4 py-2 text-sub font-semibold text-ink-2"
      >
        {resent ? t.auth.resent : t.auth.resend}
      </Pressable>
    </div>
  )
}

/** Add a passkey or an email, from the Today card or Settings. */
export function SecureSheet({ start = 'choose' }: { start?: SecureStep }) {
  const t = useT()
  const close = useUi((s) => s.closeSheet)
  const emailSignIn = useAccount((s) => s.emailSignIn)
  const flow = useSecureFlow(close, { start })
  const canPasskey = passkeysSupported()
  const titles: Record<SecureStep, string> = {
    choose: t.auth.safeTitle,
    email: t.auth.emailTitle,
    code: t.auth.checkEmail,
    done: '',
  }

  useEffect(() => {
    void useAccount.getState().load()
  }, [])

  return (
    <>
      <SheetHeader title={titles[flow.step]} onClose={close} />
      <SheetBody>
        <Steps step={flow.step}>
          {flow.step === 'choose' && (
            <div className="flex flex-col items-center pt-2 text-center">
              <KeyGlyph />
              <p className="mt-5 text-body text-ink-2">{t.auth.safeHint}</p>
              <div className="mt-7 w-full space-y-3">
                {canPasskey && (
                  <BigButton busy={flow.busy === 'passkey'} onPress={flow.passkey}>
                    <Fingerprint size={22} weight="bold" />
                    {t.auth.usePasskey}
                  </BigButton>
                )}
                {emailSignIn && (
                  <BigButton
                    variant={canPasskey ? 'soft' : 'primary'}
                    onPress={() => flow.setStep('email')}
                  >
                    <EnvelopeSimple size={22} weight="bold" />
                    {t.auth.useEmail}
                  </BigButton>
                )}
              </div>
              {canPasskey && <p className="mt-3 text-foot text-ink-3">{t.auth.passkeyHint}</p>}
              <ErrorLine text={flow.error && authError(t, flow.error)} />
            </div>
          )}
          {flow.step === 'email' && <EmailStep flow={flow} inSheet />}
          {flow.step === 'code' && <CodeStep flow={flow} inSheet />}
          {flow.step === 'done' && <DoneMark label={t.auth.done} />}
        </Steps>
      </SheetBody>
    </>
  )
}

/** A protected account signs in again before changing how it signs in. */
export function ConfirmSheet() {
  const t = useT()
  const close = useUi((s) => s.closeSheet)
  const info = useAccount((s) => s.info)
  const flow = useSignInFlow(
    async () => {
      haptics.success()
      close()
      useUi.getState().showToast(t.auth.confirmed)
    },
    { email: info?.email ?? '', autofill: false },
  )
  const canPasskey = passkeysSupported() && Boolean(info?.passkeys.length)

  return (
    <>
      <SheetHeader title={t.auth.confirmTitle} onClose={close} />
      <SheetBody>
        <Steps step={flow.step}>
          {flow.step === 'choose' ? (
            <div className="flex flex-col items-center pt-2 text-center">
              <KeyGlyph size={80} />
              <p className="mt-5 text-body text-ink-2">{t.auth.confirmHint}</p>
              <div className="mt-7 w-full space-y-3">
                {canPasskey && (
                  <BigButton busy={flow.busy === 'passkey'} onPress={flow.passkey}>
                    <Fingerprint size={22} weight="bold" />
                    {t.auth.usePasskey}
                  </BigButton>
                )}
                {info?.email && (
                  <BigButton
                    variant={canPasskey ? 'soft' : 'primary'}
                    busy={flow.busy === 'email'}
                    onPress={flow.send}
                  >
                    <EnvelopeSimple size={22} weight="bold" />
                    {info.email}
                  </BigButton>
                )}
              </div>
              <ErrorLine text={flow.error && authError(t, flow.error)} />
            </div>
          ) : (
            <CodeStep flow={flow} inSheet />
          )}
        </Steps>
      </SheetBody>
    </>
  )
}

export function SignOutSheet() {
  const t = useT()
  const close = useUi((s) => s.closeSheet)
  const [busy, setBusy] = useState(false)

  const leave = async () => {
    setBusy(true)
    try {
      await signOut()
    } catch {
      // Signed out on this phone either way; the session expires on its own.
    }
    haptics.warn()
    startOver()
  }

  return (
    <>
      <SheetHeader title={t.settings.signOut} onClose={close} />
      <SheetBody>
        <div className="flex flex-col items-center pt-2 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-surface-2 text-ink-2">
            <SignOut size={36} weight="duotone" />
          </span>
          <p className="mt-5 font-display text-title font-bold">{t.settings.signOutTitle}</p>
          <p className="mt-1 text-body text-ink-2">{t.settings.signOutHint}</p>
          <div className="mt-7 w-full space-y-2">
            <BigButton busy={busy} onPress={leave} className="bg-coral-ink">
              {t.settings.signOut}
            </BigButton>
            <BigButton variant="plain" onPress={close}>
              {t.common.cancel}
            </BigButton>
          </div>
        </div>
      </SheetBody>
    </>
  )
}
