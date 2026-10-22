import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from '@simplewebauthn/browser'
import { ApiError, call } from './client'

/** Thrown when the person closed the passkey prompt: not worth an error message. */
export class Cancelled extends Error {}

export const passkeysSupported = () => browserSupportsWebAuthn()

async function ceremony<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof ApiError) throw error
    // Closing the sheet, a timeout or another prompt taking over all land here.
    const name =
      error instanceof WebAuthnError
        ? (error.cause as Error | undefined)?.name
        : (error as Error)?.name
    const aborted = error instanceof WebAuthnError && error.code === 'ERROR_CEREMONY_ABORTED'
    if (aborted || name === 'NotAllowedError' || name === 'AbortError') throw new Cancelled()
    throw new ApiError(0, error instanceof WebAuthnError ? error.code : 'passkey')
  }
}

/**
 * Adds a passkey to this account, labelled with your name in the phone's password list.
 * A device-only account first swaps in a fresh session, which adding a passkey needs.
 */
export async function addPasskey(name: string, { deviceOnly }: { deviceOnly: boolean }) {
  if (deviceOnly) await call('/auth/device/renew', {})
  const optionsJSON = await call<Parameters<typeof startRegistration>[0]['optionsJSON']>(
    `/auth/passkey/generate-register-options?name=${encodeURIComponent(name)}`,
  )
  const response = await ceremony(() => startRegistration({ optionsJSON }))
  await call('/auth/passkey/verify-registration', { response })
}

/**
 * Signs in with a passkey on this device, or a phone nearby. With `fromKeyboard`, it waits
 * quietly until one is picked from the keyboard's suggestions on an email field; starting
 * another sign-in cancels that wait.
 */
export async function signInWithPasskey({ fromKeyboard = false } = {}) {
  if (fromKeyboard && !(await browserSupportsWebAuthnAutofill())) throw new Cancelled()
  const optionsJSON = await call<Parameters<typeof startAuthentication>[0]['optionsJSON']>(
    '/auth/passkey/generate-authenticate-options',
  )
  await ceremony(async () => {
    const response = await startAuthentication({ optionsJSON, useBrowserAutofill: fromKeyboard })
    await call('/auth/passkey/verify-authentication', { response })
  })
}

export const emailCodes = {
  /** Sends a sign-in code. Nothing is sent to addresses without an account. */
  sendSignIn: (email: string) =>
    call('/auth/email-otp/send-verification-otp', { email, type: 'sign-in' }),
  signIn: (email: string, otp: string) => call('/auth/sign-in/email-otp', { email, otp }),
  /** Sends a code to confirm a new address for this account. */
  sendAdd: (newEmail: string) => call('/auth/email-otp/request-email-change', { newEmail }),
  add: (newEmail: string, otp: string) => call('/auth/email-otp/change-email', { newEmail, otp }),
}

export const removePasskey = (id: string) => call('/auth/passkey/delete-passkey', { id })

export const signOut = () => call('/auth/sign-out', {})
