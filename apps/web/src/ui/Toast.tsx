import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { useUi } from '../state/ui'
import { SNAPPY } from './motion'
import { Pressable } from './Pressable'

/**
 * A small pill, usually with "Undo": above the tab bar, or at the top on screens without one,
 * where the big buttons sit at the bottom.
 */
export function ToastHost({ placement = 'bottom' }: { placement?: 'top' | 'bottom' }) {
  const toast = useUi((s) => s.toast)
  const hide = useUi((s) => s.hideToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(hide, 4500)
    return () => window.clearTimeout(timer)
  }, [toast, hide])

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={
        placement === 'top'
          ? { top: 'calc(var(--safe-top) + var(--nav-h) + 0.5rem)' }
          : { bottom: 'calc(var(--safe-bottom) + 6rem)' }
      }
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ y: placement === 'top' ? -24 : 24, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: placement === 'top' ? -12 : 12, opacity: 0, scale: 0.97 }}
            transition={SNAPPY}
            className="pointer-events-auto flex items-center gap-4 rounded-full bg-ink py-2.5 pl-5 pr-2 text-canvas shadow-float"
          >
            <span className="text-sub font-semibold">{toast.message}</span>
            {toast.action && (
              <Pressable
                haptic="tap"
                onPress={() => {
                  toast.action?.run()
                  hide()
                }}
                className="rounded-full bg-canvas/15 px-3 py-1 text-sub font-bold"
              >
                {toast.action.label}
              </Pressable>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
