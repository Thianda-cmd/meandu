import {
  EnvelopeSimple,
  Fingerprint,
  Plus,
  ShieldCheck,
  SignOut,
  UserMinus,
  WarningCircle,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { passkeysSupported, removePasskey } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useLocale, useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptics } from '../../platform'
import { useAccount } from '../../state/account'
import { useUi } from '../../state/ui'
import { Pressable } from '../../ui/Pressable'
import { ErrorLine, Spinner } from '../../ui/states'
import { authError, useSecureFlow } from './flows'

/** How you get back into your account: status, email, passkeys, signing out. */
export function AccountCard() {
  const t = useT()
  const { locale } = useLocale()
  const info = useAccount((s) => s.info)
  const emailSignIn = useAccount((s) => s.emailSignIn)
  const openSheet = useUi((s) => s.openSheet)
  const flow = useSecureFlow(() => useUi.getState().showToast(t.auth.done), { doneDelay: 0 })
  // Removing takes a second tap, so a stray one can't lock you out of a device.
  const [armed, setArmed] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    void useAccount.getState().load()
  }, [])

  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(null), 4000)
    return () => window.clearTimeout(timer)
  }, [armed])

  if (!info) return null

  // The last way back in can't be removed.
  const ways = (info.email ? 1 : 0) + info.passkeys.length

  const remove = async (id: string) => {
    if (armed !== id) {
      haptics.select()
      setArmed(id)
      return
    }
    setRemoving(id)
    try {
      await removePasskey(id)
      await useAccount.getState().load()
      haptics.warn()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SESSION_NOT_FRESH') openSheet({ type: 'confirm' })
      else useUi.getState().showToast(t.oops.hint)
    } finally {
      setRemoving(null)
      setArmed(null)
    }
  }

  return (
    <div className="rounded-card bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3 pb-3">
        <p className="text-sub font-semibold text-ink-2">{t.settings.account}</p>
        <span
          className={cx(
            'flex items-center gap-1 rounded-full py-1 pl-2 pr-2.5 text-foot font-bold',
            info.protected ? 'bg-sage-soft text-sage-ink' : 'bg-honey-soft text-honey-ink',
          )}
        >
          {info.protected ? (
            <ShieldCheck size={14} weight="fill" />
          ) : (
            <WarningCircle size={14} weight="fill" />
          )}
          {info.protected ? t.settings.protectedYes : t.settings.protectedNo}
        </span>
      </div>
      {!info.protected && <p className="pb-2 text-sub text-ink-2">{t.settings.protectedNoHint}</p>}

      <div className="-mx-1 divide-y divide-line">
        {info.email ? (
          <div className="flex min-h-12 items-center gap-3 px-1 py-2">
            <EnvelopeSimple size={20} className="shrink-0 text-ink-2" />
            <span className="min-w-0 flex-1 truncate text-body">{info.email}</span>
          </div>
        ) : (
          emailSignIn && (
            <Pressable
              feedback="row"
              onPress={() => openSheet({ type: 'secure', start: 'email' })}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 py-2 text-body font-semibold text-coral-ink"
            >
              <EnvelopeSimple size={20} className="shrink-0" />
              {t.settings.addEmail}
            </Pressable>
          )
        )}

        {info.passkeys.map((key) => (
          <div key={key.id} className="flex min-h-12 items-center gap-3 px-1 py-2">
            <Fingerprint size={20} className="shrink-0 text-ink-2" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body">{key.name ?? 'Passkey'}</span>
              <span className="block text-foot text-ink-3">
                {t.settings.added(
                  new Date(key.createdAt).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }),
                )}
              </span>
            </span>
            {ways > 1 && (
              <Pressable
                haptic={false}
                isDisabled={removing === key.id}
                onPress={() => void remove(key.id)}
                className={cx(
                  'shrink-0 rounded-full px-3 py-1.5 text-sub font-semibold transition-colors',
                  armed === key.id ? 'bg-coral text-white' : 'text-ink-3',
                )}
              >
                {removing === key.id ? <Spinner size={16} /> : t.settings.remove}
              </Pressable>
            )}
          </div>
        ))}

        {passkeysSupported() && (
          <Pressable
            feedback="row"
            isDisabled={flow.busy !== false}
            onPress={flow.passkey}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 py-2 text-body font-semibold text-coral-ink"
          >
            {flow.busy === 'passkey' ? (
              <Spinner size={20} className="shrink-0" />
            ) : (
              <Plus size={20} weight="bold" className="shrink-0" />
            )}
            {t.settings.addPasskey}
          </Pressable>
        )}
      </div>
      {flow.error && <ErrorLine text={authError(t, flow.error)} />}

      <div className="mt-2 -mx-1 divide-y divide-line border-t border-line">
        {info.protected && (
          <Pressable
            feedback="row"
            onPress={() => openSheet({ type: 'signout' })}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 text-body font-semibold text-ink-2"
          >
            <SignOut size={20} className="shrink-0" />
            {t.settings.signOut}
          </Pressable>
        )}
        <Pressable
          feedback="row"
          onPress={() => openSheet({ type: 'deleteAccount' })}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 text-body font-semibold text-coral-ink"
        >
          <UserMinus size={20} className="shrink-0" />
          {t.space.deleteAccount}
        </Pressable>
      </div>
    </div>
  )
}
