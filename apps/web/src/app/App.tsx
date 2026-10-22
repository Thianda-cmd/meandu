import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useLayoutEffect } from 'react'
import { Onboarding } from '../features/onboarding/Onboarding'
import { SheetHost } from '../features/SheetHost'
import { useT } from '../i18n'
import { startHistorySync } from '../navigation/history'
import { TabBar, TabNavigator } from '../navigation/TabBar'
import { haptics } from '../platform'
import { useData } from '../state/data'
import { useUi } from '../state/ui'
import { startSync } from '../sync/engine'
import { HeartPop } from '../ui/HeartPop'
import { ToastHost } from '../ui/Toast'
import { ErrorBoundary } from './ErrorBoundary'
import { useKeyboardInset, useLaunchShortcut, useThemeAndLanguage, useTypingFlag } from './hooks'
import { UpdateWatcher } from './UpdateWatcher'

/** Fades out the launch screen from index.html once the app can draw its first real frame. */
function hideSplash() {
  const splash = document.getElementById('splash')
  if (!splash) return
  splash.classList.add('splash-out')
  const remove = () => splash.remove()
  splash.addEventListener('transitionend', remove, { once: true })
  window.setTimeout(remove, 700)
}

export function App() {
  useThemeAndLanguage()
  useKeyboardInset()
  const hydrated = useData((s) => s.hydrated)
  const mode = useData((s) => s.mode)
  const joinCode = useUi((s) => s.joinCode)

  useLayoutEffect(() => {
    if (hydrated) hideSplash()
  }, [hydrated])

  useEffect(() => (mode === 'synced' ? startSync() : undefined), [mode])

  // The launch screen stays up while the saved data loads (a few milliseconds).
  if (!hydrated) return null

  // An invite link opened in the demo goes straight to joining for real.
  const onboarding = mode === 'none' || (mode === 'demo' && joinCode !== null)

  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <AnimatePresence initial={false}>
          {onboarding ? <Onboarding key="onboarding" /> : <Main key="main" />}
        </AnimatePresence>
        <ToastHost />
        <HeartPop />
      </ErrorBoundary>
      <UpdateWatcher />
    </MotionConfig>
  )
}

function Main() {
  useTypingFlag()
  useLaunchShortcut()
  usePartnerArrival()
  useJoinLink()
  useEffect(() => startHistorySync(), [])

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
    >
      <div className="app-shell absolute inset-0 overflow-hidden bg-canvas">
        <TabNavigator />
        <TabBar />
      </div>
      <SheetHost />
    </motion.div>
  )
}

/** A little party when your person joins. */
function usePartnerArrival() {
  const t = useT()
  useEffect(
    () =>
      useData.subscribe((state, previous) => {
        // The first sync after joining brings your person along; that's not an arrival.
        if (state.mode !== 'synced' || previous.mode !== 'synced' || previous.cursor === 0) return
        const before = previous.people.some((p) => p.id !== previous.meId)
        const partner = state.people.find((p) => p.id !== state.meId)
        if (before || !partner) return
        haptics.success()
        useUi.getState().showToast(t.invite.arrived(partner.name))
        useUi.getState().celebrate()
      }),
    [t],
  )
}

/** An invite link opened on a phone that already has its own space. */
function useJoinLink() {
  const t = useT()
  const code = useUi((s) => s.joinCode)
  const mode = useData((s) => s.mode)
  const paired = useData((s) => s.people.some((p) => p.id !== s.meId))

  useEffect(() => {
    if (!code || mode !== 'synced') return
    useUi.getState().setJoinCode(null)
    if (paired) useUi.getState().showToast(t.onboarding.errors['already-paired'] ?? '')
    else useUi.getState().openSheet({ type: 'join', code })
  }, [code, mode, paired, t])
}
