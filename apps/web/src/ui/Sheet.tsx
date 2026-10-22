import { X } from '@phosphor-icons/react'
import { AnimatePresence, type DragControls, motion, useDragControls } from 'motion/react'
import { createContext, type ReactNode, useContext, useEffect } from 'react'
import { Dialog, Modal, ModalOverlay } from 'react-aria-components'
import { useT } from '../i18n'
import { SHEET_SPRING } from './motion'
import { IconButton } from './Pressable'

const MotionOverlay = motion.create(ModalOverlay)
const MotionModal = motion.create(Modal)

const SheetDrag = createContext<DragControls | null>(null)

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Accessible name of the dialog. */
  label: string
  children: ReactNode
}

/** A bottom sheet: slides up, drag the top part down to dismiss, the app shrinks back behind it. */
export function Sheet({ open, onClose, label, children }: SheetProps) {
  useEffect(() => {
    if (!open) return
    document.documentElement.dataset.sheet = 'open'
    return () => {
      delete document.documentElement.dataset.sheet
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <MotionOverlay
          isOpen
          isDismissable
          onOpenChange={(isOpen) => {
            if (!isOpen) onClose()
          }}
          className="fixed inset-0 z-50"
          style={{ background: 'var(--scrim)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Panel label={label} onClose={onClose}>
            {children}
          </Panel>
        </MotionOverlay>
      )}
    </AnimatePresence>
  )
}

function Panel({ label, onClose, children }: Omit<SheetProps, 'open'>) {
  const controls = useDragControls()
  return (
    <MotionModal
      className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[calc(100dvh-var(--safe-top)-0.75rem)] w-full max-w-xl flex-col rounded-t-sheet bg-surface shadow-float outline-none"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={SHEET_SPRING}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.04, bottom: 1 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 110 || info.velocity.y > 500) onClose()
      }}
    >
      <Dialog aria-label={label} className="flex min-h-0 flex-1 flex-col outline-none">
        <SheetDrag.Provider value={controls}>{children}</SheetDrag.Provider>
      </Dialog>
    </MotionModal>
  )
}

/** Grabber, close button, title and an optional action. Dragging here moves the sheet. */
export function SheetHeader({
  title,
  onClose,
  action,
}: {
  title: string
  onClose: () => void
  action?: ReactNode
}) {
  const t = useT()
  const controls = useContext(SheetDrag)
  return (
    <div
      className="relative shrink-0 touch-none px-3 pb-1 pt-2"
      onPointerDown={(event) => controls?.start(event)}
    >
      <div className="mx-auto mb-1.5 h-1.5 w-10 rounded-full bg-ink-3/40" />
      <div className="flex h-11 items-center gap-2">
        <IconButton label={t.common.close} onPress={onClose}>
          <X size={18} weight="bold" />
        </IconButton>
        <h2 className="pointer-events-none absolute inset-x-20 truncate text-center text-headline font-semibold">
          {title}
        </h2>
        <div className="ml-auto">{action}</div>
      </div>
    </div>
  )
}

/** The scrolling part of a sheet. */
export function SheetBody({ children }: { children: ReactNode }) {
  return (
    <div
      className="scroll-y min-h-0 flex-1 px-4 pt-2"
      style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)' }}
    >
      {children}
    </div>
  )
}
