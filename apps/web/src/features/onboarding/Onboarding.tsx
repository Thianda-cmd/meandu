import { dayCount, Temporal } from '@meandu/core'
import { CaretLeft, Heart } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { useLocale, useT } from '../../i18n'
import { formatDay } from '../../lib/format'
import { todayDate } from '../../lib/time'
import { haptics } from '../../platform'
import { useData } from '../../state/data'
import { useSettings } from '../../state/settings'
import type { Tone } from '../../state/types'
import { useUi } from '../../state/ui'
import { Avatar, PendingAvatar } from '../../ui/Avatar'
import { Segmented } from '../../ui/controls'
import { AnimatedLogo } from '../../ui/Logo'
import { STACK_SPRING } from '../../ui/motion'
import { IconButton } from '../../ui/Pressable'
import { NativeDateInput } from '../../ui/pickers'
import { BigButton } from '../../ui/states'
import { TonePicker } from '../../ui/TonePicker'
import { CodeInput } from '../invite/CodeInput'
import { createSpace, joinSpace } from './actions'

type Step = 'welcome' | 'you' | 'since' | 'code'
type Path = 'create' | 'join'

const slide = {
  enter: (direction: number) => ({ x: `${direction * 30}%`, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: `${direction * -30}%`, opacity: 0 }),
}

