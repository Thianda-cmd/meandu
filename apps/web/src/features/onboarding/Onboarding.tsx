import { dayCount, Temporal } from '@meandu/core'
import { CaretLeft, EnvelopeSimple, Fingerprint, Heart } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { passkeysSupported } from '../../api/auth'
import { ApiError, api } from '../../api/client'
import { useLocale, useT } from '../../i18n'
import { todayDate } from '../../lib/time'
import { haptics } from '../../platform'
import { useAccount } from '../../state/account'
import { useData } from '../../state/data'
import { useSettings } from '../../state/settings'
import type { Tone } from '../../state/types'
import { useUi } from '../../state/ui'
import { syncNow } from '../../sync/engine'
import { Avatar, CoupleAvatars, PendingAvatar } from '../../ui/Avatar'
import { CodeInput } from '../../ui/CodeInput'
import { Segmented } from '../../ui/controls'
import { AnimatedLogo } from '../../ui/Logo'
import { STACK_SPRING } from '../../ui/motion'
import { IconButton, Pressable } from '../../ui/Pressable'
import { NativeDateInput } from '../../ui/pickers'
import { BigButton, ErrorLine } from '../../ui/states'
import { TonePicker } from '../../ui/TonePicker'
import { useSecureFlow, useSignInFlow } from '../account/flows'
import { DoneMark, KeyGlyph, OrLine } from '../account/parts'
import { CodeStep, EmailStep } from '../account/sheets'
import { createSpace, joinSpace } from './actions'

type Step = 'welcome' | 'you' | 'since' | 'code' | 'safe' | 'signin'
type Path = 'create' | 'join'

