import { useState } from 'react'
import { ApiError } from '../../api/client'
import { useT } from '../../i18n'
import { haptics } from '../../platform'
import { useMe } from '../../state/data'
import { useUi } from '../../state/ui'
import { SheetBody, SheetHeader } from '../../ui/Sheet'
import { BigButton } from '../../ui/states'
import { joinSpace } from '../onboarding/actions'
import { CodeInput } from './CodeInput'

/** For a phone that already has its own space: join your person's instead. */
export function JoinSheet({ code: initial = '' }: { code?: string }) {
  const t = useT()
  const me = useMe()
  const close = useUi((s) => s.closeSheet)
  const [code, setCode] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const join = async (value = code) => {
    if (value.length !== 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      await joinSpace(value, { name: me.name, tone: me.tone })
      haptics.success()
      close()
      useUi.getState().showToast(t.onboarding.joined)
      useUi.getState().celebrate()
    } catch (e) {
      haptics.warn()
      setError(e instanceof ApiError ? e.code : 'server')
      setShake((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SheetHeader title={t.onboarding.codeTitle} onClose={close} />
      <SheetBody>
        <p className="pb-5 pt-1 text-center text-body text-ink-2">{t.onboarding.codeHint}</p>
        <CodeInput
          value={code}
          onChange={(value) => {
            setCode(value)
            setError(null)
          }}
          onComplete={(value) => void join(value)}
          label={t.onboarding.codeTitle}
          shake={shake}
          autoFocus={!initial}
          inSheet
        />
        <p role="alert" className="min-h-6 pt-3 text-center text-sub font-semibold text-coral-ink">
          {error && (t.onboarding.errors[error] ?? t.onboarding.errors.server)}
        </p>
        <BigButton
          className="mt-4"
          busy={busy}
          isDisabled={code.length !== 6}
          onPress={() => join()}
        >
          {t.onboarding.join}
        </BigButton>
      </SheetBody>
    </>
  )
}