/** First launch: say hi, then start your own space or join your person's. */
export function Onboarding() {
  const t = useT()
  const joinCode = useUi((s) => s.joinCode)
  const [path, setPath] = useState<Path>(joinCode ? 'join' : 'create')
  const [step, setStep] = useState<Step>(joinCode ? 'you' : 'welcome')
  const [direction, setDirection] = useState(1)
  const [name, setName] = useState('')
  const [tone, setTone] = useState<Tone>(joinCode ? 'sage' : 'coral')
  const [since, setSince] = useState<string | null>(null)
  const [code, setCode] = useState(joinCode ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const go = (next: Step, dir: 1 | -1 = 1) => {
    setDirection(dir)
    setError(null)
    setStep(next)
  }
  const back = () => {
    if (step === 'since' || step === 'code') go('you', -1)
    else if (step === 'you') go('welcome', -1)
  }
  useSystemBack(step !== 'welcome', step, back)

  const start = (next: Path) => {
    setPath(next)
    if (next === 'create' && tone === 'sage') setTone('coral')
    go('you')
  }

  const fail = (e: unknown) => {
    haptics.warn()
    setError(e instanceof ApiError ? e.code : 'server')
    setShake((n) => n + 1)
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      await createSpace({ name: name.trim(), tone }, since)
      haptics.success()
      useUi.getState().setJoinCode(null)
      // The app takes over now; the invite comes up once it's in place.
      window.setTimeout(() => useUi.getState().openSheet({ type: 'invite' }), 700)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const join = async (value = code) => {
    if (value.length !== 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      await joinSpace(value, { name: name.trim(), tone })
      haptics.success()
      useUi.getState().setJoinCode(null)
      useUi.getState().showToast(t.onboarding.joined)
      useUi.getState().celebrate()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const errorText = error && (t.onboarding.errors[error] ?? t.onboarding.errors.server)

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-canvas"
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={STACK_SPRING}
          className="absolute inset-0"
        >
          {step === 'welcome' && (
            <Welcome
              onStart={() => start('create')}
              onCode={() => start('join')}
              onLookAround={() => {
                useUi.getState().setJoinCode(null)
                useData.getState().startDemo(useSettings.getState().lang)
              }}
            />
          )}
          {step === 'you' && (
            <StepLayout
              onBack={back}
              title={t.onboarding.nameTitle}
              footer={
                <BigButton
                  isDisabled={!name.trim()}
                  onPress={() => go(path === 'create' ? 'since' : 'code')}
                >
                  {t.onboarding.next}
                </BigButton>
              }
            >
              <div className="flex flex-col items-center pt-6">
                <Avatar person={{ id: 'me', name, tone }} size={96} className="shadow-soft" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) go(path === 'create' ? 'since' : 'code')
                  }}
                  placeholder={t.onboarding.namePlaceholder}
                  aria-label={t.onboarding.namePlaceholder}
                  maxLength={40}
                  autoComplete="given-name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  className="mt-6 w-full rounded-card bg-surface px-4 py-3.5 text-center font-display text-title font-extrabold shadow-soft"
                />
                <p className="mt-8 pb-3 text-sub font-semibold text-ink-2">
                  {t.onboarding.colorTitle}
                </p>
                <TonePicker
                  label={t.onboarding.colorTitle}
                  value={tone}
                  onChange={setTone}
                  onCanvas
                />
              </div>
            </StepLayout>
          )}
          {step === 'since' && (
            <StepLayout
              onBack={back}
              title={t.onboarding.sinceTitle}
              footer={
                <>
                  <ErrorLine text={errorText} />
                  <BigButton busy={busy} onPress={create}>
                    {t.onboarding.create}
                  </BigButton>
                </>
              }
            >
              <SincePicker name={name} tone={tone} value={since} onChange={setSince} />
            </StepLayout>
          )}
          {step === 'code' && (
            <StepLayout
              onBack={back}
              title={t.onboarding.codeTitle}
              footer={
                <BigButton busy={busy} isDisabled={code.length !== 6} onPress={() => join()}>
                  {t.onboarding.join}
                </BigButton>
              }
            >
              <p className="-mt-1 pb-8 text-center text-body text-ink-2">{t.onboarding.codeHint}</p>
              <CodeInput
                value={code}
                onChange={(value) => {
                  setCode(value)
                  setError(null)
                }}
                onComplete={(value) => void join(value)}
                label={t.onboarding.codeTitle}
                shake={shake}
                autoFocus
              />
              <ErrorLine text={errorText} />
            </StepLayout>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

function Welcome({
  onStart,
  onCode,
  onLookAround,
}: {
  onStart: () => void
  onCode: () => void
  onLookAround: () => void
}) {
  const t = useT()
  const lang = useSettings((s) => s.lang)
  const setLang = useSettings((s) => s.setLang)

  return (
    <div className="welcome-glow flex h-full flex-col">
      <div
        className="flex justify-end px-4"
        style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)' }}
      >
        <Segmented
          label={t.settings.language}
          value={lang}
          onChange={setLang}
          className="w-28"
          options={[
            { value: 'en', label: 'EN', ariaLabel: 'English' },
            { value: 'de', label: 'DE', ariaLabel: 'Deutsch' },
          ]}
        />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <AnimatedLogo size={120} />
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 font-display text-[2.75rem] font-extrabold leading-none tracking-tight"
        >
          meandu
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 text-title text-ink-2"
        >
          {t.onboarding.tagline}
        </motion.p>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-md space-y-3 px-6"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.25rem)' }}
      >
        <BigButton haptic="tap" onPress={onStart}>
          {t.onboarding.start}
        </BigButton>
        <BigButton haptic="tap" variant="soft" onPress={onCode}>
          {t.onboarding.haveCode}
        </BigButton>
        <BigButton variant="plain" className="h-11" onPress={onLookAround}>
          {t.onboarding.lookAround}
        </BigButton>
        <p className="text-center text-foot text-ink-3">{t.onboarding.age}</p>
      </motion.div>
    </div>
  )
}

/** Title at the top, content below it, the main button at the bottom above the keyboard. */
function StepLayout({
  title,
  onBack,
  footer,
  children,
}: {
  title: string
  onBack: () => void
  footer: ReactNode
  children: ReactNode
}) {
  const t = useT()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-(--nav-h) items-center px-3" style={{ marginTop: 'var(--safe-top)' }}>
        <IconButton label={t.common.back} onPress={onBack}>
          <CaretLeft size={20} weight="bold" />
        </IconButton>
      </div>
      <div className="scroll-y mx-auto w-full max-w-md flex-1 px-6 pt-4">
        <h1 className="text-balance pb-4 text-center font-display text-large font-extrabold tracking-tight">
          {title}
        </h1>
        {children}
      </div>
      <div
        className="mx-auto w-full max-w-md px-6 pt-3"
        style={{ paddingBottom: 'calc(max(var(--safe-bottom), var(--keyboard, 0px)) + 1.25rem)' }}
      >
        {footer}
      </div>
    </div>
  )
}

function ErrorLine({ text }: { text: string | null | undefined }) {
  return (
    <p role="alert" className="min-h-6 pb-2 pt-3 text-center text-sub font-semibold text-coral-ink">
      {text}
    </p>
  )
}

/** The two of you, a big date to tap, and how many days that makes. */
function SincePicker({
  name,
  tone,
  value,
  onChange,
}: {
  name: string
  tone: Tone
  value: string | null
  onChange: (value: string) => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const today = todayDate()
  const date = value ? Temporal.PlainDate.from(value) : null
  const days = date ? dayCount(date, today) : 0

  return (
    <div className="flex flex-col items-center pt-6">
      <span className="flex items-center">
        <Avatar person={{ id: 'me', name, tone }} size={64} className="ring-4 ring-canvas" />
        <Heart size={26} weight="fill" className="z-10 -mx-2 text-coral" />
        <PendingAvatar size={64} className="ring-4 ring-canvas" />
      </span>
      <span className="relative mt-10 rounded-card bg-surface px-7 py-4 shadow-soft transition-transform duration-200 active:scale-[0.97]">
        <span className={date ? 'font-display text-title font-bold' : 'text-title text-ink-3'}>
          {date ? formatDay(date, locale) : t.onboarding.pickDate}
        </span>
        <NativeDateInput
          label={t.onboarding.sinceTitle}
          value={value}
          max={today.toString()}
          onChange={onChange}
        />
      </span>
      <AnimatePresence>
        {date && days > 0 && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-body font-semibold text-ink-2"
          >
            {days.toLocaleString(locale)} {t.today.days(days)} {t.today.together} 💛
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Android's back button and the browser's back go one step back instead of leaving.
 * One history entry is kept in front of us while there's a step to go back to.
 */
function useSystemBack(active: boolean, step: Step, onBack: () => void) {
  const handler = useRef(onBack)
  handler.current = onBack
  const guarded = useRef(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-arm after every step change
  useEffect(() => {
    if (active && !guarded.current) {
      history.pushState({ meandu: 'onboarding' }, '')
      guarded.current = true
    }
  }, [active, step])

  useEffect(() => {
    const onPop = () => {
      guarded.current = false
      handler.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
}
