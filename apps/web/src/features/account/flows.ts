import { WebAuthnAbortService } from '@simplewebauthn/browser'
import { useEffect, useRef, useState } from 'react'
import { addPasskey, Cancelled, emailCodes, signInWithPasskey } from '../../api/auth'
import { ApiError } from '../../api/client'
import type { Messages } from '../../i18n'
import { haptics } from '../../platform'
import { useAccount } from '../../state/account'
import { useMe } from '../../state/data'
import { useUi } from '../../state/ui'

export const authError = (t: Messages, code: string) => t.auth.errors[code] ?? t.auth.errors.server

type Busy = false | 'passkey' | 'email' | 'code'

/** What every account flow shares: one thing at a time, a friendly error, a little shake. */
function useRunner() {
  const [busy, setBusy] = useState<Busy>(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const run = async (what: Exclude<Busy, false>, action: () => Promise<void>) => {
    if (busy) return
    setBusy(what)
    setError(null)
    try {
      await action()
    } catch (e) {
      if (e instanceof Cancelled) return
      const code = e instanceof ApiError ? e.code : 'server'
      // A protected account changing how it signs in: sign in again first.
      if (code === 'SESSION_NOT_FRESH') {
        useUi.getState().openSheet({ type: 'confirm' })
        return
      }
      haptics.warn()
      setError(code)
      setShake((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, setError, shake, run }
}

/** A wrong code empties the tiles, ready for the next try. */
async function retypable(check: () => Promise<unknown>, setCode: (code: string) => void) {
  try {
    await check()
  } catch (e) {
    setCode('')
    throw e
  }
}

export type SecureStep = 'choose' | 'email' | 'code' | 'done'

/**
 * Adds a passkey or a confirmed email to this account, so it can sign in anywhere.
 * `onDone` runs after the check mark had a moment (`doneDelay`) to show.
 */
export function useSecureFlow(
  onDone: () => void,
  { start = 'choose', doneDelay = 1300 }: { start?: SecureStep; doneDelay?: number } = {},
) {
  const me = useMe()
  const runner = useRunner()
  const [step, setStep] = useState<SecureStep>(start)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

  const finish = async () => {
    await useAccount.getState().load()
    haptics.success()
    setStep('done')
    window.setTimeout(onDone, doneDelay)
  }

  const send = () =>
    runner.run('email', async () => {
      await emailCodes.sendAdd(email.trim())
      setCode('')
      setStep('code')
    })

  return {
    ...runner,
    step,
    setStep,
    email,
    setEmail,
    code,
    setCode,
    send,
    passkey: () =>
      runner.run('passkey', async () => {
        try {
          await addPasskey(me.name || 'meandu', {
            deviceOnly: !useAccount.getState().info?.protected,
          })
        } catch (e) {
          // This device already keeps a passkey for this account: that's all we wanted.
          if (!(e instanceof ApiError && e.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED')) {
            throw e
          }
        }
        await finish()
      }),
    confirm: (value = code) =>
      runner.run('code', async () => {
        await retypable(() => emailCodes.add(email.trim(), value), setCode)
        await finish()
      }),
  }
}

export type SignInStep = 'choose' | 'code'

/**
 * Signs in with a passkey or an emailed code. Passkeys also show up among the keyboard's
 * suggestions on the email field (render it with `autoComplete="username webauthn"`).
 */
export function useSignInFlow(
  onSignedIn: () => Promise<void>,
  { email: known = '', autofill = true }: { email?: string; autofill?: boolean } = {},
) {
  const runner = useRunner()
  const [step, setStep] = useState<SignInStep>('choose')
  const [email, setEmail] = useState(known)
  const [code, setCode] = useState('')
  const signedIn = useRef(onSignedIn)
  signedIn.current = onSignedIn

  // biome-ignore lint/correctness/useExhaustiveDependencies: set up once
  useEffect(() => {
    if (!autofill) return
    let active = true
    signInWithPasskey({ fromKeyboard: true })
      .then(() => {
        if (active) return signedIn.current()
      })
      .catch(() => {
        // Nothing picked from the keyboard, or another sign-in took over.
      })
    return () => {
      active = false
      WebAuthnAbortService.cancelCeremony()
    }
  }, [])

  const send = () =>
    runner.run('email', async () => {
      await emailCodes.sendSignIn(email.trim())
      setCode('')
      setStep('code')
    })

  return {
    ...runner,
    step,
    setStep,
    email,
    setEmail,
    code,
    setCode,
    send,
    passkey: () =>
      runner.run('passkey', async () => {
        await signInWithPasskey()
        await onSignedIn()
      }),
    confirm: (value = code) =>
      runner.run('code', async () => {
        await retypable(() => emailCodes.signIn(email.trim(), value), setCode)
        await onSignedIn()
      }),
  }
}
