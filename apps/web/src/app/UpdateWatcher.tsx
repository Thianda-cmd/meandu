import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect } from 'react'

const HOUR = 60 * 60 * 1000

/**
 * New versions install quietly in the background and switch over the next time the app
 * goes to the background, so an update never interrupts what you're doing.
 */
export function UpdateWatcher() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => registration.update().catch(() => {})
      window.setInterval(check, HOUR)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  useEffect(() => {
    if (!needRefresh) return
    const apply = () => {
      if (document.visibilityState === 'hidden') updateServiceWorker(true)
    }
    document.addEventListener('visibilitychange', apply)
    return () => document.removeEventListener('visibilitychange', apply)
  }, [needRefresh, updateServiceWorker])

  return null
}