/** A step inside a sub-flow takes over the back button while it has somewhere to go back to. */
type BackHandler = { current: (() => boolean) | null }

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
  const [subStep, setSubStep] = useState('')
  const subBack: BackHandler = useRef(null)
  const emailSignIn = useAccount((s) => s.emailSignIn)
  const canSecure = passkeysSupported() || emailSignIn

  const go = (next: Step, dir: 1 | -1 = 1) => {
    setDirection(dir)
    setError(null)
    setSubStep('')
    subBack.current = null
    setStep(next)
  }
  const back = () => {
    if (subBack.current?.()) return
    if (step === 'since' || step === 'code') go('you', -1)
    else if (step === 'you' || step === 'signin') go('welcome', -1)
  }
  // Once the space exists there's no going back, only on to the app.
  const canGoBack =
    step !== 'welcome' && (step !== 'safe' || (subStep !== 'choose' && subStep !== 'done'))
  useSystemBack(canGoBack, `${step}:${subStep}`, back)

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

  /** Into the app: the invite comes up for a new space, a little party for joining one. */
  const finish = () => {
    useUi.getState().setOnboardingOpen(false)
    if (path === 'create') {
      window.setTimeout(() => useUi.getState().openSheet({ type: 'invite' }), 700)
    } else {
      useUi.getState().showToast(t.onboarding.joined)
      useUi.getState().celebrate()
    }
  }

  /** Creates or joins the space, then offers to keep it safe before going in. */
  const enterSpace = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    useUi.getState().setOnboardingOpen(true)
    try {
      await action()
      haptics.success()
      if (canSecure) go('safe')
      else finish()
    } catch (e) {
      useUi.getState().setOnboardingOpen(false)
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const create = () => enterSpace(() => createSpace({ name: name.trim(), tone }, since))

  const join = async (value = code) => {
    if (value.length !== 6 || busy) return
    await enterSpace(() => joinSpace(value, { name: name.trim(), tone }))
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
              onSignIn={canSecure ? () => go('signin') : undefined}
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
                  className="mt-6 w-full rounded-card bg-surface px-4 py-3.5 text-center font-display text-title font-extrabold shadow-soft transition-shadow focus:ring-2 focus:ring-coral/40"
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
          {step === 'safe' && (
            <SafeSteps onDone={finish} back={subBack} onStepChange={setSubStep} />
          )}
          {step === 'signin' && (
            <SignInSteps onBack={back} back={subBack} onStepChange={setSubStep} />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

const SUB_STEPS = ['choose', 'email', 'code', 'done']

/** Sub-steps slide like the main ones: deeper ones from the right, back from the left. */
function SubSteps({ step, children }: { step: string; children: ReactNode }) {
  const previous = useRef(step)
  const direction = useRef(1)
  if (previous.current !== step) {
    direction.current = SUB_STEPS.indexOf(step) >= SUB_STEPS.indexOf(previous.current) ? 1 : -1
    previous.current = step
  }
  return (
    <AnimatePresence initial={false} custom={direction.current}>
      <motion.div
        key={step}
        custom={direction.current}
        variants={slide}
        initial="enter"
        animate="center"
        exit="exit"
        transition={STACK_SPRING}
        className="absolute inset-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Right after the space exists: add a passkey or an email, or do it later. */
function SafeSteps({
  onDone,
  back,
  onStepChange,
}: {
  onDone: () => void
  back: BackHandler
  onStepChange: (step: string) => void
}) {
  const t = useT()
  const emailSignIn = useAccount((s) => s.emailSignIn)
  const flow = useSecureFlow(onDone)
  const canPasskey = passkeysSupported()

  useEffect(() => onStepChange(flow.step), [flow.step, onStepChange])
  back.current = () => {
    if (flow.step === 'email') flow.setStep('choose')
    else if (flow.step === 'code') flow.setStep('email')
    else return false
    return true
  }

  return (
    <SubSteps step={flow.step}>
      {flow.step === 'choose' && (
        <StepLayout
          title={t.auth.safeTitle}
          footer={
            <div className="space-y-3">
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
              <BigButton variant="plain" compact onPress={onDone}>
                {t.invite.later}
              </BigButton>
            </div>
          }
        >
          <div className="flex flex-col items-center pt-2 text-center">
            <CoupleAvatars size={44} />
            <div className="mt-8">
              <KeyGlyph size={120} />
            </div>
            <p className="mt-6 text-title text-ink-2">{t.auth.safeHint}</p>
            {canPasskey && <p className="mt-2 text-sub text-ink-3">{t.auth.passkeyHint}</p>}
            <ErrorLine text={flow.error && (t.auth.errors[flow.error] ?? t.auth.errors.server)} />
          </div>
        </StepLayout>
      )}
      {flow.step === 'email' && (
        <StepLayout
          title={t.auth.emailTitle}
          onBack={() => flow.setStep('choose')}
          footer={
            <BigButton
              busy={flow.busy === 'email'}
              isDisabled={!flow.email.includes('@')}
              onPress={flow.send}
            >
              {t.auth.sendCode}
            </BigButton>
          }
        >
          <div className="pt-6">
            <EmailStep flow={flow} />
          </div>
        </StepLayout>
      )}
      {flow.step === 'code' && (
        <StepLayout
          title={t.auth.checkEmail}
          onBack={() => flow.setStep('email')}
          footer={
            <BigButton
              busy={flow.busy === 'code'}
              isDisabled={flow.code.length !== 6}
              onPress={() => flow.confirm()}
            >
              {t.auth.confirm}
            </BigButton>
          }
        >
          <CodeStep flow={flow} />
        </StepLayout>
      )}
      {flow.step === 'done' && (
        <div className="flex h-full items-center justify-center">
          <DoneMark label={t.auth.done} />
        </div>
      )}
    </SubSteps>
  )
}

/** Back on a new phone: a passkey, or a code by email, and everything comes back. */
function SignInSteps({
  onBack,
  back,
  onStepChange,
}: {
  onBack: () => void
  back: BackHandler
  onStepChange: (step: string) => void
}) {
  const t = useT()
  const emailSignIn = useAccount((s) => s.emailSignIn)
  const canPasskey = passkeysSupported()

  const enter = async () => {
    // Throws "no-space" for an account that isn't in a space (yet); shown on this screen.
    const state = await api.space()
    haptics.success()
    useData.getState().beginSynced(state)
    void useAccount.getState().load()
    void syncNow()
    useUi.getState().showToast(t.auth.welcomeBack)
  }
  const flow = useSignInFlow(enter, { autofill: emailSignIn })

  useEffect(() => onStepChange(flow.step), [flow.step, onStepChange])
  back.current = () => {
    if (flow.step !== 'code') return false
    flow.setStep('choose')
    return true
  }

  return (
    <SubSteps step={flow.step}>
      {flow.step === 'choose' ? (
        <StepLayout
          title={t.auth.welcomeBack}
          onBack={onBack}
          footer={
            emailSignIn && (
              <BigButton
                variant={canPasskey ? 'soft' : 'primary'}
                busy={flow.busy === 'email'}
                isDisabled={!flow.email.includes('@')}
                onPress={flow.send}
              >
                {t.auth.sendCode}
              </BigButton>
            )
          }
        >
          <div className="flex flex-col items-center pt-4">
            <AnimatedLogo size={88} />
            {canPasskey && (
              <BigButton busy={flow.busy === 'passkey'} onPress={flow.passkey} className="mt-8">
                <Fingerprint size={22} weight="bold" />
                {t.auth.withPasskey}
              </BigButton>
            )}
            {emailSignIn && (
              <div className="mt-6 w-full space-y-4">
                {canPasskey && <OrLine label={t.auth.or} />}
                <EmailStep flow={flow} forSignIn />
              </div>
            )}
            {!emailSignIn && (
              <ErrorLine text={flow.error && (t.auth.errors[flow.error] ?? t.auth.errors.server)} />
            )}
          </div>
        </StepLayout>
      ) : (
        <StepLayout
          title={t.auth.checkEmail}
          onBack={() => flow.setStep('choose')}
          footer={
            <BigButton
              busy={flow.busy === 'code'}
              isDisabled={flow.code.length !== 6}
              onPress={() => flow.confirm()}
            >
              {t.auth.confirm}
            </BigButton>
          }
        >
          <CodeStep flow={flow} />
        </StepLayout>
      )}
    </SubSteps>
  )
}

function Welcome({
  onStart,
  onCode,
  onSignIn,
  onLookAround,
}: {
  onStart: () => void
  onCode: () => void
  /** Missing when there's no way to sign in on this device. */
  onSignIn?: () => void
  onLookAround: () => void
}) {
  const t = useT()
  const lang = useSettings((s) => s.lang)
  const setLang = useSettings((s) => s.setLang)

  return (
    <div className="welcome-glow flex h-full flex-col">
      <div
        className="flex items-center justify-between px-4"
        style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)' }}
      >
        {onSignIn ? (
          <Pressable
            haptic="tap"
            onPress={onSignIn}
            className="rounded-full px-3 py-1.5 text-headline font-semibold text-ink-2"
          >
            {t.auth.signIn}
          </Pressable>
        ) : (
          <span />
        )}
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
        <BigButton variant="plain" compact onPress={onLookAround}>
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
  /** Missing when there's nothing to go back to. */
  onBack?: () => void
  footer: ReactNode
  children: ReactNode
}) {
  const t = useT()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-(--nav-h) items-center px-3" style={{ marginTop: 'var(--safe-top)' }}>
        {onBack && (
          <IconButton label={t.common.back} onPress={onBack}>
            <CaretLeft size={20} weight="bold" />
          </IconButton>
        )}
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
          {date
            ? date.toLocaleString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
            : t.onboarding.pickDate}
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
function useSystemBack(active: boolean, step: string, onBack: () => void) {
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
